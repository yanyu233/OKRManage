$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$tempUploadPath = Join-Path $env:TEMP ("okr-stream-upload-{0}.bin" -f ([guid]::NewGuid().ToString("N")))
$baseUri = "http://localhost:5057"
$uploadedFilePath = $null

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

    return Invoke-RestMethod @params
}

Copy-Item -LiteralPath $storePath -Destination $backupPath -Force

try {
    $bytes = New-Object byte[] (3MB)
    (New-Object System.Random 7).NextBytes($bytes)
    [System.IO.File]::WriteAllBytes($tempUploadPath, $bytes)

    $null = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-emp1" }
    $before = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $beforeCount = @($before.proofs | Where-Object { $_.krId -eq "kr-emp1-1" }).Count

    $headers = @{
        "X-Upload-File-Name" = [System.Uri]::EscapeDataString("streamed-proof.bin")
        "X-Upload-Note" = [System.Uri]::EscapeDataString("stream upload regression")
    }

    $response = Invoke-WebRequest -Uri "$baseUri/api/krs/kr-emp1-1/proofs" -Method Post -InFile $tempUploadPath -ContentType "application/octet-stream" -Headers $headers -UseBasicParsing
    $payload = $response.Content | ConvertFrom-Json

    if ($payload.ok -ne $true) {
        throw "Expected streamed KR proof upload to succeed."
    }

    $after = Invoke-ApiJson -Method "GET" -Path "/api/bootstrap"
    $afterCount = @($after.proofs | Where-Object { $_.krId -eq "kr-emp1-1" }).Count
    if ($afterCount -ne ($beforeCount + 1)) {
        throw "Expected KR proof count to increase from $beforeCount to $($beforeCount + 1), got $afterCount."
    }

    $uploadedFilePath = Join-Path $root ("uploads\{0}\{1}" -f $payload.proof.goalId, $payload.proof.storedName)
    Write-Host "PASS: streamed KR proof upload succeeded without base64 JSON buffering."
}
finally {
    if ($uploadedFilePath -and (Test-Path $uploadedFilePath)) {
        Remove-Item -LiteralPath $uploadedFilePath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempUploadPath) {
        Remove-Item -LiteralPath $tempUploadPath -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
