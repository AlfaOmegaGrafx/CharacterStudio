#!/usr/bin/env bash
# Lock-it-in: verify protected contracts, stage manifest paths that differ from HEAD, commit.
# Usage: bash scripts/lock-it-in.sh [--message "custom subject"]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MANIFEST="$ROOT/scripts/protected-paths.manifest"

msg="${1:-}"
if [[ "${1:-}" == "--message" ]]; then
  msg="${2:-}"
fi
[[ -z "$msg" ]] && msg="chore(lock-in): commit protected state and verify tooling"

echo "=== Lock it in (OpenNexus3DStudio) ==="

bash "$ROOT/scripts/verify-protected-contracts.sh"
bash "$ROOT/scripts/verify_krea2_text_to_3d_pipeline.sh" | tail -1

# shellcheck source=scripts/protected-paths-lib.sh
source "$ROOT/scripts/protected-paths-lib.sh"
protected_load_manifest "$MANIFEST"

to_stage=()
for rel in "${PROTECTED_PATHS[@]}"; do
  [[ -e "$ROOT/$rel" ]] || continue
  if ! git diff --quiet HEAD -- "$rel" 2>/dev/null || ! git ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
    to_stage+=("$rel")
  fi
done

# Always include lock-in tooling if present/changed
for rel in \
  scripts/lock-it-in.sh \
  scripts/verify-protected-contracts.sh \
  scripts/reconcile-dgx-surface.sh \
  scripts/reconcile-surface-to-dgx.sh \
  scripts/protected-paths-lib.sh \
  scripts/protected-paths.manifest \
  .cursor/rules/lock-it-in.mdc; do
  [[ -e "$ROOT/$rel" ]] && to_stage+=("$rel")
done

# De-dupe
mapfile -t to_stage < <(printf '%s\n' "${to_stage[@]}" | sort -u)

if [[ ${#to_stage[@]} -eq 0 ]]; then
  echo "Nothing to commit — protected paths already match HEAD."
  exit 0
fi

echo "Staging ${#to_stage[@]} path(s)..."
for rel in "${to_stage[@]}"; do
  if git check-ignore -q "$rel" 2>/dev/null; then
    echo "  skip gitignored: $rel"
    continue
  fi
  git add -- "$rel"
  echo "  + $rel"
done

git commit -m "$(cat <<EOF
$msg

Protected manifest paths, rules, and contract verifiers — lock-in requires git commit.
EOF
)"

git status --short
echo "LOCK_IT_IN_OK"
