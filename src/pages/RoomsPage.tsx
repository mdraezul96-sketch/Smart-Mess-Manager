import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, BedDouble, Edit3, Plus, Trash2, Users } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, Modal, SelectField } from '../components/UI';
import { formatBDT, formatNumber, TEXT } from '../i18n/translations';
import { deleteRoom, saveMember, saveRoom } from '../services/messDataService';
import { Member, Room } from '../types/mess';
import { computeRoomOccupancy } from '../utils/calculations';

export const RoomsPage: React.FC = () => {
  const { actor, currentUser, lang, rooms, members } = useMess();
  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const roomInfoList = useMemo(() => computeRoomOccupancy(rooms, members), [rooms, members]);

  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomName, setRoomName] = useState('');
  const [totalSeats, setTotalSeats] = useState('2');
  const [monthlyRent, setMonthlyRent] = useState('0');
  const [status, setStatus] = useState<'available' | 'full' | 'maintenance'>('available');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [targetSeat, setTargetSeat] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const openAddRoom = () => {
    setErrorMsg(null);
    setEditingRoom(null);
    setRoomNumber(`Room ${rooms.length + 1}`);
    setRoomName('');
    setTotalSeats('2');
    setMonthlyRent('0');
    setStatus('available');
    setNotes('');
    setRoomModalOpen(true);
  };

  const openEditRoom = (r: Room) => {
    setErrorMsg(null);
    setEditingRoom(r);
    setRoomNumber(r.roomNumber);
    setRoomName(r.roomName || '');
    setTotalSeats(String(r.totalSeats));
    setMonthlyRent(String(r.monthlyRent));
    setStatus(r.status);
    setNotes(r.notes || '');
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    if (!roomNumber.trim() || Number(totalSeats) < 1) {
      setErrorMsg(lang === 'bn' ? 'রুম নম্বর ও কমপক্ষে ১টি সিট লিখুন।' : 'Room number and at least 1 seat required.');
      return;
    }
    try {
      await saveRoom(
        {
          id: editingRoom?.id,
          roomNumber,
          roomName,
          totalSeats: Number(totalSeats),
          monthlyRent: Number(monthlyRent || 0),
          status,
          notes,
        },
        actor
      );
      setRoomModalOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !transferMember) return;
    setErrorMsg(null);
    const targetRoom = rooms.find((r) => r.id === targetRoomId);
    if (!targetRoom) return;
    try {
      await saveMember(
        {
          ...transferMember,
          roomId: targetRoom.id,
          roomNumber: targetRoom.roomNumber,
          seatNumber: targetSeat,
        },
        actor
      );
      setTransferMember(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteRoom = async () => {
    if (!actor || !deleteTarget) return;
    setErrorMsg(null);
    try {
      await deleteRoom(deleteTarget.id, actor);
      setDeleteTarget(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setDeleteTarget(null);
    }
  };

  const totalSeatsAll = roomInfoList.reduce((s, r) => s + r.room.totalSeats, 0);
  const totalOccupiedAll = roomInfoList.reduce((s, r) => s + r.occupiedSeats, 0);
  const totalEmptyAll = roomInfoList.reduce((s, r) => s + r.availableSeats, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.rooms}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? `মোট রুম ${formatNumber(rooms.length, lang)} · মোট সিট ${formatNumber(totalSeatsAll, lang)} · দখলকৃত ${formatNumber(totalOccupiedAll, lang)} · খালি ${formatNumber(totalEmptyAll, lang)}`
              : `${rooms.length} Rooms · ${totalSeatsAll} Seats · ${totalOccupiedAll} Occupied · ${totalEmptyAll} Available`}
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openAddRoom}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন রুম তৈরি' : 'Add Room'}</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Visual Room Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {roomInfoList.map(({ room, assignedMembers, occupiedSeats, availableSeats }) => (
          <Card key={room.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BedDouble className="w-5 h-5 text-[#17365D] dark:text-sky-300" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {room.roomNumber}
                  </h3>
                  {room.roomName && (
                    <span className="text-xs text-slate-500">({room.roomName})</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'bn' ? 'সিট ভাড়া:' : 'Rent:'} {formatBDT(room.monthlyRent, lang)} ·{' '}
                  {availableSeats > 0
                    ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatNumber(availableSeats, lang)} {lang === 'bn' ? 'টি সিট খালি' : 'Seats Free'}
                      </span>
                    : <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {lang === 'bn' ? 'পূর্ণ' : 'Full'}
                      </span>}
                </p>
              </div>

              {isManagerOrAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditRoom(room)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    title={t.edit}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(room)}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Visual Seat Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Array.from({ length: room.totalSeats }).map((_, idx) => {
                const occupant = assignedMembers[idx];
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-2 ${
                      occupant
                        ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                        : 'border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{lang === 'bn' ? `সিট ${formatNumber(idx + 1, lang)}` : `Seat ${idx + 1}`}</span>
                      {occupant ? (
                        <Users className="w-3.5 h-3.5 text-[#0F8B8D]" />
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {lang === 'bn' ? 'খালি' : 'Empty'}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {occupant ? occupant.fullName : lang === 'bn' ? 'ফাঁকা সিট' : 'Available'}
                    </div>
                    {occupant && isManagerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setTransferMember(occupant);
                          setTargetRoomId(occupant.roomId);
                          setTargetSeat(occupant.seatNumber || '');
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-[#0F8B8D] hover:underline cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span>{lang === 'bn' ? 'স্থানান্তর' : 'Transfer'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>
                {lang === 'bn'
                  ? `দখলকৃত: ${formatNumber(occupiedSeats, lang)} / ${formatNumber(room.totalSeats, lang)}`
                  : `Occupied: ${occupiedSeats} / ${room.totalSeats}`}
              </span>
              {room.notes && <span className="truncate max-w-[200px]">{room.notes}</span>}
            </div>
          </Card>
        ))}
      </div>

      {/* Empty Seats Summary */}
      <Card className="p-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
          {lang === 'bn' ? 'খালি সিটের তালিকা' : 'Available Empty Seats'}
        </h3>
        {roomInfoList.some((r) => r.availableSeats > 0) ? (
          <div className="flex flex-wrap gap-3">
            {roomInfoList
              .filter((r) => r.availableSeats > 0)
              .map((r) => (
                <div
                  key={r.room.id}
                  className="px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 text-sm"
                >
                  <span className="font-bold text-slate-900 dark:text-white">{r.room.roomNumber}</span>
                  <span className="text-slate-500 mx-1.5">·</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                    {formatNumber(r.availableSeats, lang)} {lang === 'bn' ? 'টি খালি সিট' : 'empty seats'}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {lang === 'bn' ? 'বর্তমানে কোনো খালি সিট নেই।' : 'No empty seats currently available.'}
          </p>
        )}
      </Card>

      {/* Add / Edit Room Modal */}
      <Modal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title={editingRoom ? (lang === 'bn' ? 'রুম সম্পাদনা' : 'Edit Room') : (lang === 'bn' ? 'নতুন রুম তৈরি' : 'Add New Room')}
      >
        <form onSubmit={handleSaveRoom} className="space-y-4">
          <InputField
            label={lang === 'bn' ? 'রুম নম্বর' : 'Room Number'}
            value={roomNumber}
            onChange={setRoomNumber}
            required
          />
          <InputField
            label={lang === 'bn' ? 'রুমের নাম / বিবরণ' : 'Room Name'}
            value={roomName}
            onChange={setRoomName}
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label={lang === 'bn' ? 'মোট সিট (ধারণক্ষমতা)' : 'Total Seats'}
              type="number"
              min="1"
              max="30"
              value={totalSeats}
              onChange={setTotalSeats}
              required
            />
            <InputField
              label={lang === 'bn' ? 'ডিফল্ট সিট ভাড়া (৳)' : 'Default Monthly Rent (৳)'}
              type="number"
              min="0"
              value={monthlyRent}
              onChange={setMonthlyRent}
            />
          </div>
          <SelectField
            label={lang === 'bn' ? 'রুমের অবস্থা' : 'Room Status'}
            value={status}
            onChange={(v) => setStatus(v as 'available' | 'full' | 'maintenance')}
            options={[
              { value: 'available', label: lang === 'bn' ? 'খালি আছে (Available)' : 'Available' },
              { value: 'full', label: lang === 'bn' ? 'পূর্ণ (Full)' : 'Full' },
              { value: 'maintenance', label: lang === 'bn' ? 'মেরামতাধীন' : 'Maintenance' },
            ]}
          />
          <InputField
            label={lang === 'bn' ? 'মন্তব্য' : 'Notes'}
            value={notes}
            onChange={setNotes}
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setRoomModalOpen(false)}
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

      {/* Transfer Member Modal */}
      <Modal
        open={!!transferMember}
        onClose={() => setTransferMember(null)}
        title={lang === 'bn' ? 'সদস্য রুম/সিট স্থানান্তর' : 'Transfer Member Room/Seat'}
      >
        {transferMember && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'সদস্য:' : 'Member:'} <strong>{transferMember.fullName}</strong>
            </p>
            <SelectField
              label={lang === 'bn' ? 'নতুন রুম নির্বাচন করুন' : 'Target Room'}
              value={targetRoomId}
              onChange={setTargetRoomId}
              options={roomInfoList.map((r) => ({
                value: r.room.id,
                label: `${r.room.roomNumber} (${lang === 'bn' ? `খালি ${r.availableSeats}` : `${r.availableSeats} free`})`,
              }))}
              required
            />
            <InputField
              label={lang === 'bn' ? 'সিট নম্বর' : 'Seat Number'}
              value={targetSeat}
              onChange={setTargetSeat}
            />
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransferMember(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#0F8B8D] text-white text-sm font-medium cursor-pointer"
              >
                {lang === 'bn' ? 'স্থানান্তর করুন' : 'Transfer'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={lang === 'bn' ? 'রুম মুছে ফেলুন' : 'Delete Room'}
        message={
          lang === 'bn'
            ? `আপনি কি নিশ্চিত যে "${deleteTarget?.roomNumber}" মুছে ফেলতে চান?`
            : `Are you sure you want to delete "${deleteTarget?.roomNumber}"?`
        }
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        danger
        onConfirm={handleDeleteRoom}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
