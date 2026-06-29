# Fix SIP MVP Delivery board — batch reconciliation (drift repair)
#
# Prefer real-time updates during sprint:
#   scripts/set-board-status.ps1  (one issue per transition)
#   .github/workflows/project-board-sync.yml  (PR open → In Review, merge → Done)
#
# Use THIS script only to repair drift at sprint close or after board verification fails.
$ErrorActionPreference = "Stop"
$owner = "utkanbir"
$projectNumber = 3
$repo = "utkanbir/Semantic-Intelligence-Platform"

$s0DoneIssues = @(1, 3, 5, 12, 13, 14)
$s1AddIssues = @(29, 30, 31, 35, 37, 38, 39)
$s2AddIssues = @(43, 44, 45, 46, 47, 48, 49)
$s3AddIssues = @(56, 57, 58, 59, 60, 61, 62)
$s4AddIssues = @(73, 75, 72, 76, 77, 78, 79, 80, 81)
$s5AddIssues = @(89, 90, 95, 91, 92, 93, 94)
$s6AddIssues = @(102, 103, 104, 105, 106, 107, 108)
$s7AddIssues = @(112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122)
$s8AddIssues = @(127, 128, 129, 130, 131, 132, 133, 134, 135, 136)
$s9AddIssues = @(139, 140, 141, 142, 143, 144)
$s10AddIssues = @(147, 148, 149, 150, 151, 152)
$s11AddIssues = @(158, 159, 160, 161, 162, 163)
$s12AddIssues = @(169, 170, 171, 172, 173, 174)
$s1Statuses = @{
    29 = "Done"
    30 = "Done"
    31 = "Done"
    35 = "Done"
    37 = "Done"
    38 = "Done"
    39 = "Done"
}
$s2Statuses = @{
    43 = "Done"            # E-03 epic — sprint close
    44 = "Done"
    45 = "Done"
    46 = "Done"
    47 = "Done"
    48 = "Done"
    49 = "Done"
}
$s3Statuses = @{
    56 = "Done"       # E-04 epic
    57 = "Done"
    58 = "Done"
    59 = "Done"
    60 = "Done"
    61 = "Done"
    62 = "Done"
}
$s4Statuses = @{
    73 = "Done"       # E-05 epic
    75 = "Done"       # E-06 epic
    72 = "Done"
    76 = "Done"
    77 = "Done"
    78 = "Done"
    79 = "Done"
    80 = "Done"
    81 = "Done"
}
$s5Statuses = @{
    89 = "Done"       # E-07 epic
    90 = "Done"
    95 = "Done"
    91 = "Done"
    92 = "Done"
    93 = "Done"
    94 = "Done"
}
$s6Statuses = @{
    102 = "Done"       # E-08 epic
    103 = "Done"
    104 = "Done"
    105 = "Done"
    106 = "Done"
    107 = "Done"
    108 = "Done"
}
$s7Statuses = @{
    112 = "Done"       # E-09 epic
    113 = "Done"
    114 = "Done"
    115 = "Done"
    116 = "Done"
    117 = "Done"
    118 = "Done"
    119 = "Done"
    120 = "Done"
    121 = "Done"
    122 = "Done"
}
$s8Statuses = @{
    127 = "Done"       # E-11 epic
    128 = "Done"
    129 = "Done"
    130 = "Done"
    131 = "Done"
    132 = "Done"
    133 = "Done"
    134 = "Done"
    135 = "Done"
    136 = "Done"
}
$s9Statuses = @{
    139 = "Done"       # E-10 epic
    140 = "Done"
    141 = "Done"
    142 = "Done"
    143 = "Done"
    144 = "Done"
}
$s10Statuses = @{
    147 = "Done"       # E-12 epic
    148 = "Done"
    149 = "Done"
    150 = "Done"
    151 = "Done"
    152 = "Done"
}
$s11Statuses = @{
    158 = "Done"
    159 = "Done"
    160 = "Done"
    161 = "Done"
    162 = "Done"
    163 = "Done"
}
$s12Statuses = @{
    169 = "Ready"
    170 = "Done"
    171 = "Done"
    172 = "Done"
    173 = "Done"
    174 = "Ready"
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

function Refresh-ItemByIssue {
    $json = gh api graphql -f query=$query -f login=$owner -F number=$projectNumber | ConvertFrom-Json
    $script:itemByIssue = @{}
    foreach ($item in $json.data.user.projectV2.items.nodes) {
        if ($item.content.number) { $script:itemByIssue[[int]$item.content.number] = $item.id }
    }
}

function Add-IssueToProject {
    param([int]$IssueNumber)
    if ($itemByIssue.ContainsKey($IssueNumber)) { return }
    Write-Host "Adding issue #$IssueNumber to project..."
    $url = "https://github.com/$repo/issues/$IssueNumber"
    gh project item-add $projectNumber --owner $owner --url $url | Out-Null
    Start-Sleep -Seconds 1
    Refresh-ItemByIssue
}

function Set-SprintBoard {
    param(
        [int[]]$IssueNumbers,
        [hashtable]$StatusMap,
        [string]$DefaultStatus = "Done"
    )
    foreach ($num in $IssueNumbers) {
        Add-IssueToProject -IssueNumber $num
    }
    Refresh-ItemByIssue
    foreach ($num in $IssueNumbers) {
        if (-not $itemByIssue.ContainsKey($num)) {
            Write-Warning "Issue #$num still not on board after add"
            continue
        }
        $status = if ($StatusMap.ContainsKey($num)) { $StatusMap[$num] } else { $DefaultStatus }
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

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

foreach ($num in $s2AddIssues) {
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

foreach ($num in $s2AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s2Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

foreach ($num in $s3AddIssues) {
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

foreach ($num in $s3AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s3Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

foreach ($num in $s4AddIssues) {
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

foreach ($num in $s4AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s4Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

foreach ($num in $s5AddIssues) {
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

foreach ($num in $s5AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s5Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

foreach ($num in $s6AddIssues) {
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

foreach ($num in $s6AddIssues) {
    if ($itemByIssue.ContainsKey($num)) {
        $status = $s6Statuses[$num]
        Write-Host "Issue #$num -> $status"
        Set-ProjectStatus -ItemId $itemByIssue[$num] -StatusName $status
    }
}

Set-SprintBoard -IssueNumbers $s7AddIssues -StatusMap $s7Statuses

Set-SprintBoard -IssueNumbers $s8AddIssues -StatusMap $s8Statuses

Set-SprintBoard -IssueNumbers $s9AddIssues -StatusMap $s9Statuses

Set-SprintBoard -IssueNumbers $s10AddIssues -StatusMap $s10Statuses

Set-SprintBoard -IssueNumbers $s11AddIssues -StatusMap $s11Statuses

Write-Host "Board update complete."
