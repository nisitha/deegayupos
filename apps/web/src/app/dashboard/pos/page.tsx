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
  CheckCircle2,
  Printer,
  QrCode,
  AlertCircle,
  Check,
  Pencil,
  RotateCcw,
  MapPin,
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
import {
  QuantityUnitModal,
  type QuantityUnitModalProduct,
} from '../../../components/pos/quantity-unit-modal';
import { getProductPhoto, DEFAULT_STUDIO_PHOTO } from '../../../lib/product-image-mapper';
import {
  AYURVEDIC_MASTER_DEPARTMENTS,
  AYURVEDIC_DEPARTMENT_LIST,
  classifyAyurvedicDepartment,
} from '../../../lib/ayurvedic-departments';
import { getCachedCatalogData, setCachedCatalogData } from '../../../lib/catalog-db';
import { PrinterBridge } from '../../../lib/hardware/printer-bridge';
import { supabase } from '../../../lib/supabase';
import {
  detectUnitConfig,
  calculateBaseQuantity,
  formatQuantityWithUnit,
} from '../../../lib/unit-utils';

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
  originalUnitPrice: number;
  costPrice: number;
  quantity: number;
  stockOnHand: number;
  unit: string;
  imageUrl?: string;
  departmentId?: string;
  selectedUnit?: string;
  displayQuantity?: number;
}

