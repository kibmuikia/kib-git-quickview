/// <reference types="chrome" />

/**
 * GitQuickView — Extension Popup Dashboard Controller
 */

export type PopupState = "loaded" | "loading" | "empty" | "error";
export type ThemeMode = "dark" | "light" | "system";

export interface DeveloperProfile {
  name: string;
  username: string;
  avatarUrl: string;
  bio: string;
  repos: number;
  followers: string;
  stars: string;
  reposList: Array<{
    name: string;
    updatedAgo: string;
    language: string;
    langClass: string;
    url: string;
  }>;
}

const MOCK_PROFILES: Record<string, DeveloperProfile> = {
  el_richards: {
    name: "Eleanor Richards",
    username: "el_richards",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    bio: "Crafting performant digital experiences. Open source contributor & mechanical keyboard enthusiast.",
    repos: 142,
    followers: "8.4k",
    stars: "12k",
    reposList: [
      {
        name: "artisan-ui",
        updatedAgo: "Updated 2h ago",
        language: "TypeScript",
        langClass: "lang-typescript",
        url: "https://github.com",
      },
      {
        name: "mech-kb-firmware",
        updatedAgo: "Updated 1d ago",
        language: "C++",
        langClass: "lang-cpp",
        url: "https://github.com",
      },
      {
        name: "dotfiles",
        updatedAgo: "Updated 3d ago",
        language: "Shell",
        langClass: "lang-shell",
        url: "https://github.com",
      },
    ],
  },
  torvalds: {
    name: "Linus Torvalds",
    username: "torvalds",
    avatarUrl: "https://avatars.githubusercontent.com/u/1024025?v=4",
    bio: "Creator of Linux and Git. Monomaniacal about kernel stability.",
    repos: 8,
    followers: "220k",
    stars: "185k",
    reposList: [
      {
        name: "linux",
        updatedAgo: "Updated 10m ago",
        language: "C",
        langClass: "lang-cpp",
        url: "https://github.com/torvalds/linux",
      },
      {
        name: "pesign",
        updatedAgo: "Updated 2w ago",
        language: "C",
        langClass: "lang-cpp",
        url: "https://github.com/torvalds/pesign",
      },
      {
        name: "uemacs",
        updatedAgo: "Updated 1m ago",
        language: "C",
        langClass: "lang-cpp",
        url: "https://github.com/torvalds/uemacs",
      },
    ],
  },
  gaearon: {
    name: "Dan Abramov",
    username: "gaearon",
    avatarUrl: "https://avatars.githubusercontent.com/u/810438?v=4",
    bio: "Building things for web developers. Ex-React core team.",
    repos: 260,
    followers: "82k",
    stars: "45k",
    reposList: [
      {
        name: "redudx",
        updatedAgo: "Updated 1d ago",
        language: "TypeScript",
        langClass: "lang-typescript",
        url: "https://github.com/gaearon",
      },
      {
        name: "overreacted.io",
        updatedAgo: "Updated 4d ago",
        language: "JavaScript",
        langClass: "lang-typescript",
        url: "https://github.com/gaearon",
      },
    ],
  },
  sindresorhus: {
    name: "Sindre Sorhus",
    username: "sindresorhus",
    avatarUrl: "https://avatars.githubusercontent.com/u/170270?v=4",
    bio: "Full-time open-sourceror. 1,000+ npm packages & Swift apps.",
    repos: 1120,
    followers: "68k",
    stars: "95k",
    reposList: [
      {
        name: "awesome",
        updatedAgo: "Updated 1h ago",
        language: "Markdown",
        langClass: "lang-shell",
        url: "https://github.com/sindresorhus/awesome",
      },
      {
        name: "type-fest",
        updatedAgo: "Updated 5h ago",
        language: "TypeScript",
        langClass: "lang-typescript",
        url: "https://github.com/sindresorhus/type-fest",
      },
    ],
  },
};

export class PopupController {
  private currentTheme: ThemeMode = "dark";

  constructor() {
    this.initTheme();
    this.bindEvents();
  }

