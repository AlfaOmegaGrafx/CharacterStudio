#!/usr/bin/env bash
# Contract check for locked Krea 2 → Image-to-3D pipeline (OpenNexus3DStudio).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Krea 2 → Image-to-3D pipeline (unit tests) ==="
node node_modules/vitest/vitest.mjs run \
  src/__tests__/taskModelUrl.test.js \
  src/__tests__/textToImagePromptOptions.test.js \
  src/__tests__/aiModelsCatalog.test.js \
  src/__tests__/krea2TextTo3dPipeline.contract.test.js

echo ""
echo "=== Krea 2 → Image-to-3D pipeline (source contracts) ==="

must_contain() {
  local file="$1"
  local needle="$2"
  if ! grep -qF "$needle" "$file"; then
    echo "  FAIL missing in $file: $needle" >&2
    exit 1
  fi
  echo "  OK  $file"
}

must_not_contain() {
  local file="$1"
  local needle="$2"
  if grep -qF "$needle" "$file"; then
    echo "  FAIL forbidden in $file: $needle" >&2
    exit 1
  fi
  echo "  OK  no forbidden pattern in $file"
}

must_contain src/library/taskModelUrl.js 'resolveTextToImageDownloadUrl'
must_contain src/components/TaskManager.jsx 'handleUseImageForImageTo3d'
must_contain src/components/TaskManager.jsx 'Use for Image to 3D'
must_contain src/library/aiModelsCatalog.js 'trellis2_image_to_textured_mesh'
must_contain src/library/aiModelsCatalog.js 'krea2_turbo_text_to_image'
must_contain src/library/textToImagePromptOptions.js 'normalizeTextToImagePromptOptions'

echo ""
echo "KREA2_TEXT_TO_3D_PIPELINE_OK"
