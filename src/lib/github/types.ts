// file: src/lib/github/types.ts
// TypeScript interfaces and type definitions matching raw GitHub REST API v3 JSON response shapes

import { GitHubServiceError } from "./error.ts";

export const GITHUB_API_BASE = "https://api.github.com";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const GITHUB_USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const MOCK_USERS = [
  "mockuser",
  "mock404",
  "mockratelimit",
  "mockabuse",
] as const;

export type MockUser = (typeof MOCK_USERS)[number];

export function isMockUser(val: unknown): val is MockUser {
  return (
    typeof val === "string" && (MOCK_USERS as readonly string[]).includes(val)
  );
}

/* Domain types — plain data shapes */

export interface GitHubUserProfile {
  username: string;
  name: string;
  avatarUrl: string;
  bio: string;
  publicRepos: number;
  followers: number;
  following: number;
  company?: string;
  location?: string;
  blog?: string;
  htmlUrl: string;
} // Domain model used throughout UI components and background handlers.

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stargazersCount: number;
  forksCount: number;
  language: string | null;
  updatedAt: string;
}

// Raw REST API response shape for GET /users/{username}
export interface GitHubUserResponse {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  user_view_type?: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/* --- Assert valid Github username */
export function assertValidGithubUsername(username: string): void {
  if (username.length < 1) {
    throw new GitHubServiceError("A GitHub username is required.");
  }
  if (!GITHUB_USERNAME_RE.test(username)) {
    throw new GitHubServiceError(
      `'${username}' is not a valid GitHub username. ` +
        `Usernames must be 1–39 characters, contain only alphanumeric characters ` +
        `or single internal hyphens, and cannot start or end with a hyphen.`,
    );
  }
}
