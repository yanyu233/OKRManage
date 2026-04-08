$ErrorActionPreference = "Stop"

$response = Invoke-WebRequest -Uri "http://localhost:5057/leader-ranking-preview.html" -TimeoutSec 10 -UseBasicParsing
if ($response.StatusCode -ne 200) {
  throw "Expected 200 but got $($response.StatusCode)"
}
if ($response.Content -notmatch "评分排名") {
  throw "Preview page missing title text."
}
if ($response.Content -notmatch "实时排名") {
  throw "Preview page missing ranking section."
}
Write-Host "PASS: leader ranking preview is reachable and contains expected sections."
