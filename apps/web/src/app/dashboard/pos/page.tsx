'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  RotateCcw,
  PauseCircle,
  Layers,
  Clock,
  Barcode,
  ShoppingBag,
  Percent,
  Phone,
  LayoutGrid,
  List,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type {
  CheckoutPayload,
  HeldCartDto,
  ProductDto,
  SaleDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi, productsApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';

// =========================================================================
// UNIVERSAL COMMERCIAL RETAIL CATALOGUE (Benchmark: Square / Shopify Retail)
// =========================================================================
interface RetailProductItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  category: { name: string; slug: string };
  stockOnHand: number;
  unit: string;
  imageBg: string;
}

const SAMPLE_RETAIL_ITEMS: RetailProductItem[] = [
  {
    id: 'prod-001',
    name: 'Organic Ceylon Cinnamon (100g)',
    sku: 'GRO-CIN-01',
    barcode: '479200000001',
    retailPrice: 950.0,
    wholesalePrice: 820.0,
    costPrice: 500.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 45,
    unit: 'pcs',
    imageBg: 'from-amber-100 to-amber-200',
  },
  {
    id: 'prod-002',
    name: 'Araliya Keeri Samba Rice (5kg)',
    sku: 'GRO-RIC-05',
    barcode: '479200000002',
    retailPrice: 1650.0,
    wholesalePrice: 1480.0,
    costPrice: 1200.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 60,
    unit: 'bag',
    imageBg: 'from-emerald-100 to-teal-100',
  },
  {
    id: 'prod-003',
    name: 'Anchor Full Cream Milk Powder (400g)',
    sku: 'GRO-MLK-04',
    barcode: '479200000003',
    retailPrice: 1180.0,
    wholesalePrice: 1050.0,
    costPrice: 880.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 32,
    unit: 'tin',
    imageBg: 'from-blue-100 to-cyan-100',
  },
  {
    id: 'prod-004',
    name: 'Ceylon Pure Green Tea Tin (250g)',
    sku: 'GRO-TEA-02',
    barcode: '479200000004',
    retailPrice: 1250.0,
    wholesalePrice: 1100.0,
    costPrice: 700.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 50,
    unit: 'tin',
    imageBg: 'from-emerald-50 to-green-100',
  },
  {
    id: 'prod-005',
    name: 'Samsung Fast Charger Type-C (25W)',
    sku: 'ELC-CHG-25',
    barcode: '479200000005',
    retailPrice: 4500.0,
    wholesalePrice: 3800.0,
    costPrice: 2800.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 18,
    unit: 'box',
    imageBg: 'from-slate-100 to-blue-100',
  },
  {
    id: 'prod-006',
    name: 'Anker Braided USB-C Cable (1.8m)',
    sku: 'ELC-CBL-18',
    barcode: '479200000006',
    retailPrice: 2200.0,
    wholesalePrice: 1850.0,
    costPrice: 1200.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 25,
    unit: 'pcs',
    imageBg: 'from-indigo-100 to-purple-100',
  },
  {
    id: 'prod-007',
    name: 'Wireless Optical Mouse 2.4GHz',
    sku: 'ELC-MOU-01',
    barcode: '479200000007',
    retailPrice: 1850.0,
    wholesalePrice: 1500.0,
    costPrice: 950.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 14,
    unit: 'pcs',
    imageBg: 'from-violet-100 to-slate-100',
  },
  {
    id: 'prod-008',
    name: "Men's Classic Oxford Shirt (L)",
    sku: 'APP-SHT-OX',
    barcode: '479200000008',
    retailPrice: 4800.0,
    wholesalePrice: 3900.0,
    costPrice: 2500.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 8,
    unit: 'pcs',
    imageBg: 'from-sky-100 to-blue-200',
  },
  {
    id: 'prod-009',
    name: 'Heavyweight Cotton Crewneck Tee',
    sku: 'APP-TEE-01',
    barcode: '479200000009',
    retailPrice: 2400.0,
    wholesalePrice: 1950.0,
    costPrice: 1100.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 22,
    unit: 'pcs',
    imageBg: 'from-stone-100 to-amber-100',
  },
  {
    id: 'prod-010',
    name: 'Heavy Duty Brass Padlock (50mm)',
    sku: 'HDW-LCK-50',
    barcode: '479200000010',
    retailPrice: 1750.0,
    wholesalePrice: 1450.0,
    costPrice: 900.0,
    category: { name: 'Hardware', slug: 'hardware' },
    stockOnHand: 30,
    unit: 'pcs',
    imageBg: 'from-amber-100 to-yellow-200',
  },
  {
    id: 'prod-011',
    name: 'Stanley Steel Measuring Tape (5m)',
    sku: 'HDW-TAP-05',
    barcode: '479200000011',
    retailPrice: 1350.0,
    wholesalePrice: 1100.0,
    costPrice: 700.0,
    category: { name: 'Hardware', slug: 'hardware' },
    stockOnHand: 16,
    unit: 'pcs',
    imageBg: 'from-yellow-100 to-orange-100',
  },
  {
    id: 'prod-012',
    name: 'Panadol Extra Caplets (Pack of 24)',
    sku: 'PHR-PAN-24',
    barcode: '479200000012',
    retailPrice: 480.0,
    wholesalePrice: 420.0,
    costPrice: 320.0,
    category: { name: 'Pharmacy', slug: 'pharmacy' },
    stockOnHand: 80,
    unit: 'strip',
    imageBg: 'from-rose-100 to-red-100',
  },
];

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number;
  stockOnHand: number;
  unit: string;
  note?: string;
}

