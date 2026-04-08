param(
    [int]$Port = 5057
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicRoot = Join-Path $scriptRoot "public"
$dataRoot = Join-Path $scriptRoot "data"
$seedPath = Join-Path $dataRoot "seed.json"
$storePath = Join-Path $dataRoot "store.json"
$uploadRoot = Join-Path $scriptRoot "uploads"
$publicRootResolved = [System.IO.Path]::GetFullPath($publicRoot)
$uploadRootResolved = [System.IO.Path]::GetFullPath($uploadRoot)

$defaultReviewTemplate = [pscustomobject]@{
    attitudeMax = 20
    abilityMax = 20
    performanceMax = 60
}

function Get-AuthMode {
    $mode = "$($env:OKR_AUTH_MODE)".Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($mode)) {
        return "legacy"
    }

    return $mode
}

function Get-InfoReviewGroup {
    return [regex]::Unescape('\u4fe1\u606f\u5316\u7ec4')
}

function Get-OpsReviewGroup {
    return [regex]::Unescape('\u8fd0\u8425\u7ec4')
}

function Get-GeneralReviewGroup {
    return [regex]::Unescape('\u7efc\u5408\u7ec4')
}

function Get-DefaultReviewGradeGroups {
    return @((Get-InfoReviewGroup), (Get-OpsReviewGroup), (Get-GeneralReviewGroup))
}

$defaultReviewGradeConfig = [pscustomobject]@{
    groups = [pscustomobject]@{
        (Get-InfoReviewGroup) = [pscustomobject]@{ "A+" = 0; "A" = 0; "B+" = 0; "B" = 0; "C" = 0 }
        (Get-OpsReviewGroup) = [pscustomobject]@{ "A+" = 0; "A" = 0; "B+" = 0; "B" = 0; "C" = 0 }
        (Get-GeneralReviewGroup) = [pscustomobject]@{ "A+" = 0; "A" = 0; "B+" = 0; "B" = 0; "C" = 0 }
    }
}

function Get-ReviewGradeLevels {
    return @("A+", "A", "B+", "B", "C")
}

function Get-ReviewGradeGroups {
    param([object]$Config = $null)

    $source = if ($null -ne $Config) { Get-ObjectPropertyValue -Object $Config -Name "groups" } else { $null }
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $groups = New-Object System.Collections.ArrayList

    if (($source -is [System.Array] -or $source -is [System.Collections.IList]) -and -not ($source -is [string])) {
        foreach ($entry in @($source)) {
            if ($null -eq $entry) {
                continue
            }

            $name = "$($entry.group)".Trim()
            if ([string]::IsNullOrWhiteSpace($name)) {
                $name = "$($entry.name)".Trim()
            }

            if ([string]::IsNullOrWhiteSpace($name)) {
                continue
            }

            if ($seen.Add($name)) {
                [void]$groups.Add($name)
            }
        }
    }
    elseif ($null -ne $source) {
        foreach ($property in $source.PSObject.Properties) {
            $name = "$($property.Name)".Trim()
            if ([string]::IsNullOrWhiteSpace($name)) {
                continue
            }
            if ($seen.Add($name)) {
                [void]$groups.Add($name)
            }
        }
    }

    if ($groups.Count -eq 0) {
        foreach ($group in Get-DefaultReviewGradeGroups) {
            if ($seen.Add($group)) {
                [void]$groups.Add($group)
            }
        }
    }

    return @($groups)
}

function Test-ValidReviewGroup {
    param(
        [string]$Group,
        [object]$Config = $null
    )

    foreach ($item in Get-ReviewGradeGroups -Config $Config) {
        if ("$item" -eq "$Group") {
            return $true
        }
    }

    return $false
}

function Get-FallbackReviewGroup {
    param([object]$Config = $null)

    $groups = @(Get-ReviewGradeGroups -Config $Config)
    if ($groups -contains (Get-GeneralReviewGroup)) {
        return (Get-GeneralReviewGroup)
    }
    if ($groups.Count -gt 0) {
        return "$($groups[0])"
    }
    return (Get-GeneralReviewGroup)
}

function Get-LegacyReviewGroupForSection {
    param(
        [string]$SectionId,
        [object]$Config = $null
    )

    $groups = @(Get-ReviewGradeGroups -Config $Config)

    switch ("$SectionId") {
        "sec-platform" {
            if ($groups -contains (Get-InfoReviewGroup)) {
                return (Get-InfoReviewGroup)
            }
        }
        "sec-solution" {
            if ($groups -contains (Get-OpsReviewGroup)) {
                return (Get-OpsReviewGroup)
            }
        }
    }

    return (Get-FallbackReviewGroup -Config $Config)
}

function Get-ObjectPropertyValue {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }

    foreach ($property in $Object.PSObject.Properties) {
        if ("$($property.Name)" -eq "$Name") {
            return $property.Value
        }
    }

    return $null
}

function Get-ReviewGradeSourceGroup {
    param(
        [object]$Groups,
        [string]$Name
    )

    if ($null -eq $Groups) {
        return $null
    }

    if (($Groups -is [System.Array] -or $Groups -is [System.Collections.IList]) -and -not ($Groups -is [string])) {
        foreach ($entry in @($Groups)) {
            if ($null -eq $entry) {
                continue
            }

            $entryName = "$($entry.group)".Trim()
            if ($entryName -eq "$Name") {
                $seats = Get-ObjectPropertyValue -Object $entry -Name "seats"
                return $(if ($null -ne $seats) { $seats } else { $entry })
            }
        }
    }

    return Get-ObjectPropertyValue -Object $Groups -Name $Name
}

function To-ObjectArray {
    param([object]$Value)

    if ($null -eq $Value) {
        return @()
    }

    return [object[]]@($Value)
}

function To-JsonList {
    param([object[]]$Items)

    $list = [System.Collections.ArrayList]::new()
    foreach ($item in @($Items)) {
        if ($null -eq $item) {
            continue
        }
        [void]$list.Add($item)
    }

    return ,$list
}

function Copy-ReviewGradeConfig {
    param([object]$Config)

    $source = if ($null -ne $Config) { $Config } else { $defaultReviewGradeConfig }
    $sourceGroups = Get-ObjectPropertyValue -Object $source -Name "groups"
    $groups = [pscustomobject]@{}
    foreach ($group in Get-ReviewGradeGroups -Config $source) {
        $quotas = [pscustomobject]@{}
        $sourceGroup = Get-ReviewGradeSourceGroup -Groups $sourceGroups -Name $group
        $defaultGroup = Get-ObjectPropertyValue -Object $defaultReviewGradeConfig.groups -Name $group
        foreach ($level in Get-ReviewGradeLevels) {
            $defaultValue = if ($null -ne $defaultGroup) { [int](Get-ObjectPropertyValue -Object $defaultGroup -Name $level) } else { 0 }
            $value = if ($null -ne $sourceGroup) { To-NullableNumber -Value (Get-ObjectPropertyValue -Object $sourceGroup -Name $level) } else { $null }
            $quotas | Add-Member -NotePropertyName $level -NotePropertyValue $(if ($null -ne $value -and $value -ge 0) { [int][math]::Floor($value) } else { $defaultValue })
        }
        $groups | Add-Member -NotePropertyName $group -NotePropertyValue $quotas
    }

    return [pscustomobject]@{
        groups = $groups
    }
}

function Normalize-ReviewGradeConfig {
    param([object]$Config)

    $normalized = Copy-ReviewGradeConfig -Config $Config

    foreach ($group in Get-ReviewGradeGroups -Config $normalized) {
        foreach ($level in Get-ReviewGradeLevels) {
            $value = To-NullableNumber -Value $normalized.groups.PSObject.Properties[$group].Value.PSObject.Properties[$level].Value
            $normalized.groups.PSObject.Properties[$group].Value.PSObject.Properties[$level].Value = if ($null -ne $value -and $value -ge 0) { [int][math]::Floor($value) } else { 0 }
        }
    }

    return $normalized
}

function Build-LegacyReviewGradeQuotas {
    param(
        [int]$TotalPeople,
        [object]$Ratios
    )

    $safeTotal = [math]::Max(0, [int]$TotalPeople)
    $source = [pscustomobject]@{}
    foreach ($level in Get-ReviewGradeLevels) {
        $value = To-NullableNumber -Value $(if ($null -ne $Ratios -and $Ratios.PSObject.Properties[$level]) { $Ratios.PSObject.Properties[$level].Value } else { 0 })
        $source | Add-Member -NotePropertyName $level -NotePropertyValue $(if ($null -ne $value -and $value -ge 0) { [double]$value } else { 0.0 })
    }
    $ratioTotal = 0.0
    foreach ($level in Get-ReviewGradeLevels) {
        $ratioTotal += [double]$source.PSObject.Properties[$level].Value
    }
    if ($ratioTotal -le 0) {
        $ratioTotal = 100
    }

    $quotas = [pscustomobject]@{}
    $assigned = 0
    $cumulative = 0.0
    for ($index = 0; $index -lt (Get-ReviewGradeLevels).Count; $index++) {
        $level = (Get-ReviewGradeLevels)[$index]
        if ($index -eq ((Get-ReviewGradeLevels).Count - 1)) {
            $quota = [math]::Max(0, $safeTotal - $assigned)
            $quotas | Add-Member -NotePropertyName $level -NotePropertyValue ([int]$quota)
            $assigned += $quota
            continue
        }

        $cumulative += [double]$source.PSObject.Properties[$level].Value
        $target = [math]::Ceiling(($safeTotal * $cumulative) / $ratioTotal)
        $quota = [math]::Max(0, [math]::Min($safeTotal - $assigned, $target - $assigned))
        $quotas | Add-Member -NotePropertyName $level -NotePropertyValue ([int]$quota)
        $assigned += $quota
    }

    return $quotas
}

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Throw-ApiError {
    param(
        [int]$StatusCode,
        [string]$Message
    )

    throw "$StatusCode|$Message"
}

function Initialize-Store {
    if (-not (Test-Path $uploadRoot)) {
        New-Item -ItemType Directory -Path $uploadRoot | Out-Null
    }

    if (-not (Test-Path $storePath)) {
        Copy-Item -Path $seedPath -Destination $storePath -Force
    }
}

function Ensure-Property {
    param(
        [object]$Target,
        [string]$Name,
        [object]$Value
    )

    if ($null -eq $Target.PSObject.Properties[$Name]) {
        $Target | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
        return
    }

    if ($null -eq $Target.$Name) {
        $Target.$Name = $Value
    }
}

function To-NullableNumber {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    $raw = "$Value".Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    $number = 0.0
    if ([double]::TryParse($raw, [ref]$number)) {
        return $number
    }

    return $null
}

function Get-BooleanValue {
    param(
        [object]$Value,
        [bool]$Default = $false
    )

    if ($null -eq $Value) {
        return $Default
    }

    if ($Value -is [bool]) {
        return $Value
    }

    $raw = "$Value".Trim().ToLowerInvariant()
    if ($raw -in @("true", "1", "yes", "y")) {
        return $true
    }
    if ($raw -in @("false", "0", "no", "n")) {
        return $false
    }

    return $Default
}

function New-Id {
    param([string]$Prefix)
    return "$Prefix-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
}

