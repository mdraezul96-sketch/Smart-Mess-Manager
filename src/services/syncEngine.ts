import type { Table } from 'dexie';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { localDb } from '../db/localDb';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SyncConflict, SyncQueueItem, UserRole } from '../types/mess';

function cleanForFirestore<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'syncStatus') continue;
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

const SYNCED_TABLES = new Set([
  'users',
  'messSettings',
  'rooms',
  'members',
  'mealEntries',
  'expenses',
  'payments',
  'monthlyClosings',
  'monthlyBills',
  'guests',
  'guestPayments',
  'weeklyMenus',
  'notices',
  'auditLogs',
  'syncConflicts',
  'mealRequests',
  'paymentRequests',
  'guestMealRequests',
  'complaints',
  'menuPolls',
  'menuVotes',
  'notifications',
]);

function getLocalTable(collectionName: string): Table<Record<string, unknown>, string> | null {
  if (!SYNCED_TABLES.has(collectionName)) return null;
  return localDb.table<Record<string, unknown>, string>(collectionName);
}

let isFlushing = false;

export async function flushSyncQueue(actorUid: string): Promise<{
  synced: number;
  conflicts: number;
  failed: number;
}> {
  if (isFlushing) return { synced: 0, conflicts: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, conflicts: 0, failed: 0 };
  }
  if (!auth.currentUser) {
    return { synced: 0, conflicts: 0, failed: 0 };
  }

  isFlushing = true;
  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  try {
    const items = await localDb.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('createdAt');

    for (const item of items) {
      if (!item.id) continue;
      await localDb.syncQueue.update(item.id, { status: 'syncing' });

      const docRef = doc(db, item.collectionName, item.docId);
      const path = `${item.collectionName}/${item.docId}`;

      try {
        if (item.operation === 'delete') {
          await deleteDoc(docRef);
          await localDb.syncQueue.delete(item.id);
          synced++;
          continue;
        }

        if (!item.payload) {
          await localDb.syncQueue.delete(item.id);
          continue;
        }

        // Check for concurrent modification conflicts on updates (skip derived totals & own writes)
        const isDerivedLedger =
          item.collectionName === 'monthlyClosings' || item.collectionName === 'monthlyBills';
        if (item.operation === 'update' && item.baseUpdatedAt && !isDerivedLedger) {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const serverData = snap.data() as Record<string, unknown>;
            const serverUpdatedAt = String(serverData.updatedAt || '');
            const serverActor = String(serverData.updatedBy || serverData.createdBy || '');
            if (serverUpdatedAt && serverUpdatedAt > item.baseUpdatedAt && serverActor !== actorUid) {
              const conflictId = `conflict-${item.collectionName}-${item.docId}-${Date.now()}`;
              const conflict: SyncConflict = {
                id: conflictId,
                entityType: item.collectionName,
                entityId: item.docId,
                localSummary: `অফলাইন পরিবর্তন (${String(item.payload.updatedAt || item.createdAt)})`,
                serverSummary: `ক্লাউড সংস্করণ (${serverUpdatedAt})`,
                localPayloadJson: JSON.stringify(cleanForFirestore(item.payload)),
                serverPayloadJson: JSON.stringify(serverData),
                detectedAt: new Date().toISOString(),
                detectedBy: actorUid,
                status: 'pending',
                managerUids: [actorUid],
              };
              await localDb.syncConflicts.put(conflict);
              try {
                await setDoc(doc(db, 'syncConflicts', conflictId), cleanForFirestore(conflict as unknown as Record<string, unknown>));
              } catch {
                // Keep locally if cloud write fails
              }
              await localDb.syncQueue.update(item.id, {
                status: 'conflict',
                lastError: 'Server has a newer version. Admin review required.',
              });
              const table = getLocalTable(item.collectionName);
              if (table) {
                await table.update(item.docId, { syncStatus: 'conflict' });
              }
              conflicts++;
              continue;
            }
          }
        }

        const cleanPayload = cleanForFirestore(item.payload);
        await setDoc(docRef, cleanPayload, { merge: true });
        await localDb.syncQueue.delete(item.id);

        const table = getLocalTable(item.collectionName);
        if (table) {
          await table.update(item.docId, { syncStatus: 'synced' });
        }
        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await localDb.syncQueue.update(item.id, {
          status: 'failed',
          retryCount: (item.retryCount || 0) + 1,
          lastError: msg.slice(0, 300),
        });
        failed++;
        if (msg.includes('Missing or insufficient permissions')) {
          try {
            handleFirestoreError(
              err,
              item.operation === 'delete' ? OperationType.DELETE : OperationType.WRITE,
              path
            );
          } catch {
            // Logged structured error without crashing loop
          }
        }
      }
    }

    if (synced > 0) {
      const session = await localDb.cachedSession.get('current');
      if (session) {
        await localDb.cachedSession.update('current', {
          lastSyncedAt: new Date().toISOString(),
        });
      }
    }
  } finally {
    isFlushing = false;
  }

  return { synced, conflicts, failed };
}

