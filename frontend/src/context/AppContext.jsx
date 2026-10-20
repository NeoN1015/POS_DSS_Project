import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'light');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Core Data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [taxRate, setTaxRate] = useState(0);

  // Cart State
  const [cart, setCart] = useState([]);

  // Modals & UI triggers
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync theme with DOM
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(prev => prev && prev.id ? null : prev);
    }, 3500);
  };

  // Bootstrap data
  const loadData = async () => {
    try {
      setLoading(true);
      const bootstrap = await api.bootstrap();
      if (bootstrap && bootstrap.user) {
        setUser(bootstrap.user);
        setTaxRate(Number(bootstrap.tax_rate) || 0);
      }

      const [cats, prods, hist] = await Promise.all([
        api.getCategories(),
        api.getProducts(),
        api.getSalesHistory(),
      ]);

      setCategories(cats || []);
      setProducts(prods || []);
      if (hist) {
        setSales(hist.sales || []);
        setSaleItems(hist.sale_items || []);
      }
    } catch (err) {
      console.error('Failed to load initial data:', err);
      showToast('Could not sync with server. Operating in offline/cached mode.', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await api.login(username, password);
      if (data && data.user) {
        setUser(data.user);
        showToast(`Welcome back, ${data.user.full_name}!`, 'success');
        await loadData();
        return true;
      }
    } catch (err) {
      showToast(err.message || 'Login failed', 'error');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
      setCart([]);
      showToast('Signed out successfully', 'info');
    } catch (err) {
      setUser(null);
    }
  };

  // Cart operations
  const addToCart = (product, quantity = 1) => {
    if (Number(product.stock_quantity) <= 0) {
      showToast(`"${product.name}" is out of stock!`, 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = Number((existing.quantity + quantity).toFixed(2));
        if (newQty > Number(product.stock_quantity)) {
          showToast(`Cannot add more than available stock (${product.stock_quantity} available)`, 'warning');
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: newQty, lineTotal: Number((newQty * item.unitPrice).toFixed(2)) }
            : item
        );
      } else {
        const initialQty = Number(quantity.toFixed(2));
        if (initialQty > Number(product.stock_quantity)) {
          showToast(`Cannot add more than available stock (${product.stock_quantity} available)`, 'warning');
          return prev;
        }
        return [
          ...prev,
          {
            product,
            quantity: initialQty,
            unitPrice: Number(product.price),
            lineTotal: Number((initialQty * Number(product.price)).toFixed(2)),
          }
        ];
      }
    });
  };

  const updateCartQuantity = (productId, newQuantity) => {
    const qty = Number(newQuantity);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const clampedQty = Math.min(qty, Number(item.product.stock_quantity));
          if (qty > Number(item.product.stock_quantity)) {
            showToast(`Max available stock is ${item.product.stock_quantity}`, 'warning');
          }
          return {
            ...item,
            quantity: Number(clampedQty.toFixed(2)),
            lineTotal: Number((clampedQty * item.unitPrice).toFixed(2)),
          };
        }
        return item;
      });
    });
  };

  // Dual Increments: Main (+1/-1) & Precision (+0.25/-0.25)
  const adjustCartQuantity = (productId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const nextQty = Number((item.quantity + delta).toFixed(2));
          if (nextQty <= 0) return null;
          if (nextQty > Number(item.product.stock_quantity)) {
            showToast(`Max available stock reached (${item.product.stock_quantity})`, 'warning');
            return item;
          }
          return {
            ...item,
            quantity: nextQty,
            lineTotal: Number((nextQty * item.unitPrice).toFixed(2)),
          };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Cart Calculations
  const cartSubtotal = Number(cart.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
  const cartTaxAmount = Number(((cartSubtotal * taxRate) / 100).toFixed(2));
  const cartTotal = Number((cartSubtotal + cartTaxAmount).toFixed(2));

  // Low Stock Items (Stock <= Min Stock)
  const lowStockProducts = products.filter(
    p => Number(p.stock_quantity) <= Number(p.min_stock_level) && p.is_active !== 0
  );

  return (
    <AppContext.Provider
      value={{
        user,
        loading,
        theme,
        toggleTheme,
        activeTab,
        setActiveTab,
        sidebarCollapsed,
        setSidebarCollapsed,
        categories,
        products,
        sales,
        saleItems,
        taxRate,
        setTaxRate,
        cart,
        cartSubtotal,
        cartTaxAmount,
        cartTotal,
        addToCart,
        updateCartQuantity,
        adjustCartQuantity,
        removeFromCart,
        clearCart,
        lowStockProducts,
        productModalOpen,
        setProductModalOpen,
        editingProduct,
        setEditingProduct,
        refreshData: loadData,
        login,
        logout,
        showToast,
        toastMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
