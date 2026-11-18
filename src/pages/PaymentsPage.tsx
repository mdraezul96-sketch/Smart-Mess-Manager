import React, { useMemo, useState } from 'react';
import { Ban, Check, Copy, MessageCircle, Plus, Printer, Receipt } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, Modal, SelectField } from '../components/UI';
import {
  WhatsAppGroupSummaryModal,
  WhatsAppMemberModal,
  WhatsAppQuickButtons,
} from '../components/WhatsAppShareModal';
import { formatBDT, formatMonthLabel, PAYMENT_METHODS, TEXT } from '../i18n/translations';
import { savePayment, voidPayment } from '../services/messDataService';
import { Payment, PaymentMethod } from '../types/mess';
import {
  calculateMonthlySummary,
  getTodayDateStr,
  MemberMonthlyCalculation,
} from '../utils/calculations';
import {
  buildPaymentReceiptMessage,
  copyTextToClipboard,
  getWhatsAppUrl,
  WhatsAppMessageMode,
} from '../utils/whatsappShare';

export const PaymentsPage: React.FC = () => {
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
    settings,
  } = useMess();

  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [formOpen, setFormOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waMemberTarget, setWaMemberTarget] = useState<{
    calc: MemberMonthlyCalculation;
    mode: WhatsAppMessageMode;
  } | null>(null);
  const [waDueGroupOpen, setWaDueGroupOpen] = useState(false);
  const [receiptCopied, setReceiptCopied] = useState(false);

  const [memberId, setMemberId] = useState('');
  const [monthKey, setMonthKey] = useState(selectedMonth);
  const [paymentDate, setPaymentDate] = useState(getTodayDateStr);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const summary = useMemo(
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

  const visiblePayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.monthKey !== selectedMonth) return false;
      if (!isManagerOrAdmin) {
        return p.memberUid === currentUser?.uid || p.memberId === currentUser?.memberId;
      }
      return true;
    });
  }, [payments, selectedMonth, isManagerOrAdmin, currentUser]);

  const openAddPayment = (preselectedMemberId?: string) => {
    setErrorMsg(null);
    const active = members.filter((m) => m.status === 'active');
    setMemberId(preselectedMemberId || active[0]?.id || '');
    setMonthKey(selectedMonth);
    setPaymentDate(getTodayDateStr());
    setAmount('');
    setPaymentMethod('Cash');
    setTransactionId('');
    setNotes('');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    const numAmount = Number(amount);
    if (!memberId || !Number.isFinite(numAmount) || numAmount <= 0) {
      setErrorMsg(lang === 'bn' ? 'সদস্য ও সঠিক টাকার পরিমাণ লিখুন।' : 'Select member and valid positive amount.');
      return;
    }
    const m = members.find((mem) => mem.id === memberId);
    try {
      await savePayment(
        {
          memberId,
          memberUid: m?.linkedUid || '',
          memberName: m?.fullName || '',
          monthKey,
          paymentDate,
          amount: numAmount,
          paymentMethod,
          transactionId,
          notes,
        },
        actor
      );
      setFormOpen(false);
      if (monthKey && monthKey !== selectedMonth) {
        setSelectedMonth(monthKey);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVoid = async () => {
    if (!actor || !voidTarget) return;
    try {
      await voidPayment(voidTarget.id, 'ভুল এন্ট্রি বাতিল', actor);
      setVoidTarget(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setVoidTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.payments}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} · {lang === 'bn' ? 'Cash, bKash, Nagad, Rocket ও Bank Transfer' : 'Cash, bKash, Nagad, Rocket & Bank'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => openAddPayment()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'টাকা জমা নিন' : 'Record Payment'}</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Due & Advance Summary Strip */}
      {isManagerOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট আদায়কৃত জমা' : 'Total Collected'}</div>
            <div className="text-xl font-bold font-mono-nums text-emerald-600 dark:text-emerald-400 mt-1">
              {formatBDT(summary.totalDeposits, lang)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'সদস্যদের মোট বকেয়া' : 'Total Member Due'}</div>
            <div className="text-xl font-bold font-mono-nums text-rose-600 dark:text-rose-400 mt-1">
              {formatBDT(summary.totalDue, lang)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট অগ্রিম জমা' : 'Total Advance'}</div>
            <div className="text-xl font-bold font-mono-nums text-[#0F8B8D] dark:text-teal-300 mt-1">
              {formatBDT(summary.totalAdvance, lang)}
            </div>
          </Card>
        </div>
      )}

      {/* Member Due Status List (Manager/Admin) */}
      {isManagerOrAdmin && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'সদস্যভিত্তিক জমা ও বকেয়া তালিকা' : 'Member Deposit & Due Status'}
            </h3>
            <button
              type="button"
              onClick={() => setWaDueGroupOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'বকেয়া রিমাইন্ডার (WhatsApp)' : 'WhatsApp Due Reminders'}</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <th className="text-left py-2">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                  <th className="text-right py-2">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</th>
                  <th className="text-right py-2">{lang === 'bn' ? 'জমা' : 'Paid'}</th>
                  <th className="text-right py-2">{lang === 'bn' ? 'বকেয়া / অগ্রিম' : 'Due / Adv'}</th>
                  <th className="text-right py-2">{lang === 'bn' ? 'রিমাইন্ডার / জমা' : 'Remind / Pay'}</th>
                </tr>
              </thead>
              <tbody>
                {summary.memberCalculations.map((c) => (
                  <tr key={c.member.id} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{c.member.fullName}</td>
                    <td className="py-2.5 text-right font-mono-nums">{formatBDT(c.totalBill, lang)}</td>
                    <td className="py-2.5 text-right font-mono-nums text-emerald-600">{formatBDT(c.totalPaid, lang)}</td>
                    <td className="py-2.5 text-right font-mono-nums font-bold">
                      {c.advanceAmount > 0 ? (
                        <span className="text-[#0F8B8D]">+{formatBDT(c.advanceAmount, lang)}</span>
                      ) : c.dueAmount > 0 ? (
                        <span className="text-rose-600">{formatBDT(c.dueAmount, lang)}</span>
                      ) : (
                        <span className="text-emerald-600">৳ ০</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <WhatsAppQuickButtons
                          calc={c}
                          monthKey={selectedMonth}
                          messName={settings?.messName}
                          contactNumber={settings?.contactNumber}
                          mode={c.dueAmount > 0 ? 'due' : 'bill'}
                          lang={lang}
                          compact
                          onPreview={(targetCalc, mode) => setWaMemberTarget({ calc: targetCalc, mode })}
                        />
                        <button
                          type="button"
                          onClick={() => openAddPayment(c.member.id)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          +{lang === 'bn' ? 'জমা' : 'Pay'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Payment History Table */}
      <Card className="p-5 overflow-hidden">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'টাকা জমার ইতিহাস (রসিদসহ)' : 'Payment History'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="text-left py-2.5">{lang === 'bn' ? 'তারিখ ও রসিদ' : 'Date & Receipt'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'পদ্ধতি ও TrxID' : 'Method & TrxID'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'রসিদ / বাতিল' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {visiblePayments.map((p) => (
                <tr key={p.id} className={`border-b border-slate-100 dark:border-slate-800/70 ${p.isVoided ? 'opacity-50 line-through' : ''}`}>
                  <td className="py-3 text-xs font-mono-nums text-slate-500">
                    <div>{p.paymentDate}</div>
                    <div>{p.receiptNo}</div>
                  </td>
                  <td className="py-3 font-semibold text-slate-900 dark:text-white">{p.memberName}</td>
                  <td className="py-3 text-xs text-slate-600 dark:text-slate-300">
                    {p.paymentMethod} {p.transactionId ? `· ${p.transactionId}` : ''}
                  </td>
                  <td className="py-3 text-right font-bold font-mono-nums text-emerald-600 dark:text-emerald-400">
                    {formatBDT(p.amount, lang)}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setReceiptTarget(p)}
                        className="p-1.5 rounded-lg text-[#0F8B8D] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title={lang === 'bn' ? 'রসিদ দেখুন/প্রিন্ট' : 'Receipt'}
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                      {isManagerOrAdmin && !p.isVoided && (
                        <button
                          type="button"
                          onClick={() => setVoidTarget(p)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title={lang === 'bn' ? 'বাতিল (Void)' : 'Void'}
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visiblePayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Payment Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={lang === 'bn' ? 'নতুন টাকা জমা এন্ট্রি' : 'Record Member Deposit'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <SelectField
            label={lang === 'bn' ? 'সদস্য নির্বাচন করুন' : 'Member'}
            value={memberId}
            onChange={setMemberId}
            options={members
              .filter((m) => m.status === 'active')
              .map((m) => ({ value: m.id, label: `${m.fullName} (${m.roomNumber})` }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label={lang === 'bn' ? 'মাস' : 'Month'}
              type="month"
              value={monthKey}
              onChange={setMonthKey}
              required
            />
            <InputField
              label={lang === 'bn' ? 'জমার তারিখ' : 'Payment Date'}
              type="date"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label={lang === 'bn' ? 'জমার পরিমাণ (৳)' : 'Amount (৳)'}
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={setAmount}
              required
            />
            <SelectField
              label={lang === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
          </div>
          <InputField
            label={lang === 'bn' ? 'Transaction ID (ঐচ্ছিক)' : 'Transaction ID (Optional)'}
            value={transactionId}
            onChange={setTransactionId}
          />
          <InputField
            label={lang === 'bn' ? 'মন্তব্য' : 'Notes'}
            value={notes}
            onChange={setNotes}
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer"
            >
              {t.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Payment Receipt Modal */}
      <Modal
        open={!!receiptTarget}
        onClose={() => setReceiptTarget(null)}
        title={lang === 'bn' ? 'পেমেন্ট রসিদ (Money Receipt)' : 'Payment Receipt'}
      >
        {receiptTarget && (
          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="text-base font-bold text-[#17365D] dark:text-white">
                    {settings?.messName || 'Smart Mess Manager'}
                  </h4>
                  <p className="text-xs text-slate-500">{settings?.messAddress || 'বাংলাদেশ'}</p>
                </div>
                <div className="text-right text-xs font-mono-nums">
                  <div className="font-bold">{receiptTarget.receiptNo}</div>
                  <div className="text-slate-400">{receiptTarget.paymentDate}</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'সদস্যের নাম:' : 'Member:'}</span>
                  <span className="font-semibold">{receiptTarget.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'মাস:' : 'Month:'}</span>
                  <span>{formatMonthLabel(receiptTarget.monthKey, lang)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'bn' ? 'মাধ্যম:' : 'Method:'}</span>
                  <span>{receiptTarget.paymentMethod} {receiptTarget.transactionId ? `(${receiptTarget.transactionId})` : ''}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-base font-bold">
                  <span>{lang === 'bn' ? 'মোট জমা:' : 'Amount Paid:'}</span>
                  <span className="font-mono-nums text-emerald-600">{formatBDT(receiptTarget.amount, lang)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 no-print">
              <button
                type="button"
                onClick={async () => {
                  const text = buildPaymentReceiptMessage({
                    payment: receiptTarget,
                    messName: settings?.messName,
                    lang,
                  });
                  const ok = await copyTextToClipboard(text);
                  if (ok) {
                    setReceiptCopied(true);
                    window.setTimeout(() => setReceiptCopied(false), 1800);
                  }
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {receiptCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{receiptCopied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'রসিদ কপি' : 'Copy'}</span>
              </button>
              <a
                href={getWhatsAppUrl(
                  members.find((m) => m.id === receiptTarget.memberId)?.mobile,
                  buildPaymentReceiptMessage({
                    payment: receiptTarget,
                    messName: settings?.messName,
                    lang,
                  })
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{lang === 'bn' ? 'WhatsApp রসিদ' : 'WhatsApp'}</span>
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#17365D] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'bn' ? 'প্রিন্ট করুন' : 'Print Receipt'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!voidTarget}
        title={lang === 'bn' ? 'পেমেন্ট বাতিল (Void) করুন' : 'Void Payment'}
        message={
          lang === 'bn'
            ? `"${voidTarget?.memberName}"-এর ৳${voidTarget?.amount} পেমেন্টটি বাতিল (Void) হিসেবে চিহ্নিত করতে চান?`
            : `Mark payment of ৳${voidTarget?.amount} for "${voidTarget?.memberName}" as Void?`
        }
        confirmLabel={lang === 'bn' ? 'বাতিল নিশ্চিত করুন' : 'Confirm Void'}
        cancelLabel={t.cancel}
        danger
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
      />

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
        open={waDueGroupOpen}
        onClose={() => setWaDueGroupOpen(false)}
        summary={summary}
        messName={settings?.messName}
        contactNumber={settings?.contactNumber}
        initialTab="individual"
        initialOnlyDue={true}
        lang={lang}
      />
    </div>
  );
};
