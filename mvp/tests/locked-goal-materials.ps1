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
    $beforeProofCount = @($before.proofs | Where-Object { $_.krId -eq "kr-emp1-1" }).Count

    $editAttempt = Invoke-ApiJson -Method "PUT" -Path "/api/goals/goal-emp1-q1" -Body @{
        name = "Should stay locked"
    }

    if (-not $editAttempt.__error) {
        throw "Expected locked goal edit to be rejected, but API returned success."
    }

    if ($editAttempt.status -ne 403) {
        throw "Expected locked goal edit to return 403, got $($editAttempt.status)."
    }

    $uploadResponse = Invoke-ApiJson -Method "POST" -Path "/api/krs/kr-emp1-1/proofs" -Body @{
        fileName   = "locked-goal-proof.txt"
        mimeType   = "text/plain"
        fileBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("locked goal proof"))
        note       = "Locked goal can still upload KR proof."
    }

    if ($uploadResponse.ok -ne $true) {
        throw "Expected proof upload on locked goal to succeed."
    }

    $after = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterProofCount = @($after.proofs | Where-Object { $_.krId -eq "kr-emp1-1" }).Count

    if ($afterProofCount -ne ($beforeProofCount + 1)) {
        throw "Expected KR proof count to increase from $beforeProofCount to $($beforeProofCount + 1), got $afterProofCount."
    }

    Write-Host "PASS: locked goal rejected edits but still accepted KR proof uploads."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
