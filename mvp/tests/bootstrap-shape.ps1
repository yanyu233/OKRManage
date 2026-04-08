$ErrorActionPreference = "Stop"

$baseUri = "http://localhost:5057"

function Get-RawJson {
    param([string]$Path)

    $response = [System.Net.WebRequest]::Create("$baseUri$Path").GetResponse()
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    try {
        return $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
        $stream.Dispose()
        $response.Dispose()
    }
}

Invoke-RestMethod -Method Put -Uri "$baseUri/api/session" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes('{"currentUserId":"u-dept1"}')) | Out-Null
$raw = Get-RawJson -Path "/api/bootstrap"

if ($raw -notmatch '"departments"\s*:\s*\[') {
    throw 'Expected bootstrap.departments to serialize as an array.'
}

if ($raw -notmatch '"users"\s*:\s*\[') {
    throw 'Expected bootstrap.users to serialize as an array.'
}

if ($raw -notmatch '"demoUsers"\s*:\s*\[') {
    throw 'Expected bootstrap.demoUsers to serialize as an array.'
}

Invoke-RestMethod -Method Put -Uri "$baseUri/api/session" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes('{"currentUserId":"u-emp1"}')) | Out-Null

Write-Host "PASS: bootstrap serialized scoped collections as arrays for system admin."
