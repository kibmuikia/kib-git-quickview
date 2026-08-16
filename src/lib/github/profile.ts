// file: src/lib/github/profile.ts
import { githubClient } from "./client.ts";
import { getSettings } from "../../lib/storage/settings.ts";
import { getCachedData, setCachedData } from "../../lib/cache/cache.ts";
import { logger } from "../logger.ts";
import {
  GITHUB_API_BASE,
  GitHubParseError,
  GitHubServiceError,
  assertValidGithubUsername,
} from "./types.ts";
import type { GitHubUserProfile, RateLimitInfo } from "../../types/messages.ts";

const LOG_MODULE: import("../../lib/logger").LogModuleCode = "KGQ-GH-PROFILE";

export async function fetchUserProfile(
  username: string,
  forceRefresh = false,
): Promise<{ profile: GitHubUserProfile; rateLimit?: RateLimitInfo }> {
  const cleanUser = username.toLowerCase().trim().replace(/^@/, "");
  if (!cleanUser)
    throw new GitHubServiceError("A GitHub username is required.");

  assertValidGithubUsername(cleanUser);

  const cacheKey = `user_${cleanUser}`;

  if (!forceRefresh) {
    try {
      const settings = await getSettings();
      const cached = await getCachedData<GitHubUserProfile>(
        cacheKey,
        settings.cacheTtlMinutes,
      );
      logger.debug(`Cache lookup for '@${cleanUser}' returned:`, {
        module: LOG_MODULE,
        data: { cached },
      });
      if (cached) return { profile: cached };
    } catch (err) {
      logger.warn(`Cache lookup failed for '@${cleanUser}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    }
  }

  const headers = await githubClient.getAuthHeaders();
  const res = await githubClient.fetchWithTimeout(
    `${GITHUB_API_BASE}/users/${encodeURIComponent(cleanUser)}`,
    headers,
  );
  logger.debug(`Fetched user profile for '@${cleanUser}'`, {
    module: LOG_MODULE,
    data: {
      headersSent: headers,
      resStatus: res.status,
      resStatusText: res.statusText,
      resHeaders: Array.from(res.headers.entries()),
      response: res,
    },
  });
  const rateLimit =
    githubClient.updateRateLimitFromHeaders(res.headers) ?? undefined;

  await githubClient.assertOk(res, cleanUser);
  const raw = await githubClient.parseJson<Record<string, unknown>>(res);

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
