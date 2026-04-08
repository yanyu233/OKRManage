param(
    [string]$Remote = "origin",
    [switch]$Stash
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
    param([string[]]$Args)

    & $git -C $repoRoot @Args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Args -join ' ') failed."
    }
}

Assert-GitAvailable

$inside = & $git -C $repoRoot rev-parse --is-inside-work-tree 2>$null
if (([string]$inside).Trim() -ne "true") {
    throw "Current directory is not a git repository: $repoRoot"
}

$branch = (& $git -C $repoRoot symbolic-ref --short -q HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq "HEAD") {
    throw "Could not determine current branch."
}

$remotes = @(& $git -C $repoRoot remote)
if ($remotes -notcontains $Remote) {
    throw "Remote '$Remote' is not configured. Send me the repository URL and I will wire it up."
}

$hasStash = $false
if ($Stash) {
    & $git -C $repoRoot diff --quiet --ignore-submodules --
    $worktreeClean = ($LASTEXITCODE -eq 0)
    & $git -C $repoRoot diff --cached --quiet --ignore-submodules --
    $indexClean = ($LASTEXITCODE -eq 0)

    if (-not ($worktreeClean -and $indexClean)) {
        Invoke-Git @("stash", "push", "-u", "-m", "auto-download-stash")
        $hasStash = $true
    }
}

try {
    Invoke-Git @("fetch", $Remote, "--prune")
    Invoke-Git @("pull", "--ff-only", $Remote, $branch)
    Write-Host "Download complete: $Remote/$branch"
}
finally {
    if ($hasStash) {
        & $git -C $repoRoot stash pop
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Remote updates were pulled, but stash pop has conflicts. Resolve them manually."
        }
    }
}
