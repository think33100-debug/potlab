# ============================================================
# OCR 전용 Apps Script 올리기
# ------------------------------------------------------------
#   .\push.ps1                 올리기만
#   .\push.ps1 -deploy         올린 뒤 웹 앱 배포를 새 버전으로
#
# 수집기(gas/wage.js)와 **다른 프로젝트**입니다. 섞지 마세요.
# 이 폴더에는 열쇠가 없습니다 — 비밀값은 스크립트 속성 OCR_KEY 에 있습니다.
# ============================================================
param(
  [switch]$deploy,
  [string]$msg = ""
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

if (-not (Test-Path ".clasp.json")) {
  Write-Host ".clasp.json 이 없습니다. 먼저 프로젝트를 만들어야 합니다:" -ForegroundColor Yellow
  Write-Host '  npx clasp create --type webapp --title "potjob OCR" --rootDir .'
  exit 1
}

Write-Host "1) clasp push"
npx clasp push --force
if ($LASTEXITCODE -ne 0) { Write-Host "올리기 실패" -ForegroundColor Red; exit 1 }

if ($deploy) {
  if ($msg -eq "") { $msg = "OCR " + (Get-Date -Format "MM-dd HH:mm") }
  Write-Host "2) clasp deploy"
  npx clasp deploy -d $msg
  if ($LASTEXITCODE -ne 0) { Write-Host "배포 실패" -ForegroundColor Red; exit 1 }
  Write-Host ""
  Write-Host "배포했습니다. 웹 앱 주소는 아래 명령으로 볼 수 있습니다:"
  Write-Host "  npx clasp deployments"
  Write-Host "주소 꼴 — https://script.google.com/macros/s/<배포ID>/exec"
}
