import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Search,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Receipt,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Package,
  Printer,
  Sparkles,
  RotateCcw,
  Coffee,
  Wine,
  Cookie,
  ShoppingBag,
  Pill,
} from 'lucide-react';

export default function POSView() {
  const {
    categories,
    products,
    cart,
    addToCart,
    adjustCartQuantity,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    cartTaxAmount,
    cartTotal,
    taxRate,
    user,
    refreshData,
    showToast,
  } = useApp();

  // Category drilldown state
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Checkout & Receipt Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [completedSale, setCompletedSale] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Category icons mapping
  const categoryIcons = {
    Beverages: Wine,
    Snacks: Cookie,
    Grocery: ShoppingBag,
    Cafe: Coffee,
    Medicine: Pill,
  };

  // Filtered products
  const activeProducts = useMemo(() => {
    return products.filter(p => p.is_active !== 0);
  }, [products]);

  const displayedProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      if (searchQuery.trim()) {
        return matchesSearch;
      }
      if (selectedCategoryId) {
        return p.category_id === selectedCategoryId && matchesSearch;
      }
      return matchesSearch;
    });
  }, [activeProducts, selectedCategoryId, searchQuery]);

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  // Payment helpers
  const paymentNum = parseFloat(paymentAmount) || 0;
  const changeDue = Number((paymentNum - cartTotal).toFixed(2));
  const isPaymentValid = paymentNum >= cartTotal && cartTotal > 0;

  const handleQuickCash = (amount) => {
    setPaymentAmount(amount.toString());
  };

  const handleExactCash = () => {
    setPaymentAmount(cartTotal.toFixed(2));
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!isPaymentValid) {
      showToast('Payment amount is less than total due!', 'warning');
      return;
    }

    try {
      setIsProcessing(true);
      const salePayload = {
        payment_amount: paymentNum,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
      };

      const result = await api.checkout(salePayload);
      setCompletedSale({
        ...result.sale,
        items: cart,
      });
      clearCart();
      await refreshData();
      showToast('Sale completed successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Checkout failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const closeReceiptModal = () => {
    setCheckoutModalOpen(false);
    setCompletedSale(null);
    setPaymentAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-6rem)]">
      {/* LEFT SECTION: Catalog & Category Drilldown (8 cols) */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        {/* Search Bar & Breadcrumbs */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-card border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Breadcrumb Trail */}
          <nav className="flex items-center gap-2 text-sm font-semibold overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => {
                setSelectedCategoryId(null);
                setSearchQuery('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                selectedCategoryId === null && !searchQuery
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Categories</span>
            </button>

            {selectedCategory && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 shrink-0" />
                <span className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 truncate max-w-[200px]">
                  {selectedCategory.name}
                </span>
              </>
            )}

            {searchQuery && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-600 shrink-0" />
                <span className="text-slate-500 text-xs italic truncate">
                  Search: "{searchQuery}"
                </span>
              </>
            )}
          </nav>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-zinc-100 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* View Mode 1: Top-Level Category Grid (when no category is selected and no search) */}
        {selectedCategoryId === null && !searchQuery && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Select Category
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                {categories.length} Categories Available
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((cat) => {
                const IconComponent = categoryIcons[cat.name] || Package;
                const count = activeProducts.filter(p => p.category_id === cat.id).length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-card hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-center"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                      <IconComponent className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500">
                      {count} {count === 1 ? 'item' : 'items'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* View Mode 2: Nested Product Grid */}
        {(selectedCategoryId !== null || searchQuery) && (
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSearchQuery('');
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
                  title="Back to Categories"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  {selectedCategory ? selectedCategory.name : 'Search Results'} ({displayedProducts.length})
                </h2>
              </div>
            </div>

            {displayedProducts.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-zinc-800">
                <Package className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                  No products found
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Try adjusting your search query or pick another category.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayedProducts.map((product) => {
                  const isOutOfStock = Number(product.stock_quantity) <= 0;
                  const isLowStock =
                    Number(product.stock_quantity) > 0 &&
                    Number(product.stock_quantity) <= Number(product.min_stock_level);

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product, 1)}
                      className={`group relative flex flex-col justify-between p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-card hover:shadow-elevated transition-all duration-200 cursor-pointer ${
                        isOutOfStock
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:-translate-y-0.5 active:translate-y-0'
                      }`}
                    >
                      {/* Fixed Aspect-Ratio Image Container */}
                      <div className="relative w-full aspect-square bg-slate-50 dark:bg-zinc-800/50 rounded-xl overflow-hidden mb-3 border border-slate-100 dark:border-zinc-800 flex items-center justify-center p-2">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-600 ${
                            product.image_url ? 'hidden' : ''
                          }`}
                        >
                          <Package className="w-10 h-10" />
                          <span className="text-[10px] font-bold mt-1 uppercase tracking-wider text-slate-400">
                            {product.sku}
                          </span>
                        </div>

                        {/* Stock Badge */}
                        <div className="absolute top-2 right-2">
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-xs">
                              Out of Stock
                            </span>
                          ) : isLowStock ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs animate-pulse">
                              {product.stock_quantity} Left
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 backdrop-blur-xs">
                              {product.stock_quantity} in stock
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Product Metadata */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">
                            {product.sku}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {product.name}
                          </h4>
                        </div>

                        {/* Price & Action */}
                        <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-zinc-800">
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            ${Number(product.price).toFixed(2)}
                          </span>

                          <button
                            disabled={isOutOfStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product, 1);
                            }}
                            className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 text-indigo-600 hover:text-white dark:text-indigo-400 transition-colors shrink-0 disabled:opacity-50"
                            title="Add to Cart"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Interactive Cart Drawer (4 cols) */}
      <div className="lg:col-span-4 flex flex-col">
        <div className="sticky top-20 bg-white dark:bg-zinc-900 rounded-3xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800 flex flex-col h-[calc(100vh-6.5rem)] justify-between">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Current Order
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {cart.length} {cart.length === 1 ? 'line item' : 'line items'}
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                title="Clear entire cart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500">
                <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-center mb-3 text-slate-300 dark:text-zinc-600">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">Cart is empty</p>
                <p className="text-xs mt-1 max-w-[200px]">
                  Click items on the left to add them to this order
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/80 space-y-2.5"
                >
                  {/* Item Title & Price */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                        {item.product.name}
                      </h4>
                      <div className="text-[11px] text-slate-400 font-medium">
                        ${item.unitPrice.toFixed(2)} / unit
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                        ${item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Dual Increments: Main (+1/-1) & Precision (+0.25/-0.25) */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-zinc-700/50">
                    {/* Precision Buttons (+0.25 / -0.25) */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjustCartQuantity(item.product.id, -0.25)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
                        title="Subtract 0.25 fractional unit"
                      >
                        -0.25
                      </button>
                      <button
                        onClick={() => adjustCartQuantity(item.product.id, 0.25)}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 transition-colors shadow-2xs"
                        title="Add 0.25 fractional unit"
                      >
                        +0.25
                      </button>
                    </div>

                    {/* Main Buttons (+1 / -1) & Quantity Display */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => adjustCartQuantity(item.product.id, -1)}
                        className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-xs active:scale-95"
                        title="Subtract 1 unit"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={item.quantity}
                        onChange={(e) => updateCartQuantity(item.product.id, e.target.value)}
                        className="w-12 text-center text-xs font-bold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg py-1 text-slate-800 dark:text-zinc-100"
                      />

                      <button
                        onClick={() => adjustCartQuantity(item.product.id, 1)}
                        className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-xs active:scale-95"
                        title="Add 1 unit"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors ml-1"
                        title="Remove line item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Checkout Action */}
          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-3 shrink-0">
            <div className="space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Tax ({taxRate}%)</span>
                <span className="font-mono">${cartTaxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-zinc-800">
                <span>Total Due</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 text-lg">
                  ${cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => {
                setPaymentAmount(cartTotal.toFixed(2));
                setCheckoutModalOpen(true);
              }}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 text-white text-sm font-bold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              <span>Charge ${cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CHECKOUT & RECEIPT MODAL */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {completedSale ? 'Transaction Receipt' : 'Complete Payment'}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {completedSale ? completedSale.invoice_number : `Order total: $${cartTotal.toFixed(2)}`}
                  </span>
                </div>
              </div>
              <button
                onClick={closeReceiptModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {!completedSale ? (
                /* Payment Input Form */
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Total Amount Due
                    </label>
                    <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-center">
                      <span className="text-3xl font-extrabold font-mono text-indigo-600 dark:text-indigo-400">
                        ${cartTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Cash Received ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={cartTotal}
                      required
                      autoFocus
                      placeholder="Enter amount..."
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-4 py-3 text-xl font-mono font-bold rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Quick Cash Presets */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2">
                      Quick Tender Presets:
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={handleExactCash}
                        className="py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-slate-700 dark:text-zinc-200 transition-colors border border-slate-200/60 dark:border-zinc-700"
                      >
                        Exact
                      </button>
                      {[50, 100, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickCash(amt)}
                          className="py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 text-slate-700 dark:text-zinc-200 transition-colors border border-slate-200/60 dark:border-zinc-700"
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Change Calculation */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                      Change Due:
                    </span>
                    <span
                      className={`text-xl font-mono font-extrabold ${
                        changeDue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                      }`}
                    >
                      ${Math.max(0, changeDue).toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!isPaymentValid || isProcessing}
                    className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-zinc-800 disabled:text-slate-400 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? 'Processing...' : `Confirm & Complete Sale`}
                  </button>
                </form>
              ) : (
                /* Completed Receipt View */
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm py-1">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Transaction Successful!</span>
                  </div>

                  {/* Printable Thermal Receipt Card */}
                  <div
                    id="printable-receipt"
                    className="p-5 rounded-2xl bg-white text-slate-900 border border-slate-200 font-mono text-xs space-y-3 shadow-inner"
                  >
                    <div className="text-center border-b border-dashed border-slate-300 pb-3">
                      <h4 className="text-base font-extrabold">POS DSS RETAIL</h4>
                      <p className="text-[10px] text-slate-500">Official Sales Receipt</p>
                      <p className="text-[10px] mt-1 text-slate-500">
                        Invoice: {completedSale.invoice_number}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Cashier: {user?.full_name || 'Admin'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(completedSale.transaction_date).toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
                      {(completedSale.items || []).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="truncate max-w-[180px]">
                            {item.quantity}x {item.product.name}
                          </span>
                          <span className="font-bold">${item.lineTotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>${Number(completedSale.subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax ({completedSale.tax_rate}%):</span>
                        <span>${Number(completedSale.tax_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200">
                        <span>Total:</span>
                        <span>${Number(completedSale.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Cash Tendered:</span>
                        <span>${Number(completedSale.payment_amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700">
                        <span>Change Given:</span>
                        <span>${Number(completedSale.change_amount).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
                      Thank you for your business!
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={printReceipt}
                      className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-zinc-700 transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      Print Receipt
                    </button>
                    <button
                      onClick={closeReceiptModal}
                      className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
                    >
                      New Sale
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
