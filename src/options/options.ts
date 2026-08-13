// file: src/options/options.ts
import "./options.css";
import {
  ExtensionSettings,
  RateLimitInfo,
  MessageResponseMap,
  ExtensionMessage,
  GetSettingsMessage,
  SaveSettingsMessage,
  ClearCacheMessage,
  GetRateLimitMessage,
} from "../types/messages";
import { LOGO_PNG_URL } from "../lib/constants";
import { setLogo } from "../lib/utils";

export class OptionsController {
  private form = document.getElementById("settings-form") as HTMLFormElement;
  private patInput = document.getElementById("pat-input") as HTMLInputElement;
  private btnTogglePat = document.getElementById(
    "btn-toggle-pat",
  ) as HTMLButtonElement;
  private cacheTtlInput = document.getElementById(
    "cache-ttl-input",
  ) as HTMLInputElement;
  private btnClearCache = document.getElementById(
    "btn-clear-cache",
  ) as HTMLButtonElement;
  private toastContainer = document.getElementById(
    "toast-container",
  ) as HTMLDivElement;

  private rateLimitCount = document.getElementById(
    "rate-limit-count",
  ) as HTMLSpanElement;
  private rateLimitBar = document.getElementById(
    "rate-limit-bar",
  ) as HTMLDivElement;
  private rateLimitReset = document.getElementById(
    "rate-limit-reset",
  ) as HTMLSpanElement;

  constructor() {
    this.initNavigation();
    this.initEventListeners();
    this.loadSettings();
    this.loadRateLimit();
    this.setLogo();
  }

  /* private async sendMessage<T>(message: ExtensionMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  } */ // This method is commented out because it was replaced with a more type-safe version below.

  private sendExtensionMessage<T extends ExtensionMessage>(
    message: T,
  ): Promise<MessageResponseMap[T["type"]]> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        message,
        (response: MessageResponseMap[T["type"]]) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        },
      );
    });
  }

  private initNavigation(): void {
    const navItems = document.querySelectorAll<HTMLAnchorElement>(".nav-item");
    const sections = document.querySelectorAll<HTMLElement>(".tab-section");

    const switchTab = (targetId: string) => {
      navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.tab === targetId);
      });
      sections.forEach((section) => {
        section.classList.toggle("active", section.id === `tab-${targetId}`);
      });
    };

    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = item.dataset.tab;
        if (tab) {
          switchTab(tab);
          window.location.hash = tab;
        }
      });
    });

    const currentHash = window.location.hash.replace("#", "");
    if (currentHash && ["settings", "about", "faq"].includes(currentHash)) {
      switchTab(currentHash);
    }
  }

  private initEventListeners(): void {
    this.btnTogglePat.addEventListener("click", () => {
      const isPassword = this.patInput.type === "password";
      this.patInput.type = isPassword ? "text" : "password";
    });

    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.saveSettings();
    });

    this.btnClearCache.addEventListener("click", async () => {
      await this.clearCache();
    });

    const themeRadios = document.querySelectorAll<HTMLInputElement>(
      'input[name="theme"]',
    );
    themeRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        this.applyThemeToDOM(radio.value as ExtensionSettings["theme"]);
      });
    });
  }

  private applyThemeToDOM(theme: ExtensionSettings["theme"]): void {
    document.documentElement.setAttribute("data-theme", theme);
  }

  private async loadSettings(): Promise<void> {
    try {
      const response = await this.sendExtensionMessage<GetSettingsMessage>({
        type: "GET_SETTINGS",
      });
      if (response.success && response.data) {
        const settings = response.data;
        if (settings.pat) this.patInput.value = settings.pat;
        this.cacheTtlInput.value = (settings.cacheTtlMinutes || 60).toString();

        const themeToSelect = settings.theme || "dark";
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="theme"][value="${themeToSelect}"]`,
        );
        if (radio) radio.checked = true;

        this.applyThemeToDOM(themeToSelect);
      }
    } catch {
      this.showToast(
        "Failed to load settings from background worker.",
        "error",
      );
    }
  }

  private async saveSettings(): Promise<void> {
    const selectedTheme =
      ((
        document.querySelector(
          'input[name="theme"]:checked',
        ) as HTMLInputElement
      )?.value as ExtensionSettings["theme"]) || "dark";

    const updatedSettings: ExtensionSettings = {
      pat: this.patInput.value.trim() || undefined,
      theme: selectedTheme,
      cacheTtlMinutes: parseInt(this.cacheTtlInput.value, 10) || 60,
    };

    try {
      const response = await this.sendExtensionMessage<SaveSettingsMessage>({
        type: "SAVE_SETTINGS",
        payload: updatedSettings,
      });

      if (response.success) {
        this.showToast("Settings saved successfully!");
        this.loadRateLimit();
      } else {
        this.showToast(response.error || "Failed to save settings.", "error");
      }
    } catch {
      this.showToast("Message delivery to background worker failed.", "error");
    }
  }

  private async clearCache(): Promise<void> {
    try {
      const response = await this.sendExtensionMessage<ClearCacheMessage>({
        type: "CLEAR_CACHE",
      });
      if (response.success) {
        this.showToast("Cache cleared successfully!");
      } else {
        this.showToast(response.error || "Failed to clear cache.", "error");
      }
    } catch {
      this.showToast("Failed to request cache clear.", "error");
    }
  }

  /* --- Set logo --- */
  public setLogo(): void {
    setLogo(LOGO_PNG_URL);
  }

  private async loadRateLimit(): Promise<void> {
    try {
      const response = await this.sendExtensionMessage<GetRateLimitMessage>({
        type: "GET_RATE_LIMIT",
      });
      if (response.success && response.data) {
        this.renderRateLimit(response.data);
      }
    } catch {
      // Worker rate limit request fallback
    }
  }

  private renderRateLimit(info: RateLimitInfo): void {
    this.rateLimitCount.textContent = `${info.remaining}/${info.limit}`;
    const pct = Math.min(100, Math.max(0, (info.remaining / info.limit) * 100));
    this.rateLimitBar.style.width = `${pct}%`;

    const resetDate = new Date(info.resetTime * 1000);
    this.rateLimitReset.textContent = `Reset: ${resetDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  private showToast(msg: string, type: "info" | "error" = "info"): void {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}
