import {
  apiPost,
  apiGet,
  checkoutSale,
  dbAdd,
  dbAll,
  dbPut,
  getTaxRate,
  importLegacyDatabase,
  initDb,
  legacyImportAvailable,
  money,
  quantity,
  roundMoney,
  uploadProductImage,
} from './db.js';
import { can, currentUser, e, login, logout, roleLabel } from './auth.js';

const app = document.getElementById('app');
let charts = [];

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
}

function route() {
  return (location.hash.replace(/^#/, '') || '/login').split('?')[0];
}

function go(path) {
  location.hash = path;
}

function navItems(user) {
  return [
    { href: '#/dashboard', label: 'Dashboard', show: true, match: '/dashboard' },
    { href: '#/pos', label: 'Point of Sale', show: can(user, 'pos'), match: '/pos' },
    { href: '#/products', label: 'Products & Inventory', show: can(user, 'products_view'), match: '/products' },
    { href: '#/margins', label: 'Cost & Margins', show: can(user, 'margins'), match: '/margins' },
    { href: '#/reports', label: 'Sales Reports', show: can(user, 'reports'), match: '/reports' },
    { href: '#/sales-history', label: 'Sales History / Voids', show: can(user, 'sales_history'), match: '/sales-history' },
    { href: '#/users', label: 'Users', show: can(user, 'users'), match: '/users' },
  ].filter((item) => item.show);
}

function shell(user, title, body, current) {
  const links = navItems(user).map((item) => `
    <a class="nav-link ${item.match === current ? 'active' : ''}" href="${item.href}">${e(item.label)}</a>
  `).join('');
  return `
    <div class="layout">
      <aside class="sidebar d-none d-lg-flex flex-column p-3 text-white">
        <div class="d-flex align-items-center gap-2 mb-4">
          <span class="brand-mark">POS</span>
          <div><div class="fw-semibold">POS DSS</div><div class="small text-white-50">SME retail console</div></div>
        </div>
        <nav class="nav flex-column gap-1 flex-grow-1">${links}</nav>
        <div class="small text-white-50">Signed in as<br><strong class="text-white">${e(user.full_name)}</strong></div>
      </aside>
      <div class="main">
        <header class="topbar px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav">Menu</button>
            <h1 class="h5 mb-0">${e(title)}</h1>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge rounded-pill role-pill px-3 py-2">${e(roleLabel(user.role))}</span>
            <button class="btn btn-sm btn-outline-danger" id="logoutBtn" type="button">Log out</button>
          </div>
        </header>
        <div class="offcanvas offcanvas-start text-bg-dark" id="mobileNav">
          <div class="offcanvas-header"><h5 class="offcanvas-title">POS DSS</h5><button class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button></div>
          <div class="offcanvas-body">${navItems(user).map((item) => `<a class="d-block text-white text-decoration-none py-2" href="${item.href}" data-bs-dismiss="offcanvas">${e(item.label)}</a>`).join('')}</div>
        </div>
        <main class="p-3 p-lg-4">${body}</main>
      </div>
    </div>
  `;
}

function bindLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await logout();
      go('/login');
    } catch (error) {
      showPageError(error);
    }
  });
}

async function requireUser(feature) {
  const user = await currentUser();
  if (!user) {
    go('/login');
    return null;
  }
  if (feature && !can(user, feature)) {
    app.innerHTML = shell(user, 'Access denied', '<div class="alert alert-danger">Your role cannot open this page.</div>', '');
    bindLogout();
    return null;
  }
  return user;
}

function showPageError(error) {
  destroyCharts();
  app.innerHTML = `<div class="container py-4"><div class="alert alert-danger"><h1 class="h5">POS DSS could not load this page</h1><p class="mb-0">${e(error?.message || 'An unexpected error occurred.')}</p></div></div>`;
}

function showOperationError(error) {
  const main = app.querySelector('main');
  if (main) {
    main.insertAdjacentHTML('afterbegin', `<div class="alert alert-danger" role="alert">${e(error?.message || 'The operation could not be completed.')}</div>`);
  } else {
    showPageError(error);
  }
}

