param(
    [int]$Port = 5057
)

$processes = Get-CimInstance Win32_Process -Filter "name = 'powershell.exe'" |
    Where-Object {
        $_.CommandLine -like '*start-mvp.ps1*' -or
        $_.CommandLine -like "*server.ps1*Port $Port*"
    }

if (-not $processes) {
    Write-Host "No running MVP service found on port $Port."
    exit 0
}

$processes | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "Stopped MVP service process: $($_.ProcessId)"
}
