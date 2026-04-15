$ErrorActionPreference = 'Stop'

$mysqlRoot = Join-Path $env:USERPROFILE 'mysql-local'
$mysqldPath = Join-Path $mysqlRoot 'server\mysql-8.4.8-winx64\bin\mysqld.exe'
$configPath = Join-Path $mysqlRoot 'my.ini'

if (-not (Test-Path $mysqldPath)) {
  throw "mysqld.exe not found: $mysqldPath"
}

if (-not (Test-Path $configPath)) {
  throw "MySQL config not found: $configPath"
}

$existing = Get-Process mysqld -ErrorAction SilentlyContinue | Where-Object {
  $_.Path -eq $mysqldPath
}

if ($existing) {
  Write-Output "Local MySQL is already running. PID: $($existing.Id -join ', ')"
  exit 0
}

Start-Process -FilePath $mysqldPath -ArgumentList @("--defaults-file=$configPath", '--console') -WorkingDirectory $mysqlRoot -WindowStyle Hidden

for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  $listening = netstat -ano | Select-String ':3306'
  if ($listening) {
    Write-Output 'Local MySQL started at 127.0.0.1:3306'
    exit 0
  }
}

throw 'Local MySQL start timed out. Check C:\Users\yanxi\mysql-local\logs\error.log'
