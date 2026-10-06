-- 2026-10-07 아침에 세중님이 누르실 것.
--
-- 밤에 혼자 올리지 않았습니다 — 「승인 창이 뜨는 일은 하지 마십시오」
-- (2026-10-06 밤 지시). 아래는 **한 덩어리로 한 번에** 올리면 됩니다.
--
-- 무엇을 하나 — 「물리작업치료사」로 적힌 근로복지공단 공고 여섯의 직군을
--              공고 원문대로 고칩니다. 다섯이 물리치료사, 하나가 작업치료사입니다.
--
-- 왜 — 근로복지공단은 이름을 「물리작업치료사」로 부르지만 실제로는 한 직군만
--      뽑습니다 (세중님). 지금은 여섯 다 **작업치료사**로 찍혀 있어 다섯이 틀렸습니다.
--
-- 근거 — 알리오 상세의 **지원자격(aplyQlfcCn)** 에 면허 이름이 그대로 적혀
--        있습니다. 여섯 다 가려졌고 짐작한 것은 하나도 없습니다.
--        (공고 제목·첨부 이름만으로는 안 가려졌습니다. 제목은 묶음 이름을
--         되풀이하고 첨부도 「물리작업치료사」로 똑같이 적혀 있습니다.
--         CLAUDE.md 4절 — 「내가 이 API 의 기능을 전부 쓰고 있나」를
--         묻고 안 보던 칸을 열어 찾았습니다.)
--
-- 다른 기관은 없습니다 — 「물리작업치료사」 꼴 여덟 줄이 전부 근로복지공단입니다.


/* ── 올리고 나서 ────────────────────────────────────────────────
   서버에서 한 번 다시 묶어야 화면에 반영됩니다 —

     ssh potjob 'cd /home/ubuntu/potlab && set -a && . ./.env && set +a \
       && /usr/bin/node tools/alio-group.mjs'

   (코드 두 줄은 이미 올라가 있습니다. 표가 없으면 아무 일도 안 하도록
    짰으니, 이 SQL 전에 크론이 돌아도 탈이 없습니다.)
   ────────────────────────────────────────────────────────────── */


-- ── ① 사람이 원문으로 가린 직군을 담는 표 ──────────────────────
-- 고용형태를 사람이 고르는 alio_hiretype_fix 와 **같은 틀**입니다.
-- 수집기가 덮지 않고, 근거를 같이 담습니다.
create table if not exists "알리오직군고침" (
  sn        bigint not null,
  group_no  int    not null,
  "직군"     text   not null,
  "누가"     text,
  "언제"     timestamptz not null default now(),
  "근거"     text,
  primary key (sn, group_no)
);

comment on table "알리오직군고침" is
  '사람이 공고 원문(지원자격)으로 가린 직군. alio_group_src 가 「관리자직군」으로
   내보내고 alio-group.mjs 가 our_job 보다 먼저 씁니다. 수집기가 덮지 않습니다.
   근로복지공단이 「물리작업치료사」로 부르지만 한 직군만 뽑는 자리에 씁니다 (2026-10-07).';

alter table "알리오직군고침" enable row level security;
revoke all on table "알리오직군고침" from anon, authenticated;
grant all on table "알리오직군고침" to service_role;


-- ── ② 여섯 줄 ─────────────────────────────────────────────────
insert into "알리오직군고침" (sn, group_no, "직군", "누가", "근거") values
  (153264, 0, '물리치료사', '세중님 결정 2026-10-07',
   '[경기요양병원] 지원자격 「채용직군 자격요건 - 물리치료사 면허 또는 자격 취득자」'),
  (154175, 0, '물리치료사', '세중님 결정 2026-10-07',
   '[인천병원] 지원자격 「채용직군 자격요건 - 물리치료사 면허 취득자」'),
  (154985, 0, '물리치료사', '세중님 결정 2026-10-07',
   '[경기요양병원] 지원자격 「채용직군 자격요건 - 물리치료사 면허 또는 자격취득자」'),
  (160941, 0, '작업치료사', '세중님 결정 2026-10-07',
   '[인천병원] 지원자격 「채용직군 자격요건 - 작업치료사 : 해당분야 면허증 소지자」'),
  (264101, 0, '물리치료사', '세중님 결정 2026-10-07',
   '[순천병원] 지원자격 「채용직군별 자격요건 - 물리치료사 : 물리치료사 면허증 소지자」 · 공고 제목도 「공무직(물리치료사, 방사선사)」'),
  (305052, 0, '물리치료사', '세중님 결정 2026-10-07',
   '[안산병원] 지원자격 「채용직군별 자격요건 - 물리치료사: 물리치료사 면허증 소지자」')
