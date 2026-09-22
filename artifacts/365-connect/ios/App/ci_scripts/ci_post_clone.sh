#!/bin/sh
# Xcode Cloud: runs on Apple's Mac after the repo is cloned, before the build.
# Installs Node + pnpm, builds the web app, and copies it into the iOS project
# (`cap sync`). Nothing here needs any secret.
set -euo pipefail

echo "== Installing Node + pnpm"
brew install node@22 >/dev/null 2>&1 || brew install node
export PATH="/opt/homebrew/opt/node@22/bin:/usr/local/opt/node@22/bin:$PATH"
npm install -g pnpm@10 >/dev/null 2>&1

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"   # ci_scripts → App → ios → 365-connect → artifacts
cd "$REPO_ROOT/.."                                          # monorepo root (has pnpm-workspace.yaml)

echo "== Installing dependencies"
pnpm install --frozen-lockfile=false

echo "== Building the web app"
cd artifacts/365-connect
PORT=5173 BASE_PATH=/ pnpm exec vite build

echo "== Copying web assets into the iOS project"
pnpm exec cap sync ios

echo "== Done"
