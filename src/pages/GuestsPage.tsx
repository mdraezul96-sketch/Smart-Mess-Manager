import React, { useMemo, useState } from 'react';
import { CreditCard, Plus, UserCheck } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, InputField, Modal, SelectField } from '../components/UI';
import { formatBDT, formatNumber, PAYMENT_METHODS, TEXT } from '../i18n/translations';
import { recordGuestPayment, saveGuest } from '../services/messDataService';
import { Guest, PaymentMethod } from '../types/mess';
import { getTodayDateStr, round2 } from '../utils/calculations';

export const GuestsPage: React.FC = () => {
  const { actor, currentUser, lang, settings, rooms, guests, guestPayments } = useMess();
  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const defaultCharge = settings?.defaultGuestCharge ?? 200;

  const [formOpen, setFormOpen] = useState(false);
  const [payGuest, setPayGuest] = useState<Guest | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Guest Form
  const [guestName, setGuestName] = useState('');
  const [mobile, setMobile] = useState('');
  const [arrivalDate, setArrivalDate] = useState(getTodayDateStr);
  const [departureDate, setDepartureDate] = useState('');
  const [totalDays, setTotalDays] = useState('1');
  const [roomId, setRoomId] = useState('');
  const [dailyCharge, setDailyCharge] = useState(String(defaultCharge));
  const [paidAmount, setPaidAmount] = useState('0');
  const [notes, setNotes] = useState('');

  // Additional Guest Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payNotes, setPayNotes] = useState('');

  const totals = useMemo(() => {
    const billed = round2(guests.reduce((s, g) => s + g.totalAmount, 0));
    const collected = round2(guests.reduce((s, g) => s + g.paidAmount, 0));
    const due = round2(guests.reduce((s, g) => s + g.remainingDue, 0));
    return { billed, collected, due };
  }, [guests]);

  const openAddGuest = () => {
    setErrorMsg(null);
    setGuestName('');
    setMobile('');
    setArrivalDate(getTodayDateStr());
    setDepartureDate('');
    setTotalDays('1');
    setRoomId(rooms[0]?.id || '');
    setDailyCharge(String(defaultCharge));
    setPaidAmount('0');
    setNotes('');
    setFormOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    if (!guestName.trim() || Number(totalDays) < 1) {
      setErrorMsg(lang === 'bn' ? 'অতিথির নাম ও কমপক্ষে ১ দিন লিখুন।' : 'Guest name and at least 1 day required.');
      return;
    }
    const r = rooms.find((rm) => rm.id === roomId);
    try {
      await saveGuest(
        {
          guestName,
          mobile,
          arrivalDate,
          departureDate,
          totalDays: Number(totalDays),
          roomId: r?.id || '',
          roomNumber: r?.roomNumber || '',
          dailyCharge: Number(dailyCharge || defaultCharge),
          paidAmount: Number(paidAmount || 0),
          notes,
          status: 'staying',
        },
        actor
      );
      setFormOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRecordGuestPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !payGuest) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    await recordGuestPayment(
      {
        guestId: payGuest.id,
        guestName: payGuest.guestName,
        paymentDate: getTodayDateStr(),
        amount: amt,
        paymentMethod: payMethod,
        notes: payNotes,
      },
      actor
    );
    setPayGuest(null);
  };

  const handleCheckout = async (g: Guest) => {
    if (!actor) return;
    await saveGuest(
      {
        ...g,
        departureDate: g.departureDate || getTodayDateStr(),
        status: 'checked_out',
      },
      actor
    );
  };

  const previewBill = round2(Math.max(1, Number(totalDays || 1)) * Math.max(0, Number(dailyCharge || 0)));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.guests}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? `ডিফল্ট অতিথি চার্জ: ${formatBDT(defaultCharge, lang)} / দিন`
              : `Default Guest Rate: ${formatBDT(defaultCharge, lang)} / day`}
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openAddGuest}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'অতিথি যোগ করুন' : 'Add Guest'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট অতিথি বিল' : 'Total Guest Billed'}</div>
          <div className="text-xl font-bold font-mono-nums text-slate-900 dark:text-white mt-1">
            {formatBDT(totals.billed, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'অতিথি থেকে আদায়' : 'Guest Collected'}</div>
          <div className="text-xl font-bold font-mono-nums text-emerald-600 mt-1">
            {formatBDT(totals.collected, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'অতিথির বকেয়া' : 'Guest Due'}</div>
          <div className="text-xl font-bold font-mono-nums text-rose-600 mt-1">
            {formatBDT(totals.due, lang)}
          </div>
        </Card>
      </div>

      <Card className="p-5 overflow-hidden">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'অতিথিদের তালিকা ও হিসাব' : 'Guest Records'}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="text-left py-2.5">{lang === 'bn' ? 'অতিথি ও রুম' : 'Guest & Room'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'তারিখ' : 'Arrival'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'দিন × রেট' : 'Days × Rate'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'মোট বিল' : 'Total'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'জমা' : 'Paid'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'বকেয়া' : 'Due'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 dark:border-slate-800/70">
                  <td className="py-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{g.guestName}</div>
                    <div className="text-xs text-slate-400">
                      {g.roomNumber || '—'} · {g.mobile || '—'} ·{' '}
                      {g.status === 'staying' ? (lang === 'bn' ? 'অবস্থানরত' : 'Staying') : (lang === 'bn' ? 'বিদায়' : 'Checked Out')}
                    </div>
                  </td>
                  <td className="py-3 text-xs font-mono-nums text-slate-500">{g.arrivalDate}</td>
                  <td className="py-3 text-right font-mono-nums text-xs">
                    {formatNumber(g.totalDays, lang)} × {formatBDT(g.dailyCharge, lang)}
                  </td>
                  <td className="py-3 text-right font-bold font-mono-nums">{formatBDT(g.totalAmount, lang)}</td>
                  <td className="py-3 text-right font-mono-nums text-emerald-600">{formatBDT(g.paidAmount, lang)}</td>
                  <td className="py-3 text-right font-bold font-mono-nums text-rose-600">
                    {formatBDT(g.remainingDue, lang)}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {isManagerOrAdmin && (
                      <div className="inline-flex items-center gap-1.5">
                        {g.remainingDue > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayGuest(g);
                              setPayAmount(String(g.remainingDue));
                              setPayMethod('Cash');
                              setPayNotes('');
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'পেমেন্ট' : 'Pay'}</span>
                          </button>
                        )}
                        {g.status === 'staying' && (
                          <button
                            type="button"
                            onClick={() => handleCheckout(g)}
                            className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'চেক-আউট' : 'Checkout'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Guest Payment History */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'অতিথির পেমেন্ট হিস্টোরি' : 'Guest Payment History'}
        </h3>
        {guestPayments.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {guestPayments.map((gp) => (
              <div key={gp.id} className="py-2.5 flex items-center justify-between text-xs">
                <span>
                  <strong className="text-slate-900 dark:text-white">{gp.guestName}</strong> · {gp.paymentDate} · {gp.paymentMethod}
                </span>
                <span className="font-bold font-mono-nums text-emerald-600">{formatBDT(gp.amount, lang)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">{t.noData}</p>
        )}
      </Card>

      {/* Add Guest Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={lang === 'bn' ? 'নতুন অতিথি নিবন্ধন' : 'Add Guest Stay'}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveGuest} className="space-y-4">
          {errorMsg && <div className="text-xs text-rose-600">{errorMsg}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label={lang === 'bn' ? 'অতিথির নাম' : 'Guest Name'} value={guestName} onChange={setGuestName} required />
            <InputField label={lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile'} value={mobile} onChange={setMobile} />
            <InputField label={lang === 'bn' ? 'আসার তারিখ' : 'Arrival Date'} type="date" value={arrivalDate} onChange={setArrivalDate} required />
            <InputField label={lang === 'bn' ? 'যাওয়ার তারিখ (ঐচ্ছিক)' : 'Departure Date'} type="date" value={departureDate} onChange={setDepartureDate} />
            <InputField label={lang === 'bn' ? 'মোট দিন' : 'Total Days'} type="number" min="1" value={totalDays} onChange={setTotalDays} required />
            <InputField label={lang === 'bn' ? 'প্রতিদিনের চার্জ (৳)' : 'Daily Charge (৳)'} type="number" min="0" value={dailyCharge} onChange={setDailyCharge} required />
            <SelectField
              label={lang === 'bn' ? 'কোন রুমে ছিলেন' : 'Room'}
              value={roomId}
              onChange={setRoomId}
              options={[
                { value: '', label: lang === 'bn' ? 'নির্বাচন করুন' : 'Select' },
                ...rooms.map((r) => ({ value: r.id, label: r.roomNumber })),
              ]}
            />
            <InputField label={lang === 'bn' ? 'প্রাথমিক জমা (৳)' : 'Initial Paid (৳)'} type="number" min="0" value={paidAmount} onChange={setPaidAmount} />
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs flex justify-between">
            <span>{lang === 'bn' ? 'অটোমেটিক মোট বিল:' : 'Calculated Total Bill:'}</span>
            <strong className="font-mono-nums text-[#17365D] dark:text-sky-300">{formatBDT(previewBill, lang)}</strong>
          </div>
          <InputField label={lang === 'bn' ? 'মন্তব্য' : 'Notes'} value={notes} onChange={setNotes} />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer">{t.cancel}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer">{t.save}</button>
          </div>
        </form>
      </Modal>

      {/* Record Guest Payment Modal */}
      <Modal
        open={!!payGuest}
        onClose={() => setPayGuest(null)}
        title={lang === 'bn' ? 'অতিথির পেমেন্ট গ্রহণ' : 'Record Guest Payment'}
      >
        {payGuest && (
          <form onSubmit={handleRecordGuestPay} className="space-y-4">
            <p className="text-sm">
              {lang === 'bn' ? 'অতিথি:' : 'Guest:'} <strong>{payGuest.guestName}</strong> ·{' '}
              {lang === 'bn' ? 'বকেয়া:' : 'Due:'} <strong className="text-rose-600">{formatBDT(payGuest.remainingDue, lang)}</strong>
            </p>
            <InputField label={lang === 'bn' ? 'জমার পরিমাণ (৳)' : 'Amount'} type="number" min="1" step="any" value={payAmount} onChange={setPayAmount} required />
            <SelectField
              label={lang === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Method'}
              value={payMethod}
              onChange={(v) => setPayMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
            <InputField label={lang === 'bn' ? 'মন্তব্য' : 'Notes'} value={payNotes} onChange={setPayNotes} />
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setPayGuest(null)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer">{t.cancel}</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium cursor-pointer">{t.save}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
