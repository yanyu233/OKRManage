$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$storePath = Join-Path $root "data\store.json"
$backupPath = Join-Path $env:TEMP ("okr-store-backup-{0}.json" -f ([guid]::NewGuid().ToString("N")))
$tempUploadPath = Join-Path $env:TEMP ("okr-proof-download-{0}.txt" -f ([guid]::NewGuid().ToString("N")))
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
    $null = Invoke-ApiJson -Method "PUT" -Path "/api/session" -Body @{ currentUserId = "u-emp1" }
    $content = "proof download path decoding regression"
    [System.IO.File]::WriteAllText($tempUploadPath, $content, [System.Text.Encoding]::UTF8)

    $headers = @{
        "X-Upload-File-Name" = [System.Uri]::EscapeDataString("中文 文件 测试.txt")
        "X-Upload-Note" = [System.Uri]::EscapeDataString("download route regression")
    }

    $uploadResponse = Invoke-WebRequest -Uri "$baseUri/api/krs/kr-emp1-1/proofs" -Method Post -InFile $tempUploadPath -ContentType "text/plain" -Headers $headers -UseBasicParsing
    $uploadPayload = $uploadResponse.Content | ConvertFrom-Json
    if ($uploadPayload.ok -ne $true) {
        throw "Expected proof upload to succeed."
    }

    $uploadedFilePath = Join-Path $root ("uploads\{0}\{1}" -f $uploadPayload.proof.goalId, $uploadPayload.proof.storedName)
    if (-not (Test-Path $uploadedFilePath)) {
        throw "Expected uploaded proof file to exist on disk."
    }

    $downloadUrl = "$baseUri/uploads/$($uploadPayload.proof.goalId)/$([System.Uri]::EscapeDataString($uploadPayload.proof.storedName))"
    $download = Invoke-WebRequest -Uri $downloadUrl -UseBasicParsing
    if ($download.StatusCode -ne 200) {
        throw "Expected encoded proof download route to return 200, got $($download.StatusCode)."
    }

    Write-Host "PASS: proof download route resolved encoded stored names."
}
finally {
    if (Test-Path $uploadedFilePath) {
        Remove-Item -LiteralPath $uploadedFilePath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempUploadPath) {
        Remove-Item -LiteralPath $tempUploadPath -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -LiteralPath $backupPath -Destination $storePath -Force
    Remove-Item -LiteralPath $backupPath -Force
}
