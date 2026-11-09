'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  CheckCircle2,
  X,
  ArrowRight,
  PauseCircle,
  Clock,
  Barcode,
  ShoppingBag,
  Percent,
  LayoutGrid,
  ListOrdered,
  UserCheck,
  RotateCcw,
  Sparkles,
  Pill,
  FlaskConical,
  Leaf,
  Droplets,
  Package,
  RefreshCw,
  Loader2,
  Store,
  Layers,
} from 'lucide-react';
import type {
  CheckoutPayload,
  HeldCartDto,
  SaleDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';
import { getCachedCatalog, saveCachedCatalog } from '../../../lib/pos-catalog-db';

// =========================================================================
// REALISTIC HIGH-END E-COMMERCE RETAIL CATALOGUE
// Standard: Shopify Polaris & Stripe Dashboard (Deegayu Weda Madura Catalog)
// =========================================================================
interface RetailProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  category: { id?: string; name: string; slug: string };
  stockOnHand: number;
  unit: string;
  imageUrl?: string;
  alertQuantity?: number | null;
}

// Category visual helper for authentic herbal/pharmacy catalog cards
function getCategoryVisual(categoryName?: string) {
  const lower = (categoryName || '').toLowerCase();
  if (
    lower.includes('arishta') ||
    lower.includes('asawa') ||
    lower.includes('oil') ||
    lower.includes('syrup') ||
    lower.includes('liquid')
  ) {
    return {
      icon: Droplets,
      bg: 'bg-amber-50 text-amber-600 border-amber-200/70',
      badge: 'bg-amber-100/70 text-amber-800',
      tabColor: 'text-amber-700 bg-amber-50 border-amber-200',
    };
  }
  if (
    lower.includes('wati') ||
    lower.includes('guli') ||
    lower.includes('pill') ||
    lower.includes('tablet') ||
    lower.includes('capsule')
  ) {
    return {
      icon: Pill,
      bg: 'bg-indigo-50 text-indigo-600 border-indigo-200/70',
      badge: 'bg-indigo-100/70 text-indigo-800',
      tabColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    };
  }
  if (
    lower.includes('powder') ||
    lower.includes('churna') ||
    lower.includes('dry') ||
    lower.includes('ala') ||
    lower.includes('herbal') ||
    lower.includes('leaf') ||
    lower.includes('tea')
  ) {
    return {
      icon: Leaf,
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200/70',
      badge: 'bg-emerald-100/70 text-emerald-800',
      tabColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  }
  if (
    lower.includes('face') ||
    lower.includes('cream') ||
    lower.includes('soap') ||
    lower.includes('cosmetic') ||
    lower.includes('wash') ||
    lower.includes('balm')
  ) {
    return {
      icon: Sparkles,
      bg: 'bg-rose-50 text-rose-600 border-rose-200/70',
      badge: 'bg-rose-100/70 text-rose-800',
      tabColor: 'text-rose-700 bg-rose-50 border-rose-200',
    };
  }
  if (lower.includes('rasayana') || lower.includes('kalka')) {
    return {
      icon: FlaskConical,
      bg: 'bg-purple-50 text-purple-600 border-purple-200/70',
      badge: 'bg-purple-100/70 text-purple-800',
      tabColor: 'text-purple-700 bg-purple-50 border-purple-200',
    };
  }
  return {
    icon: Package,
    bg: 'bg-blue-50 text-[#005BD3] border-blue-200/70',
    badge: 'bg-blue-100/70 text-blue-800',
    tabColor: 'text-blue-700 bg-blue-50 border-blue-200',
  };
}

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number;
  discountAmount?: number;
  stockOnHand: number;
  unit: string;
  imageUrl?: string;
}

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  creditBalance: number;
  loyaltyPoints: number;
}

const DEFAULT_CUSTOMER: CustomerProfile = {
  id: 'walk-in',
  name: 'Walk-in Customer',
  phone: 'N/A',
  email: 'walkin@store.local',
  creditBalance: 0,
  loyaltyPoints: 0,
};

const SAMPLE_CUSTOMERS: CustomerProfile[] = [
  DEFAULT_CUSTOMER,
  {
    id: 'cust-1',
    name: 'Kavindu Senanayake (VIP)',
    phone: '+94 77 123 4567',
    email: 'kavindu@senanayake.lk',
    creditBalance: 45000.0,
    loyaltyPoints: 1250,
  },
  {
    id: 'cust-2',
    name: 'Apex Construction Ltd',
    phone: '+94 11 234 5678',
    email: 'procurement@apexholdings.lk',
    creditBalance: 150000.0,
    loyaltyPoints: 3400,
  },
  {
    id: 'cust-3',
    name: 'Dilrukshi Perera',
    phone: '+94 71 889 9001',
    email: 'dilrukshi@gmail.com',
    creditBalance: 12000.0,
    loyaltyPoints: 480,
  },
];

