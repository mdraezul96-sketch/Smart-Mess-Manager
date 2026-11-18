import React, { useMemo, useState } from 'react';
import {
  Archive,
  Edit3,
  Eye,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, Modal, SelectField } from '../components/UI';
import { WhatsAppMemberModal, WhatsAppQuickButtons } from '../components/WhatsAppShareModal';
import { formatBDT, formatMonthLabel, formatNumber, TEXT } from '../i18n/translations';
import { archiveMember, deleteMemberPermanent, saveMember } from '../services/messDataService';
import { Member } from '../types/mess';
import { calculateMonthlySummary, MemberMonthlyCalculation } from '../utils/calculations';
import { WhatsAppMessageMode } from '../utils/whatsappShare';

export const MembersPage: React.FC = () => {
  const {
    actor,
    currentUser,
    lang,
    selectedMonth,
    rooms,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
    settings,
  } = useMess();

  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'archived'>('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [profileMember, setProfileMember] = useState<Member | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'archive' | 'delete'; member: Member } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [waMemberTarget, setWaMemberTarget] = useState<{
    calc: MemberMonthlyCalculation;
    mode: WhatsAppMessageMode;
  } | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');
  const [email, setEmail] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [presentAddress, setPresentAddress] = useState('');
  const [nidNumber, setNidNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [roomId, setRoomId] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('0');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [status, setStatus] = useState<'active' | 'inactive' | 'archived'>('active');

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.fullName.toLowerCase().includes(q) ||
          (m.mobile || '').toLowerCase().includes(q) ||
          m.roomNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [members, statusFilter, search]);

  const openAddModal = () => {
    setErrorMsg(null);
    setEditingMember(null);
    setFullName('');
    setFatherName('');
    setMobile('');
    setAltMobile('');
    setEmail('');
    setPermanentAddress('');
    setPresentAddress('');
    setNidNumber('');
    setEmergencyContact('');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    const defaultRoom = rooms.find((r) => {
      const occ = members.filter((m) => m.status === 'active' && m.roomId === r.id).length;
      return occ < r.totalSeats;
    }) || rooms[0];
    setRoomId(defaultRoom?.id || '');
    setSeatNumber('');
    setMonthlyRent(String(defaultRoom?.monthlyRent || 0));
    setAdvanceAmount('0');
    setStatus('active');
    setFormOpen(true);
  };

  const openEditModal = (m: Member) => {
    setErrorMsg(null);
    setEditingMember(m);
    setFullName(m.fullName);
    setFatherName(m.fatherName || '');
    setMobile(m.mobile || '');
    setAltMobile(m.altMobile || '');
    setEmail(m.email || '');
    setPermanentAddress(m.permanentAddress || '');
    setPresentAddress(m.presentAddress || '');
    setNidNumber(m.nidNumber || '');
    setEmergencyContact(m.emergencyContact || '');
    setJoiningDate(m.joiningDate || '');
    setRoomId(m.roomId);
    setSeatNumber(m.seatNumber || '');
    setMonthlyRent(String(m.monthlyRent || 0));
    setAdvanceAmount(String(m.advanceAmount || 0));
    setStatus(m.status);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg(lang === 'bn' ? 'সদস্যের পূর্ণ নাম লিখুন।' : 'Full name is required.');
      return;
    }
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      setErrorMsg(lang === 'bn' ? 'একটি বৈধ রুম নির্বাচন করুন।' : 'Please select a valid room.');
      return;
    }
    try {
      await saveMember(
        {
          id: editingMember?.id,
          fullName,
          fatherName,
          mobile,
          altMobile,
          email,
          permanentAddress,
          presentAddress,
          nidNumber,
          emergencyContact,
          joiningDate,
          leavingDate: editingMember?.leavingDate || '',
          roomId: room.id,
          roomNumber: room.roomNumber,
          seatNumber,
          monthlyRent: Number(monthlyRent || 0),
          advanceAmount: Number(advanceAmount || 0),
          status,
          linkedUid: editingMember?.linkedUid || '',
          photoUrl: editingMember?.photoUrl || '',
        },
        actor
      );
      setFormOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction || !actor) return;
    if (confirmAction.type === 'archive') {
      await archiveMember(confirmAction.member.id, actor);
    } else {
      await deleteMemberPermanent(confirmAction.member.id, actor);
    }
    setConfirmAction(null);
  };

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

  // Member profile computations
  const profileDetails = useMemo(() => {
    if (!profileMember) return null;
    const calc = monthlySummary.memberCalculations.find((c) => c.member.id === profileMember.id);
    const memberPayments = payments.filter((p) => p.memberId === profileMember.id && !p.isVoided);
    const memberMarketPurchases = expenses.filter(
      (e) => !e.isVoided && e.expenseGroup === 'market' && e.paidByMemberId === profileMember.id
    );
    const pastMonths = Array.from(
      new Set([
        ...mealEntries.filter((m) => m.memberId === profileMember.id).map((m) => m.monthKey),
        ...payments.filter((p) => p.memberId === profileMember.id).map((p) => p.monthKey),
      ])
    ).sort((a, b) => b.localeCompare(a));

    return {
      calc,
      memberPayments,
      memberMarketPurchases,
      pastMonths,
    };
  }, [profileMember, monthlySummary, payments, expenses, mealEntries]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.members}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? `মোট ${formatNumber(members.filter((m) => m.status === 'active').length, lang)} জন সক্রিয় সদস্য`
              : `${members.filter((m) => m.status === 'active').length} active members`}
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openAddModal}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন সদস্য যোগ' : 'Add Member'}</span>
          </button>
        )}
      </div>

      {/* Search & Status Filter */}
      <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'bn' ? 'নাম, মোবাইল বা রুম নম্বর দিয়ে খুঁজুন...' : 'Search by name, phone, or room...'}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
          {(['active', 'inactive', 'archived', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {st === 'active'
                ? lang === 'bn' ? 'সক্রিয়' : 'Active'
                : st === 'inactive'
                  ? lang === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive'
                  : st === 'archived'
                    ? lang === 'bn' ? 'আর্কাইভ' : 'Archived'
                    : lang === 'bn' ? 'সকল' : 'All'}
            </button>
          ))}
        </div>
      </Card>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMembers.map((m) => {
          const calc = monthlySummary.memberCalculations.find((c) => c.member.id === m.id);
          return (
            <Card key={m.id} className="p-5 flex flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#17365D]/10 dark:bg-[#0F8B8D]/20 text-[#17365D] dark:text-teal-300 flex items-center justify-center font-bold text-base shrink-0">
                    {m.fullName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {m.fullName}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {m.roomNumber} {m.seatNumber ? `· ${m.seatNumber}` : ''} ·{' '}
                      <span className={m.status === 'active' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600'}>
                        {m.status === 'active' ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : m.status === 'archived' ? (lang === 'bn' ? 'আর্কাইভ' : 'Archived') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block">{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 font-mono-nums">
                    {m.mobile || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{lang === 'bn' ? 'সিট ভাড়া' : 'Rent'}</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 font-mono-nums">
                    {formatBDT(m.monthlyRent, lang)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">{lang === 'bn' ? 'চলতি বকেয়া' : 'Due'}</span>
                  <span className={`font-semibold font-mono-nums ${(calc?.dueAmount || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatBDT(calc?.dueAmount || 0, lang)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProfileMember(m)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
                  </button>

                  {isManagerOrAdmin && calc && (
                    <WhatsAppQuickButtons
                      calc={calc}
                      monthKey={selectedMonth}
                      messName={settings?.messName}
                      contactNumber={settings?.contactNumber}
                      mode={calc.dueAmount > 0 ? 'due' : 'bill'}
                      lang={lang}
                      compact
                      onPreview={(targetCalc, mode) => setWaMemberTarget({ calc: targetCalc, mode })}
                    />
                  )}
                </div>

                {isManagerOrAdmin && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(m)}
                      className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title={t.edit}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {m.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: 'archive', member: m })}
                        className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                        title={lang === 'bn' ? 'আর্কাইভ' : 'Archive'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: 'delete', member: m })}
                        className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card className="p-8 col-span-full text-center text-sm text-slate-400">
            {t.noData}
          </Card>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingMember
            ? lang === 'bn' ? 'সদস্যের তথ্য সম্পাদনা' : 'Edit Member'
            : lang === 'bn' ? 'নতুন সদস্য যোগ করুন' : 'Add New Member'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={lang === 'bn' ? 'সদস্যের পূর্ণ নাম' : 'Full Name'}
              value={fullName}
              onChange={setFullName}
              required
            />
            <InputField
              label={lang === 'bn' ? 'পিতার নাম' : "Father's Name"}
              value={fatherName}
              onChange={setFatherName}
            />
            <InputField
              label={lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
              value={mobile}
              onChange={setMobile}
              placeholder="01XXXXXXXXX"
            />
            <InputField
              label={lang === 'bn' ? 'বিকল্প মোবাইল নম্বর' : 'Alternative Mobile'}
              value={altMobile}
              onChange={setAltMobile}
            />
            <InputField
              label={lang === 'bn' ? 'ইমেইল' : 'Email'}
              type="email"
              value={email}
              onChange={setEmail}
            />
            <InputField
              label={lang === 'bn' ? 'জাতীয় পরিচয়পত্র নম্বর (ঐচ্ছিক)' : 'NID Number (Optional)'}
              value={nidNumber}
              onChange={setNidNumber}
            />
            <InputField
              label={lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
              value={permanentAddress}
              onChange={setPermanentAddress}
            />
            <InputField
              label={lang === 'bn' ? 'বর্তমান ঠিকানা' : 'Present Address'}
              value={presentAddress}
              onChange={setPresentAddress}
            />
            <InputField
              label={lang === 'bn' ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}
              value={emergencyContact}
              onChange={setEmergencyContact}
            />
            <InputField
              label={lang === 'bn' ? 'মেসে যোগদানের তারিখ' : 'Joining Date'}
              type="date"
              value={joiningDate}
              onChange={setJoiningDate}
            />
            <SelectField
              label={lang === 'bn' ? 'রুম নম্বর' : 'Room'}
              value={roomId}
              onChange={(val) => {
                setRoomId(val);
                const r = rooms.find((rm) => rm.id === val);
                if (r && (!monthlyRent || monthlyRent === '0')) {
                  setMonthlyRent(String(r.monthlyRent || 0));
                }
              }}
              options={rooms.map((r) => {
                const occ = members.filter((m) => m.status === 'active' && m.roomId === r.id && m.id !== editingMember?.id).length;
                const avail = Math.max(0, r.totalSeats - occ);
                return {
                  value: r.id,
                  label: `${r.roomNumber} (${lang === 'bn' ? `খালি ${avail}/${r.totalSeats}` : `${avail}/${r.totalSeats} free`})`,
                };
              })}
              required
            />
            <InputField
              label={lang === 'bn' ? 'সিট নম্বর' : 'Seat Number'}
              value={seatNumber}
              onChange={setSeatNumber}
              placeholder={lang === 'bn' ? 'যেমন: সিট ১' : 'e.g. Seat 1'}
            />
            <InputField
              label={lang === 'bn' ? 'মাসিক সিট ভাড়া (৳)' : 'Monthly Seat Rent (৳)'}
              type="number"
              min="0"
              step="any"
              value={monthlyRent}
              onChange={setMonthlyRent}
            />
            <InputField
              label={lang === 'bn' ? 'অগ্রিম টাকা (৳)' : 'Advance Amount (৳)'}
              type="number"
              min="0"
              step="any"
              value={advanceAmount}
              onChange={setAdvanceAmount}
            />
            <SelectField
              label={lang === 'bn' ? 'অবস্থা' : 'Status'}
              value={status}
              onChange={(v) => setStatus(v as 'active' | 'inactive' | 'archived')}
              options={[
                { value: 'active', label: lang === 'bn' ? 'সক্রিয় (Active)' : 'Active' },
                { value: 'inactive', label: lang === 'bn' ? 'নিষ্ক্রিয় (Inactive)' : 'Inactive' },
                { value: 'archived', label: lang === 'bn' ? 'আর্কাইভ (Archived)' : 'Archived' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-medium cursor-pointer"
            >
              {t.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Profile Modal */}
      <Modal
        open={!!profileMember}
        onClose={() => setProfileMember(null)}
        title={profileMember ? `${profileMember.fullName} — ${lang === 'bn' ? 'সদস্য প্রোফাইল' : 'Member Profile'}` : ''}
        maxWidth="max-w-2xl"
      >
        {profileMember && profileDetails && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'রুম ও সিট' : 'Room & Seat'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {profileMember.roomNumber} {profileMember.seatNumber ? `· ${profileMember.seatNumber}` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'মোবাইল' : 'Mobile'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profileMember.mobile || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'পিতার নাম' : "Father's Name"}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profileMember.fatherName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joining Date'}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{profileMember.joiningDate || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'সিট ভাড়া' : 'Monthly Rent'}</span>
                <span className="font-semibold font-mono-nums text-slate-900 dark:text-white">{formatBDT(profileMember.monthlyRent, lang)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">{lang === 'bn' ? 'অগ্রিম জমা' : 'Advance'}</span>
                <span className="font-semibold font-mono-nums text-slate-900 dark:text-white">{formatBDT(profileMember.advanceAmount, lang)}</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-400 block">{lang === 'bn' ? 'স্থায়ী ও বর্তমান ঠিকানা' : 'Addresses'}</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {profileMember.permanentAddress || '—'} / {profileMember.presentAddress || '—'}
                </span>
              </div>
            </div>

            {profileDetails.calc && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {formatMonthLabel(selectedMonth, lang)} — {lang === 'bn' ? 'মাসিক হিসাব' : 'Monthly Summary'}
                  </h4>
                  {isManagerOrAdmin && (
                    <WhatsAppQuickButtons
                      calc={profileDetails.calc}
                      monthKey={selectedMonth}
                      messName={settings?.messName}
                      contactNumber={settings?.contactNumber}
                      mode={profileDetails.calc.dueAmount > 0 ? 'due' : 'bill'}
                      lang={lang}
                      onPreview={(targetCalc, mode) => setWaMemberTarget({ calc: targetCalc, mode })}
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block">{lang === 'bn' ? 'মোট মিল' : 'Meals'}</span>
                    <span className="font-bold font-mono-nums text-sm">{formatNumber(profileDetails.calc.totalMeals, lang, 1)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{lang === 'bn' ? 'খাবার খরচ' : 'Food Cost'}</span>
                    <span className="font-bold font-mono-nums text-sm">{formatBDT(profileDetails.calc.foodCost, lang)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</span>
                    <span className="font-bold font-mono-nums text-sm">{formatBDT(profileDetails.calc.totalBill, lang)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{lang === 'bn' ? 'জমা' : 'Paid'}</span>
                    <span className="font-bold font-mono-nums text-sm text-emerald-600">{formatBDT(profileDetails.calc.totalPaid, lang)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">{lang === 'bn' ? 'বকেয়া / অগ্রিম' : 'Due / Adv'}</span>
                    <span className="font-bold font-mono-nums text-sm text-rose-600">
                      {profileDetails.calc.advanceAmount > 0
                        ? `+${formatBDT(profileDetails.calc.advanceAmount, lang)}`
                        : formatBDT(profileDetails.calc.dueAmount, lang)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                {lang === 'bn' ? 'টাকা জমার ইতিহাস' : 'Payment History'}
              </h4>
              {profileDetails.memberPayments.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-3">
                  {profileDetails.memberPayments.map((p) => (
                    <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                      <span>
                        {p.paymentDate} · {p.paymentMethod} · {p.receiptNo}
                      </span>
                      <span className="font-bold font-mono-nums text-emerald-600">
                        {formatBDT(p.amount, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{t.noData}</p>
              )}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
                {lang === 'bn' ? 'বাজার খরচে অংশগ্রহণ' : 'Market Contributions'}
              </h4>
              {profileDetails.memberMarketPurchases.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl px-3">
                  {profileDetails.memberMarketPurchases.map((e) => (
                    <div key={e.id} className="py-2 flex items-center justify-between text-xs">
                      <span>{e.date} · {e.itemName}</span>
                      <span className="font-bold font-mono-nums">{formatBDT(e.amount, lang)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">{t.noData}</p>
              )}
            </div>

            {profileDetails.pastMonths.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <UserCheck className="w-4 h-4 text-[#0F8B8D]" />
                <span>
                  {lang === 'bn' ? 'সক্রিয় মাসসমূহ: ' : 'Active Months: '}
                  {profileDetails.pastMonths.map((mk) => formatMonthLabel(mk, lang)).join(', ')}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Archive / Delete */}
      <ConfirmModal
        open={!!confirmAction}
        title={
          confirmAction?.type === 'archive'
            ? lang === 'bn' ? 'সদস্য আর্কাইভ নিশ্চিত করুন' : 'Confirm Archive Member'
            : lang === 'bn' ? 'সদস্য স্থায়ীভাবে মুছুন' : 'Confirm Permanent Delete'
        }
        message={
          confirmAction?.type === 'archive'
            ? lang === 'bn'
              ? `"${confirmAction?.member.fullName}"-কে আর্কাইভ করলে তার পুরোনো হিসাব সংরক্ষিত থাকবে কিন্তু নতুন মাসের তালিকায় দেখাবে না।`
              : `Archiving "${confirmAction?.member.fullName}" preserves historical bills while removing them from active rooms.`
            : lang === 'bn'
              ? `আপনি কি নিশ্চিত যে "${confirmAction?.member.fullName}"-কে মুছে ফেলতে চান?`
              : `Are you sure you want to permanently delete "${confirmAction?.member.fullName}"?`
        }
        confirmLabel={confirmAction?.type === 'archive' ? (lang === 'bn' ? 'আর্কাইভ করুন' : 'Archive') : t.delete}
        cancelLabel={t.cancel}
        danger={confirmAction?.type === 'delete'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmAction(null)}
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
    </div>
  );
};
