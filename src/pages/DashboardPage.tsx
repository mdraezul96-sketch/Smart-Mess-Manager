import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BedDouble,
  Calculator,
  CalendarDays,
  CreditCard,
  FileSpreadsheet,
  MessageCircle,
  Pin,
  Plus,
  Receipt,
  ShoppingBasket,
  UserPlus,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card } from '../components/UI';
import {
  WhatsAppGroupSummaryModal,
  WhatsAppMemberModal,
  WhatsAppQuickButtons,
} from '../components/WhatsAppShareModal';
import { formatBDT, formatMonthLabel, formatNumber, TEXT } from '../i18n/translations';
import { PageId } from '../types/mess';
import {
  calculateDashboardKPIs,
  calculateMonthlySummary,
  MemberMonthlyCalculation,
  round2,
} from '../utils/calculations';
import { WhatsAppMessageMode } from '../utils/whatsappShare';

export const DashboardPage: React.FC<{
  onNavigate: (page: PageId) => void;
}> = ({ onNavigate }) => {
  const {
    currentUser,
    lang,
    selectedMonth,
    setSelectedMonth,
    rooms,
    members,
    mealEntries,
    expenses,
    payments,
    guests,
    guestMealRequests,
    notices,
    weeklyMenus,
    settings,
    isOnline,
    lastSyncedAt,
    syncQueue,
  } = useMess();

  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const [waMemberTarget, setWaMemberTarget] = React.useState<{
    calc: MemberMonthlyCalculation;
    mode: WhatsAppMessageMode;
  } | null>(null);
  const [waGroupOpen, setWaGroupOpen] = React.useState(false);

  const kpis = useMemo(
    () =>
      calculateDashboardKPIs({
        monthKey: selectedMonth,
        rooms,
        members,
        mealEntries,
        expenses,
        payments,
        guests,
        guestMealRequests,
      }),
    [selectedMonth, rooms, members, mealEntries, expenses, payments, guests, guestMealRequests]
  );

  const monthlySummary = useMemo(
    () =>
      calculateMonthlySummary({
        monthKey: selectedMonth,
        members,
        mealEntries,
        expenses,
        payments,
        guestMealRequests,
      }),
    [selectedMonth, members, mealEntries, expenses, payments, guestMealRequests]
  );

  // Build last 6 months chart data for Expense & Deposit
  const chartData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
    }

    return months.map((mk) => {
      const market = expenses
        .filter((e) => e.monthKey === mk && !e.isVoided && e.expenseGroup === 'market')
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const other = expenses
        .filter((e) => e.monthKey === mk && !e.isVoided && e.expenseGroup === 'other')
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      const deposit = payments
        .filter((p) => p.monthKey === mk && !p.isVoided)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        month: mk.slice(5),
        label: formatMonthLabel(mk, lang),
        market: round2(market),
        other: round2(other),
        deposit: round2(deposit),
      };
    });
  }, [selectedMonth, expenses, payments, lang]);

  const recentMarketExpenses = useMemo(
    () =>
      expenses
        .filter((e) => !e.isVoided && e.expenseGroup === 'market')
        .slice(0, 5),
    [expenses]
  );

  const recentTransactions = useMemo(
    () => payments.filter((p) => !p.isVoided).slice(0, 5),
    [payments]
  );

  const pinnedNotices = useMemo(() => notices.slice(0, 3), [notices]);

  // Member personal view if logged in as Member
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );
  const ownSummary = useMemo(
    () => monthlySummary.memberCalculations.find((c) => c.member.id === ownMember?.id),
    [monthlySummary, ownMember]
  );

  const kpiCards = [
    { label: t.totalMembers, value: formatNumber(kpis.totalActiveMembers, lang), icon: Users, tone: 'text-[#17365D] dark:text-sky-300' },
    { label: t.totalRooms, value: formatNumber(kpis.totalRooms, lang), icon: BedDouble, tone: 'text-[#17365D] dark:text-sky-300' },
    { label: t.totalSeats, value: formatNumber(kpis.totalSeats, lang), icon: BedDouble, tone: 'text-slate-700 dark:text-slate-200' },
    { label: t.availableSeats, value: formatNumber(kpis.availableSeats, lang), icon: BedDouble, tone: kpis.availableSeats > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300' },
    { label: t.monthlyMeals, value: formatNumber(kpis.monthlyTotalMeals, lang, 1), icon: Utensils, tone: 'text-[#0F8B8D] dark:text-teal-300' },
    { label: t.marketExpense, value: formatBDT(kpis.monthlyMarketCost, lang), icon: ShoppingBasket, tone: 'text-rose-600 dark:text-rose-400' },
    { label: t.otherExpense, value: formatBDT(kpis.monthlyOtherCost, lang), icon: Receipt, tone: 'text-amber-600 dark:text-amber-400' },
    { label: t.totalDeposits, value: formatBDT(kpis.monthlyTotalDeposits, lang), icon: Wallet, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: t.totalDue, value: formatBDT(kpis.monthlyTotalDue, lang), icon: CreditCard, tone: kpis.monthlyTotalDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400' },
    { label: t.guestIncome, value: formatBDT(kpis.guestIncome, lang), icon: UserPlus, tone: 'text-[#0F8B8D] dark:text-teal-300' },
    { label: t.mealRate, value: formatBDT(kpis.currentMealRate, lang), icon: Calculator, tone: 'text-[#17365D] dark:text-sky-300' },
    { label: t.messBalance, value: formatBDT(kpis.messBalance, lang), icon: Wallet, tone: kpis.messBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
  ];

  const todayDayOrder = (new Date().getDay() + 1) % 7; // Saturday = 0
  const todayMenu = weeklyMenus.find((m) => m.dayOrder === todayDayOrder) || weeklyMenus[0];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {isManagerOrAdmin
              ? lang === 'bn' ? 'মেস ড্যাশবোর্ড ও সারসংক্ষেপ' : 'Mess Dashboard Overview'
              : lang === 'bn' ? `স্বাগতম, ${currentUser?.displayName || ''}` : `Welcome, ${currentUser?.displayName || ''}`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {formatMonthLabel(selectedMonth, lang)} ·{' '}
            {isOnline ? (lang === 'bn' ? 'ক্লাউড সিঙ্ক সক্রিয়' : 'Cloud Sync Active') : lang === 'bn' ? 'অফলাইন মোড (লোকাল স্টোরেজ)' : 'Offline Mode (Local Storage)'}
            {syncQueue.length > 0 && ` · ${formatNumber(syncQueue.length, lang)} ${t.pendingSync}`}
            {lastSyncedAt && ` · ${t.lastSync}: ${new Date(lastSyncedAt).toLocaleTimeString()}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Member Personal Summary if Member Role */}
      {!isManagerOrAdmin && (
        <Card className="p-5">
          {ownSummary ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'আপনার চলতি মাসের ব্যক্তিগত হিসাব' : 'Your Monthly Personal Summary'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ownSummary.member.fullName} · {ownSummary.member.roomNumber} {ownSummary.member.seatNumber ? `/ ${ownSummary.member.seatNumber}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('monthly-bill')}
                  className="px-3.5 py-2 rounded-lg bg-[#17365D] text-white text-xs font-medium cursor-pointer"
                >
                  {lang === 'bn' ? 'বিস্তারিত বিল দেখুন' : 'View Full Bill'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট মিল' : 'Total Meals'}</div>
                  <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white mt-0.5">
                    {formatNumber(ownSummary.totalMeals, lang, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'খাবার বিল' : 'Food Cost'}</div>
                  <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white mt-0.5">
                    {formatBDT(ownSummary.foodCost, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</div>
                  <div className="text-lg font-bold font-mono-nums text-[#17365D] dark:text-sky-300 mt-0.5">
                    {formatBDT(ownSummary.totalBill, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{lang === 'bn' ? 'জমা' : 'Paid'}</div>
                  <div className="text-lg font-bold font-mono-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatBDT(ownSummary.totalPaid, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {ownSummary.advanceAmount > 0 ? (lang === 'bn' ? 'অগ্রিম' : 'Advance') : (lang === 'bn' ? 'বকেয়া' : 'Due')}
                  </div>
                  <div className={`text-lg font-bold font-mono-nums mt-0.5 ${ownSummary.dueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {ownSummary.advanceAmount > 0
                      ? formatBDT(ownSummary.advanceAmount, lang)
                      : formatBDT(ownSummary.dueAmount, lang)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {lang === 'bn'
                ? 'আপনার ইউজার অ্যাকাউন্টটি এখনো কোনো মেস সদস্যের প্রোফাইলের সাথে যুক্ত করা হয়নি। অনুগ্রহ করে মেস Admin-কে আপনার প্রোফাইল লিংক করতে বলুন।'
                : 'Your account is not linked to a member profile yet. Please ask the Mess Admin to link your profile.'}
            </p>
          )}
        </Card>
      )}

      {/* Quick Action Buttons (Admin/Manager) */}
      {isManagerOrAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: lang === 'bn' ? 'নতুন সদস্য যোগ' : 'Add Member', page: 'members' as PageId, icon: UserPlus, primary: true },
            { label: lang === 'bn' ? 'মিল যোগ' : 'Add Meal', page: 'meals' as PageId, icon: Utensils },
            { label: lang === 'bn' ? 'বাজার খরচ যোগ' : 'Add Expense', page: 'expenses' as PageId, icon: ShoppingBasket },
            { label: lang === 'bn' ? 'টাকা জমা' : 'Add Payment', page: 'payments' as PageId, icon: Wallet },
            { label: lang === 'bn' ? 'অতিথি যোগ' : 'Add Guest', page: 'guests' as PageId, icon: Plus },
            { label: lang === 'bn' ? 'রিপোর্ট তৈরি' : 'Generate Report', page: 'reports' as PageId, icon: FileSpreadsheet },
          ].map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.page}
                type="button"
                onClick={() => onNavigate(act.page)}
                className={`min-h-[46px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                  act.primary
                    ? 'bg-[#17365D] hover:bg-[#1e4678] text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#0F8B8D]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{act.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 12 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {item.label}
                </span>
                <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              </div>
              <div className={`text-lg sm:text-xl font-bold font-mono-nums ${item.tone}`}>
                {item.value}
              </div>
            </Card>
          );
        })}
      </div>

      {isManagerOrAdmin && kpis.monthlyTotalMeals > 0 && kpis.monthlyMarketCost === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            {lang === 'bn'
              ? `চলতি মাসে ${formatNumber(kpis.monthlyTotalMeals, lang, 1)}টি মিল রয়েছে, কিন্তু কোনো বাজার খরচ যুক্ত না থাকায় মিল রেট ৳ ০ দেখাচ্ছে। বাজার খরচ যোগ করলে মিল রেট ও সবার বিল স্বয়ংক্রিয়ভাবে হিসাব হবে।`
              : `${formatNumber(kpis.monthlyTotalMeals, lang, 1)} meals logged this month, but Market Expense is ৳0 so Meal Rate is ৳0. Add a Market Expense to calculate food bills.`}
          </span>
          <button
            type="button"
            onClick={() => onNavigate('expenses')}
            className="px-3 py-1.5 rounded-lg bg-[#17365D] text-white font-semibold cursor-pointer"
          >
            {lang === 'bn' ? 'বাজার খরচ যোগ করুন' : 'Add Market Expense'}
          </button>
        </div>
      )}

      {/* Charts Row: Monthly Expense Chart & Monthly Deposit Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'মাসিক খরচ বিশ্লেষণ (বাজার বনাম অন্যান্য)' : 'Monthly Expense Chart'}
            </h3>
            <span className="text-xs text-slate-400">BDT (৳)</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="market" name={lang === 'bn' ? 'বাজার' : 'Market'} fill="#17365D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="other" name={lang === 'bn' ? 'অন্যান্য' : 'Other'} fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'মাসিক টাকা জমা (ডিপোজিট)' : 'Monthly Deposit Chart'}
            </h3>
            <span className="text-xs text-slate-400">BDT (৳)</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="deposit" name={lang === 'bn' ? 'মোট জমা' : 'Total Deposit'} fill="#0F8B8D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Member Meal & Payment Overview + Today's Menu & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সদস্যদের মিল ও পেমেন্ট অবস্থা' : 'Member Meal & Payment Status'}
            </h3>
            <div className="flex items-center gap-2">
              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setWaGroupOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'WhatsApp রিমাইন্ডার' : 'WhatsApp'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('monthly-bill')}
                className="text-xs font-medium text-[#0F8B8D] hover:underline cursor-pointer"
              >
                {lang === 'bn' ? 'সব দেখুন' : 'View All'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2.5 font-medium">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                  <th className="text-right py-2.5 font-medium">{lang === 'bn' ? 'মিল' : 'Meals'}</th>
                  <th className="text-right py-2.5 font-medium">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</th>
                  <th className="text-right py-2.5 font-medium">{lang === 'bn' ? 'জমা' : 'Paid'}</th>
                  <th className="text-right py-2.5 font-medium">{lang === 'bn' ? 'বকেয়া / অগ্রিম' : 'Due / Adv'}</th>
                  {isManagerOrAdmin && (
                    <th className="text-right py-2.5 font-medium">{lang === 'bn' ? 'শেয়ার' : 'Share'}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.memberCalculations.map((row) => (
                  <tr key={row.member.id} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="py-2.5">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{row.member.fullName}</div>
                      <div className="text-xs text-slate-400">{row.member.roomNumber}</div>
                    </td>
                    <td className="py-2.5 text-right font-mono-nums text-slate-700 dark:text-slate-300">
                      {formatNumber(row.totalMeals, lang, 1)}
                    </td>
                    <td className="py-2.5 text-right font-mono-nums text-slate-700 dark:text-slate-300">
                      {formatBDT(row.totalBill, lang)}
                    </td>
                    <td className="py-2.5 text-right font-mono-nums text-emerald-600 dark:text-emerald-400">
                      {formatBDT(row.totalPaid, lang)}
                    </td>
                    <td className="py-2.5 text-right font-mono-nums font-semibold">
                      {row.advanceAmount > 0 ? (
                        <span className="text-[#0F8B8D] dark:text-teal-300">
                          +{formatBDT(row.advanceAmount, lang)}
                        </span>
                      ) : row.dueAmount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {formatBDT(row.dueAmount, lang)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">৳ ০</span>
                      )}
                    </td>
                    {isManagerOrAdmin && (
                      <td className="py-2.5 text-right whitespace-nowrap pl-2">
                        <WhatsAppQuickButtons
                          calc={row}
                          monthKey={selectedMonth}
                          messName={settings?.messName}
                          contactNumber={settings?.contactNumber}
                          mode={row.dueAmount > 0 ? 'due' : 'bill'}
                          lang={lang}
                          compact
                          onPreview={(targetCalc, mode) => setWaMemberTarget({ calc: targetCalc, mode })}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {monthlySummary.memberCalculations.length === 0 && (
                  <tr>
                    <td colSpan={isManagerOrAdmin ? 6 : 5} className="py-6 text-center text-xs text-slate-400">
                      {t.noData}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Right Column: Today's Menu + Pinned Notices */}
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'আজকের খাবারের মেনু' : "Today's Food Menu"}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('weekly-menu')}
                className="text-xs font-medium text-[#0F8B8D] hover:underline cursor-pointer"
              >
                {lang === 'bn' ? 'সাপ্তাহিক মেনু' : 'Full Menu'}
              </button>
            </div>
            {todayMenu ? (
              <div className="space-y-2 text-sm">
                <div className="text-xs font-semibold text-[#17365D] dark:text-sky-300">
                  {lang === 'bn' ? todayMenu.dayNameBn : todayMenu.dayNameEn}
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{lang === 'bn' ? 'সকাল' : 'Breakfast'}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{todayMenu.breakfast || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">{lang === 'bn' ? 'দুপুর' : 'Lunch'}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{todayMenu.lunch || '-'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">{lang === 'bn' ? 'রাত' : 'Dinner'}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{todayMenu.dinner || '-'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">{t.noData}</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === 'bn' ? 'গুরুত্বপূর্ণ নোটিশ' : 'Notice Board'}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('notices')}
                className="text-xs font-medium text-[#0F8B8D] hover:underline cursor-pointer"
              >
                {lang === 'bn' ? 'সব নোটিশ' : 'All'}
              </button>
            </div>
            {pinnedNotices.length > 0 ? (
              <div className="space-y-3">
                {pinnedNotices.map((n) => (
                  <div key={n.id} className="pb-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {n.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <span className="truncate">{n.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                      {n.description}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {n.category} · {n.publishDate}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                {lang === 'bn' ? 'কোনো নতুন নোটিশ নেই' : 'No active notices'}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Market Expenses & Recent Deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সাম্প্রতিক বাজার খরচ' : 'Recent Market Expenses'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="text-xs font-medium text-[#0F8B8D] hover:underline cursor-pointer"
            >
              {lang === 'bn' ? 'সব দেখুন' : 'View All'}
            </button>
          </div>
          {recentMarketExpenses.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentMarketExpenses.map((e) => (
                <div key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {e.itemName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {e.category} · {e.date} {e.shopperName ? `· ${e.shopperName}` : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono-nums text-rose-600 dark:text-rose-400 shrink-0">
                    {formatBDT(e.amount, lang)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4">{t.noData}</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সাম্প্রতিক টাকা জমা (Transactions)' : 'Recent Transactions'}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('payments')}
              className="text-xs font-medium text-[#0F8B8D] hover:underline cursor-pointer"
            >
              {lang === 'bn' ? 'সব দেখুন' : 'View All'}
            </button>
          </div>
          {recentTransactions.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {p.memberName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {p.paymentMethod} · {p.paymentDate} · {p.receiptNo}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{formatBDT(p.amount, lang)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4">{t.noData}</p>
          )}
        </Card>
      </div>

      <WhatsAppMemberModal
        open={!!waMemberTarget}
        onClose={() => setWaMemberTarget(null)}
        calc={waMemberTarget?.calc || null}
        monthKey={selectedMonth}
        messName={settings?.messName}
        contactNumber={settings?.contactNumber}
        initialMode={waMemberTarget?.mode || 'due'}
        lang={lang}
      />

      <WhatsAppGroupSummaryModal
        open={waGroupOpen}
        onClose={() => setWaGroupOpen(false)}
        summary={monthlySummary}
        messName={settings?.messName}
        contactNumber={settings?.contactNumber}
        initialTab="individual"
        initialOnlyDue={true}
        lang={lang}
      />
    </div>
  );
};
