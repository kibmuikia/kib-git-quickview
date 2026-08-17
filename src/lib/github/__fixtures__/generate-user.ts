// file: src/lib/github/__fixtures__/generate-user.ts
// Dev/test-only generator for realistic GitHubUserResponse payloads.

import type { GitHubUserResponse } from "../types.ts";

type UserArchetype = "individual" | "org" | "bot";

interface ArchetypePool {
  logins: string[];
  names: (string | null)[];
  companies: (string | null)[];
  blogs: (string | null)[];
  locations: (string | null)[];
  bios: (string | null)[];
  type: "User" | "Organization" | "Bot";
}

// Seeded from real, well-known GitHub accounts for realistic distribution —
// not live data, just shape/value references.
const POOLS: Record<UserArchetype, ArchetypePool> = {
  individual: {
    logins: [
      "torvalds",
      "gaearon",
      "sindresorhus",
      "yyx990803",
      "tj",
      "addyosmani",
    ],
    names: ["Linus Torvalds", "Dan Abramov", "Sindre Sorhus", "Evan You", null, null],
    companies: [
      "Linux Foundation",
      null,
      "@sindresorhus",
      "@voidzero-dev",
      null,
      null,
    ],
    blogs: [
      "",
      "https://overreacted.io",
      "https://sindresorhus.com",
      "https://evanyou.me",
      null,
      null,
    ],
    locations: ["Portland, OR", "London, UK", null, "Singapore", null, null],
    bios: [
      "Creator of Linux and Git",
      null,
      "Full-time open source",
      "Creator of Vue.js",
      null,
      null,
    ],
    type: "User",
  },
  org: {
    logins: ["android", "facebook", "microsoft", "vercel", "openai"],
    names: ["Android", "Meta", "Microsoft", "Vercel", "OpenAI"],
    companies: [null, null, null, null, null],
    blogs: [
      "https://d.android.com",
      "https://opensource.fb.com",
      "https://opensource.microsoft.com",
      "https://vercel.com",
      "https://openai.com",
    ],
    locations: [
      null,
      "Menlo Park, CA",
      "Redmond, WA",
      null,
      "San Francisco, CA",
    ],
    bios: [null, null, null, null, null],
    type: "Organization",
  },
  bot: {
    logins: ["dependabot", "github-actions", "renovate-bot"],
    names: ["dependabot[bot]", "github-actions[bot]", "Renovate Bot"],
    companies: [null, null, null],
    blogs: [null, null, "https://renovatebot.com"],
    locations: [null, null, null],
    bios: [null, null, null],
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

  const idx = randomInt(0, pool.logins.length - 1);
  const login = pool.logins[idx];
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
    name: pool.names[idx % pool.names.length],
    company: pool.companies[idx % pool.companies.length],
    blog: pool.blogs[idx % pool.blogs.length],
    location: pool.locations[idx % pool.locations.length],
    email: null,
    hireable: archetype === "individual" ? pick([true, false, null]) : null,
    bio: pool.bios[idx % pool.bios.length],
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
