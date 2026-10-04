-- ═══════════════════════════════════════════════════════════════
--  고용형태 글자 통일 — 2026-10-05 (올렸습니다)
-- ═══════════════════════════════════════════════════════════════
--
--  ── 무엇이 문제였나 ─────────────────────────────────────────
--  같은 뜻인데 출처마다 다른 말이 들어와 **거르기가 둘로 갈렸습니다.**
--    계약직 60 ↔ 기간제 39
--    계약직(시간선택제) 1 ↔ 기간제(시간선택제) 1
--    일반정규직 3 ↔ 정규직 188
--
--  ── 세중님이 정한 것 ────────────────────────────────────────
--    계약직 · 기간제                      → 「계약직」
--    계약직(시간선택제) · 기간제(시간선택제) → 「계약직(시간선택제)」
--    일반정규직                           → 「정규직」
--  DB 원래 값(employ_type)은 **그대로 둡니다.** 보여 줄 값만 바꿉니다.
--
--  ── 한 곳에서만 정합니다 ────────────────────────────────────
--  함수 `고용형태보임(text)` 하나가 규칙을 가집니다. 이것을
--    ① 회원 화면이 쓰는 뷰 job_posts_pub
--    ② job_posts 의 생성 칸 고용형태보임 (관리자·거르기용)
--    ③ 앞으로 만들 제목 이어 붙이기
--  셋이 **다 같이 부릅니다.** 규칙을 고칠 자리가 한 군데뿐입니다.
--
--  ★ 화면 코드는 **한 줄도 안 고쳤습니다.** job_list · job_one · org_jobs 가
--    모두 job_posts_pub 뷰를 읽고 있어서, 뷰 한 곳만 고치니 다 따라왔습니다.
--
--  ⚠ 관리자 화면(admin_jobs)은 **원래 값**을 그대로 보여줍니다 — 일부러입니다.
--    관리자가 고치는 것은 원래 값이라, 거기서까지 바꿔 보이면 헷갈립니다.
--
--  DROP · DELETE · TRUNCATE 없음.

-- ── ① 규칙을 가진 한 곳 ────────────────────────────────────
create or replace function 고용형태보임(v text)
returns text
language sql immutable
as $$
  select case
    when v is null or btrim(v) = '' then null
    when btrim(v) in ('계약직', '기간제')                                then '계약직'
    when btrim(v) in ('계약직(시간선택제)', '기간제(시간선택제)',
                      '계약직(시간제)',     '기간제(시간제)')            then '계약직(시간선택제)'
    when btrim(v) in ('일반정규직', '정규직')                            then '정규직'
    when btrim(v) in ('정규직(시간선택제)', '정규직(시간제)')            then '정규직(시간선택제)'
    else btrim(v)
  end
$$;

comment on function 고용형태보임(text) is
  '보여 줄 고용형태를 정하는 한 곳. 계약직·기간제 → 계약직, 일반정규직 → 정규직. '
  'job_posts_pub 뷰와 제목 이어 붙이기가 같이 씁니다 (2026-10-05).';

grant execute on function 고용형태보임(text) to anon, authenticated, service_role;

-- ── ② job_posts 의 생성 칸 ─────────────────────────────────
alter table job_posts
  add column if not exists 고용형태보임 text
  generated always as (고용형태보임(employ_type)) stored;

/* 이미 만들어 둔 칸이면 식만 갈아 끼웁니다 (PG17 · 칸을 지우지 않습니다) */
alter table job_posts
  alter column 고용형태보임 set expression as (고용형태보임(employ_type));

comment on column job_posts.고용형태보임 is
  '화면과 제목이 쓰는 고용형태. employ_type 원래 값은 그대로 두고 여기서만 맞춥니다.';

-- ── ③ 회원 화면이 읽는 뷰 ──────────────────────────────────
-- employ_type 한 줄만 바뀌었습니다. 칸 이름·차례·형은 그대로라 replace 로 됩니다.
-- 관리자가 손으로 고친 값(job_edit_now)도 같은 규칙을 지납니다.
create or replace view job_posts_pub as
 SELECT j.id,
    COALESCE(e.f ->> 'title'::text, j.title) AS title,
    j.org_name,
    j.hire_type,
    고용형태보임(COALESCE(e.f ->> 'employ_type'::text, j.employ_type)) AS employ_type,
    j.work_place,
    COALESCE(j.sido, org_sido(NULL::text, j.org_name)) AS sido,
    j.sgg,
    j.edu,
    COALESCE((e.f ->> 'headcount'::text)::integer, j.headcount) AS headcount,
    COALESCE((e.f ->> 'apply_from'::text)::date, j.apply_from) AS apply_from,
    COALESCE((e.f ->> 'apply_to'::text)::date, j.apply_to) AS apply_to,
    j.posted_at,
    j.url,
    COALESCE(e.f ->> 'job_group'::text, j.job_group) AS job_group,
    j.org_kind,
    j.tab,
    j.form,
    j.score,
    COALESCE(j.detail, '{}'::jsonb) || COALESCE(jsonb_strip_nulls(jsonb_build_object('전형방법', e.f ->> 'detail.전형방법'::text, '지원자격', e.f ->> 'detail.지원자격'::text)), '{}'::jsonb) AS detail,
    COALESCE(e.f ->> 'title'::text, j.title) ~ '수련생|체험형|청년인턴|인턴'::text AS is_intern
   FROM job_posts j
     LEFT JOIN job_edit_now e ON e.job_id = j.id
     LEFT JOIN job_hides h ON h.job_id = j.id
  WHERE h.job_id IS NULL AND NOT COALESCE((e.f ->> 'hidden'::text)::boolean, j.hidden) AND NOT COALESCE((e.f ->> 'hold'::text)::boolean, j.hold);

-- ── 올린 뒤 확인한 것 (2026-10-05) ──────────────────────────
--   고용형태보임('기간제')=계약직 · ('일반정규직')=정규직 ·
--     ('기간제(시간선택제)')=계약직(시간선택제) · ('공무원')=공무원 · ('')=null
--   job_posts_pub   정규직 191 · 계약직 99  (기간제·일반정규직 0)
--   org_jobs · job_one  옛 글자 0건
--   화면 여섯(/ · /jobs · /orgs · /edu · /youth · /volunteer) HTTP 200, 목록 다 참
--   /jobs 에 남은 「기간제」 8번은 전부 **공고 제목 글자**입니다
--     (「[중앙보훈병원] 기간제 직원 채용 공고」) — 고용형태 칸이 아닙니다
