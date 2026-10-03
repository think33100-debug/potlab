-- ════════════════════════════════════════════════════════════════
--  봉사활동(VMS) · 교육학술(EDU) 을 수집 경로로 등록
--  2026-10-04 밤에 만들어 둠 — ⚠ 아직 **올리지 않았습니다**
-- ════════════════════════════════════════════════════════════════
--
--  ── 왜 필요한가 ──────────────────────────────────────────────
--  `collect_beat()` 는 `collect_source` 에 없는 경로를 거부합니다 —
--
--      HTTP 400 {"code":"22023","message":"모르는 경로입니다: EDU"}
--
--  박동이 안 남으면 **`/admin/beat` 이 「안 돌았다」를 못 알아챕니다.**
--  세중님이 「실패 시 /admin/beat 빨간 줄」을 조건으로 다셨는데,
--  지금 두 수집기는 박동 자체를 안 남기고 있었습니다 (2026-10-04에 찾음).
--  수집기 쪽은 이미 고쳐 두었습니다 — 이 줄만 들어가면 켜집니다.
--
--  ── 이 파일이 하는 일 ────────────────────────────────────────
--  표 두 줄을 넣습니다. **그것뿐입니다.**
--  DROP 없음 · DELETE 없음 · 칸 바꾸기 없음 · 함수 안 건드립니다.
--  되돌리려면 맨 아래 두 줄을 쓰십시오.
--
--  ⚠ 이 줄이 들어가면 `/admin/beat` 에 두 경로가 새로 보입니다.
--    크론을 아직 안 켰다면 **처음부터 빨간 줄**로 보일 수 있습니다
--    (「한 번도 안 돌았다」). 크론을 켜는 날 같이 올리는 것이 깔끔합니다.
-- ════════════════════════════════════════════════════════════════

insert into collect_source (code, name, note, live)
select 'VMS', '봉사활동(VMS)', '한국사회복지협의회 VMS · tools/collect-vms.mjs · 하루 1회', true
where not exists (select 1 from collect_source where code = 'VMS');

insert into collect_source (code, name, note, live)
select 'EDU', '교육·학술', '학회 교육과정 11곳 · tools/collect-edu.mjs · 하루 1회', true
where not exists (select 1 from collect_source where code = 'EDU');

-- 확인
--   select code, name, live from collect_source where code in ('VMS','EDU');
--   select * from beat_health() where 경로 in ('VMS','EDU');

-- ── 되돌리기 ────────────────────────────────────────────────────
--   delete from collect_source where code in ('VMS','EDU');
--   (박동 기록까지 지우려면)
--   delete from collector_beat where source in ('VMS','EDU');
