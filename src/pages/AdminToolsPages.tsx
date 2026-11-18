import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  RefreshCw,
  Shield,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, PWAInstallButton, SelectField } from '../components/UI';
import { TEXT } from '../i18n/translations';
import { exportFullBackupJSON } from '../services/exportService';
import {
  resolveSyncConflict,
  restoreFromBackupJSON,
  saveMessSettings,
  updateUserRoleAndLink,
} from '../services/messDataService';
import { UserAccount, UserRole } from '../types/mess';

export const UsersPage: React.FC = () => {
  const { actor, currentUser, lang, users, members } = useMess();
  const t = TEXT[lang];
  const isAdmin = currentUser?.role === 'admin';
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRoleUpdate = async (
    user: UserAccount,
    role: UserRole,
    isActive: boolean,
    memberId: string
  ) => {
    if (!actor) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await updateUserRoleAndLink(user, role, isActive, memberId, actor);
      setFeedback(
        lang === 'bn'
          ? `${user.displayName}-এর রোল ও সদস্য সংযোগ আপডেট হয়েছে।`
          : `Updated role for ${user.displayName}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.users}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'Owner / Admin, Manager ও Member রোল নির্ধারণ এবং সদস্য প্রোফাইল লিংক করুন'
            : 'Manage Admin, Manager, and Member roles and link accounts to Member profiles'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600">
          {errorMsg}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      <Card className="p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="text-left py-2.5">{lang === 'bn' ? 'ব্যবহারকারী' : 'User'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'রোল' : 'Role'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'লিংককৃত সদস্য' : 'Linked Member'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'অবস্থা' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isRootOwner = u.email === 'mdraezul96@gmail.com';
                return (
                  <tr key={u.uid} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#0F8B8D]" />
                        <span>{u.displayName}</span>
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        disabled={!isAdmin || isRootOwner}
                        value={u.role}
                        onChange={(e) =>
                          handleRoleUpdate(u, e.target.value as UserRole, u.isActive, u.memberId || '')
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
                      >
                        <option value="admin">Owner / Admin</option>
                        <option value="manager">Manager</option>
                        <option value="member">Member</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        disabled={!isAdmin}
                        value={u.memberId || ''}
                        onChange={(e) =>
                          handleRoleUpdate(u, u.role, u.isActive, e.target.value)
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs disabled:opacity-60"
                      >
                        <option value="">{lang === 'bn' ? 'লিংক নেই' : 'Unlinked'}</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({m.roomNumber})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={!isAdmin || isRootOwner}
                        onClick={() => handleRoleUpdate(u, u.role, !u.isActive, u.memberId || '')}
                        className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-60 ${
                          u.isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {u.isActive ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { actor, currentUser, lang, setLang, darkMode, toggleDarkMode, settings } = useMess();
  const t = TEXT[lang];
  const isAdmin = currentUser?.role === 'admin';

  const [messName, setMessName] = useState(settings?.messName || 'Smart Mess Manager');
  const [messAddress, setMessAddress] = useState(settings?.messAddress || '');
  const [ownerName, setOwnerName] = useState(settings?.ownerName || '');
  const [contactNumber, setContactNumber] = useState(settings?.contactNumber || '');
  const [billingCycleStartDay, setBillingCycleStartDay] = useState(String(settings?.billingCycleStartDay || 1));
  const [defaultGuestCharge, setDefaultGuestCharge] = useState(String(settings?.defaultGuestCharge ?? 200));
  const [guestMealCharge, setGuestMealCharge] = useState(String(settings?.guestMealCharge ?? 70));
  const [mealCutoffTime, setMealCutoffTime] = useState(settings?.mealCutoffTime || '22:00');
  const [messRules, setMessRules] = useState(settings?.messRules || '');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !settings) return;
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await saveMessSettings(
        {
          ...settings,
          messName,
          messAddress,
          ownerName,
          contactNumber,
          billingCycleStartDay: Math.min(28, Math.max(1, Number(billingCycleStartDay || 1))),
          defaultGuestCharge: Math.max(0, Number(defaultGuestCharge || 200)),
          guestMealCharge: Math.max(0, Number(guestMealCharge || 0)),
          mealCutoffTime: mealCutoffTime || '22:00',
          messRules,
          defaultLanguage: lang,
        },
        actor
      );
      setSavedMsg(lang === 'bn' ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে।' : 'Settings saved successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.settings}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মেসের তথ্য, ভাষা, থিম, মিল কাট-অফ ও নিয়মাবলী সেটিংস' : 'Mess identity, language, theme, cutoff & rules'}
          </p>
        </div>
        <PWAInstallButton lang={lang} />
      </div>

      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700">
          {savedMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600">
          {errorMsg}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? 'প্রদর্শন ও ভাষা (Display & Language)' : 'Display & Language'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SelectField
            label={lang === 'bn' ? 'অ্যাপের ভাষা' : 'Language'}
            value={lang}
            onChange={(v) => setLang(v as 'bn' | 'en')}
            options={[
              { value: 'bn', label: 'বাংলা (Bengali)' },
              { value: 'en', label: 'English' },
            ]}
          />
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'থিম মোড' : 'Theme Mode'}
            </span>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-left font-medium cursor-pointer"
            >
              {darkMode ? (lang === 'bn' ? 'ডার্ক মোড চালু (Light করুন)' : 'Dark Mode (Switch to Light)') : (lang === 'bn' ? 'লাইট মোড চালু (Dark করুন)' : 'Light Mode (Switch to Dark)')}
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <form onSubmit={handleSave} className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'মেসের মূল সেটিংস (Admin)' : 'Mess Configuration (Admin)'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label={lang === 'bn' ? 'মেসের নাম' : 'Mess Name'} value={messName} onChange={setMessName} disabled={!isAdmin} required />
            <InputField label={lang === 'bn' ? 'মেস মালিক / ম্যানেজার' : 'Owner / Manager Name'} value={ownerName} onChange={setOwnerName} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'মেসের ঠিকানা' : 'Mess Address'} value={messAddress} onChange={setMessAddress} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'যোগাযোগের নম্বর' : 'Contact Number'} value={contactNumber} onChange={setContactNumber} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'মাস শুরুর তারিখ (১-২৮)' : 'Billing Cycle Start Day'} type="number" min="1" max="28" value={billingCycleStartDay} onChange={setBillingCycleStartDay} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'ডিফল্ট অতিথি চার্জ (৳/দিন)' : 'Default Guest Charge (৳/day)'} type="number" min="0" value={defaultGuestCharge} onChange={setDefaultGuestCharge} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'প্রতি গেস্ট মিল চার্জ (৳/মিল)' : 'Per Guest Meal Charge (৳)'} type="number" min="0" value={guestMealCharge} onChange={setGuestMealCharge} disabled={!isAdmin} />
            <InputField label={lang === 'bn' ? 'মিল অন/অফ শেষ সময় (Cutoff)' : 'Meal Request Cutoff Time'} type="time" value={mealCutoffTime} onChange={setMealCutoffTime} disabled={!isAdmin} />
          </div>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'মেসের নিয়মাবলী (সদস্যরা দেখতে পারবে)' : 'Mess Rules (Visible to Members)'}
            </span>
            <textarea
              rows={4}
              value={messRules}
              onChange={(e) => setMessRules(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40 disabled:opacity-60"
            />
          </label>
          {isAdmin && (
            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button type="submit" className="px-5 py-2.5 rounded-xl bg-[#17365D] text-white text-sm font-medium cursor-pointer">
                {t.save}
              </button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
};

export const BackupPage: React.FC = () => {
  const { actor, currentUser, lang, auditLogs } = useMess();
  const t = TEXT[lang];
  const isAdmin = currentUser?.role === 'admin';
  const [restoreJson, setRestoreJson] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRestoreJson(String(reader.result));
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!actor || !restoreJson) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await restoreFromBackupJSON(restoreJson, actor);
      setFeedback(lang === 'bn' ? 'ব্যাকআপ থেকে সম্পূর্ণ ডেটা সফলভাবে রিস্টোর হয়েছে।' : 'Data restored successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRestoreJson(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.backup}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn' ? 'সম্পূর্ণ ডেটা JSON ব্যাকআপ, রিস্টোর এবং অডিট লগ' : 'Full JSON Backup, Restore, and Audit Trail'}
        </p>
      </div>

      {feedback && <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700">{feedback}</div>}
      {errorMsg && <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-600">{errorMsg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <DatabaseBackup className="w-5 h-5 text-[#17365D] dark:text-sky-300" />
            <span>{lang === 'bn' ? 'ম্যানুয়াল JSON ব্যাকআপ ডাউনলোড' : 'Download Full JSON Backup'}</span>
          </div>
          <p className="text-xs text-slate-500">
            {lang === 'bn'
              ? 'সব সদস্য, রুম, মিল, বাজার খরচ, পেমেন্ট ও মাসিক বিলের নিরাপদ কপি সংরক্ষণ করুন।'
              : 'Export a complete snapshot of members, rooms, meals, expenses, payments, and bills.'}
          </p>
          <button
            type="button"
            onClick={() => exportFullBackupJSON()}
            className="px-4 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold cursor-pointer"
          >
            {lang === 'bn' ? 'ব্যাকআপ ডাউনলোড করুন' : 'Download JSON Backup'}
          </button>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Upload className="w-5 h-5 text-[#0F8B8D]" />
            <span>{lang === 'bn' ? 'ব্যাকআপ রিস্টোর করুন (Admin)' : 'Restore From JSON Backup'}</span>
          </div>
          <p className="text-xs text-slate-500">
            {lang === 'bn'
              ? 'পূর্বে সংরক্ষিত JSON ব্যাকআপ ফাইল নির্বাচন করে ডেটা পুনরুদ্ধার করুন।'
              : 'Select a previously exported Smart Mess JSON backup file to restore data.'}
          </p>
          <input
            type="file"
            accept=".json,application/json"
            disabled={!isAdmin}
            onChange={handleFileSelect}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800"
          />
        </Card>
      </div>

      {/* Audit Trail */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'অডিট ট্রেইল ও কার্যক্রমের ইতিহাস (Audit Logs)' : 'System Audit Trail'}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
          {auditLogs.slice(0, 60).map((log) => (
            <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">{log.summary}</span>
                <div className="text-slate-400">
                  {log.actorName} ({log.actorRole}) · {log.action}
                </div>
              </div>
              <span className="font-mono-nums text-slate-400 shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="py-4 text-xs text-slate-400">{t.noData}</p>
          )}
        </div>
      </Card>

      <ConfirmModal
        open={!!restoreJson}
        title={lang === 'bn' ? 'ব্যাকআপ রিস্টোর নিশ্চিত করুন' : 'Confirm Backup Restore'}
        message={
          lang === 'bn'
            ? 'আপনি কি নিশ্চিত যে এই ব্যাকআপ ফাইল থেকে ডেটা রিস্টোর করতে চান?'
            : 'Are you sure you want to restore data from this backup file?'
        }
        confirmLabel={lang === 'bn' ? 'রিস্টোর করুন' : 'Restore'}
        cancelLabel={t.cancel}
        onConfirm={handleConfirmRestore}
        onCancel={() => setRestoreJson(null)}
      />
    </div>
  );
};

export const SyncCenterPage: React.FC = () => {
  const {
    actor,
    currentUser,
    lang,
    isOnline,
    isSyncing,
    lastSyncedAt,
    syncQueue,
    syncConflicts,
    triggerSyncNow,
  } = useMess();

  const t = TEXT[lang];
  const isAdmin = currentUser?.role === 'admin';
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleManualSync = async () => {
    const res = await triggerSyncNow();
    setSyncResult(
      lang === 'bn'
        ? `সিঙ্ক সম্পন্ন: ${res.synced}টি সফল, ${res.conflicts}টি কনফ্লিক্ট, ${res.failed}টি ব্যর্থ।`
        : `Synced: ${res.synced}, Conflicts: ${res.conflicts}, Failed: ${res.failed}.`
    );
  };

  const pendingConflicts = syncConflicts.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.syncCenter}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'অফলাইন কিউ, ক্লাউড সিঙ্ক ও কনফ্লিক্ট সমাধান কেন্দ্র'
              : 'Offline Queue, Cloud Synchronization & Conflict Resolution'}
          </p>
        </div>

        <button
          type="button"
          disabled={!isOnline || isSyncing}
          onClick={handleManualSync}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0d787a] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...') : t.syncNow}</span>
        </button>
      </div>

      {syncResult && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700">
          {syncResult}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          {isOnline ? <Wifi className="w-5 h-5 text-emerald-600" /> : <WifiOff className="w-5 h-5 text-amber-600" />}
          <div>
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'সংযোগ অবস্থা' : 'Connection'}</div>
            <div className="text-sm font-bold">{isOnline ? t.online : t.offline}</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{t.pendingSync}</div>
          <div className="text-xl font-bold font-mono-nums text-[#17365D] dark:text-sky-300">
            {syncQueue.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{t.lastSync}</div>
          <div className="text-sm font-medium mt-1">
            {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '—'}
          </div>
        </Card>
      </div>

      {/* Sync Conflicts for Admin Review */}
      {pendingConflicts.length > 0 && (
        <Card className="p-5 space-y-3 border-amber-300 dark:border-amber-700">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>
              {lang === 'bn'
                ? `${pendingConflicts.length}টি সিঙ্ক কনফ্লিক্ট Admin পর্যালোচনার অপেক্ষায়`
                : `${pendingConflicts.length} Sync Conflicts Awaiting Admin Review`}
            </span>
          </div>
          <div className="space-y-3">
            {pendingConflicts.map((c) => (
              <div key={c.id} className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                <div className="font-bold">
                  {c.entityType} / {c.entityId}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>{lang === 'bn' ? 'অফলাইন:' : 'Local:'} {c.localSummary}</div>
                  <div>{lang === 'bn' ? 'ক্লাউড:' : 'Cloud:'} {c.serverSummary}</div>
                </div>
                {isAdmin && actor && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => resolveSyncConflict(c, 'resolved_local', actor)}
                      className="px-3 py-1.5 rounded-lg bg-[#17365D] text-white font-medium cursor-pointer"
                    >
                      {lang === 'bn' ? 'অফলাইন পরিবর্তন রাখুন' : 'Keep Local'}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveSyncConflict(c, 'resolved_server', actor)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium cursor-pointer"
                    >
                      {lang === 'bn' ? 'ক্লাউড সংস্করণ রাখুন' : 'Keep Cloud'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Sync Queue */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'অফলাইন সিঙ্ক কিউ (Sync Queue)' : 'Offline Sync Queue'}
        </h3>
        {syncQueue.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {syncQueue.map((item) => (
              <div key={item.uuid} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">
                    {item.operation.toUpperCase()} · {item.collectionName}/{item.docId}
                  </span>
                  {item.lastError && (
                    <div className="text-rose-500 mt-0.5">{item.lastError}</div>
                  )}
                </div>
                <span className="font-medium text-amber-600">{item.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {lang === 'bn'
              ? 'সকল তথ্য ক্লাউডের সাথে সম্পূর্ণ সিঙ্ক অবস্থায় রয়েছে।'
              : 'All records are fully synchronized with Cloud Firestore.'}
          </p>
        )}
      </Card>
    </div>
  );
};

export const AccessHelpPage: React.FC = () => {
  const { lang } = useMess();
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? 'ব্যবহার নির্দেশিকা ও ইনস্টলেশন গাইড' : 'User Manual & Installation Guide'}
        </h2>
      </div>

      <Card className="p-5 space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <h3 className="font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? '১. মোবাইল ও কম্পিউটারে অ্যাপ ইনস্টল (PWA)' : '1. Install as Mobile/Desktop App (PWA)'}
        </h3>
        <p>
          {lang === 'bn'
            ? 'Android Chrome বা Desktop ব্রাউজারে সেটিংস বা হেডারের "অ্যাপ ইনস্টল করুন" বাটনে ক্লিক করে এটি সরাসরি হোম স্ক্রিনে ইনস্টল করতে পারবেন। iPhone Safari-তে Share -> Add to Home Screen ব্যবহার করুন।'
            : 'Use the "Install App" button on Chrome/Edge or Safari Share -> Add to Home Screen on iOS.'}
        </p>

        <h3 className="font-bold text-slate-900 dark:text-white pt-2">
          {lang === 'bn' ? '২. অফলাইন-ফার্স্ট ব্যবহার' : '2. Offline-First Mode'}
        </h3>
        <p>
          {lang === 'bn'
            ? 'প্রথমবার ইন্টারনেটে লগইন করার পর ইন্টারনেট না থাকলেও আপনি দৈনিক মিল, বাজার খরচ, টাকা জমা ও অতিথির হিসাব এন্ট্রি করতে পারবেন। ইন্টারনেট ফিরে এলে সব পরিবর্তন স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হবে।'
            : 'Once logged in online, you can continue entering meals, expenses, payments, and guests offline. All changes queue locally in IndexedDB and sync automatically when internet returns.'}
        </p>

        <h3 className="font-bold text-slate-900 dark:text-white pt-2">
          {lang === 'bn' ? '৩. মাসিক হিসাব ও মিল রেট ফর্মুলা' : '3. Monthly Billing Formulas'}
        </h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>{lang === 'bn' ? 'মিল রেট = মোট বাজার খরচ ÷ মোট মিল' : 'Meal Rate = Total Market Cost ÷ Total Meals'}</li>
          <li>{lang === 'bn' ? 'সদস্যের খাবারের খরচ = সদস্যের মোট মিল × মিল রেট' : 'Food Cost = Member Meals × Meal Rate'}</li>
          <li>{lang === 'bn' ? 'মোট বিল = খাবারের খরচ + রুম ভাড়া + অন্যান্য চার্জ' : 'Total Bill = Food Cost + Room Rent + Other Charges'}</li>
          <li>{lang === 'bn' ? 'বকেয়া বা অগ্রিম = মোট বিল − মোট জমা টাকা' : 'Due / Advance = Total Bill − Total Deposits'}</li>
        </ul>
      </Card>
    </div>
  );
};
