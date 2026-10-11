/* 2026-10-11 밤 — 첨부 담는 창구 + 「오늘 밤 묶음」 표시 (세중님 지시)
 *
 * ── 왜 창구가 필요한가 ──────────────────────────────────────
 * 갈래 attach-prep(`e14de05`) 의 tools/첨부담기.mjs 가 `collect_attach` 를
 * 부르는데 **그 함수가 DB 에 없습니다.** 마른 실행은 되지만 진짜로 담으면
 * 「function not found」로 멈춥니다. 먼저 이것을 만듭니다.
 *
 * ── 오늘 밤 규칙 (세중님) ───────────────────────────────────
 *   · 새로 들어오는 공고는 **전부 보류함**으로 (회원 화면에 안 보임)
 *   · 오늘 넣는 모든 줄에 **수집묶음 = '1011밤'**
 *   · 기존 공고 덮어쓰기·지우기·백필은 하지 않음
 *
 * **collect_put 을 고치지 않습니다.** 21시 넘어 주 수집 경로를 건드리는 것이
 * 가장 위험합니다. 대신 **BEFORE INSERT 트리거 + 스위치**로 합니다 —
 * 스위치를 내리면(`update 수집묶음설정 set 켤까=false`) 그 자리에서 끝납니다.
 *
 * ── 되돌리기 ────────────────────────────────────────────────
 * `밤묶음숨기기('1011밤')` 가 **hidden=true** 로 돌립니다. 지우지 않습니다
 * (지침 8-7 — 밤에 `delete` 글자가 든 SQL 을 올리면 승인 창에 막힙니다).
 * 정말 지우는 쪽은 `docs/밤묶음_지우기_1011.sql` 에 글로만 두었습니다.
 */

/* ── ① 묶음 칸 ──────────────────────────────────────────── */
alter table job_posts       add column if not exists 수집묶음 text;
alter table job_attachments add column if not exists 수집묶음 text;

create index if not exists job_posts_수집묶음_idx
  on job_posts (수집묶음) where 수집묶음 is not null;

comment on column job_posts.수집묶음 is
  '그 줄이 어느 작업에서 들어왔나. 한 번에 되돌릴 때 씁니다 (2026-10-11)';


/* ── ② 스위치 — 한 줄만 있는 표 ──────────────────────────── */
create table if not exists 수집묶음설정 (
  하나   boolean primary key default true check (하나),
  켤까   boolean not null default false,
  묶음   text,
  켠때   timestamptz,
  메모   text
);

alter table 수집묶음설정 enable row level security;   /* 창구로만 봅니다 */

insert into 수집묶음설정 (하나, 켤까, 묶음, 켠때, 메모)
values (true, true, '1011밤',
        now(), '2026-10-11 밤 작업 — 새 공고를 전부 보류함으로 (세중님 지시)')
on conflict (하나) do update
   set 켤까 = true, 묶음 = '1011밤', 켠때 = now(), 메모 = excluded.메모;


/* ── ③ 트리거 — 새로 들어오는 공고에 묶음 + 보류 ──────────── */
create or replace function 밤묶음표시()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_묶음 text;
begin
  /* 담당자가 손으로 올린 공고(BIZ)와 시험 줄은 건드리지 않습니다 —
     사람이 이미 보고 올린 것이라 보류함에 넣을 까닭이 없습니다 */
  if new.source = 'BIZ' or coalesce(new.시험자료, false) then
    return new;
  end if;

  select case when s.켤까 then s.묶음 end into v_묶음
    from 수집묶음설정 s where s.하나;

  if v_묶음 is null then
    return new;                      /* 스위치가 내려가 있으면 아무 일도 안 합니다 */
  end if;

  new.수집묶음 := v_묶음;            /* 숨길 공고에도 적어 둡니다 — 되돌릴 때 셉니다 */

  /* ⚠ `hidden` 이 `hold` 보다 셉니다. job_posts_one_state_trg 가
     「hidden and hold → hold := false」 로 묶어 두는데, 그 트리거는 이름 순서상
     **이것보다 먼저** 돕니다 (job_… < 밤…). 그래서 여기서 hold 를 켜면
     「hidden 이면서 hold」라는 없는 상태가 만들어집니다.
     숨길 공고는 이미 회원에게 안 보이므로 그대로 둡니다 */
  if coalesce(new.hidden, false) then
    return new;
  end if;

  new.hold := true;                  /* job_posts_pub 가 NOT hold 로 걸러 회원에게 안 보입니다 */
  return new;
