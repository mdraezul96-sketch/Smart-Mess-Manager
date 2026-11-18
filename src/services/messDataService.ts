import { localDb } from '../db/localDb';
import {
  AppNotification,
  AuditLog,
  Complaint,
  Expense,
  Guest,
  GuestMealRequest,
  GuestPayment,
  MealEntry,
  MealRequest,
  Member,
  MenuPoll,
  MenuVote,
  MessSettings,
  MonthlyBill,
  MonthlyClosing,
  Notice,
  NotificationType,
  Payment,
  PaymentMethod,
  PaymentRequest,
  Room,
  SyncConflict,
  UserAccount,
  UserRole,
  WeeklyMenu,
} from '../types/mess';
import {
  calculateMonthlySummary,
  getCurrentMonthKey,
  getTodayDateStr,
  isPastMealCutoff,
  round2,
} from '../utils/calculations';
import {
  buildInitialMembers,
  buildInitialRooms,
  buildInitialSettings,
  buildInitialWeeklyMenus,
  DEFAULT_MESS_ID,
} from './seedData';
import { enqueueOperation } from './syncEngine';

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export interface ActorContext {
  uid: string;
  name: string;
  role: UserRole;
}

async function getUidLists(actorUid: string): Promise<{ managerUids: string[]; readerUids: string[] }> {
  const allUsers = await localDb.users.toArray();
  const managerSet = new Set<string>([actorUid]);
  const readerSet = new Set<string>([actorUid]);
  for (const u of allUsers) {
    if (u.isActive) {
      readerSet.add(u.uid);
      if (u.role === 'admin' || u.role === 'manager') {
        managerSet.add(u.uid);
      }
    }
  }
  return {
    managerUids: Array.from(managerSet).slice(0, 20),
    readerUids: Array.from(readerSet).slice(0, 50),
  };
}

