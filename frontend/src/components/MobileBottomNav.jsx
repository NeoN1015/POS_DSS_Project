import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShoppingBag,
  LayoutDashboard,
  Boxes,
  TrendingUp,
  Menu,
  X,
  Receipt,
  Settings,
  LogOut,
  Sun,
  Moon,
  ShieldCheck,
} from 'lucide-react';

export default function MobileBottomNav() {
  const {
    activeTab,
    setActiveTab,
    cart,
    lowStockProducts,
    user,
    role,
    theme,
    toggleTheme,
    logout,
  } = useApp();

  const [drawerOpen, setDrawerOpen] = useState(false);

  const navButtons = [
    {
      id: 'pos',
      label: 'POS',
      icon: ShoppingBag,
      badge: cart.length > 0 ? cart.length : null,
      badgeColor: 'bg-indigo-600',
    },
    {
      id: 'dashboard',
      label: 'Stats',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'inventory',
      label: 'Stock',
      icon: Boxes,
      badge: lowStockProducts.length > 0 ? lowStockProducts.length : null,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'margins',
      label: 'Margins',
      icon: TrendingUp,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar (Visible only on mobile/phone screens < 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex items-center justify-around px-2 shadow-lg">
        {navButtons.map((btn) => {
          const Icon = btn.icon;
          const isActive = activeTab === btn.id;

          return (
            <button
              key={btn.id}
              onClick={() => {
                setActiveTab(btn.id);
                setDrawerOpen(false);
              }}
              className={`relative flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-zinc-400 font-medium hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                {btn.badge && (
                  <span
                    className={`absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full text-[9px] font-bold text-white ${btn.badgeColor} animate-pulse`}
                  >
                    {btn.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5">{btn.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5" />
              )}
            </button>
          );
        })}

        {/* More Menu Drawer Trigger */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl text-slate-500 dark:text-zinc-400 ${
            drawerOpen ? 'text-indigo-600 font-bold' : ''
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </nav>

      {/* Slide-out Drawer for Additional Views & Mobile Profile */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-6 space-y-4 border-t border-slate-200 dark:border-zinc-800 max-h-[85vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {user?.full_name || 'User'}
                  </h4>
                  <span className="text-[11px] text-slate-400 capitalize">
                    {user?.role || 'Admin'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Additional Links */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setActiveTab('sales_history');
                  setDrawerOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                  activeTab === 'sales_history'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                    : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Receipt className="w-4 h-4 text-indigo-500" />
                <span>Sales History & Invoices</span>
              </button>

              {user?.role === 'admin' && (
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Settings className="w-4 h-4 text-purple-500" />
                  <span>Settings & RBAC Users</span>
                </button>
              )}
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
              <button
                onClick={toggleTheme}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-center gap-2"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-slate-600" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>

              <button
                onClick={logout}
                className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