function showConfirmModal({ title, details, confirmLabel, phrase = '', reasonLabel = '' }) {
  return new Promise((resolve) => {
    const modalElement = document.createElement('div');
    modalElement.className = 'modal fade';
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog modal-dialog-centered"><form class="modal-content">
        <div class="modal-header"><h2 class="modal-title h5">${e(title)}</h2><button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
          ${details.map((detail) => `<p>${e(detail)}</p>`).join('')}
          ${phrase ? `<div class="mb-3"><label class="form-label">Type <strong>${e(phrase)}</strong> to continue</label><input class="form-control" name="phrase" autocomplete="off" required></div>` : ''}
          ${reasonLabel ? `<div><label class="form-label" for="actionReason">${e(reasonLabel)}</label><textarea class="form-control" id="actionReason" name="reason" rows="3" maxlength="1000" required></textarea></div>` : ''}
          <div class="small text-danger mt-2" data-validation-message></div>
        </div>
        <div class="modal-footer"><button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-danger" type="submit" ${phrase || reasonLabel ? 'disabled' : ''}>${e(confirmLabel)}</button></div>
      </form></div>`;
    document.body.append(modalElement);
    const modal = new bootstrap.Modal(modalElement);
    const form = modalElement.querySelector('form');
    const confirmButton = form.querySelector('[type="submit"]');
    const phraseInput = form.elements.namedItem('phrase');
    const reasonInput = form.elements.namedItem('reason');
    const updateValidity = () => {
      const phraseValid = !phrase || phraseInput.value === phrase;
      const reasonValid = !reasonLabel || reasonInput.value.trim().length > 0;
      confirmButton.disabled = !phraseValid || !reasonValid;
      modalElement.querySelector('[data-validation-message]').textContent = phrase && !phraseValid
        ? `Enter ${phrase} exactly to continue.`
        : (reasonLabel && !reasonValid ? 'A reason is required.' : '');
    };
    phraseInput?.addEventListener('input', updateValidity);
    reasonInput?.addEventListener('input', updateValidity);
    let result = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      updateValidity();
      if (confirmButton.disabled) return;
      result = { reason: reasonInput?.value.trim() || '' };
      modal.hide();
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
      resolve(result);
    }, { once: true });
    modal.show();
  });
}

function showCategoryDeleteModal(info) {
  return new Promise((resolve) => {
    const modalElement = document.createElement('div');
    modalElement.className = 'modal fade';
    modalElement.tabIndex = -1;
    modalElement.innerHTML = `
      <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
        <div class="modal-header"><h2 class="modal-title h5">Delete category: ${e(info.name)}</h2><button class="btn-close" type="button" data-bs-dismiss="modal" aria-label="Close"></button></div>
        <div class="modal-body">
          <p>This category contains ${info.total_products} product${info.total_products === 1 ? '' : 's'}, including ${info.active_products} active.</p>
          <div class="alert alert-info"><strong>Safe delete:</strong> reassign every product (including archived products) to the Uncategorized category, then remove this category.</div>
          <button type="button" class="btn btn-outline-primary mb-3" data-safe-delete>Reassign products and delete</button>
          <div class="alert alert-warning mb-2"><strong>Archive category and products:</strong> hide this category and all its products; past sales are preserved.</div>
          <form data-cascade-form><label class="form-label" for="categoryConfirmation">Type the exact category name to continue</label>
            <input class="form-control mb-2" id="categoryConfirmation" autocomplete="off" required>
            <button class="btn btn-danger" type="submit" disabled>Archive category and products</button>
            <div class="small text-danger mt-2" data-validation-message></div>
          </form>
        </div><div class="modal-footer"><button class="btn btn-outline-secondary" type="button" data-bs-dismiss="modal">Cancel</button></div>
      </div></div>`;
    document.body.append(modalElement);
    const modal = new bootstrap.Modal(modalElement);
    const cascadeInput = modalElement.querySelector('#categoryConfirmation');
    const cascadeButton = modalElement.querySelector('[data-cascade-form] button[type="submit"]');
    const updateCascadeValidity = () => {
      const isValid = cascadeInput.value === info.name;
      cascadeButton.disabled = !isValid;
      modalElement.querySelector('[data-validation-message]').textContent = cascadeInput.value && !isValid
        ? 'The category name must match exactly.'
        : '';
    };
    cascadeInput.addEventListener('input', updateCascadeValidity);
    let result = null;
    modalElement.querySelector('[data-safe-delete]').addEventListener('click', () => {
      result = { strategy: 'safe' };
      modal.hide();
    });
    modalElement.querySelector('[data-cascade-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      updateCascadeValidity();
      if (cascadeButton.disabled) return;
      result = { strategy: 'cascade', confirmation: cascadeInput.value };
      modal.hide();
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      modalElement.remove();
      resolve(result);
    }, { once: true });
    modal.show();
  });
}

async function deleteCategory(category) {
  const info = await apiGet('category_info', { id: String(category.id) });
  let choice;
  if (info.total_products > 0) {
    choice = await showCategoryDeleteModal(info);
    if (!choice) return false;
    await apiPost('delete_category', { id: info.id, ...choice });
  } else {
    choice = await showConfirmModal({
      title: `Delete category: ${info.name}`,
      details: ['This category is empty. It will be removed without affecting products or sales.'],
      confirmLabel: 'Delete category',
    });
    if (!choice) return false;
    await apiPost('delete_category', { id: info.id, strategy: 'safe' });
    choice = { strategy: 'safe' };
  }
  return choice;
}

async function archiveProduct(product) {
  const choice = await showConfirmModal({
    title: `Archive ${product.name}?`,
    details: [
      'The product will immediately disappear from POS, inventory, and cost tracking.',
      'Its stock record and historical sale details will remain saved; existing sales are not changed.',
    ],
    confirmLabel: 'Archive product',
  });
  if (!choice) return false;
  await apiPost('archive_product', { id: Number(product.id) });
  return true;
}

function localDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateAtOffset(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

function imageMarkup(url, alt = '', productImage = false) {
  const image = String(url || '').trim();
  const safeUrl = /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(image) ? e(image) : './assets/icons/image-placeholder.svg';
  return `<div class="image-frame${productImage ? ' product-image' : ''}"><img src="${safeUrl}" alt="${e(alt)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/icons/image-placeholder.svg'"></div>`;
}

function metricCard(label, value, detail = '') {
  return `<div class="metric-card"><div class="small text-secondary text-uppercase">${e(label)}</div><div class="metric-value">${value}</div>${detail ? `<div class="small text-secondary">${detail}</div>` : ''}</div>`;
}

async function renderLogin() {
  if (await currentUser()) {
    go('/dashboard');
    return;
  }
  app.innerHTML = `
    <div class="auth-body d-flex align-items-center justify-content-center p-3 min-vh-100">
      <div class="card auth-card shadow-lg w-100"><div class="card-body p-4 p-md-5">
        <div class="d-flex align-items-center gap-2 mb-3"><span class="brand-mark">POS</span><div><h1 class="h4 mb-0">POS DSS</h1><div class="text-secondary small">Retail management system</div></div></div>
        <div id="loginError"></div>
        <form id="loginForm">
          <div class="mb-3"><label class="form-label" for="username">Username</label><input class="form-control" id="username" name="username" autocomplete="username" required></div>
          <div class="mb-4"><label class="form-label" for="password">Password</label><input class="form-control" id="password" name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary w-100" type="submit">Sign in</button>
        </form>
        <p class="small text-secondary mt-4 mb-0">Demo accounts: admin / admin123 · cashier / cashier123 · owner / owner123</p>
      </div></div>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await login(document.getElementById('username').value, document.getElementById('password').value);
    if (!result.ok) {
      document.getElementById('loginError').innerHTML = `<div class="alert alert-danger py-2">${e(result.error)}</div>`;
      return;
    }
    go('/dashboard');
  });
}

function rangeStart(period) {
  if (period === '7') return dateAtOffset(6);
  if (period === '30') return dateAtOffset(29);
  return dateAtOffset(0);
}