end
$$;

revoke execute on function 밤묶음표시() from public, anon;

comment on function 밤묶음표시() is
  '수집묶음설정.켤까 가 켜져 있는 동안 새 공고를 보류함 + 묶음 표시 (2026-10-11)';

create trigger 밤묶음_넣을때
  before insert on job_posts
  for each row execute function 밤묶음표시();


/* ── ④ 첨부 담는 창구 ──────────────────────────────────────
   collect_body 와 같은 꼴입니다 — 경로 확인 → 열쇠 확인 → 배열 확인 → 한 줄씩.
   한 줄이 탈나도 나머지는 담습니다 (begin…exception 으로 감쌉니다) */
create or replace function collect_attach(p_secret text, p_source text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok int := 0; v_bad int := 0; v_겹침 int := 0; v_공고없음 int := 0;
  v_묶음 text; r jsonb; v_탈 text := null;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  select case when s.켤까 then s.묶음 end into v_묶음
    from 수집묶음설정 s where s.하나;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id','') = '' or coalesce(r->>'url','') = '' then
        raise exception '공고ID 나 주소가 없습니다';
      end if;
      /* &amp; 가 안 풀린 주소는 **담기 전에 막습니다.** 담고 나서 고치면
         이미 들어간 줄이 남습니다 (지침 5절 · 9절) */
      if r->>'url' ~ '&amp;|&#38;' then
        raise exception '주소에 &amp; 가 안 풀렸습니다';
      end if;
      /* 그 공고가 우리 표에 있나 — 없으면 FK 로 터지는 대신 세어 둡니다 */
      if not exists (select 1 from job_posts j where j.id = r->>'job_id') then
        v_공고없음 := v_공고없음 + 1;
        continue;
      end if;

      insert into job_attachments (job_id, kind, name, url, 수집묶음)
      values (r->>'job_id', coalesce(r->>'kind', '공고문'),
              left(coalesce(r->>'name', ''), 200), r->>'url', v_묶음)
      on conflict (job_id, url) do nothing;

      if found then v_ok := v_ok + 1; else v_겹침 := v_겹침 + 1; end if;
    exception when others then
      v_bad := v_bad + 1;
      if v_탈 is null then v_탈 := left(sqlerrm, 160); end if;
    end;
  end loop;

  return jsonb_build_object(
    '담음', v_ok, '겹침', v_겹침, '건너뜀', v_bad, '공고없음', v_공고없음,
    '묶음', v_묶음, '첫탈', v_탈,
    '표 줄수', (select count(*) from job_attachments));
end
$$;

revoke execute on function collect_attach(text, text, jsonb) from public, anon;
grant  execute on function collect_attach(text, text, jsonb) to service_role;

comment on function collect_attach(text, text, jsonb) is
  '수집기가 공고문 첨부 주소를 담는 창구. &amp; 안 풀린 주소는 막습니다 (2026-10-11)';


/* ── ⑤ 되돌리기 — 지우지 않고 숨깁니다 ──────────────────── */
create or replace function 밤묶음본것(p_묶음 text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    '묶음', p_묶음,
    '공고', (select count(*) from job_posts     where 수집묶음 = p_묶음),
    '공고_보류중', (select count(*) from job_posts where 수집묶음 = p_묶음 and hold),
    '공고_숨김', (select count(*) from job_posts where 수집묶음 = p_묶음 and hidden),
    '첨부', (select count(*) from job_attachments where 수집묶음 = p_묶음),
    '출처별', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb)
                 from (select source, count(*) n from job_posts
                        where 수집묶음 = p_묶음 group by source) t));
$$;

create or replace function 밤묶음숨기기(p_묶음 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update job_posts
     set hidden = true,
         hidden_why = '수집묶음 ' || p_묶음 || ' 되돌림',
         hidden_on  = (now() at time zone 'Asia/Seoul')::date
   where 수집묶음 = p_묶음 and not hidden;
  get diagnostics v_n = row_count;
  return jsonb_build_object('숨긴것', v_n, '남은것', 밤묶음본것(p_묶음));
end
$$;

revoke execute on function 밤묶음본것(text)   from public, anon;
revoke execute on function 밤묶음숨기기(text) from public, anon;
grant  execute on function 밤묶음본것(text)   to service_role;
grant  execute on function 밤묶음숨기기(text) to service_role;
