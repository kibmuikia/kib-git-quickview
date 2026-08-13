/// <reference types="chrome" />
// file: src/background/index.ts
/**
 * Kib-Git-QuickView Background Service Worker
 * Manifest V3 entry point handling message routing, GitHub REST API cache orchestration,
 * rate limit management, and side-panel integration.
 */

import type {
  ExtensionMessage,
  ExtensionResponse,
  RateLimitInfo,
} from "../types/messages.ts";
import { githubService } from "./github-service.ts";
import {
  getSettings,
  saveSettings,
  getRateLimit,
  clearCache,
} from "./storage.ts";
import { logger } from "../lib/logger.ts";

const LOG_MODULE = "KGQ-BG";

// --- Initialization & Lifecycle Hooks ---

// Initialize Side Panel behavior if sidePanel API is available in Chrome
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((err: unknown) => {
      console.warn("[KGQ-BG] Error configuring sidePanel behavior:", err);
    });
}

chrome.runtime.onInstalled.addListener(
  (details: chrome.runtime.InstalledDetails) => {
    console.debug(
      `[KGQ-BG] Extension installed/updated. Reason: ${details.reason}`,
    );
    getSettings().catch((err) =>
      console.error("[KGQ-BG] Failed reading settings on install:", err),
    );
  },
);

chrome.runtime.onStartup.addListener(() => {
  console.debug("[KGQ-BG] Service worker started.");
});

// --- Runtime Message Relay Bus ---

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void,
  ): boolean => {
    logger.debug("Received message", { module: LOG_MODULE, data: message });
    if (!message || typeof message !== "object") {
      sendResponse({ success: false, error: "Invalid message payload" });
      return false;
    }

    switch (message.type) {
      case "FETCH_USER_PROFILE": {
        const { username, forceRefresh } = message.payload || {};
        if (!username) {
          logger.warn(
            "Missing username parameter in FETCH_USER_PROFILE message",
            { module: LOG_MODULE },
          );
          sendResponse({ success: false, error: "Missing username parameter" });
          return false;
        }

        githubService
          .fetchUserProfile(username, forceRefresh)
          .then(({ profile, rateLimit }) => {
            logger.debug("Fetched user profile successfully", {
              module: LOG_MODULE,
              data: profile,
            });
            sendResponse({ success: true, data: profile, rateLimit });
          })
          .catch((err: Error) => {
            logger.error("Error fetching user profile", {
              module: LOG_MODULE,
              data: err,
            });
            sendResponse({ success: false, error: err.message });
          });

        return true; // Keep response channel open for async fetch
      }

      case "FETCH_USER_REPOS": {
        const { username, limit = 5, forceRefresh } = message.payload || {};
        if (!username) {
          logger.warn(
            "Missing username parameter in FETCH_USER_REPOS message",
            { module: LOG_MODULE },
          );
          sendResponse({ success: false, error: "Missing username parameter" });
          return false;
        }

        githubService
          .fetchUserRepos(username, limit, forceRefresh)
          .then(({ repos, rateLimit }) => {
            sendResponse({ success: true, data: repos, rateLimit });
          })
          .catch((err: Error) => {
            logger.error("Error fetching user repos", {
              module: LOG_MODULE,
              data: err,
            });
            sendResponse({ success: false, error: err.message });
          });

        return true;
      }

      case "GET_RATE_LIMIT": {
        getRateLimit()
          .then((rateLimit: RateLimitInfo | null) => {
            sendResponse({ success: true, data: rateLimit });
          })
          .catch((err: Error) => {
            logger.error("Error fetching rate limit", {
              module: LOG_MODULE,
              data: err,
            });
            sendResponse({ success: false, error: err.message });
          });

        return true;
      }

      case "GET_SETTINGS": {
        getSettings()
          .then((settings) => {
            sendResponse({ success: true, data: settings });
          })
          .catch((err: Error) => {
            logger.error("Error fetching settings", {
              module: LOG_MODULE,
              data: err,
            });
            sendResponse({ success: false, error: err.message });
          });

        return true;
      }

      case "SAVE_SETTINGS": {
        saveSettings(message.payload || {})
          .then((updatedSettings) => {
            sendResponse({ success: true, data: updatedSettings });
          })
          .catch((err: Error) => {
            logger.error("Error saving settings", {
              module: LOG_MODULE,
              data: err,
            });
            sendResponse({ success: false, error: err.message });
          });

        return true;
      }

      case "CLEAR_CACHE": {
        clearCache()
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((err: Error) => {
            sendResponse({ success: false, error: err.message });
          });

        return true;
      }

      case "PING": {
        sendResponse({
          success: true,
          data: { status: "PONG", timestamp: Date.now() },
        });
        return false;
      }

      default: {
        console.warn(
          `[KGQ-BG] Unhandled message type: ${(message as { type: string }).type}`,
        );
        sendResponse({ success: false, error: "Unknown message type" });
        return false;
      }
    }
  },
);
