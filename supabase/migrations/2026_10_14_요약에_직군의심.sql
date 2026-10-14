/* 아침·15시 요약에 「직군 의심」을 넣습니다 — 2026-10-14 세중님 결정 (결정 3)
 *
 * 그물 자체는 `2026_10_14_직군의심.sql` 의 `직군의심()` 입니다. 여기는 그걸
 * **요약 창구 한 번에 실어 보내는** 일만 합니다 — `tools/hold-digest.mjs` 는
 * 열쇠로 `hold_digest()` 하나만 부르고, `직군의심()` 은 service_role 에만 열려
 * 있어서 그 스크립트가 직접 못 부릅니다.
 *
 * ⚠ 인수에 `default 24` 가 붙어 있습니다. 빼고 올리면
 *   `42P13 cannot remove parameter defaults` 로 막히고 DROP 이 필요해져
 *   승인 창이 뜹니다 (지침 6-2 · 8-7). 처음에 그렇게 막혔습니다.
 *
 * 더한 것은 세 자리뿐입니다 — `v_의심` 선언 · `v_의심 := "직군의심"()` ·
 * 돌려주는 칸 `'직군 의심'`, 그리고 「보낼것있나」 에 `의심 > 0` 을 넣은 것.
 */
create or replace function hold_digest(p_secret text, p_source text, p_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_보류 jsonb; v_샘 jsonb; v_늦음 jsonb; v_수 int; v_영자 int; v_한도 jsonb; v_기준 jsonb;
  v_신고 int; v_마름 jsonb; v_영자다시 int; v_의심 jsonb;
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

  /* ★ 2026-10-11 — 둘로 나눕니다. 경보는 「두 번 다 0자」만 */
  select count(*) filter (where 두번째도0),
         count(*) filter (where not 두번째도0)
    into v_영자, v_영자다시
    from ocr_zero where 때 > now() - make_interval(hours => p_hours);

  v_한도 := api_quota_today();
  v_기준 := pub_baseline_check();
  select count(*) into v_신고 from 공고신고 where handled_at is null;
  v_마름 := 새공고마름();
  /* ★ 2026-10-14 — 「직군 의심」 (세중님 결정 3). 기관 원문에 우리 직군 말이
     없는데 직군이 붙어 회원 화면에 있는 공고. 통합공고는 따로 셉니다 */
  v_의심 := "직군의심"();

  return jsonb_build_object(
    '때', now(), '몇시간치', p_hours,
    '새 보류 건수', v_수, '새 보류', v_보류,
    '회원 화면', v_샘, '늦은 수집기', v_늦음,
    'PDF 0자', v_영자,
    'PDF 0자 다시읽힘', v_영자다시,
    '하루 한도', v_한도, '기준값', v_기준,
    '오류 신고', v_신고,
    '공고마름', v_마름,
    '직군 의심', v_의심,
    '보낼것있나', (v_수 > 0) or coalesce((v_샘->>'샘')::boolean, false)
                  or (jsonb_array_length(v_늦음) > 0) or (v_영자 > 0)
                  or (v_신고 > 0)
                  or coalesce((v_마름->>'마름')::boolean, false)
                  or coalesce((v_의심->>'의심')::int, 0) > 0
                  or (coalesce((v_한도->>'넘은것')::int, 0) > 0)
                  or coalesce((v_기준->>'넘었나')::boolean, false));
end
$$;

revoke execute on function hold_digest(text, text, integer) from public;
grant  execute on function hold_digest(text, text, integer) to anon;
