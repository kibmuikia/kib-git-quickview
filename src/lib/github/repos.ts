// file: src/lib/github/repos.ts
import { githubClient } from "./client.ts";
import { getSettings } from "../../lib/storage/settings.ts";
import { getCachedData, setCachedData } from "../../lib/cache/cache.ts";
import { logger } from "../logger.ts";
import { IS_DEV_MODE } from "../constants.ts";
import {
  GITHUB_API_BASE,
  GitHubParseError,
  GitHubServiceError,
  assertValidGithubUsername,
  GitHubRepository,
} from "./types.ts";
import type { RateLimitInfo } from "../../types/messages.ts";

const LOG_MODULE: import("../../lib/logger").LogModuleCode = "KGQ-GH-REPOS";

export async function fetchUserRepos(
  username: string,
  limit: number = 5,
  forceRefresh = false,
): Promise<{ repos: GitHubRepository[]; rateLimit?: RateLimitInfo }> {
  const cleanUser = username.toLowerCase().trim().replace(/^@/, "");
  if (!cleanUser)
    throw new GitHubServiceError("A GitHub username is required.");

  assertValidGithubUsername(cleanUser);

  // Mock-mode entries must be cached under a key that does not depend on
  // `cleanUser`; otherwise a real-API fetch for the same username will
  // silently overwrite the mock payload (or vice versa) in chrome.storage.
  const settings = await getSettings();
  const useMock = settings.mockMode && IS_DEV_MODE;
  const cacheKey = useMock ? `mock_repos_limit_${limit}` : `repos_${cleanUser}_limit_${limit}`;

  if (!forceRefresh) {
    try {
      const cached = await getCachedData<GitHubRepository[]>(
        cacheKey,
        settings.cacheTtlMinutes,
      );
      if (cached) return { repos: cached };
    } catch (err) {
      logger.warn(`Cache lookup failed for repos of '@${cleanUser}'.`, {
        module: LOG_MODULE,
        data: { error: err },
      });
    }
  }

  const headers = await githubClient.getAuthHeaders();
  const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(cleanUser)}/repos?sort=updated&per_page=${limit}`;
  const res = await githubClient.fetchWithTimeout(url, headers);

  const rateLimit =
    githubClient.updateRateLimitFromHeaders(res.headers) ?? undefined;

  await githubClient.assertOk(res, cleanUser);
  const rawList = await githubClient.parseJson<unknown>(res);

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