function drawDashboardCharts(period, sales, products, categories) {
  const start = rangeStart(period);
  const count = Number(period);
  const keys = Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return localDateKey(date);
  });
  const revenue = Object.fromEntries(keys.map((key) => [key, 0]));
  const profit = Object.fromEntries(keys.map((key) => [key, null]));
  const completeProfit = Object.fromEntries(keys.map((key) => [key, true]));
  sales.filter((sale) => sale.status === 'completed').forEach((sale) => {
    const key = localDateKey(sale.transaction_date);
    if (key in revenue) {
      revenue[key] = roundMoney(revenue[key] + Number(sale.total_amount));
      if (sale.total_profit !== null && sale.total_profit !== undefined) {
        profit[key] = roundMoney((profit[key] ?? 0) + Number(sale.total_profit));
      } else {
        completeProfit[key] = false;
      }
    }
  });
  keys.forEach((key) => {
    if (!completeProfit[key]) profit[key] = null;
  });

  charts.push(new Chart(document.getElementById('salesTrendChart'), {
    type: 'line',
    data: {
      labels: keys.map((key) => key.slice(5)),
      datasets: [
        { label: 'Revenue', data: keys.map((key) => revenue[key]), borderColor: '#21867a', backgroundColor: 'rgba(42,157,143,.12)', fill: true, tension: 0.3 },
        { label: 'Profit', data: keys.map((key) => profit[key]), borderColor: '#e59a2f', tension: 0.3, spanGaps: false },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true } } },
  }));

  const activeProducts = products.filter((product) => product.is_active);
  const lowByCategory = new Set(activeProducts.filter((product) => product.stock_quantity <= product.min_stock_level).map((product) => Number(product.category_id)));
  const totals = categories.map((category) => activeProducts.filter((product) => Number(product.category_id) === Number(category.id)).reduce((sum, product) => sum + Number(product.stock_quantity), 0));
  charts.push(new Chart(document.getElementById('inventoryChart'), {
    type: 'bar',
    data: {
      labels: categories.map((category) => category.name),
      datasets: [{ label: 'Current stock', data: totals, backgroundColor: categories.map((category) => lowByCategory.has(Number(category.id)) ? '#d9534f' : '#345775') }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
  }));
}

async function renderDashboard(period = '7') {
  const user = await requireUser();
  if (!user) return;
  destroyCharts();
  const [sales, products, categories, items] = await Promise.all([
    dbAll('sales'), dbAll('products'), dbAll('categories'), dbAll('sale_items'),
  ]);
  const activeCategories = categories.filter((category) => category.is_active);
  const showDss = can(user, 'dss');
  const today = localDateKey(new Date());
  const todaysSales = sales.filter((sale) => sale.status === 'completed' && localDateKey(sale.transaction_date) === today);
  const lowStock = products.filter((product) => product.is_active && Number(product.stock_quantity) <= Number(product.min_stock_level));
  const todayRevenue = todaysSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const todayProfitKnown = todaysSales.filter((sale) => sale.total_profit !== null && sale.total_profit !== undefined);
  const todayProfit = todayProfitKnown.reduce((sum, sale) => sum + Number(sale.total_profit), 0);
  const profitIsComplete = todayProfitKnown.length === todaysSales.length;
  const soldByProduct = new Map();
  items.forEach((item) => {
    const sale = sales.find((row) => Number(row.id) === Number(item.sale_id) && row.status === 'completed');
    if (sale) soldByProduct.set(Number(item.product_id), (soldByProduct.get(Number(item.product_id)) || 0) + Number(item.quantity));
  });
  const topProducts = [...soldByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  app.innerHTML = shell(user, 'Dashboard', `
    <p class="text-secondary">Welcome, <strong>${e(user.full_name)}</strong>. Sales, inventory, and decision-support insights.</p>
    ${legacyImportAvailable() && can(user, 'users') ? `<div class="alert alert-info d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2"><span>Older POS records are still saved in this browser. Import them into the SQLite database before clearing browser data.</span><button id="importLegacy" class="btn btn-sm btn-primary">Import browser data</button></div>` : ''}
    <div class="metric-grid mb-3">
      ${metricCard('Sales today', can(user, 'reports') || can(user, 'pos') ? money(todayRevenue) : '—', `${todaysSales.length} receipts`)}
      ${metricCard('Profit today', can(user, 'reports') ? (profitIsComplete ? money(todayProfit) : '—') : '—', can(user, 'reports') ? (profitIsComplete ? 'From saved sale-time costs' : 'Some sales have no cost history') : 'Owner/admin access')}
      ${metricCard('Low-stock products', String(lowStock.length), lowStock.length ? 'At or below reorder level' : 'All items above minimum')}
    </div>
    ${showDss ? `<div class="tile p-3 mb-3">
      <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2 mb-2"><div><h2 class="h6 mb-1">Revenue and profit</h2><div class="small text-secondary">Daily totals</div></div>
        <div class="btn-group btn-group-sm" role="group" aria-label="Sales chart range">
          <button class="btn btn-outline-primary ${period === '1' ? 'active' : ''}" data-period="1">Today</button>
          <button class="btn btn-outline-primary ${period === '7' ? 'active' : ''}" data-period="7">7 days</button>
          <button class="btn btn-outline-primary ${period === '30' ? 'active' : ''}" data-period="30">30 days</button>
        </div>
      </div>
      <div class="chart-box"><canvas id="salesTrendChart"></canvas></div>
    </div>` : ''}
    ${showDss ? `
    <div class="row g-3">
      <div class="col-lg-7"><div class="tile p-3 h-100"><h2 class="h6">Stock by category <span class="badge ${lowStock.length ? 'text-bg-danger' : 'text-bg-success'}">${lowStock.length ? `${lowStock.length} low-stock` : 'Healthy stock'}</span></h2><div class="chart-box"><canvas id="inventoryChart"></canvas></div></div></div>
      <div class="col-lg-5"><div class="tile p-3 h-100"><h2 class="h6">Top-selling products</h2>
        ${topProducts.length ? `<ol class="mb-0 ps-3">${topProducts.map(([productId, sold]) => {
          const product = products.find((row) => Number(row.id) === productId);
          return `<li class="py-2">${e(product?.name || `Product #${productId}`)} <span class="text-secondary">· ${quantity(sold)} sold</span></li>`;
        }).join('')}</ol>` : '<p class="text-secondary mb-0">Completed sales will appear here.</p>'}
      </div></div>
    </div>
    ` : ''}
    <div class="tile p-3 mt-3"><h2 class="h6">Low-stock items</h2>
      ${lowStock.length ? `<div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>SKU</th><th>Product</th><th>Stock</th><th>Minimum</th></tr></thead><tbody>${lowStock.map((product) => `<tr class="table-danger"><td>${e(product.sku)}</td><td>${e(product.name)}</td><td>${quantity(product.stock_quantity)}</td><td>${quantity(product.min_stock_level)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-secondary mb-0">No products need reordering.</p>'}
    </div>
  `, '/dashboard');
  bindLogout();
  document.querySelectorAll('[data-period]').forEach((button) => button.addEventListener('click', () => renderDashboard(button.dataset.period)));
  if (legacyImportAvailable() && can(user, 'users')) {
    document.getElementById('importLegacy').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Importing…';
      try {
        await importLegacyDatabase();
        await initDb();
        await renderDashboard(period);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Import browser data';
        button.insertAdjacentHTML('afterend', `<div class="alert alert-danger mt-2 mb-0">${e(error.message)}</div>`);
      }
    });
  }
  destroyCharts();
  if (showDss) drawDashboardCharts(period, sales, products, activeCategories);
}

function isFallbackCategory(category) {
  return String(category.name).trim().toLowerCase() === 'uncategorized';
}

function categoryAccordion(category, products, manage, showCost, canDelete) {
  const rows = products.map((product) => {
    const isLow = Number(product.stock_quantity) <= Number(product.min_stock_level);
    return `<tr>
      <td>${imageMarkup(product.image_url, product.name, true)}</td><td>${e(product.sku)}</td><td>${e(product.name)}</td>
      <td>${money(product.price)}</td>${showCost ? `<td>${money(product.cost)}</td>` : ''}
      <td>${quantity(product.stock_quantity)} ${isLow ? '<span class="badge text-bg-danger">Low</span>' : ''}</td>
      <td>${quantity(product.min_stock_level)}</td><td>${product.is_active ? 'Active' : 'Hidden'}</td>
      ${manage ? `<td><button class="btn btn-sm btn-outline-primary" data-edit-product="${product.id}">Edit</button></td>` : ''}
      ${canDelete ? `<td><button class="btn btn-sm btn-outline-danger" data-archive-product="${product.id}">Archive</button></td>` : ''}
    </tr>`;
  }).join('');
  const columns = 7 + Number(showCost) + Number(manage) + Number(canDelete);
  return `<details class="category-section" open><summary><span>${e(category.name)}</span><span class="d-flex align-items-center gap-2"><span class="small text-secondary">${products.length} products</span>${canDelete && !isFallbackCategory(category) ? `<button class="btn btn-sm btn-outline-danger" data-delete-category="${category.id}" type="button">Delete category</button>` : ''}</span></summary>
    <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Image</th><th>SKU</th><th>Product</th><th>Price</th>${showCost ? '<th>Cost</th>' : ''}<th>Stock</th><th>Min.</th><th>Status</th>${manage ? '<th></th>' : ''}${canDelete ? '<th></th>' : ''}</tr></thead><tbody>${rows || `<tr><td colspan="${columns}" class="text-secondary">No products in this category.</td></tr>`}</tbody></table></div>
  </details>`;
}

async function renderProducts() {
  const user = await requireUser('products_view');
  if (!user) return;
  const manage = can(user, 'products_manage');
  const canDelete = can(user, 'sales_history');
  const showCost = can(user, 'margins');
  const [products, categories] = await Promise.all([dbAll('products'), dbAll('categories')]);
  const activeCategories = categories.filter((category) => category.is_active);
  const archivedCategories = categories.filter((category) => !category.is_active);
  const activeProducts = products.filter((product) => product.is_active);
  const archivedProducts = products.filter((product) => !product.is_active);
  app.innerHTML = shell(user, 'Products & Inventory', `
    ${manage ? `<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-primary" id="addCategory">Add new category</button><button class="btn btn-outline-primary" id="addProduct">Add product</button></div>` : '<p class="text-secondary">Browse product availability by category.</p>'}
    <div id="categoryList">${activeCategories.map((category) => categoryAccordion(category, activeProducts.filter((product) => Number(product.category_id) === Number(category.id)), manage, showCost, canDelete)).join('') || '<div class="alert alert-secondary">No categories yet.</div>'}</div>
    ${canDelete && archivedProducts.length ? `<section class="tile p-3 mt-3"><h2 class="h6">Archived products</h2><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th></th></tr></thead><tbody>${archivedProducts.map((product) => `<tr><td>${e(product.name)}</td><td>${e(product.sku)}</td><td>${e(categories.find((category) => Number(category.id) === Number(product.category_id))?.name || 'Unknown')}</td><td><button class="btn btn-sm btn-outline-primary" data-restore-product="${product.id}">Restore</button></td></tr>`).join('')}</tbody></table></div></section>` : ''}
    ${canDelete && archivedCategories.length ? `<section class="tile p-3 mt-3"><h2 class="h6">Archived categories</h2><div class="d-flex flex-wrap gap-2">${archivedCategories.map((category) => `<div class="border rounded p-2 d-flex align-items-center gap-2"><span>${e(category.name)}</span><button class="btn btn-sm btn-outline-primary" data-restore-category="${category.id}">Restore category</button></div>`).join('')}</div></section>` : ''}
    ${manage ? `
      <div class="modal fade" id="categoryModal" tabindex="-1"><div class="modal-dialog"><form class="modal-content" id="categoryForm">
        <div class="modal-header"><h2 class="modal-title h5">Add category</h2><button class="btn-close" data-bs-dismiss="modal" type="button"></button></div>
        <div class="modal-body"><div class="mb-3"><label class="form-label" for="categoryName">Name</label><input class="form-control" id="categoryName" maxlength="80" required></div>
          <div class="mb-3"><label class="form-label" for="categoryDescription">Description</label><textarea class="form-control" id="categoryDescription" rows="2"></textarea></div>
          <div><label class="form-label" for="categoryImage">Image URL (optional)</label><input class="form-control" id="categoryImage" type="url" placeholder="https://..."></div><div id="categoryError" class="mt-2"></div>
        </div><div class="modal-footer"><button class="btn btn-primary" type="submit">Save category</button></div>
      </form></div></div>
      <div class="modal fade" id="productModal" tabindex="-1"><div class="modal-dialog modal-dialog-scrollable"><form class="modal-content" id="productForm">
        <div class="modal-header"><h2 class="modal-title h5">Product details</h2><button class="btn-close" data-bs-dismiss="modal" type="button"></button></div>
        <div class="modal-body"><input type="hidden" id="productId">
          <div class="mb-2"><label class="form-label" for="sku">SKU</label><input class="form-control" id="sku" maxlength="40" required></div>
          <div class="mb-2"><label class="form-label" for="productName">Name</label><input class="form-control" id="productName" maxlength="120" required></div>
          <div class="mb-2"><label class="form-label" for="categoryId">Category</label><select class="form-select" id="categoryId" required>${activeCategories.map((category) => `<option value="${category.id}">${e(category.name)}</option>`).join('')}</select></div>
          <div class="row g-2"><div class="col-6"><label class="form-label" for="price">Selling price</label><input class="form-control" id="price" type="number" min="0" step="0.01" required></div>
            <div class="col-6"><label class="form-label" for="cost">Unit cost</label><input class="form-control" id="cost" type="number" min="0" step="0.01" required></div>
            <div class="col-6"><label class="form-label" for="stock">Stock</label><input class="form-control" id="stock" type="number" min="0" step="0.01" required></div>
            <div class="col-6"><label class="form-label" for="minimum">Low-stock threshold</label><input class="form-control" id="minimum" type="number" min="0" step="0.01" required></div>
          </div>
          <div class="mt-3">
            <label class="form-label" for="productImageFile">Product image (optional)</label>
            <input class="visually-hidden" id="productImageFile" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif">
            <input id="productImage" type="hidden" value="">
            <div class="image-upload-zone" id="productImageDropzone" role="button" tabindex="0" aria-label="Choose or drop a product image">
              <img class="image-upload-preview" id="productImagePreview" alt="Product image preview" hidden>
              <div class="image-upload-prompt" id="productImagePrompt"><strong>Choose an image</strong> or drag and drop it here<div class="small text-secondary mt-1">JPG, PNG, WebP, or GIF · up to 5 MB</div></div>
              <div class="small text-secondary mt-2" id="productImageName"></div>
            </div>
            <div class="d-flex gap-2 mt-2">
              <button class="btn btn-sm btn-outline-primary" id="chooseProductImage" type="button">Choose file</button>
              <button class="btn btn-sm btn-outline-secondary" id="clearProductImage" type="button" hidden>Remove image</button>
            </div>
          </div>
          <div class="form-check mt-3"><input class="form-check-input" id="active" type="checkbox" checked><label class="form-check-label" for="active">Active and available for sale</label></div>
          <div id="productError" class="mt-2"></div>
        </div><div class="modal-footer"><button class="btn btn-primary" type="submit">Save product</button></div>
      </form></div></div>` : ''}
  `, '/products');
  bindLogout();
  document.querySelectorAll('[data-delete-category]').forEach((button) => button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const category = activeCategories.find((row) => Number(row.id) === Number(button.dataset.deleteCategory));
    if (!category) return;
    try {
      if (await deleteCategory(category)) await renderProducts();
    } catch (error) {
      showOperationError(error);
    }
  }));
  document.querySelectorAll('[data-archive-product]').forEach((button) => button.addEventListener('click', async () => {
    const product = activeProducts.find((row) => Number(row.id) === Number(button.dataset.archiveProduct));
    if (!product) return;
    try {
      if (await archiveProduct(product)) await renderProducts();
    } catch (error) {
      showOperationError(error);
    }
  }));
  document.querySelectorAll('[data-restore-product]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await apiPost('restore_product', { id: Number(button.dataset.restoreProduct) });
      await renderProducts();
    } catch (error) {
      showOperationError(error);
    }
  }));
  document.querySelectorAll('[data-restore-category]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await apiPost('restore_category', { id: Number(button.dataset.restoreCategory) });
      await renderProducts();
    } catch (error) {
      showOperationError(error);
    }
  }));
  if (!manage) return;

  const categoryModal = new bootstrap.Modal(document.getElementById('categoryModal'));
  const productModal = new bootstrap.Modal(document.getElementById('productModal'));
  document.getElementById('addCategory').addEventListener('click', () => {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryError').innerHTML = '';
    categoryModal.show();
  });
  document.getElementById('categoryForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('categoryName').value.trim();
    if (!name) {
      document.getElementById('categoryError').innerHTML = '<div class="alert alert-danger py-2">Category name cannot be blank.</div>';
      return;
    }
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      document.getElementById('categoryError').innerHTML = '<div class="alert alert-danger py-2">A category with that name already exists.</div>';
      return;
    }
    try {
      await dbAdd('categories', {
        name,
        description: document.getElementById('categoryDescription').value.trim(),
        image_url: document.getElementById('categoryImage').value.trim(),
      });
      categoryModal.hide();
      await renderProducts();
    } catch (error) {
      document.getElementById('categoryError').innerHTML = `<div class="alert alert-danger py-2">${e(error.message)}</div>`;
    }
  });

  let selectedImageFile = null;
  let previewObjectUrl = null;
  const imageFileInput = document.getElementById('productImageFile');
  const imagePreview = document.getElementById('productImagePreview');
  const imagePrompt = document.getElementById('productImagePrompt');
  const imageDropzone = document.getElementById('productImageDropzone');
  const clearImageButton = document.getElementById('clearProductImage');
  const showImagePreview = (url, name = '') => {
    imagePreview.src = url || '';
    imagePreview.hidden = !url;
    imagePrompt.hidden = Boolean(url);
    document.getElementById('productImageName').textContent = name;
    clearImageButton.hidden = !url;
  };
  const revokeImagePreview = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  };
  const useImageFile = (file) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const maxBytes = 5 * 1024 * 1024;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if ((!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) || file.size > maxBytes) {
      selectedImageFile = null;
      revokeImagePreview();
      imageFileInput.value = '';
      const currentImage = String(document.getElementById('productImage').value || '').trim();
      const currentImageUrl = /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(currentImage) ? currentImage : '';
      showImagePreview(currentImageUrl, currentImage ? 'Current product image' : '');
      document.getElementById('productError').innerHTML = `<div class="alert alert-danger py-2">${file.size > maxBytes ? 'Image must be 5 MB or smaller.' : 'Choose a JPG, PNG, WebP, or GIF image.'}</div>`;
      return;
    }
    revokeImagePreview();
    selectedImageFile = file;
    previewObjectUrl = URL.createObjectURL(file);
    showImagePreview(previewObjectUrl, file.name);
    document.getElementById('productError').innerHTML = '';
  };
  imageDropzone.addEventListener('click', () => imageFileInput.click());
  imageDropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      imageFileInput.click();
    }
  });
  document.getElementById('chooseProductImage').addEventListener('click', () => imageFileInput.click());
  imageFileInput.addEventListener('change', () => {
    if (imageFileInput.files?.[0]) useImageFile(imageFileInput.files[0]);
  });
  ['dragenter', 'dragover'].forEach((eventName) => imageDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    imageDropzone.classList.add('is-dragging');
  }));
  ['dragleave', 'drop'].forEach((eventName) => imageDropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    imageDropzone.classList.remove('is-dragging');
  }));
  imageDropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) useImageFile(file);
  });
  clearImageButton.addEventListener('click', () => {
    selectedImageFile = null;
    imageFileInput.value = '';
    document.getElementById('productImage').value = '';
    revokeImagePreview();
    showImagePreview('', '');
  });

  const fillProduct = (product = null) => {
    selectedImageFile = null;
    revokeImagePreview();
    document.getElementById('productForm').reset();
    document.getElementById('productError').innerHTML = '';
    document.getElementById('productId').value = product?.id || '';
    document.getElementById('sku').value = product?.sku || '';
    document.getElementById('productName').value = product?.name || '';
    document.getElementById('categoryId').value = product?.category_id ?? activeCategories[0]?.id ?? '';
    document.getElementById('price').value = product?.price ?? 0;
    document.getElementById('cost').value = product?.cost ?? 0;
    document.getElementById('stock').value = product?.stock_quantity ?? 0;
    document.getElementById('minimum').value = product?.min_stock_level ?? 5;
    document.getElementById('productImage').value = product?.image_url || '';
    const currentImage = String(product?.image_url || '').trim();
    const currentImageUrl = /^(https?:\/\/|\/(?!\/)|\.{1,2}\/)/i.test(currentImage) ? currentImage : '';
    showImagePreview(currentImageUrl, currentImage ? 'Current product image' : '');
    document.getElementById('active').checked = product ? Boolean(product.is_active) : true;
  };
  document.getElementById('addProduct').addEventListener('click', () => {
    if (!activeCategories.length) {
      window.alert('Create or restore a category before adding a product.');
      return;
    }
    fillProduct();
    productModal.show();
  });
  document.querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => {
    const product = products.find((row) => Number(row.id) === Number(button.dataset.editProduct));
    fillProduct(product);
    productModal.show();
  }));
  document.getElementById('productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const record = {
      id: Number(document.getElementById('productId').value) || undefined,
      sku: document.getElementById('sku').value.trim(),
      name: document.getElementById('productName').value.trim(),
      category_id: Number(document.getElementById('categoryId').value),
      price: roundMoney(document.getElementById('price').value),
      cost: roundMoney(document.getElementById('cost').value),
      stock_quantity: Number(document.getElementById('stock').value),
      min_stock_level: Number(document.getElementById('minimum').value),
      unit_type: 'decimal',
      image_url: document.getElementById('productImage').value.trim(),
      is_active: document.getElementById('active').checked ? 1 : 0,
    };
    try {
      const saveButton = document.querySelector('#productForm button[type="submit"]');
      saveButton.disabled = true;
      if (selectedImageFile) {
        const uploaded = await uploadProductImage(selectedImageFile);
        record.image_url = uploaded.image_url;
      }
      await (record.id ? dbPut('products', record) : dbAdd('products', record));
      productModal.hide();
      await renderProducts();
    } catch (error) {
      document.getElementById('productError').innerHTML = `<div class="alert alert-danger py-2">${e(error.message)}</div>`;
    } finally {
      const saveButton = document.querySelector('#productForm button[type="submit"]');
      if (saveButton) saveButton.disabled = false;
    }
  });
}

function categoryCard(category) {
  return `<article class="category-card">
    <button class="category-card-open" data-category-open="${category.id}" type="button">
      ${imageMarkup(category.image_url, category.name)}<span class="category-card-title">${e(category.name)}</span>
      <span class="small text-secondary">${e(category.description || 'Browse products')}</span>
    </button>
  </article>`;
}

async function renderPos() {
  const user = await requireUser('pos');
  if (!user) return;
  const [allProducts, allCategories] = await Promise.all([dbAll('products'), dbAll('categories')]);
  let categories = allCategories.filter((category) => category.is_active);
  let products = allProducts.filter((product) => product.is_active);
  let cart = [];
  let selectedCategory = null;

  const appBody = () => {
    if (!selectedCategory) {
      return `<div class="view-transition"><div class="category-grid">${categories.map((category) => categoryCard(category)).join('') || '<p class="text-secondary">No categories yet. Ask an administrator to add them.</p>'}</div></div>`;
    }
    const categoryProducts = products.filter((product) => Number(product.category_id) === Number(selectedCategory.id));
    return `<div class="view-transition"><div class="mb-3"><button id="backCategories" class="btn btn-sm btn-outline-secondary">← Back to categories</button>
      <span class="text-secondary ms-2">Categories /</span> <strong>${e(selectedCategory.name)}</strong></div>
      <input class="form-control mb-3" id="search" placeholder="Search this category by name or SKU">
      <div class="product-grid" id="productGrid">${renderPosProducts(categoryProducts)}</div></div>`;
  };

  const renderCart = () => {
    const body = document.getElementById('cartBody');
    if (!body) return;
    const subtotal = roundMoney(cart.reduce((sum, line) => sum + line.qty * line.price, 0));
    const tax = roundMoney(subtotal * getTaxRate() / 100);
    const total = roundMoney(subtotal + tax);
    const estimatedProfit = roundMoney(cart.reduce((sum, line) => sum + line.qty * (line.price - line.cost), 0));
    body.innerHTML = cart.map((line, index) => `
      <tr><td><strong>${e(line.name)}</strong><div class="small text-secondary">${money(line.price)} each · stock ${quantity(line.stock)}</div></td>
        <td><div class="quantity-controls">
          <button class="btn btn-sm btn-outline-secondary" data-adjust="${index}" data-step="1" aria-label="Add one">+1</button>
          <button class="btn btn-sm btn-outline-secondary" data-adjust="${index}" data-step="-1" aria-label="Remove one">−1</button>
          <button class="btn btn-xs btn-outline-secondary" data-adjust="${index}" data-step="0.25" aria-label="Add quarter">+0.25</button>
          <button class="btn btn-xs btn-outline-secondary" data-adjust="${index}" data-step="-0.25" aria-label="Remove quarter">−0.25</button>
        </div><input class="form-control form-control-sm cart-quantity mt-1" data-quantity="${index}" type="number" min="0.01" max="${line.stock}" step="0.01" value="${quantity(line.qty)}" aria-label="Quantity for ${e(line.name)}"></td>
        <td class="text-end">${money(line.qty * line.price)}</td>
        <td><button class="btn btn-sm btn-outline-danger" data-remove="${index}" aria-label="Remove ${e(line.name)}">×</button></td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="text-secondary">Select a product to begin.</td></tr>';
    document.getElementById('cartSubtotal').textContent = money(subtotal);
    document.getElementById('cartTax').textContent = money(tax);
    document.getElementById('cartTotal').textContent = money(total);
    document.getElementById('cartProfit').textContent = money(estimatedProfit);
    document.getElementById('taxRateLabel').textContent = `${getTaxRate()}%`;
    const payment = Number(document.getElementById('payment').value) || 0;
    document.getElementById('change').textContent = money(Math.max(0, payment - total));
    body.querySelectorAll('[data-adjust]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.adjust);
      const next = roundMoney(cart[index].qty + Number(button.dataset.step));
      if (next <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].qty = Math.min(cart[index].stock, next);
      }
      renderCart();
    }));
    body.querySelectorAll('[data-quantity]').forEach((input) => input.addEventListener('change', () => {
      const index = Number(input.dataset.quantity);
      const next = roundMoney(Number(input.value));
      if (!Number.isFinite(next) || next <= 0) {
        cart.splice(index, 1);
      } else {
        cart[index].qty = Math.min(cart[index].stock, next);
      }
      renderCart();
    }));
    body.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => {
      cart.splice(Number(button.dataset.remove), 1);
      renderCart();
    }));
  };

  app.innerHTML = shell(user, 'Point of Sale', `
    <div class="pos-layout">
      <section class="pos-catalog tile p-3"><div id="posBrowse">${appBody()}</div></section>
      <section class="cart-panel tile p-3"><h2 class="h6">Current sale</h2>
        <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Product</th><th>Qty</th><th class="text-end">Amount</th><th></th></tr></thead><tbody id="cartBody"></tbody></table></div>
        <div class="summary-row"><span>Subtotal</span><strong id="cartSubtotal">${money(0)}</strong></div>
        <div class="summary-row"><span>Tax (<span id="taxRateLabel">${getTaxRate()}%</span>)</span><strong id="cartTax">${money(0)}</strong></div>
        <div class="summary-row fs-5 border-top pt-2"><span>Total</span><strong id="cartTotal">${money(0)}</strong></div>
        <div class="summary-row mb-3"><span>Estimated profit</span><strong id="cartProfit">${money(0)}</strong></div>
        <label class="form-label" for="payment">Cash received</label><input class="form-control mb-2" id="payment" type="number" min="0" step="0.01">
        <div class="mb-3">Change: <strong id="change">${money(0)}</strong></div>
        <button class="btn btn-primary w-100" id="payBtn" type="button">Complete sale</button><div id="posError" class="mt-2"></div>
      </section>
    </div>
    <div class="modal fade" id="receiptModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h2 class="modal-title h5">Receipt</h2><button class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body" id="receiptBody"></div><div class="modal-footer"><button class="btn btn-outline-secondary" id="printReceipt">Print</button></div>
    </div></div></div>
  `, '/pos');
  bindLogout();

  const drawProducts = (term = '') => {
    const grid = document.getElementById('productGrid');
    if (!grid) return;
    const selected = products.filter((product) => Number(product.category_id) === Number(selectedCategory?.id));
    const filtered = selected.filter((product) => `${product.name} ${product.sku}`.toLowerCase().includes(term.toLowerCase()));
    grid.innerHTML = renderPosProducts(filtered);
    grid.querySelectorAll('[data-product-id]').forEach((button) => button.addEventListener('click', () => {
      const product = products.find((row) => Number(row.id) === Number(button.dataset.productId));
      const line = cart.find((row) => Number(row.product_id) === Number(product.id));
      if (line) {
        line.qty = Math.min(line.stock, roundMoney(line.qty + Math.min(1, line.stock - line.qty)));
      } else if (Number(product.stock_quantity) > 0) {
        cart.push({
          product_id: product.id, name: product.name, price: Number(product.price), cost: Number(product.cost),
          qty: Math.min(1, Number(product.stock_quantity)), stock: Number(product.stock_quantity),
        });
      }
      renderCart();
    }));
  };

  const bindCategoryCards = () => {
    document.querySelectorAll('[data-category-open]').forEach((button) => button.addEventListener('click', () => {
      selectedCategory = categories.find((category) => Number(category.id) === Number(button.dataset.categoryOpen));
      document.getElementById('posBrowse').innerHTML = appBody();
      drawProducts();
      document.getElementById('backCategories').addEventListener('click', () => {
        selectedCategory = null;
        document.getElementById('posBrowse').innerHTML = appBody();
        bindCategoryCards();
      });
      document.getElementById('search').addEventListener('input', (event) => drawProducts(event.target.value));
    }));
  };
  bindCategoryCards();
  renderCart();
  document.getElementById('payment').addEventListener('input', renderCart);
  document.getElementById('payBtn').addEventListener('click', async () => {
    const box = document.getElementById('posError');
    box.innerHTML = '';
    if (!cart.length) {
      box.innerHTML = '<div class="alert alert-warning py-2">Add at least one item to the cart.</div>';
      return;
    }
    try {
      const sale = await checkoutSale({ cart, paymentAmount: Number(document.getElementById('payment').value) || 0 });
      document.getElementById('receiptBody').innerHTML = `
        <div id="printableReceipt"><h2 class="h5">POS DSS Store</h2><div>${e(sale.invoice_number)}</div>
          <div class="small mb-2">${new Date(sale.transaction_date).toLocaleString()}</div>
          <table class="table table-sm">${sale.items.map((line) => `<tr><td>${e(line.name)} × ${quantity(line.qty)}</td><td class="text-end">${money(line.qty * line.price)}</td></tr>`).join('')}</table>
          <div>Subtotal ${money(sale.subtotal)}</div><div>Tax (${sale.tax_rate}%) ${money(sale.tax_amount)}</div>
          <div><strong>Total ${money(sale.total_amount)}</strong></div><div>Paid ${money(sale.payment_amount)}</div><div>Change ${money(sale.change_amount)}</div>
          <div class="small mt-2">Cashier: ${e(user.full_name)}</div>
        </div>`;
      cart = [];
      products = (await dbAll('products')).filter((product) => product.is_active);
      drawProducts(document.getElementById('search')?.value || '');
      renderCart();
      document.getElementById('payment').value = '';
      document.getElementById('change').textContent = money(0);
      bootstrap.Modal.getOrCreateInstance(document.getElementById('receiptModal')).show();
    } catch (error) {
      box.innerHTML = `<div class="alert alert-danger py-2">${e(error.message)}</div>`;
    }
  });
  document.getElementById('printReceipt').addEventListener('click', () => window.print());
}

