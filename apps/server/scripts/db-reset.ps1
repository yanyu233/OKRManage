Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $scriptRoot
$npmCmd = 'C:\Program Files\nodejs\npm.cmd'
$previousPath = $env:Path
$env:Path = 'C:\Program Files\nodejs;' + $previousPath
$proofStorageDir = if ($env:PROOF_STORAGE_DIR -and $env:PROOF_STORAGE_DIR.Trim().Length -gt 0) {
  $env:PROOF_STORAGE_DIR.Trim()
} else {
  'storage/proofs'
}
$proofStoragePath = Join-Path $appRoot $proofStorageDir

function Set-DefaultEnv {
  param(
    [string]$Name,
    [string]$Value
  )

  if (-not (Get-Item -Path "Env:$Name" -ErrorAction SilentlyContinue)) {
    Set-Item -Path "Env:$Name" -Value $Value
  }
}

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

try {
  Set-DefaultEnv -Name 'DATABASE_URL' -Value 'mysql://root:root@127.0.0.1:3306/okr_route_c_dev'
  Set-DefaultEnv -Name 'DEBUG_SYSADMIN_LOGIN' -Value 'sysadmin.local'
  Set-DefaultEnv -Name 'DEBUG_SYSADMIN_PASSWORD' -Value 'Admin123!'
  Set-DefaultEnv -Name 'DEBUG_SYSADMIN_NAME' -Value 'System Admin'

  Push-Location $appRoot

  if (Test-Path -LiteralPath $proofStoragePath) {
    Remove-Item -LiteralPath $proofStoragePath -Recurse -Force
  }

  if ($env:OKR_SKIP_PRISMA_GENERATE -ne '1') {
    Invoke-NativeChecked -FilePath $npmCmd -Arguments @('run', 'prisma:generate')
  }
  Invoke-NativeChecked -FilePath $npmCmd -Arguments @('run', 'prisma:migrate:reset', '--', '--force', '--skip-generate')

  Write-Host '[db-reset] PASS'
} finally {
  Pop-Location
  $env:Path = $previousPath
}