function Get-Timestamp {
    return (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

function Get-ReviewTemplate {
    param([object]$Store)

    if ($Store.settings -and $Store.settings.reviewTemplate) {
        return $Store.settings.reviewTemplate
    }

    return $defaultReviewTemplate
}

function Get-ReviewLevel {
    param([double]$Score)

    if ($Score -ge 90) { return "A" }
    if ($Score -ge 80) { return "B" }
    if ($Score -ge 70) { return "C" }
    if ($Score -ge 60) { return "D" }
    return "E"
}

function Normalize-KrMetricType {
    param([object]$MetricType)

    return "milestone"
}

function Normalize-KrProgress {
    param([object]$Value)

    $progress = To-NullableNumber -Value $Value
    if ($null -eq $progress) {
        return 0
    }

    return [math]::Min(100, [math]::Max(0, $progress))
}

function Apply-KrRules {
    param([object]$Kr)

    $Kr.metricType = "milestone"
    $Kr.progress = Normalize-KrProgress -Value $Kr.progress

    $isCompleted = $Kr.progress -ge 100 -or "$($Kr.status)" -eq "completed" -or "$($Kr.currentValue)" -eq "Done"
    $Kr.progress = if ($isCompleted) { 100 } else { 0 }
    $Kr.targetValue = "Complete"
    $Kr.currentValue = if ($isCompleted) { "Done" } else { "Pending" }

    if ("$($Kr.status)" -eq "draft") {
        return
    }

    $Kr.status = if ($isCompleted) { "completed" } else { "active" }
}

function Get-CycleWindow {
    param(
        [object]$Store,
        [string]$CycleId
    )

    $cycle = @($Store.cycles | Where-Object { $_.id -eq $CycleId })[0]
    if ($null -eq $cycle) {
        return $null
    }

    if ($CycleId -notmatch '^(?<year>\d{4})-Q(?<quarter>[1-4])$') {
        return $null
    }

    $year = [int]$Matches.year
    $quarter = [int]$Matches.quarter
    $startMonth = (($quarter - 1) * 3) + 1
    $endMonth = $startMonth + 2
    $startDate = Get-Date -Year $year -Month $startMonth -Day 1 -Hour 0 -Minute 0 -Second 0
    $endDate = $startDate.AddMonths(3).AddDays(-1)
    $submissionWindowStart = Get-Date -Year $year -Month $endMonth -Day 25 -Hour 0 -Minute 0 -Second 0

    return [pscustomobject]@{
        startDate = $startDate.Date
        endDate = $endDate.Date
        submissionWindowStart = $submissionWindowStart.Date
    }
}

function Normalize-GoalStatus {
    param(
        [object]$Store,
        [object]$Goal
    )

    $status = "$($Goal.status)".Trim().ToLowerInvariant()
    if ($status -eq "submitted") {
        $status = "confirmed"
    }

    if ($status -eq "reviewed") {
        return "reviewed"
    }

    if ($status -in @("pending-review", "pending_review")) {
        return "pending_review"
    }

    if ($status -in @("pending-submission", "pending_submission")) {
        return "pending_submission"
    }

    if ($status -eq "draft") {
        return "draft"
    }

    if ($status -ne "confirmed") {
        $status = if (Get-BooleanValue -Value $Goal.isDraft) { "draft" } else { "confirmed" }
    }

    $window = Get-CycleWindow -Store $Store -CycleId $Goal.cycleId
    if ($null -eq $window) {
        return $status
    }

    $today = (Get-Date).Date
    if ($status -eq "confirmed" -and $today -ge $window.submissionWindowStart) {
        return "pending_submission"
    }

    return $status
}

function Normalize-Store {
    param([object]$Store)

    Ensure-Property -Target $Store -Name "settings" -Value ([pscustomobject]@{})
    Ensure-Property -Target $Store.settings -Name "currentUserId" -Value ""
    Ensure-Property -Target $Store.settings -Name "reviewTemplate" -Value $defaultReviewTemplate
    Ensure-Property -Target $Store.settings -Name "reviewGradeConfig" -Value (Copy-ReviewGradeConfig -Config $defaultReviewGradeConfig)
    Ensure-Property -Target $Store.settings -Name "approvalEnabled" -Value $false
    Ensure-Property -Target $Store.settings -Name "strictWeight" -Value $false
    Ensure-Property -Target $Store.settings -Name "maxGoalLevels" -Value 3
    foreach ($collectionName in @("cycles", "departments", "sections", "users", "goals", "krs", "proofs", "activities")) {
        if ($null -eq $Store.PSObject.Properties[$collectionName]) {
            $Store | Add-Member -NotePropertyName $collectionName -NotePropertyValue @()
        }
        elseif ($null -eq $Store.$collectionName) {
            $Store.$collectionName = @()
        }
    }

    foreach ($department in @($Store.departments)) {
        Ensure-Property -Target $department -Name "name" -Value ""
    }

    foreach ($section in @($Store.sections)) {
        Ensure-Property -Target $section -Name "departmentId" -Value ""
        Ensure-Property -Target $section -Name "name" -Value ""
        Ensure-Property -Target $section -Name "reviewGroup" -Value ""

        if ([string]::IsNullOrWhiteSpace("$($section.reviewGroup)")) {
            $section.reviewGroup = Get-LegacyReviewGroupForSection -SectionId $section.id -Config $Store.settings.reviewGradeConfig
        }
    }

    foreach ($user in @($Store.users)) {
        Ensure-Property -Target $user -Name "departmentId" -Value ""
        Ensure-Property -Target $user -Name "sectionId" -Value ""
        Ensure-Property -Target $user -Name "reviewGroup" -Value ""

        if ("$($user.role)" -eq "department-leader") {
            $user.role = "system-admin"
        }

        if ([string]::IsNullOrWhiteSpace("$($user.reviewGroup)")) {
            $section = @($Store.sections | Where-Object { $_.id -eq $user.sectionId })[0]
            if ($null -ne $section -and -not [string]::IsNullOrWhiteSpace("$($section.reviewGroup)")) {
                $user.reviewGroup = "$($section.reviewGroup)"
            }
            elseif ([string]::IsNullOrWhiteSpace("$($user.sectionId)")) {
                $user.reviewGroup = Get-FallbackReviewGroup -Config $Store.settings.reviewGradeConfig
            }
        }
    }

    $Store.settings.reviewGradeConfig = Normalize-ReviewGradeConfig -Config $Store.settings.reviewGradeConfig
    foreach ($group in Get-ReviewGradeGroups -Config $Store.settings.reviewGradeConfig) {
        $employeeCount = @($Store.users | Where-Object { $_.role -eq "employee" -and (Get-UserReviewGroup -User $_ -Store $Store) -eq $group }).Count
        $groupConfig = $Store.settings.reviewGradeConfig.groups.PSObject.Properties[$group].Value
        $sum = 0
        foreach ($level in Get-ReviewGradeLevels) {
            $sum += [int]$groupConfig.PSObject.Properties[$level].Value
        }

        if ($sum -ge 99 -and $sum -le 101) {
            $legacyQuotas = Build-LegacyReviewGradeQuotas -TotalPeople $employeeCount -Ratios $groupConfig
            foreach ($level in Get-ReviewGradeLevels) {
                $groupConfig.PSObject.Properties[$level].Value = [int]$legacyQuotas.PSObject.Properties[$level].Value
            }
        }
    }

    $template = Get-ReviewTemplate -Store $Store

    foreach ($goal in @($Store.goals)) {
        Ensure-Property -Target $goal -Name "summary" -Value ""
        Ensure-Property -Target $goal -Name "manualProgress" -Value 0
        Ensure-Property -Target $goal -Name "manualScore" -Value $null
        Ensure-Property -Target $goal -Name "reviewScore" -Value $null
        Ensure-Property -Target $goal -Name "attitudeScore" -Value $null
        Ensure-Property -Target $goal -Name "abilityScore" -Value $null
        Ensure-Property -Target $goal -Name "performanceScore" -Value $null
        Ensure-Property -Target $goal -Name "reviewLevel" -Value $null
        Ensure-Property -Target $goal -Name "reviewComment" -Value ""
        Ensure-Property -Target $goal -Name "reviewerId" -Value $null
        Ensure-Property -Target $goal -Name "reviewedAt" -Value $null
        Ensure-Property -Target $goal -Name "submittedAt" -Value $null
        Ensure-Property -Target $goal -Name "followerIds" -Value @()
        Ensure-Property -Target $goal -Name "createdBy" -Value $goal.ownerId
        Ensure-Property -Target $goal -Name "confirmedAt" -Value $null
        Ensure-Property -Target $goal -Name "pendingSubmissionAt" -Value $null
        Ensure-Property -Target $goal -Name "pendingReviewAt" -Value $null
        Ensure-Property -Target $goal -Name "adminEditAuthorized" -Value $false
        Ensure-Property -Target $goal -Name "adminEditAuthorizedAt" -Value $null
        Ensure-Property -Target $goal -Name "adminEditAuthorizedBy" -Value $null
        Ensure-Property -Target $goal -Name "reviewMode" -Value $null

        $goal.points = To-NullableNumber -Value $goal.points
        $goal.manualProgress = if ($null -ne (To-NullableNumber -Value $goal.manualProgress)) { To-NullableNumber -Value $goal.manualProgress } else { 0 }
        $goal.manualScore = To-NullableNumber -Value $goal.manualScore
        $goal.reviewScore = To-NullableNumber -Value $goal.reviewScore
        $goal.attitudeScore = To-NullableNumber -Value $goal.attitudeScore
        $goal.abilityScore = To-NullableNumber -Value $goal.abilityScore
        $goal.performanceScore = To-NullableNumber -Value $goal.performanceScore

        if ($goal.reviewScore -ne $null -and $goal.attitudeScore -eq $null -and $goal.abilityScore -eq $null -and $goal.performanceScore -eq $null) {
            $goal.attitudeScore = [math]::Round([math]::Min($template.attitudeMax, $goal.reviewScore * ($template.attitudeMax / 100.0)), 1)
            $goal.abilityScore = [math]::Round([math]::Min($template.abilityMax, $goal.reviewScore * ($template.abilityMax / 100.0)), 1)
            $goal.performanceScore = [math]::Round([math]::Max(0, $goal.reviewScore - $goal.attitudeScore - $goal.abilityScore), 1)
        }

        if ([string]::IsNullOrWhiteSpace("$($goal.reviewLevel)") -and $goal.reviewScore -ne $null) {
            $goal.reviewLevel = Get-ReviewLevel -Score $goal.reviewScore
        }

        if ("$($goal.reviewMode)" -notin @("goal", "kr")) {
            $goal.reviewMode = "goal"
        }

        $goal.status = Normalize-GoalStatus -Store $Store -Goal $goal

        if ($goal.status -eq "reviewed" -and $null -eq $goal.submittedAt) {
            $goal.submittedAt = $goal.updatedAt
        }

        if ($goal.status -eq "confirmed" -and $null -eq $goal.confirmedAt) {
            $goal.confirmedAt = $goal.updatedAt
        }
        if ($goal.status -eq "pending_submission" -and $null -eq $goal.pendingSubmissionAt) {
            $goal.pendingSubmissionAt = Get-Timestamp
        }
        if ($goal.status -eq "pending_review" -and $null -eq $goal.pendingReviewAt) {
            $goal.pendingReviewAt = $goal.updatedAt
        }

        $goal.adminEditAuthorized = Get-BooleanValue -Value $goal.adminEditAuthorized
        $goal.isDraft = $goal.status -eq "draft"
    }

    foreach ($kr in @($Store.krs)) {
        Ensure-Property -Target $kr -Name "targetValue" -Value ""
        Ensure-Property -Target $kr -Name "currentValue" -Value ""
        Ensure-Property -Target $kr -Name "description" -Value ""
        Ensure-Property -Target $kr -Name "metricType" -Value "percentage"
        Ensure-Property -Target $kr -Name "status" -Value "draft"
        Ensure-Property -Target $kr -Name "workflowStatus" -Value "draft"
        Ensure-Property -Target $kr -Name "score" -Value $null
        Ensure-Property -Target $kr -Name "reviewComment" -Value ""
        Ensure-Property -Target $kr -Name "reviewerId" -Value $null
        Ensure-Property -Target $kr -Name "reviewedAt" -Value $null
        $kr.points = To-NullableNumber -Value $kr.points
        $kr.progress = if ($null -ne (To-NullableNumber -Value $kr.progress)) { To-NullableNumber -Value $kr.progress } else { 0 }
        $kr.score = To-NullableNumber -Value $kr.score
        Apply-KrRules -Kr $kr
        $goal = @($Store.goals | Where-Object { $_.id -eq $kr.goalId })[0]
        $kr.workflowStatus = if ($null -ne $goal) { $goal.status } else { "draft" }
    }

    foreach ($goal in @($Store.goals)) {
        Sync-GoalPoints -Store $Store -Goal $goal
        Sync-GoalReviewFromKrScores -Store $Store -Goal $goal
    }

    foreach ($proof in @($Store.proofs)) {
        Ensure-Property -Target $proof -Name "krId" -Value $null
        Ensure-Property -Target $proof -Name "note" -Value ""
        Ensure-Property -Target $proof -Name "mimeType" -Value "application/octet-stream"
        Ensure-Property -Target $proof -Name "sizeBytes" -Value 0
        Ensure-Property -Target $proof -Name "url" -Value "/uploads/$($proof.goalId)/$($proof.storedName)"
    }

    if ([string]::IsNullOrWhiteSpace("$($Store.settings.currentUserId)") -and @($Store.users).Count -gt 0) {
        $Store.settings.currentUserId = $Store.users[0].id
    }

    return $Store
}

function Read-Store {
    Initialize-Store
    $raw = Get-Content -Path $storePath -Raw -Encoding UTF8
    $store = $raw | ConvertFrom-Json
    return Normalize-Store -Store $store
}

function Write-Store {
    param([object]$Store)

    $tempPath = "$storePath.tmp"
    $json = $Store | ConvertTo-Json -Depth 100
    Write-Utf8File -Path $tempPath -Content $json
    Move-Item -Path $tempPath -Destination $storePath -Force
}

function Send-Json {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [object]$Body,
        [int]$StatusCode = 200
    )

    $json = $Body | ConvertTo-Json -Depth 100
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentEncoding = [System.Text.Encoding]::UTF8
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Send-Text {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$Body,
        [int]$StatusCode = 200,
        [string]$ContentType = "text/plain; charset=utf-8"
    )

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = $ContentType
    $Response.ContentEncoding = [System.Text.Encoding]::UTF8
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Get-RequestBody {
    param([System.Net.HttpListenerRequest]$Request)

    if (-not $Request.HasEntityBody) {
        return [pscustomobject]@{}
    }

    $isJson = "$($Request.ContentType)" -like "application/json*"
    $encoding = if ($isJson) { [System.Text.Encoding]::UTF8 } elseif ($null -ne $Request.ContentEncoding -and $Request.ContentEncoding.WebName) { $Request.ContentEncoding } else { [System.Text.Encoding]::UTF8 }
    $reader = New-Object System.IO.StreamReader($Request.InputStream, $encoding)
    try {
        $content = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }

    if ([string]::IsNullOrWhiteSpace($content)) {
        return [pscustomobject]@{}
    }

    return $content | ConvertFrom-Json
}

function Decode-RequestHeaderValue {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    try {
        return [System.Uri]::UnescapeDataString($Value)
    }
    catch {
        return $Value
    }
}

function Get-UserById {
    param(
        [object]$Store,
        [string]$UserId
    )

    return @($Store.users | Where-Object { $_.id -eq $UserId })[0]
}

function Get-CurrentUser {
    param([object]$Store)

    if ((Get-AuthMode) -eq "wecom") {
        Throw-ApiError -StatusCode 401 -Message "authentication required"
    }

    $user = Get-UserById -Store $Store -UserId $Store.settings.currentUserId
    if ($null -eq $user) {
        Throw-ApiError -StatusCode 401 -Message "current session user not found"
    }

    return $user
}

function Get-GoalById {
    param(
        [object]$Store,
        [string]$GoalId
    )

    return @($Store.goals | Where-Object { $_.id -eq $GoalId })[0]
}

function Get-KrById {
    param(
        [object]$Store,
        [string]$KrId
    )

    return @($Store.krs | Where-Object { $_.id -eq $KrId })[0]
}

function Get-KrGoal {
    param(
        [object]$Store,
        [object]$Kr
    )

    if ($null -eq $Kr) {
        return $null
    }

    return Get-GoalById -Store $Store -GoalId $Kr.goalId
}

function Get-ProofById {
    param(
        [object]$Store,
        [string]$ProofId
    )

    return @($Store.proofs | Where-Object { $_.id -eq $ProofId })[0]
}

function Get-ProofByStoredPath {
    param(
        [object]$Store,
        [string]$GoalId,
        [string]$StoredName
    )

    return @($Store.proofs | Where-Object { $_.goalId -eq $GoalId -and $_.storedName -eq $StoredName })[0]
}

function Get-ProofGoal {
    param(
        [object]$Store,
        [object]$Proof
    )

    if ($null -eq $Proof) {
        return $null
    }

    return Get-GoalById -Store $Store -GoalId $Proof.goalId
}

function Get-GoalOwner {
    param(
        [object]$Store,
        [object]$Goal
    )

    if ($null -eq $Goal) {
        return $null
    }

    return Get-UserById -Store $Store -UserId $Goal.ownerId
}

function Get-SafeFileName {
    param([string]$FileName)

    $name = if ([string]::IsNullOrWhiteSpace($FileName)) { "proof.bin" } else { $FileName }
    foreach ($char in [System.IO.Path]::GetInvalidFileNameChars()) {
        $name = $name.Replace($char, "_")
    }

    return $name
}

function Get-NextGoalCode {
    param(
        [object]$Store,
        [string]$ParentId
    )

    if ([string]::IsNullOrWhiteSpace($ParentId)) {
        $siblings = @($Store.goals | Where-Object { [string]::IsNullOrWhiteSpace($_.parentId) })
        return "O$($siblings.Count + 1)"
    }

    $parent = Get-GoalById -Store $Store -GoalId $ParentId
    if ($null -eq $parent) {
        Throw-ApiError -StatusCode 404 -Message "parent goal not found"
    }

    $siblings = @($Store.goals | Where-Object { $_.parentId -eq $ParentId })
    return "$($parent.code)$($siblings.Count + 1)"
}

function Get-NextKrCode {
    param(
        [object]$Store,
        [string]$GoalId
    )

    $siblings = @($Store.krs | Where-Object { $_.goalId -eq $GoalId })
    return "KR$($siblings.Count + 1)"
}

function Get-GoalKrs {
    param(
        [object]$Store,
        [string]$GoalId
    )

    return @($Store.krs | Where-Object { $_.goalId -eq $GoalId })
}

function Get-GoalPointsTotal {
    param(
        [object]$Store,
        [string]$GoalId
    )

    $total = 0.0
    foreach ($kr in @(Get-GoalKrs -Store $Store -GoalId $GoalId)) {
        $total += if ($null -ne (To-NullableNumber -Value $kr.points)) { To-NullableNumber -Value $kr.points } else { 0 }
    }

    return [math]::Round($total, 1)
}

function Sync-GoalPoints {
    param(
        [object]$Store,
        [object]$Goal
    )

    if ($null -eq $Goal) {
        return
    }

    $Goal.points = Get-GoalPointsTotal -Store $Store -GoalId $Goal.id
}

function Sync-OwnerCycleGoalPoints {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId
    )

    foreach ($goal in @($Store.goals | Where-Object { $_.ownerId -eq $OwnerId -and $_.cycleId -eq $CycleId })) {
        Sync-GoalPoints -Store $Store -Goal $goal
    }
}

function Get-KrPayloadPointTotal {
    param([object[]]$KrPayloads)

    $total = 0.0
    foreach ($krPayload in @($KrPayloads)) {
        if ([string]::IsNullOrWhiteSpace("$($krPayload.name)")) {
            continue
        }
        $total += if ($null -ne (To-NullableNumber -Value $krPayload.points)) { To-NullableNumber -Value $krPayload.points } else { 0 }
    }

    return [math]::Round($total, 1)
}

function Get-OwnerCycleGoalPointTotal {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId
    )

    $total = 0.0
    foreach ($goal in @($Store.goals | Where-Object { $_.ownerId -eq $OwnerId -and $_.cycleId -eq $CycleId })) {
        $total += if ($null -ne (To-NullableNumber -Value $goal.points)) { To-NullableNumber -Value $goal.points } else { 0 }
    }

    return [math]::Round($total, 1)
}