on conflict (sn, group_no) do update
  set "직군" = excluded."직군", "누가" = excluded."누가",
      "언제" = now(), "근거" = excluded."근거";


-- ── ③ alio_group_src 가 그 값을 같이 내보냅니다 ────────────────
-- 바뀐 곳은 **두 줄뿐**입니다 (★ 표시). 나머지는 지금 돌아가는 것 그대로입니다.
create or replace function public.alio_group_src(p_secret text, p_source text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'sn', g.sn, 'group_no', g.group_no, 'group_name', g.group_name,
      'our_job', g.our_job, 'mixed', g.mixed, 'group_steps', g.group_steps,
      'step_names', g.step_names,
      'inst_nm', c.inst_nm, 'year', c.year, 'end_ymd', c.end_ymd, 'pbanc_ttl', c.pbanc_ttl,
      '근무지', m.근무지, '고용형태', m.고용형태, '전형절차', m.전형절차,
      '첨부이름', coalesce(f.이름들, '[]'::jsonb),
      '첨부글',  coalesce(f.글들,   '[]'::jsonb),
      '관리자고용형태', x.고용형태,
      '관리자직군', d."직군")                                        -- ★ 더한 줄
      order by g.sn, g.group_no), '[]'::jsonb)
    from (select sn, group_no, min(group_name) group_name, min(our_job) our_job,
            bool_or(mixed) mixed, max(group_steps) group_steps,
            array_agg(step_name order by step_no) step_names
          from alio_compete_web group by sn, group_no) g
    join (select distinct on (sn) sn, inst_nm, year, end_ymd, pbanc_ttl
          from alio_compete order by sn) c on c.sn = g.sn
    left join alio_post_meta m on m.sn = g.sn
    left join (select sn,
                 jsonb_agg(파일이름 order by sort_no) 이름들,
                 jsonb_agg(글 order by sort_no) filter
                   (where 글 is not null and 글 <> '' and 파일갈래 in ('A','Z')) 글들
               from alio_post_file group by sn) f on f.sn = g.sn
    left join alio_hiretype_fix x on x.sn = g.sn and x.group_no = g.group_no
    left join "알리오직군고침" d on d.sn = g.sn and d.group_no = g.group_no);  -- ★ 더한 줄
end $function$;


/* ── 올린 뒤 바뀌는 것 (전 → 후) ────────────────────────────────

   묶음 이름이 바뀌는 것이 아니라 **그 회차만 빠져나가 갈라집니다.**

   153264  경기요양병원 전문직   작업 → 물리   1회차짜리 묶음이 통째로 옮겨감
   154175  인천병원 전문직      작업 → 물리   1회차짜리 묶음이 통째로 옮겨감
   154985  경기요양병원 공무직   작업 → 물리   4회차 중 1개가 빠져나감
   264101  순천병원 공무직      작업 → 물리   2회차 중 1개가 빠져나감
   305052  안산병원 공무직      작업 → 물리   3회차 중 1개가 빠져나감
   160941  인천병원 공무직      작업 → 작업   그대로 (안 움직임)

   확인하는 쿼리 —

     select 묶음키, 회차, 값있음, 평균 from alio_group_sum
      where 묶음키 like '근로복지공단 | %치료사 | %'
        and (묶음키 like '%경기요양병원%' or 묶음키 like '%인천병원%'
             or 묶음키 like '%순천병원%'  or 묶음키 like '%안산병원%')
      order by 묶음키;

     select count(*) from alio_group_sum
      where 우리직군 and not 짝확인필요 and not 고용형태확인필요
        and not 합쳐짐 and 값있음 > 0;     -- 지금 222. 조금 늘어납니다
   ────────────────────────────────────────────────────────────── */
