/// <reference types="chrome" />
// file: src/background/storage.ts

import type { ExtensionSettings, RateLimitInfo } from '../types/messages.ts';

export const SETTINGS_KEY = 'KGQ_settings';
export const RATE_LIMIT_KEY = 'KGQ_rate_limit';
export const CACHE_PREFIX = 'KGQ_cache_';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: 'dark',
  cacheTtlMinutes: 15,
};

let storageMutationQueue: Promise<unknown> = Promise.resolve();

/**
 * Enqueues read-modify-write tasks sequentially to prevent race conditions.
 */
export function enqueueStorageMutation<T>(mutationFn: () => Promise<T>): Promise<T> {
  const next = storageMutationQueue.then(mutationFn, mutationFn);
  storageMutationQueue = next.catch(() => {});
  return next;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<ExtensionSettings> || {}) };
}

export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  return enqueueStorageMutation(async () => {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    return updated;
  });
}

export async function getRateLimit(): Promise<RateLimitInfo | null> {
  const result = await chrome.storage.local.get(RATE_LIMIT_KEY);
  return (result[RATE_LIMIT_KEY] as RateLimitInfo) || null;
}

export async function saveRateLimit(rateLimit: RateLimitInfo): Promise<void> {
  await chrome.storage.local.set({ [RATE_LIMIT_KEY]: rateLimit });
}

interface CacheItem<T> {
  timestamp: number;
  data: T;
}

export async function getCachedData<T>(key: string, ttlMinutes: number): Promise<T | null> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const result = await chrome.storage.local.get(cacheKey);
  const cached = result[cacheKey] as CacheItem<T> | undefined;

  if (!cached) return null;

  const ageMs = Date.now() - cached.timestamp;
  const maxAgeMs = ttlMinutes * 60 * 1000;

  if (ageMs > maxAgeMs) {
    chrome.storage.local.remove(cacheKey);
    return null;
  }

  return cached.data;
}

export async function setCachedData<T>(key: string, data: T): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const item: CacheItem<T> = {
    timestamp: Date.now(),
    data,
  };
  await chrome.storage.local.set({ [cacheKey]: item });
}

export async function clearCache(): Promise<void> {
  const allData = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(allData).filter((key) => key.startsWith(CACHE_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }
}
