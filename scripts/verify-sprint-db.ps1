# Verify cluster DB before sprint close (PMO / DevOps)
#
# Usage:
#   powershell -File scripts/verify-sprint-db.ps1 -Sprint 8
#
# Exit 1 on failure — do NOT close milestone or finalize retro §12 until fixed.
param(
    [Parameter(Mandatory = $true)]
    [int]$Sprint,
    [string]$Namespace = "",
    [string]$PostgresPod = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonArgs = @("scripts/verify_sprint_db.py", "--sprint", "$Sprint")
if ($Namespace) { $pythonArgs += @("--namespace", $Namespace) }
if ($PostgresPod) { $pythonArgs += @("--postgres-pod", $PostgresPod) }

Push-Location $repoRoot
try {
    python @pythonArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Sprint $Sprint DB verification failed. Apply alembic upgrade on sip-dev and redeploy backend before sprint close."
    }
    Write-Host "Sprint $Sprint DB verification passed."
}
finally {
    Pop-Location
}
