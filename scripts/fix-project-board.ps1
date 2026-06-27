# Fix SIP MVP Delivery board — Workflow Status sync
#
# See: docs/governance/retros/Sprint_0_Project_Foundation_retro.md §9
# Requires: gh auth refresh -h github.com -s read:project,project
#
# Update $s0DoneIssues / $s1AddIssues / $s1Statuses each sprint before running.
$ErrorActionPreference = "Stop"
$owner = "utkanbir"
$projectNumber = 3
$repo = "utkanbir/Semantic-Intelligence-Platform"

$s0DoneIssues = @(1, 3, 5, 12, 13, 14)
$s1AddIssues = @(29, 30, 31)
$s1Statuses = @{
    29 = "Backlog"    # E-02 epic
    30 = "Done"       # S1-01 merged
    31 = "Ready"      # S1-02 next
}

$query = @'
query($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
      fields(first: 30) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
      items(first: 100) {
        nodes {
          id
          content {
            ... on Issue { number title }
          }
        }
      }
    }
  }
}
'@

Write-Host "Fetching project $projectNumber..."
$json = gh api graphql -f query=$query -f login=$owner -F number=$projectNumber | ConvertFrom-Json
$project = $json.data.user.projectV2
$projectId = $project.id

$statusField = $project.fields.nodes | Where-Object { $_.name -eq "Workflow Status" } | Select-Object -First 1
if (-not $statusField) { throw "Workflow Status field not found" }

$statusMap = @{}
foreach ($opt in $statusField.options) { $statusMap[$opt.name] = $opt.id }
Write-Host "Status options: $($statusMap.Keys -join ', ')"

$itemByIssue = @{}
foreach ($item in $project.items.nodes) {
    if ($item.content.number) { $itemByIssue[[int]$item.content.number] = $item.id }
}

$statusFieldId = [string]$statusField.id
$projectIdStr = [string]$projectId

function Set-ProjectStatus {
    param(
        [string]$ItemId,
        [string]$StatusName
    )
    $optionId = $statusMap[$StatusName]
    if (-not $optionId) { throw "Unknown status: $StatusName" }
    $mutation = @'
mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
  updateProjectV2ItemFieldValue(
    input: { projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option } }
  ) { projectV2Item { id } }
}
'@
    gh api graphql -f query=$mutation `
        -f project=$projectIdStr `
        -f item=$ItemId `
        -f field=$statusFieldId `
        -f option=$optionId | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "GraphQL update failed for status $StatusName" }
    Write-Host "  -> $StatusName"
}

foreach ($num in $s1AddIssues) {
    if (-not $itemByIssue.ContainsKey($num)) {
        Write-Host "Adding issue #$num to project..."
        $url = "https://github.com/$repo/issues/$num"
        gh project item-add $projectNumber --owner $owner --url $url | Out-Null
        Start-Sleep -Seconds 1
        $json = gh api graphql -f query=$query -f login=$owner -F number=$projectNumber | ConvertFrom-Json
        foreach ($item in $json.data.user.projectV2.items.nodes) {
            if ($item.content.number -eq $num) { $itemByIssue[$num] = $item.id }
        }
    }
}

foreach ($num in $s0DoneIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        Write-Host "Issue #$num -> Done"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName "Done"
    } else {
        Write-Warning "Issue #$num not on board"
    }
}

foreach ($num in $s1AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s1Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

Write-Host "Board update complete."
