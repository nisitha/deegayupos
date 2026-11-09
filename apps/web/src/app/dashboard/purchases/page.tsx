'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Loader2,
  X,
  Package,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { GoodsReceivedNoteDto, PurchaseOrderDto, SupplierDto } from '@pixelcraft/types';

interface CatalogProductItem {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  retailPrice: number;
}

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<'GRN' | 'PO'>('GRN');

  // Data lists
  const [grns, setGrns] = useState<GoodsReceivedNoteDto[]>([]);
  const [pos, setPos] = useState<PurchaseOrderDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProductItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modals
  const [isGrnModalOpen, setIsGrnModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // GRN Wizard Form State
  const [grnSupplierId, setGrnSupplierId] = useState<string>('');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState<string>('');
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [grnItems, setGrnItems] = useState<
    {
      productId: string;
      productName: string;
      productSku: string;
      receivedQuantity: number;
      unitCost: number;
      batchNumber: string;
      expiryDate: string;
    }[]
  >([]);

  // Product Autocomplete inside GRN Wizard
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<CatalogProductItem | null>(null);
  const [newQty, setNewQty] = useState<number>(10);
  const [newCost, setNewCost] = useState<number>(0);
  const [newBatch, setNewBatch] = useState<string>('BATCH-' + new Date().getFullYear());
  const [newExpiry, setNewExpiry] = useState<string>('2028-12-31');

  // Load Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [grnRes, poRes, supRes, catRes] = await Promise.all([
        fetch('/api/procurement/grn?slug=deegayu&limit=50'),
        fetch('/api/procurement/purchase-orders?slug=deegayu&limit=50'),
        fetch('/api/suppliers?slug=deegayu&limit=150'),
        fetch('/api/pos/catalog?slug=deegayu&limit=3500'),
      ]);

      const [grnJson, poJson, supJson, catJson] = await Promise.all([
        grnRes.json(),
        poRes.json(),
        supRes.json(),
        catRes.json(),
      ]);

      if (grnJson.success && grnJson.data) setGrns(grnJson.data.items || []);
      if (poJson.success && poJson.data) setPos(poJson.data.items || []);
      if (supJson.success && supJson.data) {
        setSuppliers(supJson.data.items || []);
        if (supJson.data.items?.length > 0) {
          setGrnSupplierId((prev) => prev || supJson.data.items[0].id);
        }
      }
      if (catJson.success && catJson.data) {
        setCatalogProducts(catJson.data.products || []);
      }
    } catch (err) {
      console.error('Failed to load procurement data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter products for autocomplete
  const filteredCatalogProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return [];
    const term = productSearchTerm.toLowerCase();
    return catalogProducts
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 8);
  }, [catalogProducts, productSearchTerm]);

  // Add line item to GRN wizard
  const handleAddGrnLine = () => {
    if (!selectedProduct) return;
    setGrnItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productSku: selectedProduct.sku,
        receivedQuantity: Number(newQty),
        unitCost: Number(newCost || selectedProduct.costPrice || 250),
        batchNumber: newBatch,
        expiryDate: newExpiry,
      },
    ]);

    setSelectedProduct(null);
    setProductSearchTerm('');
    setNewQty(10);
    setNewCost(0);
  };

  const handleRemoveGrnLine = (index: number) => {
    setGrnItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit GRN Receiving
  const handlePostGrn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grnItems.length === 0) {
      alert('Please add at least one line item to receive.');
      return;
    }
    if (!grnSupplierId) {
      alert('Please select a supplier.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/procurement/grn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: 'deegayu',
          supplierId: grnSupplierId,
          supplierInvoiceNo: grnInvoiceNo || undefined,
          notes: grnNotes || undefined,
          items: grnItems.map((i) => ({
            productId: i.productId,
            receivedQuantity: i.receivedQuantity,
            unitCost: i.unitCost,
            batchNumber: i.batchNumber,
            expiryDate: i.expiryDate,
          })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback(`GRN Posted! Stock successfully received & cost updated.`);
        setIsGrnModalOpen(false);
        setGrnItems([]);
        setGrnInvoiceNo('');
        setGrnNotes('');
        await fetchData();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        alert(json.error || 'Failed to receive GRN');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error receiving GRN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const grnTotalCost = useMemo(() => {
    return grnItems.reduce((acc, i) => acc + i.receivedQuantity * i.unitCost, 0);
  }, [grnItems]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white select-none">
      {/* Toast Notification */}
      {feedback && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#7052FF] flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Purchases & Goods Received Notes (GRN)
            </h1>
            <p className="text-xs text-slate-500">
              Procurement Lifecycle, Purchase Orders & Receiving Hub for Deegayu Weda Madura
            </p>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsGrnModalOpen(true)}
            className="bg-[#7052FF] hover:bg-[#5E3FE6] active:scale-95 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm shadow-[#7052FF]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Inventory (GRN Wizard)</span>
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => setActiveTab('GRN')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'GRN'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Goods Received Notes ({grns.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PO')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'PO'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Purchase Orders ({pos.length})
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          94 Active Suppliers Ready
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#7052FF] mb-2" />
            <p className="text-xs font-medium text-slate-500">Loading procurement records...</p>
          </div>
        ) : activeTab === 'GRN' ? (
          /* GRN List */
          grns.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <ClipboardCheck className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Goods Received Notes Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Receive physical stock shipments from any of the 94 suppliers to record batch numbers and update inventory.
              </p>
              <button
                type="button"
                onClick={() => setIsGrnModalOpen(true)}
                className="mt-3 bg-[#7052FF] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
              >
                Launch GRN Receiving Wizard
              </button>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 font-semibold">
                    <th className="py-3 px-4">GRN Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Items Received</th>
                    <th className="py-3 px-4">Received Date</th>
                    <th className="py-3 px-4 text-right">Total Cost</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {grns.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {g.grnNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {g.supplierName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {g.supplierInvoiceNo || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-mono bg-purple-50 text-[#7052FF] px-2 py-0.5 rounded border border-purple-200">
                          {g.items.length} {g.items.length === 1 ? 'line' : 'lines'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(g.receivedDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        LKR {g.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{g.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* PO List */
          pos.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No Purchase Orders Created</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Create procurement purchase orders to send to pharmaceutical distributors and track order fulfillment.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 font-semibold">
                    <th className="py-3 px-4">PO Number</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Order Date</th>
                    <th className="py-3 px-4">Lines</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pos.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {p.poNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {p.supplierName}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(p.orderDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {p.items.length} items
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        LKR {p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            p.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <span>{p.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* =====================================================================
          CREATE GRN RECEIVING WIZARD MODAL
      ===================================================================== */}
      {isGrnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsGrnModalOpen(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          />

          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#7052FF] flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Goods Received Note (GRN) Wizard</h3>
                  <p className="text-[11px] text-slate-500">
                    Receive inventory, update stock levels & record batch numbers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGrnModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handlePostGrn} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Supplier & Invoice metadata */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Select Supplier (94 Vendors) *
                  </label>
                  <select
                    required
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF]"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Supplier Invoice No (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-90412"
                    value={grnInvoiceNo}
                    onChange={(e) => setGrnInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-[#7052FF] font-mono"
                  />
                </div>
              </div>

              {/* Product Autocomplete Picker */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#7052FF]" />
                  <span>Add Product to GRN (3,120 Ayurvedic Catalog)</span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Type to search medicines, oils, churnas..."
                    value={selectedProduct ? selectedProduct.name : productSearchTerm}
                    onChange={(e) => {
                      setSelectedProduct(null);
                      setProductSearchTerm(e.target.value);
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-[#7052FF]"
                  />

                  {/* Autocomplete Dropdown */}
                  {!selectedProduct && filteredCatalogProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {filteredCatalogProducts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProduct(p);
                            setNewCost(p.costPrice || 250);
                            setProductSearchTerm('');
                          }}
                          className="p-2.5 hover:bg-purple-50/50 cursor-pointer text-xs flex justify-between items-center"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              SKU: {p.sku}
                            </div>
                          </div>
                          <span className="font-mono text-slate-700 font-bold">
                            LKR {p.costPrice.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Line details when product selected */}
                {selectedProduct && (
                  <div className="grid grid-cols-5 gap-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                        Received Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newQty}
                        onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                        Unit Cost (LKR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newCost}
                        onChange={(e) => setNewCost(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                        Batch / Lot No
                      </label>
                      <input
                        type="text"
                        value={newBatch}
                        onChange={(e) => setNewBatch(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={newExpiry}
                        onChange={(e) => setNewExpiry(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-200 font-mono text-slate-700"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddGrnLine}
                        className="w-full py-1.5 rounded-lg bg-[#7052FF] hover:bg-[#5E3FE6] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        + Add Line
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Added Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-slate-800">
                    Received Line Items ({grnItems.length})
                  </h4>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    Total: LKR {grnTotalCost.toFixed(2)}
                  </span>
                </div>

                {grnItems.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                    No items added yet. Search and add products above.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    {grnItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-3 bg-white">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {item.productName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Batch: {item.batchNumber} | Exp: {item.expiryDate}
                          </div>
                        </div>

                        <div className="font-mono text-slate-600 text-xs shrink-0">
                          {item.receivedQuantity} × LKR {item.unitCost.toFixed(2)}
                        </div>

                        <div className="font-mono font-bold text-slate-900 text-xs shrink-0">
                          LKR {(item.receivedQuantity * item.unitCost).toFixed(2)}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveGrnLine(idx)}
                          className="text-rose-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsGrnModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || grnItems.length === 0}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Posting GRN to Stock...</span>
                    </>
                  ) : (
                    <span>Post & Receive Inventory</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
