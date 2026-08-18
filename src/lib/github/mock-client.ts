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

const STATUS_TEXT_MAP: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

interface JsonResponseOptions {
  status?: number;
  statusText?: string;
  url?: string;
  headers?: Record<string, string>;
  trigger?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(
  body: unknown,
  status = 200,
  optionsOrHeaders: Record<string, string> | JsonResponseOptions = {},
): Response {
  const options: JsonResponseOptions =
    "status" in optionsOrHeaders ||
    "headers" in optionsOrHeaders ||
    "trigger" in optionsOrHeaders ||
    "url" in optionsOrHeaders ||
    "statusText" in optionsOrHeaders
      ? (optionsOrHeaders as JsonResponseOptions)
      : { headers: optionsOrHeaders as Record<string, string>, status };

  const effectiveStatus = options.status ?? status;
  const effectiveStatusText =
    options.statusText ?? STATUS_TEXT_MAP[effectiveStatus] ?? "";
  const customHeaders = options.headers ?? {};

  const mockHeaders: Record<string, string> = {
    "content-type": "application/json",
    // Core mock indicators
    "x-mock-response": "true",
    "x-mocked-by": "mock-client-service",
    "x-mock-latency-ms": String(ARTIFICIAL_LATENCY_MS),
    "x-mock-timestamp": new Date().toISOString(),
    // Standard W3C Server-Timing for browser DevTools visibility
    "server-timing": `mock;desc="In-Memory Mock", latency;dur=${ARTIFICIAL_LATENCY_MS}`,
  };

  if (options.trigger) {
    mockHeaders["x-mock-trigger"] = options.trigger;
  }

  const response = new Response(JSON.stringify(body), {
    status: effectiveStatus,
    statusText: effectiveStatusText,
    headers: {
      ...mockHeaders,
      ...customHeaders, // Allows GitHub rate-limit headers to merge or override
    },
  });

  // WHATWG Response constructor defaults url to "".
  // Define property directly on instance to mirror real fetch behavior.
  if (options.url) {
    Object.defineProperty(response, "url", {
      value: options.url,
      writable: false,
      enumerable: true,
      configurable: true,
    });
  }

  return response;
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
  url?: string,
): Response | null {
  if (!trigger) return null;

  if (trigger === "not_found") {
    return jsonResponse({ message: "Not Found" }, 404, {
      trigger: "mock404",
      url,
    });
  }

  if (trigger === "rate_limit") {
    return jsonResponse(
      { message: "API rate limit exceeded for this IP." },
      403,
      {
        trigger: "mockratelimit",
        url,
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3_600),
        },
      },
    );
  }

  if (trigger === "secondary_rate_limit") {
    return jsonResponse(
      { message: "You have exceeded a secondary rate limit." },
      403,
      {
        trigger: "mockabuse",
        url,
        headers: { "retry-after": "30" },
      },
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

async function handleUserProfile(
  username: string,
  url: URL,
): Promise<Response> {
  const triggered = triggerResponse(
    MOCK_TRIGGERS[username.toLowerCase()],
    url.toString(),
  );
  if (triggered) return triggered;

  const archetype = username.length % 2 === 0 ? "individual" : "org";
  const raw = generateGitHubUserResponse({
    archetype,
    overrides: { login: username },
  });
  return jsonResponse(raw, 200, {
    url: url.toString(),
    headers: successHeaders(),
  });
}

async function handleUserRepos(
  username: string,
  limit: number,
  url: URL,
): Promise<Response> {
  const triggered = triggerResponse(
    MOCK_TRIGGERS[username.toLowerCase()],
    url.toString(),
  );
  if (triggered) return triggered;

  const raw = generateGitHubReposResponse(limit, { owner: username });
  return jsonResponse(raw, 200, {
    url: url.toString(),
    headers: successHeaders(),
  });
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
      return handleUserRepos(username, limit, url);
    },
  },
  {
    pattern: /\/users\/([^/?]+)\/?$/,
    handle: (match, url) =>
      handleUserProfile(decodeURIComponent(match[1]), url),
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
