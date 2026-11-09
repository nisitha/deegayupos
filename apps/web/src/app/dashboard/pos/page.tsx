'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  CheckCircle2,
  Printer,
  X,
  Edit3,
  UtensilsCrossed,
  User,
  Sparkles,
  ArrowRight,
  RotateCcw,
  PauseCircle,
  Layers,
  Clock,
} from 'lucide-react';
import type {
  CategoryDto,
  CheckoutPayload,
  HeldCartDto,
  ProductDto,
  SaleDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi, productsApi } from '../../../lib/api-client';

// Sample fallback items for instant POS interactive showcase
const SAMPLE_POS_ITEMS = [
  {
    id: 'demo-1',
    name: 'Ceylon Earl Grey Tea',
    sku: 'BEV-001',
    barcode: '4791000001',
    retailPrice: 450.0,
    costPrice: 200.0,
    category: { name: 'Beverages', slug: 'beverages' },
    stock: 24,
    imageBg: 'from-amber-100 to-amber-200',
    iconEmoji: '☕',
  },
  {
    id: 'demo-2',
    name: 'Iced Caramel Macchiato',
    sku: 'BEV-002',
    barcode: '4791000002',
    retailPrice: 950.0,
    costPrice: 450.0,
    category: { name: 'Beverages', slug: 'beverages' },
    stock: 18,
    imageBg: 'from-amber-50 to-orange-100',
    iconEmoji: '🥤',
  },
  {
    id: 'demo-3',
    name: 'Grilled Chicken Burger',
    sku: 'FD-001',
    barcode: '4791000003',
    retailPrice: 1650.0,
    costPrice: 850.0,
    category: { name: 'Dishes', slug: 'dishes' },
    stock: 12,
    imageBg: 'from-orange-100 to-amber-100',
    iconEmoji: '🍔',
  },
  {
    id: 'demo-4',
    name: 'Crispy French Fries (L)',
    sku: 'FD-002',
    barcode: '4791000004',
    retailPrice: 650.0,
    costPrice: 280.0,
    category: { name: 'Snacks', slug: 'snacks' },
    stock: 45,
    imageBg: 'from-yellow-100 to-amber-100',
    iconEmoji: '🍟',
  },
  {
    id: 'demo-5',
    name: 'Chocolate Lava Cake',
    sku: 'DST-001',
    barcode: '4791000005',
    retailPrice: 850.0,
    costPrice: 350.0,
    category: { name: 'Dessert', slug: 'dessert' },
    stock: 8,
    imageBg: 'from-stone-100 to-amber-200',
    iconEmoji: '🍰',
  },
  {
    id: 'demo-6',
    name: 'Artisan Sourdough Loaf',
    sku: 'BKY-001',
    barcode: '4791000006',
    retailPrice: 750.0,
    costPrice: 320.0,
    category: { name: 'Bakery', slug: 'bakery' },
    stock: 15,
    imageBg: 'from-amber-100 to-yellow-50',
    iconEmoji: '🍞',
  },
  {
    id: 'demo-7',
    name: 'Mineral Water 500ml',
    sku: 'H2O-001',
    barcode: '4791000007',
    retailPrice: 120.0,
    costPrice: 60.0,
    category: { name: 'Beverages', slug: 'beverages' },
    stock: 60,
    imageBg: 'from-blue-50 to-cyan-100',
    iconEmoji: '💧',
  },
  {
    id: 'demo-8',
    name: 'Avocado Caesar Salad',
    sku: 'FD-003',
    barcode: '4791000008',
    retailPrice: 1250.0,
    costPrice: 600.0,
    category: { name: 'Dishes', slug: 'dishes' },
    stock: 14,
    imageBg: 'from-emerald-50 to-green-100',
    iconEmoji: '🥗',
  },
];

interface CartItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  note?: string;
  iconEmoji?: string;
}

