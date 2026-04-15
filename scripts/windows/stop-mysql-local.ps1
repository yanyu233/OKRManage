$ErrorActionPreference = 'Stop'

$mysqldPath = Join-Path (Join-Path $env:USERPROFILE 'mysql-local') 'server\mysql-8.4.8-winx64\bin\mysqld.exe'

$targets = Get-Process mysqld -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -eq $mysqldPath
}

if (-not $targets) {
  Write-Output 'Local MySQL is not running.'
  exit 0
}

$targets | Stop-Process -Force
Write-Output "Stopped local MySQL. PID: $($targets.Id -join ', ')"
