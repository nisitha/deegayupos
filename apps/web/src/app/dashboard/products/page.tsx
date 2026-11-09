'use client';

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

export default function ProductsPage() {
  const { currency, hasPermission } = useTenantBranch();

  // Data states
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [brands, setBrands] = useState<BrandDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals & Drawers
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
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

  // Load Categories, Brands, Units
  const loadTaxonomy = useCallback(async () => {
    try {
      const [catsRes, brandsRes, unitsRes] = await Promise.all([
        productsApi.getCategories(),
        productsApi.getBrands(),
        productsApi.getUnits(),
      ]);
      if (catsRes.data) setCategories(catsRes.data);
      if (brandsRes.data) setBrands(brandsRes.data);
      if (unitsRes.data) setUnits(unitsRes.data);
    } catch (err) {
      console.error('Failed to load catalog taxonomy:', err);
    }
  }, []);

  // Load Products list
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await productsApi.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        categoryId: selectedCategory || undefined,
        brandId: selectedBrand || undefined,
        type: selectedType ? (selectedType as ProductType) : undefined,
      });

      if (res.data) {
        setProducts(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.total);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCategory, selectedBrand, selectedType]);

  useEffect(() => {
    loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // Open Add Product Modal
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      description: '',
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
  const handleOpenEditModal = (p: ProductDto) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      description: p.description || '',
      type: p.type,
      categoryId: p.categoryId || '',
      brandId: p.brandId || '',
      unitId: p.unitId || '',
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      wholesalePrice: p.wholesalePrice || undefined,
      alertQuantity: p.alertQuantity,
      isTrackStock: p.isTrackStock,
      isActive: p.isActive,
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode || '',
        costPrice: v.costPrice || 0,
        retailPrice: v.retailPrice || 0,
        attributes: v.attributes || {},
      })),
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
      } else {
        await productsApi.create(payload);
      }

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
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            Products & Catalogue
            <span className="text-xs px-2.5 py-0.5 rounded-full font-normal bg-cyan-950/60 text-cyan-400 border border-cyan-500/20">
              {totalCount} Items
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage your retail inventory, multi-variant options, barcode scanning tags, and pricing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1422] border border-[#1F2C44] text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E1422] border border-[#1F2C44] text-xs font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-zinc-400" />
                <span>Bulk Import</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-semibold text-xs transition-all shadow-md shadow-cyan-950/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="p-4 rounded-xl bg-[#0E1422] border border-[#1F2C44] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#141C2E] border border-[#1F2C44] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="bg-[#141C2E] border border-[#1F2C44] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#141C2E] border border-[#1F2C44] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Product Types</option>
            <option value="STANDARD">Standard</option>
            <option value="VARIABLE">Variable</option>
            <option value="SERVICE">Service</option>
            <option value="BUNDLE">Bundle</option>
          </select>

          <button
            onClick={loadProducts}
            className="p-2 rounded-lg bg-[#141C2E] border border-[#1F2C44] text-zinc-400 hover:text-white"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Products Data Table */}
      <div className="rounded-xl bg-[#0E1422] border border-[#1F2C44] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141C2E]/80 text-zinc-400 uppercase tracking-wider text-[10px] border-b border-[#1F2C44]">
              <tr>
                <th className="px-4 py-3">Product Name & SKU</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">Category / Brand</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Cost Price</th>
                <th className="px-4 py-3 text-right">Retail Price</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F2C44]/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500 mb-2" />
                    Loading product catalogue...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <Package className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#141C2E]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{p.name}</div>
                      <div className="text-[11px] font-mono text-zinc-400">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {p.barcode ? (
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Barcode className="w-3.5 h-3.5 text-zinc-500" />
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-200">{p.category?.name || 'Uncategorized'}</div>
                      <div className="text-[11px] text-zinc-400">{p.brand?.name || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#161F33] text-cyan-400 border border-cyan-500/20">
                        {p.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400">
                      {currency} {p.costPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-emerald-400">
                      {currency} {p.retailPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <XCircle className="w-2.5 h-2.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasPermission('inventory:manage') && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              className="p-1.5 rounded hover:bg-[#1F2C44] text-zinc-400 hover:text-cyan-400 transition-colors"
                              title="Edit product"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 rounded hover:bg-rose-950/50 text-zinc-400 hover:text-rose-400 transition-colors"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-[#1F2C44] bg-[#141C2E]/40 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Page {page} of {totalPages} ({totalCount} total items)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-[#0E1422] border border-[#1F2C44] hover:text-white disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-[#0E1422] border border-[#1F2C44] hover:text-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 4. Product Create / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-3xl bg-[#0E1422] border border-[#1F2C44] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1F2C44] flex items-center justify-between bg-[#141C2E]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {editingProduct ? 'Edit Product Definition' : 'Create New Product'}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    SKU, barcode scanners, pricing and variant options
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Navigation */}
            <div className="flex border-b border-[#1F2C44] px-4 bg-[#0A0E18]">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === 'general'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                General Details
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === 'pricing'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Pricing & Inventory
              </button>
              {formData.type === 'VARIABLE' && (
                <button
                  onClick={() => setActiveTab('variants')}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === 'variants'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Variants ({formData.variants?.length || 0})
                </button>
              )}
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitProduct} className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: General */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Ceylon Earl Grey Tea 100g"
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-300">SKU Code</label>
                        <button
                          type="button"
                          onClick={handleAutoSku}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="w-2.5 h-2.5" /> Auto
                        </button>
                      </div>
                      <input
                        type="text"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="e.g. TEA-EG-100"
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Barcode (EAN/UPC/Code128)
                      </label>
                      <input
                        type="text"
                        value={formData.barcode || ''}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        placeholder="Scanned barcode string..."
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-zinc-300">Category</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('category')}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-2.5 h-2.5" /> New
                        </button>
                      </div>
                      <select
                        value={formData.categoryId || ''}
                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                        <label className="text-xs font-medium text-zinc-300">Brand</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('brand')}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-2.5 h-2.5" /> New
                        </button>
                      </div>
                      <select
                        value={formData.brandId || ''}
                        onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                        <label className="text-xs font-medium text-zinc-300">Unit of Measure</label>
                        <button
                          type="button"
                          onClick={() => setQuickAddType('unit')}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          <PlusCircle className="w-2.5 h-2.5" /> New
                        </button>
                      </div>
                      <select
                        value={formData.unitId || ''}
                        onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Catalogue Type
                      </label>
                      <select
                        value={formData.type || 'STANDARD'}
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value as ProductType })
                        }
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="STANDARD">Standard (Single Item)</option>
                        <option value="VARIABLE">Variable (Sizes / Colors)</option>
                        <option value="SERVICE">Service (Non-physical)</option>
                        <option value="BUNDLE">Bundle (Package)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Product Description
                      </label>
                      <textarea
                        rows={2}
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Detailed product specifications..."
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
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
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
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
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
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
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
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
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
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
                        className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isTrackStock"
                        checked={formData.isTrackStock}
                        onChange={(e) => setFormData({ ...formData, isTrackStock: e.target.checked })}
                        className="rounded bg-[#141C2E] border-[#1F2C44] text-cyan-500"
                      />
                      <label htmlFor="isTrackStock" className="text-xs text-zinc-300 cursor-pointer">
                        Track Inventory Stock
                      </label>
                    </div>

                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded bg-[#141C2E] border-[#1F2C44] text-cyan-500"
                      />
                      <label htmlFor="isActive" className="text-xs text-zinc-300 cursor-pointer">
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
                    <span className="text-xs text-zinc-400">
                      Configure sizes, colors, and variant pricing overrides
                    </span>
                    <button
                      type="button"
                      onClick={handleAddVariantRow}
                      className="px-2.5 py-1 rounded bg-[#161F33] text-cyan-400 border border-cyan-500/30 text-xs flex items-center gap-1 hover:bg-[#1f2c44]"
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
                          className="p-3 rounded-lg bg-[#141C2E] border border-[#1F2C44] grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
                        >
                          <div>
                            <label className="text-[10px] text-zinc-400">Variant Name</label>
                            <input
                              type="text"
                              value={v.name}
                              onChange={(e) => {
                                const copy = [...(formData.variants || [])];
                                copy[idx] = { ...copy[idx]!, name: e.target.value };
                                setFormData({ ...formData, variants: copy });
                              }}
                              className="w-full bg-[#0E1422] border border-[#1F2C44] rounded px-2 py-1 text-xs text-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400">Variant SKU</label>
                            <input
                              type="text"
                              value={v.sku || ''}
                              onChange={(e) => {
                                const copy = [...(formData.variants || [])];
                                copy[idx] = { ...copy[idx]!, sku: e.target.value };
                                setFormData({ ...formData, variants: copy });
                              }}
                              className="w-full bg-[#0E1422] border border-[#1F2C44] rounded px-2 py-1 text-xs text-white font-mono uppercase"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-zinc-400">Retail Price ({currency})</label>
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
                              className="w-full bg-[#0E1422] border border-[#1F2C44] rounded px-2 py-1 text-xs text-white font-mono"
                            />
                          </div>

                          <div className="flex items-center justify-end pt-3">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantRow(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-zinc-500 text-xs">
                        No variant options configured. Click &quot;Add Variant&quot; to begin.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#1F2C44] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#141C2E] border border-[#1F2C44] text-xs font-medium text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-semibold text-xs transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-[#0E1422] border border-[#1F2C44] rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white capitalize flex items-center gap-2">
                {quickAddType === 'category' && <FolderPlus className="w-4 h-4 text-cyan-400" />}
                {quickAddType === 'brand' && <Tag className="w-4 h-4 text-emerald-400" />}
                {quickAddType === 'unit' && <Ruler className="w-4 h-4 text-cyan-400" />}
                Add New {quickAddType}
              </h3>
              <button
                onClick={() => setQuickAddType(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={quickAddName}
                  onChange={(e) => setQuickAddName(e.target.value)}
                  placeholder={`Enter ${quickAddType} name...`}
                  className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {quickAddType === 'unit' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Short Code (e.g. pcs, kg, ltr) *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickAddExtra}
                    onChange={(e) => setQuickAddExtra(e.target.value)}
                    placeholder="Short code..."
                    className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              {quickAddType === 'category' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={quickAddExtra}
                    onChange={(e) => setQuickAddExtra(e.target.value)}
                    placeholder="Optional category description..."
                    className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAddType(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141C2E] text-zinc-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[#0E1422] border border-[#1F2C44] rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Bulk Ingest Product Catalog
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
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
              className="w-full bg-[#141C2E] border border-[#1F2C44] rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />

            {importResult && (
              <div className="p-3 rounded-lg bg-[#141C2E] border border-[#1F2C44] text-xs">
                <div className="text-emerald-400 font-medium">
                  Successfully imported: {importResult.inserted} item(s)
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-rose-400 mt-1">
                    Failed rows: {importResult.errors.length}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1F2C44]">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#141C2E] text-zinc-400 hover:text-white text-xs"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isImporting || !importJson.trim()}
                onClick={handleBulkImportSubmit}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black font-semibold text-xs hover:bg-emerald-400 disabled:opacity-50"
              >
                {isImporting ? 'Ingesting...' : 'Import Products'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
