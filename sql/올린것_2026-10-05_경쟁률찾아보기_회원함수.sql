-- 2026-10-05. 「경쟁률 찾아보기」 회원용 함수 둘 + 늦음 기준 + 262387 바로잡기.
--
-- 가운데 길 (세중님 결정) —
--   목록은 누구나 봅니다. **숫자는 목록 함수가 아예 안 내보냅니다.**
--   화면에서 가리면 개발자 도구 네트워크 응답에 값이 그대로 보입니다.
--   한 묶음의 숫자는 auth.uid() 를 보고 줍니다.
--
-- 확인한 것 — 비로그인 응답 원문에 평균·가장높음·가장낮음이 없습니다 (아래 ④)
--            회원에게 나가는 묶음 222개 · 기관 19곳 · 지역 41가지


-- ───────── ① 경상국립대 sn 262387 을 우리 직군에서 뺍니다 ─────────
-- 알리오 묶음 이름이 「치과기공사(물리치료사)」입니다. 우리 말이 들어 있어
-- 물리치료사로 찍혔지만 자리 이름은 「치과기공사」로 남았습니다.
-- 같은 공고의 다른 묶음이 「의료기술직(치과기공사)」·「시설기술직(환경)」·
-- 「원무직(사무보조)」 꼴이라 이름 규칙은 「상위직군(세부자리)」입니다.
-- 어느 쪽이 맞는지 알리오 자료로 못 가리므로, 우리 것이라고 주장하지 않습니다
-- (그대로 두면 치과기공사 경쟁률 30 대 1 이 물리치료사 평균에 들어갑니다).
--
-- alio_group_src 가 alio_compete_web.our_job 을 읽으므로 다시 긁지 않아도 됩니다.
-- 코드도 같이 고쳤습니다 — tools/alio-compete.mjs · alio-compete-web.mjs 의
-- 직군가리기() 에 「다른 면허 직군 이름이 남으면 우리 것이 아니다」를 넣었습니다
-- (자료 16,533줄에 걸어 보니 걸리는 묶음이 이 하나뿐 · 엉뚱한 것 0건).
update alio_compete_web
   set our_job = false, mixed = true, 직군키 = '직군 구분 없음'
 where sn = 262387 and group_name = '치과기공사(물리치료사)';

update alio_compete
   set our_job = null, mixed = true
 where sn = 262387 and step_ttl = '치과기공사(물리치료사)';


-- ───────── ② 늦음 기준 — 실제 크론 주기와 가장 긴 틈에 맞춥니다 ─────────
-- beat_health 는 「최근 박동 간격 가운데값 × 2」로 긋는데, 낮에 자주 도는
-- 경로는 가운데값이 낮 간격으로 잡혀 **밤 틈에서** 빨간 줄이 섭니다.
-- 아래 값은 지난 30일 collector_beat 의 가장 긴 틈을 재서 정했습니다.
update collect_source set "늦음기준시간" = 2  where code in ('AL2','CE2');
  -- 낮 5분 · 밤 30분 · 가장 긴 틈 0.52~0.61시간
update collect_source set "늦음기준시간" = 12 where code in ('HS3','WN2','PUSH');
  -- HS3  07~22시 매시 + 23:40 · 가장 긴 틈 9.01시간
  -- WN2  하루 1번 09:55 + 그 밖 · 가장 긴 틈 10.09시간
  -- PUSH 30분(7~21시) · 밤 틈 9.5시간 (21:38 → 07:08)
update collect_source set "늦음기준시간" = 18 where code in ('GJ2','ND2','JF','WNX');
  -- GJ2·ND2  7·13·19시 · 밤 틈 12시간 (지금 기준 12.0 과 턱걸이)
  -- JF       7·13·19시 · 가장 긴 틈 44.5시간이었지만 **멈춘 게 아닙니다** —
  --          박동을 안 부르던 기간입니다 (collect-jobflex.mjs:307 주석,
  --          2026-10-02 에 고쳐짐). 실제 최대 틈은 밤 12시간입니다
  -- WNX      워크넷이 부릅니다 · 가장 긴 틈 14시간
-- 결과 — beat_health() 경로 12곳 · 빨간 줄 0개


-- ───────── ③ 목록 — 누구나. 숫자 없음 ─────────
create or replace function "경쟁률찾기목록"(
  "p_직군" text default null, "p_지역" text default null,
  "p_기관" text default null, "p_찾기" text default null,
  "p_쪽" int default 1)
returns jsonb
language sql stable security definer set search_path to 'public'
as $function$
  with 낼것 as (
    select * from alio_group_sum
     where 우리직군 and not 짝확인필요 and not 고용형태확인필요
       and not 합쳐짐 and 값있음 > 0
  ), 걸러진 as (
    select * from 낼것
     where (p_직군 is null or 직군 = p_직군)
       and (p_지역 is null or 지역 = p_지역)
       and (p_기관 is null or 기관 = p_기관)
       and (p_찾기 is null or btrim(p_찾기) = ''
            or 기관 ilike '%'||p_찾기||'%' or coalesce(자리,'') ilike '%'||p_찾기||'%')
  )
  select jsonb_build_object(
    '전체', (select count(*) from 걸러진),
    '쪽', greatest(coalesce(p_쪽,1), 1),
    '쪽당', 30,
    '직군들', (select coalesce(jsonb_agg(distinct 직군), '[]'::jsonb) from 낼것),
    '지역들', (select coalesce(jsonb_agg(x), '[]'::jsonb)
               from (select distinct 지역 x from 낼것 order by 1) t),
    '기관들', (select coalesce(jsonb_agg(x), '[]'::jsonb)
               from (select distinct 기관 x from 낼것 order by 1) t),
    '묶음', (select coalesce(jsonb_agg(jsonb_build_object(
                '묶음키', 묶음키, '기관', 기관, '직군', 직군,
                '지역', 지역, '고용형태', 고용형태, '자리', 자리,
                '회차', 회차, '첫해', 첫해, '끝해', 끝해,
                '기본값단계', 기본값단계
                /* ★ 평균·가장높음·가장낮음·값있음 은 넣지 않습니다 */
              ) order by 회차 desc, 기관, 직군), '[]'::jsonb)
             from (select * from 걸러진 order by 회차 desc, 기관, 직군
                    limit 30 offset (greatest(coalesce(p_쪽,1),1) - 1) * 30) p)
  )
$function$;

-- ───────── ④ 한 묶음 — 로그인한 회원만. 숫자 포함 ─────────
-- 전문은 길어서 DB 에서 꺼내 보십시오 —
--   select pg_get_functiondef('경쟁률한묶음(text)'::regprocedure);
-- 첫 줄이 이것입니다 —
--   if auth.uid() is null then
--     raise exception '로그인이 필요합니다' using errcode = '42501';
--   end if;
-- anon 에게도 실행 권한을 줍니다. 그래야 화면이 권한 오류가 아니라
-- 「로그인하면 볼 수 있어요」를 띄울 수 있습니다.

revoke all on function "경쟁률찾기목록"(text, text, text, text, int) from public;
grant execute on function "경쟁률찾기목록"(text, text, text, text, int) to anon, authenticated;
revoke all on function "경쟁률한묶음"(text) from public;
grant execute on function "경쟁률한묶음"(text) to anon, authenticated;
