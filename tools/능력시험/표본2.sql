-- 능력시험 **둘째 표본** — 처음 보는 공고 30건 (2026-10-21 세중님 2번 · 과적합 확인)
--
-- 왜 — 지금까지 정답지·규칙 다듬기에 쓴 50건으로만 재면 **그 50건에 맞춘 점수**일
--   수 있습니다. 한 번도 안 쓴 공고로 다시 재서 과적합을 봅니다.
--
-- 고르는 법 — 첫 표본 50건의 id 를 **빼고**, 1층(+ND2) 최근 60일에서
--   **출처별로 골고루 · 첨부 있는 것을 섞어** 30건.
--   형식을 섞으려고 첨부 확장자(hwp·pdf·zip·docx·그림)별로도 흩습니다.
-- ★ 읽기만 합니다. `delete`·`drop` 글자가 없습니다 (지침 8-7).
-- ★ 1층 판정은 `일층병원_구멍()` + `견줄이름()` — 첫 표본과 같은 꼴입니다 (지침 6절).

with 쓴것 as (
  /* 첫 표본 50건 — 정답지에 든 id (손으로 적지 않고 표에서 가립니다) */
  select unnest(array[
    'CE79376','CE79381','CE79408','CE80332','CE80464','CE80512','CE71255','CE70906','CE78449','CE71257',
    'GJ304385','GJ304689','GJ304693','GJ304751','GJ304792','GJ304797','GJ304801','GJ304824','GJ304843',
    'GJ304858','GJ304874','GJ305002','GJ305114','GJ305166','GJ305195','GJ305267','GJ305441','GJ305551',
    'GJ305616','GJ305736','GJ306224','HS1144739','HS1429957266','HS197980220','HS2056094273','HS2108355665',
    'HS236379585','HS317532259','HS370080078','HS445523642','HS469127624','HS490653413','HS655684479',
    'HS846722298','HS888736852','HS931754989','HS985185312','HS996159196','HS997086843','HS1792067115',
    'JF97403','JF97404','JF97651','JF98469','JF99539','ND1721','ND1722','ND1724','ND1726',
    'WNK162212609150005','WNK163022610150013','WNK163022610150014',
    '304700','304971','305240','305272','305467','305551','305582','305641','305711','305814','305876','306138'
  ]) as id
),
일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
p as (
  select j.* from job_posts j
    join 일층 l on l.k = "견줄이름"(j.org_name)
   where j.db_insert_at >= now() - interval '60 days'
     and coalesce(j."시험자료", false) = false
     and j.id not in (select id from 쓴것)
  union all
  select j.* from job_posts j
   where j.source = 'ND2'
     and j.db_insert_at >= now() - interval '60 days'
     and coalesce(j."시험자료", false) = false
     and j.id not in (select id from 쓴것)
),
첨 as (
  select a.job_id,
         jsonb_agg(jsonb_build_object('kind', a.kind, 'name', a.name, 'url', a.url,
                                      '읽어봄', a.parsed_at is not null,
                                      '읽기탈', a."읽기탈")
                   order by a.kind, a.url) as 첨부,
         max(case when a.name ~* '[.](hwpx?)$' then 1 else 0 end) as hwp,
         max(case when a.name ~* '[.]pdf$' then 1 else 0 end) as pdf,
         max(case when a.name ~* '[.](zip|docx?)$' then 1 else 0 end) as zipdoc,
         max(case when a.name ~* '[.](jpe?g|png)$' then 1 else 0 end) as 그림
    from job_attachments a group by a.job_id
),
본 as (
  select b.job_id, count(*) as 본문줄, sum(length(coalesce(b.body, ''))) as 본문자
    from job_body b group by b.job_id
),
줄 as (
  select p.*, coalesce(첨.첨부, '[]'::jsonb) as 첨부목록,
         coalesce(첨.hwp, 0) + coalesce(첨.pdf, 0) * 2 + coalesce(첨.zipdoc, 0) * 4
           + coalesce(첨.그림, 0) * 8 as 꼴표,
         coalesce(본.본문줄, 0) as 본문줄, coalesce(본.본문자, 0) as 본문자,
         row_number() over (partition by p.source order by random()) as 출처순,
         row_number() over (partition by coalesce(첨.hwp,0) + coalesce(첨.pdf,0)*2
                              + coalesce(첨.zipdoc,0)*4 + coalesce(첨.그림,0)*8
                            order by random()) as 꼴순
    from p left join 첨 on 첨.job_id = p.id left join 본 on 본.job_id = p.id
),
/* 첨부 있는 것 16 + 없는 것 14 — 형식을 섞으려고 꼴표로 흩습니다 */
첨있 as (select * from 줄 where 첨부목록 <> '[]'::jsonb order by 꼴순, random() limit 16),
첨없 as (select * from 줄 where 첨부목록 = '[]'::jsonb and 출처순 <= 2 order by random() limit 14),
고른것 as (select * from 첨있 union all select * from 첨없)
select jsonb_build_object(
  'id', id, 'source', source, '기관', org_name, '제목', title, '주소', url,
  '숨김', coalesce(hidden, false), '보류', coalesce(hold, false),
  '들어온때', to_char(db_insert_at at time zone 'Asia/Seoul', 'YYYY-MM-DD'),
  '첨부', 첨부목록, '꼴표', 꼴표,
  '본문줄', 본문줄, '본문자', 본문자,
  '지금값', jsonb_build_object(
     '모집인원', headcount, '접수마감', apply_to, '마감시각', apply_to_time,
     '근무지', work_place, '고용형태', employ_type, '직군', job_group,
     '지원자격', coalesce(nullif("뽑은값"->>'지원자격',''), nullif(detail->>'지원자격','')),
     '예상연봉', coalesce(nullif("뽑은값"->>'예상연봉',''), nullif(detail->>'연봉',''),
                          nullif(detail->>'예상연봉','')))
)::text
  from 고른것 limit 30;
