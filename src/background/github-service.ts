/// <reference types="chrome" />
// file: src/background/github-service.ts

import type {
  GitHubUserProfile,
  GitHubRepository,
  RateLimitInfo,
} from "../types/messages.ts";
import {
  getSettings,
  saveRateLimit,
  getCachedData,
  setCachedData,
} from "./storage.ts";
import { logger } from "../lib/logger.ts";
import {
  DEFAULT_TIMEOUT_MS,
  GITHUB_API_BASE,
  GitHubApiError,
  GitHubAuthError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubParseError,
  GitHubRateLimitError,
  GitHubServiceError,
  GitHubTimeoutError,
} from "../lib/github/types.ts";

const LOG_MODULE = "KGQ-BG-GH";

export class GitHubService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };

    try {
      const settings = await getSettings();
      if (settings.pat?.trim()) {
        headers.Authorization = `Bearer ${settings.pat.trim()}`;
      }
    } catch (err) {
      // Settings should never block a request; degrade to unauthenticated.
      logger.warn("Failed to load settings; proceeding unauthenticated.", {
        module: LOG_MODULE,
        data: { error: err },
      });
    }

    return headers;
  }

  private updateRateLimitFromHeaders(headers: Headers): RateLimitInfo | null {
    const limit = headers.get("x-ratelimit-limit");
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");

    if (!limit || !remaining || !reset) {
      return null;
    }

    const rateLimitInfo: RateLimitInfo = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      resetTime: parseInt(reset, 10),
    };

    // Persisting rate-limit info is best-effort; never let it break the caller.
    saveRateLimit(rateLimitInfo).catch((err: unknown) => {
      logger.warn("Failed to persist rate limit info.", {
        module: LOG_MODULE,
        data: { error: err },
      });
    });

    return rateLimitInfo;
  }

  /**
   * fetch() wrapped with a timeout, translating network-level failures
   * (offline, DNS, aborted) into typed errors instead of leaking a raw
   * TypeError / DOMException.
   */
  private async fetchWithTimeout(
    url: string,
    headers: HeadersInit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { headers, signal: controller.signal });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new GitHubTimeoutError(timeoutMs);
      }
      throw new GitHubNetworkError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Safely parses a JSON response body. GitHub can return empty bodies
   * (e.g. 204/304) or, during outages, non-JSON error pages — both would
   * otherwise throw an unhandled SyntaxError out of `res.json()`.
   */
  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!text) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new GitHubParseError(err);
    }
  }

  /**
   * Centralized non-2xx handling shared by both public methods, so a 404
   * or a rate limit is reported identically regardless of which endpoint
   * hit it.
   */
  private async assertOk(res: Response, username: string): Promise<void> {
    if (res.ok) return;

    if (res.status === 404) {
      throw new GitHubNotFoundError(username);
    }

    if (res.status === 401) {
      throw new GitHubAuthError();
    }

    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const retryAfter = res.headers.get("retry-after");
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetTime = resetHeader ? parseInt(resetHeader, 10) : undefined;

      if (retryAfter) {
        // Secondary rate limit / abuse detection. GitHub sets Retry-After
        // for this case independent of the primary x-ratelimit-* headers.
        throw new GitHubRateLimitError(
          `GitHub is temporarily throttling requests. Retry after ${retryAfter}s.`,
          resetTime,
          true,
        );
      }

      if (remaining === "0") {
        throw new GitHubRateLimitError(
          "GitHub API rate limit exceeded. Configure a Personal Access Token in Options to raise your limit.",
          resetTime,
          false,
        );
      }

      // 403 with quota remaining is a permissions/abuse issue, not a rate limit.
      throw new GitHubAuthError(
        "GitHub API forbade this request. Check your Personal Access Token permissions in Options.",
      );
    }

    let detail: unknown;
    try {
      detail = await this.parseJson<{ message?: string }>(res);
    } catch {
      detail = undefined;
    }

    throw new GitHubApiError(res.status, detail);
  }

  public async fetchUserProfile(
    username: string,
    forceRefresh = false,
  ): Promise<{ profile: GitHubUserProfile; rateLimit?: RateLimitInfo }> {
    const cleanUser = username.toLowerCase().trim().replace(/^@/, "");
    if (!cleanUser) {
      throw new GitHubServiceError("A GitHub username is required.");
    }

    const cacheKey = `user_${cleanUser}`;

    if (!forceRefresh) {
      try {
        const settings = await getSettings();
        const cached = await getCachedData<GitHubUserProfile>(
          cacheKey,
          settings.cacheTtlMinutes,
        );
        if (cached) {
          return { profile: cached };
        }
      } catch (err) {
        // Cache is an optimization, not a dependency — fall through to network.
        logger.warn(`Cache lookup failed for '@${cleanUser}'.`, {
          module: LOG_MODULE,
          data: { error: err },
        });
      }
    }

    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(
      `${GITHUB_API_BASE}/users/${cleanUser}`,
      headers,
    );

    const rateLimit = this.updateRateLimitFromHeaders(res.headers) ?? undefined;

    await this.assertOk(res, cleanUser);

    const raw = await this.parseJson<Record<string, unknown>>(res);

    if (typeof raw.login !== "string") {
      throw new GitHubParseError(
        new Error(
          `Malformed profile payload for '@${cleanUser}': missing 'login'.`,
        ),
      );
    }

    logger.debug(`Fetched user profile for '@${cleanUser}'`, {
      module: LOG_MODULE,
      data: { status: res.status, rateLimit },
    });

    const profile: GitHubUserProfile = {
      username: raw.login,
      name: (raw.name as string) || raw.login,
      avatarUrl: raw.avatar_url as string,
      bio: (raw.bio as string) || "No public bio provided.",
      publicRepos: (raw.public_repos as number) || 0,
      followers: (raw.followers as number) || 0,
      following: (raw.following as number) || 0,
      company: (raw.company as string) || undefined,
      location: (raw.location as string) || undefined,
      blog: (raw.blog as string) || undefined,
      htmlUrl: raw.html_url as string,
    };

    try {
      await setCachedData(cacheKey, profile);
    } catch (err) {
      logger.warn(`Failed to cache profile for '@${cleanUser}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    }

    return { profile, rateLimit };
  }

  public async fetchUserRepos(
    username: string,
    limit = 5,
    forceRefresh = false,
  ): Promise<{ repos: GitHubRepository[]; rateLimit?: RateLimitInfo }> {
    const cleanUser = username.toLowerCase().trim().replace(/^@/, "");
    if (!cleanUser) {
      throw new GitHubServiceError("A GitHub username is required.");
    }

    const cacheKey = `repos_${cleanUser}_limit_${limit}`;

    if (!forceRefresh) {
      try {
        const settings = await getSettings();
        const cached = await getCachedData<GitHubRepository[]>(
          cacheKey,
          settings.cacheTtlMinutes,
        );
        if (cached) {
          return { repos: cached };
        }
      } catch (err) {
        logger.warn(`Cache lookup failed for repos of '@${cleanUser}'.`, {
          module: LOG_MODULE,
          data: { error: err },
        });
      }
    }

    const headers = await this.getAuthHeaders();
    const url = `${GITHUB_API_BASE}/users/${cleanUser}/repos?sort=updated&per_page=${limit}`;
    const res = await this.fetchWithTimeout(url, headers);

    const rateLimit = this.updateRateLimitFromHeaders(res.headers) ?? undefined;

    await this.assertOk(res, cleanUser);

    const rawList = await this.parseJson<unknown>(res);

    if (!Array.isArray(rawList)) {
      throw new GitHubParseError(
        new Error(
          `Expected an array of repos for '@${cleanUser}', got ${typeof rawList}.`,
        ),
      );
    }

    const repos: GitHubRepository[] = rawList.map(
      (raw: Record<string, unknown>) => ({
        id: raw.id as number,
        name: raw.name as string,
        fullName: raw.full_name as string,
        description: raw.description as string | null,
        htmlUrl: raw.html_url as string,
        stargazersCount: (raw.stargazers_count as number) || 0,
        forksCount: (raw.forks_count as number) || 0,
        language: (raw.language as string) || "Plain Text",
        updatedAt: raw.updated_at as string,
      }),
    );

    try {
      await setCachedData(cacheKey, repos);
    } catch (err) {
      logger.warn(`Failed to cache repos for '@${cleanUser}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    }

    return { repos, rateLimit };
  }
}

export const githubService = new GitHubService();
