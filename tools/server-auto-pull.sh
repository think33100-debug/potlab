#!/usr/bin/env bash
# 서버 자동 반영 (2026-11-08 세중님 「가」 결정)
#
# 크론이 매시 40분에 부릅니다 (HS3 수집은 정시 · 겹치지 않게).
# 하는 일 — origin/main 을 fast-forward 로만 받습니다. 그 밖은 하지 않습니다.
#   · main 이 아니거나 추적 파일이 고쳐져 있으면(작업나무 더러움) 손대지 않고 끝냅니다.
#     더러움은 05:00 tools/작업나무점검.mjs 가 따로 알립니다 (지침 8-10).
#   · 받은 뒤 크론이 부르는 코드(tools/*.mjs · tools/hosp/*)를 node --check 하고
#     사이트 설정 tools/hosp/hosp-sites.json 이 JSON 으로 읽히는지 봅니다.
#     하나라도 실패하면 받기 전 커밋으로 되돌리고 CHECK-FAIL 을 남깁니다.
#   · .env · ~/수집크론.sh · 크론 줄은 저장소 밖이라 건드리지 않습니다.
# 기록 — /home/ubuntu/log/auto-pull.log 에 한 줄씩.
set -u
REPO=${POTLAB_REPO:-/home/ubuntu/potlab}     # 시험 때만 바꿉니다
NODE=${POTLAB_NODE:-/usr/bin/node}
now() { date '+%Y-%m-%d %H:%M:%S %Z'; }

cd "$REPO" || { echo "$(now) FAIL no-repo $REPO"; exit 1; }

if command -v flock >/dev/null 2>&1; then
  exec 9>/tmp/potlab-auto-pull.lock
  flock -n 9 || { echo "$(now) SKIP already-running"; exit 0; }
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ]; then echo "$(now) SKIP not-main ($branch)"; exit 0; fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "$(now) SKIP dirty-worktree"; exit 0
fi

git fetch --quiet origin main || { echo "$(now) FAIL fetch"; exit 1; }
before=$(git rev-parse HEAD)
target=$(git rev-parse origin/main)
if [ "$before" = "$target" ]; then echo "$(now) OK up-to-date ${before:0:7}"; exit 0; fi

git merge --ff-only --quiet origin/main || { echo "$(now) FAIL not-fast-forward ${before:0:7} -> ${target:0:7}"; exit 1; }

bad=0
for f in tools/*.mjs tools/hosp/*.mjs tools/hosp/*.js; do
  [ -f "$f" ] || continue
  if ! "$NODE" --check "$f" >/dev/null 2>&1; then echo "$(now) CHECK-FAIL $f"; bad=1; fi
done
if [ -f tools/hosp/hosp-sites.json ]; then
  if ! "$NODE" -e "JSON.parse(require('fs').readFileSync('tools/hosp/hosp-sites.json','utf8'))" >/dev/null 2>&1; then
    echo "$(now) CHECK-FAIL tools/hosp/hosp-sites.json"; bad=1
  fi
fi

if [ "$bad" = 1 ]; then
  git reset --hard --quiet "$before"
  echo "$(now) ROLLBACK to ${before:0:7} (target ${target:0:7} failed checks)"
  exit 1
fi

n=$(git rev-list --count "$before..HEAD")
echo "$(now) PULLED ${before:0:7} -> $(git rev-parse --short HEAD) ($n commits)"
