param(
    [int]$Port = 5057
)

$scriptPath = Join-Path $PSScriptRoot "mvp\server.ps1"

if (-not (Test-Path $scriptPath)) {
    throw "未找到 MVP 服务脚本: $scriptPath"
}

& $scriptPath -Port $Port
