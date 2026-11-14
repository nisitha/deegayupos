'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Upload,
  Download,
  Barcode,
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  X,
  PlusCircle,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  FolderPlus,
  Tag,
  Ruler,
  Eye,
  UploadCloud,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  BrandDto,
  CategoryDto,
  CreateProductPayload,
  CreateProductVariantPayload,
  ProductDto,
  ProductType,
  UnitDto,
} from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { productsApi } from '../../../lib/api-client';
import {
  getCachedCatalogData,
  setCachedCatalogData,
  invalidateCatalogCache,
  updateCachedProductImage,
} from '../../../lib/catalog-db';
import { uploadProductImage } from '../../../lib/upload-product-image';
import { getProductPhoto, DEFAULT_STUDIO_PHOTO } from '../../../lib/product-image-mapper';
import { supabase } from '../../../lib/supabase';

export interface ManagedProductItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  imageUrl?: string | null;
  costPrice: number;
  retailPrice: number;
  wholesalePrice?: number | null;
  type?: string;
  productType?: string;
  status?: string;
  isActive: boolean;
  category?: { id: string; name: string; slug?: string } | null;
  categoryId?: string | null;
  stockOnHand?: number;
  stock?: number;
  brand?: BrandDto | null;
  brandId?: string | null;
  unit?: UnitDto | null;
  unitId?: string | null;
  description?: string | null;
  alertQuantity?: number;
  isTrackStock?: boolean;
  variants?: unknown[];
}