function Get-OwnerCycleGoalPointTotalForGoal {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId,
        [string]$GoalId,
        [double]$GoalPoints
    )

    $otherTotal = 0.0
    foreach ($goal in @($Store.goals | Where-Object { $_.ownerId -eq $OwnerId -and $_.cycleId -eq $CycleId -and $_.id -ne $GoalId })) {
        $otherTotal += if ($null -ne (To-NullableNumber -Value $goal.points)) { To-NullableNumber -Value $goal.points } else { 0 }
    }

    return [math]::Round($otherTotal + $GoalPoints, 1)
}

function Assert-OwnerCycleGoalPointTotalForGoal {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId,
        [string]$GoalId,
        [double]$GoalPoints
    )

    $total = Get-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $OwnerId -CycleId $CycleId -GoalId $GoalId -GoalPoints $GoalPoints
    if (-not (Test-IsHundredPointPlan -Total $total)) {
        Throw-ApiError -StatusCode 400 -Message "当前季度该员工所有 O 的分值合计必须为 100"
    }
}

function Assert-DraftOwnerCycleGoalPointCapForGoal {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId,
        [string]$GoalId,
        [double]$GoalPoints
    )

    $currentTotal = Get-OwnerCycleGoalPointTotal -Store $Store -OwnerId $OwnerId -CycleId $CycleId
    $proposedTotal = Get-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $OwnerId -CycleId $CycleId -GoalId $GoalId -GoalPoints $GoalPoints

    if ($proposedTotal -le 100.001) {
        return
    }

    if ($currentTotal -gt 100.001 -and $proposedTotal -le ($currentTotal + 0.001)) {
        return
    }

    Throw-ApiError -StatusCode 400 -Message "当前季度该员工所有 O 的分值合计不能超过 100"
}

function Test-IsHundredPointPlan {
    param([double]$Total)

    return [math]::Abs($Total - 100) -lt 0.001
}

function Assert-OwnerCycleGoalPointTotal {
    param(
        [object]$Store,
        [string]$OwnerId,
        [string]$CycleId
    )

    $total = Get-OwnerCycleGoalPointTotal -Store $Store -OwnerId $OwnerId -CycleId $CycleId
    if (-not (Test-IsHundredPointPlan -Total $total)) {
        Throw-ApiError -StatusCode 400 -Message "当前季度该员工所有 O 的分值合计必须为 100"
    }
}

