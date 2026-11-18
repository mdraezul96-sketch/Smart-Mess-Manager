import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { liveQuery } from 'dexie';
import { localDb } from '../db/localDb';
import { auth, db, googleProvider, testConnection } from '../lib/firebase';
import {
  AppNotification,
  AuditLog,
  CachedSession,
  Complaint,
  Expense,
  Guest,
  GuestMealRequest,
  GuestPayment,
  Language,
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
  UserRole,
  WeeklyMenu,
} from '../types/mess';
import { ActorContext, backfillMemberLinksAndReaders, ensureInitialSeedData } from '../services/messDataService';
import { flushSyncQueue, startRealtimeSubscriptions } from '../services/syncEngine';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getCurrentMonthKey } from '../utils/calculations';

interface MessContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  currentUser: UserAccount | null;
  actor: ActorContext | null;
  isOfflineSession: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  authError: string | null;
  lang: Language;
  setLang: (l: Language) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  loginWithGoogle: () => Promise<void>;
  unlockOfflineSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  triggerSyncNow: () => Promise<{ synced: number; conflicts: number; failed: number }>;

  // Live reactive local-first datasets
  settings: MessSettings | null;
  rooms: Room[];
  members: Member[];
  mealEntries: MealEntry[];
  expenses: Expense[];
  payments: Payment[];
  monthlyClosings: MonthlyClosing[];
  monthlyBills: MonthlyBill[];
  guests: Guest[];
  guestPayments: GuestPayment[];
  weeklyMenus: WeeklyMenu[];
  notices: Notice[];
  auditLogs: AuditLog[];
  users: UserAccount[];
  syncQueue: SyncQueueItem[];
  syncConflicts: SyncConflict[];
  mealRequests: MealRequest[];
  paymentRequests: PaymentRequest[];
  guestMealRequests: GuestMealRequest[];
  complaints: Complaint[];
  menuPolls: MenuPoll[];
  menuVotes: MenuVote[];
  notifications: AppNotification[];
}

const MessContext = createContext<MessContextValue | null>(null);