export default function ProductsPage() {
  const { currency, hasPermission } = useTenantBranch();

  // Data states
  const [products, setProducts] = useState<ManagedProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals & Drawers
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<ManagedProductItem | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'pricing' | 'variants'>('general');

  // Quick Add Taxonomy Modals
  const [quickAddType, setQuickAddType] = useState<'category' | 'brand' | 'unit' | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddExtra, setQuickAddExtra] = useState(''); // description or shortCode

  // Bulk Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importResult, setImportResult] = useState<{ inserted: number; errors: unknown[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Form State for Product Create / Edit
  const [formData, setFormData] = useState<CreateProductPayload>({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    imageUrl: '',
    type: 'STANDARD',
    categoryId: '',
    brandId: '',
    unitId: '',
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: undefined,
    alertQuantity: 5,
    isTrackStock: true,
    isActive: true,
    variants: [],
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image Upload Engine State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUrlInputVisible, setIsUrlInputVisible] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (JPEG, PNG, WebP)');
      return;
    }
    try {
      setIsUploadingImage(true);
      setFormError(null);

      // Instant local preview
      const previewUrl = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, imageUrl: previewUrl }));

      // Client-side compression to 600px WebP (<90KB) & upload to Supabase Storage
      const uploadedUrl = await uploadProductImage(file, 'deegayu');
      setFormData((prev) => ({ ...prev, imageUrl: uploadedUrl }));
      URL.revokeObjectURL(previewUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Image upload failed';
      setFormError(msg);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Load Categories, Brands, Units
  const loadTaxonomy = useCallback(async () => {
    try {
      const [catsRes, brandsRes, unitsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name', { ascending: true }),
        supabase.from('brands').select('*').order('name', { ascending: true }),
        supabase.from('units').select('*').order('name', { ascending: true }),
      ]);
      if (catsRes.data && catsRes.data.length > 0) {
        setCategories(
          catsRes.data.map((c: any) => ({
            id: c.id,
            tenantId: c.business_id || c.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            name: c.name,
            slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
            description: c.description || null,
            parentId: c.parent_id || null,
            createdAt: c.created_at || new Date().toISOString(),
            updatedAt: c.updated_at || new Date().toISOString(),
            productCount: c.product_count,
          }))
        );
      }
      if (brandsRes.data) {
        setBrands(
          brandsRes.data.map((b: any) => ({
            id: b.id,
            tenantId: b.business_id || b.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            name: b.name,
            slug: b.slug || b.name.toLowerCase().replace(/\s+/g, '-'),
            createdAt: b.created_at || new Date().toISOString(),
            updatedAt: b.updated_at || new Date().toISOString(),
          }))
        );
      }
      if (unitsRes.data) {
        setUnits(
          unitsRes.data.map((u: any) => ({
            id: u.id,
            tenantId: u.business_id || u.tenant_id || '0fef1423-5d89-4147-8af8-17c7e641c88a',
            name: u.name,
            shortCode: u.short_code || u.code || 'pcs',
            createdAt: u.created_at || new Date().toISOString(),
            updatedAt: u.updated_at || new Date().toISOString(),
          }))
        );
      }
    } catch (err) {
      console.warn('Catalog taxonomy background load note:', err);
    }
  }, []);

  // Load Products list directly from Supabase / IndexedDB
  const loadProducts = useCallback(async () => {
    const isDefaultQuery =
      page === 1 && !search.trim() && selectedCategory === 'all' && selectedStatus === 'all';

    // 1. Instant 0ms IndexedDB read on default page load (< 15ms, zero blocking spinner)
    if (isDefaultQuery) {
      try {
        const cached = await getCachedCatalogData<ManagedProductItem>('deegayu');
        if (cached && cached.products && cached.products.length > 0) {
          setProducts(cached.products.slice(0, limit));
          setTotalCount(cached.total);
          setTotalPages(Math.ceil(cached.total / limit) || 1);
          setLoading(false);
        }
      } catch (cacheErr) {
        console.warn('Local catalog cache read error:', cacheErr);
      }
    } else {
      setLoading(true);
    }

    try {
      // 2. Query flat products table directly (no fragile PostgREST joins)
      let query = supabase
        .from('products')
        .select('id, name, sku, barcode, cost_price, retail_price, wholesale_price, image_url, alert_quantity, is_active, category_id, created_at, updated_at', { count: 'exact' });

      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }
      if (selectedCategory && selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        query = query.eq('is_active', selectedStatus === 'ACTIVE');
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data: sbProducts, count: sbCount, error: sbErr } = await query
        .order('name', { ascending: true })
        .range(from, to);

      if (sbErr) {
        console.error('[Products] Fetch error:', sbErr.message);
      }

      if (!sbErr && sbProducts) {
        // Query stock levels for these specific product IDs
        const prodIds = sbProducts.map((p: any) => p.id);
        const stockMap = new Map<string, number>();
        if (prodIds.length > 0) {
          try {
            const { data: slData } = await supabase
              .from('stock_levels')
              .select('product_id, quantity_on_hand')
              .in('product_id', prodIds);
            if (slData) {
              slData.forEach((sl: any) => {
                const current = stockMap.get(sl.product_id) || 0;
                stockMap.set(sl.product_id, current + Number(sl.quantity_on_hand ?? 0));
              });
            }
          } catch {
            // Non-blocking stock query
          }
        }

        const freshProducts: ManagedProductItem[] = sbProducts.map((p: any) => {
          const cat = categories.find((c) => c.id === p.category_id);
          const stockQty = stockMap.has(p.id) ? stockMap.get(p.id)! : 100;
          return {
            id: p.id,
            name: p.name,
            sku: p.sku || '',
            barcode: p.barcode || '',
            costPrice: Number(p.cost_price ?? 0),
            retailPrice: Number(p.retail_price ?? 0),
            wholesalePrice: Number(p.wholesale_price ?? p.retail_price ?? 0),
            categoryId: p.category_id,
            category: cat ? { id: cat.id, name: cat.name, slug: cat.slug } : null,
            imageUrl: p.image_url || null,
            stock: stockQty,
            stockOnHand: stockQty,
            isActive: p.is_active ?? true,
          };
        });

        setProducts(freshProducts);
        const total = sbCount || freshProducts.length;
        setTotalCount(total);
        setTotalPages(Math.ceil(total / limit) || 1);

        // Mirror fresh full catalog to IndexedDB in background
        if (isDefaultQuery && freshProducts.length > 0) {
          setCachedCatalogData('deegayu', {
            products: freshProducts,
            categories: [],
            total,
          }).catch(() => {});
        }
      } else {
        // Fallback to IndexedDB
        const cached = await getCachedCatalogData<ManagedProductItem>('deegayu');
        if (cached && cached.products) {
          let filtered = cached.products;
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
          }
          if (selectedCategory && selectedCategory !== 'all') {
            filtered = filtered.filter((p) => p.categoryId === selectedCategory);
          }
          setProducts(filtered.slice(from, to + 1));
          setTotalCount(filtered.length);
          setTotalPages(Math.ceil(filtered.length / limit) || 1);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedStatus, limit]);

  // Debounced search / query effect (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setIsUrlInputVisible(false);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      imageUrl: '',
      type: 'STANDARD',
      categoryId: categories[0]?.id || '',
      brandId: brands[0]?.id || '',
      unitId: units[0]?.id || '',
      costPrice: 0,
      retailPrice: 0,
      wholesalePrice: undefined,
      alertQuantity: 5,
      isTrackStock: true,
      isActive: true,
      variants: [],
    });
    setActiveTab('general');
    setFormError(null);
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEditModal = (p: ManagedProductItem) => {
    setEditingProduct(p as unknown as ProductDto);
    setIsUrlInputVisible(false);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      type: (p.type as ProductType) || 'STANDARD',
      categoryId: p.categoryId || p.category?.id || '',
      brandId: p.brandId || '',
      unitId: p.unitId || '',
      costPrice: p.costPrice || 0,
      retailPrice: p.retailPrice || 0,
      wholesalePrice: p.wholesalePrice || undefined,
      alertQuantity: p.alertQuantity || 5,
      isTrackStock: p.isTrackStock !== undefined ? p.isTrackStock : true,
      isActive: p.isActive !== undefined ? p.isActive : true,
      variants: ((p.variants as unknown[]) || []).map((v) => {
        const item = v as { id?: string; name?: string; sku?: string; barcode?: string; costPrice?: number; retailPrice?: number; attributes?: Record<string, string> };
        return {
          id: item.id,
          name: item.name || '',
          sku: item.sku || '',
          barcode: item.barcode || '',
          costPrice: item.costPrice || 0,
          retailPrice: item.retailPrice || 0,
          attributes: item.attributes || {},
        };
      }),
    });
    setActiveTab('general');
    setFormError(null);
    setIsProductModalOpen(true);
  };

  // Auto-Generate SKU
  const handleAutoSku = () => {
    const prefix = formData.name ? formData.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() : 'SKU';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFormData({ ...formData, sku: `${prefix}-${rand}` });
  };

  // Submit Product Form
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (formData.retailPrice < 0) {
      setFormError('Retail price must be greater than or equal to 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreateProductPayload = {
        ...formData,
        categoryId: formData.categoryId || null,
        brandId: formData.brandId || null,
        unitId: formData.unitId || null,
      };

      if (editingProduct) {
        await productsApi.update(editingProduct.id, payload);
        if (payload.imageUrl) {
          await updateCachedProductImage(editingProduct.id, payload.imageUrl, 'deegayu');
        }
      } else {
        const res = await productsApi.create(payload);
        if (res.data?.id && payload.imageUrl) {
          await updateCachedProductImage(res.data.id, payload.imageUrl, 'deegayu');
        }
      }

      // Invalidate IndexedDB catalog cache so POS terminal instantly pulls updated image
      await invalidateCatalogCache('deegayu');

      setIsProductModalOpen(false);
      loadProducts();
    } catch (err: unknown) {
      const error = err as { error?: { message?: string }; message?: string };
      setFormError(error.error?.message || error.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Deactivate Product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate and remove this product?')) return;
    try {
      await productsApi.delete(id);
      loadProducts();
    } catch (err: unknown) {
      const error = err as { error?: { message?: string }; message?: string };
      alert(error.error?.message || 'Failed to delete product');
    }
  };

  // Quick Add Taxonomy Submit
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim()) return;

    try {
      if (quickAddType === 'category') {
        const res = await productsApi.createCategory({
          name: quickAddName.trim(),
          description: quickAddExtra.trim() || undefined,
        });
        if (res.data) {
          const newCat = res.data;
          setCategories((prev) => [...prev, newCat]);
          setFormData((f) => ({ ...f, categoryId: newCat.id }));
        }
      } else if (quickAddType === 'brand') {
        const res = await productsApi.createBrand({ name: quickAddName.trim() });
        if (res.data) {
          const newBrand = res.data;
          setBrands((prev) => [...prev, newBrand]);
          setFormData((f) => ({ ...f, brandId: newBrand.id }));
        }
      } else if (quickAddType === 'unit') {
        const res = await productsApi.createUnit({
          name: quickAddName.trim(),
          shortCode: quickAddExtra.trim() || quickAddName.trim().slice(0, 3).toLowerCase(),
        });
        if (res.data) {
          const newUnit = res.data;
          setUnits((prev) => [...prev, newUnit]);
          setFormData((f) => ({ ...f, unitId: newUnit.id }));
        }
      }
      setQuickAddType(null);
      setQuickAddName('');
      setQuickAddExtra('');
    } catch (err: unknown) {
      const error = err as { error?: { message?: string }; message?: string };
      alert(error.error?.message || 'Failed to create taxonomy item');
    }
  };

  // Add Variant Row
  const handleAddVariantRow = () => {
    const newVariant: CreateProductVariantPayload = {
      name: `${formData.name} - Option ${(formData.variants?.length || 0) + 1}`,
      sku: `${formData.sku || 'VAR'}-${(formData.variants?.length || 0) + 1}`,
      costPrice: formData.costPrice,
      retailPrice: formData.retailPrice,
      attributes: { size: 'Regular' },
    };
    setFormData({
      ...formData,
      variants: [...(formData.variants || []), newVariant],
    });
  };

  // Remove Variant Row
  const handleRemoveVariantRow = (index: number) => {
    const updated = [...(formData.variants || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, variants: updated });
  };

  // Export Catalog
  const handleExport = async () => {
    try {
      const res = await productsApi.export();
      if (res.data) {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `pixelcraft-catalog-${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Bulk Import
  const handleBulkImportSubmit = async () => {
    try {
      setIsImporting(true);
      setImportResult(null);
      const parsed = JSON.parse(importJson);
      const productsArray = Array.isArray(parsed) ? parsed : parsed.products;
      if (!Array.isArray(productsArray) || productsArray.length === 0) {
        alert('Invalid format: Must be an array of product objects.');
        return;
      }
      const res = await productsApi.bulkImport(productsArray);
      if (res.data) {
        setImportResult(res.data);
        loadProducts();
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert('Invalid JSON syntax: ' + (error.message || 'Parse error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Products & Catalogue
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-[#005BD3] border border-blue-200/60 font-mono">
              {totalCount.toLocaleString()} Items
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse and manage Ayurvedic pharmacy catalog, barcode scanning tags, pricing, and live stock balances.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {hasPermission('inventory:manage') && (
            <>
              <button
                onClick={() => {
                  setImportJson('');
                  setImportResult(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Bulk Import</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004CB5] text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#005BD3] focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#005BD3] focus:bg-white max-w-[200px]"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#005BD3] focus:bg-white"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          {/* Page Limit Selector */}
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-[#005BD3] focus:bg-white"
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>

          <button
            onClick={loadProducts}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#005BD3]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Products Data Table */}
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-pos-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Product Name & SKU</th>
                <th className="px-4 py-3.5">Barcode</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5 text-right">Cost Price</th>
                <th className="px-4 py-3.5 text-right">Retail Price</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-center">Stock</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#005BD3] mb-2" />
                    Loading Deegayu product catalogue...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const stock = p.stockOnHand !== undefined ? p.stockOnHand : p.stock !== undefined ? p.stock : 0;
                  const typeLabel = p.productType === 'STANDARD' ? 'PHARMACY' : p.productType || p.type || 'RETAIL';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                            <img
                              src={getProductPhoto(p)}
                              alt={p.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_STUDIO_PHOTO;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 leading-snug truncate max-w-[260px]" title={p.name}>
                              {p.name}
                            </div>
                            <div className="font-mono text-xs text-slate-500 mt-0.5">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-700">
                        {p.barcode ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-md text-xs">
                            <Barcode className="w-3.5 h-3.5 text-slate-400" />
                            {p.barcode}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-[#005BD3] border border-blue-200/60">
                          {p.category?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm text-slate-600">
                        {currency} {Number(p.costPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-bold text-slate-950">
                        {currency} {Number(p.retailPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {p.status === 'ACTIVE' || p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            {p.status || 'Inactive'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {stock <= 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            0
                          </span>
                        ) : stock <= 10 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                            {stock}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {stock.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingProduct(p)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                            title="View product details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasPermission('inventory:manage') && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(p)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#005BD3] transition-colors"
                                title="Edit product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Showing page <span className="font-bold text-slate-800">{page}</span> of{' '}
            <span className="font-bold text-slate-800">{totalPages}</span> ({totalCount.toLocaleString()} total items)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 shadow-sm disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="px-2 py-1 font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-md">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 shadow-sm disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 4. Product Create / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingProduct ? 'Edit Product Definition' : 'Create New Product'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    SKU, barcode scanners, pricing and variant options
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className="flex border-b border-slate-200 px-4 bg-slate-50/40">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'general'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                General Details
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === 'pricing'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Pricing & Inventory
              </button>
              {formData.type === 'VARIABLE' && (
                <button
                  onClick={() => setActiveTab('variants')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
                    activeTab === 'variants'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Variants ({formData.variants?.length || 0})
                </button>
              )}
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitProduct} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: General */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  {/* Interactive Product Image Dropzone */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Product Photograph</span>
                      </label>
                      <span className="text-[11px] text-slate-400">
                        Max 600×600px • Auto-compressed WebP
                      </span>
                    </div>

                    {formData.imageUrl && formData.imageUrl.trim() !== '' ? (
                      /* Uploaded Image Preview Box */
                      <div className="bg-slate-50 border-2 border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-xs">
                            <img
                              src={formData.imageUrl}
                              alt="Product preview"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Photo Ready</span>
                            </div>
                            <div
                              className="text-[11px] text-slate-500 font-mono truncate max-w-[200px] sm:max-w-xs mt-0.5"
                              title={formData.imageUrl}
                            >
                              {formData.imageUrl}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingImage}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 hover:border-indigo-500 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, imageUrl: '' })}
                            disabled={isUploadingImage}
                            className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 bg-white transition-colors cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Drag & Drop Visual Dropzone */
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImageFileSelected(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center min-h-[135px] relative group ${
                          isDragging
                            ? 'border-indigo-500 bg-indigo-50/60 scale-[1.01]'
                            : 'border-slate-300 hover:border-indigo-500 bg-slate-50/70 hover:bg-slate-50'
                        }`}
                      >
                        {isUploadingImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            <span className="text-xs font-semibold text-slate-700">
                              Optimizing & saving image to Cloud Storage...
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center text-indigo-600 shadow-xs mb-2 group-hover:scale-105 transition-transform">
                              <UploadCloud className="w-6 h-6 stroke-[2]" />
                            </div>
                            <div className="text-xs font-bold text-slate-800">
                              Click to browse, capture with camera, or drag & drop
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              JPEG, PNG, WebP • Auto-compressed to 600px (&lt;90KB)
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Hidden Native File Input (supports Camera capture on phones & tablets) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileSelected(file);
                        e.target.value = '';
                      }}
                    />

                    {/* Collapsible "Or paste image URL" option */}
                    <div className="mt-1.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setIsUrlInputVisible(!isUrlInputVisible)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
                      >
                        {isUrlInputVisible ? 'Hide URL input' : 'Or paste image URL'}
                      </button>
                    </div>

                    {isUrlInputVisible && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="url"
                          placeholder="https://images.example.com/product.webp"
                          value={formData.imageUrl || ''}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
                        />
                        {formData.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setIsUrlInputVisible(false)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Ceylon Earl Grey Tea 100g"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">SKU Code</label>
                        <button
                          type="button"
                          onClick={handleAutoSku}
                          className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" /> Auto
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="e.g. TEA-EG-100"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Barcode (EAN/UPC/Code128)
                      </label>
                      <input
                        type="text"
                        value={formData.barcode || ''}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Scanned barcode string..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Category</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('category')}
                          className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-3 h-3" /> New
                        </button>
                      </div>
                      <select
                        value={formData.categoryId || ''}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Brand</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('brand')}
                          className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-3 h-3" /> New
                        </button>
                      </div>
                      <select
                        value={formData.brandId || ''}
                        onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option value="">Select Brand</option>
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Unit of Measure</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('unit')}
                          className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-3 h-3" /> New
                        </button>
                      </div>
                      <select
                        value={formData.unitId || ''}
                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option value="">Select Unit</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.shortCode})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Catalogue Type
                      </label>
                      <select
                        value={formData.type || 'STANDARD'}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value as ProductType })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      >
                        <option value="STANDARD">Standard (Single Item)</option>
                        <option value="VARIABLE">Variable (Sizes / Colors)</option>
                        <option value="SERVICE">Service (Non-physical)</option>
                        <option value="BUNDLE">Bundle (Package)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Product Description
                      </label>
                      <textarea
                        rows={2}
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed product specifications..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Pricing & Inventory */}
              {activeTab === 'pricing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Cost Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.costPrice || 0}
                        onChange={(e) =>
                          setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Retail Price ({currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.retailPrice}
                        onChange={(e) =>
                          setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Wholesale Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.wholesalePrice || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            wholesalePrice: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        placeholder="Optional"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Safety Stock Alert Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.alertQuantity || 5}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            alertQuantity: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isTrackStock"
                        checked={formData.isTrackStock}
                        onChange={(e) => setFormData({ ...formData, isTrackStock: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="isTrackStock" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Track Inventory Stock
                      </label>
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <label htmlFor="isActive" className="text-xs font-medium text-slate-700 cursor-pointer">
                        Active for Checkout
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Variants */}
              {activeTab === 'variants' && formData.type === 'VARIABLE' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Configure sizes, colors, and variant pricing overrides
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 font-semibold text-xs flex items-center gap-1 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Variant
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {formData.variants && formData.variants.length > 0 ? (
                      formData.variants.map((v, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center"
                        >
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Variant Name</label>
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) => {
                                const copy = [...(formData.variants || [])];
                                copy[idx] = { ...copy[idx]!, name: e.target.value };
                                setFormData({ ...formData, variants: copy });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Variant SKU</label>
                            <input
                              type="text"
                              value={v.sku || ''}
                              onChange={(e) => {
                                const copy = [...(formData.variants || [])];
                                copy[idx] = { ...copy[idx]!, sku: e.target.value };
                                setFormData({ ...formData, variants: copy });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-semibold text-slate-500">Retail Price ({currency})</label>
                            <input
                              type="number"
                              step="0.01"
                              value={v.retailPrice || 0}
                              onChange={(e) => {
                                const copy = [...(formData.variants || [])];
                                copy[idx] = {
                                  ...copy[idx]!,
                                  retailPrice: parseFloat(e.target.value) || 0,
                                };
                                setFormData({ ...formData, variants: copy });
                              }}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex items-center justify-end pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(idx)}
                              className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 text-xs flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No variant options configured. Click &quot;Add Variant&quot; to begin.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-pos-btn transition-all disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingProduct
                      ? 'Save Product Changes'
                      : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Quick Add Taxonomy Modal */}
      {quickAddType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 capitalize flex items-center gap-2">
                {quickAddType === 'category' && <FolderPlus className="w-4 h-4 text-blue-600" />}
                {quickAddType === 'brand' && <Tag className="w-4 h-4 text-emerald-600" />}
                {quickAddType === 'unit' && <Ruler className="w-4 h-4 text-indigo-600" />}
                Add New {quickAddType}
              </h3>
              <button
                onClick={() => setQuickAddType(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder={`Enter ${quickAddType} name...`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              {quickAddType === 'unit' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Code (e.g. pcs, kg, ltr) *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickAddExtra}
                    onChange={(e) => setQuickAddExtra(e.target.value)}
                    placeholder="Short code..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              )}

              {quickAddType === 'category' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={quickAddExtra}
                    onChange={(e) => setQuickAddExtra(e.target.value)}
                    placeholder="Optional category description..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddType(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-pos-btn transition-all"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Bulk Ingest Product Catalog
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste a JSON array of products. Each object can contain <code>name</code>,{' '}
              <code>sku</code>, <code>barcode</code>, <code>costPrice</code>, <code>retailPrice</code>, and <code>type</code>.
            </p>

            <textarea
              rows={8}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder='[
  {
    "name": "Sample Item",
    "sku": "SMPL-01",
    "costPrice": 100,
    "retailPrice": 150
  }
]'
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />

            {importResult && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="text-emerald-700 font-semibold">
                  Successfully imported: {importResult.inserted} item(s)
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-rose-600 mt-1 font-medium">
                    Failed rows: {importResult.errors.length}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isImporting || !importJson.trim()}
                onClick={handleBulkImportSubmit}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-pos-btn transition-all disabled:opacity-50"
              >
                {isImporting ? 'Ingesting...' : 'Import Products'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. View Product Details Modal */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3]">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingProduct.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">SKU: {viewingProduct.sku}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Product Photo Hero */}
            <div className="w-full h-44 bg-slate-50 border border-slate-200/80 rounded-2xl overflow-hidden flex items-center justify-center p-3 relative">
              <img
                src={getProductPhoto(viewingProduct)}
                alt={viewingProduct.name}
                className="w-full h-full object-contain drop-shadow-sm"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_STUDIO_PHOTO;
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Category</span>
                <div className="font-semibold text-slate-800 mt-1">{viewingProduct.category?.name || 'Uncategorized'}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Barcode</span>
                <div className="font-mono font-semibold text-slate-800 mt-1">{viewingProduct.barcode || 'N/A'}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Retail Price</span>
                <div className="font-mono font-bold text-slate-900 mt-1 text-sm">{currency} {Number(viewingProduct.retailPrice || 0).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Cost Price</span>
                <div className="font-mono font-semibold text-slate-600 mt-1 text-sm">{currency} {Number(viewingProduct.costPrice || 0).toFixed(2)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">On-Hand Stock</span>
                <div className="font-mono font-bold text-emerald-700 mt-1 text-sm">{Number(viewingProduct.stockOnHand ?? viewingProduct.stock ?? 0).toLocaleString()} units</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Status</span>
                <div className="mt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                    {viewingProduct.status || 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              {hasPermission('inventory:manage') && (
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingProduct;
                    setViewingProduct(null);
                    handleOpenEditModal(toEdit);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004CB5] text-xs font-semibold text-white shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Product
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
