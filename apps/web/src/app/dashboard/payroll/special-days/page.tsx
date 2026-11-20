'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  CheckCircle2,
  Sparkles,
  Download,
} from 'lucide-react';
import { payrollSpecialDaysApi } from '../../../../lib/payroll-api';
import { PayrollSpecialDay } from '../../../../lib/payroll-calculator';
import { SRI_LANKA_HOLIDAYS_2026_2030 } from '../../../../lib/sri-lanka-holidays';
import { supabase } from '../../../../lib/supabase';

export default function PayrollSpecialDaysPage() {
  const [holidays, setHolidays] = useState<PayrollSpecialDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PayrollSpecialDay | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    holiday_category: 'COMMERCIAL' as 'COMMERCIAL' | 'PUBLIC' | 'POYA' | 'CUSTOM',
    day_type: 'DOUBLE_OT' as 'DOUBLE_OT' | 'HOLIDAY_OFF',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load Data
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await payrollSpecialDaysApi.getAll();
      setHolidays(data);
    } catch (err: any) {
      console.error('[SpecialDays] Failed to load holidays:', err);
      showToast('Error loading holiday calendar.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // 2. One-Click 5-Year Holiday Seeder (2026-2030)
  const handleSeed5Years = async () => {
    if (!confirm('Pre-populate all official Sri Lankan Public, Mercantile & Poya holidays for 2026 through 2030? Existing custom modifications will be preserved.')) {
      return;
    }

    setIsSeeding(true);
    try {
      const { error } = await supabase
        .from('payroll_special_days')
        .upsert(SRI_LANKA_HOLIDAYS_2026_2030, { onConflict: 'date' });

      if (error) throw error;

      showToast(`Successfully synchronized ${SRI_LANKA_HOLIDAYS_2026_2030.length} Sri Lankan holidays for 2026–2030.`);
      await loadData(true);
    } catch (err: any) {
      console.error('[SpecialDays] Seeding error:', err);
      alert(`Failed to load holidays: ${err.message || 'Database error'}`);
    } finally {
      setIsSeeding(false);
    }
  };

  // 3. Computed KPI Stats for Selected Year
  const stats = useMemo(() => {
    const yearFiltered = holidays.filter((h) => {
      if (selectedYear === 'ALL') return true;
      return h.date.startsWith(selectedYear);
    });

    let total = yearFiltered.length;
    let commercial = 0;
    let poya = 0;
    let pub = 0;
    let custom = 0;

    yearFiltered.forEach((h) => {
      if (h.holiday_category === 'COMMERCIAL') commercial++;
      else if (h.holiday_category === 'POYA') poya++;
      else if (h.holiday_category === 'PUBLIC') pub++;
      else if (h.holiday_category === 'CUSTOM') custom++;
    });

    return { total, commercial, poya, pub, custom };
  }, [holidays, selectedYear]);

  // 4. Filtered Holidays
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      if (selectedYear !== 'ALL' && !h.date.startsWith(selectedYear)) {
        return false;
      }
      if (categoryFilter !== 'ALL' && h.holiday_category !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = h.title.toLowerCase().includes(q);
        const matchesDate = h.date.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDate) return false;
      }
      return true;
    });
  }, [holidays, selectedYear, categoryFilter, searchQuery]);

  // 5. Open Add / Edit Modal
  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      title: '',
      holiday_category: 'COMMERCIAL',
      day_type: 'DOUBLE_OT',
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (h: PayrollSpecialDay) => {
    setEditingHoliday(h);
    setFormData({
      date: h.date,
      title: h.title,
      holiday_category: h.holiday_category,
      day_type: h.day_type,
    });
    setModalOpen(true);
  };

  const handleDeleteHoliday = async (dateStr: string, title: string) => {
    if (!confirm(`Delete holiday "${title}" (${dateStr})?`)) return;

    try {
      await payrollSpecialDaysApi.delete(dateStr);
      showToast(`Deleted ${title}.`);
      await loadData(true);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // 6. Submit Holiday Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.date) {
      alert('Date and Title are required.');
      return;
    }

    setIsSaving(true);
    try {
      await payrollSpecialDaysApi.upsert({
        date: formData.date,
        title: formData.title.trim(),
        holiday_category: formData.holiday_category,
        day_type: formData.day_type,
      });

      showToast(`Holiday "${formData.title}" saved successfully.`);
      setModalOpen(false);
      await loadData(true);
    } catch (err: any) {
      console.error('[SpecialDays] Save error:', err);
      alert(`Failed to save holiday: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-250">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Obsidian Header Banner */}
      <div className="bg-[#0F172A] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Deegayu Weda Madhura
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-400 text-xs font-medium">Sri Lanka Statutory Calendar</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <Calendar className="w-8 h-8 text-indigo-400" />
                5-Year Sri Lanka Holiday Calendar (2026–2030)
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
                Commercial, Public, and Full Moon Poya holidays pre-mapped with automated Double OT (2.0x beyond 8h) and Holiday Shift allowances.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition border border-slate-700 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>Refresh</span>
              </button>

              {/* One-Click 5-Year Pre-Populate Button */}
              <button
                onClick={handleSeed5Years}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 active:bg-purple-600/40 text-purple-300 rounded-lg text-xs font-bold transition border border-purple-500/40 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isSeeding ? 'Syncing...' : 'Load SL Holidays (2026–2030)'}</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Holiday</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {selectedYear === 'ALL' ? 'Total Registered' : `${selectedYear} Holidays`}
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
            <p className="text-xs text-slate-400 mt-0.5">Special scheduled days</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600">Commercial / Mercantile</span>
            <div className="text-2xl font-black text-purple-700 mt-1">{stats.commercial}</div>
            <p className="text-xs text-slate-400 mt-0.5">Rs. 2,800 + Double OT</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Full Moon Poya</span>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.poya}</div>
            <p className="text-xs text-slate-400 mt-0.5">Monthly Poya days</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Public Holidays</span>
            <div className="text-2xl font-black text-indigo-700 mt-1">{stats.pub}</div>
            <p className="text-xs text-slate-400 mt-0.5">Statutory public days</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Custom / Store Days</span>
            <div className="text-2xl font-black text-emerald-700 mt-1">{stats.custom}</div>
            <p className="text-xs text-slate-400 mt-0.5">Special store declarations</p>
          </div>
        </section>

        {/* Year Selector Tabs & Search Filter */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
          {/* Year Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Year:</span>
              {['2026', '2027', '2028', '2029', '2030', 'ALL'].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {yr === 'ALL' ? 'All 5 Years' : yr}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{filteredHolidays.length}</strong> holidays
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search holiday by title or date (YYYY-MM-DD)..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="ALL">All Holiday Categories</option>
                <option value="COMMERCIAL">Commercial / Mercantile</option>
                <option value="POYA">Full Moon Poya</option>
                <option value="PUBLIC">Public Holiday</option>
                <option value="CUSTOM">Custom Holiday</option>
              </select>
            </div>
          </div>
        </section>

        {/* Holiday Table */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Holiday Title</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Day Rule / Overtime Mode</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading holiday records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto text-center space-y-2">
                        <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-600">No holidays found for this selection.</p>
                        <p className="text-xs text-slate-400">Click &quot;Load SL Holidays (2026–2030)&quot; above to pre-populate the 5-year calendar.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHolidays.map((h) => {
                    const dateObj = new Date(h.date + 'T00:00:00');
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const formattedDate = dateObj.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <tr key={h.date} className="hover:bg-slate-50/80 transition">
                        {/* Date */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">{h.date}</div>
                          <span className="text-[11px] text-slate-500">
                            {dayOfWeek}, {formattedDate}
                          </span>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900 text-sm">{h.title}</div>
                        </td>

                        {/* Category */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {h.holiday_category === 'COMMERCIAL' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              Commercial / Mercantile
                            </span>
                          )}
                          {h.holiday_category === 'POYA' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Full Moon Poya Day
                            </span>
                          )}
                          {h.holiday_category === 'PUBLIC' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Public Holiday
                            </span>
                          )}
                          {h.holiday_category === 'CUSTOM' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Custom Holiday
                            </span>
                          )}
                        </td>

                        {/* Day Rule */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {h.day_type === 'DOUBLE_OT' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                              <span>Holiday Rate (First 8h) + Double OT (2.0x beyond 8h)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                              <span>Holiday Off (No Overtime)</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(h)}
                              className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded transition"
                              title="Edit Holiday"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(h.date, h.title)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                              title="Delete Holiday"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ====================================================================
          ADD / EDIT HOLIDAY MODAL
      ==================================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingHoliday ? 'Edit Holiday' : 'Add New Special Holiday'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set holiday date, category, and automatic Double OT (2.0x) rules.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4 py-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Holiday Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  disabled={!!editingHoliday}
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-800 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Holiday Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Sinhala & Tamil New Year Day"
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Holiday Category</label>
                <select
                  value={formData.holiday_category}
                  onChange={(e) => setFormData({ ...formData, holiday_category: e.target.value as any })}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="COMMERCIAL">Commercial / Mercantile Holiday</option>
                  <option value="POYA">Full Moon Poya Day</option>
                  <option value="PUBLIC">Public Holiday</option>
                  <option value="CUSTOM">Custom Store Holiday</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Day Rule & Overtime Mode</label>
                <select
                  value={formData.day_type}
                  onChange={(e) => setFormData({ ...formData, day_type: e.target.value as any })}
                  className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="DOUBLE_OT">DOUBLE_OT: Holiday Daily Rate (first 8h) + Double OT (2.0x beyond 8h)</option>
                  <option value="HOLIDAY_OFF">HOLIDAY_OFF: Store Closed / Holiday Off (No Overtime)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Holiday</span>
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