export const MessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('smm_lang');
    return saved === 'en' ? 'en' : 'bn';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('smm_theme');
    return saved === 'dark';
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey);

  // Reactive states from Dexie liveQuery
  const [settings, setSettings] = useState<MessSettings | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [mealEntries, setMealEntries] = useState<MealEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyClosings, setMonthlyClosings] = useState<MonthlyClosing[]>([]);
  const [monthlyBills, setMonthlyBills] = useState<MonthlyBill[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestPayments, setGuestPayments] = useState<GuestPayment[]>([]);
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [mealRequests, setMealRequests] = useState<MealRequest[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [guestMealRequests, setGuestMealRequests] = useState<GuestMealRequest[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [menuPolls, setMenuPolls] = useState<MenuPoll[]>([]);
  const [menuVotes, setMenuVotes] = useState<MenuVote[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('smm_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('smm_theme', 'light');
    }
  }, [darkMode]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem('smm_lang', l);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  // Subscribe to Dexie liveQuery
  useEffect(() => {
    const subs = [
      liveQuery(() => localDb.messSettings.toArray()).subscribe((v) => setSettings(v[0] || null)),
      liveQuery(() => localDb.rooms.toArray()).subscribe((v) =>
        setRooms(v.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)))
      ),
      liveQuery(() => localDb.members.toArray()).subscribe((v) =>
        setMembers(v.sort((a, b) => a.fullName.localeCompare(b.fullName)))
      ),
      liveQuery(() => localDb.mealEntries.toArray()).subscribe((v) =>
        setMealEntries(v.sort((a, b) => b.date.localeCompare(a.date)))
      ),
      liveQuery(() => localDb.expenses.toArray()).subscribe((v) =>
        setExpenses(v.sort((a, b) => b.date.localeCompare(a.date)))
      ),
      liveQuery(() => localDb.payments.toArray()).subscribe((v) =>
        setPayments(v.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)))
      ),
      liveQuery(() => localDb.monthlyClosings.toArray()).subscribe(setMonthlyClosings),
      liveQuery(() => localDb.monthlyBills.toArray()).subscribe(setMonthlyBills),
      liveQuery(() => localDb.guests.toArray()).subscribe((v) =>
        setGuests(v.sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate)))
      ),
      liveQuery(() => localDb.guestPayments.toArray()).subscribe((v) =>
        setGuestPayments(v.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)))
      ),
      liveQuery(() => localDb.weeklyMenus.toArray()).subscribe((v) =>
        setWeeklyMenus(v.sort((a, b) => a.dayOrder - b.dayOrder))
      ),
      liveQuery(() => localDb.notices.toArray()).subscribe((v) =>
        setNotices(
          v.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.publishDate.localeCompare(a.publishDate);
          })
        )
      ),
      liveQuery(() => localDb.auditLogs.toArray()).subscribe((v) =>
        setAuditLogs(v.sort((a, b) => b.timestamp.localeCompare(a.timestamp)))
      ),
      liveQuery(() => localDb.users.toArray()).subscribe(setUsers),
      liveQuery(() => localDb.syncQueue.toArray()).subscribe(setSyncQueue),
      liveQuery(() => localDb.syncConflicts.toArray()).subscribe((v) =>
        setSyncConflicts(v.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)))
      ),
      liveQuery(() => localDb.mealRequests.toArray()).subscribe((v) =>
        setMealRequests(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
      liveQuery(() => localDb.paymentRequests.toArray()).subscribe((v) =>
        setPaymentRequests(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
      liveQuery(() => localDb.guestMealRequests.toArray()).subscribe((v) =>
        setGuestMealRequests(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
      liveQuery(() => localDb.complaints.toArray()).subscribe((v) =>
        setComplaints(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
      liveQuery(() => localDb.menuPolls.toArray()).subscribe((v) =>
        setMenuPolls(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
      liveQuery(() => localDb.menuVotes.toArray()).subscribe(setMenuVotes),
      liveQuery(() => localDb.notifications.toArray()).subscribe((v) =>
        setNotifications(v.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      ),
    ];
    return () => subs.forEach((s) => s.unsubscribe());
  }, []);

  // Boot connection check & Auth listener
  useEffect(() => {
    void testConnection();

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setAuthError(null);
      if (fbUser) {
        setFirebaseUser(fbUser);
        setIsOfflineSession(false);
        const now = new Date().toISOString();
        const isOwner = fbUser.email === 'mdraezul96@gmail.com';
        const defaultRole: UserRole = isOwner ? 'admin' : 'member';

        let account: UserAccount | null = null;
        try {
          const userRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const existing = snap.data() as UserAccount;
            account = {
              ...existing,
              displayName: fbUser.displayName || existing.displayName || fbUser.email || 'User',
              photoURL: fbUser.photoURL || existing.photoURL || '',
              role: isOwner ? 'admin' : existing.role,
              updatedAt: now,
            };
          } else {
            account = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email || 'User',
              photoURL: fbUser.photoURL || '',
              role: defaultRole,
              memberId: '',
              isActive: true,
              managerUids: [fbUser.uid],
              createdAt: now,
              updatedAt: now,
            };
            await setDoc(userRef, account);
          }
          await localDb.users.put(account);
        } catch {
          // Offline fallback using cached user doc in Dexie
          const localUser = await localDb.users.get(fbUser.uid);
          const cached = await localDb.cachedSession.get('current');
          if (localUser) {
            account = localUser;
          } else if (cached && cached.uid === fbUser.uid) {
            account = {
              uid: cached.uid,
              email: cached.email,
              displayName: cached.displayName,
              photoURL: cached.photoURL || '',
              role: cached.role,
              memberId: cached.memberId || '',
              isActive: true,
              createdAt: cached.authorizedAt,
              updatedAt: now,
            };
          } else {
            account = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email || 'User',
              photoURL: fbUser.photoURL || '',
              role: defaultRole,
              memberId: '',
              isActive: true,
              createdAt: now,
              updatedAt: now,
            };
          }
        }

        const cachedSession: CachedSession = {
          id: 'current',
          uid: account.uid,
          email: account.email,
          displayName: account.displayName,
          photoURL: account.photoURL || '',
          role: account.role,
          memberId: account.memberId || '',
          authorizedAt: now,
          lastSyncedAt: lastSyncedAt || now,
        };
        await localDb.cachedSession.put(cachedSession);
        setCurrentUser(account);

        await ensureInitialSeedData({
          uid: account.uid,
          name: account.displayName,
          role: account.role,
        });
      } else {
        setFirebaseUser(null);
        // Check if offline & cached session exists
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await localDb.cachedSession.get('current');
          if (cached) {
            setCurrentUser({
              uid: cached.uid,
              email: cached.email,
              displayName: cached.displayName,
              photoURL: cached.photoURL,
              role: cached.role,
              memberId: cached.memberId,
              isActive: true,
              createdAt: cached.authorizedAt,
              updatedAt: cached.lastSyncedAt || cached.authorizedAt,
            });
            setLastSyncedAt(cached.lastSyncedAt || null);
            setIsOfflineSession(true);
          } else {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // Firestore real-time subscription + auto-sync when online
  useEffect(() => {
    if (!currentUser || !firebaseUser || !isOnline) return;

    const unsub = startRealtimeSubscriptions(
      currentUser.uid,
      currentUser.email,
      currentUser.role,
      () => {
        setLastSyncedAt(new Date().toISOString());
      }
    );

    const runSync = async () => {
      setIsSyncing(true);
      try {
        const res = await flushSyncQueue(currentUser.uid);
        if (res.synced > 0) {
          setLastSyncedAt(new Date().toISOString());
        }
      } finally {
        setIsSyncing(false);
      }
    };

    void runSync();

    return () => unsub();
  }, [currentUser?.uid, currentUser?.role, firebaseUser, isOnline]);

  // Keep currentUser React state & cachedSession in sync with real-time user doc updates (e.g. role change or memberId linking)
  useEffect(() => {
    if (!currentUser) return;
    const latest = users.find((u) => u.uid === currentUser.uid);
    if (!latest) return;
    if (
      latest.role !== currentUser.role ||
      latest.isActive !== currentUser.isActive ||
      (latest.memberId || '') !== (currentUser.memberId || '') ||
      latest.displayName !== currentUser.displayName ||
      (latest.photoURL || '') !== (currentUser.photoURL || '')
    ) {
      setCurrentUser(latest);
      void localDb.cachedSession.get('current').then((cached) => {
        if (cached && cached.uid === latest.uid) {
          void localDb.cachedSession.put({
            ...cached,
            displayName: latest.displayName,
            photoURL: latest.photoURL || '',
            role: latest.role,
            memberId: latest.memberId || '',
          });
        }
      });
    }
  }, [users, currentUser]);

  // Automatically link users<->members by email, backfill memberUid & readerUids, and ensure current month closing exists
  const reconcileKey = `${users.map((u) => `${u.uid}:${u.memberId || ''}:${u.role}:${u.isActive}`).join('|')}__${members.map((m) => `${m.id}:${m.email || ''}:${m.linkedUid || ''}`).join('|')}`;
  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) return;
    const actorCtx: ActorContext = {
      uid: currentUser.uid,
      name: currentUser.displayName,
      role: currentUser.role,
    };
    const timer = window.setTimeout(() => {
      void backfillMemberLinksAndReaders(actorCtx);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [currentUser?.uid, currentUser?.role, isOnline, reconcileKey]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    if (!navigator.onLine) {
      const cached = await localDb.cachedSession.get('current');
      if (cached) {
        setCurrentUser({
          uid: cached.uid,
          email: cached.email,
          displayName: cached.displayName,
          photoURL: cached.photoURL,
          role: cached.role,
          memberId: cached.memberId,
          isActive: true,
          createdAt: cached.authorizedAt,
          updatedAt: cached.lastSyncedAt || cached.authorizedAt,
        });
        setIsOfflineSession(true);
        return;
      }
      setAuthError('প্রথমবার লগইন করার জন্য ইন্টারনেট সংযোগ প্রয়োজন।');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('লগইন পপআপ বন্ধ করা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      } else {
        setAuthError(`লগইন ব্যর্থ হয়েছে: ${msg}`);
      }
    }
  }, []);

  const unlockOfflineSession = useCallback(async () => {
    const cached = await localDb.cachedSession.get('current');
    if (!cached) return false;
    setCurrentUser({
      uid: cached.uid,
      email: cached.email,
      displayName: cached.displayName,
      photoURL: cached.photoURL,
      role: cached.role,
      memberId: cached.memberId,
      isActive: true,
      createdAt: cached.authorizedAt,
      updatedAt: cached.lastSyncedAt || cached.authorizedAt,
    });
    setLastSyncedAt(cached.lastSyncedAt || null);
    setIsOfflineSession(true);
    return true;
  }, []);

  const logout = useCallback(async () => {
    await localDb.cachedSession.delete('current');
    setIsOfflineSession(false);
    setCurrentUser(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  const triggerSyncNow = useCallback(async () => {
    if (!currentUser) return { synced: 0, conflicts: 0, failed: 0 };
    setIsSyncing(true);
    try {
      const res = await flushSyncQueue(currentUser.uid);
      setLastSyncedAt(new Date().toISOString());
      return res;
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser]);

  const actor: ActorContext | null = currentUser
    ? {
        uid: currentUser.uid,
        name: currentUser.displayName,
        role: currentUser.role,
      }
    : null;

  return (
    <MessContext.Provider
      value={{
        authReady,
        firebaseUser,
        currentUser,
        actor,
        isOfflineSession,
        isOnline,
        isSyncing,
        lastSyncedAt,
        authError,
        lang,
        setLang,
        darkMode,
        toggleDarkMode,
        selectedMonth,
        setSelectedMonth,
        loginWithGoogle,
        unlockOfflineSession,
        logout,
        triggerSyncNow,
        settings,
        rooms,
        members,
        mealEntries,
        expenses,
        payments,
        monthlyClosings,
        monthlyBills,
        guests,
        guestPayments,
        weeklyMenus,
        notices,
        auditLogs,
        users,
        syncQueue,
        syncConflicts,
        mealRequests,
        paymentRequests,
        guestMealRequests,
        complaints,
        menuPolls,
        menuVotes,
        notifications,
      }}
    >
      {children}
    </MessContext.Provider>
  );
};

export function useMess() {
  const ctx = useContext(MessContext);
  if (!ctx) throw new Error('useMess must be used inside MessProvider');
  return ctx;
}
