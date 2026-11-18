import React, { useState } from 'react';
import {
  BedDouble,
  Bell,
  Calculator,
  CalendarDays,
  CheckSquare,
  DatabaseBackup,
  FileSpreadsheet,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBasket,
  Sun,
  UserPlus,
  Users,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import { PWAInstallButton } from './UI';
import { TEXT } from '../i18n/translations';
import { PageId } from '../types/mess';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'admin' | 'manager' | 'member'>;
}

export const AppShell: React.FC<{
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}> = ({ activePage, onNavigate, children }) => {
  const {
    currentUser,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
    isOnline,
    isSyncing,
    syncQueue,
    syncConflicts,
    mealRequests,
    paymentRequests,
    guestMealRequests,
    complaints,
    logout,
    settings,
  } = useMess();

  const t = TEXT[lang];
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: NavItem[] = [
    { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['admin', 'manager', 'member'] },
    { id: 'members', label: t.members, icon: Users, roles: ['admin', 'manager'] },
    { id: 'rooms', label: t.rooms, icon: BedDouble, roles: ['admin', 'manager', 'member'] },
    { id: 'meals', label: t.meals, icon: Utensils, roles: ['admin', 'manager', 'member'] },
    { id: 'meal-calendar', label: t.mealCalendar, icon: CalendarDays, roles: ['admin', 'manager', 'member'] },
    { id: 'expenses', label: t.expenses, icon: ShoppingBasket, roles: ['admin', 'manager', 'member'] },
    { id: 'payments', label: t.payments, icon: Wallet, roles: ['admin', 'manager', 'member'] },
    { id: 'monthly-bill', label: t.monthlyBill, icon: Calculator, roles: ['admin', 'manager', 'member'] },
    { id: 'guests', label: t.guests, icon: UserPlus, roles: ['admin', 'manager'] },
    { id: 'weekly-menu', label: t.weeklyMenu, icon: UtensilsCrossed, roles: ['admin', 'manager', 'member'] },
    { id: 'notices', label: t.notices, icon: Bell, roles: ['admin', 'manager', 'member'] },
    { id: 'approvals', label: t.approvals, icon: CheckSquare, roles: ['admin', 'manager'] },
    { id: 'reports', label: t.reports, icon: FileSpreadsheet, roles: ['admin', 'manager'] },
    { id: 'users', label: t.users, icon: Shield, roles: ['admin'] },
    { id: 'sync-center', label: t.syncCenter, icon: RefreshCw, roles: ['admin', 'manager', 'member'] },
    { id: 'backup', label: t.backup, icon: DatabaseBackup, roles: ['admin'] },
    { id: 'settings', label: t.settings, icon: Settings, roles: ['admin', 'manager', 'member'] },
    { id: 'access-help', label: t.accessHelp, icon: HelpCircle, roles: ['admin', 'manager', 'member'] },
  ];

  const userRole = currentUser?.role || 'member';
  const visibleNav = navItems.filter((item) => item.roles.includes(userRole));
  const pendingConflictsCount = syncConflicts.filter((c) => c.status === 'pending').length;
  const pendingApprovalsCount =
    mealRequests.filter((r) => r.status === 'pending').length +
    paymentRequests.filter((r) => r.status === 'pending').length +
    guestMealRequests.filter((r) => r.status === 'pending').length +
    complaints.filter((c) => c.status !== 'resolved').length;

  const handleSelectPage = (id: PageId) => {
    onNavigate(id);
    setDrawerOpen(false);
  };

  const activeItem = navItems.find((n) => n.id === activePage);

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#17365D] text-white z-30 no-print">
        <div className="p-5 border-b border-white/10 flex items-center gap-3">
          <img src="/icon.svg" alt="Smart Mess" className="w-9 h-9 rounded-lg shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">
              {settings?.messName || 'Smart Mess Manager'}
            </div>
            <div className="text-[11px] text-teal-300 truncate">
              {currentUser?.role === 'admin'
                ? 'Owner / Admin'
                : currentUser?.role === 'manager'
                  ? 'Mess Manager'
                  : 'Member'}
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#0F8B8D] text-white'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'sync-center' && (syncQueue.length > 0 || pendingConflictsCount > 0) && (
                  <span className="text-[11px] font-mono-nums text-amber-300 font-bold">
                    {syncQueue.length + pendingConflictsCount}
                  </span>
                )}
                {item.id === 'approvals' && pendingApprovalsCount > 0 && (
                  <span className="text-[11px] font-mono-nums text-amber-300 font-bold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="px-3 py-2 rounded-lg bg-white/5 text-xs flex items-center justify-between">
            <span className="truncate font-medium">{currentUser?.displayName}</span>
            <button
              type="button"
              onClick={logout}
              className="text-rose-300 hover:text-rose-200 p-1 cursor-pointer"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-xs flex"
          onClick={() => setDrawerOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-72 max-w-[85vw] bg-[#17365D] text-white h-full flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src="/icon.svg" alt="Smart Mess" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-sm truncate">
                  {settings?.messName || 'Smart Mess Manager'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectPage(item.id)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 cursor-pointer ${
                      isActive ? 'bg-[#0F8B8D] text-white' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={logout}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/10 text-rose-200 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-14 px-4 sm:px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {activeItem?.label || t.dashboard}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('sync-center')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              title={t.syncCenter}
            >
              {isOnline ? (
                <Wifi className={`w-3.5 h-3.5 ${isSyncing ? 'text-amber-500 animate-pulse' : 'text-emerald-600'}`} />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span className="hidden sm:inline">
                {isOnline ? (isSyncing ? (lang === 'bn' ? 'সিঙ্ক হচ্ছে' : 'Syncing') : t.online) : t.offline}
              </span>
              {syncQueue.length > 0 && (
                <span className="font-mono-nums text-amber-600 font-bold">({syncQueue.length})</span>
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
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 h-15 pb-safe no-print">
          {[
            { id: 'dashboard' as PageId, label: lang === 'bn' ? 'হোম' : 'Home', icon: LayoutDashboard },
            { id: 'meals' as PageId, label: lang === 'bn' ? 'মিল' : 'Meals', icon: Utensils },
            { id: 'expenses' as PageId, label: lang === 'bn' ? 'বাজার' : 'Expense', icon: ShoppingBasket },
            { id: 'payments' as PageId, label: lang === 'bn' ? 'জমা' : 'Pay', icon: Wallet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectPage(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer ${
                  isActive ? 'text-[#0F8B8D]' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
            <span>{lang === 'bn' ? 'মেনু' : 'More'}</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
