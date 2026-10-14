/* ① 「대상인데 안 긁는 1층 병원」을 세는 창구 (2026-10-13)

   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.
   ★ 이 파일에는 지우는 문장이 없습니다. 승인 창이 안 뜹니다.

   ═══ 왜 만드나 ═════════════════════════════════════════════

   강동경희대학교병원을 **우연히** 찾았습니다 (2026-10-13 · 대학병원인데
   어느 출처에도 공고가 0건이었습니다). 세중님 지시 —
   「같은 구멍을 체계로 찾기 … 이 대조를 주 1회 점검에도 넣기」.

   ═══ 어떻게 세나 ═══════════════════════════════════════════

     대상     org_targets 에서 갈래가 상급종합 · 종합병원 · 대학병원 ·
              공공보건의료 인 곳 (= 1층). 보건기관·치매센터는 안 셉니다
              (보건소는 별도 일감이고, 치매센터는 중앙 게시판으로 모입니다 —
               지침 15절 · org_targets.커버리지분모 = false)
     긁는곳   hosp_sites 의 이름 + cfgs 로 더한 곳
     들어온곳 최근 180일에 공고가 들어온 기관 (출처 무관)

   이름은 **`견줄이름()` 한 벌**로만 맞춥니다 (지침 6절 · 10-3 —
   이름 정규화는 **후보를 찾는 데만** 씁니다. 판정에는 안 씁니다.
   여기 결과는 「사람이 열어 볼 목록」이고, 넣을지는 사람이 정합니다).

   한 기관이 갈래 둘에 있을 때(예: 상급종합이면서 대학병원)는
   **값진 쪽을 남깁니다** — 상급종합 → 대학병원 → 공공보건의료 → 종합병원.

   ═══ 돌려주는 것 ═══════════════════════════════════════════

     상태 = '사이트있음'    긁는 목록에 이름이 있습니다
            '공고만들어옴'  목록엔 없는데 180일 안에 공고가 들어왔습니다
                           (= API 로 덮이는 곳. 사이트를 안 붙여도 됩니다)
            '사각지대'      목록에도 없고 공고도 0건. **열어 봐야 하는 곳**

   ═══ 2026-10-13 첫 셈 (이 함수와 같은 질의로) ═══════════════

     대상 1층 549곳(이름 중복 뺀 것)

       상태          곳수   상급종합  대학병원  공공보건의료  종합병원
       사이트있음     284      33       31        50        170
       사각지대      246      12       22       155         57
       공고만들어옴    19       2        4         9          4

     사각지대 246 중 공공보건의료 155 는 대부분 요양병원(81)·병원(37)·
     정신병원(16)·의원(6)·치과병원(7)·한의원(2) 입니다 — 1층이지만
     우리 직군이 드문 자리라 뒤로 둡니다. **먼저 볼 것은 상급종합 12 ·
     대학병원 22 중 종합병원·병원 갈래 · 공공보건의료 종합병원 5 ·
     종합병원 57** 입니다.

     상급종합 12곳 — 세브란스(신촌) · 강남세브란스 · 서울아산 · 강북삼성 ·
     고려대 구로·안산·안암 · 한양대(본원) · 울산대 · 조선대 · 삼성창원 ·
     양산부산대. 세 쪽(대상·사이트·공고)을 나란히 찍어 **이름 맞추기 실패가
     아님**을 확인했습니다 — 삼성서울·원주세브란스·용인세브란스·보령아산·
     정읍아산·홍천아산·강릉아산은 목록에 있어서 안 걸렸습니다.

   ═══ 주의 — hosp_sites 와 수집기 목록이 **둘**입니다 ════════

   수집기(`collect-hosp.mjs`)는 `tools/hosp/hosp-sites.json` 을 읽고,
   이 함수는 DB `hosp_sites` 를 읽습니다. 2026-10-13 에 **이름 285개가
   글자까지 같음**을 md5 로 확인했습니다 (`bcd461e2…`). 그래도 둘이
   갈라지면 이 셈이 거짓말을 합니다. 그래서 부르는 도구
   `tools/일층병원_구멍.mjs` 가 **md5 를 먼저 견주고** 다르면 멈춥니다.
   (한 자리로 합치는 일 = 「병원 목록 합치기 2단계」 · HS3 첨부 다음 차례)
   ═══════════════════════════════════════════════════════════ */

create or replace function public."일층병원_구멍"()
returns table (갈래 text, 종류 text, 기관 text, 시도 text, 시군구 text,
               상태 text, 출처 text, 우리직군 int)
language sql
security definer
set search_path = public
as $$
  with 대상 as (
    select distinct on ("견줄이름"(t.name))
           "견줄이름"(t.name) as k, t.name, t.kind, t."갈래", t.sido, t.sgg
      from org_targets t
     where t."갈래" in ('상급종합', '종합병원', '대학병원', '공공보건의료')
     order by "견줄이름"(t.name),
              case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                            when '공공보건의료' then 3 else 4 end
  ), 긁는곳 as (
    select "견줄이름"(s.name) as k from hosp_sites s
    union
    /* cfgs 로 더한 곳 — collect-hosp.mjs 의 cfgs더하기() 와 짝입니다.
       새 곳을 cfgs 에 넣으면 여기에도 한 줄 더합니다 */
    select "견줄이름"('강동경희대학교병원')
  ), 들어온곳 as (
    select "견줄이름"(j.org_name) as k,
           string_agg(distinct j.source, ',' order by j.source) as 출처,
           count(*) filter (where j.job_group in ('작업치료사', '물리치료사', '공통'))::int as 우리직군
      from job_posts j
     where j.first_seen > (now() at time zone 'Asia/Seoul')::date - 180
     group by 1
  )
  select t."갈래", t.kind, t.name, t.sido, t.sgg,
         case when g.k is not null then '사이트있음'
              when i.k is not null then '공고만들어옴'
              else '사각지대' end,
         i.출처, coalesce(i.우리직군, 0)
    from 대상 t
    left join 긁는곳 g on g.k = t.k
    left join 들어온곳 i on i.k = t.k
   order by case when g.k is not null then 3 when i.k is not null then 2 else 1 end,
            case t."갈래" when '상급종합' then 1 when '대학병원' then 2
                          when '공공보건의료' then 3 else 4 end,
            t.name
$$;

/* 지침 6-2 · 6-3 — 새 함수는 PUBLIC 에 EXECUTE 가 붙습니다. 걷습니다 */
revoke execute on function public."일층병원_구멍"() from public, anon, authenticated;
grant  execute on function public."일층병원_구멍"() to service_role;

/* 올린 뒤 확인할 것

   select 상태, count(*) from 일층병원_구멍() group by 1 order by 2 desc;
     → 사이트있음 284 · 사각지대 246 · 공고만들어옴 19 (2026-10-13 기준)

   select proacl::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '일층병원_구멍';
     → {postgres=X/postgres,service_role=X/postgres} 이어야 합니다 */
