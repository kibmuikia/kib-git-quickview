// file: src/lib/storage/settings.ts
/// <reference types="chrome" />

import type { ExtensionSettings } from "../../types/messages.ts";
import { enqueueStorageMutation } from "./mutation-queue.ts";
import { StorageWriteError } from "./errors.ts";
import { logger } from "../logger.ts";
import { IS_DEV_MODE } from "../constants.ts";

const LOG_MODULE: import("../../lib/logger").LogModuleCode = "KGQ-STORAGE-SETTINGS";
export const SETTINGS_KEY = "KGQ_settings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  theme: "dark",
  cacheTtlMinutes: 15,
  mockMode: false,
};

/**
 * Mock mode is only ever "live" when BOTH the runtime toggle and the build-time
 * dev flag are true. Every call site (background client, popup, options) must
 * go through this instead of checking settings.mockMode alone.
 */
export function isMockModeActive(settings: Pick<ExtensionSettings, "mockMode">): boolean {
  return Boolean(settings.mockMode) && IS_DEV_MODE;
}

export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return {
      ...DEFAULT_SETTINGS,
      ...((result[SETTINGS_KEY] as Partial<ExtensionSettings>) || {}),
    };
  } catch (err) {
    logger.warn("Failed to read settings; falling back to defaults.", {
      module: LOG_MODULE,
      data: { error: err },
    });
    // Settings are non-critical — degrade to defaults rather than throw,
    // matching the "never block a caller" posture used elsewhere.
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  return enqueueStorageMutation(async () => {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: updated });
    } catch (err) {
      throw new StorageWriteError(SETTINGS_KEY, err);
    }
    return updated;
  });
}
