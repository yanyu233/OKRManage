$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$baseUri = "http://localhost:5057"
$goalId = "goal-emp1-q1"
$krIds = @("kr-emp1-1", "kr-emp1-2", "kr-emp1-3")

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

function Save-Store {
    param([object]$Store)

    $json = $Store | ConvertTo-Json -Depth 50
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($storePath, $json, $encoding)
}

function Set-JsonProperty {
    param(
        [object]$Target,
        [string]$Name,
        [object]$Value
    )

    if ($null -eq $Target.PSObject.Properties[$Name]) {
        $Target | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
        return
    }

    $Target.$Name = $Value
}

Copy-Item -LiteralPath $storePath -Destination $backupPath -Force

try {
    $health = Invoke-ApiJson -Method "GET" -Path "/api/health"
    if ($health.ok -ne $true) {
        throw "Server is not healthy."
    }

    $store = Get-Content -Path $storePath -Encoding UTF8 | ConvertFrom-Json
    $goal = @($store.goals | Where-Object { $_.id -eq $goalId })[0]
    if ($null -eq $goal) {
        throw "Seed goal $goalId not found."
    }

    Set-JsonProperty -Target $goal -Name "status" -Value "pending_review"
    Set-JsonProperty -Target $goal -Name "reviewMode" -Value "kr"
    Set-JsonProperty -Target $goal -Name "reviewScore" -Value $null
    Set-JsonProperty -Target $goal -Name "reviewComment" -Value ""
    Set-JsonProperty -Target $goal -Name "reviewerId" -Value $null
    Set-JsonProperty -Target $goal -Name "reviewedAt" -Value $null
    Set-JsonProperty -Target $goal -Name "reviewLevel" -Value $null
    Set-JsonProperty -Target $goal -Name "attitudeScore" -Value $null
    Set-JsonProperty -Target $goal -Name "abilityScore" -Value $null
    Set-JsonProperty -Target $goal -Name "performanceScore" -Value $null

    foreach ($krId in $krIds) {
        $kr = @($store.krs | Where-Object { $_.id -eq $krId })[0]
        if ($null -eq $kr) {
            throw "Seed KR $krId not found."
        }
        Set-JsonProperty -Target $kr -Name "score" -Value $null
        Set-JsonProperty -Target $kr -Name "reviewComment" -Value ""
        Set-JsonProperty -Target $kr -Name "reviewerId" -Value $null
        Set-JsonProperty -Target $kr -Name "reviewedAt" -Value $null
    }

    Save-Store -Store $store

    $sessionLeader = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-sec1" }
    if ($sessionLeader.ok -ne $true) {
        throw "Expected switch to section leader to succeed."
    }

    $firstScore = Invoke-ApiJson -Method "PUT" -Path "/api/krs/kr-emp1-1/score" -Body @{
        score = 86
        reviewComment = "first-pass"
    }

    if ($firstScore.ok -ne $true) {
        throw "Expected first KR score save to succeed."
    }

    $afterFirst = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterFirstGoal = @($afterFirst.goals | Where-Object { $_.id -eq $goalId })[0]
    $afterFirstKr = @($afterFirst.krs | Where-Object { $_.id -eq "kr-emp1-1" })[0]

    if ($null -eq $afterFirstGoal -or $null -eq $afterFirstKr) {
        throw "Expected scored goal and KR to remain visible after first score."
    }

    if ([double]$afterFirstKr.score -ne 86) {
        throw "Expected first KR score to persist as 86."
    }

    if ($afterFirstKr.reviewComment -ne "first-pass") {
        throw "Expected first KR review comment to persist."
    }

    if ("$($afterFirstGoal.status)" -ne "pending_review") {
        throw "Expected partially scored goal to remain pending_review, got $($afterFirstGoal.status)."
    }

    if ([double]$afterFirstGoal.reviewScore -ne 86) {
        throw "Expected partial goal review score to match the current scored KR weighted result."
    }

    $null = Invoke-ApiJson -Method "PUT" -Path "/api/krs/kr-emp1-2/score" -Body @{ score = 92; reviewComment = "second-pass" }
    $finalScore = Invoke-ApiJson -Method "PUT" -Path "/api/krs/kr-emp1-3/score" -Body @{ score = 75; reviewComment = "third-pass" }

    if ($finalScore.ok -ne $true) {
        throw "Expected remaining KR scores to succeed."
    }

    $afterAll = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterAllGoal = @($afterAll.goals | Where-Object { $_.id -eq $goalId })[0]

    if ("$($afterAllGoal.status)" -ne "reviewed") {
        throw "Expected goal to become reviewed after all KR rows are scored, got $($afterAllGoal.status)."
    }

    if ([double]$afterAllGoal.reviewScore -ne 85.1) {
        throw "Expected goal total score to equal weighted KR average 85.1 after scoring all KR rows, got $($afterAllGoal.reviewScore)."
    }

    $rescore = Invoke-ApiJson -Method "PUT" -Path "/api/krs/kr-emp1-1/score" -Body @{
        score = 90
        reviewComment = "revised-score"
    }

    if ($rescore.ok -ne $true) {
        throw "Expected rescoring on reviewed goal to remain editable."
    }

    $afterRescore = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterRescoreGoal = @($afterRescore.goals | Where-Object { $_.id -eq $goalId })[0]
    $afterRescoreKr = @($afterRescore.krs | Where-Object { $_.id -eq "kr-emp1-1" })[0]

    if ([double]$afterRescoreGoal.reviewScore -ne 86.9) {
        throw "Expected goal total score to refresh to 86.9 after rescoring, got $($afterRescoreGoal.reviewScore)."
    }

    if ($afterRescoreKr.reviewComment -ne "revised-score") {
        throw "Expected rescored KR comment to update."
    }

    $sessionOtherLeader = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-sec2" }
    if ($sessionOtherLeader.ok -ne $true) {
        throw "Expected switch to out-of-scope section leader to succeed."
    }

    $forbidden = Invoke-ApiJson -Method "PUT" -Path "/api/krs/kr-emp1-1/score" -Body @{ score = 89 }
    if (-not $forbidden.__error) {
        throw "Expected out-of-scope section leader score write to be rejected."
    }

    if ($forbidden.status -ne 403) {
        throw "Expected out-of-scope score write to return 403, got $($forbidden.status)."
    }

    Write-Host "PASS: section leader KR scoring persisted, aggregated, and remained editable."
}
finally {
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
