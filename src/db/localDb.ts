import Dexie, { Table } from 'dexie';
import {
  AppNotification,
  AuditLog,
  CachedSession,
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
  Payment,
  PaymentRequest,
  Room,
  SyncConflict,
  SyncQueueItem,
  UserAccount,
  WeeklyMenu,
} from '../types/mess';

export class SmartMessLocalDB extends Dexie {
  users!: Table<UserAccount, string>;
  messSettings!: Table<MessSettings, string>;
  rooms!: Table<Room, string>;
  members!: Table<Member, string>;
  mealEntries!: Table<MealEntry, string>;
  expenses!: Table<Expense, string>;
  payments!: Table<Payment, string>;
  monthlyClosings!: Table<MonthlyClosing, string>;
  monthlyBills!: Table<MonthlyBill, string>;
  guests!: Table<Guest, string>;
  guestPayments!: Table<GuestPayment, string>;
  weeklyMenus!: Table<WeeklyMenu, string>;
  notices!: Table<Notice, string>;
  auditLogs!: Table<AuditLog, string>;
  syncConflicts!: Table<SyncConflict, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  cachedSession!: Table<CachedSession, string>;
  mealRequests!: Table<MealRequest, string>;
  paymentRequests!: Table<PaymentRequest, string>;
  guestMealRequests!: Table<GuestMealRequest, string>;
  complaints!: Table<Complaint, string>;
  menuPolls!: Table<MenuPoll, string>;
  menuVotes!: Table<MenuVote, string>;
  notifications!: Table<AppNotification, string>;

  constructor() {
    super('SmartMessManagerDB_v1');
    this.version(1).stores({
      users: 'uid, email, role, memberId',
      messSettings: 'id',
      rooms: 'id, roomNumber, status',
      members: 'id, fullName, roomId, status, linkedUid',
      mealEntries: 'id, date, monthKey, memberId, [date+memberId]',
      expenses: 'id, date, monthKey, expenseGroup, category, isVoided',
      payments: 'id, memberId, monthKey, paymentDate, isVoided',
      monthlyClosings: 'id, monthKey, isClosed',
      monthlyBills: 'id, monthKey, memberId',
      guests: 'id, arrivalDate, status, roomId',
      guestPayments: 'id, guestId, paymentDate',
      weeklyMenus: 'id, dayOrder',
      notices: 'id, publishDate, isPinned',
      auditLogs: 'id, timestamp, entityType, actorUid',
      syncConflicts: 'id, entityType, entityId, status',
      syncQueue: '++id, uuid, collectionName, docId, status, createdAt',
      cachedSession: 'id, uid, email',
    });

    this.version(2).stores({
      mealRequests: 'id, memberId, memberUid, date, monthKey, status',
      paymentRequests: 'id, memberId, memberUid, monthKey, paymentDate, transactionId, status',
      guestMealRequests: 'id, memberId, memberUid, date, monthKey, status',
      complaints: 'id, memberId, memberUid, submittedDate, status',
      menuPolls: 'id, deadline, isClosed',
      menuVotes: 'id, pollId, uid',
      notifications: 'id, targetUid, type, createdAt',
    });
  }
}

export const localDb = new SmartMessLocalDB();
