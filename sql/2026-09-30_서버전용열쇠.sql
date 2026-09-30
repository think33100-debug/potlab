-- ⚠ **아직 돌리지 않았습니다.** 세중님 답을 기다립니다 (2026-09-30).
--
-- ── 무엇이 문제인가 ────────────────────────────────────────
-- `collect_secret` 의 기본 열쇠가 **`PRIMARY KEY (source)`** 입니다.
-- 한 source 에 열쇠가 **하나뿐**입니다.
--
--   지금:  HS3 → 열쇠 하나 (GitHub Actions 의 옛 수집기가 씁니다)
--
-- 서버용 새 열쇠를 넣으려고 그 줄을 덮으면 **옛 수집기가 그 순간 죽습니다.**
-- 세중님이 「3일 나란히 돌리는 동안 옛 수집기가 계속 돌아야 한다」 고 하셨으니
-- 덮으면 안 됩니다. 그래서 멈추고 보고했습니다.
--
-- ── 고치는 길 ──────────────────────────────────────────────
-- 열쇠를 보는 함수 **29개를 전부 열어 봤습니다.** 하나도 빠짐없이 이 꼴입니다 —
--
--     if not exists (select 1 from collect_secret s
--                     where s.source = p_source and s.secret = p_secret ...)
--
-- **「있나」만 봅니다.** 값을 꺼내 쓰는 곳이 한 곳도 없습니다.
-- 그러니 한 source 에 줄이 둘이어도 **둘 다 그대로 통과합니다.**
-- 기본 열쇠를 (source) 에서 (source, secret) 으로 바꾸기만 하면 됩니다.
-- 옛 열쇠는 손대지 않습니다. 옛 수집기는 아무것도 못 느낍니다.
--
-- ── 되돌리는 법 ────────────────────────────────────────────
--   delete from collect_secret where note like '서버 전용%';
--   alter table collect_secret drop constraint collect_secret_pkey;
--   alter table collect_secret add primary key (source);
-- (서버 줄을 먼저 지워야 합니다. 안 그러면 옛 기본 열쇠가 안 걸립니다)

begin;

-- ① 한 source 에 열쇠를 여러 개 둘 수 있게
alter table collect_secret drop constraint collect_secret_pkey;
alter table collect_secret add constraint collect_secret_pkey primary key (source, secret);

comment on table collect_secret is
  '수집기가 DB 함수를 부를 때 내는 내부 열쇠. 한 source 에 여러 개 둘 수 있습니다 — '
  '서버로 옮기는 동안 옛 열쇠와 새 열쇠가 같이 살아 있어야 해서 2026-09-30 에 바꿨습니다. '
  '함수들은 「있나」만 보므로 어느 쪽이든 통과합니다.';

-- ② 서버 전용 열쇠를 넣는 자리.
--    값은 **관리자만** 부를 수 있는 함수로 만들고, 만든 값을 한 번만 돌려줍니다.
--    저장소·로그·채팅에 값을 안 적습니다.
create or replace function admin_new_collect_secret(p_source text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_새것 text;
begin
  if not is_admin() then raise exception '관리자만'; end if;
  if p_source is null or btrim(p_source) = '' then raise exception 'source 를 주세요'; end if;

  /* 32바이트를 밑수64로 — 옛것과 같은 길이입니다 */
  v_새것 := replace(replace(encode(gen_random_bytes(32), 'base64'), '/', '_'), '+', '-');

  insert into collect_secret (source, secret, note, made_on)
  values (btrim(p_source), v_새것,
          coalesce(p_note, '서버 전용 (Lightsail 서울)'), current_date);

  /* 부른 사람에게 한 번만 보여 줍니다. 로그에는 안 남습니다 */
  return jsonb_build_object('source', btrim(p_source), 'secret', v_새것,
    '몇 개', (select count(*) from collect_secret where source = btrim(p_source)));
end $$;

revoke all on function admin_new_collect_secret(text, text) from public;
grant execute on function admin_new_collect_secret(text, text) to authenticated;

commit;

-- ③ 확인 — 옛 열쇠가 그대로 있고 줄이 늘었는지 (값은 안 찍습니다)
-- select source, count(*) 열쇠수, min(made_on) 처음, max(made_on) 마지막
--   from collect_secret group by 1 order by 1;
