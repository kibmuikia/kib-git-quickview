// file: src/lib/cache/cache.ts
/// <reference types="chrome" />

import { StorageWriteError } from "../storage/errors.ts";
import { logger } from "../logger.ts";

const LOG_MODULE = "KGQ-CACHE";
export const CACHE_PREFIX = "KGQ_cache_";

export interface CacheItem<T> {
  timestamp: number;
  data: T;
}

export async function getCachedData<T>(
  key: string,
  ttlMinutes: number,
): Promise<T | null> {
  const cacheKey = `${CACHE_PREFIX}${key}`;

  let cached: CacheItem<T> | undefined;
  try {
    const result = await chrome.storage.local.get(cacheKey);
    cached = result[cacheKey] as CacheItem<T> | undefined;
  } catch (err) {
    logger.warn(`Cache read failed for '${key}'.`, {
      module: LOG_MODULE,
      data: { error: err },
    });
    return null;
  }

  if (!cached) return null;

  const ageMs = Date.now() - cached.timestamp;
  const maxAgeMs = ttlMinutes * 60 * 1000;

  if (ageMs > maxAgeMs) {
    // Expired entry cleanup is best-effort; a failed remove just means a
    // stale key lingers until the next TTL check overwrites or evicts it.
    chrome.storage.local.remove(cacheKey).catch((err: unknown) => {
      logger.warn(`Failed to evict expired cache entry '${key}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    });
    return null;
  }

  return cached.data;
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const item: CacheItem<T> = { timestamp: Date.now(), data };
  try {
    await chrome.storage.local.set({ [cacheKey]: item });
  } catch (err) {
    throw new StorageWriteError(cacheKey, err);
  }
}

export async function clearCache(): Promise<void> {
  try {
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = Object.keys(allData).filter((k) =>
      k.startsWith(CACHE_PREFIX),
    );
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
    }
  } catch (err) {
    logger.warn("Failed to clear cache.", {
      module: LOG_MODULE,
      data: { error: err },
    });
    throw new StorageWriteError(CACHE_PREFIX, err);
  }
}
