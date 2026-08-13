# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 2.0.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.2] - 2026-08-13

Project is pre-release and unpublished; no tags have been cut yet, so this
section is provisional and keyed to the version bump commit rather than a
GitHub release.

### Added
- Domain-specific GitHub API error hierarchy in `src/lib/github/types.ts`:
  a `GitHubServiceError` base class plus `GitHubNotFoundError`,
  `GitHubAuthError`, `GitHubRateLimitError`, `GitHubNetworkError`,
  `GitHubTimeoutError`, `GitHubParseError`, and `GitHubApiError` for
  targeted client-side branching.
- Request timeout handling via `fetchWithTimeout()`, using `AbortController`
  to convert DOM/network aborts into typed network or timeout errors
  (default 10s, via `DEFAULT_TIMEOUT_MS`).
- Structured logging via a central `logger` utility, wired into background
  message handlers and the popup runtime, with debug/error logs for
  `FETCH_USER_PROFILE`, `FETCH_USER_REPOS`, rate-limiting, and settings
  persistence.
- `IS_DEV_MODE` flag exported from `src/lib/constants.ts`.
- `CHANGELOG.md`.

### Changed
- Hardened `github-service.ts`: `parseJson()` now gracefully handles empty
  bodies (204/304) and non-JSON error pages; `assertOk()` centralizes status
  handling for 401/403/404, rate-limit header extraction
  (`x-ratelimit-reset`, `retry-after`), and secondary rate-limit (abuse)
  detection.
- Wrapped settings and cache reads/writes in non-blocking try-catch blocks so
  local storage failures no longer break network requests.
- Updated `public/options.html` branding to "Kib Git Quickview".
- Updated `README.md` and the `package.json` description with current
  project data.
- Bumped version to `0.0.2`.

## [0.0.1]

### Added
- Manifest V3 schema and permissions configuration for the Chrome extension.
- Multi-entry Vite build pipeline (`vite.config.ts`) for bundling popup, options,
  and background contexts.
- `@crxjs/vite-plugin` integration with a typed `src/manifest.config.ts`.
- Popup dashboard UI (v1): theme engine, state switcher, search-first flow with
  four distinct state cards.
- Options page UI (v1).
- Background service worker with a GitHub API service and message router.
- Typed messaging layer: `sendExtensionMessage`, `MessageResponseMap`, and
  discriminated-union message types.
- Design token generation pipeline: `scripts/generate-tokens.mjs` run as a
  `prebuild` step, emitting `src/styles/tokens.generated.css`.
- Shared component stylesheet (`src/styles/components.css`) covering buttons,
  cards, toasts, and progress indicators, including `.hidden` / `.is-hidden`
  utilities.
- Progressive logo rendering: inline SVG renders instantly as a placeholder,
  then swaps to PNG via a shared `setLogo()` utility once loaded.
- Logo assets: initial design, SVG variant, and universal PNG
  (`kib-git-quickview-logo-universal-1254_1254.png`).
- Refreshed icon set (16 / 32 / 48 / 128 px).
- `@types/chrome` and `@types/node` with corresponding ambient type references.

### Changed
- Deprecated `public/manifest.json` in favor of the typed
  `src/manifest.config.ts`, consumed by `@crxjs/vite-plugin`.
- Redesigned the popup from its initial layout to a search-first flow built
  around four state cards.
- Migrated popup and options styling onto generated design tokens; unified
  theme variable naming (`--bg-*` → `--background-*`,
  `--accent-primary` → `--interactive-primary`) and removed ~400 lines of
  duplicated CSS custom properties and component rules.
- Split `tsconfig` into separate configs for `src` and the project root.
- Pinned TypeScript to `~6.0.3` after testing pnpm overrides against a
  TypeScript ≥7.1 compatibility gap in `typescript-eslint`
  ([typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)).
- `options.ts` now calls `sendExtensionMessage` instead of the earlier
  `sendMessage`.

### Fixed
- TypeScript strict-mode violations and unused class members in the popup.
- Vite native config-loader warnings: added an explicit file extension to the
  `manifest.config` import and `with { type: 'json' }` to the `package.json`
  import.
- Removed a redundant stylesheet `<link>` in `options.html` now that styles
  are imported directly in the TypeScript entrypoint.

### Removed
- `public/manifest.json` (superseded by `src/manifest.config.ts`).

[Unreleased]: https://github.com/kibmuikia/kib-git-quickview/compare/570adc5...HEAD
[0.0.2]: https://github.com/kibmuikia/kib-git-quickview/compare/653bcea...570adc5
[0.0.1]: https://github.com/kibmuikia/kib-git-quickview/commits/653bcea