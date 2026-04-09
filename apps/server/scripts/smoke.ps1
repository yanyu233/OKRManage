Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $scriptRoot
$nodeExe = 'C:\Program Files\nodejs\node.exe'
$nodeDir = Split-Path -Parent $nodeExe
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'
$distEntry = Join-Path $appRoot 'dist\src\main.js'
$port = 3101
$baseUrl = "http://127.0.0.1:$port/api"
$process = $null
$runId = [guid]::NewGuid().ToString('N')
$stdoutPath = Join-Path $env:TEMP "okr-node-foundation-smoke-$runId.out.log"
$stderrPath = Join-Path $env:TEMP "okr-node-foundation-smoke-$runId.err.log"

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
  Write-Host '[smoke] building server'
  & $npmCmd run build | Out-Host

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

  Write-Host "[smoke] manual login ok: $($me.user.name) / $($me.user.role)"
  Write-Host '[smoke] PASS'
} finally {
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
