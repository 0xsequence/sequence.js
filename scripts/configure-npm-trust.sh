#!/usr/bin/env bash
# One-time admin setup: registers .github/workflows/npm-release-trigger.yml as a stage-only
# npm trusted publisher for every package published from master (v3) or v2 (v2-legacy).
# Requires npm >= 11.15, an npm login with publish rights and 2FA. Enable "skip 2FA for the
# next 5 minutes" on the first prompt so the loop does not ask again. See PUBLISHING.md.
set -uo pipefail

REPO="0xsequence/sequence.js"
WORKFLOW="npm-release-trigger.yml"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

packages_on() {
  local ref="$1"
  git -C "$ROOT" ls-tree -r --name-only "$ref" -- packages |
    grep -E '^packages/([^/]+/)?[^/]+/package\.json$' |
    while read -r manifest; do
      git -C "$ROOT" show "$ref:$manifest" | jq -r 'select(.private != true and .name != null) | .name'
    done
}

git -C "$ROOT" fetch --quiet origin master v2
PACKAGES=()
while read -r package; do PACKAGES+=("$package"); done < <({ packages_on origin/master; packages_on origin/v2; } | sort -u)

echo "Configuring stage-only trusted publishing ($REPO, $WORKFLOW) for ${#PACKAGES[@]} packages."
failed=()
for package in "${PACKAGES[@]}"; do
  echo "--- $package"
  if ! npm trust github "$package" --repo "$REPO" --file "$WORKFLOW" --allow-stage-publish --yes; then
    failed+=("$package")
  fi
  sleep 2 # npm rate-limits trust changes
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed for: ${failed[*]}" >&2
  exit 1
fi
echo "Done. Verify with: npm trust list <package>"
