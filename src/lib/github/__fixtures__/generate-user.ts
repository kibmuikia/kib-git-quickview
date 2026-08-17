// file: src/lib/github/__fixtures__/generate-user.ts
// Dev/test-only generator for realistic GitHubUserResponse payloads.

import type { GitHubUserResponse } from "../types.ts";

type UserArchetype = "individual" | "org" | "bot";

interface UserProfile {
  login: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  bio: string | null;
}

interface ArchetypePool {
  profiles: UserProfile[];
  type: "User" | "Organization" | "Bot";
}

// Seeded from real, well-known GitHub accounts for realistic distribution —
// not live data, just shape/value references.
const POOLS: Record<UserArchetype, ArchetypePool> = {
  individual: {
    profiles: [
      {
        login: "torvalds",
        name: "Linus Torvalds",
        company: "Linux Foundation",
        blog: "",
        location: "Portland, OR",
        bio: "Creator of Linux and Git",
      },
      {
        login: "gaearon",
        name: "Dan Abramov",
        company: null,
        blog: "https://overreacted.io",
        location: "London, UK",
        bio: null,
      },
      {
        login: "sindresorhus",
        name: "Sindre Sorhus",
        company: "@sindresorhus",
        blog: "https://sindresorhus.com",
        location: null,
        bio: "Full-time open source",
      },
      {
        login: "yyx990803",
        name: "Evan You",
        company: "@voidzero-dev",
        blog: "https://evanyou.me",
        location: "Singapore",
        bio: "Creator of Vue.js",
      },
      {
        login: "tj",
        name: null,
        company: null,
        blog: null,
        location: null,
        bio: null,
      },
      {
        login: "addyosmani",
        name: null,
        company: null,
        blog: null,
        location: null,
        bio: null,
      },
    ],
    type: "User",
  },
  org: {
    profiles: [
      {
        login: "android",
        name: "Android",
        company: null,
        blog: "https://d.android.com",
        location: null,
        bio: null,
      },
      {
        login: "facebook",
        name: "Meta",
        company: null,
        blog: "https://opensource.fb.com",
        location: "Menlo Park, CA",
        bio: null,
      },
      {
        login: "microsoft",
        name: "Microsoft",
        company: null,
        blog: "https://opensource.microsoft.com",
        location: "Redmond, WA",
        bio: null,
      },
      {
        login: "vercel",
        name: "Vercel",
        company: null,
        blog: "https://vercel.com",
        location: null,
        bio: null,
      },
      {
        login: "openai",
        name: "OpenAI",
        company: null,
        blog: "https://openai.com",
        location: "San Francisco, CA",
        bio: null,
      },
    ],
    type: "Organization",
  },
  bot: {
    profiles: [
      {
        login: "dependabot",
        name: "dependabot[bot]",
        company: null,
        blog: null,
        location: null,
        bio: null,
      },
      {
        login: "github-actions",
        name: "github-actions[bot]",
        company: null,
        blog: null,
        location: null,
        bio: null,
      },
      {
        login: "renovate-bot",
        name: "Renovate Bot",
        company: null,
        blog: "https://renovatebot.com",
        location: null,
        bio: null,
      },
    ],
    type: "Bot",
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPastDate(minYearsAgo: number, maxYearsAgo: number): string {
  const now = Date.now();
  const msPerYear = 365 * 24 * 60 * 60 * 1000;
  const offset = randomInt(minYearsAgo * msPerYear, maxYearsAgo * msPerYear);
  return new Date(now - offset).toISOString().replace(/\.\d+Z$/, "Z");
}

export interface GenerateUserOptions {
  archetype?: UserArchetype;
  overrides?: Partial<GitHubUserResponse>;
}

/**
 * Generates a realistic, internally-consistent GitHubUserResponse for tests
 * and Storybook-style fixtures. Pass `overrides` to pin specific fields
 * (e.g. { login: "octocat" }) while keeping the rest randomized.
 */
export function generateGitHubUserResponse(
  options: GenerateUserOptions = {},
): GitHubUserResponse {
  const archetype =
    options.archetype ?? pick(["individual", "org", "bot"] as UserArchetype[]);
  const pool = POOLS[archetype];

  const profile = pick(pool.profiles);
  const { login } = profile;
  const id = randomInt(100_000, 90_000_000);
  const createdAt = randomPastDate(1, 15);

  const base: GitHubUserResponse = {
    login,
    id,
    node_id: `MDEyOk${Buffer.from(`${archetype}${id}`).toString("base64").slice(0, 18)}`,
    avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
    gravatar_id: "",
    url: `https://api.github.com/users/${login}`,
    html_url: `https://github.com/${login}`,
    followers_url: `https://api.github.com/users/${login}/followers`,
    following_url: `https://api.github.com/users/${login}/following{/other_user}`,
    gists_url: `https://api.github.com/users/${login}/gists{/gist_id}`,
    starred_url: `https://api.github.com/users/${login}/starred{/owner}{/repo}`,
    subscriptions_url: `https://api.github.com/users/${login}/subscriptions`,
    organizations_url: `https://api.github.com/users/${login}/orgs`,
    repos_url: `https://api.github.com/users/${login}/repos`,
    events_url: `https://api.github.com/users/${login}/events{/privacy}`,
    received_events_url: `https://api.github.com/users/${login}/received_events`,
    type: pool.type === "Bot" ? "Bot" : pool.type,
    user_view_type: "public",
    site_admin: false,
    name: profile.name,
    company: profile.company,
    blog: profile.blog,
    location: profile.location,
    email: null,
    hireable: archetype === "individual" ? pick([true, false, null]) : null,
    bio: profile.bio,
    twitter_username: archetype === "individual" ? pick([null, login]) : null,
    public_repos: archetype === "org" ? randomInt(20, 300) : randomInt(0, 400),
    public_gists: randomInt(0, 50),
    followers:
      archetype === "org" ? randomInt(500, 30_000) : randomInt(0, 20_000),
    following: archetype === "bot" ? 0 : randomInt(0, 500),
    created_at: createdAt,
    updated_at: randomPastDate(0, 1),
  };

  return { ...base, ...options.overrides };
}

/** Convenience: generate an array of N distinct users. */
export function generateGitHubUserResponses(
  count: number,
  options: Omit<GenerateUserOptions, "overrides"> = {},
): GitHubUserResponse[] {
  return Array.from({ length: count }, () =>
    generateGitHubUserResponse(options),
  );
}
