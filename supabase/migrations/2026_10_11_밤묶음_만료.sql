/* ⚠ 2026-10-11 23시 — **이 트리거는 쓰지 않습니다.** 2026_10_11_밤묶음_upsert덫.sql
   을 보십시오. BEFORE INSERT 트리거가 upsert 의 excluded.hold 를 바꿔
   기존 공고 278건을 보류로 밀었습니다 (회원 화면 358 → 80). 지침 8-14 */

/* 수집묶음 스위치가 **저절로 꺼지게** 합니다 (2026-10-11 세중님 지시).
 *
 * 손으로 내리는 것은 잊습니다. 잊으면 새 공고가 계속 보류함으로만 들어가
 * 회원 화면에 안 보입니다 — **조용한 탈**입니다.
 *
 * 그래서 「언제까지」를 칸으로 둡니다. 트리거가 그 시각을 넘었으면
 * 스위치를 본 그 자리에서 그냥 안 켭니다. 크론도 따로 안 씁니다 —
 * **볼 때마다 판단하는 쪽**이 잊을 자리가 없습니다.
 */

alter table 수집묶음설정 add column if not exists 까지 timestamptz;

comment on column 수집묶음설정.까지 is
  '이 시각을 넘으면 트리거가 아무 일도 안 합니다. 손으로 내리는 것을 잊지 않으려고';

update 수집묶음설정
   set 까지 = timestamptz '2026-10-12 10:00:00+09',
       메모 = '2026-10-11 밤 작업 — 새 공고를 전부 보류함으로. 10-12 10:00 KST 에 저절로 꺼집니다'
 where 하나;

/* 트리거 함수 — 만료 시각을 함께 봅니다 */
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

  /* ★ 2026-10-11 — 「켤까」와 **「까지」를 함께** 봅니다.
     까지가 비어 있으면 끝이 없는 것으로 보고 켤까만 따릅니다 */
  select case when s.켤까 and (s.까지 is null or now() < s.까지) then s.묶음 end
    into v_묶음
    from 수집묶음설정 s where s.하나;

  if v_묶음 is null then
    return new;                      /* 꺼졌거나 만료됐으면 아무 일도 안 합니다 */
  end if;

  new.수집묶음 := v_묶음;            /* 숨길 공고에도 적어 둡니다 — 되돌릴 때 셉니다 */

  /* ⚠ `hidden` 이 `hold` 보다 셉니다. job_posts_one_state_trg 가
     「hidden and hold → hold := false」 로 묶어 두는데, 그 트리거는 이름 순서상
     **이것보다 먼저** 돕니다 (job_… < 밤…). 그래서 여기서 hold 를 켜면
     「hidden 이면서 hold」라는 없는 상태가 만들어집니다 */
  if coalesce(new.hidden, false) then
    return new;
  end if;

  new.hold := true;                  /* job_posts_pub 가 NOT hold 로 걸러 회원에게 안 보입니다 */
  return new;
end
$$;

revoke execute on function 밤묶음표시() from public, anon;

/* 지금 어떤 상태인가를 한 번에 보는 자리 */
create or replace function 밤묶음스위치()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    '켤까', s.켤까, '묶음', s.묶음, '까지', s.까지,
    '지금_도나', (s.켤까 and (s.까지 is null or now() < s.까지)),
    '남은분', case when s.까지 is null then null
                  else greatest(0, round(extract(epoch from (s.까지 - now())) / 60)) end,
    '메모', s.메모)
  from 수집묶음설정 s where s.하나;
$$;

revoke execute on function 밤묶음스위치() from public, anon;
grant  execute on function 밤묶음스위치() to service_role;
