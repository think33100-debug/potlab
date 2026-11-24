/* 회원 재방문 — 11/24 이전 날을 남은 흔적으로 채웁니다 (한 번만 · 관리자 DB 연결로).

   흔적: 가입·마지막 로그인·로그인 세션·토큰 갱신(auth) · 글 · 댓글 · 좋아요 · 공고 기록.
   **아래쪽 어림입니다** — 흔적을 안 남기고 둘러보기만 한 날은 빠집니다(토큰은 오래된 것이 지워집니다).
   출처 '옛기록' 으로 적어 화면 기록('기록')과 가릅니다. 관리자·통계 제외 회원은 제외=true.
   이미 있는 줄은 건드리지 않습니다.

   되돌림: delete from public.회원방문일 where 출처 = '옛기록'; */

with t(u, ts) as (
  select id, created_at from auth.users
  union all select id, last_sign_in_at from auth.users where last_sign_in_at is not null
  union all select user_id, created_at from auth.sessions
  union all select user_id, updated_at from auth.sessions where updated_at is not null
  union all select user_id, refreshed_at::timestamptz from auth.sessions where refreshed_at is not null
  union all select user_id::uuid, created_at from auth.refresh_tokens where user_id is not null
  union all select user_id::uuid, updated_at from auth.refresh_tokens where user_id is not null and updated_at is not null
  union all select author_id, created_at from public.posts where author_id is not null
  union all select author_id, created_at from public.comments where author_id is not null
  union all select profile_id, created_at from public.post_likes where profile_id is not null
  union all select profile_id, created_at from public.job_events where profile_id is not null
),
d as (
  select distinct t.u, (t.ts at time zone 'Asia/Seoul')::date as 날
    from t where t.ts is not null
     and (t.ts at time zone 'Asia/Seoul')::date < (now() at time zone 'Asia/Seoul')::date
)
insert into public.회원방문일 (profile_id, 날, 제외, 출처)
select d.u, d.날,
       (p.excluded or exists (select 1 from public.admins a where a.profile_id = d.u)),
       '옛기록'
  from d join public.profiles p on p.id = d.u
 where p.erased_at is null
on conflict (profile_id, 날) do nothing;
