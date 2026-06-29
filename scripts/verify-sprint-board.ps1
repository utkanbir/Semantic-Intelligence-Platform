# Verify GitHub Project board before sprint close (PMO)
#
# Usage:
#   powershell -File scripts/verify-sprint-board.ps1 -Sprint 8
#
# Exit 1 on failure — do NOT close milestone until all sprint issues are Done on board.
param(
    [Parameter(Mandatory = $true)]
    [int]$Sprint
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    python scripts/verify_sprint_board.py --sprint $Sprint
    if ($LASTEXITCODE -ne 0) {
        throw "Sprint $Sprint board verification failed. Reconcile with fix-project-board.ps1 or set-board-status.ps1 before sprint close."
    }
    Write-Host "Sprint $Sprint board verification passed."
}
finally {
    Pop-Location
}
