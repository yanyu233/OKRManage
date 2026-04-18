Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $scriptRoot
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$nodeDir = Split-Path -Parent $nodeExe
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'
$distEntry = Join-Path $appRoot 'dist\src\main.js'
$dbResetScript = Join-Path $appRoot 'scripts\db-reset.ps1'
$port = 3101
$baseUrl = "http://127.0.0.1:$port/api"
$process = $null
$runId = [guid]::NewGuid().ToString('N')
$stdoutPath = Join-Path $env:TEMP "okr-node-foundation-smoke-$runId.out.log"
$stderrPath = Join-Path $env:TEMP "okr-node-foundation-smoke-$runId.err.log"

function Invoke-NativeChecked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  & $FilePath @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')"
  }
}

function Wait-ForHealth {
  param(
    [string]$Url,
    [int]$Retries = 30
  )

  for ($index = 0; $index -lt $Retries; $index++) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2
      if ($response.ok -eq $true) {
        return $response
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "health endpoint did not become ready: $Url"
}

try {
  $previousPath = $env:Path
  $env:Path = "$nodeDir;$previousPath"
  Push-Location $appRoot
  Write-Host '[smoke] resetting database'
  $previousSkipPrismaGenerate = $env:OKR_SKIP_PRISMA_GENERATE
  $previousSeedProfile = $env:OKR_SEED_PROFILE
  $env:OKR_SKIP_PRISMA_GENERATE = '1'
  $env:OKR_SEED_PROFILE = 'demo'
  & powershell -NoProfile -ExecutionPolicy Bypass -File $dbResetScript
  $env:OKR_SKIP_PRISMA_GENERATE = $previousSkipPrismaGenerate
  $env:OKR_SEED_PROFILE = $previousSeedProfile
  if ($LASTEXITCODE -ne 0) {
    throw 'db-reset failed'
  }

  Write-Host '[smoke] building server'
  Invoke-NativeChecked -FilePath $npmCmd -Arguments @('run', 'build')

  Write-Host "[smoke] starting server on port $port"
  $previousPort = $env:PORT
  $previousAuthMode = $env:AUTH_MODE
  $env:PORT = [string]$port
  $env:AUTH_MODE = 'local-debug'
  $process = Start-Process `
    -FilePath $nodeExe `
    -ArgumentList $distEntry `
    -WorkingDirectory $appRoot `
    -PassThru `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath
  $env:PORT = $previousPort
  $env:AUTH_MODE = $previousAuthMode

  $health = Wait-ForHealth -Url "$baseUrl/health"
  if (-not $health.database.ok) {
    throw 'database health is not ok'
  }
  Write-Host "[smoke] health ok: $($health.service) ($($health.authMode))"

  $webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $loginBody = @{
    loginName = 'sysadmin.local'
    password = 'Admin123!'
  } | ConvertTo-Json

  $login = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/auth/manual-login" `
    -ContentType 'application/json' `
    -Body $loginBody `
    -WebSession $webSession

  if ($login.ok -ne $true) {
    throw 'manual login did not return ok=true'
  }

  $me = Invoke-RestMethod -Method Get -Uri "$baseUrl/me" -WebSession $webSession
  if ($me.authenticated -ne $true) {
    throw 'manual login did not create an authenticated session'
  }

  $bootstrap = Invoke-RestMethod -Method Get -Uri "$baseUrl/admin/org/bootstrap" -WebSession $webSession
  if (-not $bootstrap.reviewGroups) {
    throw 'admin bootstrap did not return reviewGroups'
  }

  Write-Host "[smoke] manual login ok: $($me.user.name) / $($me.user.role)"

  $leaderSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $leaderLoginBody = @{
    loginName = 'section.leader'
    password = 'Leader123!'
  } | ConvertTo-Json

  $leaderLogin = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/auth/manual-login" `
    -ContentType 'application/json' `
    -Body $leaderLoginBody `
    -WebSession $leaderSession

  if ($leaderLogin.ok -ne $true) {
    throw 'section leader login did not return ok=true'
  }

  $workbench = Invoke-RestMethod -Method Get -Uri "$baseUrl/leader/workbench?year=2026&quarter=1" -WebSession $leaderSession
  if (-not $workbench.selectedGoal) {
    throw 'leader workbench did not return selectedGoal'
  }

  $ranking = Invoke-RestMethod -Method Get -Uri "$baseUrl/leader/ranking?year=2026&quarter=1" -WebSession $leaderSession
  if (-not $ranking.ranking) {
    throw 'leader ranking did not return ranking entries'
  }

  $employeeSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $employeeLoginBody = @{
    loginName = 'zhang.chen'
    password = 'Employee123!'
  } | ConvertTo-Json

  $employeeLogin = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/auth/manual-login" `
    -ContentType 'application/json' `
    -Body $employeeLoginBody `
    -WebSession $employeeSession

  if ($employeeLogin.ok -ne $true) {
    throw 'employee login did not return ok=true'
  }

  $employeeOkr = Invoke-RestMethod -Method Get -Uri "$baseUrl/employee/okr?year=2026&quarter=1" -WebSession $employeeSession
  if (-not $employeeOkr.goals -or $employeeOkr.goals.Count -lt 1) {
    throw 'employee okr list did not return goals'
  }

  $goalId = $employeeOkr.goals[0].id
  $employeeGoal = Invoke-RestMethod -Method Get -Uri "$baseUrl/employee/goals/$goalId" -WebSession $employeeSession
  if (-not $employeeGoal.keyResults -or $employeeGoal.keyResults.Count -lt 1) {
    throw 'employee goal detail did not return key results'
  }

  $krId = $employeeGoal.keyResults[0].id
  $completionBody = @{
    completionState = 'completed'
  } | ConvertTo-Json

  $completion = Invoke-RestMethod `
    -Method Put `
    -Uri "$baseUrl/employee/key-results/$krId/completion" `
    -ContentType 'application/json' `
    -Body $completionBody `
    -WebSession $employeeSession

  if ($completion.completionState -ne 'completed') {
    throw 'employee completion toggle did not persist'
  }

  Write-Host "[smoke] leader workbench ok: $($workbench.selectedEmployee.name) / $($workbench.selectedGoal.code)"
  Write-Host "[smoke] leader ranking ok: $($ranking.ranking.Count) entries"
  Write-Host "[smoke] employee okr ok: $($employeeOkr.employee.name) / $($employeeOkr.goals.Count) goals"
  Write-Host '[smoke] PASS'
} finally {
  Pop-Location
  $env:Path = $previousPath
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $stderrPath) {
    $stderrRaw = Get-Content -LiteralPath $stderrPath -Raw
    $stderr = if ($null -eq $stderrRaw) { '' } else { $stderrRaw.Trim() }
    if ($stderr) {
      Write-Warning $stderr
    }
  }
  if (Test-Path $stdoutPath) {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $stderrPath) {
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}