function renderPosProducts(products) {
  if (!products.length) return '<p class="text-secondary">No matching products in this category.</p>';
  return products.map((product) => {
    const low = Number(product.stock_quantity) <= Number(product.min_stock_level);
    const out = Number(product.stock_quantity) <= 0;
    return `<button class="product-tile" type="button" data-product-id="${product.id}" ${out ? 'disabled' : ''}>
      ${imageMarkup(product.image_url, product.name, true)}<span class="product-tile-name">${e(product.name)}</span>
      <span class="small text-secondary">${e(product.sku)} · stock ${quantity(product.stock_quantity)}</span>
      <span class="fw-semibold">${money(product.price)} ${low ? '<span class="badge text-bg-warning">Low</span>' : ''}</span>
    </button>`;
  }).join('');
}

async function renderMargins(selectedCategoryId = null) {
  const user = await requireUser('margins');
  if (!user) return;
  const canManageCost = can(user, 'products_manage');
  const [products, categories, sales, items] = await Promise.all([
    dbAll('products'), dbAll('categories'), dbAll('sales'), dbAll('sale_items'),
  ]);
  const activeProducts = products.filter((product) => product.is_active);
  const activeCategories = categories.filter((category) => category.is_active);
  const today = localDateKey(new Date());
  const todaySales = new Map(sales.filter((sale) => sale.status === 'completed' && localDateKey(sale.transaction_date) === today).map((sale) => [Number(sale.id), sale]));
  const selectedCategory = categories.find((category) => Number(category.id) === Number(selectedCategoryId));
  const categoryView = selectedCategory
    ? `<div class="view-transition"><div class="mb-3"><button id="backMargins" class="btn btn-sm btn-outline-secondary">← Back to categories</button>
        <span class="text-secondary ms-2">Categories /</span> <strong>${e(selectedCategory.name)}</strong></div>
        <div class="margin-grid">${activeProducts.filter((product) => Number(product.category_id) === Number(selectedCategory.id)).map((product) => {
          const productItems = items.filter((item) => Number(item.product_id) === Number(product.id) && todaySales.has(Number(item.sale_id)));
          const known = productItems.filter((item) => item.line_profit !== null && item.line_profit !== undefined);
          const historicalUnknown = productItems.length > known.length;
          const dailyProfit = known.reduce((sum, item) => sum + Number(item.line_profit), 0);
          const profitDisplay = productItems.length === 0 ? money(0) : (known.length === productItems.length ? money(dailyProfit) : '—');
          return `<article class="margin-card">
            <div class="d-flex align-items-center gap-3 mb-3">${imageMarkup(product.image_url, product.name, true)}<div><h3 class="h6 mb-1">${e(product.name)}</h3><div class="small text-secondary">${e(product.sku)}</div></div></div>
            ${canManageCost
              ? `<label class="form-label small" for="cost-${product.id}">Unit cost ($C$)</label>
                <div class="input-group mb-3"><span class="input-group-text">₱</span><input class="form-control" id="cost-${product.id}" type="number" min="0" step="0.01" value="${Number(product.cost).toFixed(2)}"><button class="btn btn-outline-primary" data-save-cost="${product.id}">Save</button></div>`
              : `<div class="small text-secondary mb-3">Unit cost ($C$): <strong>${money(product.cost)}</strong></div>`}
            <div class="summary-row"><span>Margin per unit</span><strong>${money(Number(product.price) - Number(product.cost))}</strong></div>
            <div class="summary-row"><span>Today's realized profit</span><strong>${profitDisplay}</strong></div>
            ${historicalUnknown ? '<div class="small text-secondary mt-2">Legacy sale costs were not recorded; those sales are excluded.</div>' : ''}
            <div class="small text-secondary mt-2">Selling price ${money(product.price)}</div>
          </article>`;
        }).join('') || '<p class="text-secondary">No products in this category.</p>'}</div>
      </div>`
    : `<div class="view-transition"><div class="category-grid">${activeCategories.map((category) => `
        <article class="category-card"><button class="category-card-open" data-margin-category="${category.id}" type="button">
          ${imageMarkup(category.image_url, category.name)}<span class="category-card-title">${e(category.name)}</span>
          <span class="small text-secondary">${activeProducts.filter((product) => Number(product.category_id) === Number(category.id)).length} products</span>
        </button></article>`).join('') || '<div class="alert alert-secondary">Add categories and products to begin.</div>'}</div></div>`;
  app.innerHTML = shell(user, 'Cost & Margins', `
    <p class="text-secondary">Unit margins use current product costs. Daily realized profit uses cost snapshots saved at checkout.</p>
    ${categoryView}
  `, '/margins');
  bindLogout();
  document.querySelectorAll('[data-margin-category]').forEach((button) => button.addEventListener('click', () => renderMargins(Number(button.dataset.marginCategory))));
  document.getElementById('backMargins')?.addEventListener('click', () => renderMargins());
  document.querySelectorAll('[data-save-cost]').forEach((button) => button.addEventListener('click', async () => {
    const product = products.find((row) => Number(row.id) === Number(button.dataset.saveCost));
    const input = document.getElementById(`cost-${product.id}`);
    const cost = Number(input.value);
    if (!Number.isFinite(cost) || cost < 0) {
      input.classList.add('is-invalid');
      return;
    }
    try {
      await dbPut('products', { ...product, cost: roundMoney(cost) });
      button.textContent = 'Saved';
      button.classList.replace('btn-outline-primary', 'btn-success');
      product.cost = roundMoney(cost);
      const margin = button.closest('.margin-card').querySelector('.summary-row strong');
      margin.textContent = money(Number(product.price) - product.cost);
    } catch (error) {
      button.insertAdjacentHTML('afterend', `<div class="small text-danger mt-1">${e(error.message)}</div>`);
    }
  }));
  document.querySelectorAll('[id^="cost-"]').forEach((input) => input.addEventListener('input', () => {
    const productId = Number(input.id.slice('cost-'.length));
    const product = products.find((row) => Number(row.id) === productId);
    const nextCost = Number(input.value);
    const margin = input.closest('.margin-card').querySelector('.summary-row strong');
    margin.textContent = Number.isFinite(nextCost) && nextCost >= 0
      ? money(Number(product.price) - nextCost)
      : '—';
  }));
}