function Add-Activity {
    param(
        [object]$Store,
        [string]$EntityType,
        [string]$EntityId,
        [string]$Action,
        [string]$Message,
        [string]$OperatorId
    )

    $activity = [pscustomobject]@{
        id = New-Id -Prefix "act"
        entityType = $EntityType
        entityId = $EntityId
        action = $Action
        message = $Message
        operatorId = $OperatorId
        createdAt = Get-Timestamp
    }

    $Store.activities = @($Store.activities) + $activity
}

function Reset-GoalReviewState {
    param([object]$Goal)

    $Goal.reviewScore = $null
    $Goal.attitudeScore = $null
    $Goal.abilityScore = $null
    $Goal.performanceScore = $null
    $Goal.reviewLevel = $null
    $Goal.reviewComment = ""
    $Goal.reviewerId = $null
    $Goal.reviewedAt = $null
    $Goal.pendingReviewAt = $null
}

function Get-SectionById {
    param(
        [object]$Store,
        [string]$SectionId
    )

    return @($Store.sections | Where-Object { $_.id -eq $SectionId })[0]
}

function Get-UserReviewGroup {
    param(
        [object]$User,
        [object]$Store = $null
    )

    $config = if ($null -ne $Store) { $Store.settings.reviewGradeConfig } else { $null }

    if ($null -eq $User) {
        return (Get-FallbackReviewGroup -Config $config)
    }

    if (-not [string]::IsNullOrWhiteSpace("$($User.reviewGroup)")) {
        return "$($User.reviewGroup)"
    }

    if ($null -ne $Store -and -not [string]::IsNullOrWhiteSpace("$($User.sectionId)")) {
        $section = Get-SectionById -Store $Store -SectionId $User.sectionId
        if ($null -ne $section -and -not [string]::IsNullOrWhiteSpace("$($section.reviewGroup)")) {
            return "$($section.reviewGroup)"
        }
    }

    if ([string]::IsNullOrWhiteSpace("$($User.sectionId)")) {
        return (Get-FallbackReviewGroup -Config $config)
    }

    return (Get-LegacyReviewGroupForSection -SectionId $User.sectionId -Config $config)
}

function Sync-GoalReviewFromKrScores {
    param(
        [object]$Store,
        [object]$Goal
    )

    if ("$($Goal.reviewMode)" -ne "kr") {
        return
    }

    $goalKrs = @($Store.krs | Where-Object { $_.goalId -eq $Goal.id })
    $scoredKrs = @($goalKrs | Where-Object { $null -ne (To-NullableNumber -Value $_.score) })

    $Goal.attitudeScore = $null
    $Goal.abilityScore = $null
    $Goal.performanceScore = $null

    if ($goalKrs.Count -eq 0 -or $scoredKrs.Count -eq 0) {
        $Goal.reviewScore = $null
        $Goal.reviewLevel = $null
        $Goal.reviewComment = ""
        $Goal.reviewerId = $null
        $Goal.reviewedAt = $null
        if ("$($Goal.status)" -eq "reviewed") {
            $Goal.status = "pending_review"
        }
        return
    }

    $weightedTotal = 0.0
    $weightSum = 0.0
    foreach ($kr in $scoredKrs) {
        $weight = if ($null -ne (To-NullableNumber -Value $kr.points)) { [double](To-NullableNumber -Value $kr.points) } else { 1.0 }
        $weightSum += $weight
        $weightedTotal += ([double](To-NullableNumber -Value $kr.score)) * $weight
    }

    $Goal.reviewScore = if ($weightSum -gt 0) { [math]::Round($weightedTotal / $weightSum, 1) } else { $null }
    $Goal.reviewComment = ""

    $latestReviewedKr = @(
        $scoredKrs |
            Sort-Object -Property @{
                Expression = {
                    if (-not [string]::IsNullOrWhiteSpace("$($_.reviewedAt)")) {
                        return $_.reviewedAt
                    }
                    return $_.updatedAt
                }
            } -Descending
    )[0]

    if ($null -ne $latestReviewedKr) {
        $Goal.reviewerId = $latestReviewedKr.reviewerId
    }

    $fullyScored = $goalKrs.Count -gt 0 -and $scoredKrs.Count -eq $goalKrs.Count
    if ($fullyScored) {
        $Goal.status = "reviewed"
        $Goal.reviewedAt = if ($null -ne $latestReviewedKr) { $latestReviewedKr.reviewedAt } else { Get-Timestamp }
        $Goal.reviewLevel = if ($Goal.reviewScore -ne $null) { Get-ReviewLevel -Score $Goal.reviewScore } else { $null }
        return
    }

    if ("$($Goal.status)" -eq "reviewed") {
        $Goal.status = "pending_review"
    }
    $Goal.reviewedAt = $null
    $Goal.reviewLevel = $null
}

function Finalize-GoalEdit {
    param(
        [object]$Store,
        [object]$Goal
    )

    if (-not $Goal.adminEditAuthorized) {
        return
    }

    Reset-GoalReviewState -Goal $Goal
    $Goal.status = "confirmed"
    $Goal.isDraft = $false
    $Goal.confirmedAt = Get-Timestamp
    $Goal.pendingSubmissionAt = $null
    $Goal.adminEditAuthorized = $false
    $Goal.adminEditAuthorizedAt = $null
    $Goal.adminEditAuthorizedBy = $null
}

function Test-CanViewGoal {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    $owner = Get-GoalOwner -Store $Store -Goal $Goal
    if ($null -eq $owner) {
        return $false
    }

    switch ($currentUser.role) {
        "employee" {
            return $Goal.ownerId -eq $currentUser.id
        }
        "section-leader" {
            return $owner.role -eq "employee" -and $owner.sectionId -eq $currentUser.sectionId -and $owner.departmentId -eq $currentUser.departmentId
        }
        "group-leader" {
            return $owner.role -eq "employee" -and $owner.departmentId -eq $currentUser.departmentId -and (Get-UserReviewGroup -User $owner -Store $Store) -eq (Get-UserReviewGroup -User $currentUser -Store $Store)
        }
        "department-leader" {
            return $owner.role -eq "employee" -and $owner.departmentId -eq $currentUser.departmentId
        }
        default {
            return $false
        }
    }
}

function Test-CanEditGoal {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    if ($currentUser.role -ne "employee" -or $Goal.ownerId -ne $currentUser.id) {
        return $false
    }

    if ("$($Goal.status)" -eq "draft") {
        return $true
    }

    return $false
}

function Test-CanUploadKrProof {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    if ($currentUser.role -ne "employee" -or $Goal.ownerId -ne $currentUser.id) {
        return $false
    }

    return "$($Goal.status)" -in @("confirmed", "pending_submission", "pending_review")
}

function Test-CanConfirmKrCompletion {
    param(
        [object]$Store,
        [object]$Goal
    )

    return Test-CanUploadKrProof -Store $Store -Goal $Goal
}

function Test-CanSubmitGoalForReview {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    return $currentUser.role -eq "employee" -and $Goal.ownerId -eq $currentUser.id -and "$($Goal.status)" -eq "pending_submission"
}

function Test-CanAuthorizeGoalEdit {
    param(
        [object]$Store,
        [object]$Goal
    )
    return $false
}

function Test-CanReviewGoal {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    $owner = Get-GoalOwner -Store $Store -Goal $Goal
    return $currentUser.role -eq "section-leader" -and $owner.role -eq "employee" -and $owner.sectionId -eq $currentUser.sectionId -and $owner.departmentId -eq $currentUser.departmentId -and "$($Goal.status)" -eq "pending_review"
}

function Test-CanScoreKr {
    param(
        [object]$Store,
        [object]$Goal
    )

    $currentUser = Get-CurrentUser -Store $Store
    $owner = Get-GoalOwner -Store $Store -Goal $Goal
    if ($null -eq $owner) {
        return $false
    }

    $scoreableStatuses = @("pending_review", "reviewed")

    switch ($currentUser.role) {
        "section-leader" {
            return $owner.role -eq "employee" -and $owner.sectionId -eq $currentUser.sectionId -and $owner.departmentId -eq $currentUser.departmentId -and $scoreableStatuses -contains "$($Goal.status)"
        }
        "group-leader" {
            return $owner.role -eq "employee" -and $owner.departmentId -eq $currentUser.departmentId -and (Get-UserReviewGroup -User $owner -Store $Store) -eq (Get-UserReviewGroup -User $currentUser -Store $Store) -and $scoreableStatuses -contains "$($Goal.status)"
        }
        default {
            return $false
        }
    }
}

function Test-CanDeleteProof {
    param(
        [object]$Store,
        [object]$Proof
    )

    $goal = Get-ProofGoal -Store $Store -Proof $Proof
    $currentUser = Get-CurrentUser -Store $Store
    return $null -ne $goal -and (Test-CanUploadKrProof -Store $Store -Goal $goal) -and $Proof.uploadedBy -eq $currentUser.id
}

function Get-VisibleGoals {
    param([object]$Store)

    return @($Store.goals | Where-Object { Test-CanViewGoal -Store $Store -Goal $_ })
}

function Build-BootstrapPayload {
    param([object]$Store)

    $Store = Normalize-Store -Store $Store

    if ((Get-AuthMode) -eq "wecom") {
        return [pscustomobject]@{
            authState       = "anonymous"
            currentUser     = $null
            sessionsEnabled = $true
            settings        = $Store.settings
            demoUsers       = (To-JsonList -Items @())
            users           = (To-JsonList -Items @())
            departments     = (To-JsonList -Items @())
            sections        = (To-JsonList -Items @())
            cycles          = (To-JsonList -Items @($Store.cycles))
            goals           = (To-JsonList -Items @())
            krs             = (To-JsonList -Items @())
            proofs          = (To-JsonList -Items @())
            activities      = (To-JsonList -Items @())
        }
    }

    $currentUser = Get-CurrentUser -Store $Store
    $visibleGoalsRaw = Get-VisibleGoals -Store $Store
    [object[]]$visibleGoals = if ($null -eq $visibleGoalsRaw) { @() } else { @($visibleGoalsRaw) }
    $visibleGoalIds = @($visibleGoals.id)
    $visibleKrsRaw = @($Store.krs | Where-Object { $visibleGoalIds -contains $_.goalId })
    [object[]]$visibleKrs = if ($null -eq $visibleKrsRaw) { @() } else { @($visibleKrsRaw) }
    $visibleKrIds = @($visibleKrs.id)
    $visibleProofsRaw = @($Store.proofs | Where-Object { $visibleGoalIds -contains $_.goalId })
    [object[]]$visibleProofs = if ($null -eq $visibleProofsRaw) { @() } else { @($visibleProofsRaw) }
    $visibleActivitiesRaw = @($Store.activities | Where-Object { ($visibleGoalIds -contains $_.entityId) -or ($visibleKrIds -contains $_.entityId) })
    [object[]]$visibleActivities = if ($null -eq $visibleActivitiesRaw) { @() } else { @($visibleActivitiesRaw) }

    $userIds = New-Object 'System.Collections.Generic.HashSet[string]'
    $null = $userIds.Add($currentUser.id)

    foreach ($goal in $visibleGoals) {
        if (-not [string]::IsNullOrWhiteSpace("$($goal.ownerId)")) { $null = $userIds.Add($goal.ownerId) }
        if (-not [string]::IsNullOrWhiteSpace("$($goal.reviewerId)")) { $null = $userIds.Add($goal.reviewerId) }
    }
    foreach ($proof in $visibleProofs) {
        if (-not [string]::IsNullOrWhiteSpace("$($proof.uploadedBy)")) { $null = $userIds.Add($proof.uploadedBy) }
    }
    foreach ($activity in $visibleActivities) {
        if (-not [string]::IsNullOrWhiteSpace("$($activity.operatorId)")) { $null = $userIds.Add($activity.operatorId) }
    }

    switch ($currentUser.role) {
        "section-leader" {
            foreach ($user in @($Store.users | Where-Object { $_.role -eq "employee" -and $_.sectionId -eq $currentUser.sectionId })) {
                $null = $userIds.Add($user.id)
            }
        }
        "system-admin" {
            foreach ($user in @($Store.users)) {
                $null = $userIds.Add($user.id)
            }
        }
    }

    [object[]]$scopedUsers = @($Store.users | Where-Object { $userIds.Contains($_.id) })
    [object[]]$scopedDepartments = if ($currentUser.role -eq "system-admin") { @($Store.departments) } else { @($Store.departments | Where-Object { $_.id -eq $currentUser.departmentId }) }
    [object[]]$scopedSections = if ($currentUser.role -eq "system-admin") { @($Store.sections) } else { @($Store.sections | Where-Object { $_.departmentId -eq $currentUser.departmentId }) }

    return [pscustomobject]@{
        settings = $Store.settings
        demoUsers = (To-JsonList -Items $Store.users)
        users = (To-JsonList -Items $scopedUsers)
        departments = (To-JsonList -Items $scopedDepartments)
        sections = (To-JsonList -Items $scopedSections)
        cycles = (To-JsonList -Items $Store.cycles)
        goals = (To-JsonList -Items $visibleGoals)
        krs = (To-JsonList -Items $visibleKrs)
        proofs = (To-JsonList -Items $visibleProofs)
        activities = (To-JsonList -Items $visibleActivities)
    }
}

