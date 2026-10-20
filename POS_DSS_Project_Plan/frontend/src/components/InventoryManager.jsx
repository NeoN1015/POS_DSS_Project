import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Boxes,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Edit,
  Archive,
  UploadCloud,
  X,
  AlertTriangle,
  CheckCircle,
  Package,
  ArrowUpDown,
  Filter,
  DollarSign,
  Tag,
  FolderPlus,
  Sparkles,
} from 'lucide-react';

export default function InventoryManager() {
  const {
    categories,
    products,
    refreshData,
    showToast,
    productModalOpen,
    setProductModalOpen,
    editingProduct,
    setEditingProduct,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'
  const [expandedCategories, setExpandedCategories] = useState(() => {
    // Expand all by default
    const map = {};
    categories.forEach(c => { map[c.id] = true; });
    return map;
  });

  // Modal states
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [stockAdjustModal, setStockAdjustModal] = useState(null); // product object
  const [stockAdjustmentQty, setStockAdjustmentQty] = useState('');
  const [stockAdjustReason, setStockAdjustReason] = useState('Restock purchase');

  // Product Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formMinStock, setFormMinStock] = useState('5');
  const [formUnitType, setFormUnitType] = useState('decimal');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // Toggle category accordion
  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  const expandAll = (expand = true) => {
    const map = {};
    categories.forEach(c => { map[c.id] = expand; });
    setExpandedCategories(map);
  };

  // Open Product Modal (New or Edit)
  const openProductForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name || '');
      setFormCategory(product.category_id?.toString() || '');
      setFormSku(product.sku || '');
      setFormPrice(product.price?.toString() || '');
      setFormCost(product.cost?.toString() || '');
      setFormStock(product.stock_quantity?.toString() || '');
      setFormMinStock(product.min_stock_level?.toString() || '5');
      setFormUnitType(product.unit_type || 'decimal');
      setFormImageUrl(product.image_url || '');
      setImagePreview(product.image_url || '');
      setImageFile(null);
    } else {
      setEditingProduct(null);
      setFormName('');
      setFormCategory(categories[0]?.id?.toString() || '1');
      setFormSku(`SKU-${Date.now().toString().slice(-4)}`);
      setFormPrice('');
      setFormCost('');
      setFormStock('10');
      setFormMinStock('5');
      setFormUnitType('decimal');
      setFormImageUrl('');
      setImagePreview('');
      setImageFile(null);
    }
    setProductModalOpen(true);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = (file) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (JPG, PNG, WebP, GIF)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB', 'error');
      return;
    }

    setImageFile(file);
    // Immediate Visual Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
      setFormImageUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setFormImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Product Form
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim() || !formPrice) {
      showToast('Please fill in required fields (Name, SKU, Price)', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      let finalImageUrl = formImageUrl;

      // If user uploaded a new image file, upload it through API service
      if (imageFile) {
        finalImageUrl = await api.uploadProductImage(imageFile);
      }

      const productPayload = {
        id: editingProduct ? editingProduct.id : 0,
        category_id: parseInt(formCategory, 10) || 1,
        sku: formSku.trim(),
        name: formName.trim(),
        description: '',
        price: parseFloat(formPrice) || 0,
        cost: parseFloat(formCost) || 0,
        stock_quantity: parseFloat(formStock) || 0,
        min_stock_level: parseFloat(formMinStock) || 5,
        unit_type: formUnitType,
        image_url: finalImageUrl,
        is_active: 1,
      };

      await api.saveProduct(productPayload);
      await refreshData();
      setProductModalOpen(false);
      showToast(`Product "${formName}" saved successfully!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Archive Product
  const handleArchiveProduct = async (product) => {
    if (window.confirm(`Are you sure you want to archive "${product.name}"?`)) {
      try {
        await api.archiveProduct(product.id);
        await refreshData();
        showToast(`Archived "${product.name}"`, 'info');
      } catch (err) {
        showToast(err.message || 'Failed to archive product', 'error');
      }
    }
  };

  // Stock Quick Adjustment
  const handleStockAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!stockAdjustModal) return;

    const qtyChange = parseFloat(stockAdjustmentQty);
    if (isNaN(qtyChange)) {
      showToast('Please enter a valid quantity change', 'warning');
      return;
    }

    const newStock = Math.max(0, Number((Number(stockAdjustModal.stock_quantity) + qtyChange).toFixed(2)));

    try {
      await api.saveProduct({
        ...stockAdjustModal,
        stock_quantity: newStock,
      });
      await refreshData();
      setStockAdjustModal(null);
      setStockAdjustmentQty('');
      showToast(`Stock updated to ${newStock} for "${stockAdjustModal.name}"`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to adjust stock', 'error');
    }
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (p.is_active === 0) return false;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (stockFilter === 'low') {
        return Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= Number(p.min_stock_level);
      }
      if (stockFilter === 'out') {
        return Number(p.stock_quantity) <= 0;
      }
      return true;
    });
  }, [products, searchQuery, stockFilter]);

  // Group filtered products by Category
  const groupedProducts = useMemo(() => {
    const groups = {};
    categories.forEach(cat => {
      groups[cat.id] = {
        category: cat,
        items: filteredProducts.filter(p => p.category_id === cat.id),
      };
    });
    return groups;
  }, [categories, filteredProducts]);

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-card border border-slate-200/80 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search & Stock Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search inventory by name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Stock Filter Pill Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                stockFilter === 'all'
                  ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                stockFilter === 'low'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-amber-500'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                stockFilter === 'out'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-rose-500'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mr-2 hidden sm:flex">
            <button
              onClick={() => expandAll(true)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2"
            >
              Expand All
            </button>
            <span>•</span>
            <button
              onClick={() => expandAll(false)}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-2"
            >
              Collapse
            </button>
          </div>

          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold border border-slate-200 dark:border-zinc-700 transition-all flex items-center gap-1.5"
          >
            <FolderPlus className="w-3.5 h-3.5 text-indigo-500" />
            <span>Category</span>
          </button>

          <button
            onClick={() => openProductForm(null)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Grouped Accordions Section */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const group = groupedProducts[cat.id];
          const items = group ? group.items : [];
          const isExpanded = !!expandedCategories[cat.id];
          const lowStockCount = items.filter(
            p => Number(p.stock_quantity) <= Number(p.min_stock_level)
          ).length;

          if (stockFilter !== 'all' && items.length === 0) {
            return null; // hide empty categories when filtering
          }

          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-card border border-slate-200/80 dark:border-zinc-800 overflow-hidden transition-all duration-200"
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleCategory(cat.id)}
                className="p-4 sm:p-5 flex items-center justify-between cursor-pointer select-none bg-slate-50/50 dark:bg-zinc-800/30 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-transform"
                    aria-label="Toggle accordion"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{cat.name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        {items.length} {items.length === 1 ? 'product' : 'products'}
                      </span>
                    </h3>
                    {cat.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>
                    )}
                  </div>
                </div>

                {/* Right summary badges */}
                <div className="flex items-center gap-2">
                  {lowStockCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {lowStockCount} Low Stock
                    </span>
                  )}
                </div>
              </div>

              {/* Accordion Body: Products Table */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-zinc-800 overflow-x-auto">
                  {items.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">
                      No matching products in this category.
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">Item & SKU</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4">Cost</th>
                          <th className="py-3 px-4">Stock Level</th>
                          <th className="py-3 px-4 text-center">Unit Type</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {items.map((product) => {
                          const stockNum = Number(product.stock_quantity);
                          const minStock = Number(product.min_stock_level);
                          const isOut = stockNum <= 0;
                          const isLow = stockNum > 0 && stockNum <= minStock;

                          return (
                            <tr
                              key={product.id}
                              className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                            >
                              {/* Product Info with thumbnail */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700/60 p-1 shrink-0 flex items-center justify-center overflow-hidden">
                                    {product.image_url ? (
                                      <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <Package className="w-6 h-6 text-slate-300 dark:text-zinc-600" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-zinc-100">
                                      {product.name}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                                      {product.sku}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-zinc-100">
                                ${Number(product.price).toFixed(2)}
                              </td>

                              {/* Cost */}
                              <td className="py-3 px-4 font-mono text-slate-500 dark:text-zinc-400">
                                ${Number(product.cost || 0).toFixed(2)}
                              </td>

                              {/* Stock Level with Quick Adjustment trigger */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      isOut
                                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                                        : isLow
                                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900'
                                    }`}
                                  >
                                    {stockNum} units
                                  </span>

                                  <button
                                    onClick={() => {
                                      setStockAdjustModal(product);
                                      setStockAdjustmentQty('10');
                                    }}
                                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    title="Adjust or restock quantity"
                                  >
                                    Adjust
                                  </button>
                                </div>
                              </td>

                              {/* Unit Type */}
                              <td className="py-3 px-4 text-center">
                                <span className="text-[11px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-500">
                                  {product.unit_type || 'decimal'}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openProductForm(product)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800 transition-colors"
                                    title="Edit product"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleArchiveProduct(product)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-800 transition-colors"
                                    title="Archive product"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DRAG-AND-DROP PRODUCT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {editingProduct ? `SKU: ${editingProduct.sku}` : 'Fill in the product and inventory details'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleProductSubmit} className="p-6 overflow-y-auto space-y-5">
              {/* Image Drag-and-Drop Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Product Image (Drag & Drop or Select)
                </label>

                {imagePreview ? (
                  <div className="relative w-full aspect-video sm:aspect-21/9 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center p-3">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearImage}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-colors shadow-md"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                        : 'border-slate-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-zinc-600 bg-slate-50/60 dark:bg-zinc-800/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2 shadow-xs">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                      Drag local files directly here from Windows Explorer
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      or click to browse from your device (JPG, PNG, WebP up to 5MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cola 330ml"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    SKU Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BEV-001"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Selling Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Cost Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Current Stock Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Min Stock Threshold (Alert)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Unit Type
                  </label>
                  <select
                    value={formUnitType}
                    onChange={(e) => setFormUnitType(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                  >
                    <option value="decimal">Decimal (Weights, Liters, Fractions)</option>
                    <option value="unit">Discrete Unit (Pcs, Cans, Boxes)</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK STOCK ADJUSTMENT MODAL */}
      {stockAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Adjust Stock Quantity
                </h3>
                <span className="text-xs text-slate-400 font-medium">
                  {stockAdjustModal.name} (Current: {stockAdjustModal.stock_quantity})
                </span>
              </div>
              <button
                onClick={() => setStockAdjustModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStockAdjustSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Quantity to Add / Deduct
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="+10 or -5"
                  value={stockAdjustmentQty}
                  onChange={(e) => setStockAdjustmentQty(e.target.value)}
                  className="w-full px-4 py-3 font-mono font-bold text-lg rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enter positive number to add stock, negative to deduct.
                </span>
              </div>

              {/* Quick Presets */}
              <div className="flex gap-2">
                {[+5, +10, +25, +50, -5].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStockAdjustmentQty(preset.toString())}
                    className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 transition-colors"
                  >
                    {preset > 0 ? `+${preset}` : preset}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Adjustment Reason / Notes
                </label>
                <input
                  type="text"
                  value={stockAdjustReason}
                  onChange={(e) => setStockAdjustReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY MANAGEMENT MODAL */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add New Category
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!catName.trim()) return;
                try {
                  await api.saveCategory({ name: catName.trim(), description: catDesc.trim(), image_url: '' });
                  await refreshData();
                  setCatName('');
                  setCatDesc('');
                  setCategoryModalOpen(false);
                  showToast('Category created!', 'success');
                } catch (err) {
                  showToast(err.message || 'Failed to save category', 'error');
                }
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Frozen Foods"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Brief note about this category..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
