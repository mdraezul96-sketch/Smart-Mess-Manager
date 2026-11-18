import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, Lock, MessageCircle, Unlock } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal } from '../components/UI';
import {
  WhatsAppGroupSummaryModal,
  WhatsAppMemberModal,
  WhatsAppQuickButtons,
} from '../components/WhatsAppShareModal';
import { formatBDT, formatMonthLabel, formatNumber, TEXT } from '../i18n/translations';
import { generateMonthlyBills, setMonthClosedStatus } from '../services/messDataService';
import { calculateMonthlySummary, MemberMonthlyCalculation } from '../utils/calculations';
import { WhatsAppMessageMode } from '../utils/whatsappShare';

export const MonthlyBillPage: React.FC = () => {
  const {
    actor,
    currentUser,
    lang,
    selectedMonth,
    setSelectedMonth,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
    monthlyClosings,
    settings,
  } = useMess();

  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const [customOtherPerMember, setCustomOtherPerMember] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<'close' | 'reopen' | null>(null);
  const [waMemberTarget, setWaMemberTarget] = useState<{
    calc: MemberMonthlyCalculation;
    mode: WhatsAppMessageMode;
  } | null>(null);
  const [waGroupOpen, setWaGroupOpen] = useState(false);

  const closingRecord = useMemo(
    () => monthlyClosings.find((c) => c.monthKey === selectedMonth),
    [monthlyClosings, selectedMonth]
  );

  const summary = useMemo(
    () =>
      calculateMonthlySummary({
        monthKey: selectedMonth,
        members,
        mealEntries,
        expenses,
        payments,
        guestMealRequests,
        customOtherPerMember: customOtherPerMember !== '' ? Number(customOtherPerMember) : undefined,
      }),
    [selectedMonth, members, mealEntries, expenses, payments, guestMealRequests, customOtherPerMember]
  );

  const visibleCalcs = useMemo(() => {
    if (isManagerOrAdmin) return summary.memberCalculations;
    return summary.memberCalculations.filter(
      (c) => c.member.linkedUid === currentUser?.uid || c.member.id === currentUser?.memberId
    );
  }, [summary, isManagerOrAdmin, currentUser]);

  const handleGenerate = async () => {
    if (!actor) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await generateMonthlyBills(
        selectedMonth,
        customOtherPerMember !== '' ? Number(customOtherPerMember) : undefined,
        actor
      );
      setFeedback(
        lang === 'bn'
          ? `${formatMonthLabel(selectedMonth, lang)}-এর মাসিক বিল তৈরি ও সংরক্ষণ সম্পন্ন হয়েছে।`
          : `Monthly bills generated for ${selectedMonth}.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmClose = async () => {
    if (!actor || !confirmClose) return;
    setErrorMsg(null);
    try {
      await setMonthClosedStatus(selectedMonth, confirmClose === 'close', actor);
      setFeedback(
        confirmClose === 'close'
          ? lang === 'bn' ? 'মাসিক হিসাব সফলভাবে Close ও Lock করা হয়েছে।' : 'Month closed and locked.'
          : lang === 'bn' ? 'মাসিক হিসাব পুনরায় খোলা হয়েছে।' : 'Month reopened.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmClose(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.monthlyBill}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} ·{' '}
            {closingRecord?.isClosed
              ? lang === 'bn' ? 'হিসাব বন্ধ ও লক করা (Closed)' : 'Month Closed & Locked'
              : lang === 'bn' ? 'চলমান হিসাব (Open)' : 'Active Open Month'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />

          {isManagerOrAdmin && (
            <>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={closingRecord?.isClosed && !isAdmin}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Calculator className="w-4 h-4" />
                <span>{lang === 'bn' ? 'বিল তৈরি / আপডেট করুন' : 'Generate Monthly Bill'}</span>
              </button>

              {!closingRecord?.isClosed ? (
                <button
                  type="button"
                  onClick={() => setConfirmClose('close')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'মাস Close করুন' : 'Close Month'}</span>
                </button>
              ) : (
                isAdmin && (
                  <button
                    type="button"
                    onClick={() => setConfirmClose('reopen')}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'Admin আনলক' : 'Admin Unlock'}</span>
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setWaGroupOpen(true)}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'bn' ? 'WhatsApp রিমাইন্ডার / গ্রুপ' : 'WhatsApp Reminders'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Calculation Breakdown Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট বাজার খরচ' : 'Market Expense'}</div>
          <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white mt-1">
            {formatBDT(summary.totalMarketCost, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট মিল' : 'Total Meals'}</div>
          <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white mt-1">
            {formatNumber(summary.totalMeals, lang, 1)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'প্রতি মিলের মূল্য' : 'Meal Rate'}</div>
          <div className="text-lg font-bold font-mono-nums text-[#0F8B8D] dark:text-teal-300 mt-1">
            {formatBDT(summary.mealRate, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট অন্যান্য খরচ' : 'Other Expense'}</div>
          <div className="text-lg font-bold font-mono-nums text-amber-600 mt-1">
            {formatBDT(summary.totalOtherCost, lang)}
          </div>
        </Card>
        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'জনপ্রতি অন্যান্য চার্জ' : 'Other / Member'}</div>
          <div className="flex items-center gap-2 mt-1">
            {isManagerOrAdmin && !closingRecord?.isClosed ? (
              <input
                type="number"
                min="0"
                step="any"
                placeholder={String(summary.otherChargePerMember)}
                value={customOtherPerMember}
                onChange={(e) => setCustomOtherPerMember(e.target.value)}
                className="w-full px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-nums text-sm font-bold"
              />
            ) : (
              <div className="text-lg font-bold font-mono-nums text-slate-900 dark:text-white">
                {formatBDT(summary.otherChargePerMember, lang)}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Formula Note */}
      <Card className="p-4 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-4">
        <span>
          <strong>{lang === 'bn' ? 'মিল রেট:' : 'Meal Rate:'}</strong>{' '}
          {formatBDT(summary.totalMarketCost, lang)} ÷ {formatNumber(summary.totalMeals, lang, 1)} ={' '}
          <strong className="text-[#0F8B8D]">{formatBDT(summary.mealRate, lang)}</strong>
        </span>
        <span>·</span>
        <span>
          <strong>{lang === 'bn' ? 'মোট বিল ফর্মুলা:' : 'Bill Formula:'}</strong>{' '}
          {lang === 'bn' ? 'খাবারের খরচ + রুম ভাড়া + অন্যান্য চার্জ' : 'Food Cost + Room Rent + Other Charges'}
        </span>
      </Card>

      {/* Member Monthly Bill Statement Table */}
      <Card className="p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="text-left py-2.5">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'মিল' : 'Meals'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'খাবার বিল' : 'Food Cost'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'রুম ভাড়া' : 'Rent'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'অন্যান্য' : 'Other'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'অতিথি মিল' : 'Guest'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'জমা' : 'Paid'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'বকেয়া / অগ্রিম' : 'Due / Adv'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'WhatsApp / কপি' : 'WhatsApp / Copy'}</th>
              </tr>
            </thead>
            <tbody>
              {visibleCalcs.map((c) => (
                <tr key={c.member.id} className="border-b border-slate-100 dark:border-slate-800/70">
                  <td className="py-3 font-semibold text-slate-900 dark:text-white">
                    <div>{c.member.fullName}</div>
                    <div className="text-xs font-normal text-slate-400">{c.member.roomNumber}</div>
                  </td>
                  <td className="py-3 text-right font-mono-nums">{formatNumber(c.totalMeals, lang, 1)}</td>
                  <td className="py-3 text-right font-mono-nums">{formatBDT(c.foodCost, lang)}</td>
                  <td className="py-3 text-right font-mono-nums">{formatBDT(c.roomRent, lang)}</td>
                  <td className="py-3 text-right font-mono-nums">{formatBDT(c.otherCharges, lang)}</td>
                  <td className="py-3 text-right font-mono-nums">{formatBDT(c.guestMealCost, lang)}</td>
                  <td className="py-3 text-right font-bold font-mono-nums text-[#17365D] dark:text-sky-300">
                    {formatBDT(c.totalBill, lang)}
                  </td>
                  <td className="py-3 text-right font-mono-nums text-emerald-600 dark:text-emerald-400">
                    {formatBDT(c.totalPaid, lang)}
                  </td>
                  <td className="py-3 text-right font-bold font-mono-nums">
                    {c.advanceAmount > 0 ? (
                      <span className="text-[#0F8B8D] dark:text-teal-300">
                        {lang === 'bn' ? 'অগ্রিম ' : 'Adv '}
                        {formatBDT(c.advanceAmount, lang)}
                      </span>
                    ) : c.dueAmount > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{formatBDT(c.dueAmount, lang)}</span>
                    ) : (
                      <span className="text-emerald-600">৳ ০</span>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap pl-2">
                    <WhatsAppQuickButtons
                      calc={c}
                      monthKey={selectedMonth}
                      messName={settings?.messName}
                      contactNumber={settings?.contactNumber}
                      mode="bill"
                      lang={lang}
                      compact={false}
                      onPreview={(targetCalc, mode) => setWaMemberTarget({ calc: targetCalc, mode })}
                    />
                  </td>
                </tr>
              ))}
              {visibleCalcs.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmModal
        open={!!confirmClose}
        title={
          confirmClose === 'close'
            ? lang === 'bn' ? 'মাসিক হিসাব Close ও Lock করুন' : 'Close & Lock Month'
            : lang === 'bn' ? 'Admin আনলক নিশ্চিত করুন' : 'Reopen Closed Month'
        }
        message={
          confirmClose === 'close'
            ? lang === 'bn'
              ? 'মাস Close করলে এই মাসের মিল, খরচ ও বিল লক হয়ে যাবে। পরবর্তীতে পরিবর্তনের জন্য Admin অনুমতি লাগবে।'
              : 'Closing this month locks meals, expenses, and bills. Only Admin can reopen it.'
            : lang === 'bn'
              ? 'আপনি কি Admin হিসেবে এই বন্ধ মাসটি পুনরায় খুলতে চান? এটি Audit Log-এ সংরক্ষিত থাকবে।'
              : 'Reopen this closed month as Admin? This action is recorded in the audit log.'
        }
        confirmLabel={confirmClose === 'close' ? (lang === 'bn' ? 'Close করুন' : 'Close Month') : (lang === 'bn' ? 'আনলক করুন' : 'Reopen')}
        cancelLabel={t.cancel}
        danger={confirmClose === 'close'}
        onConfirm={handleConfirmClose}
        onCancel={() => setConfirmClose(null)}
      />

      <WhatsAppMemberModal
        open={!!waMemberTarget}
        onClose={() => setWaMemberTarget(null)}
        calc={waMemberTarget?.calc || null}
        monthKey={selectedMonth}
        messName={settings?.messName}
        contactNumber={settings?.contactNumber}
        initialMode={waMemberTarget?.mode || 'bill'}
        lang={lang}
      />

      <WhatsAppGroupSummaryModal
        open={waGroupOpen}
        onClose={() => setWaGroupOpen(false)}
        summary={summary}
        messName={settings?.messName}
        contactNumber={settings?.contactNumber}
        initialTab="group"
        initialOnlyDue={false}
        lang={lang}
      />
    </div>
  );
};
