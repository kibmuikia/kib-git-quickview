/// <reference types="chrome" />
// file: src/popup/popup.ts

import "./popup.css";
import { IS_DEV_MODE, LOGO_PNG_URL } from "../lib/constants";
import { setLogo } from "../lib/utils";
import { type GitHubUserProfile, type GitHubRepository, type MockUser, isMockUser } from "../lib/github/types";
import { sendExtensionMessage } from "../lib/messaging";
import { logger } from "../lib/logger";

const LOG_MODULE: import("../lib/logger").LogModuleCode = "KGQ-POP";

export type PopupState = "initial" | "loading" | "success" | "error";
export type ThemeMode = "dark" | "light" | "system";

export interface LangStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export class PopupController {
  private currentState: PopupState = "initial";
  private currentTheme: ThemeMode = "dark";
  private currentUsername: string = "";
  private currentMockMode: boolean = false;

  constructor() {
    this.initThemeAndModeIndicators();
    this.bindEvents();
    this.setState("initial");
    this.setLogo();
  }

  /* --- Theme Management + Mode Indicators --- */
  private async initThemeAndModeIndicators(): Promise<void> {
    try {
      // IS_DEV_MODE is a build-time constant (import.meta.env.DEV) — inlined here so the DEV chip only ships into dev bundles.
      const devIndicator = document.getElementById("dev-mode-indicator");
      if (devIndicator) {
        devIndicator.hidden = !IS_DEV_MODE;
      }

      const response = await sendExtensionMessage({
        type: "GET_SETTINGS",
      });

      logger.debug("Fetched settings for initialization tasks", {
        module: LOG_MODULE,
        data: {
          isDevMode: IS_DEV_MODE,
          resSuccess: response.success,
          resData: response.data,
        },
      });

      if (!response.success) {
        throw new Error(
          response.error
            ? response.error
            : `Error encountered while fetching settings`,
        );
      }

      const data = response.data;
      if (data) {
        if (data.theme) {
          this.setTheme(data.theme, { persist: false });
        }

        // Effective mock mode requires BOTH the runtime toggle and the dev build flag.
        this.currentMockMode = Boolean(data.mockMode) && IS_DEV_MODE;

        const mockIndicator = document.getElementById("mock-mode-indicator");
        if (mockIndicator) mockIndicator.hidden = !data.mockMode;

        this.applyMockModeUI();
      }
    } catch {
      // Background worker unreachable (e.g. standalone preview) — keep default theme
      logger.warn("Failed to fetch theme preference", {
        module: LOG_MODULE,
      });
      this.showToast("Error encountered while fetching theme preference");
    }
  }

  public setTheme(mode: ThemeMode, opts: { persist?: boolean } = {}): void {
    this.currentTheme = mode;
    document.documentElement.setAttribute("data-theme", mode);

    if (opts.persist === false) return;

    sendExtensionMessage({
      type: "SAVE_SETTINGS",
      payload: { theme: mode },
    }).catch(() => {
      // Non-fatal: theme still applied to DOM this session, just not persisted
      this.showToast("Couldn't save theme preference");
    });
  }

  public toggleTheme(): void {
    const nextMode: ThemeMode =
      this.currentTheme === "light" ? "dark" : "light";
    this.setTheme(nextMode, { persist: true });
    this.showToast(`Theme switched to: ${nextMode.toUpperCase()}`);
  }

  /* --- State Management --- */
  public setState(state: PopupState): void {
    try {
      this.currentState = state;
      const main = document.getElementById("main-content");
      if (main) {
        main.setAttribute("data-state", state);
      }
    } catch (err) {
      logger.error("Failed to set popup state", {
        module: LOG_MODULE,
        data: { error: err, attemptedState: state },
      });
    }
  }

  /* --- Set logo --- */
  public setLogo(): void {
    setLogo(LOGO_PNG_URL);
  }

  private applyMockModeUI(): void {
    const isMock = this.currentMockMode;

    document
      .getElementById("search-form-initial")
      ?.classList.toggle("hidden", isMock);

    document.querySelector(".try-prompt")?.classList.toggle("hidden", isMock);

    document
      .getElementById("mock-flow-picker")
      ?.classList.toggle("hidden", !isMock);
  }

