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
        $params.Body = ($Body | ConvertTo-Json -Depth 20)
    }

    try {
        return Invoke-RestMethod @params
    }
    catch {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            throw
        }

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

    $null = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-emp1" }
    $before = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $beforeGoal = @($before.goals | Where-Object { $_.id -eq "goal-emp1-draft" })[0]
    $beforeKrCount = @($before.krs | Where-Object { $_.goalId -eq "goal-emp1-draft" }).Count

    if ($null -eq $beforeGoal) {
        throw "Draft goal goal-emp1-draft not found."
    }

    $response = Invoke-ApiJson -Method "POST" -Path "/api/goals/goal-emp1-draft/krs" -Body @{
        name        = "Regression draft KR over limit"
        metricType  = "milestone"
        progress    = 0
        points      = 10
        description = "Should be rejected when owner total exceeds 100."
    }

    $after = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterKrCount = @($after.krs | Where-Object { $_.goalId -eq "goal-emp1-draft" }).Count

    if (-not $response.__error) {
        throw "Expected KR creation to be rejected, but API returned success."
    }

    if ($response.status -ne 400) {
        throw "Expected HTTP 400, got $($response.status)."
    }

    if ($afterKrCount -ne $beforeKrCount) {
        throw "KR count changed from $beforeKrCount to $afterKrCount even though the request failed."
    }

    Write-Host "PASS: invalid draft KR was rejected without mutating store."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
