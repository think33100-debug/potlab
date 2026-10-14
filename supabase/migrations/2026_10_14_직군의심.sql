/* 「직군 의심」 그물 — 2026-10-14 세중님 결정 (결정 3)
 *
 * 회원 화면 공고 중 **기관 원문 어디에도 우리 직군 말이 없는데 직군이 붙은 것**을
 * 날마다 셉니다. 2026-10-14 에 방사선사·임상병리사·총무팀 공고 13건이
 * 「물리치료사 채용공고」로 떠 있던 것을 찾고 만들었습니다
 * (docs/메뉴글자가_직군이_된_일_1014.md).
 *
 * ── 세중님 규칙을 두 군데 넓혔습니다 (까닭을 적습니다) ──────────────
 *
 * ① 세중님 안은 「제목에 **다른 직종 낱말**이 있고 우리 직군 낱말이 없는 것」인데,
 *    그렇게 재 보니 **그 18건 중 12건만 걸렸습니다.** 못 걸린 여섯은
 *    제목에 직종이 **아예 없는** 꼴이었습니다 —
 *      「[공고 제2026-18호] … 강진의료원 **직원 채용 공고**」
 *      「에스포항병원 건강증진센터 **육아기 대체인력** 모집」
 *    이쪽이 더 위험합니다(남의 직종이 박혀 있으면 눈에 띕니다). 그래서
 *    **다른 직종 낱말을 요구하지 않고**, 「원문 어디에도 우리 직군 말이 없음」
 *    하나로 셉니다.
 *
 * ② 「우리 직군 말」을 **「치료사」로만 잡으면 진짜 공고를 의심합니다.**
 *    처음에 그렇게 재서 멀쩡한 공고 아홉을 의심했습니다 —
 *      「은평성모병원 재활의학팀 **물리치료직**(휴직대체) 모집」   ← 치료**직**
 *      「**물리(작업)치료사**를 찾습니다」                      ← 묶어 적음
 *      「**작업치료 선생님** 구인합니다」                       ← 선생님
 *      「**도수치료사** 선생님을 모십니다」                     ← 도수
 *    그래서 `사·직·선생` 을 받고, 「물리(작업)치료사」처럼 묶은 꼴도 풀어 봅니다.
 *    같은 고침을 `tools/공고문읽기.mjs` 의 `우리직군` 에도 했습니다 —
 *    거기 `(?![가-힣])` 가 **우리말 조사까지 막고** 있었습니다
 *    (「물리치료사**를** 모집합니다」가 「직군 없음」이었습니다).
 *
 * ── 의심에서 빼는 둘 (세중님 지시) ────────────────────────────────
 *   ㉯ 통합공고   제목이 뭉뚱그린 꼴(「직원 채용」·「제N차」·「임용시험」·
 *                「기간제 직원」…)이면 우리 직군이 **첨부에** 있을 수 있습니다.
 *                버리는 게 아니라 **따로 세어** 「근거를 아직 못 읽음」으로 둡니다
 *   ㉰ 잘린 제목   「…」로 끝나면 판단할 수 없습니다 (sort-rule 도 그렇게 합니다)
 *
 * ★ evidence 는 **근거 글에 넣지 않습니다.** 거기엔 우리가 붙인 직군 라벨
 *   (`직군근거: '… 담음(물리치료사)'`)이 들어 있어서, 틀린 직군이 스스로를
 *   증명하게 됩니다. 처음에 넣고 재서 ND1724 가 멀쩡하게 보였습니다.
 */
create or replace function "직군의심"()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with 글모음 as (
  select p.id, p.source, p.org_name, p.title, p.job_group, p.url,
         coalesce(p.title, '') || ' ' || coalesce(b.body, '') || ' '
           || coalesce(p."뽑은값"::text, '') || ' ' || coalesce(p.detail::text, '') as 글
    from job_posts p
    join job_posts_pub v on v.id = p.id
    left join job_body b on b.job_id = p.id
), 잼 as (
  select g.*,
    (g.글 ~ '(물리|작업|도수)[^가-힣]{0,6}치료[[:space:]]*(사|직|선생)'
     or g.글 ~ '(물리|작업)[[:space:]]*\(?(물리|작업)?\)?[[:space:]]*치료[[:space:]]*(사|직|선생)')
      as "근거있음",
    (g.title ~ '(\.\.\.|…|\.\.)[[:space:]]*$') as "잘린제목",
    (g.title ~ ('직원[[:space:]]*(채용|모집)|제[[:space:]]*[0-9]+[[:space:]]*[차회]'
            || '|공개[[:space:]]*(채용|경쟁)|통합[[:space:]]*채용|임용시험'
            || '|(기간제|계약직)[[:space:]]*(직원|근로자)|신규[[:space:]]*직원')) as "뭉뚱그림"
   from 글모음 g
), 걸린것 as (
  select * from 잼 where not "근거있음" and not "잘린제목"
)
select jsonb_build_object(
  '의심', (select count(*) from 걸린것 where not "뭉뚱그림"),
  '의심목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where not "뭉뚱그림"),
  '통합공고', (select count(*) from 걸린것 where "뭉뚱그림"),
  '통합공고목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where "뭉뚱그림"),
  '잘린제목', (select count(*) from 잼 where not "근거있음" and "잘린제목"),
  '※', '기관 원문(제목·본문·뽑은값·detail)에 우리 직군 말이 없는데 직군이 붙은 공고입니다.'
       || ' 통합공고는 첨부에 근거가 있을 수 있어 따로 셉니다. evidence 는 우리가 붙인'
       || ' 라벨이라 근거로 안 씁니다'
);
$$;

revoke execute on function "직군의심"() from public, anon, authenticated;
grant  execute on function "직군의심"() to service_role;
