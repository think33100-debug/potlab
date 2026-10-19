-- 능력시험 표본 — **최근 30일 1층 공고** (숨김·보류 포함)
--
-- ★ 1층 판정은 `일층병원_구멍()` 의 이름을 `견줄이름()` 으로 맞춥니다 —
--   `네숫자()` 와 **같은 꼴**입니다 (판정을 두 벌로 만들지 않습니다 · 지침 6절).
-- ★ 읽기만 합니다. `delete`·`drop` 글자가 없습니다 (지침 8-7).
--
-- 내는 것 — 한 줄에 공고 하나, JSON 한 덩이
with 일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
p as (
  select j.*
    from job_posts j
    join 일층 l on l.k = "견줄이름"(j.org_name)
   where j.db_insert_at >= now() - interval '30 days'
     and coalesce(j."시험자료", false) = false
  union all
  /* ★ ND2(치매안심센터)는 **1층 분모가 아닙니다**(CLAUDE.md — 공고가 nid.or.kr
     중앙 게시판으로 모입니다). 그래서 위 조건으로는 한 건도 안 걸립니다.
     그런데 세중님이 **출처별로 골고루** 보라고 하셨고 ND2 도 그 목록에 있습니다 —
     「그 수집기가 제대로 긁나」를 재려면 몇 건은 있어야 합니다. 그래서
     **ND2 만 1층 조건 없이** 최근 것 몇 건을 함께 넣습니다 (표시는 source 로 됩니다) */
  select j.*
    from job_posts j
   where j.source = 'ND2'
     and j.db_insert_at >= now() - interval '30 days'
     and coalesce(j."시험자료", false) = false
),
첨 as (
  select a.job_id,
         jsonb_agg(jsonb_build_object('kind', a.kind, 'name', a.name, 'url', a.url,
                                      '읽어봄', a.parsed_at is not null,
                                      '읽기탈', a."읽기탈")
                   order by a.kind, a.url) as 첨부
    from job_attachments a group by a.job_id
),
본 as (
  select b.job_id, count(*) as 본문줄, sum(length(coalesce(b.body, ''))) as 본문자
    from job_body b group by b.job_id
)
select jsonb_build_object(
  'id', p.id, 'source', p.source, '기관', p.org_name, '제목', p.title, '주소', p.url,
  '숨김', coalesce(p.hidden, false), '보류', coalesce(p.hold, false),
  '들어온때', to_char(p.db_insert_at at time zone 'Asia/Seoul', 'YYYY-MM-DD'),
  '첨부', coalesce(첨.첨부, '[]'::jsonb),
  '본문줄', coalesce(본.본문줄, 0), '본문자', coalesce(본.본문자, 0),
  '지금값', jsonb_build_object(
     '모집인원', p.headcount, '접수마감', p.apply_to, '마감시각', p.apply_to_time,
     '근무지', p.work_place, '고용형태', p.employ_type, '직군', p.job_group,
     '지원자격', coalesce(nullif(p."뽑은값"->>'지원자격',''), nullif(p.detail->>'지원자격','')),
     '예상연봉', coalesce(nullif(p."뽑은값"->>'예상연봉',''), nullif(p.detail->>'연봉',''),
                          nullif(p.detail->>'예상연봉','')))
)::text
  from p left join 첨 on 첨.job_id = p.id left join 본 on 본.job_id = p.id
 order by p.source, (coalesce(첨.첨부, '[]'::jsonb) = '[]'::jsonb), p.id desc;
