param(
    [string]$Remote = "origin",
    [string]$Branch = "",
    [string]$Message = ""
)

$ErrorActionPreference = "Stop"
$git = "C:\Program Files\Git\cmd\git.exe"
$repoRoot = $PSScriptRoot

function Assert-GitAvailable {
    if (-not (Test-Path $git)) {
        throw "Git was not found at $git"
    }
}

function Invoke-Git {
    param([string[]]$GitArgs)

    & $git -C $repoRoot @GitArgs
    if ($LASTEXITCODE -ne 0) {
        throw "git $($GitArgs -join ' ') failed."
    }
}

Assert-GitAvailable

$inside = & $git -C $repoRoot rev-parse --is-inside-work-tree 2>$null
if (([string]$inside).Trim() -ne "true") {
    throw "Current directory is not a git repository: $repoRoot"
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (& $git -C $repoRoot symbolic-ref --short -q HEAD).Trim()
}

if ([string]::IsNullOrWhiteSpace($Branch) -or $Branch -eq "HEAD") {
    throw "Could not determine current branch."
}

$remotes = @(& $git -C $repoRoot remote)
if ($remotes -notcontains $Remote) {
    throw "Remote '$Remote' is not configured. Send me the repository URL and I will wire it up."
}

$userName = (& $git config user.name).Trim()
if ([string]::IsNullOrWhiteSpace($userName)) {
    $userName = (& $git config --global user.name).Trim()
}

$userEmail = (& $git config user.email).Trim()
if ([string]::IsNullOrWhiteSpace($userEmail)) {
    $userEmail = (& $git config --global user.email).Trim()
}

if ([string]::IsNullOrWhiteSpace($userName) -or [string]::IsNullOrWhiteSpace($userEmail)) {
    throw "Git user.name or user.email is missing. Send me the git display name and email you want to use."
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    $Message = "chore: sync $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Invoke-Git -GitArgs @("add", "-A")

& $git -C $repoRoot diff --cached --quiet --ignore-submodules --
$hasStagedChanges = ($LASTEXITCODE -ne 0)

if ($hasStagedChanges) {
    Invoke-Git -GitArgs @("commit", "-m", $Message)
}
else {
    Write-Host "No local changes detected. Skipping commit."
}

Invoke-Git -GitArgs @("push", "-u", $Remote, $Branch)
Write-Host "Upload complete: $Remote/$Branch"