export async function recordAuditLog(
  actor: ActorContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  details?: string
): Promise<void> {
  const { managerUids } = await getUidLists(actor.uid);
  const log: AuditLog = {
    id: makeId('audit'),
    action,
    entityType,
    entityId,
    summary,
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: new Date().toISOString(),
    details: details || '',
    managerUids,
  };
  await localDb.auditLogs.put({ ...log, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'auditLogs',
    docId: log.id,
    operation: 'create',
    payload: log as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
}

export async function ensureInitialSeedData(actor: ActorContext): Promise<void> {
  const existingSettings = await localDb.messSettings.get(DEFAULT_MESS_ID);
  const existingRooms = await localDb.rooms.count();
  if (existingSettings?.isSeeded && existingRooms > 0) return;

  if (!existingSettings) {
    const settings = buildInitialSettings(actor.uid, actor.name);
    await localDb.messSettings.put(settings);
    if (actor.role === 'admin') {
      await enqueueOperation({
        collectionName: 'messSettings',
        docId: settings.id,
        operation: 'create',
        payload: settings as unknown as Record<string, unknown>,
        actorUid: actor.uid,
      });
    }
  }

  if (existingRooms === 0 && (actor.role === 'admin' || actor.role === 'manager')) {
    const rooms = buildInitialRooms(actor.uid);
    for (const r of rooms) {
      await localDb.rooms.put({ ...r, syncStatus: 'pending' });
      await enqueueOperation({
        collectionName: 'rooms',
        docId: r.id,
        operation: 'create',
        payload: r as unknown as Record<string, unknown>,
        actorUid: actor.uid,
      });
    }
  }

  const existingMembers = await localDb.members.count();
  if (existingMembers === 0 && (actor.role === 'admin' || actor.role === 'manager')) {
    const members = buildInitialMembers(actor.uid);
    for (const m of members) {
      await localDb.members.put({ ...m, syncStatus: 'pending' });
      await enqueueOperation({
        collectionName: 'members',
        docId: m.id,
        operation: 'create',
        payload: m as unknown as Record<string, unknown>,
        actorUid: actor.uid,
      });
    }
  }

  const existingMenus = await localDb.weeklyMenus.count();
  if (existingMenus === 0 && (actor.role === 'admin' || actor.role === 'manager')) {
    const menus = buildInitialWeeklyMenus(actor.uid);
    for (const menu of menus) {
      await localDb.weeklyMenus.put({ ...menu, syncStatus: 'pending' });
      await enqueueOperation({
        collectionName: 'weeklyMenus',
        docId: menu.id,
        operation: 'create',
        payload: menu as unknown as Record<string, unknown>,
        actorUid: actor.uid,
      });
    }
  }
}

// ------------------------------------------------------------------
// Rooms
// ------------------------------------------------------------------
export async function saveRoom(
  input: Omit<Room, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string },
  actor: ActorContext
): Promise<Room> {
  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.rooms.get(input.id) : undefined;
  const room: Room = {
    id: input.id || makeId('room'),
    roomNumber: input.roomNumber.trim(),
    roomName: input.roomName?.trim() || '',
    totalSeats: Number(input.totalSeats),
    monthlyRent: round2(Number(input.monthlyRent || 0)),
    status: input.status,
    notes: input.notes?.trim() || '',
    managerUids,
    readerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };
  await localDb.rooms.put({ ...room, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'rooms',
    docId: room.id,
    operation: existing ? 'update' : 'create',
    payload: room as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(
    actor,
    existing ? 'UPDATE_ROOM' : 'CREATE_ROOM',
    'rooms',
    room.id,
    `${existing ? 'রুম আপডেট' : 'নতুন রুম তৈরি'}: ${room.roomNumber} (${room.totalSeats} সিট)`
  );
  return room;
}

export async function deleteRoom(roomId: string, actor: ActorContext): Promise<void> {
  const activeInRoom = await localDb.members
    .where('roomId')
    .equals(roomId)
    .filter((m) => m.status === 'active')
    .count();
  if (activeInRoom > 0) {
    throw new Error('এই রুমে সক্রিয় সদস্য রয়েছে। আগে সদস্যদের অন্য রুমে স্থানান্তর করুন।');
  }
  const room = await localDb.rooms.get(roomId);
  await localDb.rooms.delete(roomId);
  await enqueueOperation({
    collectionName: 'rooms',
    docId: roomId,
    operation: 'delete',
    payload: null,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'DELETE_ROOM', 'rooms', roomId, `রুম মুছে ফেলা হয়েছে: ${room?.roomNumber || roomId}`);
}

// ------------------------------------------------------------------
// Members
// ------------------------------------------------------------------
export async function saveMember(
  input: Omit<Member, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string },
  actor: ActorContext
): Promise<Member> {
  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.members.get(input.id) : undefined;

  // Enforce room seat capacity when active
  if (input.status === 'active') {
    const room = await localDb.rooms.get(input.roomId);
    if (!room) {
      throw new Error('নির্বাচিত রুম পাওয়া যায়নি।');
    }
    const occupiedByOthers = await localDb.members
      .where('roomId')
      .equals(input.roomId)
      .filter((m) => m.status === 'active' && m.id !== input.id)
      .count();
    if (occupiedByOthers >= room.totalSeats) {
      throw new Error(`${room.roomNumber}-এ কোনো খালি সিট নেই (সর্বোচ্চ ${room.totalSeats}টি সিট)।`);
    }
  }

  // Auto-match existing active user by email if linkedUid is empty
  let resolvedLinkedUid = input.linkedUid || existing?.linkedUid || '';
  const cleanEmail = input.email?.trim().toLowerCase() || '';
  if (!resolvedLinkedUid && cleanEmail) {
    const matchedUser = await localDb.users
      .filter((u) => (u.email || '').trim().toLowerCase() === cleanEmail)
      .first();
    if (matchedUser) {
      resolvedLinkedUid = matchedUser.uid;
    }
  }

  const member: Member = {
    id: input.id || makeId('member'),
    fullName: input.fullName.trim(),
    fatherName: input.fatherName?.trim() || '',
    mobile: input.mobile?.trim() || '',
    altMobile: input.altMobile?.trim() || '',
    email: input.email?.trim() || '',
    permanentAddress: input.permanentAddress?.trim() || '',
    presentAddress: input.presentAddress?.trim() || '',
    nidNumber: input.nidNumber?.trim() || '',
    emergencyContact: input.emergencyContact?.trim() || '',
    joiningDate: input.joiningDate || '',
    leavingDate: input.leavingDate || '',
    roomId: input.roomId,
    roomNumber: input.roomNumber,
    seatNumber: input.seatNumber?.trim() || '',
    monthlyRent: round2(Number(input.monthlyRent || 0)),
    advanceAmount: round2(Number(input.advanceAmount || 0)),
    status: input.status,
    linkedUid: resolvedLinkedUid,
    photoUrl: input.photoUrl || '',
    managerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };

  await localDb.members.put({ ...member, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'members',
    docId: member.id,
    operation: existing ? 'update' : 'create',
    payload: member as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });

  if (resolvedLinkedUid && actor.role === 'admin') {
    const linkedUser = await localDb.users.get(resolvedLinkedUid);
    if (linkedUser && linkedUser.memberId !== member.id) {
      const updatedUser: UserAccount = {
        ...linkedUser,
        memberId: member.id,
        managerUids,
        updatedAt: now,
      };
      await localDb.users.put(updatedUser);
      await enqueueOperation({
        collectionName: 'users',
        docId: linkedUser.uid,
        operation: 'update',
        payload: updatedUser as unknown as Record<string, unknown>,
        baseUpdatedAt: linkedUser.updatedAt,
        actorUid: actor.uid,
      });
    }
  }

  await recordAuditLog(
    actor,
    existing ? 'UPDATE_MEMBER' : 'CREATE_MEMBER',
    'members',
    member.id,
    `${existing ? 'সদস্যের তথ্য আপডেট' : 'নতুন সদস্য যোগ'}: ${member.fullName} (${member.roomNumber})`
  );
  await recalculateMonthLedger(getCurrentMonthKey(), actor);
  if (resolvedLinkedUid) {
    await backfillMemberLinksAndReaders(actor);
  }
  return member;
}

export async function archiveMember(memberId: string, actor: ActorContext): Promise<void> {
  const existing = await localDb.members.get(memberId);
  if (!existing) return;
  const updated: Member = {
    ...existing,
    status: 'archived',
    leavingDate: existing.leavingDate || getTodayDateStr(),
    updatedAt: new Date().toISOString(),
  };
  await localDb.members.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'members',
    docId: memberId,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: existing.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'ARCHIVE_MEMBER', 'members', memberId, `সদস্য আর্কাইভ করা হয়েছে: ${existing.fullName}`);
  await recalculateMonthLedger(getCurrentMonthKey(), actor);
}

export async function deleteMemberPermanent(memberId: string, actor: ActorContext): Promise<void> {
  const existing = await localDb.members.get(memberId);
  await localDb.members.delete(memberId);
  await enqueueOperation({
    collectionName: 'members',
    docId: memberId,
    operation: 'delete',
    payload: null,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'DELETE_MEMBER', 'members', memberId, `সদস্য মুছে ফেলা হয়েছে: ${existing?.fullName || memberId}`);
  await recalculateMonthLedger(getCurrentMonthKey(), actor);
}

// ------------------------------------------------------------------
// Meal Entries (Deterministic ID `${date}_${memberId}` prevents duplicates)
// ------------------------------------------------------------------
export async function saveMealEntry(
  input: {
    date: string;
    member: Member;
    breakfast: number;
    lunch: number;
    dinner: number;
    notes?: string;
  },
  actor: ActorContext,
  skipRecalc = false
): Promise<MealEntry> {
  const monthKey = input.date.slice(0, 7);
  const closing = await localDb.monthlyClosings.get(monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error(`${monthKey} মাসের হিসাব বন্ধ রয়েছে। পরিবর্তনের জন্য Admin-এর অনুমতি প্রয়োজন।`);
  }

  const entryId = `${input.date}_${input.member.id}`;
  const existing = await localDb.mealEntries.get(entryId);
  if (existing?.isLocked && actor.role !== 'admin') {
    throw new Error('এই মিল এন্ট্রি লক করা আছে। সংশোধনের জন্য Admin প্রয়োজন।');
  }

  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const breakfast = round2(Math.max(0, Number(input.breakfast || 0)));
  const lunch = round2(Math.max(0, Number(input.lunch || 0)));
  const dinner = round2(Math.max(0, Number(input.dinner || 0)));
  const totalMeals = round2(breakfast + lunch + dinner);

  const entry: MealEntry = {
    id: entryId,
    date: input.date,
    monthKey,
    memberId: input.member.id,
    memberUid: input.member.linkedUid || existing?.memberUid || '',
    memberName: input.member.fullName,
    breakfast,
    lunch,
    dinner,
    totalMeals,
    notes: input.notes?.trim() || '',
    isLocked: existing?.isLocked || false,
    managerUids,
    readerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };

  await localDb.mealEntries.put({ ...entry, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'mealEntries',
    docId: entry.id,
    operation: existing ? 'update' : 'create',
    payload: entry as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });

  if (!skipRecalc) {
    await recalculateMonthLedger(monthKey, actor);
  }
  return entry;
}

export async function saveDailyMealsBatch(
  input: {
    date: string;
    rows: Array<{
      member: Member;
      breakfast: number;
      lunch: number;
      dinner: number;
      notes?: string;
    }>;
  },
  actor: ActorContext
): Promise<MealEntry[]> {
  const monthKey = input.date.slice(0, 7);
  const closing = await localDb.monthlyClosings.get(monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error(`${monthKey} মাসের হিসাব বন্ধ রয়েছে। পরিবর্তনের জন্য Admin-এর অনুমতি প্রয়োজন।`);
  }

  const saved: MealEntry[] = [];
  for (const row of input.rows) {
    const entry = await saveMealEntry(
      {
        date: input.date,
        member: row.member,
        breakfast: row.breakfast,
        lunch: row.lunch,
        dinner: row.dinner,
        notes: row.notes,
      },
      actor,
      true
    );
    saved.push(entry);
  }

  await recalculateMonthLedger(monthKey, actor);
  return saved;
}

export async function toggleMealLockForMonth(monthKey: string, lock: boolean, actor: ActorContext): Promise<void> {
  const entries = await localDb.mealEntries.where('monthKey').equals(monthKey).toArray();
  const now = new Date().toISOString();
  for (const e of entries) {
    const updated: MealEntry = { ...e, isLocked: lock, updatedAt: now };
    await localDb.mealEntries.put({ ...updated, syncStatus: 'pending' });
    await enqueueOperation({
      collectionName: 'mealEntries',
      docId: e.id,
      operation: 'update',
      payload: updated as unknown as Record<string, unknown>,
      baseUpdatedAt: e.updatedAt,
      actorUid: actor.uid,
    });
  }
  await recordAuditLog(
    actor,
    lock ? 'LOCK_MEALS' : 'UNLOCK_MEALS',
    'mealEntries',
    monthKey,
    `${monthKey} মাসের সকল মিল ${lock ? 'লক' : 'আনলক'} করা হয়েছে`
  );
}

// ------------------------------------------------------------------
// Expenses (Market & Other) with Voiding
// ------------------------------------------------------------------
export async function saveExpense(
  input: Omit<Expense, 'id' | 'monthKey' | 'isVoided' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string },
  actor: ActorContext
): Promise<Expense> {
  const monthKey = input.date.slice(0, 7);
  const closing = await localDb.monthlyClosings.get(monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error(`${monthKey} মাসের হিসাব বন্ধ রয়েছে। পরিবর্তনের জন্য Admin প্রয়োজন।`);
  }

  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.expenses.get(input.id) : undefined;

  const expense: Expense = {
    id: input.id || makeId('exp'),
    date: input.date,
    monthKey,
    expenseGroup: input.expenseGroup,
    category: input.category,
    itemName: input.itemName.trim(),
    quantity: input.quantity !== undefined ? Number(input.quantity) : undefined,
    unit: input.unit?.trim() || '',
    unitPrice: input.unitPrice !== undefined ? round2(Number(input.unitPrice)) : undefined,
    amount: round2(Number(input.amount)),
    paidByMemberId: input.paidByMemberId || '',
    paidByName: input.paidByName || '',
    shopperName: input.shopperName?.trim() || '',
    paymentMethod: input.paymentMethod,
    receiptUrl: input.receiptUrl || '',
    notes: input.notes?.trim() || '',
    isVoided: existing?.isVoided || false,
    voidReason: existing?.voidReason || '',
    managerUids,
    readerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };

  await localDb.expenses.put({ ...expense, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'expenses',
    docId: expense.id,
    operation: existing ? 'update' : 'create',
    payload: expense as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(
    actor,
    existing ? 'UPDATE_EXPENSE' : 'CREATE_EXPENSE',
    'expenses',
    expense.id,
    `${expense.expenseGroup === 'market' ? 'বাজার খরচ' : 'অন্যান্য খরচ'}: ${expense.itemName} (৳${expense.amount})`
  );
  await recalculateMonthLedger(monthKey, actor);
  if (!existing && expense.expenseGroup === 'market') {
    await createNotification(
      {
        targetUid: 'ALL',
        type: 'market_expense',
        title: 'নতুন বাজার খরচ যুক্ত হয়েছে',
        body: `${expense.date}: ${expense.itemName} — ৳${expense.amount}`,
      },
      actor
    );
  }
  return expense;
}

export async function voidExpense(expenseId: string, reason: string, actor: ActorContext): Promise<void> {
  const existing = await localDb.expenses.get(expenseId);
  if (!existing) return;
  const closing = await localDb.monthlyClosings.get(existing.monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error('বন্ধ মাসের খরচ বাতিল করতে Admin অনুমতি প্রয়োজন।');
  }
  const updated: Expense = {
    ...existing,
    isVoided: true,
    voidReason: reason.trim() || 'ভুল এন্ট্রি বাতিল (Void)',
    updatedAt: new Date().toISOString(),
  };
  await localDb.expenses.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'expenses',
    docId: expenseId,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: existing.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'VOID_EXPENSE', 'expenses', expenseId, `খরচ বাতিল (Void): ${existing.itemName} (৳${existing.amount}) — ${updated.voidReason}`);
  await recalculateMonthLedger(existing.monthKey, actor);
}

// ------------------------------------------------------------------
// Member Payments
// ------------------------------------------------------------------
export async function savePayment(
  input: Omit<Payment, 'id' | 'receiptNo' | 'isVoided' | 'createdAt' | 'updatedAt' | 'createdBy'> & {
    id?: string;
    receiptNo?: string;
  },
  actor: ActorContext
): Promise<Payment> {
  const closing = await localDb.monthlyClosings.get(input.monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error(`${input.monthKey} মাসের হিসাব বন্ধ রয়েছে। পরিবর্তনের জন্য Admin প্রয়োজন।`);
  }

  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.payments.get(input.id) : undefined;
  const member = await localDb.members.get(input.memberId);

  const payment: Payment = {
    id: input.id || makeId('pay'),
    memberId: input.memberId,
    memberUid: member?.linkedUid || input.memberUid || '',
    memberName: member?.fullName || input.memberName,
    monthKey: input.monthKey,
    paymentDate: input.paymentDate,
    amount: round2(Number(input.amount)),
    paymentMethod: input.paymentMethod,
    transactionId: input.transactionId?.trim() || '',
    receiptNo: existing?.receiptNo || input.receiptNo || `RCP-${Date.now().toString().slice(-6)}`,
    notes: input.notes?.trim() || '',
    isVoided: existing?.isVoided || false,
    voidReason: existing?.voidReason || '',
    managerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };

  await localDb.payments.put({ ...payment, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'payments',
    docId: payment.id,
    operation: existing ? 'update' : 'create',
    payload: payment as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(
    actor,
    existing ? 'UPDATE_PAYMENT' : 'CREATE_PAYMENT',
    'payments',
    payment.id,
    `টাকা জমা (${payment.receiptNo}): ${payment.memberName} — ৳${payment.amount} (${payment.paymentMethod})`
  );
  await recalculateMonthLedger(input.monthKey, actor);
  return payment;
}

export async function voidPayment(paymentId: string, reason: string, actor: ActorContext): Promise<void> {
  const existing = await localDb.payments.get(paymentId);
  if (!existing) return;
  const closing = await localDb.monthlyClosings.get(existing.monthKey);
  if (closing?.isClosed && actor.role !== 'admin') {
    throw new Error('বন্ধ মাসের পেমেন্ট বাতিল করতে Admin অনুমতি প্রয়োজন।');
  }
  const updated: Payment = {
    ...existing,
    isVoided: true,
    voidReason: reason.trim() || 'ভুল পেমেন্ট এন্ট্রি বাতিল (Void)',
    updatedAt: new Date().toISOString(),
  };
  await localDb.payments.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'payments',
    docId: paymentId,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: existing.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'VOID_PAYMENT', 'payments', paymentId, `পেমেন্ট বাতিল (Void): ${existing.memberName} (৳${existing.amount})`);
  await recalculateMonthLedger(existing.monthKey, actor);
}

// ------------------------------------------------------------------
// Monthly Bills & Closing (Automatic + Manual Snapshot)
// ------------------------------------------------------------------
export async function recalculateMonthLedger(
  monthKey: string,
  actor: ActorContext,
  customOtherPerMember?: number
): Promise<{ closing: MonthlyClosing; bills: MonthlyBill[] } | null> {
  if (actor.role !== 'admin' && actor.role !== 'manager') return null;

  const existingClosing = await localDb.monthlyClosings.get(monthKey);
  if (existingClosing?.isClosed && actor.role !== 'admin') {
    return null;
  }

  const members = await localDb.members.toArray();
  const mealEntries = await localDb.mealEntries.toArray();
  const expenses = await localDb.expenses.toArray();
  const payments = await localDb.payments.toArray();
  const guestMealRequests = await localDb.guestMealRequests.toArray();

  const summary = calculateMonthlySummary({
    monthKey,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
    customOtherPerMember,
  });

  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);

  const closing: MonthlyClosing = {
    id: monthKey,
    monthKey,
    totalMarketCost: summary.totalMarketCost,
    totalOtherCost: summary.totalOtherCost,
    totalMeals: summary.totalMeals,
    mealRate: summary.mealRate,
    otherChargePerMember: summary.otherChargePerMember,
    isClosed: existingClosing?.isClosed || false,
    closedAt: existingClosing?.closedAt || '',
    closedBy: existingClosing?.closedBy || '',
    notes: existingClosing?.notes || '',
    managerUids,
    readerUids,
    updatedAt: now,
  };

  await localDb.monthlyClosings.put({ ...closing, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'monthlyClosings',
    docId: closing.id,
    operation: existingClosing ? 'update' : 'create',
    payload: closing as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });

  const bills: MonthlyBill[] = [];
  for (const calc of summary.memberCalculations) {
    const billId = `${monthKey}_${calc.member.id}`;
    const existingBill = await localDb.monthlyBills.get(billId);
    const bill: MonthlyBill = {
      id: billId,
      monthKey,
      memberId: calc.member.id,
      memberUid: calc.member.linkedUid || '',
      memberName: calc.member.fullName,
      totalMeals: calc.totalMeals,
      mealRate: calc.mealRate,
      foodCost: calc.foodCost,
      roomRent: calc.roomRent,
      otherCharges: calc.otherCharges,
      guestMealCost: calc.guestMealCost,
      totalBill: calc.totalBill,
      totalPaid: calc.totalPaid,
      dueAmount: calc.dueAmount,
      advanceAmount: calc.advanceAmount,
      isLocked: closing.isClosed,
      managerUids,
      generatedAt: existingBill?.generatedAt || now,
      updatedAt: now,
      generatedBy: actor.uid,
    };
    await localDb.monthlyBills.put({ ...bill, syncStatus: 'pending' });
    await enqueueOperation({
      collectionName: 'monthlyBills',
      docId: bill.id,
      operation: existingBill ? 'update' : 'create',
      payload: bill as unknown as Record<string, unknown>,
      actorUid: actor.uid,
    });
    bills.push(bill);
  }

  return { closing, bills };
}

export async function generateMonthlyBills(
  monthKey: string,
  customOtherPerMember: number | undefined,
  actor: ActorContext
): Promise<{ closing: MonthlyClosing; bills: MonthlyBill[] }> {
  const existingClosing = await localDb.monthlyClosings.get(monthKey);
  if (existingClosing?.isClosed && actor.role !== 'admin') {
    throw new Error('এই মাসের হিসাব ইতিমধ্যে Close করা হয়েছে। পুনরায় Generate করতে Admin অনুমতি প্রয়োজন।');
  }

  const result = await recalculateMonthLedger(monthKey, actor, customOtherPerMember);
  if (!result) {
    throw new Error('বিল হিসাব আপডেট করতে Admin বা Manager অনুমতি প্রয়োজন।');
  }

  await recordAuditLog(
    actor,
    'GENERATE_MONTHLY_BILL',
    'monthlyClosings',
    monthKey,
    `${monthKey} মাসের বিল তৈরি (মিল রেট: ৳${result.closing.mealRate}, মোট মিল: ${result.closing.totalMeals})`
  );

  await createNotification(
    {
      targetUid: 'ALL',
      type: 'bill_published',
      title: `${monthKey} মাসের বিল প্রকাশিত হয়েছে`,
      body: `মিল রেট: ৳${result.closing.mealRate}। আপনার বিস্তারিত বিল "আমার বিল" সেকশনে দেখুন।`,
    },
    actor
  );

  return result;
}

export async function setMonthClosedStatus(
  monthKey: string,
  close: boolean,
  actor: ActorContext
): Promise<void> {
  if (!close && actor.role !== 'admin') {
    throw new Error('বন্ধ মাস পুনরায় খুলতে শুধুমাত্র Admin-এর অনুমতি রয়েছে।');
  }
  const existing = await localDb.monthlyClosings.get(monthKey);
  if (!existing) {
    await generateMonthlyBills(monthKey, undefined, actor);
  }
  const latest = (await localDb.monthlyClosings.get(monthKey))!;
  const now = new Date().toISOString();
  const updated: MonthlyClosing = {
    ...latest,
    isClosed: close,
    closedAt: close ? now : '',
    closedBy: close ? actor.uid : '',
    updatedAt: now,
  };
  await localDb.monthlyClosings.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'monthlyClosings',
    docId: monthKey,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: latest.updatedAt,
    actorUid: actor.uid,
  });

  const bills = await localDb.monthlyBills.where('monthKey').equals(monthKey).toArray();
  for (const b of bills) {
    const ub: MonthlyBill = { ...b, isLocked: close, updatedAt: now };
    await localDb.monthlyBills.put({ ...ub, syncStatus: 'pending' });
    await enqueueOperation({
      collectionName: 'monthlyBills',
      docId: b.id,
      operation: 'update',
      payload: ub as unknown as Record<string, unknown>,
      baseUpdatedAt: b.updatedAt,
      actorUid: actor.uid,
    });
  }

  await toggleMealLockForMonth(monthKey, close, actor);
  await recordAuditLog(
    actor,
    close ? 'CLOSE_MONTH' : 'REOPEN_MONTH',
    'monthlyClosings',
    monthKey,
    `${monthKey} মাসের হিসাব ${close ? 'Close ও Lock' : 'Reopen'} করা হয়েছে`
  );
}

// ------------------------------------------------------------------
// Guests & Guest Payments
// ------------------------------------------------------------------
export async function saveGuest(
  input: Omit<Guest, 'id' | 'totalAmount' | 'remainingDue' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string },
  actor: ActorContext
): Promise<Guest> {
  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.guests.get(input.id) : undefined;
  const totalDays = Math.max(1, Number(input.totalDays || 1));
  const dailyCharge = round2(Math.max(0, Number(input.dailyCharge || 0)));
  const totalAmount = round2(totalDays * dailyCharge);
  const paidAmount = round2(Math.max(0, Number(input.paidAmount || 0)));
  const remainingDue = round2(Math.max(0, totalAmount - paidAmount));

  const guest: Guest = {
    id: input.id || makeId('guest'),
    guestName: input.guestName.trim(),
    mobile: input.mobile?.trim() || '',
    arrivalDate: input.arrivalDate,
    departureDate: input.departureDate || '',
    totalDays,
    roomId: input.roomId || '',
    roomNumber: input.roomNumber || '',
    dailyCharge,
    totalAmount,
    paidAmount,
    remainingDue,
    notes: input.notes?.trim() || '',
    status: input.status,
    managerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };

  await localDb.guests.put({ ...guest, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'guests',
    docId: guest.id,
    operation: existing ? 'update' : 'create',
    payload: guest as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });

  if (!existing && paidAmount > 0) {
    await recordGuestPayment(
      {
        guestId: guest.id,
        guestName: guest.guestName,
        paymentDate: guest.arrivalDate,
        amount: paidAmount,
        paymentMethod: 'Cash',
        notes: 'প্রাথমিক জমা',
      },
      actor,
      true
    );
  }

  await recordAuditLog(
    actor,
    existing ? 'UPDATE_GUEST' : 'CREATE_GUEST',
    'guests',
    guest.id,
    `অতিথি ${existing ? 'আপডেট' : 'যোগ'}: ${guest.guestName} (${guest.totalDays} দিন, বিল ৳${guest.totalAmount})`
  );
  return guest;
}

