#!/usr/bin/env bash
# Shared protected-path helpers for DGX <-> Surface reconcile scripts.
# Source only — do not run directly.
set -euo pipefail

protected_paths_manifest="${PROTECTED_PATHS_MANIFEST:-}"

protected_load_manifest() {
  local manifest="$1"
  PROTECTED_PATHS=()
  [[ -f "$manifest" ]] || return 0
  while IFS= read -r line; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" ]] && continue
    PROTECTED_PATHS+=("$line")
  done < "$manifest"
}

protected_is_path() {
  local rel="$1"
  local p
  for p in "${PROTECTED_PATHS[@]}"; do
    [[ "$rel" == "$p" ]] && return 0
  done
  return 1
}

protected_trim_git_path() {
  local line="$1"
  [[ ${#line} -lt 4 ]] && return 1
  local rel="${line:3}"
  rel="${rel//$'\r'/}"
  rel="${rel#"${rel%%[![:space:]]*}"}"
  rel="${rel%"${rel##*[![:space:]]}"}"
  [[ -z "$rel" ]] && return 1
  printf '%s\n' "$rel"
}

protected_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

protected_surface_sha256() {
  local rel="$1"
  local surface_ssh="$2"
  local surface_root="$3"
  ssh -o ConnectTimeout=15 "$surface_ssh" \
    "powershell -NoProfile -Command \"if (Test-Path '${surface_root}/${rel}') { (Get-FileHash -Algorithm SHA256 '${surface_root}/${rel}').Hash.ToLower() } else { 'MISSING' }\"" \
    | tr -d '\r'
}

protected_push_to_surface() {
  local root="$1"
  local rel="$2"
  local surface_ssh="$3"
  local surface_root="$4"
  [[ -f "$root/$rel" ]] || { echo "  skip missing: $rel" >&2; return 0; }
  local parent
  parent="$(dirname "$rel")"
  ssh -o ConnectTimeout=15 "$surface_ssh" \
    "powershell -NoProfile -Command \"New-Item -ItemType Directory -Force -Path '${surface_root}/${parent}' | Out-Null\"" 2>/dev/null || true
  scp -q "$root/$rel" "${surface_ssh}:${surface_root}/${rel}"
  echo "  -> Surface $rel"
}

protected_verify_surface_checksums() {
  local root="$1"
  local surface_ssh="$2"
  local surface_root="$3"
  local mismatch=0
  local rel dgx_sha surf_sha
  for rel in "${PROTECTED_PATHS[@]}"; do
    [[ -f "$root/$rel" ]] || continue
    dgx_sha="$(protected_sha256 "$root/$rel")"
    surf_sha="$(protected_surface_sha256 "$rel" "$surface_ssh" "$surface_root")"
    if [[ "$dgx_sha" != "$surf_sha" ]]; then
      echo "  MISMATCH $rel" >&2
      protected_push_to_surface "$root" "$rel" "$surface_ssh" "$surface_root"
      mismatch=$((mismatch + 1))
    else
      echo "  OK $rel"
    fi
  done
  return "$mismatch"
}
