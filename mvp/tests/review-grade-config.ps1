$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$baseUri = "http://localhost:5057"

function Invoke-ApiJson {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )

    $params = @{
        Method      = $Method
        Uri         = "$baseUri$Path"
        ContentType = "application/json"
    }

    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 20
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
        $params.ContentType = "application/json; charset=utf-8"
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) { throw }

        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
        $reader.Dispose()
        $stream.Dispose()

        $payload = $null
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            try {
                $payload = $raw | ConvertFrom-Json
            }
            catch {
                $payload = [pscustomobject]@{ error = $raw }
            }
        }

        return [pscustomobject]@{
            __error = $true
            status  = [int]$response.StatusCode
            body    = $payload
        }
    }
}

Copy-Item -LiteralPath $storePath -Destination $backupPath -Force

try {
    $health = Invoke-ApiJson -Method "GET" -Path "/api/health"
    if ($health.ok -ne $true) {
        throw "Server is not healthy."
    }

    $groupInfo = [regex]::Unescape('\u4fe1\u606f\u5316\u7ec4')
    $groupOps = [regex]::Unescape('\u8fd0\u8425\u7ec4')
    $groupGeneral = [regex]::Unescape('\u7efc\u5408\u7ec4')

    $switchAdmin = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-dept1" }
    if ($switchAdmin.ok -ne $true) {
        throw "Expected switch to system admin account to succeed."
    }

    $payload = [pscustomobject]@{
        departments = @(
            [pscustomobject]@{ id = "dept-iot"; name = "IoT Center" },
            [pscustomobject]@{ id = "dept-rnd"; name = "R&D Management" }
        )
        sections = @(
            [pscustomobject]@{ id = "sec-platform"; departmentId = "dept-iot"; name = "Platform" ; reviewGroup = $groupInfo },
            [pscustomobject]@{ id = "sec-solution"; departmentId = "dept-iot"; name = "Solutions"; reviewGroup = $groupOps },
            [pscustomobject]@{ id = "sec-rnd"; departmentId = "dept-rnd"; name = "DevOps"; reviewGroup = $groupGeneral }
        )
        users = @(
            [pscustomobject]@{ id = "u-emp1"; name = "Alice"; departmentId = "dept-iot"; sectionId = "sec-platform"; role = "employee"; reviewGroup = $groupInfo },
            [pscustomobject]@{ id = "u-emp2"; name = "Bob"; departmentId = "dept-iot"; sectionId = "sec-platform"; role = "employee"; reviewGroup = $groupInfo },
            [pscustomobject]@{ id = "u-emp3"; name = "Cindy"; departmentId = "dept-iot"; sectionId = "sec-solution"; role = "employee"; reviewGroup = $groupOps },
            [pscustomobject]@{ id = "u-emp4"; name = "Dylan"; departmentId = "dept-rnd"; sectionId = "sec-rnd"; role = "employee"; reviewGroup = $groupGeneral },
            [pscustomobject]@{ id = "u-sec1"; name = "Leader A"; departmentId = "dept-iot"; sectionId = "sec-platform"; role = "section-leader"; reviewGroup = $groupInfo },
            [pscustomobject]@{ id = "u-sec2"; name = "Leader B"; departmentId = "dept-iot"; sectionId = "sec-solution"; role = "section-leader"; reviewGroup = $groupOps },
            [pscustomobject]@{ id = "u-group1"; name = "Group Lead"; departmentId = "dept-iot"; sectionId = ""; role = "group-leader"; reviewGroup = $groupInfo },
            [pscustomobject]@{ id = "u-dept1"; name = "System Admin"; departmentId = "dept-iot"; sectionId = ""; role = "system-admin"; reviewGroup = $groupGeneral }
        )
        reviewGradeConfig = [pscustomobject]@{
            groups = @(
                [pscustomobject]@{ group = $groupInfo; seats = [pscustomobject]@{ "A+" = 1; "A" = 0; "B+" = 1; "B" = 0; "C" = 0 } },
                [pscustomobject]@{ group = $groupOps; seats = [pscustomobject]@{ "A+" = 1; "A" = 0; "B+" = 0; "B" = 0; "C" = 0 } },
                [pscustomobject]@{ group = $groupGeneral; seats = [pscustomobject]@{ "A+" = 0; "A" = 1; "B+" = 0; "B" = 0; "C" = 0 } }
            )
        }
    }

    $saved = Invoke-ApiJson -Method "PUT" -Path "/api/admin-config" -Body $payload
    if ($saved.ok -ne $true) {
        throw "Expected system admin to save admin config."
    }

    $bootstrap = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    if (@($bootstrap.departments).Count -lt 2) {
        throw "Expected admin bootstrap to include all configured departments."
    }

    if (-not (@($bootstrap.sections) | Where-Object { $_.id -eq "sec-rnd" })) {
        throw "Expected new section sec-rnd to persist."
    }

    if (-not (@($bootstrap.users) | Where-Object { $_.id -eq "u-group1" -and $_.role -eq "group-leader" })) {
        throw "Expected group leader user binding to persist."
    }

    $infoAPlus = $bootstrap.settings.reviewGradeConfig.groups.PSObject.Properties[$groupInfo].Value.PSObject.Properties["A+"].Value
    if ([int]$infoAPlus -ne 1) {
        throw "Expected info-group A+ fixed seat to persist as 1, got $infoAPlus."
    }

    $invalidPayload = $payload | ConvertTo-Json -Depth 20 | ConvertFrom-Json
    ($invalidPayload.reviewGradeConfig.groups | Where-Object { $_.group -eq $groupInfo } | Select-Object -First 1).seats.A = 2
    $invalid = Invoke-ApiJson -Method "PUT" -Path "/api/admin-config" -Body $invalidPayload
    if (-not $invalid.__error) {
        throw "Expected invalid fixed seat config to be rejected."
    }

    if ($invalid.status -ne 400) {
        throw "Expected invalid admin config rejection status 400, got $($invalid.status)."
    }

    $switchLeader = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-sec1" }
    if ($switchLeader.ok -ne $true) {
        throw "Expected switch to section leader to succeed."
    }

    $forbidden = Invoke-ApiJson -Method "PUT" -Path "/api/admin-config" -Body $payload
    if (-not $forbidden.__error) {
        throw "Expected section leader admin config write to be rejected."
    }

    if ($forbidden.status -ne 403) {
        throw "Expected admin config rejection status 403, got $($forbidden.status)."
    }

    Write-Host "PASS: admin config persisted for system admin, enforced fixed seat limits, and rejected non-admin writes."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