interface RetailCustomer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  creditBalance: number;
}

const FREQUENT_CUSTOMERS: RetailCustomer[] = [
  { id: 'cust-1', name: 'Walk-in Customer', phone: '', creditLimit: 0, creditBalance: 0 },
  { id: 'cust-2', name: 'Saman Perera (Lanka Traders)', phone: '+94 77 123 4567', creditLimit: 50000, creditBalance: 12400 },
  { id: 'cust-3', name: 'Dilshan Silva (Apex Hardware)', phone: '+94 71 987 6543', creditLimit: 100000, creditBalance: 34500 },
  { id: 'cust-4', name: 'Kavindu Senanayake', phone: '+94 76 555 4321', creditLimit: 25000, creditBalance: 0 },
];

export default function PosCheckoutPage() {
  const {
    currency,
    business,
    selectedBranchId,
    branches,
    user,
  } = useTenantBranch();

  // Search input ref for instant keyboard autofocus [F2]
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Layout View mode: Card Grid View vs Compact Table List View
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pricing mode toggle: Retail Price vs Wholesale Price
  const [pricingTier, setPricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

  // Catalogue states
  const [dbProducts, setDbProducts] = useState<ProductDto[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Cart & Order states
  const [orderNumber, setOrderNumber] = useState<number>(235);
  const [customer, setCustomer] = useState<RetailCustomer>(FREQUENT_CUSTOMERS[0]!);
  const [cart, setCart] = useState<CartItem[]>([
    {
      id: 'cart-1',
      productId: 'prod-001',
      name: 'Organic Ceylon Cinnamon (100g)',
      sku: 'GRO-CIN-01',
      barcode: '479200000001',
      price: 950.0,
      retailPrice: 950.0,
      wholesalePrice: 820.0,
      quantity: 2,
      stockOnHand: 45,
      unit: 'pcs',
    },
    {
      id: 'cart-2',
      productId: 'prod-005',
      name: 'Samsung Fast Charger Type-C (25W)',
      sku: 'ELC-CHG-25',
      barcode: '479200000005',
      price: 4500.0,
      retailPrice: 4500.0,
      wholesalePrice: 3800.0,
      quantity: 1,
      stockOnHand: 18,
      unit: 'box',
    },
  ]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Modals
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | 'QR' | 'CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);

  // Backend Integration states
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCartDto[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isLoadingHeld, setIsLoadingHeld] = useState(false);

  // Quick Customer Creation form
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // 1. Keyboard Shortcut listener (F2: Focus search, F4: Hold cart, F12: Pay)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldOrder();
      } else if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0) {
          handleOpenPayment();
        }
      } else if (e.key === 'Escape') {
        setIsPaymentModalOpen(false);
        setIsCustomerModalOpen(false);
        setIsHeldModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Load Catalogue from API
  const loadCatalog = useCallback(async () => {
    try {
      const prodRes = await productsApi.getAll({ limit: 100 });
      if (prodRes.data && prodRes.data.items.length > 0) {
        setDbProducts(prodRes.data.items);
      }
    } catch (err) {
      console.warn('Using commercial retail catalogue fallback for POS preview:', err);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const loadHeldCarts = useCallback(async () => {
    try {
      setIsLoadingHeld(true);
      const res = await posApi.getHeldCarts(selectedBranchId || undefined);
      if (res.data) {
        setHeldCarts(res.data);
      }
    } catch (err) {
      console.warn('Failed to load held carts:', err);
    } finally {
      setIsLoadingHeld(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    loadHeldCarts();
  }, [loadHeldCarts]);

  // Combined product catalog
  const allProducts: RetailProductItem[] = useMemo(() => {
    if (dbProducts.length > 0) {
      return dbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode || p.sku,
        retailPrice: Number(p.retailPrice),
        wholesalePrice: Number(p.wholesalePrice || p.retailPrice),
        costPrice: Number(p.costPrice || 0),
        category: p.category ? { name: p.category.name, slug: p.category.slug } : { name: 'General', slug: 'general' },
        stockOnHand: 50,
        unit: p.unit?.shortCode || 'pcs',
        imageBg: 'from-blue-50 to-indigo-100',
      }));
    }
    return SAMPLE_RETAIL_ITEMS;
  }, [dbProducts]);

  // Recalculate cart item prices when pricingTier changes (Retail vs Wholesale)
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        price: pricingTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice,
      })),
    );
  }, [pricingTier]);

  // Category counts
  const categoryTabs = useMemo(() => {
    const catMap = new Map<string, number>();
    allProducts.forEach((p) => {
      const catName = p.category?.name || 'General';
      catMap.set(catName, (catMap.get(catName) || 0) + 1);
    });

    const tabs = [{ name: 'All Products', slug: 'all', count: allProducts.length }];
    catMap.forEach((count, name) => {
      tabs.push({ name, slug: name.toLowerCase(), count });
    });
    return tabs;
  }, [allProducts]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));

      if (!matchesSearch) return false;
      if (selectedCategorySlug === 'all') return true;
      return p.category.name.toLowerCase() === selectedCategorySlug.toLowerCase();
    });
  }, [allProducts, searchQuery, selectedCategorySlug]);

  // Add Item to Cart
  const addToCart = (product: RetailProductItem) => {
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
        },
      ];
    });

    setScanFeedback(`Added: ${product.name} (Qty: 1)`);
    setTimeout(() => setScanFeedback(null), 1800);
  };

  // Barcode / SKU Scan Submitter
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;

    const matched = allProducts.find(
      (p) => p.barcode === term || p.sku.toUpperCase() === term.toUpperCase(),
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    } else {
      setScanFeedback(`No product found for SKU/Barcode: "${term}"`);
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

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === itemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    );
  };

  const removeCartItem = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    if (cart.length > 0 && confirm('Clear all items from active retail ticket?')) {
      setCart([]);
      setDiscountPercent(0);
    }
  };

  // Financial Computations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxRate = business?.settings?.taxRate ? Number(business.settings.taxRate) : 0;
  const taxAmount = useMemo(() => {
    return ((subtotal - discountAmount) * taxRate) / 100;
  }, [subtotal, discountAmount, taxRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount + taxAmount);
  }, [subtotal, discountAmount, taxAmount]);

  const changeDue = useMemo(() => {
    return Math.max(0, cashTendered - grandTotal);
  }, [cashTendered, grandTotal]);

  const remainingDue = useMemo(() => {
    return Math.max(0, grandTotal - cashTendered);
  }, [cashTendered, grandTotal]);

  const formatCurrency = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Open Payment Flow
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      alert('Active ticket is empty. Scan products to tender sale.');
      return;
    }
    setCashTendered(grandTotal);
    setIsPaymentModalOpen(true);
  };

  // Hold Active Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Nothing to suspend.');
      return;
    }
    const defaultLabel =
      customer.name !== 'Walk-in Customer'
        ? customer.name
        : `Ticket #${orderNumber}`;

    const ref = prompt('Enter reference name for suspended retail ticket:', defaultLabel);
    if (!ref) return;

    try {
      await posApi.holdCart({
        branchId: selectedBranchId || branches[0]?.id || '',
        cartReference: ref,
        cartData: {
          orderType: 'RETAIL_WALKIN',
          customerName: customer.name,
          items: cart.map((i) => ({
            productId: i.productId.startsWith('prod-') ? undefined : i.productId,
            productName: i.name,
            sku: i.sku,
            unitPrice: i.price,
            quantity: i.quantity,
            subtotal: i.price * i.quantity,
            notes: i.note,
          })),
          discountAmount,
        },
      });

      setCart([]);
      setDiscountPercent(0);
      setOrderNumber((prev) => prev + 1);
      loadHeldCarts();
      setScanFeedback(`Ticket suspended as "${ref}"`);
      setTimeout(() => setScanFeedback(null), 2500);
    } catch (err) {
      console.error('Failed to hold ticket:', err);
      alert('Failed to suspend ticket.');
    }
  };

  // Resume Suspended Cart
  const handleResumeCart = async (heldCart: HeldCartDto) => {
    try {
      await posApi.resumeCart(heldCart.id);
      const cartData = heldCart.cartData as {
        items?: Array<{
          productId?: string;
          productName: string;
          sku: string;
          unitPrice: number;
          quantity: number;
          notes?: string;
        }>;
        customerName?: string;
      };

      if (cartData?.items && Array.isArray(cartData.items)) {
        const restored = cartData.items.map((i, idx) => ({
          id: `cart-restored-${Date.now()}-${idx}`,
          productId: i.productId || `restored-${idx}`,
          name: i.productName,
          sku: i.sku,
          barcode: i.sku,
          price: i.unitPrice,
          retailPrice: i.unitPrice,
          wholesalePrice: i.unitPrice,
          quantity: i.quantity,
          stockOnHand: 50,
          unit: 'pcs',
          note: i.notes,
        }));
        setCart(restored);
      }

      if (cartData?.customerName) {
        setCustomer({
          id: 'restored-customer',
          name: cartData.customerName,
          phone: '',
          creditLimit: 0,
          creditBalance: 0,
        });
      }

      setIsHeldModalOpen(false);
      loadHeldCarts();
    } catch (err) {
      console.error('Failed to resume ticket:', err);
      alert('Failed to resume suspended ticket.');
    }
  };

  // Confirm Payment & Submit to POS API
  const handleConfirmPayment = async () => {
    try {
      setIsSubmittingPayment(true);
      const payload: CheckoutPayload = {
        branchId: selectedBranchId || branches[0]?.id || '',
        orderType: 'RETAIL_WALKIN',
        customerName: customer.name !== 'Walk-in Customer' ? customer.name : undefined,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount: grandTotal,
        paidAmount: selectedPaymentMethod === 'CASH' ? cashTendered : grandTotal,
        changeDue,
        idempotencyKey: `pos-retail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        items: cart.map((i) => ({
          productId: i.productId.startsWith('prod-') ? undefined : i.productId,
          productName: i.name,
          sku: i.sku,
          unitPrice: i.price,
          quantity: i.quantity,
          discountAmount: 0,
          taxAmount: 0,
          subtotal: i.price * i.quantity,
          notes: i.note,
        })),
        payments: [
          {
            paymentMethod:
              selectedPaymentMethod === 'QR'
                ? 'QR_PAYMENT'
                : selectedPaymentMethod === 'CREDIT'
                  ? 'STORE_CREDIT'
                  : selectedPaymentMethod,
            amount: selectedPaymentMethod === 'CASH' ? cashTendered : grandTotal,
          },
        ],
      };

      const res = await posApi.checkout(payload);
      if (res.data) {
        setCompletedSale(res.data);
      }
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
    } catch (err) {
      console.error('Retail checkout error:', err);
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // New Sale Reset
  const handleNewSale = () => {
    setIsReceiptModalOpen(false);
    setCompletedSale(null);
    setCart([]);
    setOrderNumber((prev) => prev + 1);
    setDiscountPercent(0);
    setCustomer(FREQUENT_CUSTOMERS[0]!);
    searchInputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 overflow-hidden relative select-none">
      {/* Dynamic Feedback Banner */}
      {scanFeedback && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Barcode className="w-4 h-4 text-[#2F65F6]" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* LEFT / CENTER: HIGH-SPEED RETAIL INVENTORY & SCANNER (70%) */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Barcode & Search Console */}
        <div className="space-y-2.5 pb-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Unified Barcode / SKU / Title Instant Scanner Input */}
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <Barcode className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Scan Barcode or Search by SKU / Name... [F2]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200/90 rounded-2xl pl-10 pr-20 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6] focus:ring-2 focus:ring-[#2F65F6]/10 shadow-[0_2px_8px_rgba(0,0,0,0.03)] font-mono font-medium"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-500 border border-slate-200">
                  Enter ↵
                </kbd>
              </div>
            </form>

            {/* View Mode Toggle: Card Grid vs Table List */}
            <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#2F65F6] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Visual Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === 'table'
                    ? 'bg-[#2F65F6] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
                title="Compact Table List View (Supermarkets & Hardware)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Horizontal Category Tabs with Live Product Counts */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {categoryTabs.map((cat) => {
              const isActive = selectedCategorySlug.toLowerCase() === cat.slug.toLowerCase();
              return (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategorySlug(cat.slug)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#2F65F6] text-white shadow-[0_4px_12px_rgba(47,101,246,0.25)] scale-[1.02]'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Ingestion Viewport */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
              <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center text-3xl mb-3 shadow-sm">
                🔍
              </div>
              <p className="text-sm font-bold text-slate-700">No matching retail products found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                No items match your barcode or search term &quot;{searchQuery}&quot;. Try adjusting your query or scanning a new barcode.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategorySlug('all');
                }}
                className="mt-4 px-4 py-2 rounded-xl bg-blue-50 text-[#2F65F6] text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                Reset Search Filters
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            /* ========================================================== */
            /* VIEW A: VISUAL CARD GRID VIEW (Boutiques, Electronics)    */
            /* ========================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 pb-2">
              {filteredProducts.map((p) => {
                const displayPrice = pricingTier === 'WHOLESALE' ? p.wholesalePrice : p.retailPrice;
                const isLowStock = p.stockOnHand <= 10;

                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="group relative bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between cursor-pointer hover:border-[#2F65F6]/50 hover:shadow-[0_10px_25px_-5px_rgba(47,101,246,0.14)] transition-all duration-200 active:scale-[0.98] select-none shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                  >
                    {/* Compact Product Thumbnail & Category Squircle */}
                    <div
                      className={`w-full h-24 rounded-xl bg-gradient-to-br ${p.imageBg} flex items-center justify-center text-2xl font-black text-slate-700/60 mb-2.5 relative overflow-hidden shadow-inner uppercase tracking-wider`}
                    >
                      <span>{p.sku.split('-')[0]}</span>

                      {/* Category Label Pill */}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-white/90 backdrop-blur-sm text-[9px] font-bold text-slate-700 shadow-sm">
                        {p.category.name}
                      </span>

                      {/* Stock on Hand (SOH) Pill */}
                      <span
                        className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold shadow-sm ${
                          isLowStock
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {p.stockOnHand} {p.unit}
                      </span>
                    </div>

                    {/* Title & SKU */}
                    <div className="min-h-[42px]">
                      <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-[#2F65F6] transition-colors">
                        {p.name}
                      </h3>
                      <div className="flex items-center justify-between mt-0.5 text-[10px]">
                        <span className="font-mono text-slate-400">{p.sku}</span>
                        <span className="font-mono text-slate-400 hidden xl:inline">
                          {p.barcode}
                        </span>
                      </div>
                    </div>

                    {/* Price Tag & Quick Touch Add Trigger */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#2F65F6] font-mono tracking-tight">
                          {formatCurrency(displayPrice)}
                        </div>
                        {pricingTier === 'WHOLESALE' && (
                          <div className="text-[9px] font-semibold text-emerald-600">
                            Wholesale Tier
                          </div>
                        )}
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#2F65F6] group-hover:text-white flex items-center justify-center transition-colors shadow-sm active:scale-90">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ========================================================== */
            /* VIEW B: COMPACT TABLE LIST VIEW (Supermarkets / Hardware)  */
            /* ========================================================== */
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">SKU / Barcode</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Category</th>
                    <th className="py-2.5 px-3 text-center">Stock (SOH)</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const displayPrice = pricingTier === 'WHOLESALE' ? p.wholesalePrice : p.retailPrice;
                    const isLowStock = p.stockOnHand <= 10;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          <div className="font-bold text-slate-800">{p.sku}</div>
                          <div className="text-[10px] text-slate-400">{p.barcode}</div>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 group-hover:text-[#2F65F6] transition-colors">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell text-slate-500 text-[11px]">
                          {p.category.name}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {p.stockOnHand} {p.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(displayPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-[#2F65F6] group-hover:text-white text-xs font-bold transition-all shadow-sm"
                          >
                            + Add
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT: STICKY COMMERCIAL SALE TICKET & SPEED TENDER (30%)     */}
      {/* ============================================================== */}
      <div className="w-full lg:w-[410px] xl:w-[430px] bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] shrink-0 h-full overflow-hidden">
        {/* Ticket Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Sale Ticket</h2>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-blue-50 text-[#2F65F6] font-mono font-bold border border-blue-100">
                  #{orderNumber}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {cart.length} item(s) • {cart.reduce((s, i) => s + i.quantity, 0)} total unit(s)
              </p>
            </div>

            {/* Suspended Orders Queue Trigger */}
            <button
              onClick={() => setIsHeldModalOpen(true)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-[#2F65F6] hover:bg-blue-50 border border-slate-200 transition-colors"
              title="View suspended orders queue"
            >
              <Layers className="w-4 h-4" />
              {heldCarts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2F65F6] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {heldCarts.length}
                </span>
              )}
            </button>
          </div>

          {/* Pricing Mode & Customer Selector Strip */}
          <div className="pt-2.5 pb-1 flex items-center justify-between gap-2">
            {/* Customer Pill */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors truncate"
              title="Change customer"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#2F65F6] shrink-0" />
              <span className="truncate">{customer.name}</span>
            </button>

            {/* Pricing Mode Toggle: Retail vs Wholesale */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setPricingTier('RETAIL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  pricingTier === 'RETAIL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Retail
              </button>
              <button
                type="button"
                onClick={() => setPricingTier('WHOLESALE')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  pricingTier === 'WHOLESALE'
                    ? 'bg-[#2F65F6] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Wholesale
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 my-1 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-3xl mb-2.5 text-slate-400 shadow-sm">
                <ShoppingBag className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-700">Sale ticket is empty</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Scan barcode or search products [F2] to start adding items
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-2xl bg-slate-50/90 border border-slate-100 flex items-center justify-between gap-2 hover:bg-slate-100/70 transition-colors"
              >
                {/* Left: Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{formatCurrency(item.price)}</span>
                    <span>•</span>
                    <span className="text-slate-400">{item.sku}</span>
                  </div>
                </div>

                {/* Right: Inline Quantity Stepper with Manual Input & Line Total */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex items-center bg-white rounded-xl border border-slate-200/90 shadow-sm p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleQuantityChange(item.id, parseInt(e.target.value, 10) || 1)
                      }
                      className="w-8 text-center text-xs font-bold text-slate-800 font-mono bg-transparent focus:outline-none"
                    />

                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <div className="text-xs font-bold text-slate-900 font-mono">
                      {formatCurrency(item.price * item.quantity)}
                    </div>
                  </div>

                  <button
                    onClick={() => removeCartItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Ticket Financial Summary & Speed Tender Bar */}
        <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
          {/* 1-Tap Quick Percentage Discount Chips */}
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Percent className="w-3 h-3" />
              Ticket Discount
            </span>
            <div className="flex items-center gap-1">
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDiscountPercent(pct)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    discountPercent === pct
                      ? 'bg-[#2F65F6] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <button
                onClick={() => {
                  const val = prompt('Enter custom discount %:', discountPercent.toString());
                  if (val !== null) {
                    const num = parseFloat(val);
                    if (!isNaN(num) && num >= 0 && num <= 100) setDiscountPercent(num);
                  }
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                  ![0, 5, 10, 15].includes(discountPercent)
                    ? 'bg-[#2F65F6] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Line items financial breakdown */}
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-medium text-slate-800">{formatCurrency(subtotal)}</span>
            </div>

            {discountPercent > 0 && (
              <div className="flex items-center justify-between text-emerald-600">
                <span>Discount ({discountPercent}%)</span>
                <span className="font-mono font-medium">-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {taxRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Sales Tax ({taxRate}%)</span>
                <span className="font-mono">{formatCurrency(taxAmount)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/90 text-slate-900 font-bold">
              <span className="text-xs">Grand Total</span>
              <span className="text-xl font-mono text-[#2F65F6] tracking-tight">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Speed Cash Presets */}
          <div className="pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setCashTendered(grandTotal);
                  setSelectedPaymentMethod('CASH');
                  setIsPaymentModalOpen(true);
                }}
                className="flex-1 py-1 px-2 rounded-lg bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                Exact Cash
              </button>
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setCashTendered(amt >= grandTotal ? amt : grandTotal);
                    setSelectedPaymentMethod('CASH');
                    setIsPaymentModalOpen(true);
                  }}
                  className="py-1 px-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-mono font-bold hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Cart Utility Bar: Hold Cart [F4] & Clear */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold [F4]</span>
            </button>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
            </button>
          </div>

          {/* Primary Action Button: PAY [F12] */}
          <button
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white font-bold text-sm tracking-wide shadow-[0_10px_25px_-5px_rgba(47,101,246,0.35)] transition-all duration-200 flex items-center justify-between disabled:opacity-50 disabled:shadow-none hover:shadow-lg active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              <span>PAY [F12]</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <span>{formatCurrency(grandTotal)}</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: RETAIL CUSTOMER SELECTOR & QUICK-ADD                  */}
      {/* ============================================================== */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#2F65F6]" />
                <span>Customer Account & Credit</span>
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Frequent Customers List */}
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {FREQUENT_CUSTOMERS.map((cust) => (
                <div
                  key={cust.id}
                  onClick={() => {
                    setCustomer(cust);
                    setIsCustomerModalOpen(false);
                  }}
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    customer.id === cust.id
                      ? 'bg-blue-50 border-[#2F65F6] text-[#2F65F6]'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold">{cust.name}</div>
                    {cust.phone && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{cust.phone}</span>
                      </div>
                    )}
                  </div>
                  {cust.creditLimit > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Credit Balance</div>
                      <div className="text-xs font-mono font-bold text-slate-800">
                        {formatCurrency(cust.creditBalance)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Add New Customer Form */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <UserPlus className="w-3.5 h-3.5 text-slate-500" />
                <span>Quick Add Walk-in Details</span>
              </div>
              <input
                type="text"
                placeholder="Customer Name..."
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2F65F6]"
              />
              <input
                type="text"
                placeholder="Phone / Mobile (e.g. +94 77 123 4567)"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2F65F6]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newCustomerName.trim()) {
                    setCustomer({
                      id: `new-${Date.now()}`,
                      name: newCustomerName.trim(),
                      phone: newCustomerPhone.trim(),
                      creditLimit: 0,
                      creditBalance: 0,
                    });
                  }
                  setIsCustomerModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-[#2F65F6] text-white text-xs font-bold hover:bg-[#1E4ED8] shadow-sm"
              >
                Apply Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: HIGH-SPEED RETAIL PAYMENT GATEWAY                     */}
      {/* ============================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Tender</h3>
                <p className="text-xs text-slate-400">
                  Ticket #{orderNumber} • Customer: {customer.name}
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="p-4 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#1D4ED8] block">Total Amount Due</span>
                <span className="text-[11px] text-blue-600">{cart.length} item(s) in ticket</span>
              </div>
              <span className="text-2xl font-black font-mono text-[#1D4ED8]">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {/* 4 Payment Methods: Cash, Card, LankaQR, Customer Credit */}
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  { id: 'CASH', name: 'Cash Tender', icon: Banknote, desc: 'Cash drawer' },
                  { id: 'CARD', name: 'Card Terminal', icon: CreditCard, desc: 'Visa / Mastercard' },
                  { id: 'QR', name: 'LankaQR', icon: QrCode, desc: 'Mobile banking' },
                  { id: 'CREDIT', name: 'Customer Credit', icon: Wallet, desc: 'Store account ledger' },
                ] as const
              ).map((m) => {
                const isSelected = selectedPaymentMethod === m.id;
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedPaymentMethod(m.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#2F65F6] bg-[#EFF6FF]/70 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#2F65F6] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If Cash Selected: Quick Cash Calculator */}
            {selectedPaymentMethod === 'CASH' && (
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Cash Tendered ({currency})
                    </label>
                    <button
                      type="button"
                      onClick={() => setCashTendered(grandTotal)}
                      className="text-[11px] font-bold text-[#2F65F6] hover:underline"
                    >
                      Exact Amount
                    </button>
                  </div>
                  <input
                    type="number"
                    step="50"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#2F65F6]"
                  />
                </div>

                {/* Quick Add Denominations Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered((prev) => (prev || 0) + amt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-200 active:scale-95"
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashTendered(grandTotal)}
                    className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-semibold text-[#1D4ED8]"
                  >
                    Exact
                  </button>
                </div>

                {/* Change or Remaining Due Card */}
                {cashTendered >= grandTotal ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-emerald-800">Change Due to Customer</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {formatCurrency(changeDue)}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-800">Remaining Balance Due</span>
                    <span className="font-mono font-bold text-amber-700 text-sm">
                      {formatCurrency(remainingDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* If Card Selected */}
            {selectedPaymentMethod === 'CARD' && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <CreditCard className="w-10 h-10 text-[#2F65F6] mx-auto animate-pulse" />
                <p className="text-xs font-bold text-slate-800">Awaiting Card on POS Terminal</p>
                <p className="text-[11px] text-slate-400">
                  Customer should tap, insert, or swipe card on the connected EFTPOS reader.
                </p>
              </div>
            )}

            {/* If LankaQR Selected */}
            {selectedPaymentMethod === 'QR' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-2">
                <div className="w-32 h-32 bg-white rounded-xl border border-slate-300 p-2 flex items-center justify-center shadow-sm">
                  <QrCode className="w-24 h-24 text-slate-800" />
                </div>
                <p className="text-[11px] font-mono text-slate-600 font-bold">EMVCo LankaQR</p>
                <p className="text-[10px] text-slate-400">
                  Scan via any banking app (Commercial, Sampath, BOC, FriMi)
                </p>
              </div>
            )}

            {/* If Customer Credit Selected */}
            {selectedPaymentMethod === 'CREDIT' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                <Wallet className="w-8 h-8 text-[#2F65F6] mx-auto" />
                <p className="text-xs font-bold text-slate-800">Post to Customer Credit Ledger</p>
                <p className="text-[11px] text-slate-500">
                  Customer: <span className="font-bold text-slate-800">{customer.name}</span>
                </p>
                {customer.creditLimit > 0 && (
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    Available Credit Limit: {formatCurrency(customer.creditLimit - customer.creditBalance)}
                  </p>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isSubmittingPayment}
                className="px-6 py-2.5 rounded-xl bg-[#2F65F6] text-white text-xs font-bold hover:bg-[#1E4ED8] shadow-[0_4px_12px_rgba(47,101,246,0.3)] flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Sale...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Sale & Print Bill ({formatCurrency(grandTotal)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: HARDWARE-AGNOSTIC THERMAL & A4 RECEIPT MODAL          */}
      {/* ============================================================== */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onNewSale={handleNewSale}
        saleId={completedSale?.id}
        initialSale={
          completedSale || {
            id: 'draft-id',
            tenantId: '',
            branchId: selectedBranchId || branches[0]?.id || '',
            cashierId: user?.id || '',
            invoiceNumber: `INV-${orderNumber}`,
            orderType: 'RETAIL_WALKIN',
            status: 'COMPLETED',
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount: grandTotal,
            paidAmount: selectedPaymentMethod === 'CASH' ? cashTendered : grandTotal,
            changeDue,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: cart.map((i) => ({
              id: i.id,
              saleId: 'draft-id',
              productName: i.name,
              sku: i.sku,
              unitPrice: i.price,
              quantity: i.quantity,
              discountAmount: 0,
              taxAmount: 0,
              subtotal: i.price * i.quantity,
              notes: i.note,
            })),
            payments: [
              {
                id: 'pay-draft',
                saleId: 'draft-id',
                paymentMethod:
                  selectedPaymentMethod === 'QR'
                    ? 'QR_PAYMENT'
                    : selectedPaymentMethod === 'CREDIT'
                      ? 'STORE_CREDIT'
                      : selectedPaymentMethod,
                amount: selectedPaymentMethod === 'CASH' ? cashTendered : grandTotal,
                status: 'SUCCESS',
                createdAt: new Date().toISOString(),
              },
            ],
            customerName: customer.name,
          }
        }
        currency={currency}
      />

      {/* ============================================================== */}
      {/* MODAL 4: HELD TICKETS QUEUE DRAWER                             */}
      {/* ============================================================== */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                  <PauseCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Suspended Retail Tickets</h3>
                  <p className="text-xs text-slate-400">
                    {heldCarts.length} ticket(s) temporarily placed on hold
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHeldModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {isLoadingHeld ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading suspended tickets...
                </div>
              ) : heldCarts.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <Layers className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No suspended tickets</p>
                  <p className="text-[11px] text-slate-400">
                    Press &quot;Hold [F4]&quot; on the sale ticket to suspend orders
                  </p>
                </div>
              ) : (
                heldCarts.map((hc) => {
                  const data = hc.cartData as {
                    items?: unknown[];
                    customerName?: string;
                  };
                  const itemCount = data?.items?.length || 0;
                  return (
                    <div
                      key={hc.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{hc.cartReference}</span>
                          {data?.customerName && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              {data.customerName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(hc.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span>•</span>
                          <span>{itemCount} item(s)</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleResumeCart(hc)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-sm transition-all shrink-0"
                      >
                        Resume Ticket
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                onClick={() => setIsHeldModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
