# Set Workflow Status for one issue on SIP MVP Delivery (project #3).
#
# Use on EVERY lifecycle transition during the sprint — not only at sprint close.
#
# Examples:
#   powershell -File scripts/set-board-status.ps1 -IssueNumber 46 -Status "In Progress"
#   powershell -File scripts/set-board-status.ps1 -IssueNumber 46 -Status "In Review" -AddToProject
#
# Requires: gh auth refresh -h github.com -s read:project,project
param(
    [Parameter(Mandatory = $true)]
    [int]$IssueNumber,

    [Parameter(Mandatory = $true)]
    [ValidateSet("Backlog", "Ready", "In Progress", "In Review", "QA", "Done")]
    [string]$Status,

    [switch]$AddToProject
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pythonArgs = @(
    "$repoRoot\scripts\board_sync.py",
    "--issue", $IssueNumber,
    "--status", $Status
)
if ($AddToProject) {
    $pythonArgs += "--add-to-project"
}

python @pythonArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
