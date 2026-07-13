# Apply branch protection for develop and main (S37-01).
#
# Requires gh CLI authenticated with admin:repo_hook or repo admin scope.
# Solo-maintainer policy: required_approving_review_count = 0 (PR merge without Approve).
#
# Usage:
#   powershell -File scripts/apply-branch-protection.ps1
#   powershell -File scripts/apply-branch-protection.ps1 -WhatIf
param(
    [string]$Repo = "utkanbir/Semantic-Intelligence-Platform",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

$protectionBody = @{
    required_status_checks = @{
        strict = $true
        checks = @(
            @{ context = "Backend CI" }
            @{ context = "Kustomize CI" }
            @{ context = "Sprint Governance CI" }
        )
    }
    enforce_admins = $true
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $false
        require_code_owner_reviews = $false
        required_approving_review_count = 0
    }
    restrictions = $null
    required_linear_history = $false
    allow_force_pushes = $false
    allow_deletions = $false
} | ConvertTo-Json -Depth 6

$branches = @("develop", "main")

foreach ($branch in $branches) {
    Write-Host "Applying branch protection to $branch ..." -ForegroundColor Cyan
    if ($WhatIf) {
        Write-Host "WHATIF: gh api PUT repos/$Repo/branches/$branch/protection"
        continue
    }
    $protectionBody | gh api -X PUT "repos/$Repo/branches/$branch/protection" --input -
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to apply protection to $branch"
    }
    Write-Host "OK: $branch protected (PR required, force-push disabled, Sprint Governance CI required)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Direct pushes to develop/main are rejected. Sprint closes must merge via PR." -ForegroundColor Green
