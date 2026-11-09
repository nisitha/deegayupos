/**
 * Browser IndexedDB + LocalStorage Offline-First Catalog Cache
 * Provides instantaneous (0ms) local launch for PixelCraft POS.
 */

export interface CachedCatalogData<T> {
  timestamp: number;
  products: T[];
  categories: Array<{ id: string; name: string; slug: string; count: number }>;
  total: number;
}

const DB_NAME = 'pixelcraft_pos_db';
const DB_VERSION = 1;
const STORE_NAME = 'pos_catalog_cache';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'tenantSlug' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = () => {
        console.warn('IndexedDB failed to open, falling back to localStorage');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function getCachedCatalog<T>(
  tenantSlug: string = 'deegayu',
): Promise<CachedCatalogData<T> | null> {
  if (typeof window === 'undefined') return null;

  // 1. Try IndexedDB first (Fast binary non-blocking storage)
  try {
    const db = await openDatabase();
    if (db) {
      const result = await new Promise<CachedCatalogData<T> | null>((resolve) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const getRequest = store.get(tenantSlug);

          getRequest.onsuccess = () => {
            const val = getRequest.result;
            if (val && val.products && val.products.length > 0) {
              resolve({
                timestamp: val.timestamp || Date.now(),
                products: val.products as T[],
                categories: val.categories || [],
                total: val.total || val.products.length,
              });
            } else {
              resolve(null);
            }
          };

          getRequest.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (result) {
        return result;
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // 2. Fallback to localStorage
  try {
    const localKey = `pixelcraft_catalog_${tenantSlug}`;
    const raw = localStorage.getItem(localKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.products && parsed.products.length > 0) {
        return parsed as CachedCatalogData<T>;
      }
    }
  } catch (err) {
    console.warn('Error reading from localStorage fallback:', err);
  }

  return null;
}

export async function saveCachedCatalog<T>(
  tenantSlug: string = 'deegayu',
  data: {
    products: T[];
    categories: Array<{ id: string; name: string; slug: string; count: number }>;
    total: number;
  },
): Promise<void> {
  if (typeof window === 'undefined') return;

  const payload = {
    tenantSlug,
    timestamp: Date.now(),
    products: data.products,
    categories: data.categories,
    total: data.total,
  };

  // 1. Write to IndexedDB
  try {
    const db = await openDatabase();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const putRequest = store.put(payload);

          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } catch (err) {
          reject(err);
        }
      });
    }
  } catch (err) {
    console.warn('Error writing to IndexedDB:', err);
  }

  // 2. Write to localStorage as secondary backup (safely truncated to avoid 5MB limit)
  try {
    const localKey = `pixelcraft_catalog_${tenantSlug}`;
    const compactPayload = {
      timestamp: Date.now(),
      products: data.products.slice(0, 200),
      categories: data.categories,
      total: data.total,
    };
    localStorage.setItem(localKey, JSON.stringify(compactPayload));
  } catch {
    // LocalStorage quota may be reached; IndexedDB holds the primary full dataset
  }
}