export async function enqueueOperation(params: {
  collectionName: string;
  docId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown> | null;
  baseUpdatedAt?: string;
  actorUid: string;
}): Promise<void> {
  const existingPending = await localDb.syncQueue
    .where('docId')
    .equals(params.docId)
    .filter((q) => q.collectionName === params.collectionName && (q.status === 'pending' || q.status === 'failed'))
    .first();

  if (existingPending && existingPending.id) {
    if (params.operation === 'delete' && existingPending.operation === 'create') {
      await localDb.syncQueue.delete(existingPending.id);
    } else {
      await localDb.syncQueue.update(existingPending.id, {
        operation: existingPending.operation === 'create' && params.operation !== 'delete' ? 'create' : params.operation,
        payload: params.payload,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }
  } else {
    const item: SyncQueueItem = {
      uuid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      collectionName: params.collectionName,
      docId: params.docId,
      operation: params.operation,
      payload: params.payload,
      baseUpdatedAt: params.baseUpdatedAt,
      createdAt: new Date().toISOString(),
      createdBy: params.actorUid,
      retryCount: 0,
      status: 'pending',
    };
    await localDb.syncQueue.add(item);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine && auth.currentUser) {
    void flushSyncQueue(params.actorUid);
  }
}

export function startRealtimeSubscriptions(
  uid: string,
  email: string,
  role: UserRole,
  onSyncUpdate?: () => void
): () => void {
  const unsubs: Unsubscribe[] = [];
  const isOwner = email === 'mdraezul96@gmail.com';
  const isManager = role === 'admin' || role === 'manager';

  const subscribeCol = (
    colName: string,
    mode: 'all' | 'manager' | 'reader' | 'memberOwn' | 'usersOwn' | 'notifTargetAll',
    memberField = 'memberUid'
  ) => {
    const colRef = collection(db, colName);
    let q;
    if (isOwner || mode === 'all') {
      q = query(colRef);
    } else if (mode === 'manager') {
      q = query(colRef, where('managerUids', 'array-contains', uid));
    } else if (mode === 'reader') {
      q = query(colRef, where('readerUids', 'array-contains', uid));
    } else if (mode === 'memberOwn') {
      q = query(colRef, where(memberField, '==', uid));
    } else if (mode === 'notifTargetAll') {
      q = query(colRef, where('targetUid', '==', 'ALL'));
    } else {
      q = query(colRef, where('uid', '==', uid));
    }

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const table = getLocalTable(colName);
        if (!table) return;

        const pendingItems = await localDb.syncQueue
          .where('collectionName')
          .equals(colName)
          .toArray();
        const pendingIds = new Set(pendingItems.map((i) => i.docId));

        for (const change of snapshot.docChanges()) {
          const docId = change.doc.id;
          if (pendingIds.has(docId)) continue; // Don't clobber local pending edits

          if (change.type === 'removed') {
            await table.delete(docId);
          } else {
            const data = change.doc.data() as Record<string, unknown>;
            await table.put({ ...data, syncStatus: 'synced' } as never);
          }
        }
        onSyncUpdate?.();
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, colName);
        } catch {
          // Structured error logged
        }
      }
    );
    unsubs.push(unsub);
  };

  if (isOwner) {
    subscribeCol('users', 'all');
    subscribeCol('messSettings', 'all');
    subscribeCol('rooms', 'all');
    subscribeCol('members', 'all');
    subscribeCol('mealEntries', 'all');
    subscribeCol('expenses', 'all');
    subscribeCol('payments', 'all');
    subscribeCol('monthlyClosings', 'all');
    subscribeCol('monthlyBills', 'all');
    subscribeCol('guests', 'all');
    subscribeCol('guestPayments', 'all');
    subscribeCol('weeklyMenus', 'all');
    subscribeCol('notices', 'all');
    subscribeCol('auditLogs', 'all');
    subscribeCol('syncConflicts', 'all');
    subscribeCol('mealRequests', 'all');
    subscribeCol('paymentRequests', 'all');
    subscribeCol('guestMealRequests', 'all');
    subscribeCol('complaints', 'all');
    subscribeCol('menuPolls', 'all');
    subscribeCol('menuVotes', 'all');
    subscribeCol('notifications', 'all');
  } else if (isManager) {
    subscribeCol('users', 'manager');
    subscribeCol('messSettings', 'reader');
    subscribeCol('rooms', 'reader');
    subscribeCol('members', 'manager');
    subscribeCol('mealEntries', 'reader');
    subscribeCol('expenses', 'reader');
    subscribeCol('payments', 'manager');
    subscribeCol('monthlyClosings', 'reader');
    subscribeCol('monthlyBills', 'manager');
    subscribeCol('guests', 'manager');
    subscribeCol('guestPayments', 'manager');
    subscribeCol('weeklyMenus', 'reader');
    subscribeCol('notices', 'reader');
    subscribeCol('auditLogs', 'manager');
    subscribeCol('syncConflicts', 'manager');
    subscribeCol('mealRequests', 'manager');
    subscribeCol('paymentRequests', 'manager');
    subscribeCol('guestMealRequests', 'manager');
    subscribeCol('complaints', 'manager');
    subscribeCol('menuPolls', 'reader');
    subscribeCol('menuVotes', 'reader');
    subscribeCol('notifications', 'reader');
  } else {
    // Member role: only own profile/bills/payments/requests/complaints + shared mess views
    unsubs.push(
      onSnapshot(
        doc(db, 'users', uid),
        async (snap) => {
          if (snap.exists()) {
            await localDb.users.put(snap.data() as never);
          }
        },
        (err) => {
          try { handleFirestoreError(err, OperationType.GET, `users/${uid}`); } catch {}
        }
      )
    );
    subscribeCol('messSettings', 'reader');
    subscribeCol('rooms', 'reader');
    subscribeCol('members', 'memberOwn', 'linkedUid');
    subscribeCol('mealEntries', 'memberOwn', 'memberUid');
    subscribeCol('expenses', 'reader');
    subscribeCol('payments', 'memberOwn', 'memberUid');
    subscribeCol('monthlyClosings', 'reader');
    subscribeCol('monthlyBills', 'memberOwn', 'memberUid');
    subscribeCol('weeklyMenus', 'reader');
    subscribeCol('notices', 'reader');
    subscribeCol('mealRequests', 'memberOwn', 'memberUid');
    subscribeCol('paymentRequests', 'memberOwn', 'memberUid');
    subscribeCol('guestMealRequests', 'memberOwn', 'memberUid');
    subscribeCol('complaints', 'memberOwn', 'memberUid');
    subscribeCol('menuPolls', 'reader');
    subscribeCol('menuVotes', 'reader');
    subscribeCol('notifications', 'memberOwn', 'targetUid');
    subscribeCol('notifications', 'notifTargetAll');
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}
