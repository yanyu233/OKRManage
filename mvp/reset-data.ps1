$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$dataRoot = Join-Path $scriptRoot "data"
$seedPath = Join-Path $dataRoot "seed.json"
$storePath = Join-Path $dataRoot "store.json"
$uploadPath = Join-Path $scriptRoot "uploads"

if (-not (Test-Path $seedPath)) {
    throw "未找到种子数据文件: $seedPath"
}

Copy-Item -Path $seedPath -Destination $storePath -Force
if (Test-Path $uploadPath) {
    Get-ChildItem -Path $uploadPath -Force | Remove-Item -Recurse -Force
}

Write-Host "MVP data reset: $storePath"
