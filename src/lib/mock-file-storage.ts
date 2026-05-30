const DB_NAME = "studyflow_mock_files";
const DB_VERSION = 1;
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function storageKey(bucket: string, path: string) {
  return `${bucket}::${path}`;
}

export async function saveMockFile(bucket: string, path: string, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE).put(
      { blob: file, name: file.name, type: file.type, size: file.size },
      storageKey(bucket, path),
    );
  });
  db.close();
}

export async function getMockFileRecord(
  bucket: string,
  path: string,
): Promise<{ blob: Blob; name: string; type: string } | null> {
  const db = await openDb();
  const record = await new Promise<{ blob: Blob; name: string; type: string } | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(STORE).get(storageKey(bucket, path));
    req.onsuccess = () => resolve((req.result as { blob: Blob; name: string; type: string }) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return record;
}

export async function getMockFileObjectUrl(bucket: string, path: string): Promise<string | null> {
  const record = await getMockFileRecord(bucket, path);
  if (!record) return null;
  return URL.createObjectURL(record.blob);
}

export async function removeMockFiles(bucket: string, paths: string[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    const store = tx.objectStore(STORE);
    for (const path of paths) {
      store.delete(storageKey(bucket, path));
    }
  });
  db.close();
}
