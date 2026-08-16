/// <reference types="chrome" />
// file: src/sidepanel/sidepanel.ts
/**
 * Kib-Git-QuickView Side Panel Controller
 *
 * Companion surface to the popup: receives the last (profile, repos) bundle
 * the background worker stashed from the popup's `FETCH_USER_PROFILE` /
 * `FETCH_USER_REPOS` calls and renders a deeper view of the same user.
 *
 * Phase 1.2 — stub only. The class shape mirrors `PopupController` /
 * `OptionsController` so subsequent phases (header card, language bytes,
 * activity timeline, etc.) slot in cleanly.
 */

import "./sidepanel.css";
import { LOGO_PNG_URL } from "../lib/constants";
import { setLogo } from "../lib/utils";
import { logger } from "../lib/logger";

const LOG_MODULE: import("../lib/logger").LogModuleCode = "KGQ-UI";

export class SidePanelController {
  constructor() {
    logger.debug("SidePanelController initialized", { module: LOG_MODULE });
    this.setLogo();
    // Theme + handoff init land in Phase 1.6 / Phase 2.
  }

  /* --- Set logo (progressive SVG → PNG swap) --- */
  public setLogo(): void {
    setLogo(LOGO_PNG_URL);
  }
}
