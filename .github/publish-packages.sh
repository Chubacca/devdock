#!/usr/bin/env bash
# Publish @chuvenger/devdock to npm if this version isn't already there.
# Single-package adaptation of the stacks release script: idempotent, so it's
# safe to run on every merge to main (a merge with no version bump is a no-op).
#
# In CI this authenticates via OIDC Trusted Publishing (npm >= 11.5.1 + a
# configured trusted publisher) — no token needed, and provenance is attached
# automatically. Locally, `npm publish` uses your `npm login` session.
set -euo pipefail

name=$(node -p "require('./package.json').name")
ver=$(node -p "require('./package.json').version")

if npm view "$name@$ver" version >/dev/null 2>&1; then
  echo "Skipping $name@$ver (already published)"
else
  echo "Publishing $name@$ver"
  bun run build
  npm publish --access public
fi
