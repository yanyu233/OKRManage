$ErrorActionPreference = 'Stop'

$jsPath = Join-Path $PSScriptRoot '..\public\system-admin-overrides.js'
$cssPath = Join-Path $PSScriptRoot '..\public\system-admin-overrides.css'

$jsSource = Get-Content -Path $jsPath -Raw -Encoding UTF8
$cssSource = Get-Content -Path $cssPath -Raw -Encoding UTF8
$groupEditCopy = [regex]::Unescape('\u7ec4\u540d\u652f\u6301\u76f4\u63a5\u4fee\u6539')

if ($jsSource.Contains('<th>编码</th>')) {
  throw 'admin config tables should not render 编码 columns'
}

if ($jsSource.Contains('admin-cell-code')) {
  throw 'admin config rows should not render code cells'
}

if (-not $jsSource.Contains('admin-quota-summary')) {
  throw 'quota cards should render a dedicated summary strip for seat totals'
}

if (-not $jsSource.Contains('data-admin-group-card')) {
  throw 'admin config should render editable review group cards'
}

if (-not $jsSource.Contains('data-admin-act="add-group"')) {
  throw 'admin config should provide an add-group action'
}

if (-not $jsSource.Contains('data-admin-group-name')) {
  throw 'admin config should provide editable review group names'
}

if (-not $jsSource.Contains('inputmode="numeric"')) {
  throw 'quota inputs should use text-style numeric fields to avoid clipped zero rendering'
}

if ($jsSource.Contains('type="number" min="0" step="1" class="admin-input admin-quota-input"')) {
  throw 'quota inputs should no longer rely on the old compact number-input markup'
}

if (-not $cssSource.Contains('grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));')) {
  throw 'review-group cards should use a wider responsive layout for multiple groups'
}

if (-not $cssSource.Contains('grid-template-columns: repeat(5, minmax(0, 1fr));')) {
  throw 'quota grade fields should present all five levels in a stable horizontal grid on desktop'
}

if (-not $jsSource.Contains('data-admin-act="remove-group"')) {
  throw 'admin config should provide a remove-group action for review group CRUD'
}

if (-not $jsSource.Contains($groupEditCopy)) {
  throw 'admin config should clearly indicate that review group names can be edited inline'
}

if (-not $cssSource.Contains('.admin-quota-input')) {
  throw 'quota inputs should use a dedicated admin-quota-input style'
}

if (-not $cssSource.Contains('appearance: textfield')) {
  throw 'quota number inputs should normalize browser number-field appearance'
}

Write-Host 'system-admin-config-ui test passed'