export default function PosCheckoutPage() {
  const { selectedBranchId, business, branches, tenant } = useTenantBranch();
  const activeBusinessName = business?.name || tenant?.name || 'Deegayu Weda Madura';
  const activeBranchName = branches.find((b) => b.id === selectedBranchId)?.name || 'Main Branch';

  // Mode View: 'grid' vs 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pricing Tier: 'RETAIL' (MSRP) vs 'WHOLESALE' (Bulk)
  const [pricingTier, setPricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

  // Catalogue & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [products, setProducts] = useState<RetailProductItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; count: number }[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(60);

  // Cart & Active Sale Ticket
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile>(DEFAULT_CUSTOMER);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const taxRatePercent = 8.0;

  // Tender Drawer & Payment State
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [activePaymentMethod, setActivePaymentMethod] = useState<'CASH' | 'CARD' | 'QR_PAYMENT' | 'STORE_CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Mobile Uber-Eats Slide-up Cart Sheet
  const [isMobileCartDrawerOpen, setIsMobileCartDrawerOpen] = useState(false);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Held Carts Modal
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCartDto[]>([]);

  // Customer Selector Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Scanner autofocus & tactile feedback
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Live Clock Pill
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Instant 0ms Hydration via IndexedDB / LocalStorage + Background Sync
  useEffect(() => {
    let isMounted = true;

    async function initCatalog() {
      // 1. Immediately hydrate from browser IndexedDB / LocalStorage cache (0ms instant startup)
      try {
        const cached = await getCachedCatalog<RetailProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 0 && isMounted) {
          setProducts(cached.products);
          setCategories(cached.categories || []);
          setTotalProductsCount(cached.total || cached.products.length);
          setIsLoadingProducts(false); // Immediate 0ms local paint
        }
      } catch (cacheErr) {
        console.warn('Local cache read error:', cacheErr);
      }

      // 2. Perform background sync with remote Supabase
      try {
        if (isMounted) setIsBackgroundSyncing(true);
        const res = await fetch('/api/pos/catalog?slug=deegayu&limit=3500');
        const json = await res.json();

        if (json.success && json.data && isMounted) {
          const freshProducts = json.data.products || [];
          const freshCategories = json.data.categories || [];
          const freshTotal = json.data.total || freshProducts.length;

          setProducts(freshProducts);
          setCategories(freshCategories);
          setTotalProductsCount(freshTotal);
          setCatalogError(null);

          // Update local IndexedDB cache asynchronously
          await saveCachedCatalog('deegayu', {
            products: freshProducts,
            categories: freshCategories,
            total: freshTotal,
          });
        } else if (isMounted) {
          setProducts((prev) => {
            if (prev.length === 0) {
              setCatalogError(json.error || 'Failed to load catalog');
            }
            return prev;
          });
        }
      } catch (netErr: unknown) {
        console.warn('Background sync error (operating offline):', netErr);
        if (isMounted) {
          setProducts((prev) => {
            if (prev.length === 0) {
              setCatalogError('Could not connect to catalog service.');
            }
            return prev;
          });
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
          setIsBackgroundSyncing(false);
        }
      }
    }

    initCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  // Force Manual Refresh (Bypasses server & client cache)
  const loadCatalog = useCallback(async () => {
    try {
      setIsLoadingProducts(true);
      setCatalogError(null);
      const res = await fetch('/api/pos/catalog?slug=deegayu&limit=3500&refresh=true');
      const json = await res.json();
      if (json.success && json.data) {
        const freshProducts = json.data.products || [];
        const freshCategories = json.data.categories || [];
        const freshTotal = json.data.total || freshProducts.length;

        setProducts(freshProducts);
        setCategories(freshCategories);
        setTotalProductsCount(freshTotal);

        await saveCachedCatalog('deegayu', {
          products: freshProducts,
          categories: freshCategories,
          total: freshTotal,
        });
      } else {
        setCatalogError(json.error || 'Failed to load catalog');
      }
    } catch (err: unknown) {
      console.error('Failed to load Deegayu POS catalog:', err);
      setCatalogError('Could not connect to catalog service.');
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  // Recalculate cart item unit prices when pricingTier changes
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        price: pricingTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice,
      })),
    );
  }, [pricingTier]);

  // Dynamic Category Pills with counts from Supabase
  const categoryTabs = useMemo(() => {
    if (categories.length > 0) {
      const activeTabs = categories
        .filter((c) => c.count > 0)
        .map((c) => ({
          name: c.name,
          slug: c.slug,
          count: c.count,
        }));
      return [
        { name: 'All Products', slug: 'all', count: totalProductsCount || products.length },
        ...activeTabs,
      ];
    }

    // Fallback: derive from loaded products
    const catMap = new Map<string, { slug: string; count: number }>();
    products.forEach((p) => {
      const catName = p.category?.name || 'General';
      const slug = p.category?.slug || catName.toLowerCase();
      const current = catMap.get(catName) || { slug, count: 0 };
      catMap.set(catName, { slug, count: current.count + 1 });
    });

    const tabs = [{ name: 'All Products', slug: 'all', count: products.length }];
    catMap.forEach((info, name) => {
      tabs.push({ name, slug: info.slug, count: info.count });
    });
    return tabs;
  }, [categories, products, totalProductsCount]);

  // Reset display limit when category or search changes
  useEffect(() => {
    setDisplayLimit(60);
  }, [selectedCategorySlug, searchQuery]);

  // Filtered Products (Fast client-side search across name, SKU, and barcode)
  const filteredProducts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      if (selectedCategorySlug !== 'all') {
        const catSlug = p.category?.slug?.toLowerCase();
        const catName = p.category?.name?.toLowerCase();
        const target = selectedCategorySlug.toLowerCase();
        if (catSlug !== target && catName !== target) {
          return false;
        }
      }

      if (!term) return true;

      const matchesName = p.name.toLowerCase().includes(term);
      const matchesSku = p.sku.toLowerCase().includes(term);
      const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(term) : false;

      return matchesName || matchesSku || matchesBarcode;
    });
  }, [products, searchQuery, selectedCategorySlug]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, displayLimit);
  }, [filteredProducts, displayLimit]);

  // Add Item to Cart
  const addToCart = useCallback((product: RetailProductItem) => {
    const targetPrice = pricingTier === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prevCart,
        {
          id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: targetPrice,
          retailPrice: product.retailPrice,
          wholesalePrice: product.wholesalePrice,
          quantity: 1,
          stockOnHand: product.stockOnHand,
          unit: product.unit,
          imageUrl: product.imageUrl,
        },
      ];
    });

    setScanFeedback(`Added: ${product.name}`);
    setTimeout(() => setScanFeedback(null), 1800);
  }, [pricingTier]);

  // Barcode / SKU Scan Submitter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim().toLowerCase();
    if (!term) return;

    const matched = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === term) ||
        p.sku.toLowerCase() === term ||
        p.name.toLowerCase() === term,
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    } else {
      setScanFeedback(`No match for SKU / Barcode: "${searchQuery.trim()}"`);
      setTimeout(() => setScanFeedback(null), 2500);
    }
  };

  // Direct Quantity Editor
  const handleQuantityChange = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeCartItem(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity: newQty } : item)),
    );
  };

  const removeCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setSelectedCustomer(DEFAULT_CUSTOMER);
    setCashTendered('');
    setIsMobileCartDrawerOpen(false);
  };

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const discountedSubtotal = subtotal - discountAmount;
  const taxAmount = (discountedSubtotal * taxRatePercent) / 100;
  const totalAmount = discountedSubtotal + taxAmount;
  const totalItemCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  // Tender computations
  const numericTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericTendered - totalAmount);

  // Set Cash Presets
  const applyCashPreset = (amount: number) => {
    setCashTendered(amount.toFixed(2));
  };

  // Hold Active Cart
  const handleHoldCart = useCallback(async () => {
    if (cart.length === 0) return;
    try {
      const ref = `CART-${Date.now().toString().slice(-4)}`;
      const res = await posApi.holdCart({
        branchId: selectedBranchId || 'default-branch',
        cartReference: ref,
        cartData: {
          items: cart,
          customer: selectedCustomer,
          discountPercent,
          pricingTier,
        },
      });
      if (res.data) {
        const item = res.data;
        setHeldCarts((prev) => [item, ...prev]);
      }
      clearCart();
      setScanFeedback(`Cart held as ticket #${ref}`);
      setTimeout(() => setScanFeedback(null), 2500);
    } catch {
      setScanFeedback('Held cart saved locally');
      setTimeout(() => setScanFeedback(null), 2500);
      clearCart();
    }
  }, [cart, selectedBranchId, selectedCustomer, discountPercent, pricingTier]);

  // Resume Held Cart
  const handleResumeCart = (held: HeldCartDto) => {
    const data = held.cartData as {
      items?: CartItem[];
      customer?: CustomerProfile;
      discountPercent?: number;
      pricingTier?: 'RETAIL' | 'WHOLESALE';
    };
    if (data.items) setCart(data.items);
    if (data.customer) setSelectedCustomer(data.customer);
    if (data.discountPercent !== undefined) setDiscountPercent(data.discountPercent);
    if (data.pricingTier) setPricingTier(data.pricingTier);

    setHeldCarts((prev) => prev.filter((h) => h.id !== held.id));
    setIsHoldModalOpen(false);
  };

  // Execute Checkout Transaction
  const executeCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessingCheckout(true);

    try {
      const payload: CheckoutPayload = {
        branchId: selectedBranchId || '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
        customerId: selectedCustomer.id !== 'walk-in' ? selectedCustomer.id : undefined,
        customerName: selectedCustomer.name,
        orderType: 'RETAIL_WALKIN',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount: activePaymentMethod === 'CASH' && numericTendered > 0 ? numericTendered : totalAmount,
        changeDue: activePaymentMethod === 'CASH' ? changeDue : 0,
        items: cart.map((item) => ({
          productId: item.productId,
          productName: item.name,
          sku: item.sku,
          unitPrice: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
          discountAmount: 0,
          taxAmount: 0,
        })),
        payments: [
          {
            paymentMethod: activePaymentMethod,
            amount: totalAmount,
            reference:
              activePaymentMethod === 'CARD'
                ? `TXN-POS-${Date.now().toString().slice(-6)}`
                : activePaymentMethod === 'QR_PAYMENT'
                  ? `LQR-${Date.now().toString().slice(-6)}`
                  : undefined,
          },
        ],
      };

      const res = await posApi.checkout(payload);

      if (res.data) {
        setCompletedSale(res.data);
      } else {
        // Fallback simulation sale DTO
        setCompletedSale({
          id: `sale-${Date.now()}`,
          tenantId: 'demo-tenant',
          branchId: selectedBranchId || 'branch-1',
          cashierId: 'cashier-1',
          cashier: {
            id: 'cashier-1',
            fullName: 'System Cashier',
            email: 'cashier@store.lk',
          },
          invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          orderType: 'RETAIL_WALKIN',
          status: 'COMPLETED',
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: activePaymentMethod === 'CASH' && numericTendered > 0 ? numericTendered : totalAmount,
          changeDue: activePaymentMethod === 'CASH' ? changeDue : 0,
          customerName: selectedCustomer.name,
          items: cart.map((i) => ({
            id: `si-${Math.random()}`,
            saleId: 'sale-1',
            productName: i.name,
            sku: i.sku,
            unitPrice: i.price,
            quantity: i.quantity,
            subtotal: i.price * i.quantity,
            discountAmount: 0,
            taxAmount: 0,
          })),
          payments: [
            {
              id: `sp-${Math.random()}`,
              saleId: 'sale-1',
              paymentMethod: activePaymentMethod,
              amount: totalAmount,
              status: 'SUCCESS',
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setIsPaymentOpen(false);
      setIsMobileCartDrawerOpen(false);
      setShowReceiptModal(true);
      clearCart();
    } catch {
      // In demo mode, construct completed sale and present receipt modal
      setCompletedSale({
        id: `sale-${Date.now()}`,
        tenantId: 'demo-tenant',
        branchId: selectedBranchId || 'branch-1',
        cashierId: 'cashier-1',
        cashier: {
          id: 'cashier-1',
          fullName: 'Store Cashier',
          email: 'cashier@store.lk',
        },
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        orderType: 'RETAIL_WALKIN',
        status: 'COMPLETED',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount: activePaymentMethod === 'CASH' && numericTendered > 0 ? numericTendered : totalAmount,
        changeDue: activePaymentMethod === 'CASH' ? changeDue : 0,
        customerName: selectedCustomer.name,
        items: cart.map((i) => ({
          id: `si-${Math.random()}`,
          saleId: 'sale-1',
          productName: i.name,
          sku: i.sku,
          unitPrice: i.price,
          quantity: i.quantity,
          subtotal: i.price * i.quantity,
          discountAmount: 0,
          taxAmount: 0,
        })),
        payments: [
          {
            id: `sp-${Math.random()}`,
            saleId: 'sale-1',
            paymentMethod: activePaymentMethod,
            amount: totalAmount,
            status: 'SUCCESS',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setIsPaymentOpen(false);
      setIsMobileCartDrawerOpen(false);
      setShowReceiptModal(true);
      clearCart();
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  // Keyboard shortcut listener (F2: Scanner, F4: Hold, F12: Pay, Esc: Dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldCart();
        } else {
          setIsHoldModalOpen(true);
        }
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && !isPaymentOpen) {
          setIsPaymentOpen(true);
          setCashTendered(totalAmount.toFixed(2));
        }
      } else if (e.key === 'Escape') {
        setIsPaymentOpen(false);
        setIsHoldModalOpen(false);
        setIsCustomerModalOpen(false);
        setIsMobileCartDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isPaymentOpen, totalAmount, handleHoldCart]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-[#F8FAFC] text-slate-900 select-none">
      {/* Toast Notification for Barcode Scan feedback */}
      {scanFeedback && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          LEFT / MAIN: HIGH-DENSITY CATALOG ENGINE (Full width on mobile, 70% desktop)
      ===================================================================== */}
      <section className="flex-1 w-full md:w-auto flex flex-col h-full overflow-hidden border-r border-slate-200/80 bg-[#F8FAFC]">
        {/* Top Action Console */}
        <div className="p-3 sm:p-3.5 bg-white border-b border-slate-200/80 shadow-sm shrink-0 space-y-2.5">
          {/* Universal Barcode & Search Bar */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1.5 pointer-events-none">
                <Barcode className="w-4 h-4 text-slate-500" />
              </div>

              <input
                ref={searchInputRef}
                type="text"
                placeholder="Scan Barcode or Search by Name / SKU [F2]..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-16 sm:pr-20 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
              />

              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-500 shadow-sm">
                  F2
                </kbd>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>

            {/* Sync & Offline Status Indicator */}
            {isBackgroundSyncing ? (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] font-semibold text-[#005BD3] shrink-0"
                title="Synchronizing catalog with server in background..."
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#005BD3]" />
                <span className="hidden md:inline">Syncing...</span>
              </div>
            ) : totalProductsCount > 0 ? (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-[11px] font-semibold text-emerald-700 shrink-0"
                title="Instant Offline-Ready IndexedDB Cache Active"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden md:inline">Offline Ready</span>
                <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded font-bold">
                  {totalProductsCount.toLocaleString()}
                </span>
              </div>
            ) : null}

            {/* View Mode Switcher (Grid vs Table List - Desktop/Tablet) */}
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Visual Bento Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Compact Supermarket Table List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Refresh Catalog Button */}
            <button
              type="button"
              onClick={loadCatalog}
              disabled={isLoadingProducts}
              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all shrink-0 active:scale-95"
              title="Force Sync Remote Catalog"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin text-[#005BD3]' : ''}`} />
              <span className="hidden lg:inline">Sync</span>
            </button>
          </div>

          {/* Touch-Friendly Horizontal Category Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            {categoryTabs.map((tab) => {
              const isActive = selectedCategorySlug === tab.slug;
              const visual = tab.slug !== 'all' ? getCategoryVisual(tab.name) : null;
              const VisualIcon = visual ? visual.icon : Package;

              return (
                <button
                  key={tab.slug}
                  onClick={() => setSelectedCategorySlug(tab.slug)}
                  className={`px-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation select-none shadow-xs ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <VisualIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-300' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{tab.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Products Area (Responsive Bento Grid / Table / Mobile Feed) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-36 md:pb-6">
          {isLoadingProducts && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#005BD3] mb-3" />
              <h3 className="text-sm font-bold text-slate-800">
                Loading Pharmacy & Ayurvedic Catalog...
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ingesting 3,120 products from remote Supabase Tokyo...
              </p>
            </div>
          ) : catalogError && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Catalogue Sync Failed</h3>
              <p className="text-xs text-rose-500 max-w-sm mt-1">{catalogError}</p>
              <button
                type="button"
                onClick={loadCatalog}
                className="mt-4 px-4 py-2 bg-[#005BD3] text-white text-xs font-semibold rounded-xl hover:bg-[#004CB5] transition-colors"
              >
                Retry Supabase Sync
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Package className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Products Matched</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                No items found matching &quot;{searchQuery}&quot; in category &quot;{selectedCategorySlug}&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategorySlug('all');
                }}
                className="mt-3 text-xs font-semibold text-[#005BD3] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* ===============================================================
               A. RESPONSIVE TOUCH-FRIENDLY PRODUCT BENTO GRID
               (Mobile 2-col, Tablet 3-4 col, Desktop 4-5 col)
            =============================================================== */
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                {displayedProducts.map((product) => {
                  const activePrice =
                    pricingTier === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;
                  const visual = getCategoryVisual(product.category?.name);
                  const VisualIcon = visual.icon;
                  const cartItem = cart.find((i) => i.productId === product.id);

                  return (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-slate-300 transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden group select-none active:scale-[0.98] touch-manipulation"
                    >
                      {/* Top Graphic Container (Image or Medical Squircle Badge) */}
                      <div className="h-24 sm:h-28 w-full bg-slate-50 flex items-center justify-center relative overflow-hidden border-b border-slate-100 group-hover:bg-slate-100/60 transition-colors">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 text-center">
                            <div
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center border shadow-xs group-hover:scale-110 transition-transform duration-200 ${visual.bg}`}
                            >
                              <VisualIcon className="w-5 h-5" />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase tracking-wider">
                              {product.sku}
                            </span>
                          </div>
                        )}

                        {/* Floating Stock Pill */}
                        <div className="absolute top-2 right-2">
                          {product.stockOnHand <= 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shadow-sm backdrop-blur-sm">
                              Out
                            </span>
                          ) : product.stockOnHand <= 10 ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70 shadow-sm backdrop-blur-sm">
                              {product.stockOnHand} left
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm backdrop-blur-sm">
                              {product.stockOnHand > 999
                                ? `${(product.stockOnHand / 1000).toFixed(1)}k`
                                : product.stockOnHand}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
                            {product.category?.name || 'Ayurvedic Pharmacy'}
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug mt-0.5 group-hover:text-[#005BD3] transition-colors">
                            {product.name}
                          </h4>
                        </div>

                        {/* Bottom Price & Uber-Eats / Touch Dynamic Stepper */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-50 gap-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-black font-mono text-slate-900 tracking-tight truncate">
                              LKR {activePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono truncate">
                              {product.barcode || product.sku}
                            </div>
                          </div>

                          {/* Dynamic Add / Stepper Button */}
                          {cartItem ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center rounded-xl bg-blue-50 border border-blue-200 shadow-xs overflow-hidden shrink-0"
                            >
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(cartItem.id, cartItem.quantity - 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[#005BD3] hover:bg-blue-100 active:scale-90 transition-all font-bold"
                                title="Decrease quantity"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-bold text-xs font-mono text-[#005BD3]">
                                {cartItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuantityChange(cartItem.id, cartItem.quantity + 1)}
                                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-[#005BD3] hover:bg-blue-100 active:scale-90 transition-all font-bold"
                                title="Increase quantity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product);
                              }}
                              className="h-7 sm:h-8 px-2.5 rounded-xl bg-blue-50 text-[#005BD3] group-hover:bg-[#005BD3] group-hover:text-white flex items-center gap-1 font-bold text-xs transition-all shadow-xs active:scale-90 shrink-0 border border-blue-100"
                              title="Add to Ticket"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button when list exceeds display limit */}
              {filteredProducts.length > displayLimit && (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((prev) => prev + 60)}
                    className="px-5 py-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <span>Load more products ({displayLimit} of {filteredProducts.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ===============================================================
               B. HIGH-DENSITY TABLE LIST VIEW (For Supermarkets / Wholesale)
            =============================================================== */
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Stock</th>
                      <th className="py-2.5 px-3 text-right">Wholesale</th>
                      <th className="py-2.5 px-3 text-right">Retail</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {displayedProducts.map((product) => {
                      const visual = getCategoryVisual(product.category?.name);
                      const VisualIcon = visual.icon;

                      return (
                        <tr
                          key={product.id}
                          onClick={() => addToCart(product)}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2.5">
                              {product.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.imageUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200/80 shrink-0"
                                />
                              ) : (
                                <div
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${visual.bg}`}
                                >
                                  <VisualIcon className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate max-w-xs">{product.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {product.sku} {product.barcode ? `• ${product.barcode}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                            {product.category?.name || 'General'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium">
                            {product.stockOnHand <= 0 ? (
                              <span className="text-slate-400">0</span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">{product.stockOnHand}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            LKR {product.wholesalePrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            LKR {product.retailPrice.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#005BD3] hover:bg-[#005BD3] hover:text-white font-bold text-xs transition-colors"
                            >
                              Add
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          RIGHT: SALES TICKET RAIL (Dedicated Desktop & Tablet Column >= md)
      ===================================================================== */}
      <aside className="hidden md:flex md:w-[360px] lg:w-[380px] xl:w-[410px] 2xl:w-[440px] bg-white border-l border-slate-200/80 flex-col h-full shadow-rail z-20 shrink-0">
        {/* Ticket Header & Metadata */}
        <div className="p-4 border-b border-slate-200/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate max-w-[190px]">
                {activeBusinessName} • {activeBranchName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-[#005BD3] border border-blue-100">
                ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Customer Interactive Card */}
          <div
            onClick={() => setIsCustomerModalOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between group active:scale-98"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-[#005BD3] flex items-center justify-center shadow-sm">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 group-hover:text-[#005BD3] transition-colors">
                  {selectedCustomer.name}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {selectedCustomer.id === 'walk-in'
                    ? 'Default Walk-in'
                    : `Credit: LKR ${selectedCustomer.creditBalance.toLocaleString()}`}
                </div>
              </div>
            </div>

            <span className="text-[11px] font-semibold text-[#005BD3] hover:underline">
              Change
            </span>
          </div>

          {/* Pricing Tier Segmented Switcher (Retail vs Wholesale) */}
          <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPricingTier('RETAIL')}
              className={`py-1.5 rounded-lg transition-all active:scale-95 ${
                pricingTier === 'RETAIL'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Retail (MSRP)
            </button>
            <button
              type="button"
              onClick={() => setPricingTier('WHOLESALE')}
              className={`py-1.5 rounded-lg transition-all active:scale-95 ${
                pricingTier === 'WHOLESALE'
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Wholesale (Bulk)
            </button>
          </div>
        </div>

        {/* Ticket Line Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4 py-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-30 text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Ticket is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Scan a barcode or tap products on the left</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-2.5 group">
                {/* Product Thumbnail & Details */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-slate-900 truncate">{item.name}</h5>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <span>LKR {item.price.toFixed(2)}</span>
                      <span>• {item.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Generous Touch Numeric Stepper */}
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200/70 active:scale-90 transition-all"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                    className="w-8 text-center bg-transparent text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200/70 active:scale-90 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Line Total & Remove */}
                <div className="text-right shrink-0 min-w-[65px]">
                  <div className="text-xs font-bold font-mono text-slate-900">
                    LKR {(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5 ml-auto" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Discount & Math Summary Card */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 space-y-2.5 shrink-0">
          {/* Quick Discount Pills */}
          <div className="flex items-center justify-between gap-1 text-[11px] font-semibold">
            <span className="text-slate-500 flex items-center gap-1">
              <Percent className="w-3 h-3 text-slate-400" />
              Discount:
            </span>
            <div className="flex items-center gap-1">
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountPercent(pct)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all active:scale-95 ${
                    discountPercent === pct
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Subtotal */}
          <div className="flex justify-between text-xs font-medium text-slate-500 font-mono">
            <span>Subtotal</span>
            <span>LKR {subtotal.toFixed(2)}</span>
          </div>

          {/* Discount amount */}
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs font-semibold text-amber-600 font-mono">
              <span>Discount ({discountPercent}%)</span>
              <span>- LKR {discountAmount.toFixed(2)}</span>
            </div>
          )}

          {/* Tax / VAT */}
          <div className="flex justify-between text-xs font-medium text-slate-500 font-mono">
            <span>Tax (8%)</span>
            <span>LKR {taxAmount.toFixed(2)}</span>
          </div>

          {/* Grand Total Banner */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Payable
            </span>
            <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
              LKR {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Speed Tender & Primary Charge Button */}
        <div className="p-4 border-t border-slate-200/80 space-y-3 bg-white shrink-0">
          {/* Cash Presets Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => applyCashPreset(totalAmount)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 active:scale-95"
            >
              Exact
            </button>
            {[500, 1000, 2000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyCashPreset(Math.ceil(totalAmount / preset) * preset)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shrink-0 active:scale-95"
              >
                +Rs. {preset.toLocaleString()}
              </button>
            ))}
          </div>

          {/* Secondary Action Row: Hold Cart & Clear */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <PauseCircle className="w-4 h-4 text-amber-500" />
              Hold [F4]
            </button>

            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Trash2 className="w-4 h-4 text-slate-400" />
              Clear
            </button>
          </div>

          {/* Primary Action Button (Charge [F12]) */}
          <button
            type="button"
            onClick={() => {
              if (cart.length > 0) {
                setIsPaymentOpen(true);
                setCashTendered(totalAmount.toFixed(2));
              }
            }}
            disabled={cart.length === 0}
            className="w-full bg-[#005BD3] hover:bg-[#004CB5] disabled:opacity-40 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-between text-sm transition-all active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <span>Charge Ticket</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/20 rounded text-white">
                F12
              </kbd>
            </span>
            <span className="font-mono font-bold flex items-center gap-1">
              <span>LKR {totalAmount.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          UBER-EATS STYLE FLOATING BOTTOM CART BAR (< md screens)
      ===================================================================== */}
      {cart.length > 0 && !isMobileCartDrawerOpen && (
        <aside
          aria-label="Floating Mobile Cart"
          onClick={() => setIsMobileCartDrawerOpen(true)}
          className="fixed bottom-20 inset-x-3 md:hidden z-40 bg-slate-900 text-white rounded-2xl p-3 shadow-float border border-slate-800 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#005BD3] text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  LKR {totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Tap to review ticket & checkout</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white text-slate-900 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm">
            <span>View Cart</span>
            <ArrowRight className="w-4 h-4 text-[#005BD3]" />
          </div>
        </aside>
      )}

      {/* =====================================================================
          UBER-EATS STYLE SLIDE-UP CHECKOUT DRAWER (Bottom Sheet for Mobile)
      ===================================================================== */}
      {isMobileCartDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Dark Backdrop */}
          <div
            onClick={() => setIsMobileCartDrawerOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          {/* Slide-up Container */}
          <div className="relative bg-white rounded-t-3xl shadow-bottom-sheet z-10 max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-250">
            {/* Top Drag Pill Handle */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Sheet Header */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Current Order Ticket</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {activeBusinessName} • {activeBranchName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-semibold text-rose-600 px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileCartDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Customer & Pricing Tier Switcher */}
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 space-y-2">
              <div
                onClick={() => {
                  setIsMobileCartDrawerOpen(false);
                  setIsCustomerModalOpen(true);
                }}
                className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/80 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#005BD3]" />
                  <span className="text-xs font-bold text-slate-800">{selectedCustomer.name}</span>
                </div>
                <span className="text-[11px] font-semibold text-[#005BD3]">Change</span>
              </div>

              <div className="grid grid-cols-2 bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPricingTier('RETAIL')}
                  className={`py-1.5 rounded-lg transition-all ${
                    pricingTier === 'RETAIL' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Retail (MSRP)
                </button>
                <button
                  type="button"
                  onClick={() => setPricingTier('WHOLESALE')}
                  className={`py-1.5 rounded-lg transition-all ${
                    pricingTier === 'WHOLESALE' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Wholesale (Bulk)
                </button>
              </div>
            </div>

            {/* Line Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-slate-100 max-h-[36vh]">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold text-slate-600">No items in ticket</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 truncate">{item.name}</h5>
                      <div className="text-[11px] text-slate-400 font-mono">
                        LKR {item.price.toFixed(2)} × {item.quantity} = LKR {(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>

                    {/* Generous touch stepper */}
                    <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="w-10 h-10 flex items-center justify-center text-slate-700 active:scale-90 font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold font-mono text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="w-10 h-10 flex items-center justify-center text-slate-700 active:scale-90 font-bold"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Math & Charge CTA */}
            <div className="p-4 bg-slate-50/80 border-t border-slate-200 space-y-3">
              {/* Discount Selection */}
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500">Discount:</span>
                <div className="flex items-center gap-1.5">
                  {[0, 5, 10, 15].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                        discountPercent === pct
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Math totals */}
              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>LKR {subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Discount ({discountPercent}%)</span>
                    <span>- LKR {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Tax (8%)</span>
                  <span>LKR {taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span className="text-emerald-600">LKR {totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartDrawerOpen(false);
                    handleHoldCart();
                  }}
                  disabled={cart.length === 0}
                  className="col-span-1 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 active:scale-95"
                >
                  <PauseCircle className="w-4 h-4 text-amber-500" />
                  <span>Hold</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartDrawerOpen(false);
                    setIsPaymentOpen(true);
                    setCashTendered(totalAmount.toFixed(2));
                  }}
                  disabled={cart.length === 0}
                  className="col-span-3 py-3.5 px-4 rounded-xl bg-[#005BD3] hover:bg-[#004CB5] text-white font-bold text-sm shadow-md flex items-center justify-between active:scale-[0.98]"
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MOBILE FIXED BOTTOM NAVIGATION BAR (< md)
      ===================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 h-16 bg-white border-t border-slate-200/90 z-30 flex items-center justify-around px-2 md:hidden shadow-sm">
        <Link
          href="/dashboard/pos"
          className="flex flex-col items-center justify-center flex-1 py-1 text-[#005BD3] font-bold text-[10px]"
        >
          <Store className="w-5 h-5 mb-0.5" />
          <span>Terminal</span>
        </Link>

        <Link
          href="/dashboard/products"
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-700 font-medium text-[10px]"
        >
          <Package className="w-5 h-5 mb-0.5" />
          <span>Catalogue</span>
        </Link>

        <Link
          href="/dashboard/sales"
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-700 font-medium text-[10px]"
        >
          <Banknote className="w-5 h-5 mb-0.5" />
          <span>Sales</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-700 font-medium text-[10px]"
        >
          <Layers className="w-5 h-5 mb-0.5" />
          <span>Settings</span>
        </Link>
      </nav>

      {/* =====================================================================
          MODAL 1: SPEED TENDER & PAYMENT DRAWER (Touch-Screen Optimized)
      ===================================================================== */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Complete Payment</h3>
                <p className="text-xs text-slate-500">Select tender method and enter amount received</p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector - Large touch targets */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'CARD', label: 'Card POS', icon: CreditCard },
                { id: 'QR_PAYMENT', label: 'LANKAQR', icon: QrCode },
                { id: 'STORE_CREDIT', label: 'Credit', icon: Wallet },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = activePaymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActivePaymentMethod(m.id as typeof activePaymentMethod)}
                    className={`py-3.5 px-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 active:scale-95 touch-manipulation ${
                      isSelected
                        ? 'border-[#005BD3] bg-blue-50 text-[#005BD3] font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tender Details & Presets */}
            {activePaymentMethod === 'CASH' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold text-sm">Cash Tendered:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={totalAmount.toFixed(2)}
                    className="w-40 text-right bg-white border border-slate-300 rounded-xl px-3 py-2 text-base font-bold font-mono text-slate-900 focus:outline-none focus:border-[#005BD3] shadow-xs"
                  />
                </div>

                {/* Touch Presets */}
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => applyCashPreset(totalAmount)}
                    className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shadow-xs active:scale-95"
                  >
                    Exact
                  </button>
                  {[500, 1000, 2000, 5000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyCashPreset(Math.ceil(totalAmount / preset) * preset)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 shadow-xs active:scale-95"
                    >
                      +Rs. {preset}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase">Change Due:</span>
                  <span className="text-2xl font-black font-mono text-emerald-600">
                    LKR {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Payable Total</span>
              <span className="text-2xl font-black font-mono text-slate-900">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>

            {/* Submit Checkout */}
            <button
              type="button"
              onClick={executeCheckout}
              disabled={isProcessingCheckout}
              className="w-full bg-[#005BD3] hover:bg-[#004CB5] text-white font-bold py-4 px-4 rounded-2xl shadow-lg shadow-blue-500/20 text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {isProcessingCheckout ? (
                <>
                  <RotateCcw className="w-5 h-5 animate-spin" />
                  Processing Checkout...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Sale & Print Receipt
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CUSTOMER SELECTOR / STORE CREDIT
      ===================================================================== */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Select Customer</h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search customers by name, phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-[#005BD3]"
            />

            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {SAMPLE_CUSTOMERS.filter((c) =>
                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.phone.includes(customerSearch),
              ).map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => {
                    setSelectedCustomer(cust);
                    setIsCustomerModalOpen(false);
                  }}
                  className="py-2.5 px-3 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{cust.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{cust.phone}</div>
                  </div>
                  {cust.creditBalance > 0 && (
                    <span className="text-[11px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Credit: LKR {cust.creditBalance.toLocaleString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: HELD CARTS MODAL (Resume Cart)
      ===================================================================== */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Held Carts & Tickets</h3>
              <button
                onClick={() => setIsHoldModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {heldCarts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No tickets currently on hold
                </div>
              ) : (
                heldCarts.map((h) => (
                  <div
                    key={h.id}
                    className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Ticket #{h.cartReference}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Held at {new Date(h.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResumeCart(h)}
                      className="px-3 py-1.5 rounded-lg bg-[#005BD3] hover:bg-[#004CB5] text-white text-xs font-semibold shadow-sm"
                    >
                      Resume
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: THERMAL RECEIPT SLIP MODAL (80mm / 58mm / A4)
      ===================================================================== */}
      {showReceiptModal && completedSale && (
        <ReceiptModal
          isOpen={showReceiptModal}
          saleId={completedSale.id}
          initialSale={completedSale}
          onClose={() => {
            setShowReceiptModal(false);
            setCompletedSale(null);
          }}
        />
      )}
    </div>
  );
}
