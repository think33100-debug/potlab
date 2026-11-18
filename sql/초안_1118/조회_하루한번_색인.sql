-- 조회 기록 「하루 · 같은 사람 · 같은 화면 한 번」 유일 색인 (2026-11-18 초안 · 배포와 같은 때 올림)
-- 까닭: /api/hit 의 넣기 전 확인(select)이 비회원 열쇠로는 늘 빈 결과라 겹친 줄이 쌓였습니다(4,240줄 중 2,992 · 11/18).
-- 이미 쌓인 줄은 지우지 않습니다(승인 창 · 지침 8-7) — 그래서 색인은 **새 줄에만** 겁니다(id 가 지금 가장 큰 값보다 큰 줄).
-- 재방문 근사치 줄(day_key = 'revisit' 고정 글자)은 여러 브라우저가 같은 값을 쓰므로 뺍니다.
-- 화면 쪽 짝: web/app/api/hit/route.ts — 23505 를 「이미 셈」으로 받음. **색인과 화면을 같은 때** 올립니다
--   (색인만 먼저 올리면 옛 화면이 23505 를 500 으로 돌려주고 기록 실패 줄을 남깁니다 · 회원 화면엔 안 보임).
-- 되돌림: drop index if exists public.page_hits_once_per_day;   ← 「drop」 글자라 승인 창이 뜰 수 있음

do $$
declare v_max bigint;
begin
  select coalesce(max(id), 0) into v_max from public.page_hits;
  execute format(
    'create unique index if not exists page_hits_once_per_day on public.page_hits (day, kind, coalesce(target, %L), day_key) where id > %s and day_key <> %L',
    '', v_max, 'revisit');
end $$;

-- 확인 (읽기만)
--   select indexdef from pg_indexes where indexname = 'page_hits_once_per_day';
--   하루 뒤: 같은 날·같은 kind·target·day_key 가 두 줄인 새 줄(id > 위 값)이 0 인지
