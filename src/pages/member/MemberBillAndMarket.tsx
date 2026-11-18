import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, FileDown, MessageCircle, MessageSquareWarning, Search, ShoppingBasket } from 'lucide-react';
import { useMess } from '../../context/MessContext';
import { Card, Modal } from '../../components/UI';
import { formatBDT, formatMonthLabel, formatNumber } from '../../i18n/translations';
import { exportToPDF } from '../../services/exportService';
import { MemberPageId } from '../../types/mess';
import { calculateMonthlySummary, round2 } from '../../utils/calculations';
import { buildMemberBillMessage, copyTextToClipboard, getWhatsAppUrl } from '../../utils/whatsappShare';

export const MemberBillPage: React.FC<{
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
    settings,
    selectedMonth,
    setSelectedMonth,
    lang,
  } = useMess();
  const [billCopied, setBillCopied] = useState(false);

  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const selectedClosing = useMemo(
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
        savedBills: monthlyBills,
        closing: selectedClosing,
        useClosingRates: true,
      }),
    [selectedMonth, members, mealEntries, expenses, payments, guestMealRequests, monthlyBills, selectedClosing]
  );

  const ownCalc = useMemo(
    () => summary.memberCalculations.find((c) => c.member.id === ownMember?.id),
    [summary, ownMember]
  );

  const ownPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          !p.isVoided &&
          p.monthKey === selectedMonth &&
          (p.memberId === ownMember?.id || p.memberUid === currentUser?.uid)
      ),
    [payments, selectedMonth, ownMember, currentUser]
  );

  const pastBills = useMemo(
    () =>
      monthlyBills
        .filter((b) => b.memberId === ownMember?.id || b.memberUid === currentUser?.uid)
        .sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
    [monthlyBills, ownMember, currentUser]
  );

  const handleDownloadPDF = () => {
    if (!ownCalc) return;
    exportToPDF(
      `my-mess-bill-${selectedMonth}`,
      `Monthly Bill Statement - ${ownCalc.member.fullName}`,
      `Month: ${selectedMonth} | Room: ${ownCalc.member.roomNumber}`,
      [
        { header: 'Item', key: 'item' },
        { header: 'Details', key: 'detail' },
        { header: 'Amount (BDT)', key: 'amount' },
      ],
      [
        { item: 'Total Meals', detail: `${ownCalc.totalMeals} meals x BDT ${ownCalc.mealRate}`, amount: ownCalc.foodCost },
        { item: 'Room Rent', detail: ownCalc.member.roomNumber, amount: ownCalc.roomRent },
        { item: 'Other Charges', detail: 'Utilities / Shared', amount: ownCalc.otherCharges },
        { item: 'Guest Meal Cost', detail: 'Approved Guest Meals', amount: ownCalc.guestMealCost },
        { item: 'Total Monthly Bill', detail: 'Sum of all charges', amount: ownCalc.totalBill },
        { item: 'Total Paid', detail: `${ownPayments.length} approved payments`, amount: ownCalc.totalPaid },
        {
          item: ownCalc.advanceAmount > 0 ? 'Advance Balance' : 'Remaining Due',
          detail: selectedMonth,
          amount: ownCalc.advanceAmount > 0 ? ownCalc.advanceAmount : ownCalc.dueAmount,
        },
      ],
      [
        `Member: ${ownCalc.member.fullName}`,
        `Meal Rate: BDT ${ownCalc.mealRate} | Total Bill: BDT ${ownCalc.totalBill} | Paid: BDT ${ownCalc.totalPaid}`,
      ]
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'আমার বিল ও হিসাব' : 'My Bill & Account'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} · {lang === 'bn' ? 'শুধুমাত্র আপনার ব্যক্তিগত হিসাব' : 'Strictly your personal billing statement'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          {ownCalc && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const text = buildMemberBillMessage({
                    calc: ownCalc,
                    monthKey: selectedMonth,
                    messName: settings?.messName,
                    contactNumber: settings?.contactNumber,
                    mode: 'bill',
                    lang,
                  });
                  const ok = await copyTextToClipboard(text);
                  if (ok) {
                    setBillCopied(true);
                    window.setTimeout(() => setBillCopied(false), 1800);
                  }
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {billCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{billCopied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'বিল কপি' : 'Copy Bill'}</span>
              </button>
              <a
                href={getWhatsAppUrl(
                  null,
                  buildMemberBillMessage({
                    calc: ownCalc,
                    monthKey: selectedMonth,
                    messName: settings?.messName,
                    contactNumber: settings?.contactNumber,
                    mode: 'bill',
                    lang,
                  })
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'bn' ? 'WhatsApp শেয়ার' : 'Share'}</span>
              </a>
              <button
                type="button"
                onClick={handleDownloadPDF}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>{lang === 'bn' ? 'PDF বিল ডাউনলোড' : 'Download PDF Bill'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {ownCalc ? (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{ownCalc.member.fullName}</div>
              <div className="text-xs text-slate-500">
                {ownCalc.member.roomNumber}
                {ownCalc.member.seatNumber ? ` · ${ownCalc.member.seatNumber}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">
                {ownCalc.advanceAmount > 0
                  ? lang === 'bn'
                    ? 'অগ্রিম ব্যালেন্স'
                    : 'Advance'
                  : lang === 'bn'
                    ? 'মোট বকেয়া'
                    : 'Due Amount'}
              </div>
              <div
                className={`text-xl font-bold font-mono-nums ${
                  ownCalc.dueAmount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {ownCalc.advanceAmount > 0
                  ? formatBDT(ownCalc.advanceAmount, lang)
                  : formatBDT(ownCalc.dueAmount, lang)}
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'মোট মিল' : 'Total Meals'}</span>
              <span className="font-bold font-mono-nums">{formatNumber(ownCalc.totalMeals, lang, 1)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'চলতি মিল রেট' : 'Meal Rate'}</span>
              <span className="font-bold font-mono-nums">{formatBDT(ownCalc.mealRate, lang)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'মিলের খরচ (মিল × রেট)' : 'Food Cost'}</span>
              <span className="font-bold font-mono-nums">{formatBDT(ownCalc.foodCost, lang)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'সিট / রুম ভাড়া' : 'Room Rent'}</span>
              <span className="font-bold font-mono-nums">{formatBDT(ownCalc.roomRent, lang)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'অন্যান্য চার্জ' : 'Other Charges'}</span>
              <span className="font-bold font-mono-nums">{formatBDT(ownCalc.otherCharges, lang)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">{lang === 'bn' ? 'গেস্ট মিল চার্জ (অনুমোদিত)' : 'Guest Meal Cost'}</span>
              <span className="font-bold font-mono-nums">{formatBDT(ownCalc.guestMealCost, lang)}</span>
            </div>
            <div className="py-3 flex justify-between text-base font-bold text-[#17365D] dark:text-sky-300">
              <span>{lang === 'bn' ? 'সর্বমোট বিল' : 'Total Bill'}</span>
              <span className="font-mono-nums">{formatBDT(ownCalc.totalBill, lang)}</span>
            </div>
            <div className="py-2.5 flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>{lang === 'bn' ? 'মোট জমা টাকা' : 'Total Paid'}</span>
              <span className="font-mono-nums">{formatBDT(ownCalc.totalPaid, lang)}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('payment-request')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0d787a] text-white text-xs font-semibold cursor-pointer"
            >
              {lang === 'bn' ? 'টাকা জমার আবেদন পাঠান' : 'Submit Payment Request'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('complaints')}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 hover:underline cursor-pointer"
            >
              <MessageSquareWarning className="w-4 h-4" />
              <span>{lang === 'bn' ? 'হিসাবে কোনো সমস্যা? অভিযোগ করুন' : 'Report a billing issue'}</span>
            </button>
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-sm text-slate-500">
          {lang === 'bn' ? 'এই মাসের ব্যক্তিগত বিলের তথ্য পাওয়া যায়নি।' : 'No personal billing statement found for this month.'}
        </Card>
      )}

      {/* Approved Payment List */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'এই মাসের অনুমোদিত পেমেন্ট তালিকা' : 'Approved Payments This Month'}
        </h3>
        {ownPayments.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ownPayments.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {p.paymentMethod} · <span className="font-mono-nums">{p.receiptNo}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {p.paymentDate}
                    {p.transactionId ? ` · TrxID: ${p.transactionId}` : ''}
                  </div>
                </div>
                <div className="font-bold font-mono-nums text-emerald-600 dark:text-emerald-400">
                  +{formatBDT(p.amount, lang)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">
            {lang === 'bn' ? 'এই মাসে এখনো কোনো অনুমোদিত পেমেন্ট নেই।' : 'No approved payments for this month yet.'}
          </p>
        )}
      </Card>

      {/* Past Months Generated Bills */}
      {pastBills.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            {lang === 'bn' ? 'আগের মাসের বিলের তালিকা' : 'Published Monthly Bills History'}
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
            {pastBills.map((b) => (
              <div key={b.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{formatMonthLabel(b.monthKey, lang)}</div>
                  <div className="text-xs text-slate-400 font-mono-nums">
                    {lang === 'bn' ? 'মিল' : 'Meals'}: {formatNumber(b.totalMeals, lang, 1)} · {lang === 'bn' ? 'জমা' : 'Paid'}: {formatBDT(b.totalPaid, lang)}
                  </div>
                </div>
                <div className="text-right font-mono-nums">
                  <div className="font-bold text-[#17365D] dark:text-sky-300">{formatBDT(b.totalBill, lang)}</div>
                  <div className={`text-xs ${b.dueAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {b.dueAmount > 0 ? `${lang === 'bn' ? 'বকেয়া' : 'Due'} ${formatBDT(b.dueAmount, lang)}` : lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export const MemberMarketViewPage: React.FC = () => {
  const { expenses, selectedMonth, setSelectedMonth, lang } = useMess();
  const [search, setSearch] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  const marketList = useMemo(() => {
    return expenses.filter((e) => {
      if (e.isVoided || e.expenseGroup !== 'market' || e.monthKey !== selectedMonth) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.itemName.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.shopperName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, selectedMonth, search]);

  const monthTotal = useMemo(
    () =>
      round2(
        expenses
          .filter((e) => !e.isVoided && e.expenseGroup === 'market' && e.monthKey === selectedMonth)
          .reduce((s, e) => s + Number(e.amount || 0), 0)
      ),
    [expenses, selectedMonth]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBasket className="w-5 h-5 text-[#0F8B8D]" />
            <span>{lang === 'bn' ? 'মেসের বাজার খরচ (স্বচ্ছ হিসাব)' : 'Mess Market Expenses'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} · {lang === 'bn' ? 'মোট বাজার:' : 'Monthly Total:'}{' '}
            <strong className="text-[#17365D] dark:text-sky-300 font-mono-nums">{formatBDT(monthTotal, lang)}</strong>
          </p>
        </div>

        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'bn' ? 'বাজারের পণ্য বা বাজারকারীর নাম খুঁজুন...' : 'Search item or shopper...'}
            className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
        </div>
      </Card>

      <Card className="p-5">
        {marketList.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {marketList.map((e) => (
              <div key={e.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{e.itemName}</div>
                  <div className="text-xs text-slate-400">
                    {e.date} · {e.category}
                    {e.quantity ? ` · ${e.quantity} ${e.unit || ''}` : ''}
                    {e.shopperName ? ` · ${lang === 'bn' ? 'বাজারকারী:' : 'By:'} ${e.shopperName}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.receiptUrl && (
                    <button
                      type="button"
                      onClick={() => setReceiptPreview(e.receiptUrl!)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[#0F8B8D] cursor-pointer"
                      title={lang === 'bn' ? 'রসিদ দেখুন' : 'View Receipt'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <span className="font-bold font-mono-nums text-rose-600 dark:text-rose-400 text-sm">
                    {formatBDT(e.amount, lang)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-6 text-center">
            {lang === 'bn' ? 'এই মাসে কোনো বাজার খরচ পাওয়া যায়নি।' : 'No market expenses recorded this month.'}
          </p>
        )}
      </Card>

      <Modal
        open={!!receiptPreview}
        onClose={() => setReceiptPreview(null)}
        title={lang === 'bn' ? 'বাজারের রসিদ' : 'Market Receipt'}
      >
        {receiptPreview && (
          <img
            src={receiptPreview}
            alt="Market Receipt"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
          />
        )}
      </Modal>
    </div>
  );
};
