import React from 'react';
import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import TopAppBar from './components/TopAppBar';
import DashboardView from './components/DashboardView';
import POSView from './components/POSView';
import InventoryManager from './components/InventoryManager';
import CostMarginView from './components/CostMarginView';
import SalesHistoryView from './components/SalesHistoryView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import MobileBottomNav from './components/MobileBottomNav';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function App() {
  const { user, activeTab, sidebarCollapsed, toastMessage } = useApp();

  // If not authenticated, render Login view
  if (!user) {
    return <LoginView />;
  }

  // Render view based on activeTab
  const renderCurrentView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <POSView />;
      case 'inventory':
        return <InventoryManager />;
      case 'margins':
        return <CostMarginView />;
      case 'sales_history':
        return <SalesHistoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  const toastIcons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const toastColors = {
    success: 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    error: 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800',
    warning: 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    info: 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
  };

  const ToastIcon = toastMessage ? toastIcons[toastMessage.type] || Info : Info;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-200">
      {/* Sidebar Navigation (Desktop) */}
      <Sidebar />

      {/* Top Application Bar */}
      <TopAppBar />

      {/* Main Content Area */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out pt-20 px-3 sm:px-6 pb-24 md:pb-8 ml-0 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          {renderCurrentView()}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (Phones) */}
      <MobileBottomNav />

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold ${
              toastColors[toastMessage.type] || toastColors.info
            }`}
          >
            <ToastIcon className="w-4 h-4 shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
