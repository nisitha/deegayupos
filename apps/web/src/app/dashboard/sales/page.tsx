'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  Store,
  DollarSign,
  ShoppingCart,
  RotateCcw,
  TrendingUp,
  CreditCard,
  QrCode,
  Banknote,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { SaleDto, SalePaymentMethod } from '@pixelcraft/types';
import { useTenantBranch } from '../../../context/tenant-branch-context';
import { posApi } from '../../../lib/api-client';
import { ReceiptModal } from '../../../components/pos/receipt-modal';

const SAMPLE_SALES: SaleDto[] = [
  {
    id: 'sale-001',
    tenantId: 'demo-tenant',
    branchId: 'br-colombo',
    cashierId: 'cashier-1',
    invoiceNumber: 'INV-202611-0042',
    orderType: 'RETAIL_WALKIN',
    status: 'COMPLETED',
    subtotal: 12500.0,
    discountAmount: 500.0,
    taxAmount: 960.0,
    totalAmount: 12960.0,
    paidAmount: 12960.0,
    changeDue: 0.0,
    customerName: 'Kavindu Senanayake',
    cashier: {
      id: 'cashier-1',
      fullName: 'Kasun Rathnayake',
      email: 'kasun@pixelcraftlk.com',
    },
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    payments: [
      {
        id: 'sp-1',
        saleId: 'sale-001',
        paymentMethod: 'CARD',
        amount: 12960.0,
        status: 'SUCCESS',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
    ],
    items: [
      {
        id: 'si-1',
        saleId: 'sale-001',
        productId: 'p-1',
        productName: 'Organic Basmati Rice (5kg Bag)',
        sku: 'GRO-RIC-001',
        quantity: 2,
        unitPrice: 3200.0,
        subtotal: 6400.0,
        discountAmount: 0,
        taxAmount: 512.0,
      },
      {
        id: 'si-2',
        saleId: 'sale-001',
        productId: 'p-3',
        productName: 'Extra Virgin Olive Oil (1L Glass)',
        sku: 'GRO-OIL-003',
        quantity: 1,
        unitPrice: 6100.0,
        subtotal: 6100.0,
        discountAmount: 500.0,
        taxAmount: 448.0,
      },
    ],
  },
  {
    id: 'sale-002',
    tenantId: 'demo-tenant',
    branchId: 'br-colombo',
    cashierId: 'cashier-1',
    invoiceNumber: 'INV-202611-0041',
    orderType: 'RETAIL_WALKIN',
    status: 'COMPLETED',
    subtotal: 4800.0,
    discountAmount: 0,
    taxAmount: 384.0,
    totalAmount: 5184.0,
    paidAmount: 5184.0,
    changeDue: 0.0,
    customerName: 'Walk-in Customer',
    cashier: {
      id: 'cashier-1',
      fullName: 'Kasun Rathnayake',
      email: 'kasun@pixelcraftlk.com',
    },
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    payments: [
      {
        id: 'sp-2',
        saleId: 'sale-002',
        paymentMethod: 'QR_PAYMENT',
        amount: 5184.0,
        status: 'SUCCESS',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ],
    items: [
      {
        id: 'si-3',
        saleId: 'sale-002',
        productId: 'p-4',
        productName: 'Pure Single Origin Espresso Beans (500g)',
        sku: 'BEV-COF-001',
        quantity: 1,
        unitPrice: 4800.0,
        subtotal: 4800.0,
        discountAmount: 0,
        taxAmount: 384.0,
      },
    ],
  },
  {
    id: 'sale-003',
    tenantId: 'demo-tenant',
    branchId: 'br-colombo',
    cashierId: 'cashier-1',
    invoiceNumber: 'INV-202611-0040',
    orderType: 'RETAIL_WALKIN',
    status: 'COMPLETED',
    subtotal: 8200.0,
    discountAmount: 200.0,
    taxAmount: 640.0,
    totalAmount: 8640.0,
    paidAmount: 10000.0,
    changeDue: 1360.0,
    customerName: 'Dilshan Silva',
    cashier: {
      id: 'cashier-1',
      fullName: 'Kasun Rathnayake',
      email: 'kasun@pixelcraftlk.com',
    },
    createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    payments: [
      {
        id: 'sp-3',
        saleId: 'sale-003',
        paymentMethod: 'CASH',
        amount: 10000.0,
        status: 'SUCCESS',
        createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      },
    ],
    items: [
      {
        id: 'si-4',
        saleId: 'sale-003',
        productId: 'p-2',
        productName: 'Ceylon Pure Cinnamon Quills (100g)',
        sku: 'GRO-SP-002',
        quantity: 4,
        unitPrice: 2050.0,
        subtotal: 8200.0,
        discountAmount: 200.0,
        taxAmount: 640.0,
      },
    ],
  },
  {
    id: 'sale-004',
    tenantId: 'demo-tenant',
    branchId: 'br-colombo',
    cashierId: 'cashier-1',
    invoiceNumber: 'INV-202611-0039',
    orderType: 'RETAIL_WALKIN',
    status: 'VOIDED',
    subtotal: 3200.0,
    discountAmount: 0,
    taxAmount: 256.0,
    totalAmount: 3456.0,
    paidAmount: 0,
    changeDue: 0,
    customerName: 'Walk-in Customer',
    cashier: {
      id: 'cashier-1',
      fullName: 'Kasun Rathnayake',
      email: 'kasun@pixelcraftlk.com',
    },
    createdAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    payments: [],
    items: [],
  },
];

export default function SalesOrdersPage() {
  const { currency, selectedBranchId } = useTenantBranch();
  const [sales, setSales] = useState<SaleDto[]>(SAMPLE_SALES);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [activeReceiptSaleId, setActiveReceiptSaleId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const res = await posApi.getSales({
        branchId: selectedBranchId || undefined,
        limit: 50,
      });
      if (res.data?.items && res.data.items.length > 0) {
        setSales(res.data.items);
      }
    } catch {
      // Keep sample sales as graceful fallback
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const cashierName = s.cashier?.fullName || '';
      const matchSearch =
        searchQuery.trim() === '' ||
        s.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cashierName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
      const primaryPayment = s.payments?.[0]?.paymentMethod;
      const matchMethod = selectedMethod === 'ALL' || primaryPayment === selectedMethod;

      return matchSearch && matchStatus && matchMethod;
    });
  }, [sales, searchQuery, selectedStatus, selectedMethod]);

  const totalGross = useMemo(() => {
    return sales
      .filter((s) => s.status === 'COMPLETED')
      .reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
  }, [sales]);

  const totalCompleted = useMemo(() => {
    return sales.filter((s) => s.status === 'COMPLETED').length;
  }, [sales]);

  const totalVoided = useMemo(() => {
    return sales.filter((s) => s.status === 'VOIDED').length;
  }, [sales]);

  const avgTicket = useMemo(() => {
    return totalCompleted > 0 ? totalGross / totalCompleted : 0;
  }, [totalGross, totalCompleted]);

  const formatCurrency = (val: number) => {
    return `${currency} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getMethodBadge = (method?: SalePaymentMethod) => {
    switch (method) {
      case 'CASH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Banknote className="w-3 h-3" /> Cash
          </span>
        );
      case 'CARD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CreditCard className="w-3 h-3" /> Card
          </span>
        );
      case 'QR_PAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <QrCode className="w-3 h-3" /> LankaQR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {method || 'N/A'}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    }
    if (status === 'VOIDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3" /> Voided
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            Sales & Orders
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-600 border border-blue-200/60">
              Audit Trail
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time transaction registers, customer receipts, tax invoices, and sales reconciliations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSales}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/dashboard/pos"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#005BD3] hover:bg-[#004bb5] text-white font-semibold text-xs shadow-pos-btn transition-all group"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Open POS Terminal</span>
            <kbd className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-semibold text-white/90">
              F1
            </kbd>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Sales</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#005BD3]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(totalGross)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Total settled payments</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Orders</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalCompleted}
            </div>
            <div className="mt-1 text-xs text-slate-500">Fulfilled retail transactions</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Ticket</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {formatCurrency(avgTicket)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Per customer checkout</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-pos-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Voided Orders</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {totalVoided}
            </div>
            <div className="mt-1 text-xs text-slate-500">Cancelled or reversed</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-pos-card overflow-hidden">
        {/* Table Filters & Search */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by invoice #, customer, or cashier..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#005BD3]/20 focus:border-[#005BD3] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="ALL">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Method:</span>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="bg-white border border-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:border-[#005BD3]"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="QR_PAYMENT">LankaQR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice / Time</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.length > 0 ? (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900 group-hover:text-[#005BD3] transition-colors">
                        {sale.invoiceNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {isMounted
                          ? new Date(sale.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      <div>{sale.customerName || 'Walk-in Customer'}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {sale.cashier?.fullName || 'Staff'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {sale.items?.reduce((cnt, it) => cnt + it.quantity, 0) || 0}
                      </span>{' '}
                      item(s)
                    </td>
                    <td className="py-3.5 px-4">
                      {getMethodBadge(sale.payments?.[0]?.paymentMethod)}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(sale.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(Number(sale.totalAmount))}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setActiveReceiptSaleId(sale.id)}
                          title="View & Print Receipt"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#005BD3] hover:border-[#005BD3]/50 hover:bg-blue-50/60 transition-all shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            posApi.downloadPdf(sale.id, sale.invoiceNumber).catch(() => {
                              setActiveReceiptSaleId(sale.id);
                            });
                          }}
                          title="Download PDF Invoice"
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/60 transition-all shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-sm">No sales records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search keywords</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/30">
          <div>
            Showing <span className="font-semibold text-slate-700">{filteredSales.length}</span> of{' '}
            <span className="font-semibold text-slate-700">{sales.length}</span> recorded orders
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Encrypted Audit Logs • RLS Isolated
          </div>
        </div>
      </div>

      {/* Hardware-Ready Receipt Modal */}
      {activeReceiptSaleId && (
        <ReceiptModal
          saleId={activeReceiptSaleId}
          isOpen={!!activeReceiptSaleId}
          onClose={() => setActiveReceiptSaleId(null)}
        />
      )}
    </div>
  );
}
