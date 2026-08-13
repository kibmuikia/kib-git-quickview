# kib-git-quickview

> Your GitHub lookup, minus the tab switching.

> Chrome extension for quick GitHub developer profile lookups.

> A Chrome extension that displays GitHub user stats in a popup + side-panel dashboard.

> One click. Any GitHub user. Full snapshot.

Your GitHub lookup, minus the tab switching — quick developer profile snapshots, popup or side panel.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)
![Vite](https://img.shields.io/badge/Vite-8-646CFF)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [kib-git-quickview](#kib-git-quickview)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Project Structure](#project-structure)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Development](#development)
    - [Production Build](#production-build)
  - [Available Scripts](#available-scripts)
  - [Architecture Notes](#architecture-notes)
  - [Design System](#design-system)
  - [Roadmap](#roadmap)
  - [Contributing](#contributing)
  - [License](#license)

## Features

- 🔍 **Search-first popup** — look up any GitHub username directly from the extension popup
- 📊 **At-a-glance dashboard** — public repo count, latest repositories, recent activity, and top languages
- ⚡ **Zero context switching** — no need to open a new tab to check someone's GitHub profile
- 🎨 **Custom theme engine** — a hand-tuned "solar car interior" design system with generated design tokens
- 🛡️ **Resilient GitHub API layer** — typed error handling, request timeouts, and rate-limit awareness

## Tech Stack

| Layer | Tooling |
|---|---|
| Language | TypeScript |
| Bundler | Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/) |
| Extension platform | Chrome Manifest V3 (service worker background) |
| Package manager | pnpm (workspace) |
| Linting | ESLint (flat config) + `typescript-eslint` |
| Testing | Vitest |
| Styling | Hand-authored CSS with a generated design-token pipeline |

## Project Structure

```
kib-git-quickview/
├── public/                  # Static assets copied as-is (icons, popup/options HTML)
├── src/
│   ├── assets/               # Logo (SVG + PNG), design theme source
│   ├── background/           # MV3 service worker: GitHub API service, message router, storage
│   ├── lib/
│   │   ├── github/            # Typed GitHub API client, profile/repos/events/languages, error types
│   │   ├── cache/              # Response caching
│   │   ├── analytics/          # Usage stats
│   │   ├── constants.ts
│   │   ├── logger.ts           # Structured logging utility
│   │   └── utils.ts
│   ├── options/               # Extension options page
│   ├── popup/                  # Popup dashboard UI
│   ├── styles/                 # Generated design tokens + shared components
│   ├── manifest.config.ts      # MV3 manifest, defined in TypeScript
│   └── types/                  # Ambient & message types
├── scripts/
│   └── generate-tokens.mjs     # Generates design tokens consumed by popup/options CSS
├── vite.config.ts
└── CHANGELOG.md
```

## Getting Started

### Prerequisites

- Node.js `>=20.11.0`
- pnpm `>=11.5.1`

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Then load the extension into Chrome:

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

### Production Build

```bash
pnpm build
```

This runs a type-check (`tsc`), regenerates design tokens (`prebuild`), and produces an optimized bundle in `dist/`.

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Vite in watch mode for local development |
| `pnpm build` | Type-check, generate tokens, and build for production |
| `pnpm preview` | Preview the production build |
| `pnpm typecheck` | Run TypeScript in `--noEmit` mode |
| `pnpm lint` | Lint the project with ESLint |
| `pnpm lint:fix` | Lint and auto-fix issues |
| `pnpm test` | Run the test suite with Vitest |

## Architecture Notes

- **Typed GitHub API errors** — `src/lib/github/types.ts` defines a `GitHubServiceError` hierarchy (`GitHubNotFoundError`, `GitHubAuthError`, `GitHubRateLimitError`, `GitHubNetworkError`, `GitHubTimeoutError`, `GitHubParseError`, `GitHubApiError`) so callers can branch on failure type instead of parsing status codes.
- **Resilient fetching** — `fetchWithTimeout()` wraps requests in an `AbortController` with a 10s default timeout, converting network/DOM aborts into typed errors.
- **Rate-limit aware** — response handling reads `x-ratelimit-reset` / `retry-after` headers and distinguishes primary vs. secondary (abuse) rate limits.
- **Structured logging** — a shared `logger` utility provides consistent debug/error logging across the background service worker and popup runtime.
- **Message-passing** — background and UI surfaces communicate over a typed message router (see `src/types/messages.ts`).

## Design System

The popup and options UI share a generated design-token pipeline (`scripts/generate-tokens.mjs` → `src/styles/tokens.generated.css`), sourced from a custom "solar car interior" palette (see `src/assets/solar-car-interior-theme.json`). Shared UI primitives (buttons, cards, toasts, progress indicators) live in `src/styles/components.css` and are imported by both `popup.css` and `options.css` to avoid duplication.

The logo uses a progressive-enhancement pattern: an inline SVG renders instantly as a placeholder, then a PNG is swapped in via a shared `setLogo()` utility once loaded.

## Roadmap

- [ ] Expand test coverage with Vitest
- [ ] Additional GitHub profile metrics
- [ ] Options for customizing dashboard sections

## Contributing

This is currently a solo project under active development. Issues and suggestions are welcome — please open an issue describing the change before submitting a pull request.

## License

_License to be determined._
