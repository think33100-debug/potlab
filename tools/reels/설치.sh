#!/usr/bin/env bash
# 릴스 서버 설치 · 확인 — 한 번만 (2026-11-16)
#   cd ~/potlab && bash tools/reels/설치.sh
# 하는 것: playwright + 크롬 설치 → ffmpeg 확인 → 사진 152장 받기 → 마른 실행 한 바퀴
# 크론 줄은 넣지 않습니다 (승인 자리 · 끝에 줄을 찍어 줍니다)
set -euo pipefail
cd "$(dirname "$0")"
echo "── 1. playwright"
npm install --no-save --no-audit --no-fund --silent playwright@1.63.0   # package.json 은 저장소에 안 올립니다 (.gitignore 91줄 까닭)
npx playwright install chromium
sudo npx playwright install-deps chromium >/dev/null
echo "── 2. ffmpeg"
command -v ffmpeg >/dev/null || sudo apt-get install -y ffmpeg >/dev/null
ffmpeg -version | head -1
echo "── 3. 사진 (병원 공식 사이트에서 · 지문 확인)"
node photos.mjs --모두 || true
echo "── 4. 마른 실행 (만들기만 · 메일 안 보냄)"
cd ../..
node tools/reels/run.mjs --최대 1
echo
echo "끝. 드라이브 열쇠(처음 한 번):  node tools/reels/drive.mjs --인증  →  node tools/reels/drive.mjs --시험"
echo "    메일 한 통 시험:  node tools/reels/run.mjs --메일 --최대 1"
echo "크론 줄 (crontab -e 에 붙여 넣기):"
echo "*/30 8-21 * * * mkdir -p ~/lock && flock -n ~/lock/reels.lock bash -c 'cd ~/potlab && node tools/reels/run.mjs --메일 --최대 2' >> ~/potlab/log/reels.log 2>&1"
