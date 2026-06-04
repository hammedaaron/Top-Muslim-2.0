import Dexie, { type Table } from 'dexie';
import { db as firestoreDb, auth as firebaseAuth } from '../firebase';
import { doc, setDoc, deleteDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { FastingLog, MemorizationLog, ZakatCalculation, SavingsLog, UserProfile } from '../types';

// Define the Queue item interface
export interface QueueItem {
  id?: number;
  uid: string;
  action: 'set' | 'delete';
  collectionName: 'users' | 'fastingLogs' | 'memorizationLogs' | 'zakatCalculations' | 'savingsLogs';
  docId: string;
  payload?: any;
  createdAt: number;
}

// Dexie Database Class
class PremiumLocalDatabase extends Dexie {
  users!: Table<UserProfile, string>;
  fastingLogs!: Table<FastingLog & { updatedAt: number }, string>;
  memorizationLogs!: Table<MemorizationLog & { updatedAt: number }, string>;
  zakatCalculations!: Table<ZakatCalculation & { updatedAt: number }, string>;
  savingsLogs!: Table<SavingsLog & { updatedAt: number }, string>;
  syncQueue!: Table<QueueItem, number>;

  constructor() {
    super('TopMuslimLocalDB');
    this.version(1).stores({
      users: 'uid',
      fastingLogs: 'id, uid, date',
      memorizationLogs: 'id, uid, date',
      zakatCalculations: 'id, uid, date',
      savingsLogs: 'id, uid, date',
      syncQueue: '++id, uid, action, collectionName'
    });
  }
}

export const localDb = new PremiumLocalDatabase();

// Subscriber callback type definition
type DBChangeListener = (collectionName: string) => void;
class DBEventBroker {
  private listeners: Set<DBChangeListener> = new Set();

  subscribe(listener: DBChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify(collectionName: string) {
    this.listeners.forEach((listener) => {
      try {
        listener(collectionName);
      } catch (err) {
        console.error('Error emitting DB change notification:', err);
      }
    });
  }
}

export const dbEventBroker = new DBEventBroker();

// Local-First Data Orchestrator
export class LocalFirstSyncEngine {
  private static isSyncing = false;
  private static syncInterval: any = null;

  // Initialize background background sync check
  static startBackgroundSync() {
    if (this.syncInterval) return;
    
    // Check every 8 seconds for sync queue items
    this.syncInterval = setInterval(() => {
      this.processSyncQueue();
    }, 8000);

    // Also trigger on browser online event
    window.addEventListener('online', () => {
      this.processSyncQueue();
    });
  }

  // Generic Write proxy (Local first, then adds task write to queue)
  static async saveRecord<T extends { id?: string; uid: string; date?: string }>(
    collectionName: 'users' | 'fastingLogs' | 'memorizationLogs' | 'zakatCalculations' | 'savingsLogs',
    record: T
  ) {
    const now = Date.now();
    const docId = collectionName === 'users' ? record.uid : (record.id || `${record.uid}_${record.date || record.id}`);
    
    // Save locally
    const localPayload = { ...record, id: docId, updatedAt: now };
    
    if (collectionName === 'users') {
      await localDb.users.put(localPayload as any);
    } else if (collectionName === 'fastingLogs') {
      await localDb.fastingLogs.put(localPayload as any);
    } else if (collectionName === 'memorizationLogs') {
      await localDb.memorizationLogs.put(localPayload as any);
    } else if (collectionName === 'zakatCalculations') {
      await localDb.zakatCalculations.put(localPayload as any);
    } else if (collectionName === 'savingsLogs') {
      await localDb.savingsLogs.put(localPayload as any);
    }

    // Trigger immediate reactive UI update
    dbEventBroker.notify(collectionName);

    // Queue for remote Firestore mirroring if not guest
    if (record.uid !== 'guest_user') {
      await localDb.syncQueue.add({
        uid: record.uid,
        action: 'set',
        collectionName,
        docId,
        payload: record,
        createdAt: now
      });
      // Fire action sync loop
      this.processSyncQueue();
    }
  }

  // Generic Delete proxy (Local first, then adds deletion to queue)
  static async deleteRecord(
    collectionName: 'users' | 'fastingLogs' | 'memorizationLogs' | 'zakatCalculations' | 'savingsLogs',
    docId: string,
    uid: string
  ) {
    const now = Date.now();

    // Delete locally
    if (collectionName === 'users') {
      await localDb.users.delete(docId);
    } else if (collectionName === 'fastingLogs') {
      await localDb.fastingLogs.delete(docId);
    } else if (collectionName === 'memorizationLogs') {
      await localDb.memorizationLogs.delete(docId);
    } else if (collectionName === 'zakatCalculations') {
      await localDb.zakatCalculations.delete(docId);
    } else if (collectionName === 'savingsLogs') {
      await localDb.savingsLogs.delete(docId);
    }

    // Trigger immediate reactive UI update
    dbEventBroker.notify(collectionName);

    // Queue for remote deletion if not guest
    if (uid !== 'guest_user') {
      await localDb.syncQueue.add({
        uid,
        action: 'delete',
        collectionName,
        docId,
        createdAt: now
      });
      // Fire action sync loop
      this.processSyncQueue();
    }
  }

  // Process items in queue sequentially (Replayer Mode)
  static async processSyncQueue() {
    if (this.isSyncing) return;
    if (!navigator.onLine) return;

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) return; // Wait for active authentication before shipping queue items

    this.isSyncing = true;
    try {
      const queue = await localDb.syncQueue.orderBy('id').toArray();
      
      for (const item of queue) {
        // Skip items for other users if credentials have switched
        if (item.uid !== currentUser.uid) continue;

        try {
          const docRef = doc(firestoreDb, item.collectionName, item.docId);
          if (item.action === 'set') {
            await setDoc(docRef, item.payload);
          } else if (item.action === 'delete') {
            await deleteDoc(docRef);
          }
          // Remove from local queue after successful sync
          if (item.id !== undefined) {
            await localDb.syncQueue.delete(item.id);
          }
        } catch (itemErr) {
          console.error(`Failed to reconcile sync action for queue item ${item.id}:`, itemErr);
          // If Firestore is offline or restricted, halt loop to replay sequentially later
          break;
        }
      }
    } catch (err) {
      console.error('Error processing sync queue:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  // Deep Sync download reconciliation (Per-record update checks on login/startup)
  static async syncRemoteSnapshot(uid: string) {
    if (uid === 'guest_user') return;
    if (!navigator.onLine) return;

    try {
      const collectionsToSync: Array<'users' | 'fastingLogs' | 'memorizationLogs' | 'zakatCalculations' | 'savingsLogs'> = [
        'users',
        'fastingLogs',
        'memorizationLogs',
        'zakatCalculations',
        'savingsLogs'
      ];

      for (const col of collectionsToSync) {
        const qField = col === 'users' ? 'uid' : 'uid';
        const qRef = query(collection(firestoreDb, col), where(qField, '==', uid));
        const snap = await getDocs(qRef);

        const remoteDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const remoteDoc of remoteDocs) {
          const docId = remoteDoc.id;
          
          // Verify if exists locally
          let localDoc: any = null;
          if (col === 'users') {
            localDoc = await localDb.users.get(docId);
          } else if (col === 'fastingLogs') {
            localDoc = await localDb.fastingLogs.get(docId);
          } else if (col === 'memorizationLogs') {
            localDoc = await localDb.memorizationLogs.get(docId);
          } else if (col === 'zakatCalculations') {
            localDoc = await localDb.zakatCalculations.get(docId);
          } else if (col === 'savingsLogs') {
            localDoc = await localDb.savingsLogs.get(docId);
          }

          // If local does not exist, insert it safely
          if (!localDoc) {
            const freshLocal = { ...remoteDoc, updatedAt: Date.now() };
            if (col === 'users') {
              await localDb.users.put(freshLocal as any);
            } else if (col === 'fastingLogs') {
              await localDb.fastingLogs.put(freshLocal as any);
            } else if (col === 'memorizationLogs') {
              await localDb.memorizationLogs.put(freshLocal as any);
            } else if (col === 'zakatCalculations') {
              await localDb.zakatCalculations.put(freshLocal as any);
            } else if (col === 'savingsLogs') {
              await localDb.savingsLogs.put(freshLocal as any);
            }
          } else {
            // Reconcile via client or queue checks
            // For simple deterministic conflict check, remote wins if there are no pending queue tasks
            const hasPendingQueue = await localDb.syncQueue.where({ collectionName: col, docId }).count();
            if (hasPendingQueue === 0) {
              const freshLocal = { ...remoteDoc, updatedAt: Date.now() };
              if (col === 'users') {
                await localDb.users.put(freshLocal as any);
              } else if (col === 'fastingLogs') {
                await localDb.fastingLogs.put(freshLocal as any);
              } else if (col === 'memorizationLogs') {
                await localDb.memorizationLogs.put(freshLocal as any);
              } else if (col === 'zakatCalculations') {
                await localDb.zakatCalculations.put(freshLocal as any);
              } else if (col === 'savingsLogs') {
                await localDb.savingsLogs.put(freshLocal as any);
              }
            }
          }
        }
        dbEventBroker.notify(col);
      }
    } catch (err) {
      console.error('Snapshot replication sync failed:', err);
    }
  }
}
