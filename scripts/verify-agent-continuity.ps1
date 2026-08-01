# Verify agent continuity on Surface (OpenNexus3DStudio).
# Usage: .\scripts\verify-agent-continuity.ps1

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$fails = 0
$warns = 0

function Ok($m) { Write-Host "  OK  $m" }
function Warn($m) { $script:warns++; Write-Host "  WARN $m" }
function Fail($m) { $script:fails++; Write-Host "  FAIL $m" }

function Check-File($path, $label) {
  if (Test-Path -LiteralPath $path -PathType Leaf) { Ok $label } else { Fail "missing $label" }
}
function Check-Dir($path, $label) {
  if (Test-Path -LiteralPath $path -PathType Container) { Ok $label } else { Fail "missing $label" }
}

Write-Host "=== OpenNexus3DStudio ($Root) ==="
Check-File "$Root\CLAUDE.md" "CLAUDE.md"
Check-File "$Root\AGENTS.md" "AGENTS.md"
Check-Dir "$Root\.agent" ".agent/"
Check-File "$Root\.agent\STATE.md" ".agent/STATE.md"
Check-File "$Root\.agent\MAP.md" ".agent/MAP.md"
Check-File "$Root\.agent\PROJECT.md" ".agent/PROJECT.md"
Check-File "$Root\.agent\DECISIONS.md" ".agent/DECISIONS.md"

if (Test-Path "$Root\.brain") {
  Ok ".brain/ (MindLink)"
  Check-File "$Root\.brain\MEMORY.md" ".brain/MEMORY.md"
  Check-File "$Root\.brain\SESSION.md" ".brain/SESSION.md"
} else {
  Warn ".brain/ absent"
}

if (Test-Path "$Root\memory-bank") { Ok "memory-bank/" } else { Warn "memory-bank/ absent" }

Check-Dir "$Root\.cursor\rules" ".cursor/rules/"
@(
  'dgx-sync-reminder.mdc',
  'agent-run-instructions.mdc',
  '3daigc-opennexus3dstudio-workflow.mdc',
  'agent-continuity-startup.mdc'
) | ForEach-Object {
  if (Test-Path "$Root\.cursor\rules\$_") { Ok "rule $_" } else { Fail "rule missing: $_" }
}

Check-File "$Root\.cursor\hooks.json" ".cursor/hooks.json"
Check-File "$Root\.cursor\hooks\session-continuity.sh" ".cursor/hooks/session-continuity.sh"
Check-File "$Root\scripts\verify-agent-continuity.sh" "scripts/verify-agent-continuity.sh"
Check-File "$Root\scripts\verify-agent-continuity.ps1" "scripts/verify-agent-continuity.ps1"

if (Test-Path "$Root\.sessionmem-team") { Ok ".sessionmem-team/" } else { Warn ".sessionmem-team/ absent" }

Write-Host ""
if ($fails -eq 0) {
  Write-Host "RESULT: PASS (warnings=$warns)"
  exit 0
} else {
  Write-Host "RESULT: FAIL (fails=$fails warnings=$warns)"
  exit 1
}
