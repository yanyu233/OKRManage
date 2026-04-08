param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [string]$Remote = "origin"
)

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
$repoRoot = $PSScriptRoot

if (-not (Test-Path $git)) {
    throw "Git was not found at $git"
}

$inside = & $git -C $repoRoot rev-parse --is-inside-work-tree 2>$null
if (([string]$inside).Trim() -ne "true") {
    throw "Current directory is not a git repository: $repoRoot"
}

$remotes = @(& $git -C $repoRoot remote)
if ($remotes -contains $Remote) {
    & $git -C $repoRoot remote set-url $Remote $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to update remote '$Remote'."
    }
    Write-Host "Updated remote $Remote -> $Url"
}
else {
    & $git -C $repoRoot remote add $Remote $Url
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to add remote '$Remote'."
    }
    Write-Host "Added remote $Remote -> $Url"
}

& $git -C $repoRoot remote -v
