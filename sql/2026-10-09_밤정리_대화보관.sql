/* 대화 보관 기간을 세중님 결정대로 바꿉니다 (2026-10-09).

     사진   30일 뒤 지웁니다
     글     1년 그대로입니다
     신고   처리가 안 끝난 방은 글·사진 **모두 남깁니다**

   지금은 chat_messages 를 1년 뒤 통째로 지우는 한 줄뿐이고,
   신고를 보지 않습니다 — 신고된 대화가 1년에 조용히 사라집니다.

   ⚠ 이 파일에는 delete 가 들어 있어 승인 창이 뜹니다 (작업지침 8-7).
     세중님이 자리에 계실 때 올립니다.

   ⚠ 파일 자체는 SQL 로 못 지웁니다 — storage.protect_delete() 가 막습니다
     (tools/clean_orphan_files.js 머리글). 칸을 비우는 것까지가 여기 몫이고,
     chat-images 통의 실제 파일은 그 스크립트를 늘려서 치웁니다. */

-- ─────────────────────────────────────────────────────────────
-- ① 신고가 아직 안 끝난 방인가
-- ─────────────────────────────────────────────────────────────
create or replace function public."신고걸린방"(p_room bigint)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from reports r
     where r.handled_at is null
       and (
         (r.target_type = 'chat_room' and r.target_id = p_room)
         or (r.target_type = 'chat'
             and r.target_id in (select m.id from chat_messages m where m.room_id = p_room))
       )
  )
$$;

revoke execute on function public."신고걸린방"(bigint) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ② 밤정리 — 대화 부분만 바뀝니다. 나머지는 지금 것 그대로입니다
-- ─────────────────────────────────────────────────────────────
create or replace function public."밤정리"(p_secret text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_오늘   date := (now() at time zone 'Asia/Seoul')::date;
  v_이용   int := 0; v_이름 int := 0; v_이름남 int := 0;
  v_채팅   int := 0; v_신고 int := 0; v_접속 int := 0;
  v_판정   int := 0; v_사진 int := 0; v_신고남 int := 0;
  v_공고   jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  delete from job_events where created_at < now() - interval '90 days';
  get diagnostics v_이용 = row_count;

  /* 탈퇴 이름 30일 — 신고 처리 중이면 남깁니다.
     지문도 같이 지웁니다. 안 지우면 그 닉네임이 영영 잡혀 있게 됩니다 */
  update erased_accounts
     set 이름암호 = null, 이름지문 = null, 이름지운때 = now()
   where 이름암호 is not null
     and erased_at < now() - interval '30 days'
     and not 신고걸렸나(profile_id);
  get diagnostics v_이름 = row_count;

  select count(*) into v_이름남
    from erased_accounts
   where 이름암호 is not null and erased_at < now() - interval '30 days';

  /* ★ 2026-10-09 — 대화 사진은 30일입니다 (세중님 결정).
     칸을 비우면 주소를 아는 사람도 못 찾습니다. 파일은 clean_orphan_files.js 몫입니다 */
  update chat_messages m
     set image_path = null, image_thumb_path = null
   where (m.image_path is not null or m.image_thumb_path is not null)
     and m.created_at < now() - interval '30 days'
     and not 신고걸린방(m.room_id);
  get diagnostics v_사진 = row_count;

  /* ★ 2026-10-09 — 글은 1년 그대로. 다만 **신고가 안 끝난 방은 남깁니다.**
     전에는 이 줄에 신고 조건이 없어서, 신고된 대화도 1년이면 사라졌습니다 */
  delete from chat_messages m
   where m.created_at < now() - interval '1 year'
     and not 신고걸린방(m.room_id);
  get diagnostics v_채팅 = row_count;

  select count(*) into v_신고남
    from chat_messages m
   where m.created_at < now() - interval '1 year'
     and 신고걸린방(m.room_id);

  delete from reports where handled_at is not null and handled_at < now() - interval '1 year';
  get diagnostics v_신고 = row_count;

  delete from 개인정보접속기록 where 언제 < now() - interval '1 year';
  get diagnostics v_접속 = row_count;

  /* 순찰이 기억해 둔 판정입니다 (번호·출처·판정·판정때·지문뿐,
     공고 본문은 없습니다). 180일은 hide_stale_posts 의 180일과
     맞춘 값입니다 — 공고가 감춰진 뒤에도 그만큼 기억을 들고 있습니다 */
  delete from 수집판정 where 판정때 < now() - interval '180 days';
  get diagnostics v_판정 = row_count;

  /* ★ 마감일 없는 공고는 30일 입니다 (2026-10-07 세중님).
     전에는 45일이었습니다. 수시로 가려진 것은 180일 그대로입니다 */
  v_공고 := hide_stale_posts(30, 180);

  return jsonb_build_object(
    '이용 기록 지움(3개월)',      v_이용,
    '탈퇴 이름 파기(30일)',       v_이름,
    '신고 처리 중이라 남긴 이름',  v_이름남,
    '대화 사진 지움(30일)',       v_사진,
    '채팅 글 지움(1년)',          v_채팅,
    '신고 처리 중이라 남긴 대화',  v_신고남,
    '신고 기록 지움(처리 1년)',    v_신고,
    '관리자 접속기록 지움(1년)',   v_접속,
    '순찰 기억 지움(180일)',       v_판정,
    '공고 옮김',                  v_공고,
    '기준일',                     v_오늘);
end $function$;
