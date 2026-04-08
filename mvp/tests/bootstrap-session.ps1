$ErrorActionPreference = "Stop"

$baseUri = "http://localhost:5057"

function Invoke-ApiRaw {
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

$raw = Invoke-ApiRaw -Path "/api/bootstrap"
$bootstrap = $raw | ConvertFrom-Json

if ($bootstrap.authState -ne "anonymous") {
    throw "Expected bootstrap.authState to be anonymous for unauthenticated request."
}

if ($null -ne $bootstrap.currentUser) {
    throw "Expected bootstrap.currentUser to be null for unauthenticated request."
}

if (@($bootstrap.goals).Count -ne 0) {
    throw "Expected bootstrap.goals to be empty for unauthenticated request."
}

Write-Host "PASS: bootstrap returns anonymous contract when no authenticated session exists."
