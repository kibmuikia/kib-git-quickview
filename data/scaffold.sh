#!/usr/bin/env bash
# scaffold.sh - Scaffolds src/ and public/ structures with one-line header purpose comments for kib-git-quickview

set -euo pipefail

# Create directory structure
echo "🚀 Creating directory structure..."
mkdir -p public/icons \
         src/background \
         src/popup \
         src/options \
         src/lib/github \
         src/lib/cache \
         src/lib/analytics

# Helper to write file if header provided, or touch binary placeholders
create_file() {
  local path="$1"
  local comment="$2"
  if [[ -n "$comment" ]]; then
    printf "%s\n" "$comment" > "$path"
  else
    touch "$path"
  fi
  echo "  + $path"
}

echo "📄 Generating public/ files..."
create_file "public/manifest.json" '// Chrome Extension Manifest V3 configuration defining permissions, background worker, popup, and icons'
create_file "public/popup.html" '<!-- Entry point HTML container for the Chrome extension popup dashboard UI -->'
create_file "public/options.html" '<!-- Entry point HTML container for the extension options/settings page -->'
create_file "public/icons/icon-16.png" ''
create_file "public/icons/icon-48.png" ''
create_file "public/icons/icon-128.png" ''

echo "📄 Generating src/ files..."
# Background
create_file "src/background/index.ts" '// Service worker entry point handling runtime messages, caching orchestration, and background request dispatch'

# Popup UI
create_file "src/popup/index.ts" '// Entry point for the extension popup UI initialization and state binding'
create_file "src/popup/popup.ts" '// Renders developer stats, repos, public events, and rate limits in the popup dashboard'
create_file "src/popup/popup.css" '/* Stylesheet for the popup UI dashboard, stats grid, and component cards */'

# Options UI
create_file "src/options/index.ts" '// Entry point for the options page script initialization'
create_file "src/options/options.ts" '// Manages user configuration including GitHub Personal Access Token (PAT) setup and cache clearing'
create_file "src/options/options.css" '/* Stylesheet for the extension options and configuration page */'

# GitHub Library
create_file "src/lib/github/client.ts" '// Core HTTP fetch wrapper managing request authorization headers, status error handling, and ETag header injection'
create_file "src/lib/github/profile.ts" '// GitHub API client module for fetching single user profile metadata (GET /users/{username})'
create_file "src/lib/github/repos.ts" '// GitHub API client module for fetching public repository lists (GET /users/{username}/repos)'
create_file "src/lib/github/events.ts" '// GitHub API client module for retrieving public event streams (GET /users/{username}/events/public)'
create_file "src/lib/github/languages.ts" '// GitHub API aggregator for computing language byte usage breakdown across user repositories'
create_file "src/lib/github/types.ts" '// TypeScript interfaces and type definitions matching raw GitHub REST API v3 JSON response shapes'

# Cache Library
create_file "src/lib/cache/cache.ts" '// TTL and ETag-aware persistent cache store wrapper operating over chrome.storage.local'

# Analytics Library
create_file "src/lib/analytics/stats.ts" '// Pure utility functions for deriving calculated metrics like language percentages, activity scores, and average stars'

# Shared / Constants
create_file "src/lib/constants.ts" '// Global application constants including default API URLs, TTL thresholds, and storage key identifiers'

echo "✅ Scaffolding complete! Run 'git status' to inspect generated structures."