  /* --- Search Trigger --- */
  public async handleSearch(
    username: string,
    opts: { isMockFlow?: boolean } = {},
  ): Promise<void> {
    const cleanUsername = username.trim().replace(/^@/, "");

    // Empty submit handling
    if (!cleanUsername) {
      this.showInputErrorCue("Please enter a valid GitHub username");
      return;
    }

    this.hideInputErrorCue();
    this.currentUsername = cleanUsername;
    const isMockFlow = opts.isMockFlow ?? false;

    // Transition to LOADING state
    this.setState("loading");
    this.updateLoadingUI(this.currentUsername, isMockFlow);

    try {
      // 1. Fetch User Profile
      this.updateTerminalLog("> Querying GitHub API profile endpoint...");

      let profile: GitHubUserProfile | null = null;

      if (
        typeof chrome !== "undefined" &&
        typeof chrome.runtime?.sendMessage === "function"
      ) {
        const response = await sendExtensionMessage({
          type: "FETCH_USER_PROFILE",
          payload: { username: cleanUsername, viaMockBtn: isMockFlow },
        });
        logger.debug("FETCH_USER_PROFILE response", {
          module: LOG_MODULE,
          data: { responseData: response },
        });

        if (!response.success || !response.data) {
          throw new Error(response.error || "Failed to fetch profile");
        }
        profile = response.data;
      } else {
        // Fallback for standalone preview / mock testing
        await new Promise((r) => setTimeout(r, 600));
        profile = {
          username: cleanUsername,
          name: cleanUsername === "octocat" ? "The Octocat" : cleanUsername,
          avatarUrl: `https://avatars.githubusercontent.com/${cleanUsername}`,
          bio: "GitHub developer account & open-source contributor.",
          publicRepos: 142,
          followers: 8400,
          following: 120,
          location: "San Francisco, CA",
          htmlUrl: `https://github.com/${cleanUsername}`,
        };
      }

      // 2. Fetch User Repos for language analysis
      this.updateTerminalLog(
        "> Fetching repository manifests & top languages...",
      );

      let repos: GitHubRepository[] = [];
      if (
        typeof chrome !== "undefined" &&
        typeof chrome.runtime?.sendMessage === "function"
      ) {
        try {
          const repoResponse = await sendExtensionMessage({
            type: "FETCH_USER_REPOS",
            payload: { username: cleanUsername, limit: 10 },
          });
          if (repoResponse.success && repoResponse.data) {
            repos = repoResponse.data;
          }
        } catch {
          // Non-fatal if repos fail; we still render profile
        }
      }

      // Transition to SUCCESS state
      this.renderSuccessProfile(profile, repos);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.renderErrorState(errorMessage, cleanUsername);
    }
  }

  private updateLoadingUI(username: string, isMockFlow = false): void {
    const usernameEl = document.getElementById("loading-username");
    if (usernameEl) {
      usernameEl.textContent = isMockFlow ? "TEST FLOW" : `@${username}`;
    }
    this.updateTerminalLog(
      isMockFlow
        ? "> Running mock fixture pipeline..."
        : "> Initializing sensor array...",
    );
  }

  private updateTerminalLog(text: string): void {
    const logEl = document.getElementById("terminal-log-text");
    if (logEl) {
      logEl.textContent = text;
    }
  }

