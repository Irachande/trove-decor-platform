export type OfflineSnapshot = {
  key: "latest";
  businessId: number;
  businessName: string;
  itemCount: number;
  upcomingReservations: number;
  savedAt: string;
  data: unknown;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("trove-offline", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("snapshots")) {
        request.result.createObjectStore("snapshots", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineSnapshot(snapshot: Omit<OfflineSnapshot, "key" | "savedAt">) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("snapshots", "readwrite");
    transaction.objectStore("snapshots").put({
      ...snapshot,
      key: "latest",
      savedAt: new Date().toISOString(),
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

export async function loadOfflineSnapshot() {
  const database = await openDatabase();
  const snapshot = await new Promise<OfflineSnapshot | undefined>((resolve, reject) => {
    const request = database.transaction("snapshots").objectStore("snapshots").get("latest");
    request.onsuccess = () => resolve(request.result as OfflineSnapshot | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return snapshot;
}