export default function ConfidencyPosPage() {
  const { selectedBranchId, user, activeCashier, setActiveCashier, business, branches } = useTenantBranch();
  const currentBranchName = branches.find((b) => b.id === selectedBranchId)?.name || 'Main Branch';

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

  // Checkout & Payment Confirmation Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'CASH' | 'CARD' | 'LANKA_QR' | 'STORE_CREDIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccessBanner, setCheckoutSuccessBanner] = useState<{ invoiceNumber: string; amount: number } | null>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Mobile Slide-up Bottom Sheet
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Scanner & Notification feedback
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  // Inline Unit Price Editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPriceInput, setEditingPriceInput] = useState<string>('');
  const inlinePriceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingItemId && inlinePriceInputRef.current) {
      inlinePriceInputRef.current.focus();
      inlinePriceInputRef.current.select();
    }
  }, [editingItemId]);

  // Cashier Session Details
  const cashierId = activeCashier?.id || user?.id || '96b2747b-9d22-4266-94ce-b035fadef498';
  const cashierName = activeCashier?.fullName || user?.fullName || 'Dr. Deegayu (Owner)';
  const registerCode = 'REG-01';
  const openingFloat = 15000.0;

  // Instant 0ms Hydration via IndexedDB (< 15ms) + Decoupled Flat Background Sync
  const initCatalog = useCallback(async () => {
    setIsLoadingProducts(true);
    setCatalogError(null);

    // 1. Immediately read from IndexedDB with ZERO blocking spinner
    try {
      const cached = await getCachedCatalogData<RetailProductItem>('deegayu');
      if (cached && cached.products && cached.products.length > 0) {
        setProducts(cached.products);
        setIsLoadingProducts(false);
      }
    } catch (cacheErr) {
      console.warn('[POS Catalog] Local cache read error:', cacheErr);
    }

    // 2. Concurrently sync with Supabase in background via decoupled flat queries
    try {
      // Step A: Fetch categories in a flat query
      const categoryMap = new Map<string, { id: string; name: string; slug: string }>();
      try {
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id, name, slug');
        if (!catErr && catData) {
          catData.forEach((c: any) => {
            categoryMap.set(c.id, { id: c.id, name: c.name, slug: c.slug || '' });
          });
        }
      } catch (cErr) {
        console.warn('[POS Catalog] Categories fetch error:', cErr);
      }

      // Step B: Fetch stock levels in 1,000-row chunks
      const stockMap = new Map<string, number>();
      try {
        let stockPage = 0;
        const stockChunkSize = 1000;
        let hasMoreStock = true;

        while (hasMoreStock) {
          const sFrom = stockPage * stockChunkSize;
          const sTo = sFrom + stockChunkSize - 1;
          const { data: stockChunk, error: sErr } = await supabase
            .from('stock_levels')
            .select('product_id, quantity_on_hand')
            .range(sFrom, sTo);

          if (sErr || !stockChunk || stockChunk.length === 0) {
            hasMoreStock = false;
            break;
          }

          stockChunk.forEach((sl: any) => {
            if (sl.product_id) {
              const cur = stockMap.get(sl.product_id) || 0;
              stockMap.set(sl.product_id, cur + Number(sl.quantity_on_hand ?? 0));
            }
          });

          if (stockChunk.length < stockChunkSize) {
            hasMoreStock = false;
          } else {
            stockPage++;
          }
        }
      } catch (sErr) {
        console.warn('[POS Catalog] Stock levels fetch error:', sErr);
      }

      // Step C: Fetch products in 1,000-row chunks (pure flat query, no embedded joins)
      let allProducts: any[] = [];
      let chunkPage = 0;
      const chunkSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = chunkPage * chunkSize;
        const to = from + chunkSize - 1;
        const { data: chunk, error: chunkErr } = await supabase
          .from('products')
          .select('id, name, sku, barcode, cost_price, retail_price, wholesale_price, image_url, alert_quantity, is_active, category_id')
          .eq('is_active', true)
          .order('name', { ascending: true })
          .range(from, to);

        if (chunkErr) {
          console.error('[POS Catalog] Product chunk fetch error:', chunkErr.message);
          if (allProducts.length === 0) {
            throw new Error(chunkErr.message || 'Failed to fetch products from store server');
          }
          hasMore = false;
          break;
        }

        if (!chunk || chunk.length === 0) {
          hasMore = false;
          break;
        }

        allProducts = allProducts.concat(chunk);
        if (chunk.length < chunkSize) {
          hasMore = false;
        } else {
          chunkPage++;
        }
      }

      if (allProducts.length > 0) {
        const freshProducts: RetailProductItem[] = allProducts.map((p: any) => {
          const cat = p.category_id ? categoryMap.get(p.category_id) : null;
          const stockQty = stockMap.has(p.id) ? stockMap.get(p.id)! : 100;

          return {
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            retailPrice: Number(p.retail_price ?? 0),
            wholesalePrice: Number(p.wholesale_price ?? p.retail_price ?? 0),
            costPrice: Number(p.cost_price ?? 0),
            category: {
              id: cat?.id || p.category_id || '',
              name: cat?.name || 'General',
              slug: cat?.slug || 'general',
            },
            stockOnHand: stockQty,
            unit: 'units',
            imageUrl: p.image_url || undefined,
            alertQuantity: p.alert_quantity ?? null,
          };
        });

        setProducts(freshProducts);
        setCatalogError(null);

        // Update IndexedDB asynchronously for instant 0ms subsequent loads
        await setCachedCatalogData('deegayu', {
          products: freshProducts,
          categories: Array.from(categoryMap.values()),
          total: freshProducts.length,
        });
      } else {
        const cached = await getCachedCatalogData<RetailProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 0) {
          setProducts(cached.products);
        } else {
          setCatalogError('No products found in store database');
        }
      }
    } catch (netErr: unknown) {
      console.warn('[POS Catalog] Background sync error:', netErr);
      setProducts((prev) => {
        if (prev.length === 0) {
          const msg = netErr instanceof Error ? netErr.message : 'Unable to connect to store server';
          setCatalogError(msg);
        }
        return prev;
      });
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    initCatalog();
  }, [initCatalog]);

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

  // Spacious Quantity & Unit Selector Modal State
  const [quantityModalTarget, setQuantityModalTarget] = useState<{
    product: QuantityUnitModalProduct;
    cartItemId?: string;
    initialUnit?: string;
    initialDisplayQuantity?: number;
    initialCustomPrice?: number;
  } | null>(null);

  // Qty Popup Mode: 'ALL' (every item click opens modal) vs 'WEIGHT_LIQUID' (only 1g/1ml triggers modal)
  const [qtyPopupMode, setQtyPopupMode] = useState<'ALL' | 'WEIGHT_LIQUID'>('ALL');

  // Add Item to Cart
  const addToCart = useCallback((product: RetailProductItem & { departmentId?: string }) => {
    const config = detectUnitConfig(product);
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id);
      if (existing) {
        const curUnit = existing.selectedUnit || config.baseUnit;
        const curDisplay = existing.displayQuantity !== undefined ? existing.displayQuantity : existing.quantity;
        const stepVal = config.mode === 'fractional' ? 0.5 : 1;
        const nextDisplay = Math.round((curDisplay + stepVal) * 1000) / 1000;
        const nextBase = calculateBaseQuantity(nextDisplay, curUnit, config);
        return prevCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                displayQuantity: nextDisplay,
                quantity: nextBase,
              }
            : item,
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
          originalUnitPrice: product.retailPrice,
          costPrice: product.costPrice ?? 0,
          quantity: 1,
          displayQuantity: 1,
          selectedUnit: config.baseUnit,
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

  // Handle clicking product in catalog or search (respects Qty Popup toggle)
  const handleProductClick = useCallback(
    (product: RetailProductItem & { departmentId?: string }) => {
      const config = detectUnitConfig(product);
      const isWeightOrVolumeOrFractional =
        config.mode === 'weight_g' ||
        config.mode === 'volume_ml' ||
        config.mode === 'fractional';

      if (qtyPopupMode === 'ALL' || isWeightOrVolumeOrFractional) {
        const existingInCart = cart.find((it) => it.productId === product.id);
        const defaultUnit =
          existingInCart?.selectedUnit ||
          (config.mode === 'weight_g' ? 'g' : config.mode === 'volume_ml' ? 'ml' : config.baseUnit);

        const defaultDisplayQty =
          existingInCart?.displayQuantity !== undefined
            ? existingInCart.displayQuantity
            : config.mode === 'weight_g'
            ? (defaultUnit === 'kg' ? 1 : 100)
            : config.mode === 'volume_ml'
            ? (defaultUnit === 'L' ? 1 : 250)
            : 1;

        setQuantityModalTarget({
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            barcode: product.barcode,
            retailPrice: product.retailPrice,
            costPrice: product.costPrice,
            stockOnHand: product.stockOnHand,
            unit: product.unit,
            imageUrl: product.imageUrl,
            departmentId: product.departmentId,
          },
          cartItemId: existingInCart?.id,
          initialUnit: defaultUnit,
          initialDisplayQuantity: defaultDisplayQty,
          initialCustomPrice: existingInCart?.price ?? product.retailPrice,
        });
        return;
      }

      // Discrete items add directly to cart if Qty Popup is set to Weight/Liquid only
      addToCart(product);
    },
    [cart, qtyPopupMode, addToCart],
  );

  // Open modal from Order Summary cart item badge
  const handleOpenEditItemModal = useCallback((item: CartItem) => {
    const config = detectUnitConfig(item);
    setQuantityModalTarget({
      product: {
        id: item.productId,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        retailPrice: item.originalUnitPrice,
        costPrice: item.costPrice,
        stockOnHand: item.stockOnHand,
        unit: item.unit,
        imageUrl: item.imageUrl,
        departmentId: item.departmentId,
      },
      cartItemId: item.id,
      initialUnit: item.selectedUnit || config.baseUnit,
      initialDisplayQuantity:
        item.displayQuantity !== undefined ? item.displayQuantity : item.quantity,
      initialCustomPrice: item.price,
    });
  }, []);

  // Handle confirmation from Spacious Quantity & Unit Modal
  const handleConfirmQuantityModal = useCallback(
    ({
      productId,
      cartItemId,
      selectedUnit,
      displayQuantity,
      baseQuantity,
      unitPrice,
    }: {
      productId: string;
      cartItemId?: string;
      selectedUnit: string;
      displayQuantity: number;
      baseQuantity: number;
      unitPrice: number;
    }) => {
      setCart((prevCart) => {
        if (cartItemId) {
          return prevCart.map((it) =>
            it.id === cartItemId
              ? {
                  ...it,
                  selectedUnit,
                  displayQuantity,
                  quantity: baseQuantity,
                  price: unitPrice,
                }
              : it,
          );
        }

        const existing = prevCart.find((it) => it.productId === productId);
        if (existing) {
          return prevCart.map((it) =>
            it.productId === productId
              ? {
                  ...it,
                  selectedUnit,
                  displayQuantity,
                  quantity: baseQuantity,
                  price: unitPrice,
                }
              : it,
          );
        }

        const p = products.find((prod) => prod.id === productId) || quantityModalTarget?.product;
        if (!p) return prevCart;

        return [
          ...prevCart,
          {
            id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            productId: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            price: unitPrice,
            originalUnitPrice: p.retailPrice,
            costPrice: p.costPrice ?? 0,
            quantity: baseQuantity,
            displayQuantity,
            selectedUnit,
            stockOnHand: p.stockOnHand,
            unit: p.unit,
            imageUrl: p.imageUrl,
            departmentId: (p as any).departmentId,
          },
        ];
      });

      setQuantityModalTarget(null);
    },
    [products, quantityModalTarget],
  );

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
        originalUnitPrice: customItem.price,
        costPrice: 0,
        quantity: customItem.quantity,
        displayQuantity: customItem.quantity,
        selectedUnit: 'pcs',
        stockOnHand: 999,
        unit: 'pcs',
        departmentId: 'fmcg',
      },
    ]);
    setScanFeedback(`Custom Item Added: ${customTitle}`);
    setTimeout(() => setScanFeedback(null), 2000);
  };

  // Inline Unit Price Handlers
  const handleStartEditPrice = (item: CartItem) => {
    setEditingItemId(item.id);
    setEditingPriceInput(item.price.toFixed(2));
  };

  const handleSaveEditPrice = (itemId: string) => {
    const parsed = parseFloat(editingPriceInput);
    if (!isNaN(parsed) && parsed >= 0) {
      setCart((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, price: Math.round(parsed * 100) / 100 } : it))
      );
    }
    setEditingItemId(null);
    setEditingPriceInput('');
  };

  const handleCancelEditPrice = () => {
    setEditingItemId(null);
    setEditingPriceInput('');
  };

  const handleResetUnitPrice = (itemId: string) => {
    setCart((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, price: it.originalUnitPrice } : it))
    );
  };

  const removeCartItem = (itemId: string) => {
    if (editingItemId === itemId) {
      setEditingItemId(null);
      setEditingPriceInput('');
    }
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearCart = useCallback(() => {
    setEditingItemId(null);
    setEditingPriceInput('');
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
  const totalItemCount = useMemo(() => {
    return cart.reduce((acc, item) => {
      const conf = detectUnitConfig(item);
      if (conf.mode === 'weight_g' || conf.mode === 'volume_ml') {
        return acc + 1;
      }
      return acc + (Number(item.quantity) >= 1 ? Math.round(Number(item.quantity)) : 1);
    }, 0);
  }, [cart]);

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
    setCart(
      held.items.map((it) => ({
        ...it,
        originalUnitPrice: it.originalUnitPrice ?? it.price,
        costPrice: it.costPrice ?? 0,
      }))
    );
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

  // Open Checkout / Payment Confirmation Modal
  const handleOpenCheckoutModal = useCallback(() => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    const initialMethod =
      paymentMethod === 'STORE_CREDIT'
        ? 'STORE_CREDIT'
        : paymentMethod === 'CARD'
        ? 'CARD'
        : 'CASH';
    setCheckoutPaymentMethod(initialMethod);
    setCashTendered(totalAmount > 0 ? totalAmount.toFixed(2) : '');
    setIsCheckoutModalOpen(true);
  }, [cart.length, paymentMethod, totalAmount]);

  // Backward compatibility alias
  const handleCharge = handleOpenCheckoutModal;

  // Auto-focus cash input when Cash tab is active
  useEffect(() => {
    if (!isCheckoutModalOpen || checkoutPaymentMethod !== 'CASH') {
      return undefined;
    }
    const timer = setTimeout(() => {
      cashInputRef.current?.focus();
      cashInputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [isCheckoutModalOpen, checkoutPaymentMethod]);

  // Execute Checkout Transaction with Supabase Persistence
  const executeCheckout = useCallback(
    async (shouldPrintReceipt: boolean) => {
      if (cart.length === 0) return;

      // Credit limit and customer validation for STORE_CREDIT
      if (checkoutPaymentMethod === 'STORE_CREDIT') {
        if (!selectedCustomer) {
          setIsCustomerModalOpen(true);
          setScanFeedback('⚠️ Please select a customer for Store Credit purchase');
          setTimeout(() => setScanFeedback(null), 3000);
          return;
        }

        if (selectedCustomer.status === 'SUSPENDED') {
          setCheckoutError('Customer account is suspended. Cannot issue credit.');
          return;
        }

        const debt = Number(selectedCustomer.currentBalance || 0);
        const limit = Number(selectedCustomer.creditLimit || 0);
        const avail = Math.max(0, limit - debt);

        if (totalAmount > avail) {
          const excess = (totalAmount - avail).toFixed(2);
          setCheckoutError(`Credit limit exceeded by LKR ${excess}. Available: LKR ${avail.toLocaleString()}`);
          return;
        }
      }

      const tenderedNum =
        checkoutPaymentMethod === 'CASH'
          ? parseFloat(cashTendered) || 0
          : totalAmount;

      if (checkoutPaymentMethod === 'CASH' && tenderedNum < totalAmount) {
        setCheckoutError(
          `Insufficient cash tendered. Total is LKR ${totalAmount.toFixed(2)}, received LKR ${tenderedNum.toFixed(2)}.`
        );
        return;
      }

      const changeDue = Math.max(0, tenderedNum - totalAmount);

      setIsProcessingCheckout(true);
      setCheckoutError(null);

      try {
        const formattedCustomer = selectedCustomer
          ? selectedCustomer.phone
            ? `${selectedCustomer.name} (${selectedCustomer.phone})`
            : selectedCustomer.name
          : 'Walk-in Customer';

        const payload: CheckoutPayload = {
          branchId: selectedBranchId || '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
          cashierId,
          cashierName,
          customerId: selectedCustomer?.id || undefined,
          customerName: formattedCustomer,
          orderType: 'RETAIL_WALKIN',
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount: tenderedNum,
          changeDue,
          paymentMethod:
            checkoutPaymentMethod === 'STORE_CREDIT'
              ? 'CUSTOMER_CREDIT'
              : checkoutPaymentMethod === 'CARD'
              ? 'CARD'
              : checkoutPaymentMethod === 'LANKA_QR'
              ? 'QR_PAYMENT'
              : 'CASH',
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.name,
            sku: item.sku,
            unitPrice: item.price,
            costPrice: item.costPrice ?? 0,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
            discountAmount: 0,
            taxAmount: 0,
          })),
          payments: [
            {
              paymentMethod:
                checkoutPaymentMethod === 'STORE_CREDIT'
                  ? 'CUSTOMER_CREDIT'
                  : checkoutPaymentMethod === 'CARD'
                  ? 'CARD'
                  : checkoutPaymentMethod === 'LANKA_QR'
                  ? 'QR_PAYMENT'
                  : 'CASH',
              amount: totalAmount,
            },
          ],
        };

        const res = await posApi.checkout(payload);

        if (!res.success || !res.data) {
          throw new Error('Failed to complete checkout transaction');
        }

        const currentBranchObj = branches.find((b) => b.id === (selectedBranchId || res.data?.branchId));
        const branchDisplayName = currentBranchObj?.name || 'Main Store';

        const finalizedSale: SaleDto = {
          ...res.data,
          branchId: res.data.branchId || selectedBranchId || '85d48a94-b6a3-4b9f-a746-0ac2ff61355c',
          branchName: branchDisplayName,
          cashierId: res.data.cashierId || cashierId,
          cashierName: res.data.cashierName || cashierName,
          cashier: {
            id: res.data.cashierId || cashierId,
            fullName: res.data.cashierName || cashierName,
            email: user?.email || '',
          },
          customerName: formattedCustomer,
          paidAmount: tenderedNum,
          changeDue,
        };

        // Show top success banner
        setCheckoutSuccessBanner({
          invoiceNumber: finalizedSale.invoiceNumber,
          amount: totalAmount,
        });
        setTimeout(() => {
          setCheckoutSuccessBanner(null);
        }, 5000);

        // Phase 13 Hardware Automation: Cash drawer kick & Auto thermal print
        try {
          const hw = PrinterBridge.getSettings();
          if (
            hw.autoOpenCashDrawer &&
            checkoutPaymentMethod === 'CASH'
          ) {
            PrinterBridge.kickCashDrawer().catch(() => {});
          }
          if (hw.autoPrintReceipt) {
            PrinterBridge.printReceipt(finalizedSale, undefined, {
              storeName: business?.name || 'DEEGAYU WEDA MADURA',
              branchName: branchDisplayName,
              address: currentBranchObj?.address || business?.address || 'Colombo Road, Kiribathgoda, Sri Lanka',
              phone: currentBranchObj?.phone || business?.phone || '+94 11 291 4500',
              taxNumber: 'VAT-10928392-8000',
            }).catch(() => {});
          }
        } catch {
          // ignore
        }

        if (checkoutPaymentMethod === 'STORE_CREDIT' && selectedCustomer) {
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
        setIsCheckoutModalOpen(false);

        if (shouldPrintReceipt) {
          setCompletedSale(finalizedSale);
          setShowReceiptModal(true);
        }
      } catch (err: any) {
        console.error('[Checkout DB Error]:', err);
        setCheckoutError(err.message || 'Payment processing failed. Could not save to database.');
      } finally {
        setIsProcessingCheckout(false);
      }
    },
    [
      cart,
      checkoutPaymentMethod,
      cashTendered,
      totalAmount,
      subtotal,
      discountAmount,
      taxAmount,
      selectedBranchId,
      cashierId,
      cashierName,
      selectedCustomer,
      clearCart,
      resetDiscount,
    ]
  );

  // Keyboard shortcut listener (F2: Search Barcode, F4: Hold Ticket, Esc: Dismiss, Enter: Confirm checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If QuantityUnitModal is open, it manages its own Enter & Escape
      if (quantityModalTarget) return;

      // Ignore global shortcut keystrokes while typing quantity or editing an inline unit price
      const target = e.target as HTMLElement | null;
      if (
        target?.getAttribute('data-inline-price-input') === 'true' ||
        target?.getAttribute('data-qty-input') === 'true' ||
        target?.closest('[data-inline-price]') ||
        target?.closest('[data-qty-control]') ||
        (target?.tagName === 'INPUT' && target !== searchInputRef.current) ||
        target?.tagName === 'TEXTAREA'
      ) {
        if (e.key === 'Escape') {
          (target as HTMLInputElement)?.blur();
        }
        return;
      }

      if (isCheckoutModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsCheckoutModalOpen(false);
        } else if (e.key === 'Enter') {
          if ((e.target as HTMLElement)?.tagName === 'BUTTON') return;
          e.preventDefault();
          executeCheckout(true);
        }
        return;
      }

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
        setIsCheckoutModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCheckoutModalOpen, executeCheckout, cart, handleHoldTicket, searchQuery, quantityModalTarget]);

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#E6EAF2] select-none">
      {/* Toast Feedback */}
      {scanFeedback && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-[#7052FF]" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* Sale Confirmation & Persistence Banner */}
      {checkoutSuccessBanner && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm font-bold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>
            ✓ Sale {checkoutSuccessBanner.invoiceNumber} Marked & Saved (LKR {checkoutSuccessBanner.amount.toFixed(2)})
          </span>
        </div>
      )}

      {/* =====================================================================
          CENTER COLUMN: STATUS BAR, TACTILE ACTIONS, SEARCH STATION, DEPARTMENTS & CATALOG
      ===================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-200/80 bg-[#E6EAF2] min-w-0">
        {/* 1. Top Terminal Status Bar */}
        <div className="h-14 px-4 lg:px-5 border-b border-slate-200/90 flex items-center justify-between shrink-0 bg-white/95 backdrop-blur-md shadow-2xs gap-3 overflow-x-auto no-scrollbar">
          {/* Left: Breadcrumb & Cashier Metadata */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-[#5B46F6] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 whitespace-nowrap shrink-0">
              <span>POS Terminal</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100/80 text-xs font-bold text-[#5B46F6] whitespace-nowrap shrink-0">
              <MapPin className="w-3.5 h-3.5 text-[#5B46F6] shrink-0" />
              <span className="truncate max-w-[140px]">{currentBranchName}</span>
            </div>
            <span className="text-slate-300 shrink-0">|</span>
            <button
              type="button"
              onClick={() => setIsCashierModalOpen(true)}
              className="flex items-center gap-1.5 hover:bg-indigo-50/70 px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs group shrink-0 whitespace-nowrap"
              title="Click or press to switch cashier profile via 4-digit PIN"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-bold text-slate-900 group-hover:text-[#5B46F6] transition-colors whitespace-nowrap">
                Cashier: {cashierName}
              </span>
              <span className="text-[10px] font-bold bg-[#5B46F6]/10 text-[#5B46F6] px-1.5 py-0.5 rounded group-hover:bg-[#5B46F6] group-hover:text-white transition-colors shrink-0">
                PIN Switch
              </span>
            </button>
            <div className="hidden xl:flex text-xs text-slate-500 font-medium whitespace-nowrap items-center shrink-0">
              <span>| Reg: {registerCode}</span>
              <span className="hidden 2xl:inline"> | Shift: 8:30 AM</span>
              <span className="hidden 2xl:inline">
                {' '}
                | Drawer: LKR {openingFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Right: Qty Popup Mode Pill Switcher, Catalog Ready & End Shift Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Pill Toggle for Qty Popup */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/90 text-xs shadow-2xs shrink-0 whitespace-nowrap">
              <button
                type="button"
                onClick={() => setQtyPopupMode('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  qtyPopupMode === 'ALL'
                    ? 'bg-[#5B46F6] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Clicking any product card immediately pops up the large centered modal"
              >
                Qty Popup: All Items
              </button>
              <button
                type="button"
                onClick={() => setQtyPopupMode('WEIGHT_LIQUID')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  qtyPopupMode === 'WEIGHT_LIQUID'
                    ? 'bg-[#5B46F6] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Only 1g weight & 1ml liquid items open modal; boxed/discrete items add 1 directly"
              >
                Weight/Liquid (1g/1ml)
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono shrink-0 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Catalog Ready</span>
            </div>
            <button
              type="button"
              onClick={() => setIsEndShiftModalOpen(true)}
              className="border border-slate-200 hover:bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-700 transition-colors shadow-2xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              End Shift
            </button>
          </div>
        </div>

        {/* 2. Vibrant Tactile Action Cards (h-16, 4-column responsive grid) */}
        <div className="px-4 lg:px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 shrink-0 backdrop-blur-xs">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
            {/* Card 1: Apply Discount */}
            <button
              type="button"
              onClick={() => setIsDiscountModalOpen(true)}
              className={`relative h-16 rounded-2xl px-4 flex items-center justify-between text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/20 select-none ${
                discountType !== 'NONE' ? 'ring-2 ring-emerald-300/70' : ''
              }`}
              title="Apply order discount (Percent or Flat) [F6]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <Percent className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex flex-col text-left">
                  <span className="font-bold text-sm tracking-tight text-white leading-tight">
                    Apply Discount
                  </span>
                  <span className="text-xs text-white/85 font-medium truncate">
                    {discountType === 'PERCENT'
                      ? `${discountPercent}% Off Total`
                      : discountType === 'FLAT'
                      ? `LKR ${discountFlat} Off Total`
                      : 'Bill or % off'}
                  </span>
                </div>
              </div>
              {discountType !== 'NONE' ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    resetDiscount();
                  }}
                  className="w-7 h-7 rounded-lg bg-white/25 hover:bg-white/35 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Remove discount"
                >
                  <X className="w-4 h-4" />
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-lg border border-white/20 shrink-0">
                  [F6]
                </span>
              )}
            </button>

            {/* Card 2: Customer */}
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className={`relative h-16 rounded-2xl px-4 flex items-center justify-between text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/20 select-none ${
                selectedCustomer ? 'ring-2 ring-blue-300/70' : ''
              }`}
              title="Select customer for billing and credit [F3]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <UserPlus className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex flex-col text-left">
                  <span className="font-bold text-sm tracking-tight text-white leading-tight">
                    Customer
                  </span>
                  <span className="text-xs text-white/85 font-medium truncate max-w-[130px]">
                    {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                  </span>
                </div>
              </div>
              {selectedCustomer ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCustomer(null);
                  }}
                  className="w-7 h-7 rounded-lg bg-white/25 hover:bg-white/35 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  title="Remove customer"
                >
                  <X className="w-4 h-4" />
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-lg border border-white/20 shrink-0">
                  [F3]
                </span>
              )}
            </button>

            {/* Card 3: Hold Ticket */}
            <button
              type="button"
              onClick={handleHoldTicket}
              disabled={cart.length === 0}
              className="relative h-16 rounded-2xl px-4 flex items-center justify-between text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/20 select-none disabled:opacity-50 disabled:pointer-events-none"
              title="Park current order ticket [F4]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <PauseCircle className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex flex-col text-left">
                  <span className="font-bold text-sm tracking-tight text-white leading-tight">
                    Hold Ticket
                  </span>
                  <span className="text-xs text-white/85 font-medium truncate">
                    {heldTickets.length > 0 ? `${heldTickets.length} Parked` : 'Park Current Bill'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-lg border border-white/20 shrink-0">
                [F4]
              </span>
            </button>

            {/* Card 4: Custom Sale Item */}
            <button
              type="button"
              onClick={() => setIsCustomSaleModalOpen(true)}
              className="relative h-16 rounded-2xl px-4 flex items-center justify-between text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all cursor-pointer bg-gradient-to-r from-violet-600 to-purple-700 shadow-violet-500/20 select-none"
              title="Add non-catalog or custom priced item"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-inner">
                  <Tag className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <div className="min-w-0 flex flex-col text-left">
                  <span className="font-bold text-sm tracking-tight text-white leading-tight">
                    Custom Item
                  </span>
                  <span className="text-xs text-white/85 font-medium truncate">
                    Quick Entry / Misc
                  </span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-lg bg-white/20 text-white flex items-center justify-center shrink-0 border border-white/25">
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </div>
            </button>
          </div>

          {/* Held Tickets Banner (if tickets are held) */}
          {heldTickets.length > 0 && (
            <div className="mt-3 flex items-center justify-between px-4 py-2 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">
                  {heldTickets.length} ticket{heldTickets.length > 1 ? 's' : ''} currently on hold
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHeldTicketsModalOpen(true)}
                className="font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                View & Resume &rarr;
              </button>
            </div>
          )}
        </div>

        {/* 3. Hero Search Station with Live Keystroke Autocomplete Dropdown */}
        <div className="px-5 py-2.5 border-b border-slate-200/80 bg-white/95 shrink-0 backdrop-blur-xs" ref={searchContainerRef}>
          <div className="relative w-full">
            {/* Left: Magnifying Glass Icon */}
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-10">
              <Search className="w-5 h-5 text-slate-400" />
            </div>

            {/* Compact Expansive Input */}
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
                    handleProductClick(liveSearchResults[selectedSearchIndex]);
                    searchInputRef.current?.focus();
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsSearchDropdownOpen(false);
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full h-12 md:h-13 text-sm md:text-base font-medium pl-11 pr-44 rounded-xl border border-slate-200/90 bg-white shadow-xs focus:outline-none focus:border-[#5B46F6] focus:ring-2 focus:ring-[#5B46F6]/15 transition-all text-slate-900 placeholder:text-slate-400"
            />

            {/* Right: Shortcut [F2] Badge, Item Count & Clear Button */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchDropdownOpen(false);
                    searchInputRef.current?.focus();
                  }}
                  className="w-6 h-6 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Barcode [F2] Tag */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 shadow-2xs text-xs font-mono text-slate-500">
                <Barcode className="w-3.5 h-3.5 text-[#5B46F6]" />
                <span className="font-semibold text-slate-700">[F2]</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Live Count Badge */}
              <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
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
                          handleProductClick(item);
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
                              handleProductClick(item);
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
        <div className="px-5 py-2.5 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0 bg-white/90 backdrop-blur-xs">
          {/* All Departments Tab */}
          <button
            type="button"
            onClick={() => setSelectedDeptId('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-2 border cursor-pointer ${
              selectedDeptId === 'all'
                ? 'bg-[#0F1222] text-white border-[#0F1222] shadow-sm'
                : 'bg-white border border-slate-200/80 text-slate-700 hover:border-indigo-300 shadow-2xs'
            }`}
          >
            <span>All Products (සියලු වර්ග)</span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                selectedDeptId === 'all' ? 'bg-[#5B46F6] text-white' : 'bg-slate-100 text-slate-600'
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
                className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all shrink-0 active:scale-95 flex items-center gap-2 border cursor-pointer ${
                  isActive
                    ? 'bg-[#0F1222] text-white border-[#0F1222] font-bold shadow-sm'
                    : 'bg-white border border-slate-200/80 text-slate-700 hover:border-indigo-300 shadow-2xs'
                }`}
              >
                {/* 3D Mini Dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isActive ? 'bg-[#5B46F6]' : `bg-gradient-to-br ${dept.gradient}`
                  } shadow-2xs shrink-0`}
                />
                <span className="whitespace-nowrap">
                  {dept.en} <span className={`font-normal text-xs ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>({dept.si})</span>
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                    isActive ? 'bg-[#5B46F6] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5. Product Cards Grid with 3D Category Emblems */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-28 md:pb-5 bg-[#E6EAF2]">
          {isLoadingProducts && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#5B46F6] mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Loading Deegayu Ayurvedic Catalog...</h3>
              <p className="text-xs text-slate-400 mt-1">
                Syncing store inventory & price list...
              </p>
            </div>
          ) : catalogError && products.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Package className="w-10 h-10 text-rose-400 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">Catalogue Sync Failed</h3>
              <p className="text-xs text-rose-500 max-w-sm mt-1 mb-4">{catalogError}</p>
              <button
                type="button"
                onClick={() => initCatalog()}
                className="px-4 py-2 bg-[#5B46F6] text-white text-xs font-semibold rounded-xl hover:bg-[#4A35E5] transition active:scale-95 shadow-sm"
              >
                Unable to load catalog. Click to retry.
              </button>
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
                className="mt-3 text-xs font-semibold text-[#5B46F6] hover:underline"
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
                    onClick={() => handleProductClick(product)}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-400 hover:-translate-y-0.5 transition-all duration-150 overflow-hidden flex flex-col p-3.5 cursor-pointer group active:scale-[0.98] select-none relative justify-between"
                  >
                    {/* Top Row: Department Sinhala Pill + Stock Indicator */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${dept.bgTint} ${dept.textColor} ${dept.borderTint}`}
                      >
                        {dept.si || dept.en}
                      </span>
                      {product.stockOnHand <= 0 ? (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70 font-mono">
                          0 left
                        </span>
                      ) : product.stockOnHand <= 5 ? (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 font-mono">
                          {product.stockOnHand} left
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 font-mono">
                          Qty: {product.stockOnHand}
                        </span>
                      )}
                    </div>

                    {/* High-Contrast Realistic Product Photo Container (Studio-Tinted Stage) */}
                    <div className="bg-gradient-to-br from-slate-50 via-indigo-50/40 to-emerald-50/30 border border-slate-100 rounded-xl h-28 w-full p-2 overflow-hidden flex items-center justify-center mb-2.5 group-hover:scale-[1.02] transition-transform relative">
                      <img
                        src={getProductPhoto(product)}
                        alt={product.name}
                        className="w-full h-full object-contain drop-shadow-sm transition-transform duration-200"
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
                          className="text-sm md:text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[42px] group-hover:text-indigo-600 transition-colors"
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
                          <span className="text-slate-900 font-bold tabular-nums text-base md:text-lg tracking-tight">
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
                            handleProductClick(product);
                          }}
                          className="w-8 h-8 rounded-lg bg-[#5B46F6] hover:bg-[#4935E3] text-white flex items-center justify-center font-bold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                          title="Add to cart"
                          aria-label={`Add ${product.name} to cart`}
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
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
      <aside className="hidden md:flex w-[340px] lg:w-[360px] xl:w-[380px] bg-[#ECEFF9] border-l-2 border-indigo-200/80 shadow-[-6px_0_24px_-12px_rgba(15,18,34,0.12)] flex-col h-full shrink-0 select-none">
        {/* 1. Cart Header */}
        <div className="h-14 px-5 border-b border-indigo-200/60 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <h3 className="text-sm md:text-base font-bold text-slate-900">Order Summary</h3>
            <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
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
          <div className="px-5 py-2.5 bg-white/90 border-b border-indigo-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="text-xs md:text-sm font-bold text-sky-950 truncate">
                  {selectedCustomer?.name || 'Customer'}
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
              className="text-sky-500 hover:text-sky-800 text-xs p-1 cursor-pointer"
              title="Remove customer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. Scrollable Cart Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-20 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">No items selected</p>
              <p className="text-xs text-slate-400 mt-0.5">Click any product in the catalog</p>
            </div>
          ) : (
            cart.map((item) => {
              const unitConfig = detectUnitConfig(item);
              const activeUnit = item.selectedUnit || unitConfig.baseUnit;
              const isMultiUnit = unitConfig.mode === 'weight_g' || unitConfig.mode === 'volume_ml';
              const isFractional = unitConfig.mode === 'fractional';
              const isWeightOrVolume = isMultiUnit || isFractional;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-indigo-100/90 shadow-2xs p-3 flex flex-col gap-2 group transition-all hover:border-indigo-300 hover:shadow-xs"
                >
                  {/* Top Row: Squircle Photo + Name & SKU + Trash Button */}
                  <div className="flex items-start justify-between gap-2.5">
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

                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-snug" title={item.name}>
                        {item.name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                          {item.sku}
                        </span>
                        {isWeightOrVolume && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded shrink-0">
                            Sold by {unitConfig.baseUnit}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom Row: Quantity Badge + Inline Unit Price Pill + Line Total */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {/* Quantity & Unit Pill (Opens Modal) */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditItemModal(item)}
                        className="group/qty inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-950 font-mono transition-colors cursor-pointer shrink-0"
                        title="Click to change quantity or unit in modal"
                      >
                        <span>{formatQuantityWithUnit(item.quantity, activeUnit, unitConfig)}</span>
                        <Pencil className="w-2.5 h-2.5 text-indigo-500 group-hover/qty:text-indigo-700" />
                      </button>

                      {/* Unit Price: Clickable Inline Editor / Active Input */}
                      {editingItemId === item.id ? (
                        <div className="relative inline-flex items-center gap-1" data-inline-price="true">
                          <span className="text-[10px] font-bold font-mono text-slate-400">LKR</span>
                          <input
                            ref={inlinePriceInputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            data-inline-price-input="true"
                            value={editingPriceInput}
                            onChange={(e) => setEditingPriceInput(e.target.value)}
                            onBlur={() => handleSaveEditPrice(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSaveEditPrice(item.id);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCancelEditPrice();
                              }
                            }}
                            className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 bg-white border border-[#5B46F6] rounded-md focus:outline-none focus:ring-2 focus:ring-[#5B46F6]/20 shadow-xs"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSaveEditPrice(item.id);
                            }}
                            className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            title="Save unit price"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditPrice(item)}
                            className="group/rate inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-[11px] font-mono font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                            title="Click to edit unit price for this bill only"
                          >
                            <span>
                              LKR {item.price.toFixed(2)}
                              {isWeightOrVolume ? `/${unitConfig.baseUnit}` : ''}
                            </span>
                            <Pencil className="w-2.5 h-2.5 text-slate-400 group-hover/rate:text-[#5B46F6]" />
                          </button>

                          {item.price !== item.originalUnitPrice && (
                            <div className="inline-flex items-center gap-1 shrink-0">
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 border border-amber-200 px-1 py-0.2 rounded font-sans">
                                Edited
                              </span>
                              <button
                                type="button"
                                onClick={() => handleResetUnitPrice(item.id)}
                                className="p-1 text-slate-400 hover:text-[#5B46F6] hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                title={`Reset to catalog price (LKR ${item.originalUnitPrice.toFixed(2)})`}
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Line Total */}
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono tabular-nums">
                        LKR {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Financial Breakdown Summary & Bottom Checkout Dock */}
        <div className="p-4 sm:p-5 border-t border-indigo-200/70 bg-white shadow-[0_-6px_20px_-8px_rgba(15,18,34,0.08)] space-y-3 shrink-0">
          <div className="space-y-1.5 font-mono">
            <div className="flex justify-between text-sm text-slate-600">
              <span className="font-sans font-medium">Subtotal</span>
              <span className="font-bold text-slate-800">LKR {subtotal.toFixed(2)}</span>
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
                    className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
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

            {/* TOTAL PAYABLE: Midnight Indigo Digital Readout Card */}
            <div className="mt-2 bg-[#0F1222] text-white rounded-xl px-4 py-3.5 flex items-center justify-between shadow-inner border border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                  Total Payable
                </span>
                <span className="text-[11px] text-indigo-400 font-medium">Net Due (LKR)</span>
              </div>
              <span className="text-2xl md:text-3xl font-black font-mono tracking-tight text-white">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 5. Payment Method Segmented Control */}
          <div className="pt-1">
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Payment Method
            </label>
            <div className="bg-slate-100/90 p-1 rounded-xl grid grid-cols-4 gap-1 text-xs">
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
                        ? 'bg-indigo-50 border-2 border-[#5B46F6] text-[#5B46F6] font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium hover:bg-white/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
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
                      <span className="truncate">{selectedCustomer?.name || 'Customer'}</span>
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
              className="w-full bg-gradient-to-r from-[#5B46F6] to-[#4A35E5] hover:from-[#4E39EC] hover:to-[#3E29D6] text-white font-semibold text-base md:text-lg py-3.5 rounded-xl shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-40"
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
          className="fixed bottom-20 inset-x-3 md:hidden z-40 bg-[#5B46F6] text-white rounded-2xl p-3.5 shadow-float flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all animate-in slide-in-from-bottom-4 duration-200"
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

          <div className="flex items-center gap-1.5 bg-white text-[#5B46F6] px-4 py-2 rounded-xl font-bold text-xs md:text-sm shadow-sm">
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
              {cart.map((item) => {
                const unitConfig = detectUnitConfig(item);
                const activeUnit = item.selectedUnit || unitConfig.baseUnit;
                const isMultiUnit = unitConfig.mode === 'weight_g' || unitConfig.mode === 'volume_ml';
                const isFractional = unitConfig.mode === 'fractional';
                const isWeightOrVolume = isMultiUnit || isFractional;

                return (
                  <div key={item.id} className="py-2.5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-bold text-slate-900 truncate">{item?.name || 'Item'}</h5>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                            {item.sku}
                          </span>
                          {isWeightOrVolume && (
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.2 rounded shrink-0">
                              Sold by {unitConfig.baseUnit}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-50 cursor-pointer shrink-0"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {/* Quantity & Unit Pill (Opens Modal) */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditItemModal(item)}
                          className="group/qty inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-indigo-950 font-mono transition-colors cursor-pointer shrink-0"
                          title="Click to change quantity or unit in modal"
                        >
                          <span>{formatQuantityWithUnit(item.quantity, activeUnit, unitConfig)}</span>
                          <Pencil className="w-2.5 h-2.5 text-indigo-500 group-hover/qty:text-indigo-700" />
                        </button>

                        {/* Unit Price: Clickable Inline Editor / Active Input */}
                        {editingItemId === item.id ? (
                          <div className="relative inline-flex items-center gap-1" data-inline-price="true">
                            <span className="text-[10px] font-bold font-mono text-slate-400">LKR</span>
                            <input
                              ref={inlinePriceInputRef}
                              type="number"
                              step="0.01"
                              min="0"
                              data-inline-price-input="true"
                              value={editingPriceInput}
                              onChange={(e) => setEditingPriceInput(e.target.value)}
                              onBlur={() => handleSaveEditPrice(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSaveEditPrice(item.id);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCancelEditPrice();
                                }
                              }}
                              className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold text-slate-900 bg-white border border-[#5B46F6] rounded-md focus:outline-none focus:ring-2 focus:ring-[#5B46F6]/20 shadow-xs"
                            />
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSaveEditPrice(item.id);
                              }}
                              className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              title="Save unit price"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditPrice(item)}
                              className="group/rate inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-[11px] font-mono font-medium text-slate-700 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                              title="Click to edit unit price for this bill only"
                            >
                              <span>
                                LKR {item.price.toFixed(2)}
                                {isWeightOrVolume ? `/${unitConfig.baseUnit}` : ''}
                              </span>
                              <Pencil className="w-2.5 h-2.5 text-slate-400 group-hover/rate:text-[#5B46F6]" />
                            </button>

                            {item.price !== item.originalUnitPrice && (
                              <div className="inline-flex items-center gap-1 shrink-0">
                                <span className="text-[9px] font-bold text-amber-700 bg-amber-100/90 border border-amber-200 px-1 py-0.2 rounded font-sans">
                                  Edited
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleResetUnitPrice(item.id)}
                                  className="p-1 text-slate-400 hover:text-[#5B46F6] hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                                  title={`Reset to catalog price (LKR ${item.originalUnitPrice.toFixed(2)})`}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                          LKR {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                className="w-full bg-[#5B46F6] hover:bg-[#4A35E5] text-white font-bold text-base py-4 rounded-2xl shadow-lg shadow-[#5B46F6]/20 flex items-center justify-center gap-2"
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

      {/* 8. Checkout & Payment Confirmation Modal */}
      {isCheckoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirm & Complete Sale</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} items • {selectedCustomer?.name || 'Walk-in Customer'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              {/* Total Payable Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7052FF]/10 via-[#7052FF]/5 to-transparent border border-[#7052FF]/20 flex items-baseline justify-between">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7052FF]">
                    Total Payable
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono text-slate-950">
                    LKR {totalAmount.toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {discountType !== 'NONE' && (
                    <span className="text-emerald-600 font-semibold block">Discount Applied</span>
                  )}
                  <span>Cashier: {cashierName}</span>
                </div>
              </div>

              {/* Payment Method Selector Tabs */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'CASH' as const, label: 'Cash', icon: Banknote },
                    { id: 'CARD' as const, label: 'Card', icon: CreditCard },
                    { id: 'LANKA_QR' as const, label: 'LankaQR', icon: QrCode },
                    { id: 'STORE_CREDIT' as const, label: 'Credit', icon: User },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isActive = checkoutPaymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setCheckoutPaymentMethod(m.id);
                          setCheckoutError(null);
                        }}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-[#7052FF] text-white border-[#7052FF] shadow-md shadow-[#7052FF]/25'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode-Specific Body */}
              {checkoutPaymentMethod === 'CASH' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Cash Received Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700">Cash Received (LKR)</label>
                      <span className="text-[11px] text-slate-400">Type or click quick-fill bills</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        LKR
                      </span>
                      <input
                        ref={cashInputRef}
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={cashTendered}
                        onChange={(e) => {
                          setCashTendered(e.target.value);
                          setCheckoutError(null);
                        }}
                        placeholder={totalAmount.toFixed(2)}
                        className="w-full pl-13 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-lg font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7052FF]/30 focus:border-[#7052FF] transition-all"
                      />
                    </div>
                  </div>

                  {/* Quick-Fill Pills */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Quick Amount
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Exact', value: totalAmount.toFixed(2) },
                        { label: '500', value: '500' },
                        { label: '1,000', value: '1000' },
                        { label: '2,000', value: '2000' },
                        { label: '5,000', value: '5000' },
                        { label: '10,000', value: '10000' },
                      ].map((pill) => (
                        <button
                          key={pill.label}
                          type="button"
                          onClick={() => {
                            setCashTendered(pill.value);
                            setCheckoutError(null);
                            cashInputRef.current?.focus();
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            cashTendered === pill.value
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Change / Balance Calculation */}
                  {(() => {
                    const tendered = parseFloat(cashTendered) || 0;
                    const change = Math.max(0, tendered - totalAmount);
                    const remaining = Math.max(0, totalAmount - tendered);

                    if (tendered >= totalAmount) {
                      return (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span className="text-xs font-extrabold uppercase tracking-wider">
                              Change to Return
                            </span>
                          </div>
                          <span className="text-xl font-black font-mono text-emerald-700">
                            LKR {change.toFixed(2)}
                          </span>
                        </div>
                      );
                    }

                    if (tendered > 0) {
                      return (
                        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <span className="text-xs font-extrabold uppercase tracking-wider">
                              Remaining Due
                            </span>
                          </div>
                          <span className="text-lg font-black font-mono text-amber-700">
                            LKR {remaining.toFixed(2)}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-xs text-center font-medium">
                        Enter cash received to calculate customer balance
                      </div>
                    );
                  })()}
                </div>
              )}

              {checkoutPaymentMethod === 'CARD' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <CreditCard className="w-4 h-4 text-[#7052FF]" />
                    <span>Card Terminal Payment</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Swipe, insert, or tap the customer’s Visa / Mastercard / Amex on the POS payment terminal. Ensure approval response on the terminal before confirming.
                  </p>
                  <div className="pt-1 flex justify-between font-mono font-bold text-slate-800">
                    <span>Charge Amount:</span>
                    <span>LKR {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {checkoutPaymentMethod === 'LANKA_QR' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <QrCode className="w-4 h-4 text-[#7052FF]" />
                    <span>LankaQR Instant Mobile Pay</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Prompt customer to scan the merchant LankaQR dynamic display code using any Sri Lankan bank app (BOC, Commercial Bank, Sampath Vishwa, FriMi, Genie, etc.).
                  </p>
                  <div className="pt-1 flex justify-between font-mono font-bold text-slate-800">
                    <span>Payable Amount:</span>
                    <span>LKR {totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {checkoutPaymentMethod === 'STORE_CREDIT' && (
                <div className="space-y-3">
                  {!selectedCustomer ? (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Customer Profile Required for Credit</span>
                      </div>
                      <p className="text-amber-800">
                        Please attach an active customer account with an approved credit limit before proceeding with a store credit sale.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="mt-1 w-full bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold py-2 rounded-xl text-xs cursor-pointer"
                      >
                        Select or Add Customer
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs space-y-2">
                      <div className="flex justify-between font-bold text-slate-900 text-sm">
                        <span>{selectedCustomer.name}</span>
                        <span className="text-[#7052FF] font-mono">
                          Limit: LKR {Number(selectedCustomer.creditLimit || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Current Balance (ණය):</span>
                        <span className="font-mono font-bold text-rose-600">
                          LKR {Number(selectedCustomer.currentBalance || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Available Credit:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          LKR {Math.max(0, Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.currentBalance || 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Banner */}
              {checkoutError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in shake duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Checkout Transaction Failed</span>
                    <span className="text-rose-600 leading-tight">{checkoutError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/80 space-y-2.5">
              <button
                type="button"
                onClick={() => executeCheckout(true)}
                disabled={
                  isProcessingCheckout ||
                  (checkoutPaymentMethod === 'CASH' && (parseFloat(cashTendered) || 0) < totalAmount) ||
                  (checkoutPaymentMethod === 'STORE_CREDIT' && !selectedCustomer)
                }
                className="w-full bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-[0.99] disabled:opacity-40 text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-[#7052FF]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {isProcessingCheckout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving to Database & Processing...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Confirm Sale & Print Receipt [Enter]</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => executeCheckout(false)}
                  disabled={
                    isProcessingCheckout ||
                    (checkoutPaymentMethod === 'CASH' && (parseFloat(cashTendered) || 0) < totalAmount) ||
                    (checkoutPaymentMethod === 'STORE_CREDIT' && !selectedCustomer)
                  }
                  className="bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-200 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Confirm (No Print)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  disabled={isProcessingCheckout}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs py-3 rounded-xl transition-all cursor-pointer"
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Spacious Quantity & Unit Selector Modal */}
      {quantityModalTarget && (
        <QuantityUnitModal
          isOpen={!!quantityModalTarget}
          onClose={() => setQuantityModalTarget(null)}
          product={quantityModalTarget.product}
          cartItemId={quantityModalTarget.cartItemId}
          initialUnit={quantityModalTarget.initialUnit}
          initialDisplayQuantity={quantityModalTarget.initialDisplayQuantity}
          initialCustomPrice={quantityModalTarget.initialCustomPrice}
          onConfirm={handleConfirmQuantityModal}
        />
      )}
    </div>
  );
}