  /* --- Success Rendering --- */
  private renderSuccessProfile(
    profile: GitHubUserProfile,
    repos: GitHubRepository[],
  ): void {
    const avatar = document.getElementById("user-avatar") as HTMLImageElement;
    const name = document.getElementById("user-name");
    const bio = document.getElementById("user-bio");
    const locationRow = document.getElementById("user-location");
    const locationText = document.getElementById("user-location-text");

    const reposEl = document.getElementById("stat-repos");
    const followersEl = document.getElementById("stat-followers");
    const starsEl = document.getElementById("stat-stars");

    const githubLink = document.getElementById(
      "btn-github-profile",
    ) as HTMLAnchorElement;

    if (avatar) {
      avatar.src =
        profile.avatarUrl ||
        `https://avatars.githubusercontent.com/${profile.username}`;
    }
    if (name) {
      name.textContent = profile.name || profile.username;
    }
    if (bio) {
      bio.textContent = profile.bio || "No public bio provided.";
    }

    if (locationRow && locationText) {
      if (profile.location) {
        locationText.textContent = profile.location;
        locationRow.style.display = "flex";
      } else {
        locationRow.style.display = "none";
      }
    }

    if (reposEl)
      reposEl.textContent = this.formatNumber(profile.publicRepos || 0);
    if (followersEl)
      followersEl.textContent = this.formatNumber(profile.followers || 0);

    // Calculate total stars from fetched repos or estimate
    const totalStars = repos.reduce(
      (sum, r) => sum + (r.stargazersCount || 0),
      0,
    );
    if (starsEl)
      starsEl.textContent = this.formatNumber(
        totalStars > 0 ? totalStars : profile.publicRepos * 3,
      );

    if (githubLink) {
      githubLink.href =
        profile.htmlUrl || `https://github.com/${profile.username}`;
    }

    // Render Top Languages
    this.renderTopLanguages(repos);

    this.setState("success");
  }

  private renderTopLanguages(repos: GitHubRepository[]): void {
    const langBar = document.getElementById("lang-bar");
    const langLegend = document.getElementById("lang-legend");

    const langCounts: Record<string, number> = {};
    repos.forEach((r) => {
      if (r.language) {
        langCounts[r.language] = (langCounts[r.language] || 0) + 1;
      }
    });

    const total = Object.values(langCounts).reduce((a, b) => a + b, 0);

    let stats: LangStat[] = [];
    if (total > 0) {
      const colors = ["#8b3a16", "#6b583e", "#8e7c6d", "#a08c70"];
      stats = Object.entries(langCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([lang, count], idx) => ({
          name: lang,
          count,
          percentage: Math.round((count / total) * 100),
          color: colors[idx % colors.length],
        }));
    } else {
      // Fallback default language breakdown
      stats = [
        { name: "TypeScript", count: 5, percentage: 50, color: "#8b3a16" },
        { name: "C++", count: 3, percentage: 30, color: "#6b583e" },
        { name: "Shell", count: 2, percentage: 20, color: "#8e7c6d" },
      ];
    }

    if (langBar) {
      langBar.innerHTML = stats
        .map(
          (s) =>
            `<div class="lang-segment" style="width: ${s.percentage}%; background-color: ${s.color};" title="${s.name}: ${s.percentage}%"></div>`,
        )
        .join("");
    }

    if (langLegend) {
      langLegend.innerHTML = stats
        .map(
          (s) =>
            `<span class="lang-item"><span class="lang-dot" style="background-color: ${s.color};"></span> ${s.name}</span>`,
        )
        .join("");
    }
  }

  /* --- Error State Handling --- */
  private renderErrorState(rawError: string, username: string): void {
    const errorTitle = document.getElementById("error-title");
    const errorDesc = document.getElementById("error-description");
    const errorInput = document.getElementById(
      "search-input-error",
    ) as HTMLInputElement;
    const errorActionBtn = document.getElementById("btn-error-action");

    if (errorInput) {
      errorInput.value = username;
    }

    const lowerErr = rawError.toLowerCase();

    if (lowerErr.includes("404") || lowerErr.includes("not found")) {
      if (errorTitle) errorTitle.textContent = "Username Not Found";
      if (errorDesc) {
        errorDesc.textContent = `The account "@${username}" does not exist on GitHub. Check for spelling errors or try another username.`;
      }
      if (errorActionBtn) errorActionBtn.textContent = "SEARCH AGAIN \u2192";
    } else if (lowerErr.includes("rate limit") || lowerErr.includes("403")) {
      if (errorTitle) errorTitle.textContent = "Rate Limit Reached";
      if (errorDesc) {
        errorDesc.textContent =
          "GitHub API rate limit exceeded. Authenticate with a PAT in settings for higher limits.";
      }
      if (errorActionBtn) errorActionBtn.textContent = "OPEN SETTINGS \u2192";
    } else if (
      lowerErr.includes("network") ||
      lowerErr.includes("failed to fetch") ||
      !navigator.onLine
    ) {
      if (errorTitle) errorTitle.textContent = "Connection Error";
      if (errorDesc) {
        errorDesc.textContent =
          "Network request failed. Please check your internet connection and try again.";
      }
      if (errorActionBtn) errorActionBtn.textContent = "RETRY SEARCH \u2192";
    } else {
      if (errorTitle) errorTitle.textContent = "Unable to Fetch Profile";
      if (errorDesc) {
        errorDesc.textContent =
          rawError ||
          "An unexpected error occurred while communicating with GitHub.";
      }
      if (errorActionBtn) errorActionBtn.textContent = "RETRY \u2192";
    }

    this.setState("error");
  }

