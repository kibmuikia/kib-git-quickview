/// <reference types="chrome" />

import type {
  GitHubUserProfile,
  GitHubRepository,
  RateLimitInfo,
} from '../types/messages.ts';
import {
  getSettings,
  saveRateLimit,
  getCachedData,
  setCachedData,
} from './storage.ts';

const GITHUB_API_BASE = 'https://api.github.com';

export class GitHubService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const settings = await getSettings();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (settings.pat?.trim()) {
      headers.Authorization = `Bearer ${settings.pat.trim()}`;
    }

    return headers;
  }

  private updateRateLimitFromHeaders(headers: Headers): RateLimitInfo | null {
    const limit = headers.get('x-ratelimit-limit');
    const remaining = headers.get('x-ratelimit-remaining');
    const reset = headers.get('x-ratelimit-reset');

    if (limit && remaining && reset) {
      const rateLimitInfo: RateLimitInfo = {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        resetTime: parseInt(reset, 10),
      };
      saveRateLimit(rateLimitInfo).catch(() => {});
      return rateLimitInfo;
    }

    return null;
  }

  public async fetchUserProfile(
    username: string,
    forceRefresh = false
  ): Promise<{ profile: GitHubUserProfile; rateLimit?: RateLimitInfo }> {
    const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
    const cacheKey = `user_${cleanUser}`;
    const settings = await getSettings();

    if (!forceRefresh) {
      const cached = await getCachedData<GitHubUserProfile>(
        cacheKey,
        settings.cacheTtlMinutes
      );
      if (cached) {
        return { profile: cached };
      }
    }

    const headers = await this.getAuthHeaders();
    const res = await fetch(`${GITHUB_API_BASE}/users/${cleanUser}`, { headers });

    const rateLimit = this.updateRateLimitFromHeaders(res.headers) || undefined;

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`GitHub user '@${cleanUser}' not found.`);
      }
      if (res.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Configure a Personal Access Token in Options.');
      }
      throw new Error(`GitHub API request failed with status ${res.status}`);
    }

    const raw = await res.json();
    const profile: GitHubUserProfile = {
      username: raw.login,
      name: raw.name || raw.login,
      avatarUrl: raw.avatar_url,
      bio: raw.bio || 'No public bio provided.',
      publicRepos: raw.public_repos || 0,
      followers: raw.followers || 0,
      following: raw.following || 0,
      company: raw.company || undefined,
      location: raw.location || undefined,
      blog: raw.blog || undefined,
      htmlUrl: raw.html_url,
    };

    await setCachedData(cacheKey, profile);
    return { profile, rateLimit };
  }

  public async fetchUserRepos(
    username: string,
    limit = 5,
    forceRefresh = false
  ): Promise<{ repos: GitHubRepository[]; rateLimit?: RateLimitInfo }> {
    const cleanUser = username.toLowerCase().trim().replace(/^@/, '');
    const cacheKey = `repos_${cleanUser}_limit_${limit}`;
    const settings = await getSettings();

    if (!forceRefresh) {
      const cached = await getCachedData<GitHubRepository[]>(
        cacheKey,
        settings.cacheTtlMinutes
      );
      if (cached) {
        return { repos: cached };
      }
    }

    const headers = await this.getAuthHeaders();
    const url = `${GITHUB_API_BASE}/users/${cleanUser}/repos?sort=updated&per_page=${limit}`;
    const res = await fetch(url, { headers });

    const rateLimit = this.updateRateLimitFromHeaders(res.headers) || undefined;

    if (!res.ok) {
      throw new Error(`Failed to fetch repos for '@${cleanUser}' (${res.status})`);
    }

    const rawList = await res.json();
    const repos: GitHubRepository[] = (Array.isArray(rawList) ? rawList : []).map((raw) => ({
      id: raw.id,
      name: raw.name,
      fullName: raw.full_name,
      description: raw.description,
      htmlUrl: raw.html_url,
      stargazersCount: raw.stargazers_count || 0,
      forksCount: raw.forks_count || 0,
      language: raw.language || 'Plain Text',
      updatedAt: raw.updated_at,
    }));

    await setCachedData(cacheKey, repos);
    return { repos, rateLimit };
  }
}

export const githubService = new GitHubService();
