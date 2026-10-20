import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Receipt,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Printer,
  Calendar,
  DollarSign,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';

export default function SalesHistoryView() {
  const { sales, saleItems, products, refreshData, showToast, user } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'completed', 'voided'
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState(null);
  const [voidModalSale, setVoidModalSale] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchesSearch =
        s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.transaction_date?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter !== 'all' && s.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [sales, searchQuery, statusFilter]);

  const handleVoidSubmit = async (e) => {
    e.preventDefault();
    if (!voidReason.trim()) {
      showToast('A reason is required to void a transaction', 'warning');
      return;
    }

    try {
      setIsVoiding(true);
      await api.voidSale(voidModalSale.id, voidReason.trim());
      await refreshData();
      setVoidModalSale(null);
      setVoidReason('');
      showToast(`Transaction ${voidModalSale.invoice_number} voided`, 'info');
    } catch (err) {
      showToast(err.message || 'Failed to void transaction', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const getSaleItems = (saleId) => {
    return saleItems.filter(si => si.sale_id === saleId).map(si => {
      const prod = products.find(p => p.id === si.product_id);
      return {
        ...si,
        productName: prod ? prod.name : `Product #${si.product_id}`,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice number or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'completed'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setStatusFilter('voided')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === 'voided'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Voided
            </button>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500">
          Showing {filteredSales.length} {filteredSales.length === 1 ? 'sale' : 'sales'}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-card border border-slate-200/80 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="py-3.5 px-5">Invoice #</th>
                <th className="py-3.5 px-5">Date & Time</th>
                <th className="py-3.5 px-5">Subtotal</th>
                <th className="py-3.5 px-5">Tax</th>
                <th className="py-3.5 px-5">Total Amount</th>
                <th className="py-3.5 px-5">Profit</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-xs text-slate-400 font-medium">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-slate-900 dark:text-white">
                      {s.invoice_number}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-500 dark:text-zinc-400">
                      {new Date(s.transaction_date).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs">
                      ${Number(s.subtotal).toFixed(2)}
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-slate-400">
                      ${Number(s.tax_amount || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-slate-900 dark:text-white">
                      ${Number(s.total_amount).toFixed(2)}
                    </td>
                    <td className="py-4 px-5 font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      ${Number(s.total_profit || 0).toFixed(2)}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {s.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span className="capitalize">{s.status}</span>
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedSaleForReceipt(s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-200 transition-colors"
                      >
                        Receipt
                      </button>
                      {s.status === 'completed' && user?.role !== 'cashier' && (
                        <button
                          onClick={() => setVoidModalSale(s)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECEIPT VIEW MODAL */}
      {selectedSaleForReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-4 text-slate-900 font-mono text-xs">
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <h4 className="text-base font-extrabold">POS DSS RETAIL</h4>
              <p className="text-[10px] text-slate-500">Invoice: {selectedSaleForReceipt.invoice_number}</p>
              <p className="text-[10px] text-slate-500">
                {new Date(selectedSaleForReceipt.transaction_date).toLocaleString()}
              </p>
            </div>

            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 max-h-48 overflow-y-auto">
              {getSaleItems(selectedSaleForReceipt.id).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-[11px]">
                  <span className="truncate max-w-[170px]">
                    {item.quantity}x {item.productName}
                  </span>
                  <span className="font-bold">${Number(item.line_total).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${Number(selectedSaleForReceipt.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>${Number(selectedSaleForReceipt.tax_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
                <span>Total:</span>
                <span>${Number(selectedSaleForReceipt.total_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>Tendered:</span>
                <span>${Number(selectedSaleForReceipt.payment_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Change:</span>
                <span>${Number(selectedSaleForReceipt.change_amount).toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => setSelectedSaleForReceipt(null)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION MODAL */}
      {voidModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertOctagon className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Void Transaction {voidModalSale.invoice_number}
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Voiding an order marks the transaction as voided, logs an audit entry, and excludes its figures from DSS revenue analytics.
            </p>

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Reason for Voiding *
                </label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Customer refund, incorrect product scanned..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalSale(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVoiding}
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md"
                >
                  {isVoiding ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
