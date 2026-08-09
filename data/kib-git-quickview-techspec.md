# kib-git-quickview — Technical Specification

**Version:** 1.0.0 | **Author:** kibmuikia | **Status:** Draft
**Repo:** `github.com/kibmuikia/kib-git-quickview`

## 1. One-liner

A Chrome extension that turns any GitHub username into a compact developer dashboard — repo count, latest repos, public activity, top languages — in one click, without leaving the current page.

## 2. Goals / Non-Goals

**Goals**
- Read-only public GitHub stats, zero backend, zero mandatory auth
- Fast (cached), respectful of GitHub's rate limits, MV3-compliant
- Optional PAT to unlock 5,000 req/hr instead of 60 req/hr

**Non-Goals (v1)**
- No writes to GitHub (no stars, follows, issues)
- No private repo data
- No org-level analytics
- No git CLI usage — Git is local-only and cannot see cloud user stats (see §7)

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict mode) | Type-safe GitHub API responses, catch schema drift at compile time |
| Bundler | **Vite** (`@crxjs/vite-plugin` or `vite-plugin-web-extension`) | Native MV3 support, fast HMR for popup dev |
| Package manager | **pnpm** | Fast, disk-efficient, workspace-ready if extension grows a shared-types package |
| Extension platform | **Chrome Manifest V3** | Required for Chrome Web Store submission |
| UI | Vanilla TS + CSS first; escalate to **Preact** only if the dashboard grows past 3–4 views | Keep bundle small; Preact chosen over React for footprint if needed |
| Storage | `chrome.storage.local` | PAT, cache entries, ETags |
| HTTP | Native `fetch()` in service worker | No need for axios; GitHub REST is simple enough |

## 4. Architecture

```
popup/            → Dashboard UI (renders on click)
background/       → Service worker: GitHub client, cache, rate-limit gate
lib/github/
  client.ts        → fetch wrapper, auth header injection, ETag handling
  profile.ts        → GET /users/{username}
  repos.ts           → GET /users/{username}/repos
  events.ts          → GET /users/{username}/events/public
  languages.ts       → GET /repos/{owner}/{repo}/languages (aggregated)
  types.ts            → Typed API response shapes
lib/cache/
  cache.ts             → TTL + ETag-aware cache over chrome.storage.local
lib/analytics/
  stats.ts               → Derived metrics: language %, stars/repo, activity score
options/                → Settings page: PAT input, cache clear
manifest.config.ts        → MV3 manifest (generated via vite plugin)
```

Popup → message → service worker → GitHub API → cache → response → render.
Popup never calls `fetch()` directly; all network calls are centralized in the service worker so caching and rate-limit logic live in one place.

## 5. GitHub API Surface (verified current, Aug 2026)

| Feature | Endpoint | Auth | Notes |
|---|---|---|---|
| Repo count | `GET /users/{username}` | optional | `public_repos` field, zero extra calls |
| Latest repos | `GET /users/{username}/repos?sort=created&direction=desc&per_page=5` | optional | use `sort=updated` for recent pushes |
| Public activity | `GET /users/{username}/events/public?per_page=10` | optional | max 300 events returned, not real-time |
| Languages | `GET /repos/{owner}/{repo}/languages` per repo | optional | **no user-level endpoint exists** — fetch all repos, call per repo, aggregate bytes → %; this is the N+1 hotspot |
| Rate budget | `GET /rate_limit` | optional | free call, drives a budget indicator in the UI |

**Rate limits (current, per GitHub Docs):**
- Unauthenticated: **60 req/hr**, tied to IP
- Authenticated (PAT): **5,000 req/hr**, tied to token
- `304 Not Modified` via `If-None-Match` ETag: **free**, doesn't count against budget

## 6. Auth / Token Handling

- **No token bundled with the extension, ever** (would leak via public repo/store bundle)
- User optionally pastes a **fine-grained PAT with no repo scopes** (public data needs none) into the options page
- Stored in `chrome.storage.local`, never synced, never sent anywhere but `api.github.com`
- Without a token: extension works, shows a subtle "60 req/hr — add a token for more" nudge
- With a token: silently upgrades to 5,000 req/hr

## 7. Why not `git` CLI

`git` operates on local clones only — it has no concept of a GitHub user's cloud-side repo list, stars, or public event stream. `gh` (GitHub CLI) *does* wrap the same REST API this spec uses, but it's a developer-machine tool, not something a Chrome extension can shell out to. Verdict: **REST API only**, `gh`/`git` are irrelevant to the shipped product (useful only for local prototyping/curl-testing during dev).

## 8. Caching Strategy

| Data | TTL | Rationale |
|---|---|---|
| Profile | 15–60 min | Changes rarely |
| Repo list | 10–30 min | New repos are infrequent |
| Public events | 5–15 min | Most volatile data |
| Languages | 30–120 min | Expensive to compute (N+1), changes slowly |

Every cached entry stores its `ETag`; refetches send `If-None-Match` first — a `304` refreshes the TTL for free.

## 9. Key Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| N+1 calls for languages (100 repos = 101 calls) | High | Lazy-load behind a "Load languages" button for users with >50 public repos; consider GraphQL v4 later (single-query nested languages) |
| Unauthenticated rate exhaustion | Medium | Aggressive caching, ETag reuse, visible budget indicator |
| Secondary/burst rate limiting | Medium | Serialize requests in the service worker, cap ~10–15 req/s |
| Stale "public activity" perceived as real-time | Low | Label explicitly with event timestamp |
| Accidental token exposure | High | Token never bundled, never logged, never sent to any non-GitHub origin |

## 10. MVP Roadmap

1. **Phase 1** — Popup: username input → avatar, bio, repo count, latest 5 repos (token-free)
2. **Phase 2** — Public events feed
3. **Phase 3** — Language distribution (lazy-loaded) + options page PAT input + caching layer
4. **Phase 4** — Content-script hover cards on `github.com/{username}` links

## 11. Non-Functional Requirements

- Cold popup open → first paint: **< 300ms** (cache hit), **< 1.5s** (cache miss, single profile call)
- Zero external analytics/telemetry in v1
- All network restricted to `api.github.com` in `manifest.json` `host_permissions`
- Lighthouse-style bundle budget: popup JS **< 150KB** gzipped

## 12. Sample Repo Naming

- Primary: `kibmuikia/kib-git-quickview`
- If split into a published npm types package later: `kibmuikia/kib-git-quickview-types`
- Chrome Web Store listing id tracked separately, not in repo
