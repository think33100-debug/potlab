/* 「평일인데 새 공고가 안 들어온다」를 하루 요약에 넣습니다 (2026-10-11 세중님 지시).
 *
 * 왜 — 10-09~11 에 새 공고가 거의 0이었는데 아무도 몰랐습니다. 이번에는
 * 한글날+주말이어서 멀쩡한 것이었지만, 정말 멈춰도 똑같이 조용합니다.
 * 수집기는 ok=true 로 돌면서 공고를 0건 담을 수 있습니다 (출처가 막히면 그렇습니다).
 *
 * 기준을 짐작하지 않고 실측했습니다 — 최근 40일 평일 09~22시(서울)의
 * **새 공고 사이 최대 공백은 2.4시간**(10-07)이었습니다. 그 2.5배인
 * **업무시간 6시간**을 기준으로 둡니다.
 *
 * 주말·공휴일은 **시간을 아예 안 셉니다.** 그래서 금요일 밤에 멈추면
 * 월요일 낮에야 울립니다 — 그게 맞습니다. 토·일에 공고가 없는 것은 정상이고,
 * 그때 울리면 사람이 알림을 안 보게 됩니다 (hold-digest 머리말의 그 까닭).
 */

create or replace function 새공고마름()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_마지막 timestamptz;
  v_업무시간 int;
  v_기준 int := 6;        /* 실측 최대 공백 2.4시간의 2.5배 */
begin
  /* 시험 공고(BIZ·시험자료)는 안 셉니다 — 제가 넣은 것이 알림을 끄게 하면 안 됩니다 */
  select max(db_insert_at) into v_마지막
    from job_posts
   where coalesce(시험자료, false) = false and source <> 'BIZ';

  if v_마지막 is null then
    return jsonb_build_object('마름', false, '왜', '견줄 것이 없습니다');
  end if;

  /* 그 뒤로 **평일 09~21시(서울)가 몇 시간** 지났나 */
  select count(*) into v_업무시간
    from generate_series(
           date_trunc('hour', v_마지막 at time zone 'Asia/Seoul') + interval '1 hour',
           date_trunc('hour', now()      at time zone 'Asia/Seoul'),
           interval '1 hour') h
   where extract(dow from h) between 1 and 5
     and h::date not in (select 날 from 공휴일)
     and extract(hour from h) between 9 and 21;

  return jsonb_build_object(
    '마름', v_업무시간 >= v_기준,
    '업무시간', v_업무시간,
    '기준', v_기준,
    '마지막새공고', v_마지막,
    '몇시간째', round(extract(epoch from (now() - v_마지막)) / 3600.0, 1));
end
$$;

revoke execute on function 새공고마름() from public, anon;
grant  execute on function 새공고마름() to service_role;

comment on function 새공고마름() is
  '평일 업무시간으로 세어 새 공고가 N시간 안 들어왔나. 주말·공휴일은 안 셉니다';


/* hold_digest 에 한 갈래를 더합니다. 인수는 그대로이므로 **같은 함수**입니다
   (6-2 — 인수를 바꾸면 새 함수가 되어 권한이 PUBLIC 으로 돌아갑니다) */
/* ⚠ `p_hours integer default 24` — **기본값을 꼭 같이 적습니다.**
   빼면 `cannot remove parameter defaults from existing function` 으로 거절됩니다
   (2026-10-11 에 한 번 걸렸습니다). drop 하지 않고 고치려면 이 한 글자가 필요합니다 */
create or replace function hold_digest(p_secret text, p_source text, p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_보류 jsonb; v_샘 jsonb; v_늦음 jsonb; v_수 int; v_영자 int; v_한도 jsonb; v_기준 jsonb;
  v_신고 int; v_마름 jsonb;
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(x order by x->>'기관'), '[]'::jsonb), count(*)
    into v_보류, v_수
  from (
    select jsonb_build_object(
             '기관', j.org_name, '제목', left(j.title, 90), '주소', j.url,
             '까닭', left(coalesce(j.evidence->>'보류사유', j.evidence->>'사유', ''), 90),
             '경로', j.source, '마감', j.apply_to) x
      from job_posts j
     where j.hold and not j.hidden
       and j.collected_at > now() - make_interval(hours => p_hours)
     limit 120
  ) t;

  v_샘 := pub_leak();
  select coalesce(jsonb_agg(jsonb_build_object(
           '경로', b.이름, '몇시간째', b.몇시간째, '왜', b.왜)), '[]'::jsonb)
    into v_늦음 from beat_health() b where b.빨간줄;

  select count(*) into v_영자 from ocr_zero where 때 > now() - make_interval(hours => p_hours);
  v_한도 := api_quota_today();
  v_기준 := pub_baseline_check();
  /* ★ 2026-10-07 — 회원이 보낸 「오류 신고」 가 아직 안 처리된 건수 */
  select count(*) into v_신고 from 공고신고 where handled_at is null;
  /* ★ 2026-10-11 — 「평일인데 새 공고 0건」 */
  v_마름 := 새공고마름();

  return jsonb_build_object(
    '때', now(), '몇시간치', p_hours,
    '새 보류 건수', v_수, '새 보류', v_보류,
    '회원 화면', v_샘, '늦은 수집기', v_늦음,
    'PDF 0자', v_영자, '하루 한도', v_한도, '기준값', v_기준,
    '오류 신고', v_신고,
    '공고마름', v_마름,
    '보낼것있나', (v_수 > 0) or coalesce((v_샘->>'샘')::boolean, false)
                  or (jsonb_array_length(v_늦음) > 0) or (v_영자 > 0)
                  or (v_신고 > 0)
                  or coalesce((v_마름->>'마름')::boolean, false)
                  or (coalesce((v_한도->>'넘은것')::int, 0) > 0)
                  or coalesce((v_기준->>'넘었나')::boolean, false));
end
$$;

/* 전과 똑같은 권한으로 다시 걸어 둡니다 — 바꾸지 않습니다.
   고치기 전 값: {postgres, service_role, anon, authenticated} · PUBLIC 없음.
   anon 에 열려 있어도 **열쇠(collect_secret)를 맞춰야** 돕니다 */
revoke execute on function hold_digest(text, text, integer) from public;
grant  execute on function hold_digest(text, text, integer) to anon, authenticated, service_role;
