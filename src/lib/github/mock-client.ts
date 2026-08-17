// file: src/lib/github/mock-client.ts
// Mock data source for GitHubClient — used when settings.mockMode is enabled.
// Single wiring point: GitHubClient.fetchWithTimeout() calls mockFetch(url)
// instead of the real fetch. Everything downstream (assertOk, parseJson,
// raw→domain mapping in profile.ts/repos.ts/etc.) runs unchanged, so mock
// and real paths stay behaviorally identical. Route by URL pattern so new
// endpoints (languages, events, ...) plug in without touching callers.

import { generateGitHubUserResponse } from "./__fixtures__/generate-user.ts";
import { generateGitHubReposResponse } from "./__fixtures__/generate-repos.ts";

const ARTIFICIAL_LATENCY_MS = 400; // keeps loading states visibly testable

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/**
 * Special-cased usernames that trigger a specific mock outcome, so error
 * states are reachable on demand without waiting for a real rate limit.
 * Mirrors the octocat special-case already in PopupController's fallback.
 * Shared across all endpoint handlers below.
 */
const MOCK_TRIGGERS: Record<
  string,
  "not_found" | "rate_limit" | "secondary_rate_limit"
> = {
  mock404: "not_found",
  mockratelimit: "rate_limit",
  mockabuse: "secondary_rate_limit",
};

function triggerResponse(
  trigger: (typeof MOCK_TRIGGERS)[string] | undefined,
): Response | null {
  if (trigger === "not_found") {
    return jsonResponse({ message: "Not Found" }, 404);
  }
  if (trigger === "rate_limit") {
    return jsonResponse(
      { message: "API rate limit exceeded for this IP." },
      403,
      {
        "x-ratelimit-limit": "60",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3_600),
      },
    );
  }
  if (trigger === "secondary_rate_limit") {
    return jsonResponse(
      { message: "You have exceeded a secondary rate limit." },
      403,
      { "retry-after": "30" },
    );
  }
  return null;
}

const successHeaders = () => ({
  "x-ratelimit-limit": "60",
  "x-ratelimit-remaining": "59",
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3_600),
});

// --- Per-endpoint handlers ---------------------------------------------

async function handleUserProfile(username: string): Promise<Response> {
  const triggered = triggerResponse(MOCK_TRIGGERS[username.toLowerCase()]);
  if (triggered) return triggered;

  const archetype = username.length % 2 === 0 ? "individual" : "org";
  const raw = generateGitHubUserResponse({
    archetype,
    overrides: { login: username },
  });
  return jsonResponse(raw, 200, successHeaders());
}

async function handleUserRepos(
  username: string,
  limit: number,
): Promise<Response> {
  const triggered = triggerResponse(MOCK_TRIGGERS[username.toLowerCase()]);
  if (triggered) return triggered;

  const raw = generateGitHubReposResponse(limit, { owner: username });
  return jsonResponse(raw, 200, successHeaders());
}

// --- Route table ---------------------------------------------------------
// Order matters: more specific patterns must precede more general ones
// (e.g. "/users/{u}/repos" before the bare "/users/{u}" pattern, which
// would otherwise also match the repos path's prefix).

interface Route {
  pattern: RegExp;
  handle: (match: RegExpMatchArray, url: URL) => Promise<Response>;
}

const ROUTES: Route[] = [
  {
    pattern: /\/users\/([^/?]+)\/repos\/?$/,
    handle: (match, url) => {
      const username = decodeURIComponent(match[1]);
      const limit = Number(url.searchParams.get("per_page")) || 5;
      return handleUserRepos(username, limit);
    },
  },
  {
    pattern: /\/users\/([^/?]+)\/?$/,
    handle: (match) => handleUserProfile(decodeURIComponent(match[1])),
  },
  // Add future endpoints here, e.g.:
  // { pattern: /\/repos\/([^/]+)\/([^/]+)\/languages\/?$/, handle: handleRepoLanguages },
  // { pattern: /\/users\/([^/?]+)\/events\/public\/?$/, handle: handleUserEvents },
];

/**
 * Routes a request URL to the matching mock handler. Throws (loudly, in
 * dev-only mock mode) if no route matches, so a missing mock is caught
 * immediately instead of silently returning wrong or empty data.
 */
export async function mockFetch(url: string): Promise<Response> {
  await delay(ARTIFICIAL_LATENCY_MS);

  const parsed = new URL(url);
  for (const route of ROUTES) {
    const match = parsed.pathname.match(route.pattern);
    if (match) return route.handle(match, parsed);
  }

  throw new Error(
    `[mock-client] No mock route registered for '${parsed.pathname}'. ` +
      `Add a handler in mock-client.ts or disable mockMode.`,
  );
}
