import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  TrendingUp,
  Receipt,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Store,
} from 'lucide-react';

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    user,
    cart,
    lowStockProducts,
  } = useApp();

  const role = user?.role || 'admin';

  // Navigation items with role permissions
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      allowed: ['admin', 'owner'],
      badge: null,
    },
    {
      id: 'pos',
      label: 'Point of Sale',
      icon: ShoppingBag,
      allowed: ['admin', 'cashier', 'owner'],
      badge: cart.length > 0 ? `${cart.length}` : null,
      badgeColor: 'bg-indigo-600 text-white',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Boxes,
      allowed: ['admin', 'owner'],
      badge: lowStockProducts.length > 0 ? `${lowStockProducts.length}` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'margins',
      label: 'Cost & Margins',
      icon: TrendingUp,
      allowed: ['admin', 'owner'],
      badge: null,
    },
    {
      id: 'sales_history',
      label: 'Sales History',
      icon: Receipt,
      allowed: ['admin', 'owner'],
      badge: null,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      allowed: ['admin'],
      badge: null,
    },
  ];

  const visibleItems = navItems.filter(item => item.allowed.includes(role));

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out border-r
        ${sidebarCollapsed ? 'w-20' : 'w-64'}
        bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 flex flex-col justify-between`}
    >
      {/* Top Header & Brand */}
      <div>
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Store className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                  POS DSS
                </h1>
                <p className="text-xs text-slate-400 dark:text-zinc-400 font-medium truncate">
                  Smart SME Console
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label="Toggle navigation collapse"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative
                  ${isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-zinc-100'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500 group-hover:text-slate-600 dark:group-hover:text-zinc-300'
                  }`}
                />

                {!sidebarCollapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}

                {item.badge && (
                  <span
                    className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 rounded-full ${item.badgeColor} ${
                      sidebarCollapsed ? 'absolute -top-1 -right-1 w-5 h-5 text-[10px]' : ''
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Subtle active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-slate-100 dark:border-zinc-800">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-zinc-800/50 ${
            sidebarCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
            {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.full_name || user?.username || 'User'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 capitalize flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                {role}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