function Update-Session {
    param(
        [object]$Store,
        [object]$Payload
    )

    if ([string]::IsNullOrWhiteSpace("$($Payload.currentUserId)")) {
        Throw-ApiError -StatusCode 400 -Message "currentUserId is required"
    }

    $user = Get-UserById -Store $Store -UserId $Payload.currentUserId
    if ($null -eq $user) {
        Throw-ApiError -StatusCode 404 -Message "user not found"
    }

    $Store.settings.currentUserId = $Payload.currentUserId
    return $Store.settings
}

function Update-ReviewGradeConfig {
    param(
        [object]$Store,
        [object]$Payload
    )

    $currentUser = Get-CurrentUser -Store $Store
    if ($currentUser.role -ne "system-admin") {
        Throw-ApiError -StatusCode 403 -Message "only system administrators can update review grade config"
    }

    if ($null -eq $Payload -or $null -eq $Payload.groups) {
        Throw-ApiError -StatusCode 400 -Message "groups is required"
    }

    $rawGroups = Get-ObjectPropertyValue -Object $Payload -Name "groups"
    $rawGroupCount = if (($rawGroups -is [System.Array] -or $rawGroups -is [System.Collections.IList]) -and -not ($rawGroups -is [string])) {
        @($rawGroups).Count
    }
    elseif ($null -ne $rawGroups) {
        @($rawGroups.PSObject.Properties).Count
    }
    else {
        0
    }
    if ($rawGroupCount -eq 0) {
        Throw-ApiError -StatusCode 400 -Message "at least one review grade group is required"
    }

    $normalized = Normalize-ReviewGradeConfig -Config $Payload

    foreach ($group in Get-ReviewGradeGroups -Config $normalized) {
        $sum = 0
        $employeeCount = @($Store.users | Where-Object { $_.role -eq "employee" -and (Get-UserReviewGroup -User $_ -Store $Store) -eq $group }).Count
        foreach ($level in Get-ReviewGradeLevels) {
            $value = [int]$normalized.groups.PSObject.Properties[$group].Value.PSObject.Properties[$level].Value
            if ($value -lt 0) {
                Throw-ApiError -StatusCode 400 -Message "review grade seats must be non-negative"
            }
            $sum += $value
        }

        if ($sum -gt $employeeCount) {
            Throw-ApiError -StatusCode 400 -Message "review grade seats cannot exceed employee count in group $group"
        }
    }

    $Store.settings.reviewGradeConfig = $normalized
    return $Store.settings.reviewGradeConfig
}

function Update-AdminConfig {
    param(
        [object]$Store,
        [object]$Payload
    )

    $currentUser = Get-CurrentUser -Store $Store
    if ($currentUser.role -ne "system-admin") {
        Throw-ApiError -StatusCode 403 -Message "only system administrators can update admin config"
    }

    if ($null -eq $Payload) {
        Throw-ApiError -StatusCode 400 -Message "payload is required"
    }

    $allowedRoles = @("employee", "section-leader", "group-leader", "system-admin")
    $rawGroups = Get-ObjectPropertyValue -Object $Payload.reviewGradeConfig -Name "groups"
    $rawGroupCount = if (($rawGroups -is [System.Array] -or $rawGroups -is [System.Collections.IList]) -and -not ($rawGroups -is [string])) {
        @($rawGroups).Count
    }
    elseif ($null -ne $rawGroups) {
        @($rawGroups.PSObject.Properties).Count
    }
    else {
        0
    }
    if ($rawGroupCount -eq 0) {
        Throw-ApiError -StatusCode 400 -Message "at least one review group is required"
    }
    $normalizedConfig = Normalize-ReviewGradeConfig -Config $Payload.reviewGradeConfig
    $reviewGroups = @(Get-ReviewGradeGroups -Config $normalizedConfig)
    $fallbackReviewGroup = Get-FallbackReviewGroup -Config $normalizedConfig

    $normalizedDepartments = @()
    $departmentIds = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($department in @($Payload.departments)) {
        $departmentId = "$($department.id)".Trim()
        if ([string]::IsNullOrWhiteSpace($departmentId)) {
            $departmentId = New-Id -Prefix "dept"
        }

        $departmentName = "$($department.name)".Trim()
        if ([string]::IsNullOrWhiteSpace($departmentName)) {
            Throw-ApiError -StatusCode 400 -Message "department name is required"
        }

        if (-not $departmentIds.Add($departmentId)) {
            Throw-ApiError -StatusCode 400 -Message "duplicate department id: $departmentId"
        }

        $normalizedDepartments += [pscustomobject]@{
            id = $departmentId
            name = $departmentName
        }
    }

    if ($normalizedDepartments.Count -eq 0) {
        Throw-ApiError -StatusCode 400 -Message "at least one department is required"
    }

    $normalizedSections = @()
    $sectionIds = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($section in @($Payload.sections)) {
        $sectionId = "$($section.id)".Trim()
        if ([string]::IsNullOrWhiteSpace($sectionId)) {
            $sectionId = New-Id -Prefix "sec"
        }

        $sectionName = "$($section.name)".Trim()
        $sectionDepartmentId = "$($section.departmentId)".Trim()
        $reviewGroup = "$($section.reviewGroup)".Trim()

        if ([string]::IsNullOrWhiteSpace($sectionName)) {
            Throw-ApiError -StatusCode 400 -Message "section name is required"
        }
        if ([string]::IsNullOrWhiteSpace($sectionDepartmentId)) {
            Throw-ApiError -StatusCode 400 -Message "section departmentId is required"
        }
        if ([string]::IsNullOrWhiteSpace($reviewGroup)) {
            $reviewGroup = $fallbackReviewGroup
        }
        if (-not ($normalizedDepartments | Where-Object { $_.id -eq $sectionDepartmentId })) {
            Throw-ApiError -StatusCode 400 -Message "section department not found: $sectionDepartmentId"
        }
        if ($reviewGroup -notin $reviewGroups) {
            Throw-ApiError -StatusCode 400 -Message "section review group not found: $reviewGroup"
        }
        if (-not $sectionIds.Add($sectionId)) {
            Throw-ApiError -StatusCode 400 -Message "duplicate section id: $sectionId"
        }

        $normalizedSections += [pscustomobject]@{
            id = $sectionId
            departmentId = $sectionDepartmentId
            name = $sectionName
            reviewGroup = $reviewGroup
        }
    }

    if ($normalizedSections.Count -eq 0) {
        Throw-ApiError -StatusCode 400 -Message "at least one section is required"
    }

    $normalizedUsers = @()
    $userIds = New-Object 'System.Collections.Generic.HashSet[string]'
    foreach ($user in @($Payload.users)) {
        $userId = "$($user.id)".Trim()
        if ([string]::IsNullOrWhiteSpace($userId)) {
            $userId = New-Id -Prefix "u"
        }

        $userName = "$($user.name)".Trim()
        $departmentId = "$($user.departmentId)".Trim()
        $sectionId = "$($user.sectionId)".Trim()
        $role = "$($user.role)".Trim()
        $reviewGroup = "$($user.reviewGroup)".Trim()

        if ([string]::IsNullOrWhiteSpace($userName)) {
            Throw-ApiError -StatusCode 400 -Message "user name is required"
        }
        if ($role -notin $allowedRoles) {
            Throw-ApiError -StatusCode 400 -Message "invalid user role: $role"
        }
        if ([string]::IsNullOrWhiteSpace($departmentId)) {
            Throw-ApiError -StatusCode 400 -Message "user departmentId is required"
        }
        if (-not ($normalizedDepartments | Where-Object { $_.id -eq $departmentId })) {
            Throw-ApiError -StatusCode 400 -Message "user department not found: $departmentId"
        }
        if (($role -eq "employee" -or $role -eq "section-leader") -and [string]::IsNullOrWhiteSpace($sectionId)) {
            Throw-ApiError -StatusCode 400 -Message "sectionId is required for role $role"
        }
        if (-not [string]::IsNullOrWhiteSpace($sectionId)) {
            $section = @($normalizedSections | Where-Object { $_.id -eq $sectionId })[0]
            if ($null -eq $section) {
                Throw-ApiError -StatusCode 400 -Message "user section not found: $sectionId"
            }
            if ($section.departmentId -ne $departmentId) {
                Throw-ApiError -StatusCode 400 -Message "user department and section department must match"
            }
            if ([string]::IsNullOrWhiteSpace($reviewGroup)) {
                $reviewGroup = "$($section.reviewGroup)"
            }
        }
        if ([string]::IsNullOrWhiteSpace($reviewGroup)) {
            $reviewGroup = $fallbackReviewGroup
        }
        if ($reviewGroup -notin $reviewGroups) {
            Throw-ApiError -StatusCode 400 -Message "user review group not found: $reviewGroup"
        }
        if (-not $userIds.Add($userId)) {
            Throw-ApiError -StatusCode 400 -Message "duplicate user id: $userId"
        }

        $normalizedUsers += [pscustomobject]@{
            id = $userId
            name = $userName
            departmentId = $departmentId
            sectionId = $sectionId
            role = $role
            reviewGroup = $reviewGroup
        }
    }

    if ($normalizedUsers.Count -eq 0) {
        Throw-ApiError -StatusCode 400 -Message "at least one user is required"
    }

    $currentUserRecord = @($normalizedUsers | Where-Object { $_.id -eq $currentUser.id })[0]
    if ($null -eq $currentUserRecord -or $currentUserRecord.role -ne "system-admin") {
        Throw-ApiError -StatusCode 400 -Message "current system administrator account must remain a system-admin"
    }
    if (-not ($normalizedUsers | Where-Object { $_.role -eq "system-admin" })) {
        Throw-ApiError -StatusCode 400 -Message "at least one system-admin user is required"
    }

    foreach ($goal in @($Store.goals)) {
        if (-not ($normalizedUsers | Where-Object { $_.id -eq $goal.ownerId })) {
            Throw-ApiError -StatusCode 400 -Message "cannot remove user referenced by goal $($goal.id)"
        }
    }

    foreach ($group in Get-ReviewGradeGroups -Config $normalizedConfig) {
        $employeeCount = @($normalizedUsers | Where-Object { $_.role -eq "employee" -and $_.reviewGroup -eq $group }).Count
        $sum = 0
        foreach ($level in Get-ReviewGradeLevels) {
            $sum += [int]$normalizedConfig.groups.PSObject.Properties[$group].Value.PSObject.Properties[$level].Value
        }
        if ($sum -gt $employeeCount) {
            Throw-ApiError -StatusCode 400 -Message "review grade seats cannot exceed employee count in group $group"
        }
    }

    $Store.departments = $normalizedDepartments
    $Store.sections = $normalizedSections
    $Store.users = $normalizedUsers
    $Store.settings.reviewGradeConfig = $normalizedConfig
    $Store.settings.currentUserId = $currentUser.id

    foreach ($goal in @($Store.goals)) {
        $owner = @($Store.users | Where-Object { $_.id -eq $goal.ownerId })[0]
        if ($null -ne $owner) {
            $goal.departmentId = $owner.departmentId
        }
    }

    return [pscustomobject]@{
        departments = (To-JsonList -Items $Store.departments)
        sections = (To-JsonList -Items $Store.sections)
        users = (To-JsonList -Items $Store.users)
        reviewGradeConfig = $Store.settings.reviewGradeConfig
    }
}

