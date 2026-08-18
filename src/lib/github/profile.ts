// file: src/lib/github/profile.ts
import { githubClient } from "./client.ts";
import { getSettings, isMockModeActive } from "../../lib/storage/settings.ts";
import { getCachedData, setCachedData } from "../../lib/cache/cache.ts";
import { logger } from "../logger.ts";
import {
  GITHUB_API_BASE,
  assertValidGithubUsername,
  GitHubUserProfile,
} from "./types.ts";
import { GitHubParseError, GitHubServiceError } from "./error.ts";
import type { RateLimitInfo } from "../../types/messages.ts";
import { assertValidGitHubUserResponse } from "./utils.ts";
import { IS_DEV_MODE } from "../constants.ts";

const LOG_MODULE: import("../../lib/logger").LogModuleCode = "KGQ-GH-PROFILE";

export async function fetchUserProfile(
  username: string,
  forceRefresh = false,
): Promise<{ profile: GitHubUserProfile; rateLimit?: RateLimitInfo }> {
  const cleanUser = username.toLowerCase().trim().replace(/^@/, "");
  if (!cleanUser)
    throw new GitHubServiceError("A GitHub username is required.");

  assertValidGithubUsername(cleanUser);

  // Settings are needed both for the cache-TTL and to know whether this
  // request will resolve to mock data — mock entries must be cached under
  // a distinct key (independent of `cleanUser`) so they are never silently
  // overwritten by a later real-API fetch for the same username.
  const settings = await getSettings();
  const useMock = isMockModeActive(settings);
  const cacheKey = useMock ? `mock_user_${cleanUser}` : `user_${cleanUser}`;
  const logLabel = useMock ? `[mock_${cleanUser}]` : `@${cleanUser}`;

  if (!forceRefresh) {
    try {
      const cached = await getCachedData<GitHubUserProfile>(
        cacheKey,
        settings.cacheTtlMinutes,
      );
      if (cached) {
        logger.debug(`Cache lookup for '${logLabel}' returned:`, {
          module: LOG_MODULE,
          data: {
            forceRefreshData: forceRefresh,
            cacheData: cached,
          },
        });
        return { profile: cached };
      }
    } catch (err) {
      logger.warn(`Cache lookup failed for '${logLabel}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    }
  }
  const headers = await githubClient.getAuthHeaders();
  const link = `${GITHUB_API_BASE}/users/${encodeURIComponent(cleanUser)}`;
  const res = await githubClient.fetchWithTimeout(link, headers);
  const rateLimit =
    githubClient.updateRateLimitFromHeaders(res.headers) ?? undefined;

  logger.debug(`Fetched user profile for '${logLabel}'`, {
    module: LOG_MODULE,
    data: {
      linkUsed: link,
      mockMode: settings.mockMode,
      isDevMode: IS_DEV_MODE,
      headersSent: headers,
      responseStatus: res.status,
      responseStatusText: res.statusText,
      rateLimitData: rateLimit,
      responseHeaders: Array.from(res.headers.entries()),
      response: res,
    },
  });

  await githubClient.assertOk(res, cleanUser);
  const raw = await githubClient.parseJson<Record<string, unknown>>(res);

  if (typeof raw.login !== "string") {
    throw new GitHubParseError(
      new Error(
        `Malformed profile payload for '${logLabel}': missing 'login'.`,
      ),
    );
  }

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
    logger.warn(`Failed to cache profile for '${logLabel}'.`, {
      module: LOG_MODULE,
      data: { error: err },
    });
  }

  return { profile, rateLimit };
}

/**
 * Maps raw GitHub REST API response payload to domain `GitHubUserProfile`.
 * Throws GitHubParseError on malformed input rather than a raw runtime error.
 */
export function mapGitHubUserToProfile(res: unknown): GitHubUserProfile {
  assertValidGitHubUserResponse(res);

  return {
    username: res.login,
    name: res.name ?? res.login,
    avatarUrl: res.avatar_url,
    bio: res.bio ?? "",
    publicRepos: res.public_repos,
    followers: res.followers,
    following: res.following,
    htmlUrl: res.html_url,
    ...(typeof res.company === "string" && res.company
      ? { company: res.company }
      : {}),
    ...(typeof res.location === "string" && res.location
      ? { location: res.location }
      : {}),
    ...(typeof res.blog === "string" && res.blog ? { blog: res.blog } : {}),
  };
}
