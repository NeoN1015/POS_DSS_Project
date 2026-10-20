import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Bell,
  PlusCircle,
  ShoppingBag,
  Sun,
  Moon,
  LogOut,
  AlertTriangle,
  ChevronDown,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

export default function TopAppBar() {
  const {
    user,
    role,
    theme,
    toggleTheme,
    logout,
    lowStockProducts,
    setActiveTab,
    setProductModalOpen,
    setEditingProduct,
    sidebarCollapsed,
  } = useApp();

  // Real-time live clock
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close notifications dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const roleConfig = {
    admin: { label: 'Administrator', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    cashier: { label: 'Cashier', bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
    owner: { label: 'Business Owner', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  };

  const currentRoleInfo = roleConfig[user?.role || 'admin'] || roleConfig.admin;

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 transition-all duration-300 ease-in-out border-b
        left-0 ${sidebarCollapsed ? 'md:left-20' : 'md:left-64'}
        bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-slate-200 dark:border-zinc-800 px-4 md:px-6 flex items-center justify-between`}
    >
      {/* Left section: Quick stats & Role badge */}
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${currentRoleInfo.bg}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {currentRoleInfo.label}
        </div>

        {/* Live system clock */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-zinc-400 px-3 py-1 rounded-lg bg-slate-100/60 dark:bg-zinc-800/60 border border-slate-200/50 dark:border-zinc-700/50">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-mono text-slate-700 dark:text-zinc-200 font-semibold">{formattedTime}</span>
          <span className="text-slate-400 dark:text-zinc-500">•</span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Right section: Notifications & Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Action: New Sale */}
        <button
          onClick={() => setActiveTab('pos')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="hidden md:inline">New Sale</span>
        </button>

        {/* Quick Action: Add Product (Admin/Owner) */}
        {user?.role !== 'cashier' && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setProductModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold border border-slate-200 dark:border-zinc-700 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden md:inline">Add Product</span>
          </button>
        )}

        {/* Low-stock Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title="Low-stock notifications"
            aria-label="Low stock notifications"
          >
            <Bell className="w-4 h-4" />
            {lowStockProducts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
            )}
          </button>

          {/* Notifications Dropdown Popup */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800 px-1">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Stock Alerts
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  {lowStockProducts.length} Needs Attention
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60 my-2">
                {lowStockProducts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 dark:text-zinc-500">
                    All products have healthy inventory levels!
                  </div>
                ) : (
                  lowStockProducts.map(p => (
                    <div
                      key={p.id}
                      className="py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors flex items-center justify-between"
                    >
                      <div className="overflow-hidden pr-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                          <span>SKU: {p.sku}</span>
                          <span>•</span>
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">
                            {p.stock_quantity} left (Min: {p.min_stock_level})
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setNotificationsOpen(false);
                          setActiveTab('inventory');
                        }}
                        className="p-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 transition-colors shrink-0"
                        title="View in Inventory"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {lowStockProducts.length > 0 && (
                <button
                  onClick={() => {
                    setNotificationsOpen(false);
                    setActiveTab('inventory');
                  }}
                  className="w-full py-2 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-colors"
                >
                  Manage All in Inventory →
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600 transition-transform hover:-rotate-12" />
          )}
        </button>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Sign out"
          aria-label="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
