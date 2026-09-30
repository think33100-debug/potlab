-- ⚠ 되돌리는 SQL — 무언가 잘못되면 **이것부터** 돌리십시오 (2026-09-30).
--
-- 무엇을 되돌리나 —
--   sql/2026-09-30_서버전용열쇠.sql 이 collect_secret 의 기본 열쇠를
--   (source) 에서 (source, secret) 으로 바꿨습니다.
--   한 source 에 열쇠를 여러 개 둘 수 있게 한 것입니다.
--
-- ── 순서를 지키십시오 ──────────────────────────────────────
-- ① 서버 전용 줄을 **먼저** 지웁니다.
--    안 지우고 기본 열쇠부터 되돌리면 「같은 source 가 둘」 이라 실패합니다.
-- ② 그다음 기본 열쇠를 (source) 로 되돌립니다.
--
-- 되돌린 뒤에는 한 source 에 열쇠가 하나뿐이 됩니다 — 옛 상태 그대로입니다.

begin;

-- ① 서버 전용으로 넣은 줄만 지웁니다. **옛 열쇠는 안 건드립니다**
delete from collect_secret where note like '서버 전용%';

-- 혹시 한 source 에 아직 둘 이상 남아 있으면 여기서 멈춥니다 (덮어쓰지 않으려고)
do $$
declare v int;
begin
  select count(*) into v from (
    select source from collect_secret group by source having count(*) > 1) z;
  if v > 0 then
    raise exception '아직 한 source 에 열쇠가 여러 개인 곳이 %곳 있습니다. '
      'select source, count(*) from collect_secret group by 1 having count(*)>1; '
      '으로 보고 손으로 정리한 뒤 다시 돌리십시오', v;
  end if;
end $$;

-- ② 기본 열쇠를 옛 모양으로
alter table collect_secret drop constraint collect_secret_pkey;
alter table collect_secret add constraint collect_secret_pkey primary key (source);

-- ③ 새 열쇠를 만드는 함수도 치웁니다
drop function if exists admin_new_collect_secret(text, text);

comment on table collect_secret is
  '수집기가 DB 함수를 부를 때 내는 내부 열쇠. 한 source 에 하나입니다.';

commit;

-- ④ 확인 (값은 안 찍습니다)
-- select source, count(*) 열쇠수 from collect_secret group by 1 order by 1;