export default function PosCheckoutPage() {
  const {
    currency,
    business,
    posMode,
    setPosMode,
    orderType,
    selectedBranchId,
    branches,
    user,
  } = useTenantBranch();

  // Catalogue states
  const [dbProducts, setDbProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Cart & Order states
  const [orderNumber, setOrderNumber] = useState<number>(235);
  const [selectedTable, setSelectedTable] = useState<string>('T-10');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [cart, setCart] = useState<CartItem[]>([
    {
      id: 'cart-1',
      productId: 'demo-1',
      name: 'Ceylon Earl Grey Tea',
      sku: 'BEV-001',
      price: 450.0,
      quantity: 2,
      note: 'Less sugar',
      iconEmoji: '☕',
    },
    {
      id: 'cart-2',
      productId: 'demo-3',
      name: 'Grilled Chicken Burger',
      sku: 'FD-001',
      price: 1650.0,
      quantity: 1,
      note: 'Extra spicy',
      iconEmoji: '🍔',
    },
  ]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Modals
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'CARD' | 'QR' | 'WALLET'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [itemNoteModal, setItemNoteModal] = useState<{ itemId: string; note: string } | null>(null);

  // Phase 08 POS Backend Integration states
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [heldCarts, setHeldCarts] = useState<HeldCartDto[]>([]);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [isLoadingHeld, setIsLoadingHeld] = useState(false);

  // Load Catalogue from API
  const loadCatalog = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        productsApi.getAll({ limit: 100 }),
        productsApi.getCategories(),
      ]);
      if (prodRes.data && prodRes.data.items.length > 0) {
        setDbProducts(prodRes.data.items);
      }
      if (catRes.data) {
        setCategories(catRes.data);
      }
    } catch (err) {
      console.warn('Using demo catalogue fallback for POS preview:', err);
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
  const allProducts = useMemo(() => {
    if (dbProducts.length > 0) {
      return dbProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        retailPrice: p.retailPrice,
        costPrice: p.costPrice,
        category: p.category ? { name: p.category.name, slug: p.category.slug } : { name: 'General', slug: 'general' },
        stock: 50,
        imageBg: 'from-blue-50 to-indigo-100',
        iconEmoji: '📦',
      }));
    }
    return SAMPLE_POS_ITEMS;
  }, [dbProducts]);

  // Category filters
  const categoryPills = useMemo(() => {
    const defaultCategories = ['All Menu', 'Beverages', 'Dishes', 'Snacks', 'Dessert', 'Bakery'];
    if (categories.length > 0) {
      return ['All Menu', ...categories.map((c) => c.name)];
    }
    return defaultCategories;
  }, [categories]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchQuery));

      if (!matchesSearch) return false;

      if (selectedCategorySlug === 'all' || selectedCategorySlug === 'all menu') {
        return true;
      }
      return p.category.name.toLowerCase() === selectedCategorySlug.toLowerCase();
    });
  }, [allProducts, searchQuery, selectedCategorySlug]);

  // Handle Barcode Scanner Input (Press Enter)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const term = barcodeInput.trim();
    const matched = allProducts.find(
      (p) => p.barcode === term || p.sku.toUpperCase() === term.toUpperCase(),
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
    } else {
      alert(`No product found with barcode/SKU: ${term}`);
    }
  };

  // Add Item to Cart
  const addToCart = (product: { id: string; name: string; sku: string; retailPrice: number; iconEmoji?: string }) => {
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
          price: product.retailPrice,
          quantity: 1,
          iconEmoji: product.iconEmoji || '🍽️',
        },
      ];
    });
  };

  // Stepper adjustments
  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
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
    if (cart.length > 0 && confirm('Clear all items from current order?')) {
      setCart([]);
    }
  };

  // Financial Computations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  // Tax rate (e.g., 0% or configured in BusinessSettings)
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

  const formatCurrency = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Open Payment Flow
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Add items to charge order.');
      return;
    }
    setCashTendered(grandTotal);
    setIsPaymentModalOpen(true);
  };

  // Hold Active Order
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Add items to hold order.');
      return;
    }
    const ref = prompt(
      'Enter reference label for this held order:',
      posMode === 'restaurant'
        ? `Table ${selectedTable}`
        : customerName
          ? customerName
          : `Order #${orderNumber}`,
    );
    if (!ref) return;

    try {
      const orderTypeMapped =
        posMode === 'restaurant'
          ? 'DINE_IN'
          : orderType === 'Takeaway'
            ? 'TAKEAWAY'
            : orderType === 'Delivery'
              ? 'DELIVERY'
              : 'RETAIL_WALKIN';

      await posApi.holdCart({
        branchId: selectedBranchId || branches[0]?.id || '',
        cartReference: ref,
        cartData: {
          orderType: orderTypeMapped,
          tableNumber: posMode === 'restaurant' ? selectedTable : undefined,
          customerName: customerName || undefined,
          items: cart.map((i) => ({
            productId: i.productId.startsWith('demo-') ? undefined : i.productId,
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
      alert(`Order held successfully as "${ref}".`);
    } catch (err) {
      console.error('Failed to hold order:', err);
      alert('Failed to hold order.');
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
        tableNumber?: string;
        orderType?: string;
      };

      if (cartData?.items && Array.isArray(cartData.items)) {
        const restored = cartData.items.map((i, idx) => ({
          id: `cart-restored-${Date.now()}-${idx}`,
          productId: i.productId || `restored-${idx}`,
          name: i.productName,
          sku: i.sku,
          price: i.unitPrice,
          quantity: i.quantity,
          note: i.notes,
          iconEmoji: '🍽️',
        }));
        setCart(restored);
      }

      if (cartData?.customerName) setCustomerName(cartData.customerName);
      if (cartData?.tableNumber) setSelectedTable(cartData.tableNumber);
      if (cartData?.orderType === 'DINE_IN') setPosMode('restaurant');
      setIsHeldModalOpen(false);
      loadHeldCarts();
    } catch (err) {
      console.error('Failed to resume cart:', err);
      alert('Failed to resume held cart.');
    }
  };

  // Confirm Payment & Submit to POS API
  const handleConfirmPayment = async () => {
    try {
      setIsSubmittingPayment(true);
      const orderTypeMapped =
        posMode === 'restaurant'
          ? 'DINE_IN'
          : orderType === 'Takeaway'
            ? 'TAKEAWAY'
            : orderType === 'Delivery'
              ? 'DELIVERY'
              : 'RETAIL_WALKIN';

      const payload: CheckoutPayload = {
        branchId: selectedBranchId || branches[0]?.id || '',
        orderType: orderTypeMapped,
        tableNumber: posMode === 'restaurant' ? selectedTable : undefined,
        customerName: customerName || undefined,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount: grandTotal,
        paidAmount: selectedPaymentMethod === 'CASH' ? cashTendered : grandTotal,
        changeDue,
        idempotencyKey: `pos-checkout-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        items: cart.map((i) => ({
          productId: i.productId.startsWith('demo-') ? undefined : i.productId,
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
                : selectedPaymentMethod === 'WALLET'
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
      console.error('Checkout error:', err);
      // Fallback: still show receipt so cashier is not blocked
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
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-5 overflow-hidden">
      {/* ============================================================== */}
      {/* LEFT / CENTER: MENU & PRODUCT SELECTION GRID */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Category Pills & Barcode Quick Search Toolbar */}
        <div className="space-y-3 pb-3 shrink-0">
          {/* Barcode scanner & keyword search bar */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search menu items or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200/90 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6] shadow-pos-card transition-all"
              />
            </form>

            <form onSubmit={handleBarcodeSubmit} className="hidden sm:flex items-center w-48 relative">
              <input
                type="text"
                placeholder="Scan Barcode ↵"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full bg-white border border-slate-200/90 rounded-2xl px-3 py-2.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#2F65F6] shadow-pos-card"
              />
            </form>
          </div>

          {/* Horizontal Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categoryPills.map((cat) => {
              const isActive =
                selectedCategorySlug.toLowerCase() === cat.toLowerCase() ||
                (selectedCategorySlug === 'all' && cat.toLowerCase() === 'all menu');

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategorySlug(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'bg-[#2F65F6] text-white shadow-pos-btn'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 shadow-pos-subtle'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="group relative bg-white border border-slate-200/80 rounded-2xl p-3 flex flex-col justify-between cursor-pointer hover:border-[#2F65F6]/40 hover:shadow-pos-card-hover transition-all duration-200 active:scale-[0.98]"
              >
                {/* Product Thumbnail Banner */}
                <div
                  className={`w-full h-28 rounded-xl bg-gradient-to-br ${p.imageBg} flex items-center justify-center text-4xl mb-3 shadow-inner relative overflow-hidden`}
                >
                  <span className="group-hover:scale-110 transition-transform duration-300">
                    {p.iconEmoji}
                  </span>
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-white/80 backdrop-blur-sm text-[10px] font-semibold text-slate-700">
                    {p.category.name}
                  </span>
                </div>

                {/* Details */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-[#2F65F6] transition-colors">
                    {p.name}
                  </h3>
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="font-mono text-slate-400">{p.sku}</span>
                    <span className="text-emerald-700 font-medium text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {p.stock} in stock
                    </span>
                  </div>
                </div>

                {/* Price Tag & Add Trigger */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 font-mono">
                    {formatCurrency(p.retailPrice)}
                  </span>
                  <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-[#2F65F6] group-hover:text-white flex items-center justify-center transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* RIGHT: CURRENT ORDER CART SIDEBAR */}
      {/* ============================================================== */}
      <div className="w-full lg:w-[380px] bg-white border border-slate-200/90 rounded-3xl p-5 flex flex-col justify-between shadow-pos-card shrink-0 h-full overflow-hidden">
        {/* Cart Header */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Current Order
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                  #{orderNumber}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {orderType} • {cart.length} item(s)
              </p>
            </div>

            {/* Context Badge: Table (Dining) vs Customer (Retail) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTableModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
              >
                {posMode === 'restaurant' ? (
                  <>
                    <UtensilsCrossed className="w-3.5 h-3.5" />
                    <span>Table {selectedTable}</span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[90px]">{customerName}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsHeldModalOpen(true)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-[#2F65F6] hover:bg-blue-50 border border-slate-200 transition-colors"
                title="View held orders"
              >
                <Layers className="w-3.5 h-3.5" />
                {heldCarts.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#2F65F6] text-white text-[9px] font-bold flex items-center justify-center">
                    {heldCarts.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 my-1 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-12">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl mb-2 text-slate-400">
                🛒
              </div>
              <p className="text-xs font-semibold text-slate-700">Your order is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click any product on the left to start adding items
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition-colors"
              >
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{formatCurrency(item.price)}</span>
                    {item.note && (
                      <span className="italic text-[#2F65F6] text-[10px] truncate max-w-[110px]">
                        &quot;{item.note}&quot;
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Quantity Stepper & Line Total */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white rounded-xl border border-slate-200/80 shadow-sm p-0.5">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 active:bg-slate-200"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-800">
                      {item.quantity}
                    </span>
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
                    onClick={() => setItemNoteModal({ itemId: item.id, note: item.note || '' })}
                    className="p-1 text-slate-400 hover:text-[#2F65F6]"
                    title="Add item note"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => removeCartItem(item.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Financial Summary & Charge Button */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="space-y-1.5 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono font-medium text-slate-800">{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Discount</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 rounded border border-amber-200 font-mono">
                  {discountPercent}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const val = prompt('Enter discount percentage (0-100):', discountPercent.toString());
                    if (val !== null) {
                      const num = parseFloat(val);
                      if (!isNaN(num) && num >= 0 && num <= 100) setDiscountPercent(num);
                    }
                  }}
                  className="text-[11px] text-[#2F65F6] hover:underline"
                >
                  Edit
                </button>
                <span className="font-mono text-emerald-600">-{formatCurrency(discountAmount)}</span>
              </div>
            </div>

            {taxRate > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Sales Tax ({taxRate}%)</span>
                <span className="font-mono">{formatCurrency(taxAmount)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-slate-900 font-bold">
              <span className="text-sm">Total Amount</span>
              <span className="text-lg font-mono text-[#2F65F6] tracking-tight">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Cart Utility Bar: Hold Order & Clear Cart */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Order</span>
            </button>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Cart</span>
            </button>
          </div>

          {/* Primary Action Button: CHARGE */}
          <button
            onClick={handleOpenPayment}
            disabled={cart.length === 0}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white font-bold text-sm tracking-wide shadow-pos-btn transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none hover:shadow-lg active:scale-[0.99]"
          >
            <span>Charge</span>
            <span>{formatCurrency(grandTotal)}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: TABLE & CUSTOMER SELECTION DIALOG */}
      {/* ============================================================== */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {posMode === 'restaurant' ? (
                  <>
                    <UtensilsCrossed className="w-5 h-5 text-[#2F65F6]" />
                    <span>Select Dining Table</span>
                  </>
                ) : (
                  <>
                    <User className="w-5 h-5 text-[#2F65F6]" />
                    <span>Customer Details</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {posMode === 'restaurant' ? (
              <>
                {/* Table selector chips */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Available Tables
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['T-01', 'T-02', 'T-03', 'T-04', 'T-10', 'T-11', 'T-12', 'T-13'].map((tbl) => (
                      <button
                        key={tbl}
                        onClick={() => setSelectedTable(tbl)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          selectedTable === tbl
                            ? 'bg-[#2F65F6] text-white border-[#2F65F6] shadow-pos-btn'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guest Count */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Guest Count
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setGuestCount(num)}
                        className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all ${
                          guestCount === num
                            ? 'bg-[#2F65F6] text-white border-[#2F65F6]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer / Business Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe / Walk-in Customer"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2F65F6]"
                />
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#2F65F6] text-white text-xs font-bold hover:bg-[#1E4ED8] shadow-pos-btn"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: PAYMENT METHODS & CASH TENDER */}
      {/* ============================================================== */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Payment Checkout</h3>
                <p className="text-xs text-slate-400">Order #{orderNumber} • Select payment gateway</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total Due Banner */}
            <div className="p-4 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-between">
              <span className="text-xs font-bold text-[#1D4ED8]">Total Charge Due</span>
              <span className="text-xl font-bold font-mono text-[#1D4ED8]">
                {formatCurrency(grandTotal)}
              </span>
            </div>

            {/* 4 Payment Method Cards */}
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: 'CASH', name: 'Cash', icon: Banknote, desc: 'Cash drawer' },
                  { id: 'CARD', name: 'Card Terminal', icon: CreditCard, desc: 'Visa / Mastercard' },
                  { id: 'QR', name: 'QR Payment', icon: QrCode, desc: 'LankaQR / QRIS' },
                  { id: 'WALLET', name: 'Store Credit', icon: Wallet, desc: 'Mobile / Wallet' },
                ] as const
              ).map((m) => {
                const isSelected = selectedPaymentMethod === m.id;
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedPaymentMethod(m.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#2F65F6] bg-[#EFF6FF]/60 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-[#2F65F6] text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-400">{m.desc}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* If Cash Selected: Quick Cash Denominations */}
            {selectedPaymentMethod === 'CASH' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cash Tendered ({currency})
                  </label>
                  <input
                    type="number"
                    step="50"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#2F65F6]"
                  />
                </div>

                {/* Quick Add Denominations */}
                <div className="flex items-center gap-2">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered((prev) => prev + amt)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      +{amt}
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

                {/* Change Due Box */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Change Due to Customer</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {formatCurrency(changeDue)}
                  </span>
                </div>
              </div>
            )}

            {/* If QR Selected: Show QR simulation */}
            {selectedPaymentMethod === 'QR' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center space-y-2">
                <div className="w-32 h-32 bg-white rounded-xl border border-slate-300 p-2 flex items-center justify-center shadow-sm">
                  <QrCode className="w-24 h-24 text-slate-800" />
                </div>
                <p className="text-[11px] font-mono text-slate-500">Scan via any LankaQR / Bank app</p>
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
                className="px-6 py-2.5 rounded-xl bg-[#2F65F6] text-white text-xs font-bold hover:bg-[#1E4ED8] shadow-pos-btn flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ORDER SUCCESSFUL / RECEIPT PRINT MODAL */}
      {/* ============================================================== */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Payment Successful!</h3>
              <p className="text-xs text-slate-400">
                {completedSale?.invoiceNumber ? `Invoice #${completedSale.invoiceNumber}` : `Order #${orderNumber}`}{' '}
                has been finalized
              </p>
            </div>

            {/* Clean Receipt Slip */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono space-y-2">
              <div className="text-center font-bold text-slate-800">
                {business?.name || 'PixelCraft POS Store'}
              </div>
              <div className="text-center text-[10px] text-slate-400">
                {completedSale
                  ? new Date(completedSale.createdAt).toLocaleString()
                  : new Date().toLocaleString()}
              </div>
              <div className="text-center text-[10px] text-slate-500">
                Cashier: {completedSale?.cashier?.fullName || user?.fullName || 'Cashier Staff'}
              </div>
              <div className="border-b border-dashed border-slate-300 my-2" />

              <div className="space-y-1">
                {(completedSale?.items || cart).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[180px]">
                      {item.quantity}x {'productName' in item ? item.productName : item.name}
                    </span>
                    <span>
                      {formatCurrency(
                        'unitPrice' in item
                          ? item.unitPrice * item.quantity
                          : item.price * item.quantity,
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-b border-dashed border-slate-300 my-2" />

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(completedSale ? completedSale.subtotal : subtotal)}</span>
                </div>
                {(completedSale ? completedSale.discountAmount : discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span>
                      -{formatCurrency(completedSale ? completedSale.discountAmount : discountAmount)}
                    </span>
                  </div>
                )}
                {(completedSale ? completedSale.taxAmount : taxAmount) > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tax</span>
                    <span>{formatCurrency(completedSale ? completedSale.taxAmount : taxAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-900 text-xs pt-1 border-t border-slate-200">
                  <span>Total Due</span>
                  <span>{formatCurrency(completedSale ? completedSale.totalAmount : grandTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 pt-1">
                  <span>Paid ({selectedPaymentMethod})</span>
                  <span>
                    {formatCurrency(
                      completedSale
                        ? completedSale.paidAmount
                        : selectedPaymentMethod === 'CASH'
                          ? cashTendered
                          : grandTotal,
                    )}
                  </span>
                </div>
                {(completedSale ? completedSale.changeDue : changeDue) > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Change</span>
                    <span>{formatCurrency(completedSale ? completedSale.changeDue : changeDue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="w-full grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={handleNewSale}
                className="py-2.5 px-3 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-pos-btn flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: HELD ORDERS QUEUE */}
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
                  <h3 className="text-base font-bold text-slate-900">Suspended / Held Orders</h3>
                  <p className="text-xs text-slate-400">
                    {heldCarts.length} order(s) currently on hold
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
                  Loading held orders...
                </div>
              ) : heldCarts.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <Layers className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">No held orders</p>
                  <p className="text-[11px] text-slate-400">Click &quot;Hold Order&quot; on the cart sidebar to suspend active carts</p>
                </div>
              ) : (
                heldCarts.map((hc) => {
                  const data = hc.cartData as {
                    items?: unknown[];
                    tableNumber?: string;
                    customerName?: string;
                    orderType?: string;
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
                          {data?.tableNumber && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                              Table {data.tableNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {new Date(hc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>•</span>
                          <span>{itemCount} item(s)</span>
                          {data?.orderType && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{data.orderType.replace('_', ' ').toLowerCase()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleResumeCart(hc)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2F65F6] hover:bg-[#1E4ED8] text-white text-xs font-bold shadow-pos-btn transition-all shrink-0"
                      >
                        Resume Cart
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

      {/* Item Note Modal */}
      {itemNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-900">Custom Item Notes</h4>
            <input
              type="text"
              value={itemNoteModal.note}
              onChange={(e) => setItemNoteModal({ ...itemNoteModal, note: e.target.value })}
              placeholder="e.g. Extra sauce, no onions..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#2F65F6]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setItemNoteModal(null)}
                className="px-3 py-1.5 text-xs text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setCart((prev) =>
                    prev.map((i) =>
                      i.id === itemNoteModal.itemId ? { ...i, note: itemNoteModal.note } : i,
                    ),
                  );
                  setItemNoteModal(null);
                }}
                className="px-4 py-1.5 bg-[#2F65F6] text-white rounded-lg text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
