import type { StudioAdjustments, StudioLUT } from './studio-grade';

export type StudioHandoff = {
  id: string;
  file: File;
  adjustments: StudioAdjustments;
  lut?: { name: string; size: number; data: Float32Array };
  createdAt: number;
};

const DB_NAME = 'manifold-studio-handoff';
const STORE = 'handoffs';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function openHandoffDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open handoff storage'));
  });
}

function done(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Handoff storage failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Handoff storage aborted'));
  });
}

export async function putStudioHandoff(file: File, adjustments: StudioAdjustments, lut?: StudioLUT | null) {
  const id = `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const db = await openHandoffDB();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      if (Date.now() - (cursor.value as StudioHandoff).createdAt > MAX_AGE_MS) cursor.delete();
      cursor.continue();
    };
    store.put({ id, file, adjustments, lut: lut ? { name: lut.name, size: lut.size, data: lut.data } : undefined, createdAt: Date.now() } satisfies StudioHandoff);
    await done(transaction);
  } finally {
    db.close();
  }
  return id;
}

export async function takeStudioHandoff(id: string): Promise<StudioHandoff | null> {
  const db = await openHandoffDB();
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const record = await new Promise<StudioHandoff | undefined>((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as StudioHandoff | undefined);
      request.onerror = () => reject(request.error);
    });
    store.delete(id);
    await done(transaction);
    return record || null;
  } finally {
    db.close();
  }
}
