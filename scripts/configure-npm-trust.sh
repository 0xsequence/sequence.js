#!/usr/bin/env bash
# One-time admin setup: registers .github/workflows/npm-release-trigger.yml as a stage-only
# npm trusted publisher for every package published from master (v3) or v2 (v2-legacy).
# Runs npm 11.15.0 via npx (the local npm may predate --allow-stage-publish). Requires an npm
# login with publish rights and 2FA. Enable "skip 2FA for the next 5 minutes" on the first
# prompt so the loop does not ask again. See PUBLISHING.md.
set -uo pipefail

REPO="0xsequence/sequence.js"
WORKFLOW="npm-release-trigger.yml"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Same npm the release workflow uses; --allow-stage-publish needs npm >= 11.15.
NPM=(npx --yes npm@11.15.0)

die() {
  echo "configure-npm-trust: $*" >&2
  exit 1
}

packages_on() {
  local ref="$1"
  git -C "$ROOT" ls-tree -r --name-only "$ref" -- packages |
    grep -E '^packages/([^/]+/)?[^/]+/package\.json$' |
    while read -r manifest; do
      git -C "$ROOT" show "$ref:$manifest" | jq -r 'select(.private != true and .name != null) | .name' || return 1
    done
}

# Stale or missing refs would configure the wrong package set, so every step here is fatal.
git -C "$ROOT" fetch --quiet origin master v2 || die "could not fetch origin/master and origin/v2"
names=""
for ref in origin/master origin/v2; do
  ref_names="$(packages_on "$ref")" || die "could not list packages on $ref"
  [ -n "$ref_names" ] || die "no publishable packages found on $ref"
  names+="$ref_names"$'\n'
done
PACKAGES=()
while read -r package; do [ -n "$package" ] && PACKAGES+=("$package"); done < <(printf '%s' "$names" | sort -u)

echo "Configuring stage-only trusted publishing ($REPO, $WORKFLOW) for ${#PACKAGES[@]} packages."
failed=()
for package in "${PACKAGES[@]}"; do
  echo "--- $package"
  if ! "${NPM[@]}" trust github "$package" --repo "$REPO" --file "$WORKFLOW" --allow-stage-publish --yes; then
    failed+=("$package")
  fi
  sleep 2 # npm rate-limits trust changes
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed for: ${failed[*]}" >&2
  exit 1
fi
echo "Done. Verify with: npx npm@11.15.0 trust list <package>"