  /* --- Input Cue Helper --- */
  private showInputErrorCue(message: string): void {
    const cue = document.getElementById("search-error-cue");
    if (cue) {
      cue.textContent = message;
      cue.hidden = false;
    }
  }

  private hideInputErrorCue(): void {
    const cue = document.getElementById("search-error-cue");
    if (cue) {
      cue.hidden = true;
    }
  }

  /* --- Utility Functions --- */
  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "m";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return String(num);
  }

  public showToast(message: string): void {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  /* --- Event Listeners Binding --- */
  private bindEvents(): void {
    // Theme toggle
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      this.toggleTheme();
    });

    // Initial Search Form
    const initialForm = document.getElementById(
      "search-form-initial",
    ) as HTMLFormElement;
    initialForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById(
        "search-input-initial",
      ) as HTMLInputElement;
      this.handleSearch(input?.value || "");
    });

    document
      .querySelectorAll<HTMLButtonElement>(".mock-flow-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const rawScenario = btn.dataset.mockScenario;
          const scenario: MockUser = isMockUser(rawScenario)
            ? rawScenario
            : "mockuser";
          this.handleSearch(scenario, { isMockFlow: true });
        });
      });

    // Error Search Form
    const errorForm = document.getElementById(
      "search-form-error",
    ) as HTMLFormElement;
    errorForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById(
        "search-input-error",
      ) as HTMLInputElement;
      const title = document.getElementById("error-title")?.textContent || "";
      if (title === "Rate Limit Reached") {
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      } else {
        this.handleSearch(input?.value || "");
      }
    });

    // Quick Try Link (octocat)
    document
      .getElementById("btn-try-octocat")
      ?.addEventListener("click", () => {
        const input = document.getElementById(
          "search-input-initial",
        ) as HTMLInputElement;
        if (input) input.value = "octocat";
        this.handleSearch("octocat");
      });

    // Abort Sequence Button
    document
      .getElementById("btn-abort-sequence")
      ?.addEventListener("click", () => {
        this.setState("initial");
        this.showToast("Search sequence cancelled");
      });

    // Search another username link
    document
      .getElementById("btn-search-another")
      ?.addEventListener("click", () => {
        this.setState("initial");
      });

    // Reset from error view back to initial
    document
      .getElementById("btn-error-reset")
      ?.addEventListener("click", () => {
        this.setState("initial");
      });

    // Explore in Side Panel button
    document
      .getElementById("btn-sidepanel-explore")
      ?.addEventListener("click", () => {
        if (typeof chrome !== "undefined" && chrome.sidePanel?.open) {
          chrome.windows.getCurrent((win) => {
            if (win.id) {
              chrome.sidePanel.open({ windowId: win.id });
            }
          });
        } else {
          this.showToast("Opening side panel...");
        }
      });

    // Footer Navigation Tabs
    document.getElementById("nav-btn-search")?.addEventListener("click", () => {
      this.setNavActive("nav-btn-search");
      if (this.currentState !== "success") {
        this.setState("initial");
      }
    });

    document
      .getElementById("nav-btn-history")
      ?.addEventListener("click", () => {
        this.setNavActive("nav-btn-history");
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          this.showToast("History opened in Settings");
        }
      });

    document
      .getElementById("nav-btn-settings")
      ?.addEventListener("click", () => {
        this.setNavActive("nav-btn-settings");
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          this.showToast("Opening Settings...");
        }
      });

    // Documentation / Changelog links
    document.getElementById("link-docs")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });

    document
      .getElementById("link-changelog")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      });
  }

  private setNavActive(btnId: string): void {
    document
      .querySelectorAll(".nav-tab")
      .forEach((tab) => tab.classList.remove("active"));
    document.getElementById(btnId)?.classList.add("active");
  }
}
