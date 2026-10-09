/* 커뮤니티 역할별 출입 (2026-10-09 · 세중님 위임 승인).

   ── 규칙 (세중님 원래 말씀) ─────────────────────────────────
   「치료사 커뮤니에서 학생 커뮤니는 못 들어가게,
     학생 커뮤니에선 치료사 커뮤니 보이게」

                     모두 방      치료사 방     학생 방
     학생             읽기·쓰기    읽기만        읽기·쓰기
     작업·물리치료사    읽기·쓰기    읽기·쓰기     ✗ 못 봄·못 씀
     담당자(role 없음)  읽기         읽기          ✗ 못 봄
     관리자            전부 봄 (is_admin)
     비회원·가입중      읽기         읽기          ✗ 못 봄
       → 로그아웃해서 학생 방을 보는 길이 없습니다

   ── 두 군데를 다 막습니다 ───────────────────────────────────
   회원 화면은 전부 **공개글 보기**를 읽습니다 (community · post · home).
   보기는 바탕 표의 RLS 를 안 거칩니다. 그래서
     ① 공개글·공개댓글 보기에 규칙을 넣고
     ② posts·comments 표에도 정책을 겁니다 (my-lists · write 처럼 표를 직접 읽는 자리)
   한쪽만 막으면 다른 쪽으로 샙니다.

   ── restrictive 인 까닭 ─────────────────────────────────────
   posts 에는 「글은 다 보입니다」 같은 허용 정책이 이미 있습니다. 보통 정책은
   OR 로 합쳐져서 더해 봐야 안 막힙니다. restrictive 는 AND 라 한 겹을 덧댑니다.

   ── 함수를 anon 에도 여는 까닭 ──────────────────────────────
   boolean 하나만 돌려줍니다. 비로그인도 공개글 보기를 읽고, 그 보기 안에서
   이 함수를 부릅니다. 안 열면 맛보기가 통째로 42501 이 납니다.

   ── 지우는 문장이 없습니다 ────────────────────────────────── */

-- ─────────────────────────────────────────────────────────────
-- ① 방이 어느 묶음인가 — lib/channels.ts 와 **글자까지 같습니다**
--    posts.channel 에는 id 가 들어갑니다 (이름이 아니라 free·clinic·exam …)
-- ─────────────────────────────────────────────────────────────
create or replace function public.방묶음(p_방 text)
returns text
language sql
immutable
as $$
  select case p_방
    when 'free'   then 'all'   when 'life'  then 'all'
    when 'love'   then 'all'   when 'edurv' then 'all'
    when 'clinic' then 'pro'   when 'pay'   then 'pro'
    when 'move'   then 'pro'   when 'itv'   then 'pro'
    when 'cert'   then 'pro'   when 'biz'   then 'pro'
    when 'exam'   then 'stu'   when 'prac'  then 'stu'
    when 'grade'  then 'stu'   when 'first' then 'stu'
    when 'campus' then 'stu'   when 'path'  then 'stu'
    else 'all' end
$$;

-- ─────────────────────────────────────────────────────────────
-- ② 볼 수 있나 — 학생 방만 학생(과 관리자)의 것입니다
-- ─────────────────────────────────────────────────────────────
create or replace function public.방볼수있나(p_방 text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case 방묶음(p_방)
    when 'stu' then coalesce(
      (select p.role = '학생' from profiles p where p.id = auth.uid()), false)
    else true end
$$;

-- ─────────────────────────────────────────────────────────────
-- ③ 쓸 수 있나 — role 이 없는 사람(담당자·비회원)은 어디에도 못 씁니다
-- ─────────────────────────────────────────────────────────────
create or replace function public.방에쓸수있나(p_방 text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select case 방묶음(p_방)
      when 'stu' then p.role = '학생'
      when 'pro' then p.role = '현직'
      else p.role in ('현직','학생') end
      from profiles p where p.id = auth.uid()
  ), false)
$$;

revoke execute on function public.방묶음(text)      from public;
revoke execute on function public.방볼수있나(text)   from public;
revoke execute on function public.방에쓸수있나(text) from public;
grant  execute on function public.방묶음(text)      to anon, authenticated;
grant  execute on function public.방볼수있나(text)   to anon, authenticated;
grant  execute on function public.방에쓸수있나(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- ④ 표에 한 겹 (표를 직접 읽는 자리 — my-lists · write)
-- ─────────────────────────────────────────────────────────────
create policy "학생 방은 학생만 봅니다" on public.posts
  as restrictive for select
  using (방볼수있나(channel) or is_admin());

create policy "쓸 수 있는 방에만 씁니다" on public.posts
  as restrictive for insert
  with check (방에쓸수있나(channel));

create policy "학생 방 댓글은 학생만 봅니다" on public.comments
  as restrictive for select
  using (방볼수있나((select x.channel from posts x where x.id = post_id)) or is_admin());

create policy "쓸 수 있는 방에만 댓글을 씁니다" on public.comments
  as restrictive for insert
  with check (방에쓸수있나((select x.channel from posts x where x.id = post_id)));

-- ─────────────────────────────────────────────────────────────
-- ⑤ 보기에도 같은 규칙 (회원 화면이 읽는 길)
--    칸은 하나도 안 바꿉니다 — where 한 줄만 더합니다
-- ─────────────────────────────────────────────────────────────
create or replace view public.공개글 as
 select p.id, p.channel, p.title, p.body, p.comment_count, p.like_count,
        p.view_count, p.created_at, p.edited_at,
        (p.author_id = auth.uid()) as "내글",
        jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar,
                           'erased_at', pr.erased_at) as profiles,
        (select count(*)::integer from post_images i where i.post_id = p.id) as "사진수"
   from posts p
   left join profiles pr on pr.id = p.author_id
  where not p.hidden
    and (방볼수있나(p.channel) or is_admin());

create or replace view public.공개댓글 as
 select c.id, c.post_id, c.parent_id, c.body, c.created_at,
        (c.author_id = auth.uid()) as "내글",
        jsonb_build_object('nickname', pr.nickname, 'avatar', pr.avatar,
                           'erased_at', pr.erased_at) as profiles
   from comments c
   join posts p on p.id = c.post_id and not p.hidden
   left join profiles pr on pr.id = c.author_id
  where not c.hidden
    and (방볼수있나(p.channel) or is_admin());
