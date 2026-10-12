/* alive_targets 3인수판의 PUBLIC 을 닫습니다 (2026-10-12 · 세중님 승인)

   ── 왜 ───────────────────────────────────────────────────────
   2026-10-07 에 `p_내린것` 을 더했습니다. 인수가 늘면 **새 함수**가 되고
   PostgreSQL 은 새 함수를 PUBLIC 에게 EXECUTE 로 엽니다 (지침 6-2).
   그 마이그레이션에 `revoke` 가 없었습니다.

     전   =X/postgres | postgres=X/postgres | service_role=X/postgres
          ↑ 맨 앞의 이름 없는 줄이 PUBLIC 입니다
     후   postgres=X/postgres | service_role=X/postgres | anon=X/postgres

   ── anon 을 **명시로 남기는** 까닭 ───────────────────────────
   `.github/workflows/alive.yml` 이 아직 정시입니다 —
     cron '40 20 * * 0'  = 한국시간 월요일 05:40
     env  SUPABASE_URL · SUPABASE_ANON_KEY · ALIVE_KEY   ← service 열쇠가 없습니다
   `alive.mjs` 는 `p_내린것` 을 늘 넘기므로 **3인수판**을 부릅니다. 지금까지는
   PUBLIC 덕에 돌고 있었습니다. anon 까지 걷으면 그 정찰이 죽습니다.
   service_role 열쇠는 GitHub 에 넣지 않습니다 (지침 · alive.mjs 머리글).

   서버 정찰(크론 02:15)은 `SUPABASE_SERVICE_KEY` 로 부릅니다 — 서버 `.env` 에
   있는 것을 확인했습니다 (이름과 길이만 봤습니다 · 지침 8-11).

   PUBLIC 만 닫아도 「앞으로 생길 역할」까지 막힙니다. 권한 자체는 함수 안의
   `ALIVE_KEY` 검사(24자 이상)가 봅니다.

   ── 남은 일 (제안) ───────────────────────────────────────────
   서버가 **날마다** 정찰을 돕니다. GitHub 쪽 주 1회는 이제 겹치기입니다.
   `alive.yml` 의 `schedule` 두 줄을 주석 처리하면 anon 도 걷을 수 있습니다
   (`docs/정찰_서버로_옮기기_2026-10-07.md` 4절에 「결과가 같으면 GitHub 쪽
   schedule 만 주석 처리합니다」라고 적혀 있습니다).

   delete · drop 글자가 없습니다. */

revoke execute on function public.alive_targets(text, integer, boolean) from public;
grant  execute on function public.alive_targets(text, integer, boolean) to service_role, anon;