  /* --- Theme Management --- */
  private initTheme(): void {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["theme"], (result) => {
        if (result.theme) {
          this.setTheme(result.theme as ThemeMode);
        }
      });
    } else {
      const saved = localStorage.getItem("kib_theme") as ThemeMode;
      if (saved) this.setTheme(saved);
    }
  }

  public setTheme(mode: ThemeMode): void {
    this.currentTheme = mode;
    document.documentElement.setAttribute("data-theme", mode);

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ theme: mode });
    } else {
      localStorage.setItem("kib_theme", mode);
    }
  }

  public cycleTheme(): void {
    const modes: ThemeMode[] = ["dark", "light", "system"];
    const nextIndex = (modes.indexOf(this.currentTheme) + 1) % modes.length;
    const nextMode = modes[nextIndex];
    this.setTheme(nextMode);
    this.showToast(`Theme switched to: ${nextMode.toUpperCase()}`);
  }

  /* --- View State Switcher --- */
  public setState(state: PopupState): void {
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("data-state", state);
    }
  }

  /* --- Render Profile --- */
  public renderProfile(profile: DeveloperProfile): void {
    this.setState("loading");

    setTimeout(() => {
      const avatar = document.getElementById("user-avatar") as HTMLImageElement;
      const name = document.getElementById("user-name");
      const handle = document.getElementById(
        "user-handle",
      ) as HTMLAnchorElement;
      const bio = document.getElementById("user-bio");
      const repos = document.getElementById("stat-repos");
      const followers = document.getElementById("stat-followers");
      const stars = document.getElementById("stat-stars");
      const repoList = document.getElementById("repo-list");

      if (avatar) avatar.src = profile.avatarUrl;
      if (name) name.textContent = profile.name;
      if (handle) {
        handle.textContent = `@${profile.username}`;
        handle.href = `https://github.com/${profile.username}`;
      }
      if (bio) bio.textContent = profile.bio;
      if (repos) repos.textContent = String(profile.repos);
      if (followers) followers.textContent = profile.followers;
      if (stars) stars.textContent = profile.stars;

      if (repoList) {
        repoList.innerHTML = profile.reposList
          .map(
            (r) => `
          <a href="${r.url}" target="_blank" rel="noopener" class="repo-card">
            <div class="repo-info">
              <div class="repo-title-row">
                <svg class="repo-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <span class="repo-name">${r.name}</span>
              </div>
              <span class="repo-meta">${r.updatedAgo}</span>
            </div>
            <span class="language-badge ${r.langClass}">${r.language}</span>
          </a>
        `,
          )
          .join("");
      }

      this.setState("loaded");
    }, 400);
  }

  /* --- Search Handling --- */
  public handleSearch(username: string): void {
    const key = username.toLowerCase().trim().replace(/^@/, "");
    if (!key) return;

    if (MOCK_PROFILES[key]) {
      this.renderProfile(MOCK_PROFILES[key]);
    } else {
      this.setState("loading");
      setTimeout(() => {
        this.renderProfile({
          name: key,
          username: key,
          avatarUrl: `https://avatars.githubusercontent.com/${key}`,
          bio: `GitHub developer account for @${key}. Public activity and repos fetched via GitHub API.`,
          repos: Math.floor(Math.random() * 80) + 5,
          followers: `${(Math.random() * 5).toFixed(1)}k`,
          stars: `${(Math.random() * 8).toFixed(1)}k`,
          reposList: [
            {
              name: `${key}-core`,
              updatedAgo: "Updated 1d ago",
              language: "TypeScript",
              langClass: "lang-typescript",
              url: `https://github.com/${key}`,
            },
            {
              name: "configs",
              updatedAgo: "Updated 5d ago",
              language: "Shell",
              langClass: "lang-shell",
              url: `https://github.com/${key}`,
            },
          ],
        });
      }, 500);
    }
  }

  /* --- Toast Notifications --- */
  public showToast(message: string): void {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  }

  /* --- Event Listeners Binding --- */
  private bindEvents(): void {
    // Theme toggle
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      this.cycleTheme();
    });

    // Search form
    const form = document.getElementById("search-form") as HTMLFormElement;
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("search-input") as HTMLInputElement;
      if (input.value) {
        this.handleSearch(input.value);
        input.value = "";
      }
    });

    // Quick user chips in empty state
    document.querySelectorAll(".chip-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const username = (e.currentTarget as HTMLElement).getAttribute(
          "data-username",
        );
        if (username) this.handleSearch(username);
      });
    });

    // Options button (Opens options.html)
    document.getElementById("btn-options")?.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        this.showToast("TODO: Opening options.html (Coming Soon in v0.2)");
      }
    });

    // Side panel button (Coming soon indicator)
    document.getElementById("btn-sidepanel")?.addEventListener("click", () => {
      this.showToast("Side Panel mode — Planned for v0.2.0");
    });

    // Activity options button
    document
      .getElementById("btn-activity-more")
      ?.addEventListener("click", () => {
        this.showToast("Activity Filters — Coming Soon");
      });

    // Retry button in error state
    document.getElementById("btn-retry")?.addEventListener("click", () => {
      this.handleSearch("el_richards");
    });
  }
}