async function renderSalesHistory() {
  const user = await requireUser('sales_history');
  if (!user) return;
  const [history, products] = await Promise.all([apiGet('sales_history'), dbAll('products')]);
  const productById = new Map(products.map((product) => [Number(product.id), product]));
  const userById = new Map(history.users.map((row) => [Number(row.id), row]));
  const itemsBySale = new Map();
  history.sale_items.forEach((item) => {
    const list = itemsBySale.get(Number(item.sale_id)) || [];
    list.push(item);
    itemsBySale.set(Number(item.sale_id), list);
  });
  const auditBySale = new Map(history.audit_logs.map((row) => [Number(row.transaction_id), row]));
  const salesRows = [...history.sales].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)).map((sale) => {
    const lines = itemsBySale.get(Number(sale.id)) || [];
    const descriptions = lines.map((item) => {
      const name = productById.get(Number(item.product_id))?.name || `Product #${item.product_id}`;
      return `${name} × ${quantity(item.quantity)}`;
    });
    const audit = auditBySale.get(Number(sale.id));
    const isCompleted = sale.status === 'completed';
    return `<tr>
      <td><strong>${e(sale.invoice_number)}</strong><div class="small text-secondary">${new Date(sale.transaction_date).toLocaleString()}</div></td>
      <td>${e(userById.get(Number(sale.user_id))?.full_name || '—')}</td>
      <td>${descriptions.map((line) => `<div>${e(line)}</div>`).join('') || '—'}</td>
      <td>${money(sale.total_amount)}</td><td>${sale.total_profit == null ? '—' : money(sale.total_profit)}</td>
      <td><span class="badge ${isCompleted ? 'text-bg-success' : 'text-bg-secondary'}">${e(sale.status)}</span>${audit ? `<div class="small text-secondary mt-1">Voided ${new Date(audit.timestamp).toLocaleString()} by ${e(userById.get(Number(audit.voided_by))?.full_name || '—')}</div>` : ''}</td>
      <td>${isCompleted ? `<button class="btn btn-sm btn-outline-danger" data-void-sale="${sale.id}">Void sale</button>` : ''}</td>
    </tr>`;
  }).join('');
  const auditRows = [...history.audit_logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((audit) => {
    const sale = history.sales.find((row) => Number(row.id) === Number(audit.transaction_id));
    return `<tr><td>${e(sale?.invoice_number || `Sale #${audit.transaction_id}`)}</td><td>${new Date(audit.timestamp).toLocaleString()}</td>
      <td>${e(userById.get(Number(audit.voided_by))?.full_name || '—')}</td><td>${e(audit.reason)}</td></tr>`;
  }).join('');

  app.innerHTML = shell(user, 'Sales History / Void Transactions', `
    <div class="alert alert-warning"><strong>Voiding a transaction restores its sold stock and removes its revenue/profit from completed-sale analytics.</strong> The receipt and audit record remain preserved.</div>
    <section class="tile p-3 mb-3"><h2 class="h5">Transactions</h2>
      <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Invoice / Date</th><th>Cashier</th><th>Items</th><th>Total</th><th>Profit</th><th>Status</th><th></th></tr></thead>
        <tbody>${salesRows || '<tr><td colspan="7" class="text-secondary">No transactions found.</td></tr>'}</tbody></table></div>
    </section>
    <section class="tile p-3"><h2 class="h5">Void audit trail</h2>
      <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Invoice</th><th>Voided at</th><th>Voided by</th><th>Reason</th></tr></thead>
        <tbody>${auditRows || '<tr><td colspan="4" class="text-secondary">No transactions have been voided.</td></tr>'}</tbody></table></div>
    </section>
  `, '/sales-history');
  bindLogout();
  document.querySelectorAll('[data-void-sale]').forEach((button) => button.addEventListener('click', async () => {
    const sale = history.sales.find((row) => Number(row.id) === Number(button.dataset.voidSale));
    if (!sale || sale.status !== 'completed') return;
    const lines = itemsBySale.get(Number(sale.id)) || [];
    const impact = lines.map((item) => {
      const name = productById.get(Number(item.product_id))?.name || `Product #${item.product_id}`;
      return `${name}: restore ${quantity(item.quantity)} to stock`;
    });
    const choice = await showConfirmModal({
      title: `Void transaction ${sale.invoice_number}?`,
      details: [
        `This will void ${sale.invoice_number} (${money(sale.total_amount)} revenue and ${sale.total_profit == null ? 'unknown' : money(sale.total_profit)} profit).`,
        ...impact,
        'Inventory and the dashboard will be updated atomically. This action cannot be undone.',
      ],
      confirmLabel: 'Void transaction',
      phrase: 'VOID',
      reasonLabel: 'Reason for voiding',
    });
    if (!choice) return;
    try {
      await apiPost('void_sale', { id: Number(sale.id), reason: choice.reason });
      await renderSalesHistory();
    } catch (error) {
      showOperationError(error);
    }
  }));
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function inRange(iso, from, to) {
  const timestamp = new Date(iso).getTime();
  return timestamp >= from.getTime() && timestamp <= to.getTime();
}

