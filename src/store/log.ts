/**
 * IndexedDB event log for AirGap.fm.
 * Records heard, relayed, dropped events with reasons.
 * Exports to JSON and CSV.
 */

export interface LogEntry {
  id?: number;
  timestamp: number;
  event: 'heard' | 'relayed' | 'dropped' | 'sent' | 'decoded' | 'failed';
  alertId?: number;
  templateId?: number;
  hop?: number;
  reason?: string;
  protocol?: string;
  distance?: string;
  meta?: Record<string, unknown>;
}

const DB_NAME = 'airgap-log';
const DB_VERSION = 1;
const STORE_NAME = 'events';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('event', 'event');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function logEvent(entry: LogEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllLogs(): Promise<LogEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).index('timestamp').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearLogs(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportJSON(): Promise<string> {
  const logs = await getAllLogs();
  return JSON.stringify(logs, null, 2);
}

export async function exportCSV(): Promise<string> {
  const logs = await getAllLogs();
  if (logs.length === 0) return '';

  const headers = [
    'timestamp',
    'event',
    'alertId',
    'templateId',
    'hop',
    'reason',
    'protocol',
    'distance',
  ];

  const rows = logs.map((l) =>
    headers
      .map((h) => {
        const val = (l as unknown as Record<string, unknown>)[h];
        return val !== undefined && val !== null ? String(val) : '';
      })
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
