const API_URL = '../api/index.php';
const LEGACY_DB_NAME = 'pos_dss';
const LEGACY_STORES = ['users', 'categories', 'products', 'sales', 'sale_items', 'inventory_logs', 'meta'];

const session = {
  user: null,
  csrf: null,
  taxRate: 0,
  legacyAvailable: false,
  legacyImported: false,
};

export function setSession({ user, csrf }) {
  session.user = user || null;
  session.csrf = csrf || null;
}

export function getSessionUser() {
  return session.user;
}

export function getTaxRate() {
  return Number(session.taxRate) || 0;
}

export function legacyImportAvailable() {
  return session.legacyAvailable && !session.legacyImported;
}

async function request(action, { method = 'GET', body, params = {}, multipart = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined && !multipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && action !== 'login' && session.csrf) {
    headers['X-CSRF-Token'] = session.csrf;
  }
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${API_URL}?${query}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : (multipart ? body : JSON.stringify(body)),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Server returned an invalid response (${response.status}).`);
  }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed (${response.status}).`);
  }
  return payload.data;
}

export async function apiPost(action, body = {}) {
  return request(action, { method: 'POST', body });
}

export async function apiGet(action, params = {}) {
  return request(action, { params });
}

export async function uploadProductImage(file) {
  const body = new FormData();
  body.append('image', file);
  return request('upload_product_image', { method: 'POST', body, multipart: true });
}

export async function initDb() {
  const bootstrap = await request('bootstrap');
  session.user = bootstrap.user || null;
  session.csrf = bootstrap.csrf || null;
  session.taxRate = Number(bootstrap.tax_rate) || 0;
  session.legacyImported = Boolean(bootstrap.legacy_imported);
  session.legacyAvailable = await hasLegacyDatabase();
  return bootstrap;
}

async function hasLegacyDatabase() {
  if (!('indexedDB' in window)) {
    return false;
  }
  return new Promise((resolve) => {
    let created = false;
    const openRequest = indexedDB.open(LEGACY_DB_NAME);
    openRequest.onupgradeneeded = () => {
      created = true;
      openRequest.transaction.abort();
    };
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      database.close();
      resolve(!created && LEGACY_STORES.some((store) => database.objectStoreNames.contains(store)));
    };
    openRequest.onerror = () => {
      if (created) {
        resolve(false);
      } else {
        reject(openRequest.error || new Error('Could not inspect the previous browser database.'));
      }
    };
    openRequest.onblocked = () => reject(new Error('Close other POS DSS tabs before checking for browser data to import.'));
  });
}

function readLegacyDatabase() {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(LEGACY_DB_NAME);
    openRequest.onupgradeneeded = () => {
      openRequest.transaction.abort();
    };
    openRequest.onerror = () => reject(new Error('Could not open the previous browser database.'));
    openRequest.onblocked = () => reject(new Error('Close the old POS DSS tab and try importing again.'));
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const names = LEGACY_STORES.filter((name) => database.objectStoreNames.contains(name));
      if (!names.length) {
        database.close();
        reject(new Error('No POS DSS data was found in this browser.'));
        return;
      }
      const transaction = database.transaction(names, 'readonly');
      const result = {};
      let remaining = names.length;
      for (const name of names) {
        const getRequest = transaction.objectStore(name).getAll();
        getRequest.onsuccess = () => {
          result[name] = getRequest.result;
          remaining -= 1;
          if (remaining === 0) {
            database.close();
            resolve(result);
          }
        };
        getRequest.onerror = () => {
          database.close();
          reject(getRequest.error || new Error(`Could not read legacy ${name} data.`));
        };
      }
    };
  });
}

export async function importLegacyDatabase() {
  const data = await readLegacyDatabase();
  await request('import_legacy', { method: 'POST', body: { data } });
  session.legacyImported = true;
}

export async function dbAll(store) {
  return request(store);
}

export async function dbGet(store, id) {
  const rows = await dbAll(store);
  return rows.find((row) => Number(row.id) === Number(id)) || null;
}

export async function dbAdd(store, value) {
  const action = store === 'categories' ? 'save_category' :
    store === 'products' ? 'save_product' :
      store === 'users' ? 'save_user' : null;
  if (!action) {
    throw new Error(`Adding records to ${store} is not supported.`);
  }
  return request(action, { method: 'POST', body: value });
}

export async function dbPut(store, value) {
  if (!['categories', 'products'].includes(store)) {
    throw new Error(`Updating records in ${store} is not supported.`);
  }
  const action = store === 'categories' ? 'save_category' : 'save_product';
  return request(action, { method: 'POST', body: value });
}

export async function dbByIndex(store, indexName, value) {
  const rows = await dbAll(store);
  return rows.find((row) => String(row[indexName]).toLowerCase() === String(value).toLowerCase()) || null;
}

export async function checkoutSale({ cart, paymentAmount }) {
  return request('checkout', {
    method: 'POST',
    body: {
      payment_amount: paymentAmount,
      cart: cart.map((line) => ({ product_id: line.product_id, qty: line.qty })),
    },
  });
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function money(value) {
  return `₱${roundMoney(value).toFixed(2)}`;
}

export function quantity(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}
