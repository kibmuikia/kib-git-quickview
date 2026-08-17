// file: src/lib/github/utils.ts

import { GitHubUserResponse } from "./types.ts";
import { GitHubParseError } from "./error.ts";

/**
 * Validates the shape of a raw GitHub user response before mapping.
 * Throws GitHubParseError (not a raw TypeError) so callers can branch
 * on the typed error hierarchy, consistent with client.ts's assertOk().
 */
export function assertValidGitHubUserResponse(
  res: unknown,
): asserts res is GitHubUserResponse {
  if (!res || typeof res !== "object") {
    throw new GitHubParseError("GitHub user response was not an object");
  }

  const candidate = res as Partial<GitHubUserResponse>;

  if (typeof candidate.login !== "string" || candidate.login.length === 0) {
    throw new GitHubParseError("GitHub user response missing 'login'");
  }
  if (typeof candidate.avatar_url !== "string") {
    throw new GitHubParseError("GitHub user response missing 'avatar_url'");
  }
  if (typeof candidate.html_url !== "string") {
    throw new GitHubParseError("GitHub user response missing 'html_url'");
  }

  // Numeric fields: GitHub always sends these for a valid /users/{username}
  // payload, but guard anyway — a parse-layer bug upstream (e.g. empty-body
  // handling in parseJson()) could hand us `undefined` here.
  for (const field of ["public_repos", "followers", "following"] as const) {
    if (typeof candidate[field] !== "number") {
      throw new GitHubParseError(
        `GitHub user response field '${field}' is not a number`,
      );
    }
  }
}
