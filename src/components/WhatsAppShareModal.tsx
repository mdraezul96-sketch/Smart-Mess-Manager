import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  MessageCircle,
  Send,
  Users,
} from 'lucide-react';
import { formatBDT, formatMonthLabel, formatNumber } from '../i18n/translations';
import { Language } from '../types/mess';
import { MemberMonthlyCalculation, MonthlySummaryCalculation } from '../utils/calculations';
import {
  buildGroupBillSummaryMessage,
  buildMemberBillMessage,
  copyTextToClipboard,
  getWhatsAppUrl,
  normalizeWhatsAppPhone,
  WhatsAppMessageMode,
} from '../utils/whatsappShare';
import { Modal } from './UI';

const PAYMENT_NOTE_STORAGE_KEY = 'smm_wa_payment_note';

export function useSavedPaymentNote(): [string, (val: string) => void] {
  const [note, setNoteState] = useState<string>(() => {
    try {
      return localStorage.getItem(PAYMENT_NOTE_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const setNote = (val: string) => {
    setNoteState(val);
    try {
      localStorage.setItem(PAYMENT_NOTE_STORAGE_KEY, val);
    } catch {
      // Ignore storage quota errors
    }
  };

  return [note, setNote];
}

export const WhatsAppQuickButtons: React.FC<{
  calc: MemberMonthlyCalculation;
  monthKey: string;
  messName?: string;
  contactNumber?: string;
  mode?: WhatsAppMessageMode;
  lang: Language;
  compact?: boolean;
  onPreview?: (calc: MemberMonthlyCalculation, mode: WhatsAppMessageMode) => void;
}> = ({
  calc,
  monthKey,
  messName,
  contactNumber,
  mode = 'bill',
  lang,
  compact = false,
  onPreview,
}) => {
  const [copied, setCopied] = useState(false);
  const [paymentNote] = useSavedPaymentNote();

  const message = useMemo(
    () =>
      buildMemberBillMessage({
        calc,
        monthKey,
        messName,
        contactNumber,
        paymentNote,
        mode,
        lang,
      }),
    [calc, monthKey, messName, contactNumber, paymentNote, mode, lang]
  );

  const waUrl = useMemo(
    () => getWhatsAppUrl(calc.member.mobile, message),
    [calc.member.mobile, message]
  );

  const hasValidPhone = Boolean(normalizeWhatsAppPhone(calc.member.mobile));

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(message);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={
          hasValidPhone
            ? lang === 'bn'
              ? `${calc.member.fullName}-কে সরাসরি WhatsApp করুন`
              : `Send WhatsApp to ${calc.member.fullName}`
            : lang === 'bn'
              ? 'সদস্যের মোবাইল নম্বর নেই — WhatsApp খুলে প্রাপক বাছাই করুন'
              : 'No phone saved — open WhatsApp to pick contact'
        }
        className={`inline-flex items-center gap-1 rounded-lg font-semibold transition-colors ${
          compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
        } bg-[#25D366]/15 hover:bg-[#25D366]/25 text-emerald-700 dark:text-emerald-300`}
      >
        <MessageCircle className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        {!compact && <span>WhatsApp</span>}
      </a>

      <button
        type="button"
        onClick={handleCopy}
        title={lang === 'bn' ? 'মেসেজ কপি করুন' : 'Copy message'}
        className={`inline-flex items-center gap-1 rounded-lg font-medium transition-colors cursor-pointer ${
          compact ? 'p-1.5 text-[11px]' : 'px-2 py-1.5 text-xs'
        } ${
          copied
            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
        }`}
      >
        {copied ? (
          <Check className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        ) : (
          <Copy className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        )}
        {!compact && (
          <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : lang === 'bn' ? 'কপি' : 'Copy'}</span>
        )}
      </button>

      {onPreview && (
        <button
          type="button"
          onClick={() => onPreview(calc, mode)}
          title={lang === 'bn' ? 'মেসেজ প্রিভিউ ও কাস্টমাইজ' : 'Preview & customize message'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-[#17365D] dark:text-slate-400 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export const WhatsAppMemberModal: React.FC<{
  open: boolean;
  onClose: () => void;
  calc: MemberMonthlyCalculation | null;
  monthKey: string;
  messName?: string;
  contactNumber?: string;
  initialMode?: WhatsAppMessageMode;
  lang: Language;
}> = ({
  open,
  onClose,
  calc,
  monthKey,
  messName,
  contactNumber,
  initialMode = 'bill',
  lang,
}) => {
  const [mode, setMode] = useState<WhatsAppMessageMode>(initialMode);
  const [paymentNote, setPaymentNote] = useSavedPaymentNote();
  const [draftText, setDraftText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, calc?.member.id]);

  useEffect(() => {
    if (!calc) return;
    setDraftText(
      buildMemberBillMessage({
        calc,
        monthKey,
        messName,
        contactNumber,
        paymentNote,
        mode,
        lang,
      })
    );
  }, [calc, monthKey, messName, contactNumber, paymentNote, mode, lang]);

  if (!calc) return null;

  const hasValidPhone = Boolean(normalizeWhatsAppPhone(calc.member.mobile));
  const waUrl = getWhatsAppUrl(calc.member.mobile, draftText);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(draftText);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        lang === 'bn'
          ? `WhatsApp বিল ও রিমাইন্ডার — ${calc.member.fullName}`
          : `WhatsApp Bill & Reminder — ${calc.member.fullName}`
      }
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Template Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('bill')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'bill'
                ? 'bg-white dark:bg-slate-900 text-[#17365D] dark:text-sky-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'bn' ? 'পূর্ণাঙ্গ মাসিক বিল' : 'Full Bill Summary'}
          </button>
          <button
            type="button"
            onClick={() => setMode('due')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'due'
                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'bn' ? 'বকেয়া তাগাদা রিমাইন্ডার' : 'Due Payment Reminder'}
          </button>
        </div>

        {/* Phone Status */}
        <div className="text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
          <span className="text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'প্রাপকের মোবাইল:' : 'Member Mobile:'}
          </span>
          {hasValidPhone ? (
            <span className="font-mono-nums font-semibold text-emerald-600 dark:text-emerald-400">
              {calc.member.mobile} (সরাসরি চ্যাট খুলবে)
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {lang === 'bn'
                ? 'নম্বর নেই — WhatsApp খুলে প্রাপক বেছে নিতে পারবেন'
                : 'No phone saved — pick contact in WhatsApp'}
            </span>
          )}
        </div>

        {/* Payment Instruction */}
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? 'পেমেন্ট তথ্য / বিকাশ-নগদ নম্বর (ঐচ্ছিক, সংরক্ষিত থাকবে)'
              : 'Payment Note / bKash-Nagad Number (Optional)'}
          </span>
          <input
            type="text"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'যেমন: bKash/Nagad 017XXXXXXXX (Send Money)'
                : 'e.g. bKash/Nagad 017XXXXXXXX'
            }
            className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40"
          />
        </label>

        {/* Editable Message Preview */}
        <label className="block space-y-1">
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            {lang === 'bn' ? 'মেসেজ প্রিভিউ (প্রয়োজনে এডিট করুন)' : 'Message Preview (Editable)'}
          </span>
          <textarea
            rows={10}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : lang === 'bn' ? 'মেসেজ কপি করুন' : 'Copy Message'}</span>
          </button>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>{lang === 'bn' ? 'WhatsApp-এ পাঠান' : 'Send on WhatsApp'}</span>
          </a>
        </div>
      </div>
    </Modal>
  );
};

export const WhatsAppGroupSummaryModal: React.FC<{
  open: boolean;
  onClose: () => void;
  summary: MonthlySummaryCalculation;
  messName?: string;
  contactNumber?: string;
  initialTab?: 'group' | 'individual';
  initialOnlyDue?: boolean;
  lang: Language;
}> = ({
  open,
  onClose,
  summary,
  messName,
  contactNumber,
  initialTab = 'individual',
  initialOnlyDue = true,
  lang,
}) => {
  const [tab, setTab] = useState<'group' | 'individual'>(initialTab);
  const [onlyDue, setOnlyDue] = useState<boolean>(initialOnlyDue);
  const [paymentNote, setPaymentNote] = useSavedPaymentNote();
  const [groupDraft, setGroupDraft] = useState('');
  const [groupCopied, setGroupCopied] = useState(false);
  const [sentMemberIds, setSentMemberIds] = useState<Record<string, boolean>>({});
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setOnlyDue(initialOnlyDue);
    }
  }, [open, initialTab, initialOnlyDue]);

  useEffect(() => {
    setGroupDraft(
      buildGroupBillSummaryMessage({
        summary,
        messName,
        contactNumber,
        paymentNote,
        onlyDue,
        lang,
      })
    );
  }, [summary, messName, contactNumber, paymentNote, onlyDue, lang]);

  const filteredMembers = useMemo(
    () =>
      onlyDue
        ? summary.memberCalculations.filter((c) => c.dueAmount > 0)
        : summary.memberCalculations,
    [summary.memberCalculations, onlyDue]
  );

  const dueCount = useMemo(
    () => summary.memberCalculations.filter((c) => c.dueAmount > 0).length,
    [summary.memberCalculations]
  );

  const handleCopyGroup = async () => {
    const ok = await copyTextToClipboard(groupDraft);
    if (ok) {
      setGroupCopied(true);
      window.setTimeout(() => setGroupCopied(false), 2000);
    }
  };

  const handleCopyMember = async (calc: MemberMonthlyCalculation) => {
    const text = buildMemberBillMessage({
      calc,
      monthKey: summary.monthKey,
      messName,
      contactNumber,
      paymentNote,
      mode: calc.dueAmount > 0 ? 'due' : 'bill',
      lang,
    });
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedMemberId(calc.member.id);
      window.setTimeout(() => setCopiedMemberId(null), 1800);
    }
  };

  const markSent = (memberId: string) => {
    setSentMemberIds((prev) => ({ ...prev, [memberId]: true }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        lang === 'bn'
          ? `WhatsApp বিল ও বকেয়া রিমাইন্ডার (${formatMonthLabel(summary.monthKey, lang)})`
          : `WhatsApp Bill & Due Reminders (${formatMonthLabel(summary.monthKey, lang)})`
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Top Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'individual'
                ? 'bg-white dark:bg-slate-900 text-[#17365D] dark:text-sky-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>
              {lang === 'bn'
                ? `সদস্যভিত্তিক রিমাইন্ডার (${formatNumber(dueCount, lang)} বকেয়া)`
                : `1-Click Member List (${dueCount} due)`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              tab === 'group'
                ? 'bg-white dark:bg-slate-900 text-[#17365D] dark:text-sky-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{lang === 'bn' ? 'মেস গ্রুপ সারাংশ (সব একসাথে)' : 'Group Summary Message'}</span>
          </button>
        </div>

        {/* Shared Filter & Payment Instruction */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'বিকাশ / নগদ / পেমেন্ট নোট' : 'Payment Note (bKash / Nagad)'}
            </span>
            <input
              type="text"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder={lang === 'bn' ? 'যেমন: bKash 017XXXXXXXX' : 'e.g. bKash 017XXXXXXXX'}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
            />
          </label>

          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setOnlyDue(true)}
              className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer ${
                onlyDue
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'bn' ? 'শুধু বকেয়া' : 'Due Only'}
            </button>
            <button
              type="button"
              onClick={() => setOnlyDue(false)}
              className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-medium cursor-pointer ${
                !onlyDue
                  ? 'bg-white dark:bg-slate-900 text-[#17365D] dark:text-sky-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'bn' ? 'সকল সদস্য' : 'All Members'}
            </button>
          </div>
        </div>

        {tab === 'individual' ? (
          <div className="space-y-2.5 max-h-[52vh] overflow-y-auto pr-1">
            {filteredMembers.length > 0 ? (
              filteredMembers.map((c) => {
                const mode: WhatsAppMessageMode = c.dueAmount > 0 ? 'due' : 'bill';
                const msg = buildMemberBillMessage({
                  calc: c,
                  monthKey: summary.monthKey,
                  messName,
                  contactNumber,
                  paymentNote,
                  mode,
                  lang,
                });
                const waUrl = getWhatsAppUrl(c.member.mobile, msg);
                const hasPhone = Boolean(normalizeWhatsAppPhone(c.member.mobile));
                const isSent = Boolean(sentMemberIds[c.member.id]);
                const isCopied = copiedMemberId === c.member.id;

                return (
                  <div
                    key={c.member.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {c.member.fullName}
                        </span>
                        <span className="text-[11px] text-slate-400">{c.member.roomNumber}</span>
                        {isSent && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            {lang === 'bn' ? 'ক্লিক হয়েছে' : 'Opened'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono-nums">
                        <span>
                          {lang === 'bn' ? 'বিল:' : 'Bill:'} {formatBDT(c.totalBill, lang)}
                        </span>
                        <span>
                          {lang === 'bn' ? 'জমা:' : 'Paid:'} {formatBDT(c.totalPaid, lang)}
                        </span>
                        <span
                          className={`font-bold ${
                            c.dueAmount > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {c.dueAmount > 0
                            ? `${lang === 'bn' ? 'বকেয়া:' : 'Due:'} ${formatBDT(c.dueAmount, lang)}`
                            : c.advanceAmount > 0
                              ? `${lang === 'bn' ? 'অগ্রিম:' : 'Adv:'} ${formatBDT(c.advanceAmount, lang)}`
                              : lang === 'bn'
                                ? 'পরিশোধিত'
                                : 'Paid'}
                        </span>
                      </div>
                      {!hasPhone && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                          {lang === 'bn'
                            ? 'মোবাইল নম্বর যোগ করা নেই (WhatsApp থেকে প্রাপক বেছে নিতে হবে)'
                            : 'No mobile number saved'}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyMember(c)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{isCopied ? (lang === 'bn' ? 'কপি' : 'Copied') : lang === 'bn' ? 'কপি' : 'Copy'}</span>
                      </button>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSent(c.member.id)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'WhatsApp' : 'WhatsApp'}</span>
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                {onlyDue
                  ? lang === 'bn'
                    ? 'এই মাসে কোনো সদস্যের বকেয়া নেই! "সকল সদস্য" বেছে নিয়ে সবার বিলের মেসেজ পাঠাতে পারেন।'
                    : 'No members have pending dues! Switch to All Members to share statements.'
                  : lang === 'bn'
                    ? 'কোনো সদস্য পাওয়া যায়নি।'
                    : 'No members found.'}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={11}
              value={groupDraft}
              onChange={(e) => setGroupDraft(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40"
            />

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCopyGroup}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                {groupCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>
                  {groupCopied
                    ? lang === 'bn'
                      ? 'গ্রুপ মেসেজ কপি হয়েছে!'
                      : 'Group Summary Copied!'
                    : lang === 'bn'
                      ? 'সম্পূর্ণ তালিকা কপি করুন'
                      : 'Copy Group Summary'}
                </span>
              </button>

              <a
                href={getWhatsAppUrl(null, groupDraft)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>{lang === 'bn' ? 'WhatsApp গ্রুপে শেয়ার করুন' : 'Share to WhatsApp Group'}</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