export async function recordGuestPayment(
  input: Omit<GuestPayment, 'id' | 'createdAt' | 'createdBy'>,
  actor: ActorContext,
  skipGuestTotalUpdate = false
): Promise<GuestPayment> {
  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const gp: GuestPayment = {
    id: makeId('gpay'),
    guestId: input.guestId,
    guestName: input.guestName,
    paymentDate: input.paymentDate,
    amount: round2(Number(input.amount)),
    paymentMethod: input.paymentMethod,
    notes: input.notes?.trim() || '',
    managerUids,
    createdAt: now,
    createdBy: actor.uid,
  };

  await localDb.guestPayments.put({ ...gp, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'guestPayments',
    docId: gp.id,
    operation: 'create',
    payload: gp as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });

  if (!skipGuestTotalUpdate) {
    const guest = await localDb.guests.get(input.guestId);
    if (guest) {
      const paidAmount = round2(guest.paidAmount + gp.amount);
      const remainingDue = round2(Math.max(0, guest.totalAmount - paidAmount));
      const updatedGuest: Guest = {
        ...guest,
        paidAmount,
        remainingDue,
        updatedAt: now,
      };
      await localDb.guests.put({ ...updatedGuest, syncStatus: 'pending' });
      await enqueueOperation({
        collectionName: 'guests',
        docId: guest.id,
        operation: 'update',
        payload: updatedGuest as unknown as Record<string, unknown>,
        baseUpdatedAt: guest.updatedAt,
        actorUid: actor.uid,
      });
    }
  }

  await recordAuditLog(actor, 'GUEST_PAYMENT', 'guestPayments', gp.id, `অতিথির পেমেন্ট: ${gp.guestName} — ৳${gp.amount}`);
  return gp;
}

