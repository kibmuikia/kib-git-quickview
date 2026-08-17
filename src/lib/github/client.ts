// file: src/lib/github/client.ts
import { getSettings } from "../../lib/storage/settings.ts";
import { saveRateLimit } from "../../lib/storage/rate-limit.ts";
import { logger } from "../logger.ts";
import type { RateLimitInfo } from "../../types/messages.ts";
import { DEFAULT_TIMEOUT_MS } from "./types.ts";
import {
  GitHubApiError,
  GitHubAuthError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubParseError,
  GitHubRateLimitError,
  GitHubTimeoutError,
  AbortMockModeActionError,
} from "./error.ts";
import { mockFetch } from "./mock-client.ts";
import { IS_DEV_MODE } from "../constants.ts";

const LOG_MODULE: import("../../lib/logger").LogModuleCode = "KGQ-GH-CLIENT";

export class GitHubClient {
  async getAuthHeaders(): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    try {
      const settings = await getSettings();
      const pat = settings.pat?.trim();
      if (pat) {
        headers.Authorization = `Bearer ${pat}`;
      }
    } catch (err) {
      logger.warn("Failed to load settings; proceeding unauthenticated.", {
        module: LOG_MODULE,
        data: { error: err },
      });
    }
    return headers;
  }

  updateRateLimitFromHeaders(headers: Headers): RateLimitInfo | null {
    const limit = headers.get("x-ratelimit-limit");
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = headers.get("x-ratelimit-reset");
    if (!limit || !remaining || !reset) return null;

    const rateLimitInfo: RateLimitInfo = {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      resetTime: parseInt(reset, 10),
    };

    if (
      !Number.isFinite(rateLimitInfo.limit) ||
      !Number.isFinite(rateLimitInfo.remaining) ||
      !Number.isFinite(rateLimitInfo.resetTime)
    ) {
      return null;
    }

    saveRateLimit(rateLimitInfo).catch((err: unknown) => {
      logger.warn("Failed to persist rate limit info.", {
        module: LOG_MODULE,
        data: { error: err },
      });
    });

    return rateLimitInfo;
  }

  async fetchWithTimeout(
    url: string,
    headers: HeadersInit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    const settings = await getSettings();

    if (settings.mockMode && IS_DEV_MODE) {
      const mockRes = await mockFetch(url);
      logger.debug(
        `Both mock-mode & dev-mode are true, fetching mock-data for, ${url}.`,
        {
          module: LOG_MODULE,
          data: { mockResponse: mockRes },
        },
      );
      return mockRes;
    }

    if (settings.mockMode && !IS_DEV_MODE) {
      // Production build with mock-mode enabled — mock fixtures are stripped
      // from non-dev bundles.
      logger.warn(
        "mockMode is enabled but this is a production build — mock-mode is not available in production.",
        {
          module: LOG_MODULE,
          data: { url, mockMode: true, isDevMode: false },
        },
      );
      throw new AbortMockModeActionError(
        "mockMode is enabled but this is a production build — mock-mode is not available in production.",
      );
    }

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

  async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new GitHubParseError(err);
    }
  }

  async assertOk(res: Response, username: string): Promise<void> {
    if (res.ok) return;

    if (res.status === 404) throw new GitHubNotFoundError(username);
    if (res.status === 401) throw new GitHubAuthError();

    if (res.status === 403) {
      const remaining = res.headers.get("x-ratelimit-remaining");
      const retryAfter = res.headers.get("retry-after");
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetTime = resetHeader ? parseInt(resetHeader, 10) : undefined;
      logger.warn("GitHub API rate limit or auth issue.", {
        module: LOG_MODULE,
        data: {
          status: res.status,
          rateHeaders: {
            "x-ratelimit-remaining": remaining,
            "retry-after": retryAfter,
            "x-ratelimit-reset": resetHeader,
          },
          headers: Object.fromEntries(res.headers.entries()),
        },
      });
      if (retryAfter) {
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
}

export const githubClient = new GitHubClient();