function Ensure-RequiredGoalFields {
    param([object]$Payload)

    foreach ($field in @("name", "type", "departmentId", "ownerId", "cycleId")) {
        if ([string]::IsNullOrWhiteSpace("$($Payload.$field)")) {
            Throw-ApiError -StatusCode 400 -Message "missing required field: $field"
        }
    }
}

function Create-Goal {
    param(
        [object]$Store,
        [object]$Payload
    )

    Ensure-RequiredGoalFields -Payload $Payload

    $currentUser = Get-CurrentUser -Store $Store
    if ($currentUser.role -ne "employee") {
        Throw-ApiError -StatusCode 403 -Message "only employees can create quarterly OKRs"
    }
    if ($Payload.ownerId -ne $currentUser.id) {
        Throw-ApiError -StatusCode 403 -Message "employees can only create their own OKRs"
    }
    if ($Payload.departmentId -ne $currentUser.departmentId) {
        Throw-ApiError -StatusCode 403 -Message "goal department does not match current employee"
    }

    $isDraft = Get-BooleanValue -Value $Payload.saveAsDraft
    $status = if ($isDraft) { "draft" } else { "confirmed" }
    $goalPoints = Get-KrPayloadPointTotal -KrPayloads @($Payload.krs)

    if ($isDraft) {
        Assert-DraftOwnerCycleGoalPointCapForGoal -Store $Store -OwnerId $Payload.ownerId -CycleId $Payload.cycleId -GoalId "" -GoalPoints $goalPoints
    }
    else {
        Assert-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $Payload.ownerId -CycleId $Payload.cycleId -GoalId "" -GoalPoints $goalPoints
    }

    $goal = [pscustomobject]@{
        id = New-Id -Prefix "goal"
        code = Get-NextGoalCode -Store $Store -ParentId $Payload.parentId
        name = $Payload.name
        type = $Payload.type
        departmentId = $Payload.departmentId
        ownerId = $Payload.ownerId
        cycleId = $Payload.cycleId
        parentId = if ([string]::IsNullOrWhiteSpace("$($Payload.parentId)")) { $null } else { $Payload.parentId }
        points = $goalPoints
        status = $status
        isDraft = $isDraft
        description = "$($Payload.description)"
        summary = ""
        manualProgress = 0
        manualScore = $null
        reviewScore = $null
        attitudeScore = $null
        abilityScore = $null
        performanceScore = $null
        reviewLevel = $null
        reviewComment = ""
        reviewerId = $null
        reviewedAt = $null
        submittedAt = $null
        confirmedAt = if ($isDraft) { $null } else { Get-Timestamp }
        pendingSubmissionAt = $null
        pendingReviewAt = $null
        adminEditAuthorized = $false
        adminEditAuthorizedAt = $null
        adminEditAuthorizedBy = $null
        reviewMode = "kr"
        followerIds = @()
        createdAt = Get-Timestamp
        updatedAt = Get-Timestamp
        createdBy = $currentUser.id
    }

    $Store.goals = @($Store.goals) + $goal

    foreach ($krPayload in @($Payload.krs)) {
        if ([string]::IsNullOrWhiteSpace("$($krPayload.name)")) {
            continue
        }

        $kr = [pscustomobject]@{
            id = New-Id -Prefix "kr"
            code = Get-NextKrCode -Store $Store -GoalId $goal.id
            goalId = $goal.id
            name = $krPayload.name
            metricType = if ([string]::IsNullOrWhiteSpace("$($krPayload.metricType)")) { "percentage" } else { $krPayload.metricType }
            targetValue = "$($krPayload.targetValue)"
            currentValue = "$($krPayload.currentValue)"
            progress = if ($null -ne (To-NullableNumber -Value $krPayload.progress)) { To-NullableNumber -Value $krPayload.progress } else { 0 }
            points = To-NullableNumber -Value $krPayload.points
            ownerId = $goal.ownerId
            description = "$($krPayload.description)"
            status = if ($isDraft) { "draft" } else { "active" }
            score = To-NullableNumber -Value $krPayload.score
            createdAt = Get-Timestamp
            updatedAt = Get-Timestamp
        }

        Apply-KrRules -Kr $kr

        $Store.krs = @($Store.krs) + $kr
    }

    Sync-OwnerCycleGoalPoints -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId

    Add-Activity -Store $Store -EntityType "goal" -EntityId $goal.id -Action "create" -Message "Created quarterly OKR: $($goal.name)" -OperatorId $currentUser.id
    return $goal
}

function Update-Goal {
    param(
        [object]$Store,
        [string]$GoalId,
        [object]$Payload
    )

    $goal = Get-GoalById -Store $Store -GoalId $GoalId
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanEditGoal -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot edit this goal"
    }

    if ($null -ne $Payload.name) { $goal.name = $Payload.name }
    if ($null -ne $Payload.type) { $goal.type = $Payload.type }
    if ($null -ne $Payload.description) { $goal.description = "$($Payload.description)" }
    if ($null -ne $Payload.summary) { $goal.summary = "$($Payload.summary)" }
    if ($null -ne $Payload.manualProgress) { $goal.manualProgress = To-NullableNumber -Value $Payload.manualProgress }

    if ($null -ne $Payload.status) {
        if ($Payload.status -notin @("draft", "confirmed")) {
            Throw-ApiError -StatusCode 400 -Message "employees can only save goals as draft or confirmed"
        }
        if ($Payload.status -ne "draft") {
            $proposedGoalPoints = Get-GoalPointsTotal -Store $Store -GoalId $goal.id
            Assert-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId -GoalId $goal.id -GoalPoints $proposedGoalPoints
        }
        $goal.status = $Payload.status
        $goal.isDraft = $Payload.status -eq "draft"
        if ($Payload.status -eq "confirmed") {
            $goal.confirmedAt = Get-Timestamp
        }
    }

    Finalize-GoalEdit -Store $Store -Goal $goal
    Sync-OwnerCycleGoalPoints -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId
    $goal.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "goal" -EntityId $goal.id -Action "update" -Message "Updated goal: $($goal.name)" -OperatorId $Store.settings.currentUserId
    return $goal
}

function Submit-GoalForReview {
    param(
        [object]$Store,
        [string]$GoalId
    )

    $goal = Get-GoalById -Store $Store -GoalId $GoalId
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanSubmitGoalForReview -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot submit this goal for review"
    }

    Assert-OwnerCycleGoalPointTotal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId

    $goal.status = "pending_review"
    if ($null -eq $goal.pendingSubmissionAt) {
        $goal.pendingSubmissionAt = Get-Timestamp
    }
    $goal.pendingReviewAt = Get-Timestamp
    $goal.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "goal" -EntityId $goal.id -Action "submit-review" -Message "Submitted goal for review: $($goal.name)" -OperatorId $Store.settings.currentUserId
    return $goal
}

function Authorize-GoalEdit {
    param(
        [object]$Store,
        [string]$GoalId
    )

    $goal = Get-GoalById -Store $Store -GoalId $GoalId
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanAuthorizeGoalEdit -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot authorize this goal"
    }

    $goal.adminEditAuthorized = $true
    $goal.adminEditAuthorizedAt = Get-Timestamp
    $goal.adminEditAuthorizedBy = $Store.settings.currentUserId
    $goal.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "goal" -EntityId $goal.id -Action "authorize-edit" -Message "Authorized goal edit: $($goal.name)" -OperatorId $Store.settings.currentUserId
    return $goal
}

function Add-KrToGoal {
    param(
        [object]$Store,
        [string]$GoalId,
        [object]$Payload
    )

    $goal = Get-GoalById -Store $Store -GoalId $GoalId
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanEditGoal -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot add KR to this goal"
    }
    if ([string]::IsNullOrWhiteSpace("$($Payload.name)")) {
        Throw-ApiError -StatusCode 400 -Message "KR name is required"
    }

    $newKrPoints = if ($null -ne (To-NullableNumber -Value $Payload.points)) { To-NullableNumber -Value $Payload.points } else { 0 }
    $proposedGoalPoints = [math]::Round((Get-GoalPointsTotal -Store $Store -GoalId $goal.id) + $newKrPoints, 1)
    if ("$($goal.status)" -eq "draft") {
        Assert-DraftOwnerCycleGoalPointCapForGoal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId -GoalId $goal.id -GoalPoints $proposedGoalPoints
    }
    else {
        Assert-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId -GoalId $goal.id -GoalPoints $proposedGoalPoints
    }

    $kr = [pscustomobject]@{
        id = New-Id -Prefix "kr"
        code = Get-NextKrCode -Store $Store -GoalId $GoalId
        goalId = $GoalId
        name = $Payload.name
        metricType = if ([string]::IsNullOrWhiteSpace("$($Payload.metricType)")) { "percentage" } else { $Payload.metricType }
        targetValue = "$($Payload.targetValue)"
        currentValue = "$($Payload.currentValue)"
        progress = if ($null -ne (To-NullableNumber -Value $Payload.progress)) { To-NullableNumber -Value $Payload.progress } else { 0 }
        points = To-NullableNumber -Value $Payload.points
        ownerId = $goal.ownerId
        description = "$($Payload.description)"
        status = if ($goal.status -eq "draft") { "draft" } else { "active" }
        score = To-NullableNumber -Value $Payload.score
        createdAt = Get-Timestamp
        updatedAt = Get-Timestamp
    }

    Apply-KrRules -Kr $kr

    $Store.krs = @($Store.krs) + $kr
    Finalize-GoalEdit -Store $Store -Goal $goal
    Sync-OwnerCycleGoalPoints -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId
    $goal.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "kr" -EntityId $kr.id -Action "create" -Message "Created KR: $($kr.name)" -OperatorId $Store.settings.currentUserId
    return $kr
}