// ------------------------------------------------------------------
// Weekly Menu & Notices & Settings
// ------------------------------------------------------------------
export async function saveWeeklyMenu(menu: WeeklyMenu, actor: ActorContext): Promise<void> {
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const updated: WeeklyMenu = {
    ...menu,
    managerUids,
    readerUids,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.uid,
  };
  await localDb.weeklyMenus.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'weeklyMenus',
    docId: updated.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: menu.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'UPDATE_MENU', 'weeklyMenus', updated.id, `সাপ্তাহিক মেনু আপডেট: ${updated.dayNameBn}`);
  await createNotification(
    {
      targetUid: 'ALL',
      type: 'menu_updated',
      title: `${updated.dayNameBn}-এর খাবারের মেনু আপডেট হয়েছে`,
      body: `সকাল: ${updated.breakfast || '-'} · দুপুর: ${updated.lunch || '-'} · রাত: ${updated.dinner || '-'}`,
    },
    actor
  );
}

export async function saveNotice(
  input: Omit<Notice, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: string },
  actor: ActorContext
): Promise<Notice> {
  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const existing = input.id ? await localDb.notices.get(input.id) : undefined;
  const notice: Notice = {
    id: input.id || makeId('notice'),
    title: input.title.trim(),
    description: input.description.trim(),
    publishDate: input.publishDate,
    category: input.category,
    isPinned: input.isPinned,
    managerUids,
    readerUids,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    createdBy: existing?.createdBy || actor.uid,
  };
  await localDb.notices.put({ ...notice, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'notices',
    docId: notice.id,
    operation: existing ? 'update' : 'create',
    payload: notice as unknown as Record<string, unknown>,
    baseUpdatedAt: existing?.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, existing ? 'UPDATE_NOTICE' : 'CREATE_NOTICE', 'notices', notice.id, `নোটিশ ${existing ? 'আপডেট' : 'প্রকাশ'}: ${notice.title}`);
  if (!existing) {
    await createNotification(
      {
        targetUid: 'ALL',
        type: 'notice',
        title: `নতুন নোটিশ: ${notice.title}`,
        body: notice.description.slice(0, 220),
      },
      actor
    );
  }
  return notice;
}

export async function deleteNotice(noticeId: string, actor: ActorContext): Promise<void> {
  const existing = await localDb.notices.get(noticeId);
  await localDb.notices.delete(noticeId);
  await enqueueOperation({
    collectionName: 'notices',
    docId: noticeId,
    operation: 'delete',
    payload: null,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'DELETE_NOTICE', 'notices', noticeId, `নোটিশ মুছে ফেলা হয়েছে: ${existing?.title || noticeId}`);
}

export async function saveMessSettings(settings: MessSettings, actor: ActorContext): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('মেসের সেটিংস পরিবর্তন করার অনুমতি শুধুমাত্র Admin-এর রয়েছে।');
  }
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const updated: MessSettings = {
    ...settings,
    managerUids,
    readerUids,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.uid,
  };
  await localDb.messSettings.put(updated);
  await enqueueOperation({
    collectionName: 'messSettings',
    docId: updated.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: settings.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, 'UPDATE_SETTINGS', 'messSettings', updated.id, 'মেস সেটিংস আপডেট করা হয়েছে');
}

// ------------------------------------------------------------------
// User Roles & Conflicts & Backup Restore
// ------------------------------------------------------------------
export async function updateUserRoleAndLink(
  targetUser: UserAccount,
  newRole: UserRole,
  isActive: boolean,
  memberId: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('ইউজার রোল ও অ্যাক্সেস পরিবর্তন করার অনুমতি শুধুমাত্র Owner/Admin-এর রয়েছে।');
  }
  if (targetUser.email === 'mdraezul96@gmail.com' && newRole !== 'admin') {
    throw new Error('প্রধান Owner অ্যাকাউন্টের Admin অধিকার বাতিল করা যাবে না।');
  }
  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const updatedUser: UserAccount = {
    ...targetUser,
    role: newRole,
    isActive,
    memberId: memberId || '',
    managerUids,
    updatedAt: now,
  };
  await localDb.users.put(updatedUser);
  await enqueueOperation({
    collectionName: 'users',
    docId: targetUser.uid,
    operation: 'update',
    payload: updatedUser as unknown as Record<string, unknown>,
    baseUpdatedAt: targetUser.updatedAt,
    actorUid: actor.uid,
  });

  // Unlink any previous member linked to this user if changed
  const prevLinkedMembers = await localDb.members
    .filter((m) => m.linkedUid === targetUser.uid && m.id !== memberId)
    .toArray();
  for (const pm of prevLinkedMembers) {
    const unlinked: Member = { ...pm, linkedUid: '', updatedAt: now };
    await localDb.members.put({ ...unlinked, syncStatus: 'pending' });
    await enqueueOperation({
      collectionName: 'members',
      docId: pm.id,
      operation: 'update',
      payload: unlinked as unknown as Record<string, unknown>,
      baseUpdatedAt: pm.updatedAt,
      actorUid: actor.uid,
    });
  }

  // Link Member.linkedUid if memberId specified
  if (memberId) {
    const member = await localDb.members.get(memberId);
    if (member && member.linkedUid !== targetUser.uid) {
      const updatedMember: Member = { ...member, linkedUid: targetUser.uid, updatedAt: now };
      await localDb.members.put({ ...updatedMember, syncStatus: 'pending' });
      await enqueueOperation({
        collectionName: 'members',
        docId: member.id,
        operation: 'update',
        payload: updatedMember as unknown as Record<string, unknown>,
        baseUpdatedAt: member.updatedAt,
        actorUid: actor.uid,
      });
    }
  }

  await recordAuditLog(
    actor,
    'UPDATE_USER_ROLE',
    'users',
    targetUser.uid,
    `ইউজার রোল আপডেট: ${targetUser.displayName} -> ${newRole} (${isActive ? 'Active' : 'Inactive'})`
  );

  await backfillMemberLinksAndReaders(actor);
  await recalculateMonthLedger(getCurrentMonthKey(), actor);
}

