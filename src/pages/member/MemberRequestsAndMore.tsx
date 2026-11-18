import React, { useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  Eye,
  LogOut,
  MessageSquarePlus,
  ShoppingBasket,
  User,
  UserPlus,
  Vote,
} from 'lucide-react';
import { useMess } from '../../context/MessContext';
import { Card, InputField, Modal, SelectField } from '../../components/UI';
import {
  COMPLAINT_CATEGORIES,
  formatBDT,
  formatNumber,
  PAYMENT_METHODS,
} from '../../i18n/translations';
import {
  markAllNotificationsRead,
  markNotificationRead,
  submitComplaint,
  submitGuestMealRequest,
  submitMenuVote,
  submitPaymentRequest,
} from '../../services/messDataService';
import { MemberPageId, PaymentMethod } from '../../types/mess';
import { compressImageToDataUrl, getTodayDateStr, round2 } from '../../utils/calculations';

// ------------------------------------------------------------------
// 1. Payment Request Page (Balance does NOT update until approved)
// ------------------------------------------------------------------
export const MemberPaymentRequestPage: React.FC = () => {
  const { actor, currentUser, members, paymentRequests, lang } = useMess();
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayDateStr);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [transactionId, setTransactionId] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const ownRequests = useMemo(
    () => paymentRequests.filter((r) => r.memberUid === currentUser?.uid || r.memberId === ownMember?.id),
    [paymentRequests, currentUser, ownMember]
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressImageToDataUrl(file);
      setReceiptImageUrl(url);
    } catch {
      setErrorMsg(lang === 'bn' ? 'ছবি প্রসেস করা যায়নি।' : 'Failed to process image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !ownMember) {
      setErrorMsg(lang === 'bn' ? 'আপনার সদস্য প্রোফাইল লিংক করা নেই।' : 'Member profile not linked.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await submitPaymentRequest(
        {
          member: ownMember,
          amount: Number(amount),
          paymentDate,
          paymentMethod,
          transactionId,
          receiptImageUrl,
          notes,
        },
        actor
      );
      setAmount('');
      setTransactionId('');
      setReceiptImageUrl('');
      setNotes('');
      setFeedback(
        lang === 'bn'
          ? 'পেমেন্ট আবেদন পাঠানো হয়েছে। মালিক/ম্যানেজার অনুমোদন করলে আপনার ব্যালেন্স আপডেট হবে।'
          : 'Payment request submitted. Balance will update once Owner/Manager approves.'
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
          {lang === 'bn' ? 'টাকা জমার আবেদন' : 'Payment Request'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'বিকাশ, নগদ, রকেট, ব্যাংক বা ক্যাশ জমা দেওয়ার পর প্রমাণসহ আবেদন পাঠান। অনুমোদনের পর ব্যালেন্স যুক্ত হবে।'
            : 'Submit payment proof after paying. Your balance updates only after Owner/Manager approval.'}
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <InputField
              label={lang === 'bn' ? 'টাকার পরিমাণ (৳)' : 'Amount (BDT)'}
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={setAmount}
              required
              placeholder="যেমন: 3500"
            />
            <InputField
              label={lang === 'bn' ? 'জমার তারিখ' : 'Payment Date'}
              type="date"
              value={paymentDate}
              onChange={setPaymentDate}
              required
            />
            <SelectField
              label={lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
            <InputField
              label={lang === 'bn' ? 'Transaction ID (প্রযোজ্য ক্ষেত্রে)' : 'Transaction ID (if applicable)'}
              value={transactionId}
              onChange={setTransactionId}
              placeholder="যেমন: BKA8X91P20"
            />
          </div>

          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'পেমেন্টের স্ক্রিনশট বা রসিদের ছবি (ঐচ্ছিক)' : 'Payment Screenshot / Receipt (Optional)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800"
            />
            {receiptImageUrl && (
              <div className="text-xs text-emerald-600 mt-1">
                {lang === 'bn' ? 'ছবি সংযুক্ত করা হয়েছে।' : 'Receipt attached.'}
              </div>
            )}
          </label>

          <InputField
            label={lang === 'bn' ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'}
            value={notes}
            onChange={setNotes}
            placeholder={lang === 'bn' ? 'যেমন: মে মাসের মিল ও রুম ভাড়া' : 'e.g., Monthly meal & rent'}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || !ownMember}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? lang === 'bn'
                  ? 'পাঠানো হচ্ছে...'
                  : 'Submitting...'
                : lang === 'bn'
                  ? 'পেমেন্ট আবেদন পাঠান'
                  : 'Submit Payment Request'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'আমার পেমেন্ট আবেদনের ইতিহাস' : 'My Payment Request History'}
        </h3>
        {ownRequests.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ownRequests.map((r) => (
              <div key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold font-mono-nums text-sm text-slate-900 dark:text-white">
                    {formatBDT(r.amount, lang)} · {r.paymentMethod}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.paymentDate}
                    {r.transactionId ? ` · TrxID: ${r.transactionId}` : ''}
                    {r.reviewNote ? ` · ${r.reviewNote}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs font-semibold">
                  {r.receiptImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewImg(r.receiptImageUrl!)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[#0F8B8D] cursor-pointer"
                      title={lang === 'bn' ? 'স্ক্রিনশট দেখুন' : 'View Screenshot'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {r.syncStatus === 'pending' && (
                    <span className="text-amber-600">{lang === 'bn' ? 'সিঙ্ক বাকি' : 'Pending Sync'} ·</span>
                  )}
                  <span
                    className={
                      r.status === 'approved'
                        ? 'text-emerald-600'
                        : r.status === 'rejected'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                    }
                  >
                    {r.status === 'approved'
                      ? lang === 'bn'
                        ? 'অনুমোদিত (Approved)'
                        : 'Approved'
                      : r.status === 'rejected'
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
          <p className="text-xs text-slate-400 py-3">
            {lang === 'bn' ? 'এখনো কোনো পেমেন্ট আবেদন পাঠানো হয়নি।' : 'No payment requests yet.'}
          </p>
        )}
      </Card>

      <Modal open={!!previewImg} onClose={() => setPreviewImg(null)} title={lang === 'bn' ? 'পেমেন্ট রসিদ' : 'Payment Proof'}>
        {previewImg && <img src={previewImg} alt="Proof" className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
};

// ------------------------------------------------------------------
// 2. Guest Meal Request Page
// ------------------------------------------------------------------
export const MemberGuestMealPage: React.FC = () => {
  const { actor, currentUser, members, guestMealRequests, settings, lang } = useMess();
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const unitCharge = settings?.guestMealCharge ?? 70;
  const [guestName, setGuestName] = useState('');
  const [date, setDate] = useState(getTodayDateStr);
  const [breakfast, setBreakfast] = useState(0);
  const [lunch, setLunch] = useState(1);
  const [dinner, setDinner] = useState(0);
  const [guestCount, setGuestCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const estTotal = round2((breakfast + lunch + dinner) * Math.max(1, Number(guestCount || 1)) * unitCharge);

  const ownRequests = useMemo(
    () => guestMealRequests.filter((g) => g.memberUid === currentUser?.uid || g.memberId === ownMember?.id),
    [guestMealRequests, currentUser, ownMember]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !ownMember) {
      setErrorMsg(lang === 'bn' ? 'আপনার সদস্য প্রোফাইল লিংক করা নেই।' : 'Member profile not linked.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await submitGuestMealRequest(
        {
          member: ownMember,
          guestName,
          date,
          breakfast,
          lunch,
          dinner,
          guestCount: Number(guestCount || 1),
          unitCharge,
          notes,
        },
        actor
      );
      setGuestName('');
      setNotes('');
      setFeedback(
        lang === 'bn'
          ? 'অতিথি মিলের আবেদন পাঠানো হয়েছে। অনুমোদনের পর আপনার মাসিক বিলে যুক্ত হবে।'
          : 'Guest meal request submitted for approval.'
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
          {lang === 'bn' ? 'অতিথি মিল আবেদন (Guest Meal)' : 'Guest Meal Request'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? `প্রতি অতিথি মিল চার্জ: ${formatBDT(unitCharge, lang)} · অনুমোদিত হলে মাসিক বিলে যোগ হবে`
            : `Charge per guest meal: ${formatBDT(unitCharge, lang)} · Added to your monthly bill once approved`}
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField
              label={lang === 'bn' ? 'অতিথির নাম (ঐচ্ছিক)' : 'Guest Name (Optional)'}
              value={guestName}
              onChange={setGuestName}
              placeholder={lang === 'bn' ? 'যেমন: বড় ভাই / বন্ধু' : 'e.g., Friend'}
            />
            <InputField
              label={lang === 'bn' ? 'তারিখ' : 'Date'}
              type="date"
              value={date}
              onChange={setDate}
              required
            />
            <InputField
              label={lang === 'bn' ? 'অতিথি সংখ্যা' : 'Guest Count'}
              type="number"
              min="1"
              max="30"
              value={guestCount}
              onChange={setGuestCount}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: lang === 'bn' ? 'সকাল' : 'Breakfast', val: breakfast, setVal: setBreakfast },
              { label: lang === 'bn' ? 'দুপুর' : 'Lunch', val: lunch, setVal: setLunch },
              { label: lang === 'bn' ? 'রাত' : 'Dinner', val: dinner, setVal: setDinner },
            ].map((slot) => (
              <button
                key={slot.label}
                type="button"
                onClick={() => slot.setVal(slot.val ? 0 : 1)}
                className={`min-h-[56px] p-3 rounded-xl border text-center cursor-pointer ${
                  slot.val
                    ? 'bg-[#0F8B8D]/10 border-[#0F8B8D] text-[#0F8B8D] dark:text-teal-300 font-bold'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-xs">{slot.label}</div>
                <div className="text-xs mt-0.5">{slot.val ? '✓' : '—'}</div>
              </button>
            ))}
          </div>

          <InputField label={lang === 'bn' ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes (Optional)'} value={notes} onChange={setNotes} />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-sm font-semibold">
              {lang === 'bn' ? 'আনুমানিক চার্জ:' : 'Estimated Charge:'}{' '}
              <span className="font-mono-nums text-[#17365D] dark:text-sky-300">{formatBDT(estTotal, lang)}</span>
            </div>
            <button
              type="submit"
              disabled={submitting || !ownMember}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting ? (lang === 'bn' ? 'পাঠানো হচ্ছে...' : 'Sending...') : lang === 'bn' ? 'আবেদন পাঠান' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'আমার অতিথি মিল ইতিহাস' : 'Guest Meal History'}
        </h3>
        {ownRequests.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {ownRequests.map((g) => (
              <div key={g.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    {g.date} · {g.guestName || (lang === 'bn' ? 'অতিথি' : 'Guest')} ({formatNumber(g.guestCount, lang)} জন)
                  </div>
                  <div className="text-xs text-slate-400">
                    {g.breakfast ? 'সকাল ' : ''}{g.lunch ? 'দুপুর ' : ''}{g.dinner ? 'রাত' : ''} · {formatBDT(g.totalCharge, lang)}
                    {g.reviewNote ? ` · ${g.reviewNote}` : ''}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    g.status === 'approved' ? 'text-emerald-600' : g.status === 'rejected' ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  {g.status === 'approved'
                    ? lang === 'bn' ? 'অনুমোদিত' : 'Approved'
                    : g.status === 'rejected'
                      ? lang === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected'
                      : lang === 'bn' ? 'অপেক্ষমাণ' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">{lang === 'bn' ? 'কোনো অতিথি মিল আবেদন নেই।' : 'No guest meal requests.'}</p>
        )}
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------
// 3. Private Complaints & Suggestions Page
// ------------------------------------------------------------------
export const MemberComplaintsPage: React.FC = () => {
  const { actor, currentUser, members, complaints, lang } = useMess();
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const [category, setCategory] = useState<string>(COMPLAINT_CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ownComplaints = useMemo(
    () => complaints.filter((c) => c.memberUid === currentUser?.uid || c.memberId === ownMember?.id),
    [complaints, currentUser, ownMember]
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressImageToDataUrl(file);
      setImageUrl(url);
    } catch {
      setErrorMsg(lang === 'bn' ? 'ছবি আপলোড করা যায়নি।' : 'Image upload failed.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !ownMember) {
      setErrorMsg(lang === 'bn' ? 'আপনার সদস্য প্রোফাইল লিংক করা নেই।' : 'Member profile not linked.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await submitComplaint({ member: ownMember, category, subject, description, imageUrl }, actor);
      setSubject('');
      setDescription('');
      setImageUrl('');
      setFeedback(
        lang === 'bn'
          ? 'আপনার অভিযোগ / পরামর্শ গোপনভাবে মেস মালিক ও ম্যানেজারের কাছে পাঠানো হয়েছে।'
          : 'Complaint submitted privately to Mess Owner & Manager.'
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
          {lang === 'bn' ? 'অভিযোগ ও পরামর্শ' : 'Complaints & Suggestions'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'আপনার অভিযোগ শুধুমাত্র আপনি এবং মেস মালিক/ম্যানেজার দেখতে পারবেন'
            : 'Private to you and Mess Owner/Manager only'}
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-600">{errorMsg}</div>
          )}
          {feedback && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label={lang === 'bn' ? 'বিষয়ের ধরন (Category)' : 'Category'}
              value={category}
              onChange={setCategory}
              options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <InputField
              label={lang === 'bn' ? 'শিরোনাম (Subject)' : 'Subject'}
              value={subject}
              onChange={setSubject}
              required
              placeholder={lang === 'bn' ? 'সংক্ষিপ্ত বিষয় লিখুন' : 'Short summary'}
            />
          </div>

          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'বিস্তারিত বিবরণ' : 'Detailed Description'} *
            </span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder={lang === 'bn' ? 'আপনার সমস্যা বা পরামর্শ বিস্তারিত লিখুন...' : 'Describe your issue or suggestion...'}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'ছবি সংযুক্ত করুন (ঐচ্ছিক)' : 'Attach Photo (Optional)'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800"
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !ownMember}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              {submitting ? (lang === 'bn' ? 'পাঠানো হচ্ছে...' : 'Submitting...') : lang === 'bn' ? 'অভিযোগ পাঠান' : 'Submit'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? 'আমার দাখিলকৃত অভিযোগ ও উত্তর' : 'My Submitted Complaints'}
        </h3>
        {ownComplaints.length > 0 ? (
          <div className="space-y-3">
            {ownComplaints.map((c) => (
              <div key={c.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white">{c.subject}</div>
                    <div className="text-xs text-slate-400">
                      {c.category} · {c.submittedDate}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      c.status === 'resolved'
                        ? 'text-emerald-600'
                        : c.status === 'in_progress'
                          ? 'text-sky-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {c.status === 'resolved'
                      ? lang === 'bn' ? 'সমাধান হয়েছে' : 'Resolved'
                      : c.status === 'in_progress'
                        ? lang === 'bn' ? 'প্রক্রিয়াধীন' : 'In Progress'
                        : lang === 'bn' ? 'অপেক্ষমাণ' : 'Pending'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{c.description}</p>
                {c.adminReply && (
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                    <div className="font-semibold text-[#0F8B8D] mb-0.5">
                      {lang === 'bn' ? 'ম্যানেজার / মালিকের উত্তর:' : 'Manager Reply:'}
                    </div>
                    <div className="text-slate-700 dark:text-slate-200">{c.adminReply}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">{lang === 'bn' ? 'কোনো অভিযোগ নেই।' : 'No complaints submitted.'}</p>
        )}
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------
// 4. Menu Voting Page
// ------------------------------------------------------------------
export const MemberVotingPage: React.FC = () => {
  const { actor, currentUser, members, menuPolls, menuVotes, lang } = useMess();
  const todayStr = getTodayDateStr();
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleVote = async (pollId: string, optionIdx: number) => {
    const poll = menuPolls.find((p) => p.id === pollId);
    if (!poll || !actor) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      await submitMenuVote(poll, optionIdx, ownMember, actor);
      setFeedback(lang === 'bn' ? 'আপনার ভোট সফলভাবে সংরক্ষিত হয়েছে!' : 'Your vote has been recorded!');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Vote className="w-5 h-5 text-[#0F8B8D]" />
          <span>{lang === 'bn' ? 'খাবারের মেনু ভোট (Menu Voting)' : 'Food Menu Voting'}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn' ? 'আপনার পছন্দের খাবারের মেনুতে ভোট দিন (প্রতি পোলে ১ বার)' : 'Vote for your preferred meal options (1 vote per poll)'}
        </p>
      </div>

      {errorMsg && <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-600">{errorMsg}</div>}
      {feedback && <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700">{feedback}</div>}

      {menuPolls.length > 0 ? (
        <div className="space-y-4">
          {menuPolls.map((poll) => {
            const votesForPoll = menuVotes.filter((v) => v.pollId === poll.id);
            const myVote = votesForPoll.find((v) => v.uid === currentUser?.uid);
            const expired = poll.isClosed || (poll.deadline && todayStr > poll.deadline);
            const canSeeResults = poll.isClosed || (!!myVote && poll.showResultsAfterVote);

            return (
              <Card key={poll.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{poll.title}</h3>
                    {poll.description && <p className="text-xs text-slate-500 mt-0.5">{poll.description}</p>}
                    <div className="text-[11px] text-slate-400 mt-1">
                      {lang === 'bn' ? 'শেষ সময়:' : 'Deadline:'} {poll.deadline} · {formatNumber(votesForPoll.length, lang)} {lang === 'bn' ? 'টি ভোট' : 'votes'}
                    </div>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${expired ? 'text-slate-400' : 'text-emerald-600'}`}>
                    {expired ? (lang === 'bn' ? 'বন্ধ' : 'Closed') : lang === 'bn' ? 'চলমান' : 'Active'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {poll.options.map((opt, idx) => {
                    const count = votesForPoll.filter((v) => v.optionIndex === idx).length;
                    const pct = votesForPoll.length > 0 ? Math.round((count / votesForPoll.length) * 100) : 0;
                    const isMine = myVote?.optionIndex === idx;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!!myVote || !!expired}
                        onClick={() => handleVote(poll.id, idx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-colors ${
                          isMine
                            ? 'border-[#0F8B8D] bg-[#0F8B8D]/10'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950'
                        } ${!myVote && !expired ? 'hover:border-[#0F8B8D] cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-sm font-medium">
                          <span>
                            {opt} {isMine ? (lang === 'bn' ? '(আপনার ভোট ✓)' : '(Your vote ✓)') : ''}
                          </span>
                          {canSeeResults && (
                            <span className="font-mono-nums text-xs font-bold text-[#17365D] dark:text-sky-300">
                              {formatNumber(count, lang)} ({formatNumber(pct, lang)}%)
                            </span>
                          )}
                        </div>
                        {canSeeResults && (
                          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-[#0F8B8D] rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center text-xs text-slate-400">
          {lang === 'bn' ? 'বর্তমানে কোনো সক্রিয় মেনু ভোট পোল নেই।' : 'No active menu polls right now.'}
        </Card>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// 5. Notifications Page
// ------------------------------------------------------------------
export const MemberNotificationsPage: React.FC = () => {
  const { currentUser, notifications, lang } = useMess();
  const uid = currentUser?.uid || '';
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const visibleNotifs = useMemo(() => {
    const mine = notifications.filter((n) => n.targetUid === 'ALL' || n.targetUid === uid);
    if (filter === 'unread') {
      return mine.filter((n) => !n.readByUids.includes(uid));
    }
    return mine;
  }, [notifications, uid, filter]);

  const requestPushPerm = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0F8B8D]" />
            <span>{lang === 'bn' ? 'নোটিফিকেশন ও নোটিশ' : 'Notifications & Updates'}</span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPerm === 'default' && (
            <button
              type="button"
              onClick={requestPushPerm}
              className="px-3 py-2 rounded-xl border border-[#0F8B8D] text-[#0F8B8D] text-xs font-semibold cursor-pointer"
            >
              {lang === 'bn' ? 'ব্রাউজার অ্যালার্ট চালু করুন' : 'Enable Browser Alerts'}
            </button>
          )}
          <button
            type="button"
            onClick={() => markAllNotificationsRead(visibleNotifs, uid)}
            className="px-3 py-2 rounded-xl bg-[#17365D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{lang === 'bn' ? 'সব পঠিত করুন' : 'Mark All Read'}</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              filter === f
                ? 'bg-[#0F8B8D] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {f === 'all' ? (lang === 'bn' ? 'সকল আপডেট' : 'All') : lang === 'bn' ? 'অপঠিত (Unread)' : 'Unread'}
          </button>
        ))}
      </div>

      <Card className="p-4 divide-y divide-slate-100 dark:divide-slate-800">
        {visibleNotifs.length > 0 ? (
          visibleNotifs.map((n) => {
            const isRead = n.readByUids.includes(uid);
            return (
              <div
                key={n.id}
                onClick={() => markNotificationRead(n, uid)}
                className={`py-3.5 cursor-pointer transition-opacity ${isRead ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    {!isRead && <span className="text-[#0F8B8D] mr-1.5">●</span>}
                    {n.title}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">{n.body}</p>
              </div>
            );
          })
        ) : (
          <p className="py-6 text-center text-xs text-slate-400">
            {lang === 'bn' ? 'কোনো নতুন নোটিফিকেশন নেই।' : 'No notifications found.'}
          </p>
        )}
      </Card>
    </div>
  );
};

// ------------------------------------------------------------------
// 6. More Hub, Profile & Mess Rules Pages
// ------------------------------------------------------------------
export const MemberMorePage: React.FC<{
  onNavigate: (page: MemberPageId) => void;
}> = ({ onNavigate }) => {
  const { lang, logout } = useMess();

  const items: Array<{ id: MemberPageId; bn: string; en: string; descBn: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'payment-request', bn: 'টাকা জমার আবেদন', en: 'Payment Request', descBn: 'বিকাশ/নগদ/ক্যাশ জমার তথ্য পাঠান', icon: CreditCard },
    { id: 'market-expenses', bn: 'মেসের বাজার খরচ', en: 'Market Expenses', descBn: 'স্বচ্ছ প্রতিদিনের বাজার হিসাব ও রসিদ', icon: ShoppingBasket },
    { id: 'guest-meal', bn: 'অতিথি মিল আবেদন', en: 'Guest Meal Request', descBn: 'গেস্ট মিলের অনুরোধ পাঠান', icon: UserPlus },
    { id: 'menu-voting', bn: 'খাবারের মেনু ভোট', en: 'Menu Voting', descBn: 'পছন্দের মেনু নির্বাচনে ভোট দিন', icon: Vote },
    { id: 'complaints', bn: 'অভিযোগ ও পরামর্শ', en: 'Complaints & Suggestions', descBn: 'গোপন অভিযোগ বা মতামত পাঠান', icon: MessageSquarePlus },
    { id: 'profile', bn: 'আমার প্রোফাইল ও মেনু', en: 'My Profile & Menu', descBn: 'সদস্য তথ্য ও সাপ্তাহিক মেনু', icon: User },
    { id: 'mess-rules', bn: 'মেসের নিয়মাবলী', en: 'Mess Rules', descBn: 'মিল কাট-অফ ও জরুরি যোগাযোগ', icon: BookOpen },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {lang === 'bn' ? 'সকল সেবা ও মেনু' : 'More Features & Options'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.id} onClick={() => onNavigate(item.id)} className="p-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#17365D]/10 dark:bg-sky-900/30 text-[#17365D] dark:text-sky-300 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {lang === 'bn' ? item.bn : item.en}
                </div>
                <div className="text-xs text-slate-500 truncate">{item.descBn}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <button
        type="button"
        onClick={logout}
        className="w-full min-h-[48px] rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
      >
        <LogOut className="w-4 h-4" />
        <span>{lang === 'bn' ? 'অ্যাকাউন্ট থেকে লগ আউট করুন' : 'Sign Out'}</span>
      </button>
    </div>
  );
};

export const MemberProfilePage: React.FC = () => {
  const { currentUser, members, weeklyMenus, lang } = useMess();
  const ownMember = useMemo(
    () => members.find((m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid),
    [members, currentUser]
  );

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {lang === 'bn' ? 'আমার প্রোফাইল ও সাপ্তাহিক মেনু' : 'My Profile & Weekly Menu'}
      </h2>

      <Card className="p-5 space-y-3 text-sm">
        <div className="font-bold text-base text-slate-900 dark:text-white">
          {ownMember?.fullName || currentUser?.displayName}
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="py-2 flex justify-between"><span className="text-slate-500">Email</span><span>{currentUser?.email}</span></div>
          <div className="py-2 flex justify-between"><span className="text-slate-500">{lang === 'bn' ? 'রুম ও সিট' : 'Room & Seat'}</span><span>{ownMember ? `${ownMember.roomNumber} (${ownMember.seatNumber || '—'})` : '—'}</span></div>
          <div className="py-2 flex justify-between"><span className="text-slate-500">{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span><span className="font-mono-nums">{ownMember?.mobile || '—'}</span></div>
          <div className="py-2 flex justify-between"><span className="text-slate-500">{lang === 'bn' ? 'মাসিক রুম ভাড়া' : 'Room Rent'}</span><span className="font-mono-nums">{formatBDT(ownMember?.monthlyRent || 0, lang)}</span></div>
          <div className="py-2 flex justify-between"><span className="text-slate-500">{lang === 'bn' ? 'অগ্রিম জমা' : 'Advance'}</span><span className="font-mono-nums">{formatBDT(ownMember?.advanceAmount || 0, lang)}</span></div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {lang === 'bn' ? 'সাপ্তাহিক খাবারের মেনু' : 'Weekly Food Menu'}
        </h3>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
          {weeklyMenus.map((m) => (
            <div key={m.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="font-bold text-[#17365D] dark:text-sky-300">
                {lang === 'bn' ? m.dayNameBn : m.dayNameEn}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {lang === 'bn' ? 'সকাল:' : 'B:'} {m.breakfast || '-'} · {lang === 'bn' ? 'দুপুর:' : 'L:'} {m.lunch || '-'} · {lang === 'bn' ? 'রাত:' : 'D:'} {m.dinner || '-'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const MemberRulesPage: React.FC = () => {
  const { settings, lang } = useMess();
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {lang === 'bn' ? 'মেসের নিয়মাবলী ও তথ্য' : 'Mess Rules & Information'}
      </h2>

      <Card className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'মেস মালিক / ম্যানেজার' : 'Owner / Manager'}</div>
            <div className="font-semibold">{settings?.ownerName || 'মেস মালিক'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'জরুরি যোগাযোগ' : 'Contact'}</div>
            <div className="font-semibold font-mono-nums">{settings?.contactNumber || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'মিল আবেদনের শেষ সময়' : 'Meal Cutoff Time'}</div>
            <div className="font-semibold font-mono-nums">{settings?.mealCutoffTime || '22:00'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{lang === 'bn' ? 'প্রতি গেস্ট মিল চার্জ' : 'Guest Meal Charge'}</div>
            <div className="font-semibold font-mono-nums">{formatBDT(settings?.guestMealCharge ?? 70, lang)}</div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold mb-2">{lang === 'bn' ? 'নিয়মাবলী' : 'Mess Rules'}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
            {settings?.messRules ||
              (lang === 'bn'
                ? 'মেস কর্তৃপক্ষ এখনো কোনো বিশেষ নিয়মাবলী যুক্ত করেননি।'
                : 'No custom mess rules published yet.')}
          </p>
        </div>
      </Card>
    </div>
  );
};