async function renderReports() {
  const user = await requireUser('reports');
  if (!user) return;
  const [sales, items, users] = await Promise.all([dbAll('sales'), dbAll('sale_items'), dbAll('users')]);
  const now = new Date();
  const periods = {
    daily: [startOfDay(now), now],
    weekly: [dateAtOffset(6), now],
    monthly: [new Date(now.getFullYear(), now.getMonth(), 1), now],
  };
  const cashierName = (id) => users.find((row) => Number(row.id) === Number(id))?.full_name || '—';
  const tables = Object.entries(periods).map(([key, [from, to]]) => {
    const rows = sales.filter((sale) => sale.status === 'completed' && inRange(sale.transaction_date, from, to));
    const total = rows.reduce((sum, sale) => sum + Number(sale.total_amount), 0);
    const profitRows = rows.filter((sale) => sale.total_profit !== null && sale.total_profit !== undefined);
    const profit = profitRows.reduce((sum, sale) => sum + Number(sale.total_profit), 0);
    const body = rows.map((sale) => {
      const lines = items.filter((item) => Number(item.sale_id) === Number(sale.id));
      const count = lines.reduce((sum, item) => sum + Number(item.quantity), 0);
      return `<tr><td>${e(sale.invoice_number)}</td><td>${new Date(sale.transaction_date).toLocaleString()}</td><td>${e(cashierName(sale.user_id))}</td><td>${quantity(count)}</td><td>${money(sale.total_amount)}</td><td>${sale.total_profit == null ? '—' : money(sale.total_profit)}</td></tr>`;
    }).join('');
    return `<section class="tile p-3 mb-3"><h2 class="h5 text-capitalize">${key} sales · ${money(total)} · ${rows.length} receipts</h2>
      <div class="small text-secondary mb-2">Known profit: ${profitRows.length ? money(profit) : '—'}${profitRows.length < rows.length ? ' · some legacy sales have no saved cost' : ''}</div>
      <div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Invoice</th><th>When</th><th>Cashier</th><th>Qty</th><th>Total</th><th>Profit</th></tr></thead><tbody>${body || '<tr><td colspan="6">No sales in this period</td></tr>'}</tbody></table></div>
    </section>`;
  }).join('');
  app.innerHTML = shell(user, 'Sales Reports', tables, '/reports');
  bindLogout();
}

