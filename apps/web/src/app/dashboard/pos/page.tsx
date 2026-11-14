'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import {
  CreditCard,
  Banknote,
  Split,
  Trash2,
  Search,
  X,
  Layers,
  ShoppingBag,
  Sparkles,
  Package,
  Loader2,
  ArrowRight,
  Percent,
  User,
  UserPlus,
  Plus,
  PauseCircle,
  Tag,
  Clock,
  Barcode,
  BookOpen,
} from 'lucide-react';
import type {
  CheckoutPayload,
  SaleDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';
import { ShiftEndModal } from '../../../components/pos/shift-end-modal';
import { DiscountPickerModal } from '../../../components/pos/discount-picker-modal';
import { CustomSaleModal } from '../../../components/pos/custom-sale-modal';
import { CashierSwitcherModal } from '../../../components/pos/cashier-switcher-modal';
import { CustomerModal, type CustomerData } from '../../../components/pos/customer-modal';
import { HeldTicketsModal, type HeldTicket } from '../../../components/pos/held-tickets-modal';
import { getProductPhoto, DEFAULT_STUDIO_PHOTO } from '../../../lib/product-image-mapper';
import {
  AYURVEDIC_MASTER_DEPARTMENTS,
  AYURVEDIC_DEPARTMENT_LIST,
  classifyAyurvedicDepartment,
} from '../../../lib/ayurvedic-departments';
import { getCachedCatalogData, setCachedCatalogData } from '../../../lib/catalog-db';
import { PrinterBridge } from '../../../lib/hardware/printer-bridge';
import { supabase } from '../../../lib/supabase';

// =========================================================================
// "CONFIDENCY OS" DESIGN SYSTEM SPECIFICATION
// Ayurvedic Pharmacy Catalog, Hero Search Station, 3D Badges & Tactile Actions
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

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  quantity: number;
  stockOnHand: number;
  unit: string;
  imageUrl?: string;
  departmentId?: string;
}

