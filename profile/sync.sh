#!/usr/bin/env bash
# Sync everything in profile/ (except this script) → the
# github.com/matthewmyrick/matthewmyrick profile repo (the page that renders
# on https://github.com/matthewmyrick).
#
# Usage: ./profile/sync.sh
set -euo pipefail
cd "$(dirname "$0")"

REPO="matthewmyrick/matthewmyrick"

for f in *; do
  [ "$f" = "sync.sh" ] && continue
  [ -f "$f" ] || continue
  CONTENT="$(base64 < "$f")"
  SHA="$(gh api "repos/$REPO/contents/$f" --jq '.sha' 2>/dev/null || true)"
  if [ -n "$SHA" ]; then
    gh api -X PUT "repos/$REPO/contents/$f" \
      -f message="Update $f (synced from portfolio-site/profile)" \
      -f content="$CONTENT" -f sha="$SHA" --jq '.commit.sha[0:7]' | xargs -I{} echo "✓ $f → {}"
  else
    gh api -X PUT "repos/$REPO/contents/$f" \
      -f message="Add $f (synced from portfolio-site/profile)" \
      -f content="$CONTENT" --jq '.commit.sha[0:7]' | xargs -I{} echo "✓ $f → {}"
  fi
done
echo "synced → https://github.com/matthewmyrick"
