# Verify sip-dev frontend/backend rollout before sprint close (PMO / DevOps)
#
# Usage:
#   powershell -File scripts/verify-sprint-deploy.ps1 -Sprint 31
#
# Exit 1 on failure — do NOT close milestone until the expected images are
# pinned in the dev overlay and rolled out in the sip-dev cluster.
param(
    [Parameter(Mandatory = $true)]
    [int]$Sprint,
    [string]$Namespace = "",
    [string]$OverlayKustomization = "",
    [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonArgs = @("scripts/verify_sprint_deploy.py", "--sprint", "$Sprint", "--timeout-seconds", "$TimeoutSeconds")
if ($Namespace) { $pythonArgs += @("--namespace", $Namespace) }
if ($OverlayKustomization) { $pythonArgs += @("--overlay-kustomization", $OverlayKustomization) }

Push-Location $repoRoot
try {
    python @pythonArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Sprint $Sprint deploy verification failed. Rebuild/publish the expected sip-dev images, apply infra/kubernetes/overlays/dev, wait for rollout, and re-run before sprint close."
    }
    Write-Host "Sprint $Sprint deploy verification passed."
}
finally {
    Pop-Location
}
