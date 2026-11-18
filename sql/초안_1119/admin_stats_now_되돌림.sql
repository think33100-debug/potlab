-- admin_stats_now() 2026-11-19 고치기 전 본문 그대로 (pg_get_functiondef) · ACL {postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}
-- 인수가 같아 create or replace 로 되돌리면 ACL 은 그대로입니다
CREATE OR REPLACE FUNCTION public.admin_stats_now()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다'; end if;

  return jsonb_build_object(
    'today', today,
    'members',        (select count(*) from profiles where not excluded),
    'members_today',  (select count(*) from profiles
                       where not excluded
                         and (created_at at time zone 'Asia/Seoul')::date = today),
    'members_week',   (select count(*) from profiles
                       where not excluded and created_at >= now() - interval '7 days'),
    'job_groups', (select coalesce(jsonb_object_agg(coalesce(job_group, '안 정함'), n), '{}'::jsonb)
                   from (select job_group, count(*) n from profiles
                          where not excluded group by job_group) t),
    'roles',      (select coalesce(jsonb_object_agg(coalesce(role, '안 정함'), n), '{}'::jsonb)
                   from (select role, count(*) n from profiles
                          where not excluded group by role) t),
    'providers',  (select coalesce(jsonb_object_agg(p, n), '{}'::jsonb)
                   from (select coalesce(u.raw_app_meta_data->>'provider', '알 수 없음') p,
                                count(*) n
                         from profiles pr join auth.users u on u.id = pr.id
                         where not pr.excluded
                         group by 1) t),
    'jobs',         (select count(*) from job_posts where not hidden and not hold),
    'jobs_open',    (select count(*) from job_posts
                     where not hidden and not hold
                       and (apply_to is null or apply_to >= today)),
    'jobs_today',   (select count(*) from job_posts
                     where (collected_at at time zone 'Asia/Seoul')::date = today),
    'jobs_hold',    (select count(*) from job_posts where hold),

    /* ★ 2026-10-09 — 예시 글은 안 셉니다 */
    'posts',        (select count(*) from posts where not hidden and not 시험자료),
    'posts_today',  (select count(*) from posts
                     where not 시험자료
                       and (created_at at time zone 'Asia/Seoul')::date = today),
    'comments',     (select count(*) from comments c where not c.hidden
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),
    'comments_today',(select count(*) from comments c
                     where (c.created_at at time zone 'Asia/Seoul')::date = today
                       and not exists (select 1 from posts p
                                        where p.id = c.post_id and p.시험자료)),

    'notify_on',    (select count(*) from notification_settings where agreed),
    'orgs',         (select count(*) from org_directory)
  );
end $function$;
