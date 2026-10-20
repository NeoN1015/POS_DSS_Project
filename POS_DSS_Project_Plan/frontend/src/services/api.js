// Unified API Service for POS DSS
import seedData from '../seed.json';

const API_BASE = '/api/index.php';
const STORAGE_KEY_PREFIX = 'pos_dss_v2_';

function getStorage(key, fallback) {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error('Storage error', e);
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write error', e);
  }
}

// Session state
let csrfToken = null;
let activeUser = null;

// Initialize local fallback state from seed data
if (!localStorage.getItem(STORAGE_KEY_PREFIX + 'initialized')) {
  setStorage('categories', seedData.categories || []);
  setStorage('products', seedData.products || []);
  setStorage('sales', seedData.sales || []);
  setStorage('sale_items', seedData.sale_items || []);
  setStorage('users', seedData.users || [
    { id: 1, username: 'admin', full_name: 'Store Administrator', role: 'admin', is_active: 1 },
    { id: 2, username: 'cashier', full_name: 'Store Cashier', role: 'cashier', is_active: 1 },
    { id: 3, username: 'owner', full_name: 'Business Owner', role: 'owner', is_active: 1 },
  ]);
  setStorage('tax_rate', 0);
  setStorage('initialized', true);
}

async function request(action, { method = 'GET', body = null, params = {}, isFormData = false } = {}) {
  const query = new URLSearchParams({ action, ...params });
  const url = `${API_BASE}?${query.toString()}`;

  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';
  }
  if (csrfToken && method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (res.ok) {
      const payload = await res.json();
      if (payload.ok) {
        return payload.data;
      }
      throw new Error(payload.error || 'Server request returned error status');
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // If backend PHP is not reachable or endpoint fails, fall back smoothly to localStorage operations
    console.warn(`API call [${action}] fell back to local store:`, err.message);
    return localFallback(action, method, body, params);
  }
}

function localFallback(action, method, body, params) {
  const categories = getStorage('categories', []);
  const products = getStorage('products', []);
  const sales = getStorage('sales', []);
  const saleItems = getStorage('sale_items', []);
  const users = getStorage('users', []);
  const taxRate = getStorage('tax_rate', 0);

  switch (action) {
    case 'bootstrap': {
      const savedUser = activeUser || getStorage('user', users[0] || null);
      activeUser = savedUser;
      csrfToken = 'local-csrf-token';
      return {
        user: savedUser,
        csrf: csrfToken,
        tax_rate: taxRate,
        legacy_imported: true,
      };
    }
    case 'login': {
      const user = users.find(u => u.username.toLowerCase() === body.username.toLowerCase());
      if (user) {
        activeUser = user;
        setStorage('user', user);
        csrfToken = 'local-csrf-token';
        return { user, csrf: csrfToken };
      }
      throw new Error('Invalid username or password');
    }
    case 'logout': {
      activeUser = null;
      localStorage.removeItem(STORAGE_KEY_PREFIX + 'user');
      return null;
    }
    case 'categories': {
      return categories.filter(c => c.is_active !== 0);
    }
    case 'products': {
      return products.filter(p => p.is_active !== 0);
    }
    case 'sales': {
      return sales;
    }
    case 'sale_items': {
      return saleItems;
    }
    case 'users': {
      return users;
    }
    case 'sales_history': {
      return {
        sales,
        sale_items: saleItems,
        users,
        audit_logs: getStorage('audit_logs', []),
      };
    }
    case 'save_product': {
      let updatedProducts = [...products];
      let id = body.id ? Number(body.id) : 0;
      if (id > 0) {
        updatedProducts = updatedProducts.map(p => p.id === id ? { ...p, ...body } : p);
      } else {
        id = updatedProducts.length > 0 ? Math.max(...updatedProducts.map(p => Number(p.id) || 0)) + 1 : 1;
        const newProduct = {
          ...body,
          id,
          created_at: new Date().toISOString(),
          is_active: 1,
        };
        updatedProducts.push(newProduct);
      }
      setStorage('products', updatedProducts);
      return { id };
    }
    case 'archive_product': {
      const id = Number(body.id);
      const updated = products.map(p => p.id === id ? { ...p, is_active: 0 } : p);
      setStorage('products', updated);
      return { success: true };
    }
    case 'save_category': {
      let updatedCategories = [...categories];
      let id = body.id ? Number(body.id) : 0;
      if (id > 0) {
        updatedCategories = updatedCategories.map(c => c.id === id ? { ...c, ...body } : c);
      } else {
        id = updatedCategories.length > 0 ? Math.max(...updatedCategories.map(c => Number(c.id) || 0)) + 1 : 1;
        updatedCategories.push({
          ...body,
          id,
          created_at: new Date().toISOString(),
          is_active: 1,
        });
      }
      setStorage('categories', updatedCategories);
      return { id };
    }
    case 'delete_category': {
      const id = Number(body.id);
      const updated = categories.filter(c => c.id !== id);
      setStorage('categories', updated);
      return { success: true };
    }
    case 'checkout_sale': {
      const saleId = sales.length > 0 ? Math.max(...sales.map(s => Number(s.id) || 0)) + 1 : 1;
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      let subtotal = 0;
      let totalProfit = 0;

      const newSaleItems = (body.items || []).map((item, idx) => {
        const prod = products.find(p => p.id === item.product_id);
        const unitCost = prod ? Number(prod.cost || 0) : 0;
        const unitPrice = Number(item.price || item.unit_price || 0);
        const qty = Number(item.quantity || 1);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        const lineProfit = Number(((unitPrice - unitCost) * qty).toFixed(2));
        subtotal += lineTotal;
        totalProfit += lineProfit;

        // Auto deduct stock in local store
        if (prod) {
          prod.stock_quantity = Math.max(0, Number((Number(prod.stock_quantity) - qty).toFixed(2)));
        }

        return {
          id: (saleItems.length || 0) + idx + 1,
          sale_id: saleId,
          product_id: item.product_id,
          quantity: qty,
          unit_price: unitPrice,
          unit_cost: unitCost,
          line_total: lineTotal,
          line_profit: lineProfit,
        };
      });

      // Save updated products stock
      setStorage('products', products);

      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));
      const paymentAmount = Number(body.payment_amount || totalAmount);
      const changeAmount = Number((paymentAmount - totalAmount).toFixed(2));

      const newSale = {
        id: saleId,
        invoice_number: invoiceNumber,
        user_id: activeUser ? activeUser.id : 1,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_amount: paymentAmount,
        change_amount: changeAmount,
        total_profit: totalProfit,
        status: 'completed',
        transaction_date: new Date().toISOString(),
      };

      const updatedSales = [newSale, ...sales];
      const updatedItems = [...newSaleItems, ...saleItems];
      setStorage('sales', updatedSales);
      setStorage('sale_items', updatedItems);

      return {
        sale: newSale,
        items: newSaleItems,
      };
    }
    case 'void_sale': {
      const saleId = Number(body.transaction_id);
      const updatedSales = sales.map(s => s.id === saleId ? { ...s, status: 'voided' } : s);
      setStorage('sales', updatedSales);
      const audits = getStorage('audit_logs', []);
      audits.push({
        id: audits.length + 1,
        transaction_id: saleId,
        voided_by: activeUser ? activeUser.id : 1,
        timestamp: new Date().toISOString(),
        reason: body.reason || 'Voided via console',
      });
      setStorage('audit_logs', audits);
      return { success: true };
    }
    case 'update_margins': {
      const updates = body.updates || [];
      const updatedProducts = products.map(prod => {
        const found = updates.find(u => Number(u.id) === Number(prod.id));
        if (found) {
          return { ...prod, cost: Number(found.cost) };
        }
        return prod;
      });
      setStorage('products', updatedProducts);
      return { success: true };
    }
    default:
      return null;
  }
}

