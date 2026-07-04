# Backfill Definition of Done on Sprint 14-17 issues (PMO one-shot)
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$repo = "utkanbir/Semantic-Intelligence-Platform"
$scriptDir = $PSScriptRoot
$repoRoot = Split-Path -Parent $scriptDir
$frontendDod = Get-Content (Join-Path $repoRoot ".tmp\issue-dod-frontend.md") -Raw
$epicDod = Get-Content (Join-Path $repoRoot ".tmp\issue-dod-epic.md") -Raw

$frontendIssues = @(159, 160, 161, 162, 163, 170, 171, 172, 173, 174, 180, 182, 183, 186, 187, 188, 192, 193, 196, 197, 200, 201, 202)
$epicIssues = @(158, 169, 179, 185, 191, 195, 199)

function Update-IssueDod {
    param([int]$Number, [string]$DodBlock, [string]$Kind)
    $body = gh issue view $Number --repo $repo --json body -q .body
    if ($body -match 'Definition of Done') {
        Write-Host "Skip #$Number - DoD already present"
        return
    }
    $newBody = $body.TrimEnd() + $DodBlock
    if ($DryRun) {
        Write-Host "Would update #$Number ($Kind)"
        return
    }
    $path = Join-Path $env:TEMP "issue-$Number-body.md"
    [System.IO.File]::WriteAllText($path, $newBody)
    gh issue edit $Number --repo $repo --body-file $path | Out-Null
    Write-Host "Updated #$Number ($Kind)"
}

foreach ($n in $frontendIssues) { Update-IssueDod -Number $n -DodBlock $frontendDod -Kind "frontend" }
foreach ($n in $epicIssues) { Update-IssueDod -Number $n -DodBlock $epicDod -Kind "epic" }

Write-Host "Backfill complete."
