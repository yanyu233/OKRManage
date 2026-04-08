$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$baseUri = "http://localhost:5057"

function Invoke-CurlJson {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )

    $tempBodyPath = $null
    try {
        $arguments = @(
            "-s",
            "-X", $Method,
            "$baseUri$Path",
            "-H", "Content-Type: application/json; charset=utf-8",
            "-w", "`nSTATUS:%{http_code}"
        )

        if ($null -ne $Body) {
            $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 }
            $tempBodyPath = Join-Path $env:TEMP ("okr-body-{0}.json" -f ([guid]::NewGuid().ToString("N")))
            [System.IO.File]::WriteAllText($tempBodyPath, $json, (New-Object System.Text.UTF8Encoding($false)))
            $arguments += @("--data-binary", "@$tempBodyPath")
        }

        $raw = & curl.exe @arguments
        $rawText = (($raw | Out-String) -replace "`r", "").TrimEnd()
        $lines = @($rawText -split "`n")
        $statusLine = $lines[-1]
        $bodyText = ($lines[0..($lines.Length - 2)] -join "`n").Trim()
        $status = [int](($statusLine -replace '^STATUS:', '').Trim())

        $payload = $null
        if (-not [string]::IsNullOrWhiteSpace($bodyText)) {
            $payload = $bodyText | ConvertFrom-Json
        }

        if ($status -ge 400) {
            return [pscustomobject]@{
                __error = $true
                status  = $status
                body    = $payload
            }
        }

        return $payload
    }
    finally {
        if ($tempBodyPath -and (Test-Path $tempBodyPath)) {
            Remove-Item -LiteralPath $tempBodyPath -Force
        }
    }
}

Copy-Item -LiteralPath $storePath -Destination $backupPath -Force

try {
    $health = Invoke-CurlJson -Method "GET" -Path "/api/health"
    if ($health.ok -ne $true) {
        throw "Server is not healthy."
    }

    $groupDelivery = [regex]::Unescape('\u4ea4\u4ed8\u7ec4')
    $groupSupport = [regex]::Unescape('\u652f\u6491\u7ec4')
    $departmentName = [regex]::Unescape('\u5de5\u4e1a\u4e92\u8054\u7f51\u4e2d\u5fc3')
    $sectionPlatform = [regex]::Unescape('\u5e73\u53f0\u4ea7\u54c1\u79d1')
    $sectionSolution = [regex]::Unescape('\u89e3\u51b3\u65b9\u6848\u79d1')
    $userEmp1 = [regex]::Unescape('\u5f20\u6668')
    $userEmp2 = [regex]::Unescape('\u738b\u654f')
    $userEmp3 = [regex]::Unescape('\u674e\u6d9b')
    $userLead1 = [regex]::Unescape('\u5218\u79d1\u957f')
    $userLead2 = [regex]::Unescape('\u9648\u79d1\u957f')
    $userAdmin = [regex]::Unescape('\u4e25\u4e3b\u4efb')

    $switchAdmin = Invoke-CurlJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-dept1" }
    if ($switchAdmin.ok -ne $true) {
        throw "Expected switch to system admin account to succeed."
    }

    $payload = @"
{
  "departments": [
    { "id": "dept-iot", "name": "$departmentName" }
  ],
  "sections": [
    { "id": "sec-platform", "departmentId": "dept-iot", "name": "$sectionPlatform", "reviewGroup": "$groupDelivery" },
    { "id": "sec-solution", "departmentId": "dept-iot", "name": "$sectionSolution", "reviewGroup": "$groupSupport" }
  ],
  "users": [
    { "id": "u-emp1", "name": "$userEmp1", "departmentId": "dept-iot", "sectionId": "sec-platform", "role": "employee", "reviewGroup": "$groupDelivery" },
    { "id": "u-emp2", "name": "$userEmp2", "departmentId": "dept-iot", "sectionId": "sec-platform", "role": "employee", "reviewGroup": "$groupDelivery" },
    { "id": "u-emp3", "name": "$userEmp3", "departmentId": "dept-iot", "sectionId": "sec-solution", "role": "employee", "reviewGroup": "$groupSupport" },
    { "id": "u-sec1", "name": "$userLead1", "departmentId": "dept-iot", "sectionId": "sec-platform", "role": "section-leader", "reviewGroup": "$groupDelivery" },
    { "id": "u-sec2", "name": "$userLead2", "departmentId": "dept-iot", "sectionId": "sec-solution", "role": "section-leader", "reviewGroup": "$groupSupport" },
    { "id": "u-dept1", "name": "$userAdmin", "departmentId": "dept-iot", "sectionId": "", "role": "system-admin", "reviewGroup": "$groupSupport" }
  ],
  "reviewGradeConfig": {
    "groups": {
      "$groupDelivery": { "A+": 1, "A": 1, "B+": 0, "B": 0, "C": 0 },
      "$groupSupport": { "A+": 1, "A": 0, "B+": 0, "B": 0, "C": 0 }
    }
  }
}
"@

    $saved = Invoke-CurlJson -Method "PUT" -Path "/api/admin-config" -Body $payload
    if ($saved.ok -ne $true) {
        throw ("Expected system admin to save custom review groups. Actual: " + (($saved | ConvertTo-Json -Depth 10 -Compress)))
    }

    $bootstrap = Invoke-CurlJson -Method "GET" -Path "/api/bootstrap"
    $groupNames = @($bootstrap.settings.reviewGradeConfig.groups.PSObject.Properties.Name)
    if (@($groupNames).Count -ne 2 -or $groupNames -notcontains $groupDelivery -or $groupNames -notcontains $groupSupport) {
        throw "Expected bootstrap to return custom review groups only."
    }

    $section = @($bootstrap.sections | Where-Object { $_.id -eq "sec-platform" })[0]
    if ($null -eq $section -or $section.reviewGroup -ne $groupDelivery) {
        throw "Expected section review group to persist as custom group."
    }

    $user = @($bootstrap.users | Where-Object { $_.id -eq "u-emp3" })[0]
    if ($null -eq $user -or $user.reviewGroup -ne $groupSupport) {
        throw "Expected employee review group to persist as custom group."
    }

    $invalidPayload = $payload | ConvertFrom-Json
    $invalidPayload.reviewGradeConfig.groups.$groupDelivery.A = 2
    $invalid = Invoke-CurlJson -Method "PUT" -Path "/api/admin-config" -Body $invalidPayload
    if (-not $invalid.__error) {
        throw "Expected invalid custom review group seat config to be rejected."
    }

    if ($invalid.status -ne 400) {
        throw "Expected invalid custom review group rejection status 400, got $($invalid.status)."
    }

    Write-Host "PASS: custom review groups persisted and seat limits were enforced."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
    Invoke-CurlJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-emp1" } | Out-Null
}
