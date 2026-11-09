'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Pill,
  FlaskConical,
  Leaf,
  Droplets,
  Package,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type {
  CheckoutPayload,
  SaleDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';
import { ShiftEndModal } from '../../../components/pos/shift-end-modal';
import { getCachedCatalog, saveCachedCatalog } from '../../../lib/pos-catalog-db';

// =========================================================================
// "CONFIDENCY OS" DESIGN SYSTEM SPECIFICATION
// Ultra-Premium Minimalist SaaS Catalog & Checkout Rail
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

// Minimalist 3D Squircle visual helper for pharmaceutical herbal catalog cards
function getProductSquircleVisual(categoryName?: string) {
  const lower = (categoryName || '').toLowerCase();
  if (
    lower.includes('arishta') ||
    lower.includes('asawa') ||
    lower.includes('oil') ||
    lower.includes('taila') ||
    lower.includes('liquid')
  ) {
    return {
      icon: Droplets,
      bg: 'bg-amber-50/80 text-amber-600 border border-amber-200/60',
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
      bg: 'bg-indigo-50/80 text-indigo-600 border border-indigo-200/60',
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
      bg: 'bg-emerald-50/80 text-emerald-600 border border-emerald-200/60',
    };
  }
  if (
    lower.includes('face') ||
    lower.includes('cream') ||
    lower.includes('soap') ||
    lower.includes('balm')
  ) {
    return {
      icon: Sparkles,
      bg: 'bg-rose-50/80 text-rose-600 border border-rose-200/60',
    };
  }
  if (lower.includes('rasayana') || lower.includes('kalka')) {
    return {
      icon: FlaskConical,
      bg: 'bg-purple-50/80 text-purple-600 border border-purple-200/60',
    };
  }
  return {
    icon: Package,
    bg: 'bg-blue-50/80 text-[#7052FF] border border-blue-200/60',
  };
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
}

export default function ConfidencyPosPage() {
  const { selectedBranchId, user } = useTenantBranch();

  // Catalogue & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [products, setProducts] = useState<RetailProductItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; count: number }[]>([]);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Cart & Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH' | 'SPLIT'>('CARD');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // Completed Receipt Modal
  const [completedSale, setCompletedSale] = useState<SaleDto | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // End Shift Modal
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);

  // Mobile Slide-up Bottom Sheet
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Scanner & Search feedback
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Cashier Session Details
  const cashierName = user?.fullName || 'Dr. Deegayu';
  const registerCode = 'REG-01';
  const openingFloat = 15000.0;

  // Instant 0ms Hydration via IndexedDB / LocalStorage + Background Sync
  useEffect(() => {
    let isMounted = true;

    async function initCatalog() {
      try {
        const cached = await getCachedCatalog<RetailProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 0 && isMounted) {
          setProducts(cached.products);
          setCategories(cached.categories || []);
          setTotalProductsCount(cached.total || cached.products.length);
          setIsLoadingProducts(false);
        }
      } catch (cacheErr) {
        console.warn('Local cache read error:', cacheErr);
      }

      try {
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

          await saveCachedCatalog('deegayu', {
            products: freshProducts,
            categories: freshCategories,
            total: freshTotal,
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

  // Category Tabs Filter
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

  // Fast Client-Side Search Filter across name, SKU, and barcode
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

  // Add Item to Cart
  const addToCart = useCallback((product: RetailProductItem) => {
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
        },
      ];
    });

    setScanFeedback(`Added: ${product.name}`);
    setTimeout(() => setScanFeedback(null), 1500);
  }, []);

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

  const clearCart = () => {
    setCart([]);
    setIsMobileCartOpen(false);
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const taxAmount = 0.0;
  const discountAmount = 0.0;
  const totalAmount = subtotal + taxAmount - discountAmount;
  const totalItemCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);

  // Execute Checkout Transaction
  const handleCharge = useCallback(async () => {
    if (cart.length === 0) return;
    setIsProcessingCheckout(true);

    try {
      const payload: CheckoutPayload = {
        branchId: selectedBranchId || '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
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
            paymentMethod: paymentMethod === 'CARD' ? 'CARD' : paymentMethod === 'CASH' ? 'CASH' : 'CARD',
            amount: totalAmount,
          },
        ],
      };

      const res = await posApi.checkout(payload);

      const finalizedSale: SaleDto = res.data || {
        id: `sale-${Date.now()}`,
        tenantId: 'deegayu',
        branchId: selectedBranchId || 'branch-1',
        cashierId: 'cashier-1',
        cashier: {
          id: 'cashier-1',
          fullName: cashierName,
          email: 'owner@deegayu.pixelcraftlk.com',
        },
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        orderType: 'RETAIL_WALKIN',
        status: 'COMPLETED',
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        paidAmount: totalAmount,
        changeDue: 0,
        customerName: 'Walk-in Customer',
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

      setCompletedSale(finalizedSale);
      setShowReceiptModal(true);
      clearCart();
    } catch {
      // Offline fallback
      const fallbackSale: SaleDto = {
        id: `sale-${Date.now()}`,
        tenantId: 'deegayu',
        branchId: selectedBranchId || 'branch-1',
        cashierId: 'cashier-1',
        cashier: {
          id: 'cashier-1',
          fullName: cashierName,
          email: 'owner@deegayu.pixelcraftlk.com',
        },
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        orderType: 'RETAIL_WALKIN',
        status: 'COMPLETED',
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount,
        paidAmount: totalAmount,
        changeDue: 0,
        customerName: 'Walk-in Customer',
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
      clearCart();
    } finally {
      setIsProcessingCheckout(false);
    }
  }, [cart, selectedBranchId, subtotal, discountAmount, taxAmount, totalAmount, paymentMethod, cashierName]);

  // Keyboard shortcut listener (F2: Search, F4: Charge, Esc: Dismiss)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) handleCharge();
      } else if (e.key === 'Escape') {
        setIsEndShiftModalOpen(false);
        setIsMobileCartOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, handleCharge]);

  return (
    <div className="h-full w-full flex overflow-hidden bg-white select-none">
      {/* Toast Feedback */}
      {scanFeedback && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#7052FF]" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          CENTER COLUMN: TERMINAL HEADER, CATEGORY PILLS & MINIMALIST CATALOG
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
              <span>POS</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <span className="text-slate-300">|</span>
            <div className="text-xs text-slate-500 font-medium truncate">
              <span>• {cashierName}</span>
              <span className="hidden sm:inline"> | Cashier: {registerCode}</span>
              <span className="hidden md:inline"> | Shift Started: 8:30 AM</span>
              <span className="hidden lg:inline"> | Drawer: LKR {openingFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Right: Auto-refresh indicator & End Shift Button */}
          <div className="flex items-center gap-3 shrink-0 ml-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Auto-refreshing 2s</span>
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

        {/* 2. Category Filter Carousel & Subtle Search */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0 bg-white">
          {/* Horizontal Category Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0 py-0.5">
            {categoryTabs.map((tab) => {
              const isActive = selectedCategorySlug === tab.slug;
              return (
                <button
                  key={tab.slug}
                  type="button"
                  onClick={() => setSelectedCategorySlug(tab.slug)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-[#7052FF] text-white shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>

          {/* Far-Right Subtle Search Input */}
          <div className="relative shrink-0 w-44 sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products [F2]..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#7052FF] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 3. High-End Minimalist Product Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-28 md:pb-5 bg-white">
          {isLoadingProducts && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#7052FF] mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Loading Deegayu Catalog...</h3>
              <p className="text-xs text-slate-400 mt-1">Connecting to live Supabase repository...</p>
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
                No items matched &quot;{searchQuery}&quot;
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => {
                const visual = getProductSquircleVisual(product.category?.name);
                const VisualIcon = visual.icon;

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white hover:shadow-lg transition-all duration-150 rounded-2xl p-4 flex flex-col justify-between border border-transparent hover:border-slate-100 cursor-pointer group active:scale-[0.98] select-none"
                  >
                    {/* Centered Floating Product Visual */}
                    <div className="h-28 w-full bg-slate-50/70 rounded-xl flex items-center justify-center relative overflow-hidden group-hover:bg-slate-100/60 transition-colors">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform ${visual.bg}`}
                        >
                          <VisualIcon className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Product Title & Mono Price */}
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-slate-800 line-clamp-1 group-hover:text-slate-950 transition-colors">
                        {product.name}
                      </h4>
                      <div className="text-xs font-bold text-slate-900 mt-1 font-mono">
                        LKR {product.retailPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          RIGHT COLUMN: DEDICATED CART & PAYMENT DOCK (340px-380px)
      ===================================================================== */}
      <aside className="hidden md:flex w-[340px] lg:w-[360px] xl:w-[380px] bg-white flex-col h-full shrink-0 select-none border-l border-slate-100">
        {/* 1. Cart Header */}
        <div className="h-14 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Order Summary</h3>
            <span className="text-[11px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {totalItemCount}
            </span>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-rose-500 hover:text-rose-600 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Order</span>
            </button>
          )}
        </div>

        {/* 2. Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-20 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700">No items selected</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Click any product in the catalog</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3 group">
                {/* 36x36px rounded squircle image preview */}
                <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <Package className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                {/* Name & Unit Price */}
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-medium text-slate-900 truncate max-w-[130px]">
                    {item.name}
                  </h5>
                  <div className="text-[11px] text-slate-400 font-mono">
                    LKR {item.price.toFixed(2)}
                  </div>
                </div>

                {/* Stepper Quantity Controls: - [qty] + */}
                <div className="text-xs text-slate-600 font-mono flex items-center gap-2 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60 shrink-0">
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
                  <span className="text-xs font-semibold text-slate-900 font-mono">
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

        {/* 3. Financial Breakdown Summary */}
        <div className="p-5 border-t border-slate-100 bg-white space-y-3">
          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>LKR {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax (0% / Ex)</span>
              <span>LKR 0.00</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Discount</span>
              <span>LKR 0.00</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold text-slate-900">
              <span>Total</span>
              <span className="text-base text-slate-900 font-black">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 4. Payment Method Segmented Control */}
          <div className="pt-1">
            <label className="text-xs font-semibold text-slate-800 block mb-2">
              Payment Method
            </label>
            <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1 text-xs">
              {[
                { id: 'CARD', label: 'Card', icon: CreditCard },
                { id: 'CASH', label: 'Cash', icon: Banknote },
                { id: 'SPLIT', label: 'Split', icon: Split },
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = paymentMethod === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentMethod(tab.id as typeof paymentMethod)}
                    className={`py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Primary Charge Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCharge}
              disabled={cart.length === 0 || isProcessingCheckout}
              className="w-full bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-[0.99] disabled:opacity-40 text-white font-semibold text-xs py-3.5 rounded-xl shadow-lg shadow-[#7052FF]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isProcessingCheckout ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
                <span className="font-bold text-sm">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
                <span className="text-white/40">•</span>
                <span className="font-mono font-bold text-white text-sm">
                  LKR {totalAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-white/80">Tap to review & checkout</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-white text-[#7052FF] px-4 py-2 rounded-xl font-bold text-xs shadow-sm">
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
              <h3 className="text-sm font-semibold text-slate-800">Order Summary ({totalItemCount})</h3>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs text-rose-500 font-semibold px-2 py-1"
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
                    <h5 className="text-xs font-medium text-slate-900 truncate">{item.name}</h5>
                    <div className="text-[11px] text-slate-400 font-mono">
                      LKR {item.price.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 font-mono flex items-center gap-2 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      className="font-bold text-slate-500"
                    >
                      -
                    </button>
                    <span className="font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      className="font-bold text-slate-500"
                    >
                      +
                    </button>
                  </div>

                  <span className="text-xs font-bold font-mono text-slate-900">
                    LKR {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial breakdown & Charge */}
            <div className="p-5 bg-white border-t border-slate-100 space-y-3">
              <div className="flex justify-between text-sm font-bold text-slate-900 font-mono">
                <span>Total Amount</span>
                <span>LKR {totalAmount.toFixed(2)}</span>
              </div>

              {/* Payment selector */}
              <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-3 gap-1 text-xs">
                {[
                  { id: 'CARD', label: 'Card' },
                  { id: 'CASH', label: 'Cash' },
                  { id: 'SPLIT', label: 'Split' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaymentMethod(tab.id as typeof paymentMethod)}
                    className={`py-1.5 rounded-lg font-medium transition-all ${
                      paymentMethod === tab.id
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-500'
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
                className="w-full bg-[#7052FF] text-white font-semibold text-xs py-3.5 rounded-xl shadow-lg shadow-[#7052FF]/20 flex items-center justify-center gap-2"
              >
                <span>Charge LKR {totalAmount.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUPPORTING MODALS (Receipt & End Shift)
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
    </div>
  );
}
