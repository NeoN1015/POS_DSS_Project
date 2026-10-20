import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  TrendingUp,
  Search,
  Save,
  CheckCircle2,
  AlertCircle,
  Percent,
  DollarSign,
  ArrowUpDown,
  Filter,
  Package,
} from 'lucide-react';

export default function CostMarginView() {
  const { products, categories, sales, saleItems, refreshData, showToast } = useApp();

  // Search, Category Filter, and Sort
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'margin_asc', 'margin_desc', 'profit_today'

  // Editable costs state map: { [productId]: costValue }
  const [costEdits, setCostEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Initialize/sync costs from products
  useEffect(() => {
    const map = {};
    products.forEach(p => {
      map[p.id] = p.cost !== undefined && p.cost !== null ? p.cost.toString() : '0';
    });
    setCostEdits(map);
  }, [products]);

  // Today's date string
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Today's completed sales
  const todaySales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'voided') return false;
      const d = new Date(s.transaction_date);
      const sDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return sDate === todayStr;
    });
  }, [sales, todayStr]);

  const todaySaleIds = useMemo(() => new Set(todaySales.map(s => s.id)), [todaySales]);

  // Map product units sold today
  const unitsSoldTodayMap = useMemo(() => {
    const map = {};
    saleItems.forEach(si => {
      if (todaySaleIds.has(si.sale_id)) {
        map[si.product_id] = (map[si.product_id] || 0) + Number(si.quantity || 0);
      }
    });
    return map;
  }, [saleItems, todaySaleIds]);

  // Handle single cost input change
  const handleCostChange = (productId, value) => {
    setCostEdits(prev => ({
      ...prev,
      [productId]: value,
    }));
  };

  // Save single item cost
  const saveSingleCost = async (product) => {
    const newCost = parseFloat(costEdits[product.id]);
    if (isNaN(newCost) || newCost < 0) {
      showToast('Please enter a valid positive cost price', 'warning');
      return;
    }

    try {
      setSavingId(product.id);
      await api.saveProduct({
        ...product,
        cost: newCost,
      });
      await refreshData();
      showToast(`Cost updated for "${product.name}"`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to update cost', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Bulk save all changed costs
  const handleBulkSave = async () => {
    const updates = [];
    products.forEach(p => {
      const edited = parseFloat(costEdits[p.id]);
      if (!isNaN(edited) && Math.abs(edited - Number(p.cost || 0)) > 1e-4) {
        updates.push({ id: p.id, cost: edited });
      }
    });

    if (updates.length === 0) {
      showToast('No cost changes to save', 'info');
      return;
    }

    try {
      setIsBulkSaving(true);
      await api.updateCosts(updates);
      await refreshData();
      showToast(`Updated costs for ${updates.length} products!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save changes', 'error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Changed items count
  const changedCount = useMemo(() => {
    return products.filter(p => {
      const edited = parseFloat(costEdits[p.id]);
      return !isNaN(edited) && Math.abs(edited - Number(p.cost || 0)) > 1e-4;
    }).length;
  }, [products, costEdits]);

  // Process and filter products
  const processedProducts = useMemo(() => {
    return products
      .filter(p => p.is_active !== 0)
      .filter(p => {
        const matchesCategory = selectedCategory === 'all' || p.category_id === Number(selectedCategory);
        const matchesSearch =
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .map(product => {
        const currentCost = parseFloat(costEdits[product.id]) ?? Number(product.cost || 0);
        const price = Number(product.price || 0);
        const unitMargin = Number((price - currentCost).toFixed(2));
        const marginPercent = price > 0 ? Number(((unitMargin / price) * 100).toFixed(1)) : 0;
        const unitsSoldToday = unitsSoldTodayMap[product.id] || 0;
        const dailyAccumulatedProfit = Number((unitMargin * unitsSoldToday).toFixed(2));
        const isModified = Math.abs(currentCost - Number(product.cost || 0)) > 1e-4;

        return {
          ...product,
          currentCost,
          unitMargin,
          marginPercent,
          unitsSoldToday,
          dailyAccumulatedProfit,
          isModified,
        };
      })
      .sort((a, b) => {
        if (sortBy === 'margin_asc') return a.unitMargin - b.unitMargin;
        if (sortBy === 'margin_desc') return b.unitMargin - a.unitMargin;
        if (sortBy === 'profit_today') return b.dailyAccumulatedProfit - a.dailyAccumulatedProfit;
        return a.name.localeCompare(b.name);
      });
  }, [products, costEdits, selectedCategory, searchQuery, sortBy, unitsSoldTodayMap]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalInventoryCost = 0;
    let totalInventoryRetail = 0;
    let totalDailyAccumulated = 0;

    processedProducts.forEach(p => {
      const stock = Number(p.stock_quantity || 0);
      totalInventoryCost += p.currentCost * stock;
      totalInventoryRetail += Number(p.price || 0) * stock;
      totalDailyAccumulated += p.dailyAccumulatedProfit;
    });

    const totalPotentialMargin = totalInventoryRetail - totalInventoryCost;

    return {
      totalInventoryCost,
      totalInventoryRetail,
      totalPotentialMargin,
      totalDailyAccumulated,
    };
  }, [processedProducts]);

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Potential Inventory Margin */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800">
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            Potential Inventory Margin
          </span>
          <div className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
            ${summaryMetrics.totalPotentialMargin.toFixed(2)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Retail value minus cost valuation
          </div>
        </div>

        {/* Daily Accumulated Profit */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800">
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            Today's Item Profit
          </span>
          <div className="text-2xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
            ${summaryMetrics.totalDailyAccumulated.toFixed(2)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Realized from completed orders today
          </div>
        </div>

        {/* Total Inventory Cost Value */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800">
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            Stock Cost Valuation
          </span>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
            ${summaryMetrics.totalInventoryCost.toFixed(2)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Capital tied in warehouse/shelf stock
          </div>
        </div>

        {/* Total Retail Valuation */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800">
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">
            Expected Retail Revenue
          </span>
          <div className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
            ${summaryMetrics.totalInventoryRetail.toFixed(2)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Total sales if all current stock sells
          </div>
        </div>
      </div>

      {/* Control Bar: Filters, Search, and Bulk Save */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200"
          >
            <option value="name">Sort by Name</option>
            <option value="margin_asc">Lowest Margin First</option>
            <option value="margin_desc">Highest Margin First</option>
            <option value="profit_today">Today's Profit Highest</option>
          </select>
        </div>

        {/* Save All Changes Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {changedCount > 0 && (
            <span className="text-xs font-bold text-amber-500 animate-pulse">
              {changedCount} unsaved {changedCount === 1 ? 'change' : 'changes'}
            </span>
          )}

          <button
            onClick={handleBulkSave}
            disabled={changedCount === 0 || isBulkSaving}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Save className="w-4 h-4" />
            <span>{isBulkSaving ? 'Saving Changes...' : 'Save All Cost Changes'}</span>
          </button>
        </div>
      </div>

      {/* DEDICATED MARGIN GRID TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-slate-200/80 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-5">Item & SKU</th>
                <th className="py-3.5 px-5">Selling Price</th>
                <th className="py-3.5 px-5">Cost Price (Inline)</th>
                <th className="py-3.5 px-5">Unit Margin</th>
                <th className="py-3.5 px-5">Margin %</th>
                <th className="py-3.5 px-5">Sold Today</th>
                <th className="py-3.5 px-5">Daily Accumulated Profit</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {processedProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-xs text-slate-400 font-medium">
                    No products found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                processedProducts.map((p) => {
                  const isPositive = p.unitMargin > 0;
                  const isNegative = p.unitMargin < 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors ${
                        p.isModified ? 'bg-amber-50/20 dark:bg-amber-950/20' : ''
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {p.sku}
                        </div>
                      </td>

                      {/* Selling Price */}
                      <td className="py-4 px-5 font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(p.price).toFixed(2)}
                      </td>

                      {/* Inline Cost Input Control */}
                      <td className="py-4 px-5">
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={costEdits[p.id] ?? ''}
                            onChange={(e) => handleCostChange(p.id, e.target.value)}
                            className={`w-full pl-6 pr-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border transition-all ${
                              p.isModified
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200'
                                : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white'
                            }`}
                          />
                        </div>
                      </td>

                      {/* Unit Margin Badge: (Selling Price - Cost Price) color-coded */}
                      <td className="py-4 px-5">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-extrabold ${
                            isPositive
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : isNegative
                              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200'
                          }`}
                        >
                          {isPositive ? '+' : ''}${p.unitMargin.toFixed(2)}
                        </span>
                      </td>

                      {/* Margin % */}
                      <td className="py-4 px-5 font-mono text-xs font-bold text-slate-700 dark:text-zinc-300">
                        {p.marginPercent}%
                      </td>

                      {/* Units Sold Today */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-600 dark:text-zinc-400">
                        {p.unitsSoldToday} {p.unit_type === 'decimal' ? 'units' : 'pcs'}
                      </td>

                      {/* Daily Accumulated Profit per item based on completed sales */}
                      <td className="py-4 px-5 font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                        <span
                          className={
                            p.dailyAccumulatedProfit > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }
                        >
                          ${p.dailyAccumulatedProfit.toFixed(2)}
                        </span>
                      </td>

                      {/* Inline Actions */}
                      <td className="py-4 px-5 text-right">
                        {p.isModified && (
                          <button
                            onClick={() => saveSingleCost(p)}
                            disabled={savingId === p.id}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 transition-colors"
                          >
                            {savingId === p.id ? 'Saving...' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