async function renderUsers() {
  const user = await requireUser('users');
  if (!user) return;
  const users = await dbAll('users');
  app.innerHTML = shell(user, 'Users', `
    <form class="tile p-3 mb-3" id="userForm"><h2 class="h6">Add user</h2>
      <div class="row g-2"><div class="col-md-3"><input class="form-control" id="newUser" placeholder="Username" maxlength="50" required></div>
        <div class="col-md-3"><input class="form-control" id="newName" placeholder="Full name" maxlength="120" required></div>
        <div class="col-md-2"><input class="form-control" id="newPass" type="password" placeholder="Password (8+ characters)" minlength="8" required></div>
        <div class="col-md-2"><select class="form-select" id="newRole"><option value="admin">Administrator</option><option value="cashier">Cashier</option><option value="owner">Business Owner</option></select></div>
        <div class="col-md-2"><button class="btn btn-primary w-100" type="submit">Save</button></div>
      </div><div id="userError" class="mt-2"></div>
    </form>
    <div class="table-responsive tile p-0"><table class="table mb-0"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>${users.map((row) => `<tr><td>${e(row.username)}</td><td>${e(row.full_name)}</td><td>${e(roleLabel(row.role))}</td><td>${row.is_active ? 'Active' : 'Disabled (reset required)'}</td><td><button class="btn btn-sm btn-outline-primary" data-reset-user="${row.id}">${row.is_active ? 'Change password' : 'Reset access'}</button></td></tr>`).join('')}</tbody>
    </table></div>
  `, '/users');
  bindLogout();
  document.getElementById('userForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await dbAdd('users', {
        username: document.getElementById('newUser').value.trim(),
        full_name: document.getElementById('newName').value.trim(),
        password: document.getElementById('newPass').value,
        role: document.getElementById('newRole').value,
      });
      await renderUsers();
    } catch (error) {
      document.getElementById('userError').innerHTML = `<div class="alert alert-danger py-2">${e(error.message)}</div>`;
    }
  });
  document.querySelectorAll('[data-reset-user]').forEach((button) => button.addEventListener('click', async () => {
    const password = window.prompt('Set a new password for this account (at least 8 characters):');
    if (password === null) return;
    try {
      await apiPost('reset_user_password', { id: Number(button.dataset.resetUser), password });
      await renderUsers();
    } catch (error) {
      document.getElementById('userError').innerHTML = `<div class="alert alert-danger py-2">${e(error.message)}</div>`;
    }
  }));
}

const routes = {
  '/login': renderLogin,
  '/dashboard': renderDashboard,
  '/products': renderProducts,
  '/pos': renderPos,
  '/margins': renderMargins,
  '/reports': renderReports,
  '/sales-history': renderSalesHistory,
  '/dss': renderDashboard,
  '/users': renderUsers,
};

async function render() {
  destroyCharts();
  try {
    const path = route();
    await (routes[path] || renderDashboard)();
  } catch (error) {
    showPageError(error);
  }
}

window.addEventListener('hashchange', render);

initDb().then(() => {
  if (!location.hash) {
    go('/login');
  }
  return render();
}).catch(showPageError);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker unavailable:', error));
}
