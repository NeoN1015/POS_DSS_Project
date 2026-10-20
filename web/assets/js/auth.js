import { apiPost, getSessionUser, setSession } from './db.js';

export const ROLE = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  OWNER: 'owner',
};

export function e(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

export async function login(username, password) {
  try {
    const data = await apiPost('login', { username: username.trim(), password });
    setSession(data);
    return { ok: true, user: data.user };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function logout() {
  try {
    await apiPost('logout');
  } finally {
    setSession({ user: null, csrf: null });
  }
}

export async function currentUser() {
  return getSessionUser();
}

export function roleLabel(role) {
  return ({ admin: 'Administrator', cashier: 'Cashier', owner: 'Business Owner' })[role] || role;
}

export function can(user, feature) {
  if (!user) {
    return false;
  }
  const map = {
    pos: [ROLE.ADMIN, ROLE.CASHIER],
    products_manage: [ROLE.ADMIN],
    products_view: [ROLE.ADMIN, ROLE.CASHIER, ROLE.OWNER],
    reports: [ROLE.ADMIN, ROLE.OWNER],
    margins: [ROLE.ADMIN, ROLE.OWNER],
    dss: [ROLE.ADMIN, ROLE.OWNER],
    sales_history: [ROLE.ADMIN, ROLE.OWNER],
    users: [ROLE.ADMIN],
    settings: [ROLE.ADMIN],
  };
  return (map[feature] || []).includes(user.role);
}
