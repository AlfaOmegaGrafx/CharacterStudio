#!/usr/bin/env bash
# Contract check for locked Tasks panel UI (completed collapse + viewport Clear).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Tasks panel UI (source contracts) ==="

must_contain() {
  local file="$1"
  local needle="$2"
  if ! grep -qF "$needle" "$file"; then
    echo "  FAIL missing in $file: $needle" >&2
    exit 1
  fi
  echo "  OK  $file ← $needle"
}

must_contain src/components/TaskManager.jsx 'isCompletedExpanded'
must_contain src/components/TaskManager.jsx 'task-completed-expand-btn'
must_contain src/components/TaskManager.jsx 'task-manager-clear-model-btn'
must_contain src/components/TaskManager.jsx 'clearModel'
must_contain src/components/TaskManager.jsx 'Clear done'
must_contain src/components/TaskManager.jsx 'clearCompletedTasks'
must_contain src/components/TaskManager.css 'task-completed-header .expand-icon-button'
must_contain src/components/TaskManager.css 'task-completed-title'

echo ""
echo "TASKS_PANEL_UI_OK"
