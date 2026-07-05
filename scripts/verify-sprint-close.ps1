# Sprint-close gate - run ALL mandatory checks before PO handoff (PMO)
#
# Usage:
#   powershell -File scripts/verify-sprint-close.ps1 -Sprint 8
#
# Exit 0 only when every gate passes. PMO MUST NOT tell the PO sprint is complete
# or close the milestone until this script exits 0.
param(
    [Parameter(Mandatory = $true)]
    [int]$Sprint
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

Write-Host "=== Sprint $Sprint close gates ===" -ForegroundColor Cyan

$gates = @(
    @{
        Name = "Cluster DB"
        Script = Join-Path $scriptDir "verify-sprint-db.ps1"
    },
    @{
        Name = "sip-dev deploy"
        Script = Join-Path $scriptDir "verify-sprint-deploy.ps1"
    },
    @{
        Name = "Project board"
        Script = Join-Path $scriptDir "verify-sprint-board.ps1"
    }
)

$failures = @()

foreach ($gate in $gates) {
    Write-Host ""
    Write-Host "--- Gate: $($gate.Name) ---" -ForegroundColor Yellow
    $gateExitCode = 0
    try {
        & $gate.Script -Sprint $Sprint
        $gateExitCode = $LASTEXITCODE
    }
    catch {
        $gateExitCode = 1
        Write-Host $_.Exception.Message -ForegroundColor Red
    }

    if ($gateExitCode -ne 0) {
        $failures += $gate.Name
    }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "SPRINT CLOSE BLOCKED - failed gates: $($failures -join ', ')" -ForegroundColor Red
    Write-Host "PMO must repair and re-run verify-sprint-close.ps1 before PO handoff." -ForegroundColor Red
    exit 1
}

Write-Host "ALL SPRINT CLOSE GATES PASSED for Sprint $Sprint." -ForegroundColor Green
Write-Host "Safe to finalize retro, close milestone, and hand off to PO." -ForegroundColor Green
exit 0
