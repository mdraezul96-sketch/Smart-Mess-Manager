import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  MessageSquarePlus,
  Pin,
  ShoppingBasket,
  UserPlus,
  Utensils,
  Vote,
} from 'lucide-react';
import { useMess } from '../../context/MessContext';
import { Card } from '../../components/UI';
import { formatBDT, formatMonthLabel, formatNumber } from '../../i18n/translations';
import { submitMealRequest } from '../../services/messDataService';
import { MemberPageId } from '../../types/mess';
import {
  calculateMonthlySummary,
  getCurrentMonthKey,
  getTodayDateStr,
  getTomorrowDateStr,
  isPastMealCutoff,
} from '../../utils/calculations';

export const MemberHomePage: React.FC<{
  onNavigate: (page: MemberPageId) => void;
}> = ({ onNavigate }) => {
  const {
    currentUser,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
    monthlyClosings,
    monthlyBills,
    weeklyMenus,
    notices,
    mealRequests,
    lang,
    isOnline,
    syncQueue,
  } = useMess();

  const currentMonth = getCurrentMonthKey();
  const todayStr = getTodayDateStr();

  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const currentClosing = useMemo(
    () => monthlyClosings.find((c) => c.monthKey === currentMonth),
    [monthlyClosings, currentMonth]
  );

  const summary = useMemo(
    () =>
      calculateMonthlySummary({
        monthKey: currentMonth,
        members,
        mealEntries,
        expenses,
        payments,
        guestMealRequests,
        savedBills: monthlyBills,
        closing: currentClosing,
        useClosingRates: true,
      }),
    [currentMonth, members, mealEntries, expenses, payments, guestMealRequests, monthlyBills, currentClosing]
  );

  const ownCalc = useMemo(
    () => summary.memberCalculations.find((c) => c.member.id === ownMember?.id),
    [summary, ownMember]
  );

  const ownBillFallback = useMemo(
    () =>
      monthlyBills.find(
        (b) =>
          b.monthKey === currentMonth &&
          (b.memberId === ownMember?.id || b.memberUid === currentUser?.uid)
      ),
    [monthlyBills, currentMonth, ownMember, currentUser]
  );

  const displayMeals = ownCalc?.totalMeals ?? ownBillFallback?.totalMeals ?? 0;
  const displayMealRate = ownCalc?.mealRate ?? currentClosing?.mealRate ?? ownBillFallback?.mealRate ?? summary.mealRate;
  const displayFoodCost = ownCalc?.foodCost ?? ownBillFallback?.foodCost ?? 0;
  const displayRent = ownCalc?.roomRent ?? ownBillFallback?.roomRent ?? 0;
  const displayTotalBill = ownCalc?.totalBill ?? ownBillFallback?.totalBill ?? 0;
  const displayTotalPaid = ownCalc?.totalPaid ?? ownBillFallback?.totalPaid ?? 0;
  const displayDue = ownCalc?.dueAmount ?? ownBillFallback?.dueAmount ?? 0;
  const displayAdvance = ownCalc?.advanceAmount ?? ownBillFallback?.advanceAmount ?? 0;

  const todayMeal = useMemo(
    () => mealEntries.find((e) => e.date === todayStr && e.memberId === ownMember?.id),
    [mealEntries, todayStr, ownMember]
  );

  const pendingMealReqCount = useMemo(
    () => mealRequests.filter((r) => r.memberUid === currentUser?.uid && r.status === 'pending').length,
    [mealRequests, currentUser]
  );

  const todayDayOrder = (new Date().getDay() + 1) % 7;
  const todayMenu = weeklyMenus.find((m) => m.dayOrder === todayDayOrder) || weeklyMenus[0];
  const latestNotice = notices[0];

  const avatarUrl = ownMember?.photoUrl || currentUser?.photoURL;
  const initials = (ownMember?.fullName || currentUser?.displayName || 'M').slice(0, 1);

  return (
    <div className="space-y-5">
      {/* Member Identity Card */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={ownMember?.fullName || currentUser?.displayName}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#17365D] text-white flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                {ownMember?.fullName || currentUser?.displayName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {ownMember
                  ? `${ownMember.roomNumber}${ownMember.seatNumber ? ` · ${ownMember.seatNumber}` : ''}`
                  : currentUser?.email}
                {' · '}
                {formatMonthLabel(currentMonth, lang)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isOnline
                  ? lang === 'bn'
                    ? 'অনলাইন সিঙ্ক সক্রিয়'
                    : 'Online Sync Active'
                  : lang === 'bn'
                    ? 'অফলাইন মোড'
                    : 'Offline Mode'}
                {syncQueue.length > 0 && ` · ${formatNumber(syncQueue.length, lang)}টি সিঙ্ক বাকি`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 cursor-pointer"
          >
            {lang === 'bn' ? 'প্রোফাইল' : 'Profile'}
          </button>
        </div>
      </Card>

      {/* 4 Core Personal Financial & Meal KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'চলতি মাসের মোট মিল' : 'Monthly Total Meals'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#0F8B8D] dark:text-teal-300 mt-1">
            {formatNumber(displayMeals, lang, 1)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono-nums">
            {lang === 'bn' ? 'মিল রেট:' : 'Meal Rate:'} {formatBDT(displayMealRate, lang)}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'চলতি মাসের মোট বিল' : 'Monthly Total Bill'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#17365D] dark:text-sky-300 mt-1">
            {formatBDT(displayTotalBill, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-mono-nums">
            {lang === 'bn'
              ? `খাবার: ${formatBDT(displayFoodCost, lang)} · ভাড়া: ${formatBDT(displayRent, lang)}`
              : `Food: ${formatBDT(displayFoodCost, lang)} · Rent: ${formatBDT(displayRent, lang)}`}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মোট জমা টাকা' : 'Total Paid'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-emerald-600 dark:text-emerald-400 mt-1">
            {formatBDT(displayTotalPaid, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {lang === 'bn' ? 'অনুমোদিত জমা' : 'Approved Deposits'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {displayAdvance > 0
              ? lang === 'bn'
                ? 'বর্তমান অগ্রিম'
                : 'Current Advance'
              : lang === 'bn'
                ? 'বর্তমান বকেয়া'
                : 'Current Due'}
          </div>
          <div
            className={`text-xl font-bold font-mono-nums mt-1 ${
              displayDue > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {displayAdvance > 0
              ? formatBDT(displayAdvance, lang)
              : formatBDT(displayDue, lang)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {displayDue > 0
              ? lang === 'bn'
                ? 'পরিশোধযোগ্য'
                : 'Payable'
              : lang === 'bn'
                ? 'হিসাব পরিষ্কার'
                : 'Settled'}
          </div>
        </Card>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            id: 'my-meals' as MemberPageId,
            label: lang === 'bn' ? 'মিল অন / অফ' : 'Meal On/Off',
            icon: Utensils,
            primary: true,
          },
          {
            id: 'payment-request' as MemberPageId,
            label: lang === 'bn' ? 'টাকা জমার আবেদন' : 'Payment Request',
            icon: CreditCard,
          },
          {
            id: 'guest-meal' as MemberPageId,
            label: lang === 'bn' ? 'অতিথি মিল আবেদন' : 'Guest Meal',
            icon: UserPlus,
          },
          {
            id: 'market-expenses' as MemberPageId,
            label: lang === 'bn' ? 'বাজার খরচ দেখুন' : 'Market Expenses',
            icon: ShoppingBasket,
          },
          {
            id: 'menu-voting' as MemberPageId,
            label: lang === 'bn' ? 'মেনু ভোট' : 'Menu Voting',
            icon: Vote,
          },
          {
            id: 'complaints' as MemberPageId,
            label: lang === 'bn' ? 'অভিযোগ ও পরামর্শ' : 'Complaints',
            icon: MessageSquarePlus,
          },
        ].map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => onNavigate(btn.id)}
              className={`min-h-[48px] px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                btn.primary
                  ? 'bg-[#17365D] hover:bg-[#1e4678] text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-[#0F8B8D]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Today's Meal Status & Today's Food Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'আজকের মিলের অবস্থা' : "Today's Meal Status"}
            </h3>
            <span className="text-xs font-mono-nums text-slate-400">{todayStr}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            {[
              { label: lang === 'bn' ? 'সকাল' : 'Breakfast', val: todayMeal?.breakfast ?? 0 },
              { label: lang === 'bn' ? 'দুপুর' : 'Lunch', val: todayMeal?.lunch ?? 0 },
              { label: lang === 'bn' ? 'রাত' : 'Dinner', val: todayMeal?.dinner ?? 0 },
            ].map((slot) => (
              <div
                key={slot.label}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
              >
                <div className="text-xs text-slate-500">{slot.label}</div>
                <div
                  className={`text-base font-bold font-mono-nums mt-1 ${
                    slot.val > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {slot.val > 0 ? `${formatNumber(slot.val, lang)} (ON)` : 'OFF'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
            <span>
              {pendingMealReqCount > 0
                ? `${formatNumber(pendingMealReqCount, lang)}টি মিল আবেদন অপেক্ষমাণ`
                : lang === 'bn'
                  ? 'আগামী দিনের মিল পরিবর্তন করতে ট্যাপ করুন'
                  : 'Tap to request meal changes'}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('my-meals')}
              className="font-semibold text-[#0F8B8D] hover:underline cursor-pointer"
            >
              {lang === 'bn' ? 'পরিবর্তন করুন' : 'Manage'}
            </button>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'আজকের খাবারের মেনু' : "Today's Food Menu"}
            </h3>
            <span className="text-xs font-semibold text-[#17365D] dark:text-sky-300">
              {todayMenu ? (lang === 'bn' ? todayMenu.dayNameBn : todayMenu.dayNameEn) : ''}
            </span>
          </div>

          {todayMenu ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-slate-500">{lang === 'bn' ? 'সকাল' : 'Breakfast'}</span>
                <span className="font-medium text-right">{todayMenu.breakfast || '—'}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-slate-500">{lang === 'bn' ? 'দুপুর' : 'Lunch'}</span>
                <span className="font-medium text-right">{todayMenu.lunch || '—'}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-slate-500">{lang === 'bn' ? 'রাত' : 'Dinner'}</span>
                <span className="font-medium text-right">{todayMenu.dinner || '—'}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{lang === 'bn' ? 'মেনু পাওয়া যায়নি' : 'No menu set'}</p>
          )}
        </Card>
      </div>

      {/* Latest Notice */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0F8B8D]" />
            <span>{lang === 'bn' ? 'সর্বশেষ নোটিশ' : 'Latest Mess Notice'}</span>
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="text-xs font-semibold text-[#0F8B8D] hover:underline cursor-pointer"
          >
            {lang === 'bn' ? 'সব আপডেট দেখুন' : 'View All'}
          </button>
        </div>

        {latestNotice ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
              {latestNotice.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              <span>{latestNotice.title}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {latestNotice.description}
            </p>
            <div className="text-[11px] text-slate-400">
              {latestNotice.category} · {latestNotice.publishDate}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {lang === 'bn' ? 'বর্তমানে কোনো নতুন নোটিশ নেই।' : 'No recent notices.'}
          </p>
        )}
      </Card>
    </div>
  );
};

export const MemberMealsPage: React.FC = () => {
  const {
    actor,
    currentUser,
    members,
    mealEntries,
    mealRequests,
    settings,
    lang,
  } = useMess();

  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();
  const cutoffTime = settings?.mealCutoffTime || '22:00';

  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const [targetDate, setTargetDate] = useState(tomorrowStr);
  const [breakfast, setBreakfast] = useState(1);
  const [lunch, setLunch] = useState(1);
  const [dinner, setDinner] = useState(1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const todayMeal = useMemo(
    () => mealEntries.find((e) => e.date === todayStr && e.memberId === ownMember?.id),
    [mealEntries, todayStr, ownMember]
  );

  const cutoffInfo = useMemo(() => isPastMealCutoff(targetDate, cutoffTime), [targetDate, cutoffTime]);

  const ownRequests = useMemo(
    () =>
      mealRequests
        .filter((r) => r.memberUid === currentUser?.uid || r.memberId === ownMember?.id)
        .slice(0, 20),
    [mealRequests, currentUser, ownMember]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !ownMember) {
      setErrorMsg(lang === 'bn' ? 'আপনার সদস্য প্রোফাইল লিংক করা নেই।' : 'Member profile is not linked.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await submitMealRequest(
        {
          member: ownMember,
          date: targetDate,
          breakfast,
          lunch,
          dinner,
          reason,
          cutoffTime,
        },
        actor
      );
      setReason('');
      setFeedback(
        lang === 'bn'
          ? `${targetDate} তারিখের মিল আবেদন জমা হয়েছে (ম্যানেজারের অনুমোদনের অপেক্ষায়)।`
          : `Meal request for ${targetDate} submitted for approval.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? 'আমার মিল ও মিল অন/অফ আবেদন' : 'My Meals & On/Off Requests'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? `প্রতিদিন ${cutoffTime}-এর মধ্যে আগামী দিনের মিল চালু বা বন্ধের আবেদন করা যাবে`
            : `Submit meal on/off requests before daily cutoff (${cutoffTime})`}
        </p>
      </div>

      {/* Today's Confirmed Meals */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'আজকের নিশ্চিত মিল' : "Today's Active Meals"}
          </h3>
          <span className="text-xs font-mono-nums text-slate-400">{todayStr}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: lang === 'bn' ? 'সকাল' : 'Breakfast', val: todayMeal?.breakfast ?? 0 },
            { label: lang === 'bn' ? 'দুপুর' : 'Lunch', val: todayMeal?.lunch ?? 0 },
            { label: lang === 'bn' ? 'রাত' : 'Dinner', val: todayMeal?.dinner ?? 0 },
          ].map((slot) => (
            <div key={slot.label} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500">{slot.label}</div>
              <div className={`text-base font-bold font-mono-nums mt-1 ${slot.val > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {slot.val > 0 ? `${formatNumber(slot.val, lang)} ON` : 'OFF'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Meal Request Form */}
      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'আগামী দিনের মিল চালু / বন্ধ আবেদন' : 'Request Meal On / Off'}
            </h3>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {lang === 'bn' ? `শেষ সময়: ${cutoffTime}` : `Cutoff: ${cutoffTime}`}
            </span>
          </div>

          {cutoffInfo.locked && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{lang === 'bn' ? cutoffInfo.reasonBn : cutoffInfo.reasonEn}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600">
              {errorMsg}
            </div>
          )}
          {feedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {lang === 'bn' ? 'তারিখ নির্বাচন করুন' : 'Select Date'}
              </span>
              <input
                type="date"
                min={tomorrowStr}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {lang === 'bn' ? 'মিল বন্ধ বা পরিবর্তনের কারণ (ঐচ্ছিক)' : 'Reason (Optional)'}
              </span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={lang === 'bn' ? 'যেমন: বাড়ি যাব / বাইরে খাব' : 'e.g., Going home / Eating out'}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'breakfast', label: lang === 'bn' ? 'সকালের নাশতা' : 'Breakfast', val: breakfast, setVal: setBreakfast },
              { key: 'lunch', label: lang === 'bn' ? 'দুপুরের খাবার' : 'Lunch', val: lunch, setVal: setLunch },
              { key: 'dinner', label: lang === 'bn' ? 'রাতের খাবার' : 'Dinner', val: dinner, setVal: setDinner },
            ].map((slot) => (
              <button
                key={slot.key}
                type="button"
                onClick={() => slot.setVal(slot.val > 0 ? 0 : 1)}
                className={`min-h-[68px] p-3 rounded-xl border text-center transition-colors cursor-pointer ${
                  slot.val > 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-xs font-medium">{slot.label}</div>
                <div className="text-sm font-bold mt-1">
                  {slot.val > 0 ? (lang === 'bn' ? 'চালু (ON)' : 'ON') : lang === 'bn' ? 'বন্ধ (OFF)' : 'OFF'}
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setBreakfast(0);
                setLunch(0);
                setDinner(0);
              }}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-rose-600 cursor-pointer"
            >
              {lang === 'bn' ? 'সব মিল বন্ধ (All OFF)' : 'Turn All OFF'}
            </button>

            <button
              type="submit"
              disabled={submitting || cutoffInfo.locked || !ownMember}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? lang === 'bn'
                  ? 'পাঠানো হচ্ছে...'
                  : 'Submitting...'
                : lang === 'bn'
                  ? 'আবেদন পাঠান'
                  : 'Submit Request'}
            </button>
          </div>
        </form>
      </Card>

      {/* Request History */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'আমার মিল আবেদনের তালিকা' : 'My Meal Request History'}
        </h3>
        {ownRequests.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ownRequests.map((req) => (
              <div key={req.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white font-mono-nums">
                    {req.date} · {lang === 'bn' ? 'সকাল' : 'B'}: {req.breakfast}, {lang === 'bn' ? 'দুপুর' : 'L'}: {req.lunch}, {lang === 'bn' ? 'রাত' : 'D'}: {req.dinner}
                  </div>
                  {req.reason && (
                    <div className="text-xs text-slate-500 mt-0.5">{req.reason}</div>
                  )}
                  {req.reviewNote && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {lang === 'bn' ? 'ম্যানেজার নোট:' : 'Review note:'} {req.reviewNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
                  {req.syncStatus === 'pending' && (
                    <span className="text-amber-600">{lang === 'bn' ? 'সিঙ্ক বাকি' : 'Pending Sync'} ·</span>
                  )}
                  <span
                    className={
                      req.status === 'approved'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : req.status === 'rejected'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                    }
                  >
                    {req.status === 'approved'
                      ? lang === 'bn'
                        ? 'অনুমোদিত (Approved)'
                        : 'Approved'
                      : req.status === 'rejected'
                        ? lang === 'bn'
                          ? 'প্রত্যাখ্যাত (Rejected)'
                          : 'Rejected'
                        : lang === 'bn'
                          ? 'অপেক্ষমাণ (Pending)'
                          : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-4">
            {lang === 'bn' ? 'এখনো কোনো মিল আবেদন পাঠানো হয়নি।' : 'No meal requests submitted yet.'}
          </p>
        )}
      </Card>
    </div>
  );
};
