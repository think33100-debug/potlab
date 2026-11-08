#!/usr/bin/env bash
# 서버 자동 반영을 크론에 한 줄 더합니다 (2026-11-08 세중님 「가」 결정 · 한 번만 돌림)
#
#   ssh potjob "cd ~/potlab && git pull --ff-only && bash tools/server-auto-pull-install.sh"
#
# · 지금 크론을 ~/되돌림/ 에 날짜 붙여 먼저 떠 둡니다 (지침 8-19).
# · 이미 있으면 더하지 않습니다(두 번 돌려도 같음). 다른 줄은 건드리지 않습니다.
# · 전후 줄 수를 찍고, 자동 반영을 한 번 돌려 결과 한 줄을 보여 줍니다.
# 되돌리기 — 백업 파일로: crontab ~/되돌림/crontab_<날짜>.txt
set -eu
REPO=/home/ubuntu/potlab
LINE="40 * * * * /bin/bash $REPO/tools/server-auto-pull.sh >> /home/ubuntu/log/auto-pull.log 2>&1"

mkdir -p /home/ubuntu/log /home/ubuntu/되돌림
bak="/home/ubuntu/되돌림/crontab_$(date +%Y%m%d_%H%M).txt"
crontab -l > "$bak" 2>/dev/null || true
before=$(grep -c '' "$bak" || true)
echo "백업: $bak (${before}줄)"

if grep -qF 'server-auto-pull.sh' "$bak"; then
  echo "이미 있음 — 더하지 않음"
else
  { cat "$bak"; if [ -s "$bak" ] && [ -n "$(tail -c1 "$bak")" ]; then echo; fi; echo "$LINE"; } | crontab -
  echo "더함: $LINE"
fi

after=$(crontab -l | grep -c '')
echo "크론 줄 수: ${before} -> ${after}"
crontab -l | grep -F 'server-auto-pull.sh'

echo "자동 반영 한 번 돌림:"
/bin/bash "$REPO/tools/server-auto-pull.sh" | tee -a /home/ubuntu/log/auto-pull.log
