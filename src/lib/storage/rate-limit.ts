// file: src/lib/storage/rate-limit.ts
/// <reference types="chrome" />

import type { RateLimitInfo } from "../../types/messages.ts";
import { StorageWriteError } from "./errors.ts";
import { logger } from "../logger.ts";

const LOG_MODULE = "KGQ-STORAGE-RATE-LIMIT";
export const RATE_LIMIT_KEY = "KGQ_rate_limit";

export async function getRateLimit(): Promise<RateLimitInfo | null> {
  try {
    const result = await chrome.storage.local.get(RATE_LIMIT_KEY);
    return (result[RATE_LIMIT_KEY] as RateLimitInfo) || null;
  } catch (err) {
    logger.warn("Failed to read rate limit; treating as unknown.", {
      module: LOG_MODULE,
      data: { error: err },
    });
    return null;
  }
}

export async function saveRateLimit(rateLimit: RateLimitInfo): Promise<void> {
  try {
    await chrome.storage.local.set({ [RATE_LIMIT_KEY]: rateLimit });
  } catch (err) {
    throw new StorageWriteError(RATE_LIMIT_KEY, err);
  }
}
