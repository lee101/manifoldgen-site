import type { StudioAdjustments } from './studio-renderer';

export const STUDIO_PROJECT_VERSION = 4;
const DB_NAME = 'manifold-studio';
const DB_VERSION = 1;
const LAST_PROJECT_KEY = 'mg_studio_project_id';

export type PortableStudioAsset = {
  id: string;
  /**
   * Identifies the immutable media bytes behind this logical asset. Editing a
   * text layer keeps its asset ID but creates a new media ID so persisted
   * history can retain both renders.
   */
  mediaID?: string;
  name: string;
  kind: 'video' | 'image' | 'audio';
  duration: number;
  width: number;
  height: number;
  trimStart: number;
  trimEnd: number;
  timelineStart: number;
  /** Zero-based visual layer. V1 is 0; larger values render above it. */
  visualTrack?: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  stageX: number;
  stageY: number;
  /** Uniform element scale. Optional so older projects remain readable. */
  stageScale?: number;
  /** Clockwise rotation in degrees. Optional so older projects remain readable. */
  stageRotation?: number;
  attribution?: string;
  adjustments: StudioAdjustments;
  cloudURL?: string;
  objectKey?: string;
  contentType: string;
  size: number;
  lastModified: number;
  text?: {
    content: string;
    fontSize: number;
    fontFamily: string;
    fontWeight: 400 | 600 | 800;
    color: string;
    align: 'left' | 'center' | 'right';
  };
};

export type PortableStudioDocument = {
  version: number;
  selectedID: string;
  assets: PortableStudioAsset[];
  /**
   * Editor history is part of the project document so undoing an edit still
   * works after reopening the project or moving to another device.
   */
  history?: {
    undo: PortableStudioHistoryState[];
    redo: PortableStudioHistoryState[];
  };
};

export type PortableStudioHistoryState = {
  selectedID: string;
  selectedIDs: string[];
  playhead: number;
  assets: PortableStudioAsset[];
};

export type LocalStudioProject = {
  id: string;
  name: string;
  document: PortableStudioDocument;
  files: Map<string, File>;
  updatedAt: number;
};

type StoredProject = Omit<LocalStudioProject, 'files'>;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
  });
}

function openStudioDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('assets')) {
        const store = db.createObjectStore('assets', { keyPath: 'key' });
        store.createIndex('projectID', 'projectID');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local project storage'));
  });
}

export async function saveLocalStudioProject(project: LocalStudioProject) {
  const db = await openStudioDB();
  try {
    const transaction = db.transaction(['projects', 'assets'], 'readwrite');
    transaction.objectStore('projects').put({
      id: project.id,
      name: project.name,
      document: project.document,
      updatedAt: project.updatedAt,
    } satisfies StoredProject);
    const assetStore = transaction.objectStore('assets');
    const index = assetStore.index('projectID');
    const existing = await requestResult(index.getAllKeys(IDBKeyRange.only(project.id)));
    const projectAssets = [
      ...project.document.assets,
      ...(project.document.history?.undo.flatMap((state) => state.assets) || []),
      ...(project.document.history?.redo.flatMap((state) => state.assets) || []),
    ];
    // Keep files referenced by undo/redo snapshots as well as the live
    // timeline. This is what makes "delete, close, reopen, undo" possible.
    const wanted = new Set(projectAssets.map((asset) => `${project.id}:${asset.mediaID || asset.id}`));
    for (const key of existing) {
      if (!wanted.has(String(key))) assetStore.delete(key);
    }
    const existingSet = new Set(existing.map(String));
    for (const [mediaID, file] of project.files) {
      const key = `${project.id}:${mediaID}`;
      // Media IDs are immutable, so avoid rewriting multi-gigabyte Blobs for
      // every metadata-only slider or timeline edit.
      if (!existingSet.has(key)) assetStore.put({ key, projectID: project.id, assetID: mediaID, file });
    }
    await transactionDone(transaction);
    localStorage.setItem(LAST_PROJECT_KEY, project.id);
  } finally {
    db.close();
  }
}

export async function loadLocalStudioProject(projectID?: string | null): Promise<LocalStudioProject | null> {
  const id = projectID || localStorage.getItem(LAST_PROJECT_KEY);
  if (!id) return null;
  const db = await openStudioDB();
  try {
    const transaction = db.transaction(['projects', 'assets'], 'readonly');
    const project = await requestResult(transaction.objectStore('projects').get(id)) as StoredProject | undefined;
    if (!project) return null;
    const rows = await requestResult(transaction.objectStore('assets').index('projectID').getAll(IDBKeyRange.only(id))) as { assetID: string; file: File }[];
    return { ...project, files: new Map(rows.map((row) => [row.assetID, row.file])) };
  } finally {
    db.close();
  }
}

export async function deleteLocalStudioProject(projectID: string) {
  const db = await openStudioDB();
  try {
    const transaction = db.transaction(['projects', 'assets'], 'readwrite');
    transaction.objectStore('projects').delete(projectID);
    const store = transaction.objectStore('assets');
    const keys = await requestResult(store.index('projectID').getAllKeys(IDBKeyRange.only(projectID)));
    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
    if (localStorage.getItem(LAST_PROJECT_KEY) === projectID) localStorage.removeItem(LAST_PROJECT_KEY);
  } finally {
    db.close();
  }
}