export const api = {
  // Authentication & Bootstrap
  async bootstrap() {
    const data = await request('bootstrap');
    if (data && data.user) {
      activeUser = data.user;
      csrfToken = data.csrf;
    }
    return data;
  },

  async login(username, password) {
    const data = await request('login', {
      method: 'POST',
      body: { username, password },
    });
    if (data && data.user) {
      activeUser = data.user;
      csrfToken = data.csrf;
    }
    return data;
  },

  async logout() {
    await request('logout', { method: 'POST' });
    activeUser = null;
    csrfToken = null;
  },

  // Categories
  async getCategories() {
    return request('categories');
  },

  async saveCategory(category) {
    return request('save_category', { method: 'POST', body: category });
  },

  async deleteCategory(id, strategy = 'safe') {
    return request('delete_category', { method: 'POST', body: { id, strategy } });
  },

  // Products
  async getProducts() {
    return request('products');
  },

  async saveProduct(product) {
    return request('save_product', { method: 'POST', body: product });
  },

  async archiveProduct(id) {
    return request('archive_product', { method: 'POST', body: { id } });
  },

  // Image Upload (Drag-and-Drop Dropzone support)
  async uploadProductImage(file) {
    // Attempt backend upload if PHP server is live
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await request('upload_product_image', {
        method: 'POST',
        body: formData,
        isFormData: true,
      });
      if (res && res.image_url) {
        return res.image_url;
      }
    } catch (e) {
      console.warn('Backend image upload endpoint not reachable; creating persistent local data URL:', e.message);
    }

    // High quality client-side Data URL conversion for instant preview & persistence
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Sales & Checkout
  async checkout(saleData) {
    return request('checkout_sale', { method: 'POST', body: saleData });
  },

  async getSalesHistory() {
    return request('sales_history');
  },

  async voidSale(transactionId, reason) {
    return request('void_sale', {
      method: 'POST',
      body: { transaction_id: transactionId, reason },
    });
  },

  // Margin Management
  async updateCosts(updates) {
    return request('update_margins', { method: 'POST', body: { updates } });
  },

  // Users
  async getUsers() {
    return request('users');
  },

  async saveUser(user) {
    return request('save_user', { method: 'POST', body: user });
  },

  async resetPassword(id, password) {
    return request('reset_user_password', { method: 'POST', body: { id, password } });
  },
};
