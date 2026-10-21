-- 능력시험 **셋째 표본** — 우리 직군 공고 30건 (2026-10-22 세중님 2번)
--
-- 왜 — 둘째 표본 30건 가운데 **우리 직군이 7건**뿐이었습니다. 한 건이 14%p 라
--   「우리 직군 공고만」 줄을 믿을 수 없었습니다. 그래서 **우리 직군만** 30건을
--   새로 뽑습니다. 50건·30건과 겹치지 않습니다.
-- ★ 규칙을 다듬지 않습니다 — 정답지를 쓰고 **한 번 채점**합니다 (세중님).
-- ★ 읽기만 합니다. delete·drop 글자가 없습니다 (지침 8-7).
-- ★ 1층 판정은 일층병원_구멍() + 견줄이름() — 앞 두 표본과 같은 꼴입니다 (지침 6절).

with 쓴것 as (
  /* 첫·둘째 표본에 든 id 75개 — 정답지 두 벌에서 읽어 박았습니다 */
  select unnest(array[
    'HS445523642','HS2108355665','HS98807643','HS987933081','305467','305876','CE79618','CE80464',
    'CE79408','CE80512','CE79381','CE80397','CE79376','CE80332','CE80532','WNK163022610150014',
    'WNK163022610150013','WNK162212609150005','WNK180512610060043','WNK163022609180020','WNK163022609180019','WNK162212608260011','WNK160012609290029','WNKJ20912609230013',
    'WNK161332608120004','ND1726','ND1725','ND1724','ND1722','ND1721','JF98469','JF99539',
    'JF97404','JF97403','JF97651','HS490653413','HS997086843','HS985185312','305814','306138',
    '305641','305711','305272','304971','304700','305240','HS236379585','HS996159196',
    'HS2056094273','GJ304423','CE80089','305575','ND1718','HS91785292','JF92794','WNK152312610010016',
    '303898','HS932767433','CE72430','305526','HS552018502','JF120454','301321','HS2009051784',
    '299470','HS665496254','305472','HS190712781','HS1628741383','HS1559904275','HS154900927','HS146236860',
    'HS1421557054','HS1305146806','HS1201582901'
  ]) as id
),
일층 as (select "견줄이름"("기관") as k from "일층병원_구멍"()),
p as (
  select j.* from job_posts j
    join 일층 l on l.k = "견줄이름"(j.org_name)
   where j.db_insert_at >= now() - interval '120 days'
     and coalesce(j."시험자료", false) = false
     and j.id not in (select id from 쓴것)
     and j.job_group in ('물리치료사', '작업치료사')
  union all
  select j.* from job_posts j
   where j.source in ('ND2', 'ND')
     and j.db_insert_at >= now() - interval '120 days'
     and coalesce(j."시험자료", false) = false
     and j.id not in (select id from 쓴것)
     and j.job_group in ('물리치료사', '작업치료사')
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
/* 첨부 있는 것 18 + 없는 것 12 — 형식을 섞으려고 꼴표로 흩습니다 */
첨있 as (select * from 줄 where 첨부목록 <> '[]'::jsonb order by 꼴순, random() limit 18),
첨없 as (select * from 줄 where 첨부목록 = '[]'::jsonb order by 출처순, random() limit 12),
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
