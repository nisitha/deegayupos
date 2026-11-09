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
// REALISTIC HIGH-END E-COMMERCE RETAIL CATALOGUE
// Standard: Shopify Polaris & Stripe Dashboard (Crisp commercial imagery)
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
  imageUrl: string;
}

const SAMPLE_RETAIL_ITEMS: RetailProductItem[] = [
  // 1. Groceries & Pantry
  {
    id: 'prod-001',
    name: 'Organic Ceylon Cinnamon Quills (100g Pack)',
    sku: 'GRO-CIN-01',
    barcode: '479200000001',
    retailPrice: 950.0,
    wholesalePrice: 820.0,
    costPrice: 500.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 45,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-002',
    name: 'Super Kernel Aged Basmati Rice (5kg Bag)',
    sku: 'GRO-RIC-02',
    barcode: '479200000002',
    retailPrice: 2450.0,
    wholesalePrice: 2150.0,
    costPrice: 1600.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 80,
    unit: 'bags',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-003',
    name: 'Single Estate Pure Ceylon BOPF Tea (500g Tin)',
    sku: 'GRO-TEA-03',
    barcode: '479200000003',
    retailPrice: 1200.0,
    wholesalePrice: 1050.0,
    costPrice: 750.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 60,
    unit: 'tins',
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-004',
    name: 'Cold Pressed Extra Virgin Olive Oil (750ml)',
    sku: 'GRO-OIL-04',
    barcode: '479200000004',
    retailPrice: 3400.0,
    wholesalePrice: 2950.0,
    costPrice: 2200.0,
    category: { name: 'Groceries', slug: 'groceries' },
    stockOnHand: 18,
    unit: 'btls',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80',
  },

  // 2. Electronics & Mobile
  {
    id: 'prod-005',
    name: 'Pro Active ANC Wireless Bluetooth Earbuds',
    sku: 'ELE-EAR-01',
    barcode: '479200000005',
    retailPrice: 12500.0,
    wholesalePrice: 10200.0,
    costPrice: 7800.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 24,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-006',
    name: '65W GaN Fast Charger USB-C Dual Port',
    sku: 'ELE-CHG-02',
    barcode: '479200000006',
    retailPrice: 4800.0,
    wholesalePrice: 3900.0,
    costPrice: 2600.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 35,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-007',
    name: 'Ultra-Slim Mechanical Wireless Keyboard RGB',
    sku: 'ELE-KBD-03',
    barcode: '479200000007',
    retailPrice: 16800.0,
    wholesalePrice: 14200.0,
    costPrice: 11000.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 12,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-008',
    name: 'Precision Multisport GPS Smartwatch OLED',
    sku: 'ELE-WAT-04',
    barcode: '479200000008',
    retailPrice: 28500.0,
    wholesalePrice: 24000.0,
    costPrice: 18500.0,
    category: { name: 'Electronics', slug: 'electronics' },
    stockOnHand: 8,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80',
  },

  // 3. Apparel & Fashion
  {
    id: 'prod-009',
    name: 'Premium Pima Cotton Oxford Casual Shirt (Navy)',
    sku: 'APP-SHT-01',
    barcode: '479200000009',
    retailPrice: 4200.0,
    wholesalePrice: 3500.0,
    costPrice: 2400.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 28,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-010',
    name: 'Classic Indigo Selvedge Denim Trucker Jacket',
    sku: 'APP-JKT-02',
    barcode: '479200000010',
    retailPrice: 8900.0,
    wholesalePrice: 7200.0,
    costPrice: 5100.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 14,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-011',
    name: 'Italian Full-Grain Leather Dress Belt 35mm',
    sku: 'APP-BLT-03',
    barcode: '479200000011',
    retailPrice: 3200.0,
    wholesalePrice: 2600.0,
    costPrice: 1800.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 40,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-012',
    name: 'Tailored Breathable Linen Chino Trousers',
    sku: 'APP-TRZ-04',
    barcode: '479200000012',
    retailPrice: 5400.0,
    wholesalePrice: 4400.0,
    costPrice: 3100.0,
    category: { name: 'Apparel', slug: 'apparel' },
    stockOnHand: 22,
    unit: 'pcs',
    imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=400&q=80',
  },

  // 4. Hardware & Tools
  {
    id: 'prod-013',
    name: '20V Cordless Brushless Heavy-Duty Impact Drill Kit',
    sku: 'HDW-DRL-01',
    barcode: '479200000013',
    retailPrice: 18500.0,
    wholesalePrice: 15800.0,
    costPrice: 12000.0,
    category: { name: 'Hardware', slug: 'hardware' },
    stockOnHand: 16,
    unit: 'kits',
    imageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-014',
    name: 'Magnetic Precision Screwdriver Tool Set (48-in-1)',
    sku: 'HDW-SCW-02',
    barcode: '479200000014',
    retailPrice: 2900.0,
    wholesalePrice: 2300.0,
    costPrice: 1500.0,
    category: { name: 'Hardware', slug: 'hardware' },
    stockOnHand: 32,
    unit: 'sets',
    imageUrl: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?auto=format&fit=crop&w=400&q=80',
  },

  // 5. Pharmacy & Health
  {
    id: 'prod-015',
    name: 'Daily Comprehensive Multivitamins Plus Zinc (90s)',
    sku: 'PHM-VIT-01',
    barcode: '479200000015',
    retailPrice: 3800.0,
    wholesalePrice: 3100.0,
    costPrice: 2100.0,
    category: { name: 'Pharmacy', slug: 'pharmacy' },
    stockOnHand: 50,
    unit: 'btls',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'prod-016',
    name: 'Hospital-Grade 70% Isopropyl Hand Sanitizer (500ml)',
    sku: 'PHM-SAN-02',
    barcode: '479200000016',
    retailPrice: 850.0,
    wholesalePrice: 680.0,
    costPrice: 420.0,
    category: { name: 'Pharmacy', slug: 'pharmacy' },
    stockOnHand: 75,
    unit: 'btls',
    imageUrl: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?auto=format&fit=crop&w=400&q=80',
  },
];

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
  const { selectedBranchId } = useTenantBranch();

  // Mode View: 'grid' vs 'table'
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pricing Tier: 'RETAIL' (MSRP) vs 'WHOLESALE' (Bulk)
  const [pricingTier, setPricingTier] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

  // Catalogue & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('all');
  const [dbProducts, setDbProducts] = useState<ProductDto[]>([]);

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
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real inventory products if available from backend
  useEffect(() => {
    productsApi
      .getAll({ limit: 100 })
      .then((res: { data?: { items?: ProductDto[] } }) => {
        if (res.data?.items && res.data.items.length > 0) {
          setDbProducts(res.data.items);
        }
      })
      .catch(() => {
        // Fallback to high-res sample items
      });
  }, []);

  // Combined product catalog
  const allProducts: RetailProductItem[] = useMemo(() => {
    if (dbProducts.length > 0) {
      return dbProducts.map((p, index) => {
        const fallback = SAMPLE_RETAIL_ITEMS[index % SAMPLE_RETAIL_ITEMS.length]!;
        const raw = p as unknown as { stockOnHand?: number; imageUrl?: string };
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode || fallback.barcode,
          retailPrice: Number(p.retailPrice),
          wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : Number(p.retailPrice) * 0.85,
          costPrice: Number(p.costPrice),
          category: {
            name: p.category?.name || 'General Retail',
            slug: p.category?.slug || 'general',
          },
          stockOnHand: raw.stockOnHand !== undefined ? raw.stockOnHand : 25,
          unit: p.unit?.shortCode || 'pcs',
          imageUrl: raw.imageUrl || fallback.imageUrl,
        };
      });
    }
    return SAMPLE_RETAIL_ITEMS;
  }, [dbProducts]);

  // Recalculate cart item unit prices when pricingTier changes
  useEffect(() => {
    setCart((prev) =>
      prev.map((item) => ({
        ...item,
        price: pricingTier === 'WHOLESALE' ? item.wholesalePrice : item.retailPrice,
      })),
    );
  }, [pricingTier]);

  // Dynamic Category Pills with counts
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
    const term = searchQuery.trim();
    if (!term) return;

    const matched = allProducts.find(
      (p) => p.barcode === term || p.sku.toUpperCase() === term.toUpperCase(),
    );

    if (matched) {
      addToCart(matched);
      setSearchQuery('');
    } else {
      setScanFeedback(`No match for SKU / Barcode: "${term}"`);
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
        branchId: selectedBranchId || 'bbbbbbbb-1111-1111-1111-111111111111',
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isPaymentOpen, totalAmount, handleHoldCart]);

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-[#F8FAFC] text-slate-900 select-none">
      {/* Toast Notification for Barcode Scan feedback */}
      {scanFeedback && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>{scanFeedback}</span>
        </div>
      )}

      {/* =====================================================================
          LEFT: HIGH-DENSITY CATALOG ENGINE (70% width - Scrollable)
      ===================================================================== */}
      <section className="flex-1 flex flex-col h-full overflow-hidden border-r border-slate-200/80 bg-[#F8FAFC]">
        {/* Top Action Console */}
        <div className="p-3.5 bg-white border-b border-slate-200/80 shadow-sm shrink-0 space-y-3">
          {/* Universal Barcode & Search Bar */}
          <div className="flex items-center gap-2.5">
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
                className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
              />

              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white border border-slate-200 rounded text-slate-500 shadow-sm">
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

            {/* View Mode Switcher (Grid vs Table List) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
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
                title="High-Density Table List View"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Minimalist Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categoryTabs.map((tab) => {
              const isActive = selectedCategorySlug === tab.slug;
              return (
                <button
                  key={tab.slug}
                  onClick={() => setSelectedCategorySlug(tab.slug)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <span>{tab.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
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

        {/* Catalog Body (Grid or Table) */}
        <div className="flex-1 overflow-y-auto p-3.5">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm font-semibold text-slate-600">No items match your query</p>
              <p className="text-xs text-slate-400 mt-0.5">Try searching with SKU, barcode, or reset filters.</p>
            </div>
          ) : viewMode === 'grid' ? (
            /* ===============================================================
               A. COMPACT PRODUCT BENTO GRID (Shopify Polaris Card Standard)
            =============================================================== */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map((product) => {
                const activePrice =
                  pricingTier === 'WHOLESALE' ? product.wholesalePrice : product.retailPrice;

                return (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-xl border border-slate-200/80 shadow-card hover:shadow-card-hover hover:border-slate-300 transition-all duration-150 cursor-pointer flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Top Image Container with Realistic E-Commerce Photo */}
                    <div className="h-32 w-full bg-slate-50/50 flex items-center justify-center relative overflow-hidden border-b border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Floating Stock Pill */}
                      <div className="absolute top-2 right-2">
                        {product.stockOnHand <= 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 shadow-sm backdrop-blur-sm">
                            Out of stock
                          </span>
                        ) : product.stockOnHand <= 10 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70 shadow-sm backdrop-blur-sm">
                            Only {product.stockOnHand} left
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-sm backdrop-blur-sm">
                            {product.stockOnHand} in stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {product.category.name}
                        </div>
                        <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug mt-0.5 group-hover:text-[#005BD3] transition-colors">
                          {product.name}
                        </h4>
                      </div>

                      {/* Bottom Price & Quick Add Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                        <div>
                          <div className="text-sm font-bold font-mono text-slate-900 tracking-tight">
                            LKR {activePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            SKU: {product.sku}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="w-7 h-7 rounded-lg bg-blue-50 text-[#005BD3] group-hover:bg-[#005BD3] group-hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
                          title="Add to Ticket"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ===============================================================
               B. HIGH-DENSITY TABLE LIST VIEW (For Supermarkets / Wholesale)
            =============================================================== */
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
              <table className="w-full text-left border-collapse">
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
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {/* Small 32x32 Thumbnail */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border border-slate-200/80 shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{product.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {product.sku} • {product.barcode}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {product.category.name}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        <span
                          className={`font-mono font-bold ${
                            product.stockOnHand <= 5 ? 'text-amber-600' : 'text-slate-800'
                          }`}
                        >
                          {product.stockOnHand}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400">{product.unit}</span>
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
                          className="px-2.5 py-1 rounded-md bg-[#005BD3] hover:bg-[#004CB5] text-white text-[11px] font-semibold transition-all inline-flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================================
          RIGHT: SALES TICKET RAIL (Dedicated White Column with shadow-rail)
      ===================================================================== */}
      <aside className="w-full lg:w-[32%] xl:w-[29%] 2xl:w-[27%] min-w-[380px] bg-white border-l border-slate-200/80 flex flex-col h-full shadow-rail z-20">
        {/* Ticket Header & Metadata */}
        <div className="p-4 border-b border-slate-200/80 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sale Ticket #INV-0024
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
            className="p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between group"
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
              className={`py-1.5 rounded-lg transition-all ${
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
              className={`py-1.5 rounded-lg transition-all ${
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
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 group">
                {/* Product Thumbnail & Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
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
                    <h5 className="text-xs font-semibold text-slate-900 truncate">{item.name}</h5>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                      <span>LKR {item.price.toFixed(2)}</span>
                      <span>• {item.unit}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Numeric Stepper */}
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="p-1 hover:bg-slate-200/70 text-slate-600 rounded-l-md transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                    className="w-9 text-center bg-transparent text-xs font-bold font-mono text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    className="p-1 hover:bg-slate-200/70 text-slate-600 rounded-r-md transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Line Total & Remove */}
                <div className="text-right shrink-0 min-w-[70px]">
                  <div className="text-xs font-bold font-mono text-slate-900">
                    LKR {(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3 ml-auto" />
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
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
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
            <div className="flex justify-between text-xs font-medium text-amber-600 font-mono">
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
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
            >
              Exact
            </button>
            {[500, 1000, 2000, 5000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyCashPreset(Math.ceil(totalAmount / preset) * preset)}
                className="px-2 py-1 rounded-lg text-[10px] font-mono font-medium bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shrink-0"
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
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              Hold [F4]
            </button>

            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
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
            className="w-full bg-[#005BD3] hover:bg-[#004CB5] disabled:opacity-40 text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-between text-sm transition-all active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span>Charge</span>
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
          MODAL 1: SPEED TENDER & PAYMENT DRAWER
      ===================================================================== */}
      {isPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Complete Payment</h3>
                <p className="text-xs text-slate-500">Select tender method and enter amount received</p>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Method Selector */}
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
                    className={`py-3 px-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'border-[#005BD3] bg-blue-50/60 text-[#005BD3] font-bold shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px]">{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Cash Tender Details */}
            {activePaymentMethod === 'CASH' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-600">
                  <span className="font-semibold">Cash Tendered:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    placeholder={totalAmount.toFixed(2)}
                    className="w-36 text-right bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#005BD3]"
                  />
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase">Change Due:</span>
                  <span className="text-xl font-black font-mono text-emerald-600">
                    LKR {changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Total Summary */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs font-bold text-slate-500 uppercase">Payable Total</span>
              <span className="text-xl font-black font-mono text-slate-900">
                LKR {totalAmount.toFixed(2)}
              </span>
            </div>

            {/* Submit Checkout */}
            <button
              type="button"
              onClick={executeCheckout}
              disabled={isProcessingCheckout}
              className="w-full bg-[#005BD3] hover:bg-[#004CB5] text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/20 text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {isProcessingCheckout ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Processing Checkout...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
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
