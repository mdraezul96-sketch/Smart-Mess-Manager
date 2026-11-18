import React from 'react';
import {
  Bell,
  Calculator,
  Grid,
  Home,
  LogOut,
  Moon,
  Sun,
  Utensils,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import { PWAInstallButton } from './UI';
import { MemberPageId } from '../types/mess';

const DESKTOP_QUICK_LINKS: Array<{ id: MemberPageId; bn: string; en: string }> = [
  { id: 'home', bn: 'হোম', en: 'Home' },
  { id: 'my-meals', bn: 'আমার মিল', en: 'My Meals' },
  { id: 'my-bill', bn: 'আমার বিল', en: 'My Bill' },
  { id: 'payment-request', bn: 'টাকা জমার আবেদন', en: 'Pay Request' },
  { id: 'market-expenses', bn: 'বাজার খরচ', en: 'Market' },
  { id: 'guest-meal', bn: 'অতিথি মিল', en: 'Guest Meal' },
  { id: 'menu-voting', bn: 'মেনু ভোট', en: 'Menu Vote' },
  { id: 'complaints', bn: 'অভিযোগ', en: 'Complaints' },
  { id: 'notifications', bn: 'নোটিফিকেশন', en: 'Alerts' },
  { id: 'more', bn: 'আরও', en: 'More' },
];

export const MemberAppShell: React.FC<{
  activePage: MemberPageId;
  onNavigate: (page: MemberPageId) => void;
  children: React.ReactNode;
}> = ({ activePage, onNavigate, children }) => {
  const {
    currentUser,
    members,
    notifications,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    isOnline,
    isSyncing,
    syncQueue,
    triggerSyncNow,
    logout,
    settings,
  } = useMess();

  const uid = currentUser?.uid || '';
  const unreadCount = notifications.filter(
    (n) => (n.targetUid === 'ALL' || n.targetUid === uid) && !n.readByUids.includes(uid)
  ).length;

  const ownMember = members.find(
    (m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid
  );

  const isMoreSubPage = [
    'more',
    'market-expenses',
    'payment-request',
    'guest-meal',
    'complaints',
    'menu-voting',
    'profile',
    'mess-rules',
  ].includes(activePage);

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 h-14 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 no-print">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer text-left"
        >
          <img src="/icon.svg" alt="Smart Mess" className="w-8 h-8 rounded-lg shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {settings?.messName || 'Smart Mess Manager'}
            </div>
            <div className="text-[11px] text-[#0F8B8D] dark:text-teal-300 truncate">
              {lang === 'bn' ? 'সদস্য পোর্টাল' : 'Member Portal'}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isOnline) void triggerSyncNow();
            }}
            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
            title={lang === 'bn' ? 'সিঙ্ক অবস্থা' : 'Sync status'}
          >
            {isOnline ? (
              <Wifi className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`} />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
            )}
            {syncQueue.length > 0 && (
              <span className="font-mono-nums text-amber-600 font-bold">{syncQueue.length}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold font-mono-nums flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <PWAInstallButton lang={lang} />

          <button
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={logout}
            className="hidden sm:flex p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
            title={lang === 'bn' ? 'লগ আউট' : 'Sign Out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Desktop Top Sub-Navigation */}
      <nav className="hidden md:flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 overflow-x-auto no-print">
        <div className="max-w-4xl w-full mx-auto flex items-center gap-1 py-2">
          {DESKTOP_QUICK_LINKS.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#17365D] text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {lang === 'bn' ? item.bn : item.en}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 pb-24 md:pb-8 space-y-4">
        {!ownMember && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
            {lang === 'bn'
              ? 'আপনার অ্যাকাউন্টটি এখনো কোনো সদস্য প্রোফাইলের সাথে যুক্ত (Linked) হয়নি। মিল, বিল ও পেমেন্ট আবেদন চালু করতে অনুগ্রহ করে মেস মালিক বা ম্যানেজারকে আপনার ইমেইলটি প্রোফাইলের সাথে যুক্ত করতে বলুন।'
              : 'Your account is not linked to a member profile yet. Please ask your Mess Owner/Manager to link your account in Users & Roles.'}
          </div>
        )}
        {children}
      </main>

      {/* Exact 5-Tab Bottom Navigation Bar for Member */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 h-16 pb-safe no-print">
        {[
          { id: 'home' as MemberPageId, label: lang === 'bn' ? 'হোম' : 'Home', icon: Home, active: activePage === 'home' },
          { id: 'my-meals' as MemberPageId, label: lang === 'bn' ? 'আমার মিল' : 'My Meals', icon: Utensils, active: activePage === 'my-meals' },
          { id: 'my-bill' as MemberPageId, label: lang === 'bn' ? 'আমার বিল' : 'My Bill', icon: Calculator, active: activePage === 'my-bill' },
          { id: 'notifications' as MemberPageId, label: lang === 'bn' ? 'নোটিশ' : 'Alerts', icon: Bell, active: activePage === 'notifications', badge: unreadCount },
          { id: 'more' as MemberPageId, label: lang === 'bn' ? 'আরও' : 'More', icon: Grid, active: isMoreSubPage },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                tab.active ? 'text-[#0F8B8D] dark:text-teal-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold font-mono-nums flex items-center justify-center">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="truncate max-w-[68px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