export default function ConfidencyPosPage() {
  const { selectedBranchId, user, activeCashier, setActiveCashier } = useTenantBranch();

  // Catalogue & Data State
  const [products, setProducts] = useState<RetailProductItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Department Filter & Search Station
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  // High-Performance Virtualization / Progressive DOM Pagination
  const [visibleCount, setVisibleCount] = useState<number>(48);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'STORE_CREDIT' | 'SPLIT'>('CARD');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Customer Management
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Discounts
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FLAT'>('NONE');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFlat, setDiscountFlat] = useState<number>(0);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  // Held Tickets Queue
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);
  const [isHeldTicketsModalOpen, setIsHeldTicketsModalOpen] = useState(false);

  // Custom Item Modal
  const [isCustomSaleModalOpen, setIsCustomSaleModalOpen] = useState(false);

  // Completed Receipt Modal & Shift End
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);

  // Mobile Slide-up Bottom Sheet
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Scanner & Notification feedback
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Cashier Session Details
  const cashierId = activeCashier?.id || user?.id || '96b2747b-9d22-4266-94ce-b035fadef498';
  const cashierName = activeCashier?.fullName || user?.fullName || 'Dr. Deegayu (Owner)';
  const registerCode = 'REG-01';
  const openingFloat = 15000.0;

  // Instant 0ms Hydration via IndexedDB (< 15ms) + Background Sync
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/dashboard/pos') {
      return;
    }
    let isMounted = true;

    async function initCatalog() {
      // 1. Immediately read from IndexedDB with ZERO blocking spinner
      try {
        const cached = await getCachedCatalogData<RetailProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 0 && isMounted) {
          setProducts(cached.products);
          setIsLoadingProducts(false);
        }
      } catch (cacheErr) {
        console.warn('Local cache read error:', cacheErr);
      }

      // 2. Concurrently sync with Supabase in background
      try {
        const { data: sbProducts, error: sbErr } = await supabase
          .from('products')
          .select('*, category:categories(*), stock_levels(*)')
          .order('name', { ascending: true })
          .limit(3500);

        if (!sbErr && sbProducts && sbProducts.length > 0 && isMounted) {
          const freshProducts: RetailProductItem[] = sbProducts.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            retailPrice: Number(p.retail_price ?? p.retailPrice ?? 0),
            wholesalePrice: Number(p.wholesale_price ?? p.wholesalePrice ?? p.retail_price ?? 0),
            costPrice: Number(p.cost_price ?? p.costPrice ?? p.purchase_price ?? 0),
            category: {
              id: p.category?.id || p.category_id || '',
              name: p.category?.name || 'General',
              slug: p.category?.slug || 'general',
            },
            stockOnHand: Number(p.stock_quantity ?? p.stock_levels?.[0]?.quantity ?? 100),
            unit: p.unit || 'units',
            imageUrl: p.image_url ?? p.imageUrl ?? undefined,
            alertQuantity: p.min_stock_level ?? p.alert_quantity ?? null,
          }));

          setProducts(freshProducts);
          setCatalogError(null);

          // Update IndexedDB asynchronously
          await setCachedCatalogData('deegayu', {
            products: freshProducts,
            categories: [],
            total: freshProducts.length,
          });
        }
      } catch (netErr: unknown) {
        console.warn('Background sync error (operating offline):', netErr);
        if (isMounted) {
          setProducts((prev) => {
            if (prev.length === 0) setCatalogError('Operating in offline mode');
            return prev;
          });
        }
      } finally {
        if (isMounted) setIsLoadingProducts(false);
      }
    }

    initCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Classify each product into the 10 Ayurvedic Departments & pre-build lowercase search tokens
  const productsWithDept = useMemo(() => {
    return products.map((p) => {
      const deptId = classifyAyurvedicDepartment(p.name, p.category?.name, p.category?.slug);
      const name = p.name || '';
      const sku = p.sku || '';
      const barcode = p.barcode || '';
      const cat = p.category?.name || '';
      const _searchStr = `${name} ${sku} ${barcode} ${cat}`.toLowerCase();
      return {
        ...p,
        departmentId: deptId,
        _searchStr,
      };
    });
  }, [products]);

  // Dynamic count of products per department
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: productsWithDept.length };
    for (const dept of AYURVEDIC_DEPARTMENT_LIST) {
      counts[dept.id] = 0;
    }
    for (const p of productsWithDept) {
      const d = p.departmentId || 'fmcg';
      counts[d] = (counts[d] || 0) + 1;
    }
    return counts;
  }, [productsWithDept]);

  // Ultra-Fast In-Memory Search (< 1-2ms) using deferredSearchQuery & pre-indexed strings
  const filteredProducts = useMemo(() => {
    const rawTerm = deferredSearchQuery.trim().toLowerCase();
    const hasDept = selectedDeptId !== 'all';

    if (!rawTerm && !hasDept) {
      return productsWithDept;
    }

    const tokens = rawTerm ? rawTerm.split(/\s+/).filter(Boolean) : [];

    return productsWithDept.filter((p) => {
      if (hasDept && p.departmentId !== selectedDeptId) {
        return false;
      }
      if (tokens.length === 0) return true;

      const str = p._searchStr;
      for (const token of tokens) {
        if (!str.includes(token)) return false;
      }
      return true;
    });
  }, [productsWithDept, deferredSearchQuery, selectedDeptId]);

  // Fast Live Autocomplete Results for Keystroke Dropdown (Top 15 Matches)
  const liveSearchResults = useMemo(() => {
    const rawTerm = deferredSearchQuery.trim().toLowerCase();
    if (!rawTerm) return [];

    const tokens = rawTerm.split(/\s+/).filter(Boolean);
    const results: typeof productsWithDept = [];

    for (const p of productsWithDept) {
      let matches = true;
      for (const token of tokens) {
        if (!p._searchStr.includes(token)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        results.push(p);
        if (results.length >= 15) break;
      }
    }
    return results;
  }, [productsWithDept, deferredSearchQuery]);

  // Reset pagination to 48 when department filter or search query changes
  useEffect(() => {
    setVisibleCount(48);
  }, [deferredSearchQuery, selectedDeptId]);

  // Progressive sliced items for instant DOM rendering (prevents freezing main thread with 3,120 nodes)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // IntersectionObserver to dynamically load next 48 items as user scrolls down
  useEffect(() => {
    if (!loadMoreSentinelRef.current) return;
    const target = loadMoreSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => {
            if (prev < filteredProducts.length) {
              return Math.min(prev + 48, filteredProducts.length);
            }
            return prev;
          });
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredProducts.length]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update search dropdown state when query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setIsSearchDropdownOpen(true);
      setSelectedSearchIndex(0);
    } else {
      setIsSearchDropdownOpen(false);
    }
  }, [searchQuery]);

  // Add Item to Cart
  const addToCart = useCallback((product: RetailProductItem & { departmentId?: string }) => {
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
          price: product.retailPrice,
          quantity: 1,
          stockOnHand: product.stockOnHand,
          unit: product.unit,
          imageUrl: product.imageUrl,
          departmentId: product.departmentId,
        },
      ];
    });

    setScanFeedback(`Added: ${product.name}`);
    setTimeout(() => setScanFeedback(null), 1500);
  }, []);

  // Add Custom Sale Item
  const handleAddCustomItem = (customItem: {
    name: string;
    price: number;
    quantity: number;
    note?: string;
  }) => {
    const customTitle = customItem.name + (customItem.note ? ` (${customItem.note})` : '');
    setCart((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        productId: `custom-${Date.now()}`,
        name: customTitle,
        sku: 'CUSTOM-SALE',
        price: customItem.price,
        quantity: customItem.quantity,
        stockOnHand: 999,
        unit: 'pcs',
        departmentId: 'fmcg',
      },
    ]);
    setScanFeedback(`Custom Item Added: ${customTitle}`);
    setTimeout(() => setScanFeedback(null), 2000);
  };

  // Stepper Quantity Editor
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

  const clearCart = useCallback(() => {
    setCart([]);
    setIsMobileCartOpen(false);
  }, []);

  const resetDiscount = useCallback(() => {
    setDiscountType('NONE');
    setDiscountPercent(0);
    setDiscountFlat(0);
  }, []);

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'PERCENT' && discountPercent > 0) {
      return (subtotal * discountPercent) / 100;
    }
    if (discountType === 'FLAT' && discountFlat > 0) {
      return Math.min(subtotal, discountFlat);
    }
    return 0.0;
  }, [subtotal, discountType, discountPercent, discountFlat]);

  const taxAmount = 0.0;
  const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount);
  const totalItemCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  // Hold Active Cart
  const handleHoldTicket = useCallback(() => {
    if (cart.length === 0) return;
    const newHeld: HeldTicket = {
      id: `held-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: selectedCustomer ? selectedCustomer.name : 'Walk-in Customer',
      items: [...cart],
      discountType,
      discountPercent,
      discountFlat,
      totalAmount,
    };
    setHeldTickets((prev) => [newHeld, ...prev]);
    clearCart();
    resetDiscount();
    setScanFeedback(`Ticket held for ${newHeld.customerName}`);
    setTimeout(() => setScanFeedback(null), 2500);
  }, [
    cart,
    selectedCustomer,
    discountType,
    discountPercent,
    discountFlat,
    totalAmount,
    clearCart,
    resetDiscount,
  ]);

  // Restore Held Ticket
  const handleRestoreHeldTicket = (held: HeldTicket) => {
    setCart(held.items);
    setDiscountType(held.discountType);
    setDiscountPercent(held.discountPercent);
    setDiscountFlat(held.discountFlat);
    setHeldTickets((prev) => prev.filter((t) => t.id !== held.id));
    setScanFeedback(`Restored ticket (${held.items.length} items)`);
    setTimeout(() => setScanFeedback(null), 2000);
  };

  // Discard Held Ticket
  const handleDiscardHeldTicket = (ticketId: string) => {
    setHeldTickets((prev) => prev.filter((t) => t.id !== ticketId));
  };

  // Execute Checkout Transaction
  const handleCharge = useCallback(async () => {
    if (cart.length === 0) return;

    // Credit limit and customer validation for STORE_CREDIT
    if (paymentMethod === 'STORE_CREDIT') {
      if (!selectedCustomer) {
        setIsCustomerModalOpen(true);
        setScanFeedback('⚠️ Please select a customer for Store Credit purchase');
        setTimeout(() => setScanFeedback(null), 3000);
        return;
      }

      if (selectedCustomer.status === 'SUSPENDED') {
        setScanFeedback('❌ Customer account is suspended. Cannot issue credit.');
        setTimeout(() => setScanFeedback(null), 3000);
        return;
      }

      const debt = Number(selectedCustomer.currentBalance || 0);
      const limit = Number(selectedCustomer.creditLimit || 0);
      const avail = Math.max(0, limit - debt);

      if (totalAmount > avail) {
        const excess = (totalAmount - avail).toFixed(2);
        setScanFeedback(`❌ Credit limit exceeded by LKR ${excess}. Available: LKR ${avail.toLocaleString()}`);
        setTimeout(() => setScanFeedback(null), 4000);
        return;
      }
    }

    setIsProcessingCheckout(true);

    try {
      const formattedCustomer = selectedCustomer
        ? selectedCustomer.phone
          ? `${selectedCustomer.name} (${selectedCustomer.phone})`
          : selectedCustomer.name
        : 'Walk-in Customer';

      const payload: CheckoutPayload = {
        branchId: selectedBranchId || '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
        cashierId,
        customerId: selectedCustomer?.id || undefined,
        customerName: formattedCustomer,
        orderType: 'RETAIL_WALKIN',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount: totalAmount,
        changeDue: 0,
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
            paymentMethod:
              paymentMethod === 'STORE_CREDIT'
                ? 'CUSTOMER_CREDIT'
                : paymentMethod === 'CASH'
                ? 'CASH'
                : 'CARD',
            amount: totalAmount,
          },
        ],
      };

      const res = await posApi.checkout(payload);

      const rawSale: SaleDto = res.data || {
        id: `sale-${Date.now()}`,
        tenantId: 'deegayu',
        branchId: selectedBranchId || 'branch-1',
        cashierId,
        cashierName,
        cashier: {
          id: cashierId,
          fullName: cashierName,
          email: activeCashier?.email || user?.email || 'owner@deegayu.pixelcraftlk.com',
        },
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        orderType: 'RETAIL_WALKIN',
        status: 'COMPLETED',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount: totalAmount,
        changeDue: 0,
        customerName: formattedCustomer,
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
            paymentMethod: paymentMethod === 'CARD' ? 'CARD' : 'CASH',
            amount: totalAmount,
            status: 'SUCCESS',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const finalizedSale: SaleDto = {
        ...rawSale,
        cashierId: rawSale.cashierId || cashierId,
        cashierName: rawSale.cashierName || rawSale.cashier?.fullName || cashierName,
        cashier: rawSale.cashier || {
          id: cashierId,
          fullName: cashierName,
          email: activeCashier?.email || user?.email || 'cashier@deegayu.pixelcraftlk.com',
        },
      };

      setCompletedSale(finalizedSale);
      setShowReceiptModal(true);

      // Phase 13 Hardware Automation: Cash drawer kick & Auto thermal print
      try {
        const hw = PrinterBridge.getSettings();
        if (
          hw.autoOpenCashDrawer &&
          finalizedSale.payments?.some((p) => p.paymentMethod === 'CASH')
        ) {
          PrinterBridge.kickCashDrawer().catch(() => {});
        }
        if (hw.autoPrintReceipt) {
          PrinterBridge.printReceipt(finalizedSale).catch(() => {});
        }
      } catch {
        // ignore
      }
      if (paymentMethod === 'STORE_CREDIT' && selectedCustomer) {
        setSelectedCustomer((prev) =>
          prev
            ? {
                ...prev,
                currentBalance: (prev.currentBalance || 0) + totalAmount,
                availableCredit: Math.max(
                  0,
                  (prev.creditLimit || 0) - ((prev.currentBalance || 0) + totalAmount),
                ),
              }
            : null,
        );
      }
      clearCart();
      resetDiscount();
    } catch {
      const formattedCustomer = selectedCustomer
        ? selectedCustomer.phone
          ? `${selectedCustomer.name} (${selectedCustomer.phone})`
          : selectedCustomer.name
        : 'Walk-in Customer';

      // Offline fallback
      const fallbackSale: SaleDto = {
        id: `sale-${Date.now()}`,
        tenantId: 'deegayu',
        branchId: selectedBranchId || 'branch-1',
        cashierId,
        cashierName,
        cashier: {
          id: cashierId,
          fullName: cashierName,
          email: activeCashier?.email || user?.email || 'owner@deegayu.pixelcraftlk.com',
        },
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        orderType: 'RETAIL_WALKIN',
        status: 'COMPLETED',
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        paidAmount: totalAmount,
        changeDue: 0,
        customerName: formattedCustomer,
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
            paymentMethod: paymentMethod === 'CARD' ? 'CARD' : 'CASH',
            amount: totalAmount,
            status: 'SUCCESS',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCompletedSale(fallbackSale);
      setShowReceiptModal(true);

      // Phase 13 Hardware Automation: Cash drawer kick & Auto thermal print
      try {
        const hw = PrinterBridge.getSettings();
        if (
          hw.autoOpenCashDrawer &&
          fallbackSale.payments?.some((p) => p.paymentMethod === 'CASH')
        ) {
          PrinterBridge.kickCashDrawer().catch(() => {});
        }
        if (hw.autoPrintReceipt) {
          PrinterBridge.printReceipt(fallbackSale).catch(() => {});
        }
      } catch {
        // ignore
      }
      clearCart();
      resetDiscount();
    } finally {
      setIsProcessingCheckout(false);
    }
  }, [
    cart,
    selectedBranchId,
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    paymentMethod,
    cashierId,
    cashierName,
    activeCashier,
    user,
    selectedCustomer,
    clearCart,
    resetDiscount,
  ]);

  // Keyboard shortcut listener (F2: Search Barcode, F4: Hold Ticket, Esc: Dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (searchQuery.trim().length > 0) {
          setIsSearchDropdownOpen(true);
        }
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleHoldTicket();
      } else if (e.key === 'Escape') {
        setIsSearchDropdownOpen(false);
        setIsEndShiftModalOpen(false);
        setIsMobileCartOpen(false);
        setIsDiscountModalOpen(false);
        setIsCustomerModalOpen(false);
        setIsCustomSaleModalOpen(false);
        setIsHeldTicketsModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, handleHoldTicket, searchQuery]);

  return (
    <div className="h-full w-full flex overflow-hidden bg-white select-none">
      {/* Toast Feedback */}
      {scanFeedback && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#7052FF]" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          CENTER COLUMN: STATUS BAR, TACTILE ACTIONS, SEARCH STATION, DEPARTMENTS & CATALOG
      ===================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-100 bg-white min-w-0">
        {/* 1. Top Terminal Status Bar */}
        <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          {/* Left: Breadcrumb & Cashier Metadata */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#7052FF] flex items-center justify-center font-bold text-xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span>POS Terminal</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => setIsCashierModalOpen(true)}
              className="flex items-center gap-1.5 hover:bg-purple-50 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs group"
              title="Click or press to switch cashier profile via 4-digit PIN"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-slate-900 group-hover:text-[#7052FF] transition-colors">
                Cashier: {cashierName}
              </span>
              <span className="text-[10px] font-bold bg-[#7052FF]/10 text-[#7052FF] px-1.5 py-0.5 rounded group-hover:bg-[#7052FF] group-hover:text-white transition-colors">
                PIN Switch
              </span>
            </button>
            <div className="hidden sm:flex text-xs text-slate-500 font-medium truncate items-center">
              <span>| Reg: {registerCode}</span>
              <span className="hidden md:inline"> | Shift: 8:30 AM</span>
              <span className="hidden lg:inline">
                {' '}
                | Drawer: LKR {openingFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Right: Auto-refresh indicator & End Shift Button */}
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Catalog Ready</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEndShiftModalOpen(true)}
              className="border border-slate-200 hover:bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-700 transition-colors shadow-2xs active:scale-95"
            >
              End Shift
            </button>
          </div>
        </div>

        {/* 2. Large Tactile Cashier Action Tabs (h-14 md:h-16, 4-column responsive grid) */}
        <div className="px-5 pt-3.5 pb-2 bg-slate-50/50 border-b border-slate-100 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            {/* Tab 1: Apply Discount */}
            <button
              type="button"
              onClick={() => setIsDiscountModalOpen(true)}
              className="h-14 md:h-16 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-95 transition-all border border-emerald-400 cursor-pointer px-3 select-none"
            >
              <Percent className="w-5 h-5 text-white shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {discountType === 'PERCENT'
                  ? `${discountPercent}% Applied`
                  : discountType === 'FLAT'
                  ? `LKR ${discountFlat} Off`
                  : 'Apply Discount'}
              </span>
              {discountType !== 'NONE' && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    resetDiscount();
                  }}
                  className="ml-1 hover:bg-emerald-700/80 p-1 rounded-full transition-colors"
                  title="Remove discount"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </button>

            {/* Tab 2: Add Customer */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="h-14 md:h-16 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-95 transition-all border border-sky-500 cursor-pointer px-3 select-none"
            >
              <UserPlus className="w-5 h-5 text-white shrink-0 stroke-[2.5]" />
              <span className="truncate">
                {selectedCustomer ? selectedCustomer.name : 'Customer (Walk-in)'}
              </span>
              {selectedCustomer && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomer(null);
                  }}
                  className="ml-1 hover:bg-sky-800/80 p-1 rounded-full transition-colors"
                  title="Remove customer"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </button>

            {/* Tab 3: Hold Ticket [F4] */}
            <button
              type="button"
              onClick={handleHoldTicket}
              disabled={cart.length === 0}
              className="h-14 md:h-16 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-95 transition-all border border-amber-400 disabled:opacity-50 disabled:pointer-events-none cursor-pointer px-3 select-none"
            >
              <PauseCircle className="w-5 h-5 text-white shrink-0 stroke-[2.5]" />
              <span className="truncate">Hold Ticket [F4]</span>
            </button>

            {/* Tab 4: Custom Sale Item */}
            <button
              type="button"
              onClick={() => setIsCustomSaleModalOpen(true)}
              className="h-14 md:h-16 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-2xl shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-95 transition-all border border-purple-500 cursor-pointer px-3 select-none"
            >
              <Tag className="w-5 h-5 text-white shrink-0 stroke-[2.5]" />
              <span className="truncate">+ Custom Item</span>
            </button>
          </div>

          {/* Held Tickets Banner (if tickets are held) */}
          {heldTickets.length > 0 && (
            <div className="mb-1.5 flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-semibold">
                  {heldTickets.length} ticket{heldTickets.length > 1 ? 's' : ''} currently on hold
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHeldTicketsModalOpen(true)}
                className="font-bold underline hover:text-amber-950 cursor-pointer"
              >
                View & Resume &rarr;
              </button>
            </div>
          )}
        </div>

        {/* 3. Hero Search Station with Live Keystroke Autocomplete Dropdown */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white shrink-0" ref={searchContainerRef}>
          <div className="relative w-full mb-1">
            {/* Left: Magnifying Glass Icon (w-6 h-6 text-slate-400) */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10">
              <Search className="w-6 h-6 text-slate-400" />
            </div>

            {/* Expansive Input (h-14 md:h-16 text-base md:text-lg font-medium px-14 rounded-2xl border-2 border-slate-200 bg-white shadow-sm focus:border-[#7052FF] focus:ring-4 focus:ring-[#7052FF]/10 transition-all) */}
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search 3,120 Ayurvedic medicines, oils, churnas, or scan barcode [F2]..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length > 0) setIsSearchDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (!isSearchDropdownOpen && liveSearchResults.length > 0) {
                    setIsSearchDropdownOpen(true);
                    setSelectedSearchIndex(0);
                  } else {
                    setSelectedSearchIndex((prev) => (prev < liveSearchResults.length - 1 ? prev + 1 : 0));
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedSearchIndex((prev) => (prev > 0 ? prev - 1 : liveSearchResults.length - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (isSearchDropdownOpen && liveSearchResults.length > 0 && liveSearchResults[selectedSearchIndex]) {
                    addToCart(liveSearchResults[selectedSearchIndex]);
                    searchInputRef.current?.focus();
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsSearchDropdownOpen(false);
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full h-14 md:h-16 text-base md:text-lg font-medium pl-14 pr-44 rounded-2xl border-2 border-slate-200 bg-white shadow-sm focus:outline-none focus:border-[#7052FF] focus:ring-4 focus:ring-[#7052FF]/10 transition-all text-slate-900 placeholder:text-slate-400"
            />

            {/* Right: Shortcut [F2] Badge, Item Count & Clear Button */}
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchDropdownOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Barcode [F2] Tag */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs text-xs font-mono text-slate-500">
                <Barcode className="w-4 h-4 text-[#7052FF]" />
                <span className="font-semibold text-slate-700">[F2]</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Live Count Badge */}
              <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl shrink-0">
                {filteredProducts.length.toLocaleString()} items
              </div>
            </div>

            {/* Floating Live Autocomplete Dropdown Popover */}
            {isSearchDropdownOpen && searchQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[380px] overflow-y-auto z-50 divide-y divide-slate-100">
                {liveSearchResults.length > 0 ? (
                  liveSearchResults.map((item, idx) => {
                    const isSelected = idx === selectedSearchIndex;
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setSelectedSearchIndex(idx)}
                        onClick={() => {
                          addToCart(item);
                          searchInputRef.current?.focus();
                        }}
                        className={`px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-purple-50/80' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Thumbnail & Product Meta */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200/80 p-0.5">
                            <img
                              src={getProductPhoto(item)}
                              alt={item.name}
                              className="w-full h-full object-contain"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_STUDIO_PHOTO;
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                                {item.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {item.sku}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="capitalize">{item.category?.name || 'Ayurvedic'}</span>
                              <span>•</span>
                              <span
                                className={
                                  item.stockOnHand <= 5
                                    ? 'text-amber-600 font-semibold'
                                    : 'text-emerald-600 font-semibold'
                                }
                              >
                                In Stock: {item.stockOnHand}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Price Badge & Instant Add Button */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                            LKR{' '}
                            {item.retailPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(item);
                              searchInputRef.current?.focus();
                            }}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-[#7052FF] text-white text-xs font-semibold rounded-lg transition-colors active:scale-95 flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No products found matching &ldquo;{searchQuery}&rdquo;
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try searching by generic name, brand, or SKU barcode.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 4. Ayurvedic Master Department Tabs (10 Sri Lankan Departments + Sinhala/English Labels) */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0 bg-white">
          {/* All Departments Tab */}
          <button
            type="button"
            onClick={() => setSelectedDeptId('all')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-2 border ${
              selectedDeptId === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80'
            }`}
          >
            <span>All Products (සියලු වර්ග)</span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                selectedDeptId === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {departmentCounts.all || 0}
            </span>
          </button>

          {/* 10 Standardized Ayurvedic Departments */}
          {AYURVEDIC_DEPARTMENT_LIST.map((dept) => {
            const isActive = selectedDeptId === dept.id;
            const count = departmentCounts[dept.id] || 0;

            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDeptId(dept.id)}
                className={`px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-2 border ${
                  isActive
                    ? `${dept.bgTint} ${dept.textColor} ${dept.borderTint} font-bold ring-2 ring-[#7052FF]/30 shadow-xs`
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/70'
                }`}
              >
                {/* 3D Mini Dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${dept.gradient} shadow-2xs shrink-0`}
                />
                <span className="whitespace-nowrap">
                  {dept.en} <span className="opacity-80 font-normal text-xs">({dept.si})</span>
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    isActive ? 'bg-white/90 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5. Product Cards Grid with 3D Category Emblems */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-28 md:pb-5 bg-white">
          {isLoadingProducts && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#7052FF] mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Loading Deegayu Ayurvedic Catalog...</h3>
              <p className="text-xs text-slate-400 mt-1">
                Connecting to live Supabase repository (3,120 products)...
              </p>
            </div>
          ) : catalogError && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Package className="w-10 h-10 text-rose-400 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Catalogue Sync Failed</h3>
              <p className="text-xs text-rose-500 max-w-sm mt-1">{catalogError}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Package className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-700">No Products Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                No items matched &quot;{searchQuery}&quot; in the selected department
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDeptId('all');
                }}
                className="mt-3 text-xs font-semibold text-[#7052FF] hover:underline"
              >
                Clear Filters & Show All
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {visibleProducts.map((product) => {
                const dept =
                  (product.departmentId && AYURVEDIC_MASTER_DEPARTMENTS[product.departmentId]) ||
                  AYURVEDIC_MASTER_DEPARTMENTS['fmcg']!;

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white border-2 border-slate-200/90 hover:border-indigo-400 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between cursor-pointer group active:scale-[0.98] select-none relative"
                  >
                    {/* Top Row: Department Sinhala Pill + Stock Indicator */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${dept.bgTint} ${dept.textColor} ${dept.borderTint}`}
                      >
                        {dept.si || dept.en}
                      </span>
                      {product.stockOnHand <= 0 ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-mono">
                          0 left
                        </span>
                      ) : product.stockOnHand <= 5 ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 font-mono">
                          {product.stockOnHand} left
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 font-mono">
                          Qty: {product.stockOnHand}
                        </span>
                      )}
                    </div>

                    {/* High-Contrast Realistic Product Photo Container */}
                    <div className="bg-slate-50/90 rounded-xl h-28 w-full p-2 overflow-hidden flex items-center justify-center mb-2.5 group-hover:bg-slate-100/80 transition-colors relative">
                      <img
                        src={getProductPhoto(product)}
                        alt={product.name}
                        className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_STUDIO_PHOTO;
                        }}
                      />
                    </div>

                    {/* Product Details, Legible Typography & Tactile Add Action */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4
                          className="text-sm md:text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 min-h-[42px] group-hover:text-indigo-600 transition-colors"
                          title={product.name}
                        >
                          {product.name}
                        </h4>
                        <div className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {dept.en}
                        </div>
                      </div>

                      {/* Bottom Row: Large High-Contrast Price + Tactile '+' Add Button */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
                        <div className="flex items-baseline">
                          <span className="text-xs font-bold text-slate-400 mr-1">LKR</span>
                          <span className="text-base md:text-lg font-black font-mono text-slate-950 tracking-tight">
                            {product.retailPrice.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-sm active:scale-90 transition-all cursor-pointer shrink-0"
                          title="Add to cart"
                          aria-label={`Add ${product.name} to cart`}
                        >
                          <Plus className="w-5 h-5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {visibleCount < filteredProducts.length && (
                <div
                  ref={loadMoreSentinelRef}
                  className="col-span-full py-6 flex flex-col items-center justify-center border-t border-dashed border-slate-200 mt-2"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin text-[#7052FF]" />
                    <span>
                      Showing {visibleProducts.length} of {filteredProducts.length} products...
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((prev) => Math.min(prev + 48, filteredProducts.length))
                    }
                    className="mt-2 text-xs font-semibold text-[#7052FF] hover:underline cursor-pointer"
                  >
                    Load next 48 items
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          RIGHT COLUMN: DEDICATED CART & CHECKOUT RAIL (340px-380px)
      ===================================================================== */}
      <aside className="hidden md:flex w-[340px] lg:w-[360px] xl:w-[380px] bg-white flex-col h-full shrink-0 select-none border-l border-slate-100">
        {/* 1. Cart Header */}
        <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm md:text-base font-bold text-slate-900">Order Summary</h3>
            <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {totalItemCount}
            </span>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-rose-600 hover:text-rose-700 text-xs md:text-sm font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Order</span>
            </button>
          )}
        </div>

        {/* 2. Customer Pill in Cart (if attached) */}
        {selectedCustomer && (
          <div className="px-5 py-2.5 bg-sky-50/60 border-b border-sky-100 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs md:text-sm font-bold text-sky-950 truncate">
                  {selectedCustomer.name}
                </div>
                {selectedCustomer.loyaltyPoints ? (
                  <div className="text-xs text-sky-700 font-mono font-medium">
                    Loyalty: {selectedCustomer.loyaltyPoints} pts
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="text-sky-500 hover:text-sky-800 text-xs p-1"
              title="Remove customer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-20 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">No items selected</p>
              <p className="text-xs text-slate-400 mt-0.5">Click any product in the catalog</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 group">
                {/* Rounded squircle realistic product photo preview */}
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                  <img
                    src={getProductPhoto(item)}
                    alt={item.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_STUDIO_PHOTO;
                    }}
                  />
                </div>

                {/* Name & Unit Price */}
                <div className="min-w-0 flex-1">
                  <h5 className="text-sm font-bold text-slate-900 truncate leading-snug max-w-[140px]">
                    {item.name}
                  </h5>
                  <div className="text-xs text-slate-500 font-mono font-medium">
                    LKR {item.price.toFixed(2)}
                  </div>
                </div>

                {/* Stepper Quantity Controls: - [qty] + */}
                <div className="text-sm text-slate-800 font-mono font-bold flex items-center gap-2.5 bg-slate-100/80 px-2.5 py-1 rounded-xl border border-slate-200/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="text-slate-400 hover:text-slate-900 active:scale-90 transition-transform font-bold"
                  >
                    -
                  </button>
                  <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    className="text-slate-400 hover:text-slate-900 active:scale-90 transition-transform font-bold"
                  >
                    +
                  </button>
                </div>

                {/* Line Total & Delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-slate-900 font-mono">
                    LKR {(item.price * item.quantity).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.id)}
                    className="text-rose-400 hover:text-rose-600 transition-colors p-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 4. Financial Breakdown Summary */}
        <div className="p-5 border-t border-slate-100 bg-white space-y-3">
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-sans font-medium">Subtotal</span>
              <span className="font-bold">LKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-sans font-medium">Tax (0% / Ex)</span>
              <span>LKR 0.00</span>
            </div>

            {/* Discount Line */}
            {discountType !== 'NONE' && (
              <div className="flex justify-between items-center text-emerald-600 font-semibold text-sm">
                <span className="flex items-center gap-1 font-sans">
                  <Percent className="w-3.5 h-3.5" />
                  <span>
                    Discount ({discountType === 'PERCENT' ? `${discountPercent}%` : 'Flat'})
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span>- LKR {discountAmount.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={resetDiscount}
                    className="text-rose-400 hover:text-rose-600 p-0.5"
                    title="Remove discount"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Add Discount Pill (if no discount active) */}
            {discountType === 'NONE' && cart.length > 0 && (
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(true)}
                className="w-full py-1.5 rounded-lg border border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/50 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Percent className="w-3.5 h-3.5" />
                <span>% Add Order Discount</span>
              </button>
            )}

            <div className="pt-3 border-t border-slate-200/80 flex items-baseline justify-between">
              <div className="flex flex-col">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                  Total Payable
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Net Due (LKR)</span>
              </div>
              <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-slate-950">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 5. Payment Method Segmented Control */}
          <div className="pt-1">
            <label className="text-xs md:text-sm font-bold text-slate-800 block mb-2">
              Payment Method
            </label>
            <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-4 gap-1 text-xs md:text-sm">
              {[
                { id: 'CARD', label: 'Card', icon: CreditCard },
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'STORE_CREDIT', label: 'Credit', icon: BookOpen },
                { id: 'SPLIT', label: 'Split', icon: Split },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = paymentMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentMethod(tab.id as typeof paymentMethod)}
                    className={`py-2 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Credit Account Telemetry & Warning */}
            {paymentMethod === 'STORE_CREDIT' && (
              <div className="mt-2 text-xs transition-all animate-in fade-in duration-150">
                {!selectedCustomer ? (
                  <div className="flex items-center justify-between text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <span className="font-semibold">⚠️ Select customer for Credit sale</span>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-md border border-indigo-200 hover:bg-indigo-50 cursor-pointer"
                    >
                      Attach
                    </button>
                  </div>
                ) : (
                  <div className="bg-indigo-50/70 border border-indigo-100 p-2.5 rounded-xl space-y-1">
                    <div className="flex justify-between font-bold text-slate-800">
                      <span className="truncate">{selectedCustomer.name}</span>
                      <span className="font-mono text-indigo-700 shrink-0">
                        Limit: LKR {Number(selectedCustomer.creditLimit || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Current Debt (ණය):</span>
                      <span className="font-mono font-bold text-rose-600">
                        LKR {Number(selectedCustomer.currentBalance || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Available Credit:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        LKR {Math.max(0, Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.currentBalance || 0)).toLocaleString()}
                      </span>
                    </div>
                    {totalAmount > Math.max(0, Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.currentBalance || 0)) && (
                      <div className="text-xs font-bold text-red-600 bg-red-50 p-1.5 rounded-md border border-red-200 mt-1">
                        ⚠️ Order exceeds credit limit by LKR {(totalAmount - Math.max(0, Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.currentBalance || 0))).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. Primary Charge Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCharge}
              disabled={cart.length === 0 || isProcessingCheckout}
              className="w-full bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-[0.99] disabled:opacity-40 text-white font-bold text-base md:text-lg py-4 rounded-2xl shadow-lg shadow-[#7052FF]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              {isProcessingCheckout ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <span>Charge LKR {totalAmount.toFixed(2)}</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          UBER-EATS STYLE FLOATING BOTTOM CART BAR (< md screens)
      ===================================================================== */}
      {cart.length > 0 && !isMobileCartOpen && (
        <aside
          aria-label="Floating Mobile Cart"
          onClick={() => setIsMobileCartOpen(true)}
          className="fixed bottom-20 inset-x-3 md:hidden z-40 bg-[#7052FF] text-white rounded-2xl p-3.5 shadow-float flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all animate-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm md:text-base">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="text-white/40">•</span>
                <span className="font-mono font-bold text-white text-sm md:text-base">
                  LKR {totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-white/90">Tap to review & checkout</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white text-[#7052FF] px-4 py-2 rounded-xl font-bold text-xs md:text-sm shadow-sm">
            <span>Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </aside>
      )}

      {/* =====================================================================
          MOBILE BOTTOM SHEET DRAWER (< md screens)
      ===================================================================== */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          <div
            onClick={() => setIsMobileCartOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          />

          <div className="relative bg-white rounded-t-3xl shadow-bottom-sheet z-10 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-250">
            {/* Drag Pill */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm md:text-base font-bold text-slate-800">
                Order Summary ({totalItemCount})
              </h3>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs md:text-sm text-rose-600 font-semibold px-2 py-1"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Line Items List */}
            <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-slate-100 max-h-[36vh]">
              {cart.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h5 className="text-sm font-bold text-slate-900 truncate">{item.name}</h5>
                    <div className="text-xs text-slate-500 font-mono">
                      LKR {item.price.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 font-mono flex items-center gap-2 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      className="font-bold text-slate-500"
                    >
                      -
                    </button>
                    <span className="font-bold text-slate-900 w-4 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="font-bold text-slate-500"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-sm font-bold font-mono text-slate-900">
                    LKR {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial breakdown & Charge */}
            <div className="p-5 bg-white border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-baseline text-slate-900">
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-500">
                  Total Payable
                </span>
                <span className="text-xl md:text-2xl font-black font-mono text-slate-950">
                  LKR {totalAmount.toFixed(2)}
                </span>
              </div>

              {/* Payment selector */}
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-4 gap-1 text-xs md:text-sm">
                {[
                  { id: 'CARD', label: 'Card' },
                  { id: 'CASH', label: 'Cash' },
                  { id: 'STORE_CREDIT', label: 'Credit' },
                  { id: 'SPLIT', label: 'Split' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentMethod(tab.id as typeof paymentMethod)}
                    className={`py-2 rounded-lg font-semibold transition-all text-center ${
                      paymentMethod === tab.id
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMobileCartOpen(false);
                  handleCharge();
                }}
                disabled={cart.length === 0 || isProcessingCheckout}
                className="w-full bg-[#7052FF] text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-[#7052FF]/20 flex items-center justify-center gap-2"
              >
                <span>Charge LKR {totalAmount.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUPPORTING MODALS
      ===================================================================== */}
      {/* 1. Receipt Modal */}
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

      {/* 2. End Shift Modal */}
      <ShiftEndModal
        isOpen={isEndShiftModalOpen}
        onClose={() => setIsEndShiftModalOpen(false)}
        cashierName={cashierName}
        registerCode={registerCode}
        openingFloat={openingFloat}
        totalSalesToday={totalAmount}
        onConfirmEndShift={() => {
          setScanFeedback('Z-Report generated & Shift Ended.');
          setTimeout(() => setScanFeedback(null), 3000);
        }}
      />

      {/* 3. Discount Picker Modal */}
      <DiscountPickerModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        currentPercent={discountPercent}
        currentFlatAmount={discountFlat}
        onApplyDiscount={(type, value) => {
          if (type === 'PERCENT') {
            setDiscountType('PERCENT');
            setDiscountPercent(value);
            setDiscountFlat(0);
            setScanFeedback(`${value}% Discount Applied`);
          } else {
            setDiscountType('FLAT');
            setDiscountFlat(value);
            setDiscountPercent(0);
            setScanFeedback(`LKR ${value.toFixed(2)} Discount Applied`);
          }
          setTimeout(() => setScanFeedback(null), 2000);
        }}
      />

      {/* 4. Customer Selection & Registration Modal */}
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(cust) => {
          setSelectedCustomer(cust);
          if (cust) {
            setScanFeedback(`Customer Attached: ${cust.name}`);
          } else {
            setScanFeedback('Customer reset to Walk-in');
          }
          setTimeout(() => setScanFeedback(null), 2000);
        }}
      />

      {/* 5. Custom Item Modal */}
      <CustomSaleModal
        isOpen={isCustomSaleModalOpen}
        onClose={() => setIsCustomSaleModalOpen(false)}
        onAddCustomItem={handleAddCustomItem}
      />

      {/* 6. Held Tickets Queue Modal */}
      <HeldTicketsModal
        isOpen={isHeldTicketsModalOpen}
        onClose={() => setIsHeldTicketsModalOpen(false)}
        heldTickets={heldTickets}
        onRestoreTicket={handleRestoreHeldTicket}
        onDiscardTicket={handleDiscardHeldTicket}
      />

      {/* 7. Cashier Profile & PIN Switcher Modal */}
      <CashierSwitcherModal
        isOpen={isCashierModalOpen}
        onClose={() => setIsCashierModalOpen(false)}
        currentCashierName={cashierName}
        onCashierSwitched={(switchedCashier) => {
          setActiveCashier(switchedCashier);
          setScanFeedback(`Active cashier switched to ${switchedCashier.fullName}`);
          setTimeout(() => setScanFeedback(null), 3000);
        }}
      />
    </div>
  );
}
