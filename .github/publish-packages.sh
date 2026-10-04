#!/usr/bin/env bash
# Publish @chuvenger/devdock to npm if this version isn't already there.
# Single-package adaptation of the stacks release script: idempotent, so it's
# safe to run on every merge to main (a merge with no version bump is a no-op).
set -euo pipefail

name=$(node -p "require('./package.json').name")
ver=$(node -p "require('./package.json').version")

if npm view "$name@$ver" version >/dev/null 2>&1; then
  echo "Skipping $name@$ver (already published)"
else
  echo "Publishing $name@$ver"
  bun run build
  bun publish --access public
fi
