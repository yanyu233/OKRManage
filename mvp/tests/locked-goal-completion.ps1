$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$baseUri = "http://localhost:5057"
$userId = "u-emp3"
$goalId = "goal-emp3-q1"
$krId = "kr-emp3-1"

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

    $sessionResponse = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = $userId }
    if ($sessionResponse.ok -ne $true -or $null -eq $sessionResponse.store) {
        throw "Expected session switch to test employee to succeed."
    }

    $before = $sessionResponse.store
    $beforeKr = @($before.krs | Where-Object { $_.id -eq $krId })[0]
    if ($null -eq $beforeKr) {
        throw "Seed KR $krId not found."
    }
    $beforeProofCount = @($before.proofs | Where-Object { $_.krId -eq $krId }).Count

    $editAttempt = Invoke-ApiJson -Method "PUT" -Path "/api/krs/$krId" -Body @{
        name = "Locked KR rename should fail"
    }

    if (-not $editAttempt.__error) {
        throw "Expected locked KR content edit to be rejected, but API returned success."
    }

    if ($editAttempt.status -ne 403) {
        throw "Expected locked KR content edit to return 403, got $($editAttempt.status)."
    }

    $completeResponse = Invoke-ApiJson -Method "PUT" -Path "/api/krs/$krId/completion" -Body @{
        completionState = "done"
    }

    if ($completeResponse.ok -ne $true) {
        throw "Expected locked KR completion confirmation to succeed."
    }

    $afterComplete = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $completedKr = @($afterComplete.krs | Where-Object { $_.id -eq $krId })[0]
    if ($null -eq $completedKr) {
        throw "Updated KR $krId not found after completion confirmation."
    }

    if ([double]$completedKr.progress -ne 100 -or "$($completedKr.status)" -ne "completed" -or "$($completedKr.currentValue)" -ne "Done") {
        throw "Expected KR completion confirmation to normalize KR to completed state."
    }

    $uploadAfterComplete = Invoke-ApiJson -Method "POST" -Path "/api/krs/$krId/proofs" -Body @{
        fileName   = "after-complete-proof.txt"
        mimeType   = "text/plain"
        fileBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("proof after completed KR"))
        note       = "Completed KR can still upload proof."
    }

    if ($uploadAfterComplete.ok -ne $true) {
        throw "Expected proof upload to remain available after KR completion confirmation."
    }

    $reopenResponse = Invoke-ApiJson -Method "PUT" -Path "/api/krs/$krId/completion" -Body @{
        completionState = "pending"
    }

    if ($reopenResponse.ok -ne $true) {
        throw "Expected locked KR completion reset to succeed."
    }

    $afterReset = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $resetKr = @($afterReset.krs | Where-Object { $_.id -eq $krId })[0]
    if ($null -eq $resetKr) {
        throw "Updated KR $krId not found after completion reset."
    }

    if ([double]$resetKr.progress -ne 0 -or "$($resetKr.status)" -ne "active" -or "$($resetKr.currentValue)" -ne "Pending") {
        throw "Expected KR completion reset to normalize KR back to pending state."
    }

    $submitReview = Invoke-ApiJson -Method "POST" -Path "/api/goals/$goalId/submit-review"
    if ($submitReview.ok -ne $true) {
        throw "Expected goal submission confirmation to succeed."
    }

    $uploadAfterSubmit = Invoke-ApiJson -Method "POST" -Path "/api/krs/$krId/proofs" -Body @{
        fileName   = "after-submit-proof.txt"
        mimeType   = "text/plain"
        fileBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("proof after submit review"))
        note       = "Confirmed goal can still upload proof."
    }

    if ($uploadAfterSubmit.ok -ne $true) {
        throw "Expected proof upload to remain available after goal confirmation."
    }

    $afterUploads = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterProofCount = @($afterUploads.proofs | Where-Object { $_.krId -eq $krId }).Count
    if ($afterProofCount -ne ($beforeProofCount + 2)) {
        throw "Expected KR proof count to increase by 2 after completion and confirmation uploads."
    }

    Write-Host "PASS: locked goal kept KR content locked but allowed completion confirmation toggles."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
