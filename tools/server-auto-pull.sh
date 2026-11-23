#!/usr/bin/env bash
# 서버 자동 반영 (2026-11-08 세중님 「가」 결정)
#
# 크론이 부릅니다 — 시각은 crontab 한 자리 (11/23 까지 매시 40분 · HS3 수집은 정시라 겹치지 않게).
# 새 수집 설정이 들어오면 아래 「급행」 이 그 곳만 바로 수집합니다 (2026-11-23).
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

# ── 급행 — 새 수집 설정이 들어오면 그 곳만 바로 수집 (2026-11-23 세중님 「바로 바로 들어올 수 있게 · 급행으로」) ──
# 경쟁사 신호(땡큐오티 4319 등)로 만든 새 병원 설정(tools/hosp/cfgs/*.json)이 병합돼도
# 정시 수집(매시 정각)과 첨부 읽기를 기다려야 해서 회원 화면까지 한두 시간이 걸렸습니다.
# 이번 당기기에서 **새로 생긴** 설정 파일만 골라, 그 병원 이름으로 collect-hosp 를 한 번 돌립니다
# (정시 크론 줄과 같은 꼴 · 첨부 읽기 포함 · 한 번에 3곳까지). 기록은 hosp.log 와 이 로그 한 줄.
# 되돌림 — 이 덩어리를 지우거나 POTLAB_EXPRESS=0 으로 크론을 부르면 꺼집니다.
if [ "${POTLAB_EXPRESS:-1}" = 1 ]; then
  added=$(git diff --name-only --diff-filter=A "$before" HEAD -- 'tools/hosp/cfgs/*.json' | head -3)
  for f in $added; do
    nm=$("$NODE" -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).name||''))" "$f" 2>/dev/null)
    if [ -z "$nm" ]; then echo "$(now) EXPRESS-SKIP no-name $f"; continue; fi
    if [ "${POTLAB_EXPRESS_DRY:-0}" = 1 ]; then echo "$(now) EXPRESS-DRY $f · $nm"; continue; fi
    ( set -a; . ./.env; set +a
      POTJOB_ATTACH_WRITE=1 POTJOB_ATTACH_MAX=300 timeout -k 30 600 "$NODE" tools/collect-hosp.mjs "$nm" \
        >> /home/ubuntu/log/hosp.log 2>&1 )
    echo "$(now) EXPRESS $f · $nm · exit $?"
  done
fi
