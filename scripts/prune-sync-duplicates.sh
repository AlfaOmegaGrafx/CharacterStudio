#!/usr/bin/env bash
# Remove accidental duplicates on DGX after PC → DGX sync.
# Run from OpenNexus3DStudio repo root on DGX:
#   bash scripts/prune-sync-duplicates.sh
#
# Safe to re-run. Only deletes known duplicate patterns — never MONETIZATION_ROADMAP.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

removed=0

rm_if_exists() {
  local path="$1"
  if [[ -e "$path" ]]; then
    rm -rf "$path"
    echo "  removed: $path"
    removed=$((removed + 1))
  fi
}

# Remove from git index when path was tracked (prevents checkout/sync resurrection).
git_rm_if_tracked() {
  local path="$1"
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    git rm -rf --ignore-unmatch "$path" >/dev/null 2>&1 || true
    echo "  git rm: $path"
    removed=$((removed + 1))
  elif git ls-files "$path" 2>/dev/null | grep -q .; then
    git ls-files "$path" | while IFS= read -r f; do
      git rm -rf --ignore-unmatch "$f" >/dev/null 2>&1 || true
      echo "  git rm: $f"
      removed=$((removed + 1))
    done
  fi
}

prune_nested_dir() {
  local path="$1"
  rm_if_exists "$path"
  git_rm_if_tracked "$path"
}

echo "=== Prune sync duplicates (DGX) ==="

# Any MONETIZATION_ROADMAP* except the single canonical file at repo root.
while IFS= read -r -d '' f; do
  rm_if_exists "$f"
done < <(
  find "$ROOT" \
    \( -path "$ROOT/node_modules" -o -path "$ROOT/.git" -o -path "$ROOT/build" \) -prune \
    -o -name 'MONETIZATION_ROADMAP*' ! -path "$ROOT/MONETIZATION_ROADMAP.md" -print0 2>/dev/null || true
)

# Known legacy filenames from DGX roadmap experiments (safe if already gone).
for f in \
  MONETIZATION_ROADMAP_BACKUP.md \
  MONETIZATION_ROADMAP_CLEAN_JUNE10.md \
  MONETIZATION_ROADMAP_JUNE10_TARGET.md \
  MONETIZATION_ROADMAP_JUNE10_HIGHLIGHTS.html
do
  rm_if_exists "$f"
done

# Nested sync accidents — remove entire directory trees (not just files inside).
for nested in \
  docs/docs/docs \
  docs/docs/docs/docs \
  docs/docs/blog \
  docs/docs/src \
  docs/docs/static \
  docs/docs/api \
  scripts/scripts \
  scripts/scripts/scripts \
  src/components/components \
  src/components/components/components \
  src/context/context \
  src/context/context/context \
  src/pages/pages \
  src/pages/pages/pages \
  src/services/services \
  src/services/services/services \
  src/library/library \
  src/__tests__/__tests__ \
  'Pitch Deck/Pitch Deck'
do
  prune_nested_dir "$nested"
done

# Docusaurus scaffolding belongs at docs/ root, not inside docs/docs/ (content only).
for stray in \
  docs/docs/docusaurus.config.js \
  docs/docs/babel.config.js \
  docs/docs/sidebars.js \
  docs/docs/jsconfig.json \
  docs/docs/package.json \
  docs/docs/package-lock.json \
  docs/docs/yarn.lock \
  docs/docs/README.md \
  docs/docs/LICENSE
do
  rm_if_exists "$stray"
done

# Parent docs/*.md duplicates of docs/docs/*.md (sync accident — content lives in docs/docs/).
if [[ -d docs/docs ]]; then
  while IFS= read -r -d '' parent_md; do
    rel="${parent_md#docs/}"
    nested="docs/docs/$rel"
    if [[ -f "$nested" ]] && cmp -s "$parent_md" "$nested"; then
      rm_if_exists "$parent_md"
      git_rm_if_tracked "$parent_md"
    fi
  done < <(find docs -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null)
fi

# TECHNICAL_ROADMAP at docs/ root duplicates docs/docs/ (Docusaurus content lives in docs/docs/).
if [[ -f docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md && -f docs/docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md ]]; then
  if cmp -s docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md docs/docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md; then
    rm_if_exists docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md
  else
    echo "  keep both: docs/TECHNICAL_ROADMAP_RPM_MIGRATION.md differs from docs/docs/ copy"
  fi
fi

echo ""
if [[ $removed -eq 0 ]]; then
  echo "Nothing to prune."
else
  echo "Done. Removed $removed path(s)."
fi
