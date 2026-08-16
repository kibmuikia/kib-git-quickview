/// <reference types="chrome" />
// file: src/sidepanel/sidepanel.ts

import "./sidepanel.css";
import { LOGO_PNG_URL } from "../lib/constants";
import { setLogo } from "../lib/utils";
import { logger } from "../lib/logger";
import { sendExtensionMessage } from "../lib/messaging";
import type { CurrentTarget } from "../types/messages";

const LOG_MODULE: import("../lib/logger").LogModuleCode = "KGQ-UI";

/**
 * Kib-Git-QuickView Side Panel Controller
 *
 * Companion surface to the popup: receives the last (profile, repos) bundle
 * the background worker stashed from the popup's `FETCH_USER_PROFILE` /
 * `FETCH_USER_REPOS` calls and renders a deeper view of the same user.
 *
 * Phase 1.6 — placeholder render only. Prints username, profile.name, and
 * repo count from `GET_CURRENT_TARGET` to visually confirm the popup→panel
 * handoff works end-to-end. Real header/section rendering lands in Phase 2+.
 */

export class SidePanelController {
  constructor() {
    logger.debug("SidePanelController initialized", { module: LOG_MODULE });
    this.setLogo();
    void this.loadCurrentTarget();
  }

  /* --- Set logo (progressive SVG → PNG swap) --- */
  public setLogo(): void {
    setLogo(LOGO_PNG_URL);
  }

  /* --- Phase 1.6: fetch the popup's last handoff and render a placeholder --- */
  private async loadCurrentTarget(): Promise<void> {
    try {
      const response = await sendExtensionMessage({
        type: "GET_CURRENT_TARGET",
      });
      if (!response.success || !response.data) {
        logger.warn("GET_CURRENT_TARGET returned no data", {
          module: LOG_MODULE,
          data: { error: response.error },
        });
        this.renderStatus("Couldn't reach the background worker.");
        return;
      }
      this.renderTarget(response.data);
    } catch (err) {
      logger.error("Failed to fetch current target", {
        module: LOG_MODULE,
        data: { error: err },
      });
      this.renderStatus("Couldn't reach the background worker.");
    }
  }

  private renderTarget(target: CurrentTarget): void {
    logger.debug("Rendering handoff placeholder", {
      module: LOG_MODULE,
      data: target,
    });

    if (!target.username) {
      this.renderStatus("No popup search yet — look up a user first.");
      return;
    }

    const statusEl = document.getElementById("sp-status");
    const handoffEl = document.getElementById("sp-handoff");
    const usernameEl = document.getElementById("sp-handoff-username");
    const nameEl = document.getElementById("sp-handoff-name");
    const repoCountEl = document.getElementById("sp-handoff-repo-count");

    statusEl?.classList.add("hidden");
    handoffEl?.classList.remove("hidden");

    if (usernameEl) usernameEl.textContent = target.username;
    if (nameEl) nameEl.textContent = target.profile?.name ?? "—";
    if (repoCountEl) {
      repoCountEl.textContent =
        target.repos !== undefined ? String(target.repos.length) : "—";
    }
  }

  private renderStatus(message: string): void {
    const statusEl = document.getElementById("sp-status");
    if (statusEl) statusEl.textContent = message;
  }
}