let isReconcilingAccess = false;

export async function backfillMemberLinksAndReaders(actor: ActorContext): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') return;
  if (isReconcilingAccess) return;
  isReconcilingAccess = true;

  try {
    const now = new Date().toISOString();
    const allUsers = await localDb.users.toArray();
    const allMembers = await localDb.members.toArray();
    const { managerUids, readerUids } = await getUidLists(actor.uid);

    // 1. Auto-link unlinked users <-> members by matching email (Admin only for user doc writes)
    if (actor.role === 'admin') {
      for (const m of allMembers) {
        const cleanEmail = (m.email || '').trim().toLowerCase();
        if (!cleanEmail) continue;
        const matchedUser = allUsers.find(
          (u) => u.isActive && (u.email || '').trim().toLowerCase() === cleanEmail
        );
        if (!matchedUser) continue;

        if (!m.linkedUid) {
          const updatedMember: Member = { ...m, linkedUid: matchedUser.uid, managerUids, updatedAt: now };
          m.linkedUid = matchedUser.uid;
          await localDb.members.put({ ...updatedMember, syncStatus: 'pending' });
          await enqueueOperation({
            collectionName: 'members',
            docId: m.id,
            operation: 'update',
            payload: updatedMember as unknown as Record<string, unknown>,
            baseUpdatedAt: m.updatedAt,
            actorUid: actor.uid,
          });
        }
        if (!matchedUser.memberId) {
          const updatedUser: UserAccount = { ...matchedUser, memberId: m.id, managerUids, updatedAt: now };
          matchedUser.memberId = m.id;
          await localDb.users.put(updatedUser);
          await enqueueOperation({
            collectionName: 'users',
            docId: matchedUser.uid,
            operation: 'update',
            payload: updatedUser as unknown as Record<string, unknown>,
            baseUpdatedAt: matchedUser.updatedAt,
            actorUid: actor.uid,
          });
        }
      }
    }

    // Build memberId -> linkedUid map
    const memberUidMap = new Map<string, string>();
    for (const m of allMembers) {
      if (m.linkedUid) {
        memberUidMap.set(m.id, m.linkedUid);
      }
    }

    const activeReaderSet = new Set(readerUids);
    const missingReader = (existingReaders?: string[]) => {
      const existing = new Set(existingReaders || []);
      for (const uid of activeReaderSet) {
        if (!existing.has(uid)) return true;
      }
      return false;
    };

    // 2. Backfill memberUid + readerUids on mealEntries
    const mealEntries = await localDb.mealEntries.toArray();
    for (const entry of mealEntries) {
      if (entry.isLocked && actor.role !== 'admin') continue;
      const targetUid = memberUidMap.get(entry.memberId) || '';
      const needsUid = targetUid && entry.memberUid !== targetUid;
      const needsReader = missingReader(entry.readerUids);
      if (needsUid || needsReader) {
        const updated: MealEntry = {
          ...entry,
          memberUid: targetUid || entry.memberUid || '',
          managerUids,
          readerUids,
          updatedAt: now,
        };
        await localDb.mealEntries.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'mealEntries',
          docId: entry.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    // 3. Backfill memberUid on payments
    const payments = await localDb.payments.toArray();
    for (const p of payments) {
      const targetUid = memberUidMap.get(p.memberId) || '';
      if (targetUid && p.memberUid !== targetUid) {
        const updated: Payment = {
          ...p,
          memberUid: targetUid,
          managerUids,
          updatedAt: now,
        };
        await localDb.payments.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'payments',
          docId: p.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    // 4. Backfill memberUid on monthlyBills
    const bills = await localDb.monthlyBills.toArray();
    for (const b of bills) {
      if (b.isLocked && actor.role !== 'admin') continue;
      const targetUid = memberUidMap.get(b.memberId) || '';
      if (targetUid && b.memberUid !== targetUid) {
        const updated: MonthlyBill = {
          ...b,
          memberUid: targetUid,
          managerUids,
          updatedAt: now,
        };
        await localDb.monthlyBills.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'monthlyBills',
          docId: b.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    // 5. Refresh readerUids on shared collections so newly joined members read them via Firestore onSnapshot
    if (actor.role === 'admin') {
      const settings = await localDb.messSettings.get(DEFAULT_MESS_ID);
      if (settings && missingReader(settings.readerUids)) {
        const updatedSettings: MessSettings = {
          ...settings,
          managerUids,
          readerUids,
          updatedAt: now,
          updatedBy: actor.uid,
        };
        await localDb.messSettings.put(updatedSettings);
        await enqueueOperation({
          collectionName: 'messSettings',
          docId: settings.id,
          operation: 'update',
          payload: updatedSettings as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const rooms = await localDb.rooms.toArray();
    for (const r of rooms) {
      if (missingReader(r.readerUids)) {
        const updated: Room = { ...r, managerUids, readerUids, updatedAt: now };
        await localDb.rooms.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'rooms',
          docId: r.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const expenses = await localDb.expenses.toArray();
    for (const exp of expenses) {
      if (missingReader(exp.readerUids)) {
        const updated: Expense = { ...exp, managerUids, readerUids, updatedAt: now };
        await localDb.expenses.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'expenses',
          docId: exp.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const closings = await localDb.monthlyClosings.toArray();
    for (const c of closings) {
      if (c.isClosed && actor.role !== 'admin') continue;
      if (missingReader(c.readerUids)) {
        const updated: MonthlyClosing = { ...c, managerUids, readerUids, updatedAt: now };
        await localDb.monthlyClosings.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'monthlyClosings',
          docId: c.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const menus = await localDb.weeklyMenus.toArray();
    for (const wm of menus) {
      if (missingReader(wm.readerUids)) {
        const updated: WeeklyMenu = { ...wm, managerUids, readerUids, updatedAt: now };
        await localDb.weeklyMenus.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'weeklyMenus',
          docId: wm.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const notices = await localDb.notices.toArray();
    for (const n of notices) {
      if (missingReader(n.readerUids)) {
        const updated: Notice = { ...n, managerUids, readerUids, updatedAt: now };
        await localDb.notices.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'notices',
          docId: n.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    const polls = await localDb.menuPolls.toArray();
    for (const pl of polls) {
      if (missingReader(pl.readerUids)) {
        const updated: MenuPoll = { ...pl, managerUids, readerUids, updatedAt: now };
        await localDb.menuPolls.put({ ...updated, syncStatus: 'pending' });
        await enqueueOperation({
          collectionName: 'menuPolls',
          docId: pl.id,
          operation: 'update',
          payload: updated as unknown as Record<string, unknown>,
          actorUid: actor.uid,
        });
      }
    }

    // Ensure current month closing & bills exist so members see live mealRate immediately
    const curMonth = getCurrentMonthKey();
    const curClosing = await localDb.monthlyClosings.get(curMonth);
    if (!curClosing && (mealEntries.length > 0 || expenses.length > 0 || allMembers.length > 0)) {
      await recalculateMonthLedger(curMonth, actor);
    }
  } finally {
    isReconcilingAccess = false;
  }
}

export async function resolveSyncConflict(
  conflict: SyncConflict,
  resolution: 'resolved_local' | 'resolved_server',
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('Conflict সমাধানের জন্য Admin অনুমতি প্রয়োজন।');
  }
  const now = new Date().toISOString();
  const payloadStr = resolution === 'resolved_local' ? conflict.localPayloadJson : conflict.serverPayloadJson;
  if (payloadStr) {
    const parsed = JSON.parse(payloadStr) as Record<string, unknown>;
    parsed.updatedAt = now;
    await enqueueOperation({
      collectionName: conflict.entityType,
      docId: conflict.entityId,
      operation: 'update',
      payload: parsed,
      actorUid: actor.uid,
    });
  }

  // Clear matching conflict queue items
  const queued = await localDb.syncQueue
    .where('docId')
    .equals(conflict.entityId)
    .filter((q) => q.status === 'conflict')
    .toArray();
  for (const q of queued) {
    if (q.id) await localDb.syncQueue.delete(q.id);
  }

  const updatedConflict: SyncConflict = {
    ...conflict,
    status: resolution,
    resolvedBy: actor.uid,
    resolvedAt: now,
  };
  await localDb.syncConflicts.put(updatedConflict);
  await enqueueOperation({
    collectionName: 'syncConflicts',
    docId: conflict.id,
    operation: 'update',
    payload: updatedConflict as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
  await recordAuditLog(
    actor,
    'RESOLVE_CONFLICT',
    conflict.entityType,
    conflict.entityId,
    `সিঙ্ক কনফ্লিক্ট সমাধান (${resolution === 'resolved_local' ? 'অফলাইন' : 'ক্লাউড'} রাখা হয়েছে)`
  );
}

export async function restoreFromBackupJSON(jsonText: string, actor: ActorContext): Promise<void> {
  if (actor.role !== 'admin') {
    throw new Error('ব্যাকআপ রিস্টোর করার অনুমতি শুধুমাত্র Admin-এর রয়েছে।');
  }
  const parsed = JSON.parse(jsonText);
  if (!parsed?.data) {
    throw new Error('অবৈধ ব্যাকআপ ফাইল।');
  }
  const d = parsed.data;
  const collections: Array<{ key: string; table: typeof localDb.rooms | typeof localDb.members | typeof localDb.mealEntries | typeof localDb.expenses | typeof localDb.payments | typeof localDb.monthlyClosings | typeof localDb.monthlyBills | typeof localDb.guests | typeof localDb.guestPayments | typeof localDb.weeklyMenus | typeof localDb.notices | typeof localDb.messSettings }> = [
    { key: 'messSettings', table: localDb.messSettings },
    { key: 'rooms', table: localDb.rooms },
    { key: 'members', table: localDb.members },
    { key: 'mealEntries', table: localDb.mealEntries },
    { key: 'expenses', table: localDb.expenses },
    { key: 'payments', table: localDb.payments },
    { key: 'monthlyClosings', table: localDb.monthlyClosings },
    { key: 'monthlyBills', table: localDb.monthlyBills },
    { key: 'guests', table: localDb.guests },
    { key: 'guestPayments', table: localDb.guestPayments },
    { key: 'weeklyMenus', table: localDb.weeklyMenus },
    { key: 'notices', table: localDb.notices },
  ];

  for (const { key, table } of collections) {
    if (Array.isArray(d[key])) {
      for (const item of d[key]) {
        if (item?.id) {
          await table.put({ ...item, syncStatus: 'pending' } as never);
          await enqueueOperation({
            collectionName: key,
            docId: String(item.id),
            operation: 'update',
            payload: item,
            actorUid: actor.uid,
          });
        }
      }
    }
  }
  await recordAuditLog(actor, 'RESTORE_BACKUP', 'system', 'backup', 'JSON ব্যাকআপ থেকে সম্পূর্ণ ডেটা রিস্টোর করা হয়েছে');
}

// ------------------------------------------------------------------
// Notifications (In-App + Optional Browser Notification)
// ------------------------------------------------------------------
export async function createNotification(
  input: {
    targetUid: string;
    type: NotificationType;
    title: string;
    body: string;
  },
  actor: ActorContext
): Promise<AppNotification | null> {
  if (actor.role !== 'admin' && actor.role !== 'manager') return null;
  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const finalReaders =
    input.targetUid === 'ALL'
      ? readerUids
      : Array.from(new Set([...managerUids, input.targetUid])).slice(0, 50);

  const notif: AppNotification = {
    id: makeId('notif'),
    targetUid: input.targetUid,
    type: input.type,
    title: input.title.slice(0, 160),
    body: input.body.slice(0, 600),
    readByUids: [],
    readerUids: finalReaders,
    managerUids,
    createdAt: now,
    createdBy: actor.uid,
  };

  await localDb.notifications.put({ ...notif, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'notifications',
    docId: notif.id,
    operation: 'create',
    payload: notif as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });

  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    (input.targetUid === 'ALL' || input.targetUid === actor.uid)
  ) {
    try {
      new Notification(notif.title, { body: notif.body, icon: '/pwa-192x192.png' });
    } catch {
      // Ignore browser notification errors
    }
  }
  return notif;
}

export async function markNotificationRead(notif: AppNotification, uid: string): Promise<void> {
  if (notif.readByUids.includes(uid)) return;
  const nextRead = Array.from(new Set([...notif.readByUids, uid])).slice(0, 50);
  const updated: AppNotification = { ...notif, readByUids: nextRead };
  await localDb.notifications.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'notifications',
    docId: notif.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    actorUid: uid,
  });
}

export async function markAllNotificationsRead(notifications: AppNotification[], uid: string): Promise<void> {
  for (const n of notifications) {
    if (!n.readByUids.includes(uid)) {
      await markNotificationRead(n, uid);
    }
  }
}

// ------------------------------------------------------------------
// Member Meal On/Off Requests
// ------------------------------------------------------------------
export async function submitMealRequest(
  input: {
    member: Member;
    date: string;
    breakfast: number;
    lunch: number;
    dinner: number;
    reason?: string;
    cutoffTime?: string;
  },
  actor: ActorContext
): Promise<MealRequest> {
  const cutoffCheck = isPastMealCutoff(input.date, input.cutoffTime || '22:00');
  if (cutoffCheck.locked) {
    throw new Error(cutoffCheck.reasonBn);
  }

  const allExisting = await localDb.mealRequests
    .where('memberId')
    .equals(input.member.id)
    .filter((r) => r.date === input.date && r.status === 'pending')
    .toArray();
  const existingPending = allExisting[0];

  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const req: MealRequest = {
    id: existingPending?.id || makeId('mreq'),
    memberId: input.member.id,
    memberUid: actor.uid,
    memberName: input.member.fullName,
    date: input.date,
    monthKey: input.date.slice(0, 7),
    breakfast: Math.min(5, Math.max(0, Number(input.breakfast || 0))),
    lunch: Math.min(5, Math.max(0, Number(input.lunch || 0))),
    dinner: Math.min(5, Math.max(0, Number(input.dinner || 0))),
    reason: input.reason?.trim() || '',
    status: 'pending',
    managerUids,
    createdAt: existingPending?.createdAt || now,
    updatedAt: now,
  };

  await localDb.mealRequests.put({ ...req, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'mealRequests',
    docId: req.id,
    operation: existingPending ? 'update' : 'create',
    payload: req as unknown as Record<string, unknown>,
    baseUpdatedAt: existingPending?.updatedAt,
    actorUid: actor.uid,
  });
  return req;
}

export async function reviewMealRequest(
  req: MealRequest,
  decision: 'approved' | 'rejected',
  reviewNote: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('মিল আবেদন অনুমোদনের অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }
  const now = new Date().toISOString();
  const updated: MealRequest = {
    ...req,
    status: decision,
    reviewedBy: actor.uid,
    reviewedAt: now,
    reviewNote: reviewNote.trim(),
    updatedAt: now,
  };
  await localDb.mealRequests.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'mealRequests',
    docId: req.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: req.updatedAt,
    actorUid: actor.uid,
  });

  if (decision === 'approved') {
    const member = await localDb.members.get(req.memberId);
    if (member) {
      await saveMealEntry(
        {
          date: req.date,
          member,
          breakfast: req.breakfast,
          lunch: req.lunch,
          dinner: req.dinner,
          notes: req.reason ? `Member Req: ${req.reason}` : 'Approved member meal request',
        },
        actor
      );
    }
  }

  await recordAuditLog(
    actor,
    decision === 'approved' ? 'APPROVE_MEAL_REQUEST' : 'REJECT_MEAL_REQUEST',
    'mealRequests',
    req.id,
    `${req.memberName}-এর ${req.date} তারিখের মিল আবেদন ${decision === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'}`
  );

  if (req.memberUid) {
    await createNotification(
      {
        targetUid: req.memberUid,
        type: 'meal_request',
        title:
          decision === 'approved'
            ? `${req.date} তারিখের মিল আবেদন অনুমোদিত হয়েছে`
            : `${req.date} তারিখের মিল আবেদন প্রত্যাখ্যাত হয়েছে`,
        body: `সকাল: ${req.breakfast}, দুপুর: ${req.lunch}, রাত: ${req.dinner}${reviewNote ? ` · নোট: ${reviewNote}` : ''}`,
      },
      actor
    );
  }
}

// ------------------------------------------------------------------
// Member Payment Requests (Balance NEVER updates until approved)
// ------------------------------------------------------------------
export async function submitPaymentRequest(
  input: {
    member: Member;
    amount: number;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    transactionId?: string;
    receiptImageUrl?: string;
    notes?: string;
  },
  actor: ActorContext
): Promise<PaymentRequest> {
  const cleanAmount = round2(Number(input.amount));
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    throw new Error('সঠিক টাকার পরিমাণ লিখুন।');
  }

  const cleanTrx = input.transactionId?.trim() || '';
  if (cleanTrx) {
    const norm = cleanTrx.toLowerCase();
    const dupPayment = await localDb.payments
      .filter((p) => !p.isVoided && (p.transactionId || '').trim().toLowerCase() === norm)
      .first();
    const dupReq = await localDb.paymentRequests
      .filter((r) => r.status !== 'rejected' && (r.transactionId || '').trim().toLowerCase() === norm)
      .first();
    if (dupPayment || dupReq) {
      throw new Error('এই Transaction ID ইতিমধ্যে ব্যবহৃত হয়েছে! অনুগ্রহ করে সঠিক TrxID দিন।');
    }
  }

  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const req: PaymentRequest = {
    id: makeId('preq'),
    memberId: input.member.id,
    memberUid: actor.uid,
    memberName: input.member.fullName,
    monthKey: input.paymentDate.slice(0, 7),
    amount: cleanAmount,
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    transactionId: cleanTrx,
    receiptImageUrl: (input.receiptImageUrl || '').slice(0, 99000),
    notes: input.notes?.trim() || '',
    status: 'pending',
    managerUids,
    createdAt: now,
    updatedAt: now,
  };

  await localDb.paymentRequests.put({ ...req, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'paymentRequests',
    docId: req.id,
    operation: 'create',
    payload: req as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
  return req;
}

export async function reviewPaymentRequest(
  req: PaymentRequest,
  decision: 'approved' | 'rejected',
  reviewNote: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('পেমেন্ট অনুমোদনের অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }

  const now = new Date().toISOString();
  if (decision === 'approved') {
    await savePayment(
      {
        memberId: req.memberId,
        memberUid: req.memberUid,
        memberName: req.memberName,
        monthKey: req.monthKey,
        paymentDate: req.paymentDate,
        amount: req.amount,
        paymentMethod: req.paymentMethod,
        transactionId: req.transactionId,
        notes: req.notes ? `Approved Request: ${req.notes}` : 'Member Payment Request Approved',
      },
      actor
    );
  }

  const updated: PaymentRequest = {
    ...req,
    status: decision,
    reviewedBy: actor.uid,
    reviewedAt: now,
    reviewNote: reviewNote.trim(),
    updatedAt: now,
  };
  await localDb.paymentRequests.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'paymentRequests',
    docId: req.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: req.updatedAt,
    actorUid: actor.uid,
  });

  await recordAuditLog(
    actor,
    decision === 'approved' ? 'APPROVE_PAYMENT_REQUEST' : 'REJECT_PAYMENT_REQUEST',
    'paymentRequests',
    req.id,
    `${req.memberName}-এর ৳${req.amount} (${req.paymentMethod}) পেমেন্ট আবেদন ${decision === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'}`
  );

  if (req.memberUid) {
    await createNotification(
      {
        targetUid: req.memberUid,
        type: 'payment_request',
        title:
          decision === 'approved'
            ? `আপনার ৳${req.amount} পেমেন্ট অনুমোদিত হয়েছে`
            : `আপনার ৳${req.amount} পেমেন্ট আবেদন প্রত্যাখ্যাত হয়েছে`,
        body: `${req.paymentMethod} (${req.paymentDate})${reviewNote ? ` · মন্তব্য: ${reviewNote}` : ''}`,
      },
      actor
    );
  }
}

// ------------------------------------------------------------------
// Guest Meal Requests
// ------------------------------------------------------------------
export async function submitGuestMealRequest(
  input: {
    member: Member;
    guestName?: string;
    date: string;
    breakfast: number;
    lunch: number;
    dinner: number;
    guestCount: number;
    unitCharge: number;
    notes?: string;
  },
  actor: ActorContext
): Promise<GuestMealRequest> {
  const b = input.breakfast ? 1 : 0;
  const l = input.lunch ? 1 : 0;
  const d = input.dinner ? 1 : 0;
  const mealsPerGuest = b + l + d;
  if (mealsPerGuest === 0) {
    throw new Error('সকাল, দুপুর বা রাতের মধ্যে অন্তত একটি মিল নির্বাচন করুন।');
  }
  const guestCount = Math.min(30, Math.max(1, Math.round(Number(input.guestCount || 1))));
  const unitCharge = round2(Math.max(0, Number(input.unitCharge || 0)));
  const totalCharge = round2(mealsPerGuest * guestCount * unitCharge);

  const dup = await localDb.guestMealRequests
    .where('memberId')
    .equals(input.member.id)
    .filter(
      (g) =>
        g.date === input.date &&
        g.status === 'pending' &&
        g.breakfast === b &&
        g.lunch === l &&
        g.dinner === d &&
        (g.guestName || '').trim() === (input.guestName || '').trim()
    )
    .first();
  if (dup) {
    throw new Error('একই তারিখে অনুরূপ একটি অতিথি মিলের আবেদন ইতিমধ্যে অপেক্ষমাণ রয়েছে।');
  }

  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const req: GuestMealRequest = {
    id: makeId('gmeal'),
    memberId: input.member.id,
    memberUid: actor.uid,
    memberName: input.member.fullName,
    guestName: input.guestName?.trim() || '',
    date: input.date,
    monthKey: input.date.slice(0, 7),
    breakfast: b,
    lunch: l,
    dinner: d,
    guestCount,
    unitCharge,
    totalCharge,
    notes: input.notes?.trim() || '',
    status: 'pending',
    managerUids,
    createdAt: now,
    updatedAt: now,
  };

  await localDb.guestMealRequests.put({ ...req, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'guestMealRequests',
    docId: req.id,
    operation: 'create',
    payload: req as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
  return req;
}

export async function reviewGuestMealRequest(
  req: GuestMealRequest,
  decision: 'approved' | 'rejected',
  reviewNote: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('অতিথি মিল অনুমোদনের অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }
  const now = new Date().toISOString();
  const updated: GuestMealRequest = {
    ...req,
    status: decision,
    reviewedBy: actor.uid,
    reviewedAt: now,
    reviewNote: reviewNote.trim(),
    updatedAt: now,
  };
  await localDb.guestMealRequests.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'guestMealRequests',
    docId: req.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: req.updatedAt,
    actorUid: actor.uid,
  });

  if (decision === 'approved') {
    await recalculateMonthLedger(req.monthKey, actor);
  }

  await recordAuditLog(
    actor,
    decision === 'approved' ? 'APPROVE_GUEST_MEAL' : 'REJECT_GUEST_MEAL',
    'guestMealRequests',
    req.id,
    `${req.memberName}-এর অতিথি মিল (${req.date}, চার্জ ৳${req.totalCharge}) ${decision === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'}`
  );

  if (req.memberUid) {
    await createNotification(
      {
        targetUid: req.memberUid,
        type: 'guest_meal',
        title:
          decision === 'approved'
            ? `${req.date} তারিখের অতিথি মিল অনুমোদিত হয়েছে`
            : `${req.date} তারিখের অতিথি মিল প্রত্যাখ্যাত হয়েছে`,
        body: `অতিথি সংখ্যা: ${req.guestCount} · মোট চার্জ: ৳${req.totalCharge}${reviewNote ? ` · ${reviewNote}` : ''}`,
      },
      actor
    );
  }
}

// ------------------------------------------------------------------
// Private Complaints & Suggestions
// ------------------------------------------------------------------
export async function submitComplaint(
  input: {
    member: Member;
    category: string;
    subject: string;
    description: string;
    imageUrl?: string;
  },
  actor: ActorContext
): Promise<Complaint> {
  if (!input.subject.trim() || !input.description.trim()) {
    throw new Error('অনুগ্রহ করে বিষয় এবং বিস্তারিত বিবরণ লিখুন।');
  }
  const now = new Date().toISOString();
  const { managerUids } = await getUidLists(actor.uid);
  const comp: Complaint = {
    id: makeId('comp'),
    memberId: input.member.id,
    memberUid: actor.uid,
    memberName: input.member.fullName,
    category: input.category,
    subject: input.subject.trim(),
    description: input.description.trim(),
    imageUrl: (input.imageUrl || '').slice(0, 99000),
    submittedDate: now.slice(0, 10),
    status: 'pending',
    managerUids,
    createdAt: now,
    updatedAt: now,
  };

  await localDb.complaints.put({ ...comp, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'complaints',
    docId: comp.id,
    operation: 'create',
    payload: comp as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
  return comp;
}

export async function replyComplaint(
  comp: Complaint,
  status: 'in_progress' | 'resolved',
  adminReply: string,
  actor: ActorContext
): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('অভিযোগের উত্তর দেওয়ার অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }
  const now = new Date().toISOString();
  const updated: Complaint = {
    ...comp,
    status,
    adminReply: adminReply.trim(),
    repliedBy: actor.name,
    repliedAt: now,
    updatedAt: now,
  };
  await localDb.complaints.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'complaints',
    docId: comp.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: comp.updatedAt,
    actorUid: actor.uid,
  });

  await recordAuditLog(actor, 'REPLY_COMPLAINT', 'complaints', comp.id, `অভিযোগ আপডেট (${status}): ${comp.subject}`);

  if (comp.memberUid) {
    await createNotification(
      {
        targetUid: comp.memberUid,
        type: 'complaint_reply',
        title: `আপনার অভিযোগের উত্তর এসেছে: ${comp.subject}`,
        body: adminReply.trim() || `অবস্থা: ${status === 'resolved' ? 'সমাধান হয়েছে' : 'প্রক্রিয়াধীন'}`,
      },
      actor
    );
  }
}

// ------------------------------------------------------------------
// Menu Voting Polls
// ------------------------------------------------------------------
export async function createMenuPoll(
  input: {
    title: string;
    description?: string;
    options: string[];
    deadline: string;
    showResultsAfterVote: boolean;
  },
  actor: ActorContext
): Promise<MenuPoll> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('পোল তৈরি করার অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }
  const cleanOptions = input.options.map((o) => o.trim()).filter(Boolean).slice(0, 10);
  if (!input.title.trim() || cleanOptions.length < 2) {
    throw new Error('শিরোনাম ও অন্তত ২টি বিকল্প লিখুন।');
  }
  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const poll: MenuPoll = {
    id: makeId('poll'),
    title: input.title.trim(),
    description: input.description?.trim() || '',
    options: cleanOptions,
    deadline: input.deadline,
    showResultsAfterVote: input.showResultsAfterVote,
    isClosed: false,
    managerUids,
    readerUids,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.uid,
  };
  await localDb.menuPolls.put({ ...poll, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'menuPolls',
    docId: poll.id,
    operation: 'create',
    payload: poll as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });

  await recordAuditLog(actor, 'CREATE_MENU_POLL', 'menuPolls', poll.id, `মেনু ভোট পোল তৈরি: ${poll.title}`);
  await createNotification(
    {
      targetUid: 'ALL',
      type: 'poll_created',
      title: `নতুন মেনু ভোট শুরু হয়েছে: ${poll.title}`,
      body: `শেষ সময়: ${poll.deadline}। "মেনু ভোট" সেকশনে গিয়ে আপনার মতামত দিন।`,
    },
    actor
  );
  return poll;
}

export async function closeMenuPoll(poll: MenuPoll, close: boolean, actor: ActorContext): Promise<void> {
  if (actor.role !== 'admin' && actor.role !== 'manager') {
    throw new Error('পোল বন্ধ করার অনুমতি শুধুমাত্র Owner/Manager-এর রয়েছে।');
  }
  const now = new Date().toISOString();
  const updated: MenuPoll = { ...poll, isClosed: close, updatedAt: now };
  await localDb.menuPolls.put({ ...updated, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'menuPolls',
    docId: poll.id,
    operation: 'update',
    payload: updated as unknown as Record<string, unknown>,
    baseUpdatedAt: poll.updatedAt,
    actorUid: actor.uid,
  });
  await recordAuditLog(actor, close ? 'CLOSE_POLL' : 'REOPEN_POLL', 'menuPolls', poll.id, `পোল ${close ? 'বন্ধ' : 'পুনরায় চালু'}: ${poll.title}`);
}

export async function submitMenuVote(
  poll: MenuPoll,
  optionIndex: number,
  member: Member | undefined,
  actor: ActorContext
): Promise<MenuVote> {
  const today = new Date().toISOString().slice(0, 10);
  if (poll.isClosed || (poll.deadline && today > poll.deadline)) {
    throw new Error('এই ভোটের সময়সীমা শেষ হয়েছে বা পোলটি বন্ধ রয়েছে।');
  }
  const voteId = `${poll.id}_${actor.uid}`;
  const existing = await localDb.menuVotes.get(voteId);
  if (existing) {
    throw new Error('আপনি ইতিমধ্যে এই পোলে আপনার ভোট প্রদান করেছেন।');
  }
  const optionLabel = poll.options[optionIndex];
  if (!optionLabel) {
    throw new Error('সঠিক বিকল্প নির্বাচন করুন।');
  }
  const now = new Date().toISOString();
  const { managerUids, readerUids } = await getUidLists(actor.uid);
  const vote: MenuVote = {
    id: voteId,
    pollId: poll.id,
    uid: actor.uid,
    memberId: member?.id || '',
    memberName: member?.fullName || actor.name,
    optionIndex,
    optionLabel,
    readerUids,
    managerUids,
    createdAt: now,
  };
  await localDb.menuVotes.put({ ...vote, syncStatus: 'pending' });
  await enqueueOperation({
    collectionName: 'menuVotes',
    docId: vote.id,
    operation: 'create',
    payload: vote as unknown as Record<string, unknown>,
    actorUid: actor.uid,
  });
  return vote;
}
