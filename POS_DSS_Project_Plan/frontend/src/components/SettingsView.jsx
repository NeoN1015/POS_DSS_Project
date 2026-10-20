import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import {
  Settings,
  Users,
  Percent,
  Database,
  Plus,
  Shield,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export default function SettingsView() {
  const { taxRate, setTaxRate, showToast } = useApp();
  const [users, setUsers] = useState([]);
  const [localTax, setLocalTax] = useState(taxRate.toString());
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('cashier');

  const [passwordModalUser, setPasswordModalUser] = useState(null);
  const [resetPassValue, setResetPassValue] = useState('');

  const loadUsers = async () => {
    try {
      const uList = await api.getUsers();
      setUsers(uList || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSaveTax = (e) => {
    e.preventDefault();
    const rate = parseFloat(localTax) || 0;
    setTaxRate(rate);
    showToast(`Tax rate updated to ${rate}%`, 'success');
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim() || newPassword.length < 6) {
      showToast('Fill in all fields. Password must be at least 6 characters.', 'warning');
      return;
    }

    try {
      await api.saveUser({
        username: newUsername.trim(),
        full_name: newFullName.trim(),
        password: newPassword,
        role: newRole,
      });
      await loadUsers();
      setUserModalOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      showToast(`User ${newUsername} created!`, 'success');
    } catch (err) {
      showToast(err.message || 'Failed to create user', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassValue.length < 6) {
      showToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    try {
      await api.resetPassword(passwordModalUser.id, resetPassValue);
      setPasswordModalUser(null);
      setResetPassValue('');
      showToast('Password updated successfully!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to reset password', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* 1. Tax Configuration Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-card border border-slate-200/80 dark:border-zinc-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Sales Tax Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Configured percentage applied to retail subtotal at POS checkout
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveTax} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative w-full sm:w-48">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={localTax}
              onChange={(e) => setLocalTax(e.target.value)}
              className="w-full px-4 py-2.5 font-mono font-bold text-sm rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
              %
            </span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Save Tax Rate
          </button>
        </form>
      </div>

      {/* 2. User & RBAC Management Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-card border border-slate-200/80 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                User Accounts & Roles (RBAC)
              </h3>
              <p className="text-xs text-slate-400">
                Manage Administrator, Cashier, and Business Owner access permissions
              </p>
            </div>
          </div>

          <button
            onClick={() => setUserModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-800/50 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {u.full_name}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500">
                    {u.username}
                  </td>
                  <td className="py-3 px-4">
                    <span className="capitalize px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setPasswordModalUser(u)}
                      className="text-xs font-bold text-indigo-600 hover:underline"
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Database Info Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-card border border-slate-200/80 dark:border-zinc-800 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Data Storage & Architecture
            </h3>
            <p className="text-xs text-slate-400">
              Generic Point of Sale System for SMEs with Decision Support System (DSS)
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 text-xs font-mono text-slate-600 dark:text-zinc-300 space-y-1">
          <div><strong className="text-slate-800 dark:text-white">Database Engine:</strong> SQLite 3 (WAL mode) / MySQL Relational</div>
          <div><strong className="text-slate-800 dark:text-white">Default Path:</strong> ..\pos_dss_data\pos_dss.sqlite</div>
          <div><strong className="text-slate-800 dark:text-white">Frontend:</strong> React 19 + Tailwind CSS + Lucide Icons + Recharts</div>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-200 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Create New System User
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. msantos"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                >
                  <option value="cashier">Cashier (POS Checkout only)</option>
                  <option value="owner">Business Owner (Reports & DSS)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-200 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reset Password for {passwordModalUser.username}
            </h3>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={resetPassValue}
                  onChange={(e) => setResetPassValue(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
