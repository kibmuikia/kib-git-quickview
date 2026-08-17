// file: src/lib/github/error.ts

/* Typed errors
- Every failure mode a caller might want to branch on (show a "not found" state vs. a "rate limited, retry at X" banner vs. a generic error toast)
    gets its own class instead of forcing callers to regex-match `.message`.
    All extend GitHubServiceError -> Error, so existing `catch (e) { e.message }`
    call sites keep working unchanged.
 */

export class GitHubServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "GitHubServiceError";
  }
}

export class GitHubNotFoundError extends GitHubServiceError {
  constructor(username: string) {
    super(`GitHub user '@${username}' not found.`, 404);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubAuthError extends GitHubServiceError {
  constructor(
    message = "GitHub authentication failed. Check your Personal Access Token in Options.",
  ) {
    super(message, 401);
    this.name = "GitHubAuthError";
  }
}

export class GitHubRateLimitError extends GitHubServiceError {
  constructor(
    message: string,
    public readonly resetTime?: number,
    public readonly isSecondaryLimit = false,
  ) {
    super(message, 403);
    this.name = "GitHubRateLimitError";
  }
}

export class GitHubNetworkError extends GitHubServiceError {
  constructor(cause: unknown) {
    super(
      "Could not reach GitHub. Check your internet connection.",
      undefined,
      { cause },
    );
    this.name = "GitHubNetworkError";
  }
}

export class GitHubTimeoutError extends GitHubServiceError {
  constructor(timeoutMs: number) {
    super(`GitHub request timed out after ${timeoutMs}ms.`);
    this.name = "GitHubTimeoutError";
  }
}

export class GitHubParseError extends GitHubServiceError {
  constructor(cause: unknown) {
    super("Received an unexpected response from GitHub.", undefined, { cause });
    this.name = "GitHubParseError";
  }
}

export class GitHubApiError extends GitHubServiceError {
  constructor(status: number, cause?: unknown) {
    super(`GitHub API request failed with status ${status}.`, status, {
      cause,
    });
    this.name = "GitHubApiError";
  }
}

export class AbortMockModeActionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AbortMockModeActionError";
  }
}
