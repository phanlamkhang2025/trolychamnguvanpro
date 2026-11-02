// IndexedDB on the teacher's browser: the only place exams, submissions, grades and files are kept.

const DB_NAME = 'gv_van_db';
const DB_VERSION = 1;
const COLLECTIONS_STORE = 'collections';
const FILES_STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(COLLECTIONS_STORE);
      request.result.createObjectStore(FILES_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

// Resolves only once the transaction has committed, so a resolved write is really on disk
async function runInStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    tx.oncomplete = () => resolve((request ? request.result : undefined) as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const LocalDb = {
  getCollection<T>(name: string): Promise<T | undefined> {
    return runInStore<T | undefined>(COLLECTIONS_STORE, 'readonly', (store) => store.get(name));
  },

  putCollection(name: string, value: unknown): Promise<void> {
    return runInStore<void>(COLLECTIONS_STORE, 'readwrite', (store) => {
      store.put(value, name);
    });
  },

  getFile(id: string): Promise<Blob | undefined> {
    return runInStore<Blob | undefined>(FILES_STORE, 'readonly', (store) => store.get(id));
  },

  putFile(id: string, file: Blob): Promise<void> {
    return runInStore<void>(FILES_STORE, 'readwrite', (store) => {
      store.put(file, id);
    });
  },

  deleteFiles(ids: string[]): Promise<void> {
    return runInStore<void>(FILES_STORE, 'readwrite', (store) => {
      ids.forEach((id) => store.delete(id));
    });
  },

  async getAllFiles(): Promise<{ id: string; file: Blob }[]> {
    const [ids, files] = await Promise.all([
      runInStore<IDBValidKey[]>(FILES_STORE, 'readonly', (store) => store.getAllKeys()),
      runInStore<Blob[]>(FILES_STORE, 'readonly', (store) => store.getAll()),
    ]);
    return ids.map((id, index) => ({ id: String(id), file: files[index] }));
  },
};