function Update-Kr {
    param(
        [object]$Store,
        [string]$KrId,
        [object]$Payload
    )

    $kr = Get-KrById -Store $Store -KrId $KrId
    if ($null -eq $kr) {
        Throw-ApiError -StatusCode 404 -Message "KR not found"
    }

    $goal = Get-GoalById -Store $Store -GoalId $kr.goalId
    if ($null -eq $goal -or -not (Test-CanEditGoal -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot update this KR"
    }

    foreach ($field in @("name", "metricType", "targetValue", "currentValue", "description", "status")) {
        if ($null -ne $Payload.$field) {
            $kr.$field = $Payload.$field
        }
    }

    $currentGoalPoints = Get-GoalPointsTotal -Store $Store -GoalId $goal.id
    $oldKrPoints = if ($null -ne (To-NullableNumber -Value $kr.points)) { To-NullableNumber -Value $kr.points } else { 0 }
    $newKrPoints = if ($null -ne $Payload.points -and $null -ne (To-NullableNumber -Value $Payload.points)) { To-NullableNumber -Value $Payload.points } else { $oldKrPoints }
    $proposedGoalPoints = [math]::Round($currentGoalPoints - $oldKrPoints + $newKrPoints, 1)
    if ("$($goal.status)" -eq "draft") {
        Assert-DraftOwnerCycleGoalPointCapForGoal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId -GoalId $goal.id -GoalPoints $proposedGoalPoints
    }
    else {
        Assert-OwnerCycleGoalPointTotalForGoal -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId -GoalId $goal.id -GoalPoints $proposedGoalPoints
    }

    if ($null -ne $Payload.points) { $kr.points = To-NullableNumber -Value $Payload.points }
    if ($null -ne $Payload.progress) { $kr.progress = To-NullableNumber -Value $Payload.progress }
    if ($null -ne $Payload.score) { $kr.score = To-NullableNumber -Value $Payload.score }
    Apply-KrRules -Kr $kr

    Finalize-GoalEdit -Store $Store -Goal $goal
    Sync-OwnerCycleGoalPoints -Store $Store -OwnerId $goal.ownerId -CycleId $goal.cycleId
    $goal.updatedAt = Get-Timestamp
    $kr.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "kr" -EntityId $kr.id -Action "update" -Message "Updated KR: $($kr.name)" -OperatorId $Store.settings.currentUserId
    return $kr
}

function Score-Kr {
    param(
        [object]$Store,
        [string]$KrId,
        [object]$Payload
    )

    $kr = Get-KrById -Store $Store -KrId $KrId
    if ($null -eq $kr) {
        Throw-ApiError -StatusCode 404 -Message "KR not found"
    }

    $goal = Get-GoalById -Store $Store -GoalId $kr.goalId
    if ($null -eq $goal -or -not (Test-CanScoreKr -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot score this KR"
    }

    if ($null -eq $Payload.PSObject.Properties["score"]) {
        Throw-ApiError -StatusCode 400 -Message "score is required"
    }

    $score = To-NullableNumber -Value $Payload.score
    if ($null -ne $score -and ($score -lt 0 -or $score -gt 100)) {
        Throw-ApiError -StatusCode 400 -Message "score must be between 0 and 100"
    }

    if ($null -ne $Payload.PSObject.Properties["reviewComment"]) {
        $kr.reviewComment = "$($Payload.reviewComment)".Trim()
    }

    $kr.score = $score
    $timestamp = Get-Timestamp
    if ($null -eq $score) {
        $kr.reviewerId = $null
        $kr.reviewedAt = $null
    }
    else {
        $kr.reviewerId = $Store.settings.currentUserId
        $kr.reviewedAt = $timestamp
    }

    $kr.updatedAt = $timestamp
    $goal.reviewMode = "kr"
    if ("$($goal.status)" -eq "pending_submission") {
        $goal.status = "pending_review"
        if ($null -eq $goal.pendingReviewAt) {
            $goal.pendingReviewAt = $timestamp
        }
    }
    elseif ($null -eq $goal.pendingReviewAt) {
        $goal.pendingReviewAt = $timestamp
    }

    Sync-GoalReviewFromKrScores -Store $Store -Goal $goal
    $goal.updatedAt = $timestamp

    $action = if ($null -eq $score) { "clear-score" } else { "score" }
    $message = if ($null -eq $score) {
        "Cleared KR score: $($kr.name)"
    }
    else {
        "Scored KR: $($kr.name)"
    }

    Add-Activity -Store $Store -EntityType "kr" -EntityId $kr.id -Action $action -Message $message -OperatorId $Store.settings.currentUserId
    return $kr
}

function Update-KrCompletion {
    param(
        [object]$Store,
        [string]$KrId,
        [object]$Payload
    )

    $kr = Get-KrById -Store $Store -KrId $KrId
    if ($null -eq $kr) {
        Throw-ApiError -StatusCode 404 -Message "KR not found"
    }

    $goal = Get-GoalById -Store $Store -GoalId $kr.goalId
    if ($null -eq $goal -or -not (Test-CanConfirmKrCompletion -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot confirm completion for this KR"
    }

    $completionState = "$($Payload.completionState)".Trim().ToLowerInvariant()
    if ($completionState -notin @("pending", "done")) {
        Throw-ApiError -StatusCode 400 -Message "completionState must be pending or done"
    }

    $kr.progress = if ($completionState -eq "done") { 100 } else { 0 }
    $kr.status = if ($completionState -eq "done") { "completed" } else { "active" }
    $kr.targetValue = "Complete"
    $kr.currentValue = if ($completionState -eq "done") { "Done" } else { "Pending" }
    $kr.workflowStatus = $goal.status
    Apply-KrRules -Kr $kr

    $timestamp = Get-Timestamp
    $kr.updatedAt = $timestamp
    $goal.updatedAt = $timestamp
    Add-Activity -Store $Store -EntityType "kr" -EntityId $kr.id -Action "completion" -Message "Updated KR completion: $($kr.name)" -OperatorId $Store.settings.currentUserId
    return $kr
}

function Add-ProofToGoal {
    param(
        [object]$Store,
        [string]$GoalId,
        [object]$Payload
    )

    Throw-ApiError -StatusCode 400 -Message "goal level proof upload is disabled; upload proof on a KR instead"
}

function New-KrProofUploadTarget {
    param(
        [object]$Goal,
        [string]$FileName
    )

    $safeName = Get-SafeFileName -FileName $FileName
    $goalFolder = Join-Path $uploadRoot $Goal.id
    if (-not (Test-Path $goalFolder)) {
        New-Item -ItemType Directory -Path $goalFolder | Out-Null
    }

    $storedName = "{0}-{1}" -f ([guid]::NewGuid().ToString("N").Substring(0, 8)), $safeName
    $absolutePath = Join-Path $goalFolder $storedName

    return [pscustomobject]@{
        safeName = $safeName
        storedName = $storedName
        absolutePath = $absolutePath
    }
}

function Register-KrProofUpload {
    param(
        [object]$Store,
        [object]$Goal,
        [object]$Kr,
        [string]$SafeName,
        [string]$StoredName,
        [string]$MimeType,
        [string]$Note,
        [long]$SizeBytes
    )

    $proof = [pscustomobject]@{
        id = New-Id -Prefix "proof"
        goalId = $Goal.id
        krId = $Kr.id
        fileName = $SafeName
        storedName = $StoredName
        mimeType = $MimeType
        note = $Note
        uploadedBy = $Store.settings.currentUserId
        uploadedAt = Get-Timestamp
        sizeBytes = $SizeBytes
        url = "/uploads/$($Goal.id)/$StoredName"
    }

    $Store.proofs = @($Store.proofs) + $proof
    $Goal.updatedAt = Get-Timestamp
    $Kr.updatedAt = Get-Timestamp
    Add-Activity -Store $Store -EntityType "kr" -EntityId $Kr.id -Action "proof" -Message "Uploaded KR proof: $($proof.fileName)" -OperatorId $Store.settings.currentUserId
    return $proof
}

function Add-ProofToKr {
    param(
        [object]$Store,
        [string]$KrId,
        [object]$Payload
    )

    $kr = Get-KrById -Store $Store -KrId $KrId
    if ($null -eq $kr) {
        Throw-ApiError -StatusCode 404 -Message "KR not found"
    }

    $goal = Get-KrGoal -Store $Store -Kr $kr
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanUploadKrProof -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot upload proof for this KR"
    }
    if ([string]::IsNullOrWhiteSpace("$($Payload.fileName)") -or [string]::IsNullOrWhiteSpace("$($Payload.fileBase64)")) {
        Throw-ApiError -StatusCode 400 -Message "fileName and fileBase64 are required"
    }

    $rawBase64 = "$($Payload.fileBase64)"
    $mimeType = if ([string]::IsNullOrWhiteSpace("$($Payload.mimeType)")) { "application/octet-stream" } else { "$($Payload.mimeType)" }
    if ($rawBase64 -match '^data:(?<mime>.*?);base64,(?<data>.+)$') {
        $mimeType = $Matches.mime
        $rawBase64 = $Matches.data
    }

    $bytes = [System.Convert]::FromBase64String($rawBase64)
    $target = New-KrProofUploadTarget -Goal $goal -FileName "$($Payload.fileName)"
    $absolutePath = $target.absolutePath
    [System.IO.File]::WriteAllBytes($absolutePath, $bytes)

    return Register-KrProofUpload -Store $Store -Goal $goal -Kr $kr -SafeName $target.safeName -StoredName $target.storedName -MimeType $mimeType -Note "$($Payload.note)" -SizeBytes $bytes.Length
}

function Add-ProofToKrStream {
    param(
        [object]$Store,
        [string]$KrId,
        [System.Net.HttpListenerRequest]$Request
    )

    $kr = Get-KrById -Store $Store -KrId $KrId
    if ($null -eq $kr) {
        Throw-ApiError -StatusCode 404 -Message "KR not found"
    }

    $goal = Get-KrGoal -Store $Store -Kr $kr
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanUploadKrProof -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot upload proof for this KR"
    }

    $fileName = Decode-RequestHeaderValue -Value $Request.Headers["X-Upload-File-Name"]
    if ([string]::IsNullOrWhiteSpace($fileName)) {
        Throw-ApiError -StatusCode 400 -Message "X-Upload-File-Name header is required"
    }

    $note = Decode-RequestHeaderValue -Value $Request.Headers["X-Upload-Note"]
    $mimeType = if ([string]::IsNullOrWhiteSpace("$($Request.ContentType)")) { "application/octet-stream" } else { "$($Request.ContentType)" }
    $target = New-KrProofUploadTarget -Goal $goal -FileName $fileName
    $absolutePath = $target.absolutePath
    $bytesWritten = 0L
    $buffer = New-Object byte[] 65536
    $fileStream = [System.IO.File]::Open($absolutePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)

    try {
        while (($read = $Request.InputStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $fileStream.Write($buffer, 0, $read)
            $bytesWritten += $read
        }
    }
    catch {
        if (Test-Path $absolutePath) {
            Remove-Item -LiteralPath $absolutePath -Force -ErrorAction SilentlyContinue
        }
        throw
    }
    finally {
        $fileStream.Dispose()
    }

    return Register-KrProofUpload -Store $Store -Goal $goal -Kr $kr -SafeName $target.safeName -StoredName $target.storedName -MimeType $mimeType -Note $note -SizeBytes $bytesWritten
}

function Delete-Proof {
    param(
        [object]$Store,
        [string]$ProofId
    )

    $proof = Get-ProofById -Store $Store -ProofId $ProofId
    if ($null -eq $proof) {
        Throw-ApiError -StatusCode 404 -Message "proof not found"
    }
    if (-not (Test-CanDeleteProof -Store $Store -Proof $proof)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot delete this proof"
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $uploadRoot (Join-Path $proof.goalId $proof.storedName)))
    if ($fullPath.StartsWith($uploadRootResolved, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $fullPath)) {
        Remove-Item -LiteralPath $fullPath -Force
    }

    $Store.proofs = @($Store.proofs | Where-Object { $_.id -ne $ProofId })
    $entityType = if (-not [string]::IsNullOrWhiteSpace("$($proof.krId)")) { "kr" } else { "goal" }
    $entityId = if (-not [string]::IsNullOrWhiteSpace("$($proof.krId)")) { $proof.krId } else { $proof.goalId }
    Add-Activity -Store $Store -EntityType $entityType -EntityId $entityId -Action "proof-delete" -Message "Deleted proof: $($proof.fileName)" -OperatorId $Store.settings.currentUserId
    return $proof
}

function Review-Goal {
    param(
        [object]$Store,
        [string]$GoalId,
        [object]$Payload
    )

    $goal = Get-GoalById -Store $Store -GoalId $GoalId
    if ($null -eq $goal) {
        Throw-ApiError -StatusCode 404 -Message "goal not found"
    }
    if (-not (Test-CanReviewGoal -Store $Store -Goal $goal)) {
        Throw-ApiError -StatusCode 403 -Message "current user cannot review this goal"
    }

    $template = Get-ReviewTemplate -Store $Store
    $attitude = To-NullableNumber -Value $Payload.attitudeScore
    $ability = To-NullableNumber -Value $Payload.abilityScore
    $performance = To-NullableNumber -Value $Payload.performanceScore

    if ($null -eq $attitude -or $null -eq $ability -or $null -eq $performance) {
        Throw-ApiError -StatusCode 400 -Message "all review score dimensions are required"
    }
    if ($attitude -lt 0 -or $attitude -gt $template.attitudeMax) {
        Throw-ApiError -StatusCode 400 -Message "attitude score is out of range"
    }
    if ($ability -lt 0 -or $ability -gt $template.abilityMax) {
        Throw-ApiError -StatusCode 400 -Message "ability score is out of range"
    }
    if ($performance -lt 0 -or $performance -gt $template.performanceMax) {
        Throw-ApiError -StatusCode 400 -Message "performance score is out of range"
    }

    $total = [math]::Round($attitude + $ability + $performance, 1)
    $level = if ([string]::IsNullOrWhiteSpace("$($Payload.reviewLevel)")) { Get-ReviewLevel -Score $total } else { "$($Payload.reviewLevel)" }
    if ($level -notin @("A", "B", "C", "D", "E")) {
        Throw-ApiError -StatusCode 400 -Message "review level is invalid"
    }

    $goal.attitudeScore = $attitude
    $goal.abilityScore = $ability
    $goal.performanceScore = $performance
    $goal.reviewScore = $total
    $goal.reviewMode = "goal"
    $goal.reviewLevel = $level
    $goal.reviewComment = "$($Payload.reviewComment)"
    $goal.reviewerId = $Store.settings.currentUserId
    $goal.reviewedAt = Get-Timestamp
    $goal.status = "reviewed"
    $goal.isDraft = $false
    if ($null -eq $goal.submittedAt) {
        $goal.submittedAt = Get-Timestamp
    }
    $goal.updatedAt = Get-Timestamp

    Add-Activity -Store $Store -EntityType "goal" -EntityId $goal.id -Action "review" -Message "Reviewed goal: $($goal.name)" -OperatorId $Store.settings.currentUserId
    return $goal
}

function Get-ContentType {
    param([string]$Path)

    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { return "text/html; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".json" { return "application/json; charset=utf-8" }
        ".svg"  { return "image/svg+xml" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".gif"  { return "image/gif" }
        ".webp" { return "image/webp" }
        ".txt"  { return "text/plain; charset=utf-8" }
        ".pdf"  { return "application/pdf" }
        ".doc"  { return "application/msword" }
        ".docx" { return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
        ".xls"  { return "application/vnd.ms-excel" }
        ".xlsx" { return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
        default { return "application/octet-stream" }
    }
}

function Serve-StaticFile {
    param(
        [System.Net.HttpListenerRequest]$Request,
        [System.Net.HttpListenerResponse]$Response
    )

    $relativePath = $Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = "index.html"
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $publicRoot $relativePath))
    if (-not $fullPath.StartsWith($publicRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Response $Response -Body "Forbidden" -StatusCode 403
        return
    }
    if (-not (Test-Path $fullPath)) {
        Send-Text -Response $Response -Body "Not Found" -StatusCode 404
        return
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $Response.StatusCode = 200
    $Response.ContentType = Get-ContentType -Path $fullPath
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Serve-UploadFile {
    param(
        [System.Net.HttpListenerRequest]$Request,
        [System.Net.HttpListenerResponse]$Response
    )

    $relativePath = $Request.Url.AbsolutePath.Substring("/uploads/".Length)
    $segments = @($relativePath.Split('/')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($segments.Count -lt 2) {
        Send-Text -Response $Response -Body "Not Found" -StatusCode 404
        return
    }

    $goalId = Decode-RequestHeaderValue -Value $segments[0]
    $storedName = Decode-RequestHeaderValue -Value $segments[1]
    $store = Read-Store
    $proof = Get-ProofByStoredPath -Store $store -GoalId $goalId -StoredName $storedName
    if ($null -eq $proof) {
        Send-Text -Response $Response -Body "Not Found" -StatusCode 404
        return
    }

    $goal = Get-GoalById -Store $store -GoalId $goalId
    if ($null -eq $goal -or -not (Test-CanViewGoal -Store $store -Goal $goal)) {
        Send-Text -Response $Response -Body "Forbidden" -StatusCode 403
        return
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $uploadRoot (Join-Path $goalId $storedName)))
    if (-not $fullPath.StartsWith($uploadRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Text -Response $Response -Body "Forbidden" -StatusCode 403
        return
    }
    if (-not (Test-Path $fullPath)) {
        Send-Text -Response $Response -Body "Not Found" -StatusCode 404
        return
    }

    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $Response.StatusCode = 200
    $Response.ContentType = Get-ContentType -Path $fullPath
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Handle-ApiRequest {
    param(
        [System.Net.HttpListenerRequest]$Request,
        [System.Net.HttpListenerResponse]$Response
    )

    $path = $Request.Url.AbsolutePath.Trim('/')
    $segments = @($path.Split('/')) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $method = $Request.HttpMethod.ToUpperInvariant()

    if ($segments.Count -lt 2) {
        Send-Json -Response $Response -Body @{ error = "invalid API path" } -StatusCode 404
        return
    }

    $store = Read-Store

    if ($segments[1] -eq "health" -and $method -eq "GET") {
        Send-Json -Response $Response -Body @{ ok = $true; port = $Port; timestamp = Get-Timestamp }
        return
    }

    if ($segments[1] -eq "bootstrap" -and $method -eq "GET") {
        Send-Json -Response $Response -Body (Build-BootstrapPayload -Store $store)
        return
    }

    if ($segments[1] -eq "session" -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $session = Update-Session -Store $store -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; session = $session; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "review-grade-config" -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $config = Update-ReviewGradeConfig -Store $store -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; reviewGradeConfig = $config; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "admin-config" -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $config = Update-AdminConfig -Store $store -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; adminConfig = $config; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 2 -and $method -eq "POST") {
        $payload = Get-RequestBody -Request $Request
        $goal = Create-Goal -Store $store -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; goal = $goal; store = (Build-BootstrapPayload -Store $store) } -StatusCode 201
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 3 -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $goal = Update-Goal -Store $store -GoalId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; goal = $goal; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 4 -and $segments[3] -eq "krs" -and $method -eq "POST") {
        $payload = Get-RequestBody -Request $Request
        $kr = Add-KrToGoal -Store $store -GoalId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; kr = $kr; store = (Build-BootstrapPayload -Store $store) } -StatusCode 201
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 4 -and $segments[3] -eq "proofs" -and $method -eq "POST") {
        $payload = Get-RequestBody -Request $Request
        $proof = Add-ProofToGoal -Store $store -GoalId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; proof = $proof; store = (Build-BootstrapPayload -Store $store) } -StatusCode 201
        return
    }

    if ($segments[1] -eq "krs" -and $segments.Count -eq 4 -and $segments[3] -eq "proofs" -and $method -eq "POST") {
        if ("$($Request.ContentType)" -like "application/json*") {
            $payload = Get-RequestBody -Request $Request
            $proof = Add-ProofToKr -Store $store -KrId $segments[2] -Payload $payload
        }
        else {
            $proof = Add-ProofToKrStream -Store $store -KrId $segments[2] -Request $Request
        }
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; proof = $proof; store = (Build-BootstrapPayload -Store $store) } -StatusCode 201
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 4 -and $segments[3] -eq "review" -and $method -eq "POST") {
        $payload = Get-RequestBody -Request $Request
        $goal = Review-Goal -Store $store -GoalId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; goal = $goal; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 4 -and $segments[3] -eq "submit-review" -and $method -eq "POST") {
        $goal = Submit-GoalForReview -Store $store -GoalId $segments[2]
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; goal = $goal; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "goals" -and $segments.Count -eq 4 -and $segments[3] -eq "authorize-edit" -and $method -eq "POST") {
        $goal = Authorize-GoalEdit -Store $store -GoalId $segments[2]
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; goal = $goal; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "krs" -and $segments.Count -eq 3 -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $kr = Update-Kr -Store $store -KrId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; kr = $kr; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "krs" -and $segments.Count -eq 4 -and $segments[3] -eq "score" -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $kr = Score-Kr -Store $store -KrId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; kr = $kr; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "krs" -and $segments.Count -eq 4 -and $segments[3] -eq "completion" -and $method -eq "PUT") {
        $payload = Get-RequestBody -Request $Request
        $kr = Update-KrCompletion -Store $store -KrId $segments[2] -Payload $payload
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; kr = $kr; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    if ($segments[1] -eq "proofs" -and $segments.Count -eq 3 -and $method -eq "DELETE") {
        $proof = Delete-Proof -Store $store -ProofId $segments[2]
        Write-Store -Store $store
        Send-Json -Response $Response -Body @{ ok = $true; proof = $proof; store = (Build-BootstrapPayload -Store $store) }
        return
    }

    Send-Json -Response $Response -Body @{ error = "route not implemented"; method = $method; path = $Request.Url.AbsolutePath } -StatusCode 404
}

if (-not (Test-Path $seedPath)) {
    throw "seed data file not found: $seedPath"
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "OKR MVP started: $prefix"
Write-Host "Public root: $publicRoot"
Write-Host "Store file: $storePath"
Write-Host "Press Ctrl+C to stop."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if ($context.Request.Url.AbsolutePath.StartsWith('/api/', [System.StringComparison]::OrdinalIgnoreCase)) {
                Handle-ApiRequest -Request $context.Request -Response $context.Response
            }
            elseif ($context.Request.Url.AbsolutePath.StartsWith('/uploads/', [System.StringComparison]::OrdinalIgnoreCase)) {
                Serve-UploadFile -Request $context.Request -Response $context.Response
            }
            else {
                Serve-StaticFile -Request $context.Request -Response $context.Response
            }
        }
        catch {
            $message = $_.Exception.Message
            $statusCode = 500
            if ($message -match '^(\d{3})\|(.*)$') {
                $statusCode = [int]$Matches[1]
                $message = $Matches[2]
            }

            if ($context.Response -and $context.Response.OutputStream.CanWrite) {
                Send-Json -Response $context.Response -Body @{ error = $message } -StatusCode $statusCode
            }
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
