/* ㉫ 제목 만드는 쪽 — 앞머리 가름(A·D) · 인턴·빈 값(B) · 한자·기호(C)
 *   (2026-10-28 세중님 ㉫ 승인 · **마른 실행 먼저**)
 *
 *   node tools/제목쪽_1028.mjs --자기점검   새 함수가 맞게 가르는지 (되돌림 안에서)
 *   node tools/제목쪽_1028.mjs             마른 실행 — 바뀌는 제목 전수 전·후
 *   node tools/제목쪽_1028.mjs --진짜       바꿉니다
 *
 * ── 마른 실행을 어떻게 하나 ─────────────────────────────────
 * PostgreSQL 은 **DDL 도 트랜잭션 안**입니다. `begin` → 함수 바꾸기 → 새 제목 뽑아
 * 보기 → **`rollback`** 으로 한 글자도 남기지 않고 전·후를 봅니다 (㉧ 와 같은 꼴).
 *
 * ── 무엇을 고치나 ───────────────────────────────────────────
 *   ㉠ `제목글자다듬기()` **새로 만듭니다** — 괄호 속 한자·한자·기호·법인 표기를
 *      떼고 공백을 정리합니다. **떼서 두 글자 이하면 원문을 그대로** 둡니다 (C)
 *   ㉡ `제목기관()` — 낸 값을 `제목글자다듬기()` 에 거칩니다 (C)
 *   ㉢ `제목산하()` — **근무처 이름 꼴만** 씁니다 (A).
 *      지역 `[구포]` · 부서 `[통합재활팀]` · 법인 `[안동의료재단]` ·
 *      조건 `[주4.5일]` · 직군 `[물리치료사]` 는 산하 기관이 아닙니다 (D)
 *   ㉣ `고용형태보임행()` — **빈 값을 거치지 않습니다** (B·F).
 *      `employ_type` 이 비면 제목에 고용형태를 **안 적습니다**. 전에는 원문 제목에서
 *      「정규직」 같은 글자를 주웠는데, 그 공고의 **우리 직군 자리**가 정규직인지
 *      우리는 모릅니다 (306248 — 정규직·계약직을 함께 뽑는 공고)
 *
 * ★ 제목을 **지웠다 채우지 않습니다** — `보여줄제목` 에 null 을 쓰면 트리거가
 *   되메우지 않아 회원 화면이 빕니다 (지침 8-22 · 10/28 09:05 사고).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const 점검만 = process.argv.includes('--자기점검');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = { ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require' };
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '제목쪽_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

/* ───────────────────────── 바꿀 글 (전문) ───────────────────────── */

const 바꾸기SQL = `
/* ㉠ 새 함수 — 제목에 쓸 글자 다듬기 (2026-10-28 ㉫ · 세중님 C) */
create or replace function public."제목글자다듬기"(v text)
returns text language sql immutable as $fn$
  select case
    when btrim(coalesce(v, '')) = '' then null
    /* ★ 떼서 **두 글자 이하**면 원문을 그대로 둡니다 (세중님 C) */
    when length(t."다듬") <= 2 then btrim(v)
    else t."다듬" end
  from (select btrim(regexp_replace(
                 translate(
                   regexp_replace(
                     regexp_replace(
                       regexp_replace(coalesce(v, ''),
                         /* 괄호 속 한자 — 「삼성(杉晟)센텀…」 「계양효(孝)요양원」 */
                         '\\(\\s*[一-龥]+\\s*\\)', '', 'g'),
                       /* 법인 표기 — ㈜ 꼴을 목록에 넣었습니다 (세중님 C) */
                       '(주식회사|유한회사|㈜|㈐|\\(주\\)|\\(유\\))', '', 'g'),
                     /* 남은 한자 */
                     '[一-龥]', '', 'g'),
                   '[]★※【】◇◆□■○●▲▼〈〉《》', ''),
                 '\\s{2,}', ' ', 'g')) as "다듬") t
$fn$;
comment on function public."제목글자다듬기"(text) is
  '제목에 쓸 글자에서 괄호 속 한자·한자·기호·법인 표기(㈜)를 떼고 공백 정리. 두 글자 이하가 되면 원문 유지 (2026-10-28 ㉫)';

/* ㉡ 제목기관 — 낸 값을 다듬습니다 (security definer·search_path 그대로) */
create or replace function public."제목기관"(j public.job_posts)
returns text language plpgsql stable security definer set search_path to 'public' as $fn$
declare v_기관 text;
begin
  select "줄인이름" into v_기관
    from "기관이름줄임" where "원래이름" = j.org_name and "승인했나" limit 1;
  /* ★ 2026-10-28 ㉫ (세중님 C) — 한자·기호·법인 표기를 뗍니다 */
  return "제목글자다듬기"(coalesce(v_기관, "법인앞말떼기"(j.org_name)));
end $fn$;

/* ㉢ 제목산하 — 근무처 이름 꼴만 (세중님 A·D) */
create or replace function public."제목산하"(p_title text, p_org text)
returns text language plpgsql immutable as $fn$
declare v text;
begin
  /* 앞의 꺾쇠 — [행복한요양원 분당점] · [구포] · [서울병원] */
  v := (select m[1] from regexp_matches(coalesce(p_title,''), '^\\s*\\[([^\\]]{1,20})\\]') m limit 1);
  if v is null then
    /* 꺾쇠가 없으면 제목 맨 앞의 「…병원」 — 경인권역재활병원 */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '^\\s*([가-힣]{2,12}(?:병원|의료원|센터))\\s') m limit 1);
  end if;
  if v is null then
    /* 2026-10-28 ㉧ — **제목 어디에 있든** 산하 기관말을 찾습니다.
       「2026년 대구광역시 중구 치매안심센터 시간선택제…」 꼴입니다 (지침 10-3) */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '([가-힣]{0,10}(?:치매안심센터|치매센터|보건의료원|보건지소|보건소))') m limit 1);
  end if;
  /* ★ 2026-10-28 ㉫ (세중님 C) — 한자·기호·법인 표기를 먼저 뗍니다.
     그래야 「계양효(孝)요양원 **계양효요양원** …」 처럼 같은 말이 두 번 안 적힙니다 */
  v := btrim(coalesce("제목글자다듬기"(v), ''));
  if v = '' then return null; end if;
  /* 「모집」 「채용」 같은 꾸밈은 지점이 아닙니다 */
  if v ~ '^(모집|채용|공고|온라인|긴급|재공고|마감|신규)$' then return null; end if;
  /* ★ 2026-10-28 ㉫ (세중님 A·D) — **근무처 이름 꼴만** 씁니다.
     지역 [구포] · 부서 [통합재활팀] · 법인 [안동의료재단] · 조건 [주4.5일] ·
     직군 [물리치료사] 는 산하 기관이 아닙니다. 지금은 이 다섯이 전부 붙습니다 */
  if v !~ '(점|관|센터|센타|병원|의원|의료원|한의원|치과|약국|요양원|요양병원|주간보호|보건소|보건지소|보건의료원|복지관|복지센터|어린이집|분원|분소)$' then
    return null;
  end if;
  /* 기관명에 이미 있으면 안 붙입니다 (기관명도 다듬어 견줍니다) */
  if coalesce("제목글자다듬기"(p_org), '') like '%' || v || '%' then return null; end if;
  return v;
end $fn$;

/* ㉣ 고용형태보임행 — 빈 값을 거치지 않습니다 (세중님 B·F) */
create or replace function public."고용형태보임행"(j public.job_posts)
returns text language plpgsql stable security definer set search_path to 'public' as $fn$
begin
  /* ★ 2026-10-28 ㉫ (세중님 B·F) — **빈 값을 거치지 않습니다.**
     employ_type 이 비면 제목에 고용형태를 **안 적습니다**.
     전에는 원문 제목에서 「정규직」 같은 글자를 주웠습니다 (예수병원 때문에 넣은 길).
     그런데 그 공고의 **우리 직군 자리**가 정규직인지는 공고문을 봐야 압니다
     — 306248 은 「정규직(약무직) 및 계약직(…)」 를 함께 뽑는 공고입니다.
     값이 「체험형 인턴」·「채용형 인턴」·「인턴」이면 고용형태보임() 이 그대로 냅니다 */
  return "고용형태보임"(j.employ_type);
end $fn$;`;

/* ───────────────────── 전 본문·ACL (되돌림) ───────────────────── */
const 고칠것 = [
  ['제목기관', 'j public.job_posts'],
  ['제목산하', 'p_title text, p_org text'],
  ['고용형태보임행', 'j public.job_posts'],
];
const 전것 = 고칠것.map(([이름, 인수]) => ({
  이름, 인수,
  정의: psql(`\\pset pager off
    select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = '${이름}'
       and pg_get_function_identity_arguments(p.oid) = '${인수}';`, ['-X', '-A', '-t', '-q']),
  acl: 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${이름}'
     and pg_get_function_identity_arguments(p.oid) = '${인수}';`),
}));
for (const x of 전것) {
  if (!x.정의.trim()) { console.error('✗ ' + x.이름 + '(' + x.인수 + ') 정의를 못 읽었습니다'); process.exit(1); }
  console.log('전 — ' + x.이름 + '(' + x.인수 + ') · ' + x.정의.split('\n').length + '줄 · ACL ' + x.acl);
}
const 새함수있나 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '제목글자다듬기';`);
console.log('전 — 제목글자다듬기 ' + (새함수있나 === '0' ? '없습니다 (새로 만듭니다)' : '⚠ 이미 있습니다 (' + 새함수있나 + '개)'));

/* ───────────────────────── 자기점검 ───────────────────────── */
if (점검만) {
  /* 새 함수가 **맞게 가르는지** — 되돌림 안에서 견본을 넣어 봅니다.
     보기는 10/28 마른 실행이 뽑은 앞머리 25건의 다섯 갈래에서 골랐습니다 */
  const 견본 = [
    ['[행복한요양원 분당점] 물리치료사 모집', '주식회사 분당시니어', '행복한요양원 분당점', '근무처'],
    ['[우림요양원] 작업치료사', '주식회사 우림홀딩스', '우림요양원', '근무처'],
    ['[본점3관] 요양보호사', '주식회사 삼성케어', '본점3관', '근무처'],
    ['[예덕주간보호센터] 작업치료사', '예덕복지재단', '예덕주간보호센터', '근무처'],
    ['[구포] 물리치료사 채용', '구포병원', null, '지역'],
    ['[ 온라인 ] 작업치료사', '어느기관', null, '지역'],
    ['[인천 청학동] 물리치료사', '어느기관', null, '지역'],
    ['[연산역] 물리치료사', '어느기관', null, '지역'],
    ['[통합재활팀] 물리치료사', '어느병원', null, '부서'],
    ['[건진팀] 작업치료사', '어느병원', null, '부서'],
    ['[일반-신촌] 물리치료사', '연세대학교의과대학세브란스병원', null, '부서'],
    ['[안동의료재단] 작업치료사', '안동의료재단 안동병원', null, '법인'],
    ['[대전보훈병원] 물리치료사', '한국보훈복지의료공단 대전보훈병원', null, '법인(기관명에 있음)'],
    ['[주4.5일] 물리치료사', '어느의원', null, '조건'],
    ['[물리치료사] 채용', '바른아동발달연구소', null, '직군'],
    ['[계양효요양원] 작업치료사', '계양효(孝)요양원', null, 'C 가 겹침을 풂'],
    ['2026년 대구광역시 중구 치매안심센터 시간선택제', '대구광역시 중구', '치매안심센터', '㉧ 그대로'],
  ];
  const 다듬견본 = [
    ['삼성(杉晟)센텀정형외과의원', '삼성센텀정형외과의원'],
    ['계양효(孝)요양원', '계양효요양원'],
    ['주식회사 케어플러스', '케어플러스'],
    ['㈜분당시니어', '분당시니어'],
    ['(주)강원랜드', '강원랜드'],
    ['★긴급★ 서울병원', '긴급 서울병원'],
    ['大韓', '大韓'],
    ['', null],
  ];
  const 줄 = (a) => a.map((v) => (v === null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'"));
  const 점검SQL = `\\pset pager off
begin;
${바꾸기SQL}
select '다듬기' as 무엇, x."들어간것", coalesce(x."바란것",'(null)') as "바란것",
       coalesce("제목글자다듬기"(x."들어간것"),'(null)') as "나온것",
       case when "제목글자다듬기"(x."들어간것") is not distinct from x."바란것" then '○' else '✗' end as "맞나"
  from (values ${다듬견본.map((r) => '(' + 줄(r).join(',') + ')').join(',')})
       x("들어간것","바란것")
union all
select '산하', left(y."제목",34), coalesce(y."바란것",'(null)'),
       coalesce("제목산하"(y."제목", y."기관"),'(null)'),
       case when "제목산하"(y."제목", y."기관") is not distinct from y."바란것" then '○' else '✗' end
  from (values ${견본.map((r) => '(' + 줄(r.slice(0, 3)).join(',') + ')').join(',')})
       y("제목","기관","바란것")
union all
select '고용형태', 'employ_type = ' || coalesce(z.v,'(빈칸)'), coalesce(z."바란것",'(null)'),
       coalesce("고용형태보임"(z.v),'(null)'),
       case when "고용형태보임"(z.v) is not distinct from z."바란것" then '○' else '✗' end
  from (values ('체험형 인턴','체험형 인턴'),('채용형 인턴','채용형 인턴'),
               ('인턴','인턴'),('10','정규직'),(null,null),('','ERR'))
       z(v,"바란것")
order by 1, 2;
rollback;`;
  console.log('\n══ 자기점검 — 새 함수를 되돌림 안에서 돌려 봅니다 ══');
  const 결과 = psql(점검SQL);
  console.log(결과);
  const 틀림 = (결과.match(/✗/g) || []).length;
  /* ('','ERR') 한 줄은 **일부러 틀리게** 둔 미끼입니다 — 빈 칸은 null 이어야 맞습니다.
     그래서 ✗ 가 딱 한 줄이면 맞게 도는 것입니다 */
  console.log(틀림 === 1
    ? '○ 자기점검 통과 — 미끼 한 줄(빈 칸 → null)만 ✗ 입니다'
    : '✗ 자기점검 — ✗ 가 ' + 틀림 + '줄입니다 (1 이어야 합니다)');
  process.exit(틀림 === 1 ? 0 : 1);
}

/* ───────── 마른 실행 — begin … rollback 안에서 전·후 전수 ───────── */
const 견주기 = `\\pset pager off
begin;
${바꾸기SQL}
select count(*) as "바뀌는줄",
       count(*) filter (where exists (select 1 from job_posts_pub v where v.id = p.id)) as "회원화면",
       count(*) filter (where 제목만들기행(p) is null) as "새것이_빈것_안바꿉니다"
  from job_posts p
 where p."보여줄제목" is distinct from 제목만들기행(p)
   and not ('보여줄제목' = any(coalesce(p.edited_fields, '{}')))
   and p."보여줄제목" is not null;
select p.id, p.source,
       (exists (select 1 from job_posts_pub v where v.id = p.id)) as "회원화면",
       p."보여줄제목" as "전", 제목만들기행(p) as "후"
  from job_posts p
 where p."보여줄제목" is distinct from 제목만들기행(p)
   and not ('보여줄제목' = any(coalesce(p.edited_fields, '{}')))
   and p."보여줄제목" is not null
   and 제목만들기행(p) is not null
 order by (exists (select 1 from job_posts_pub v where v.id = p.id)) desc, p.id;
rollback;`;
console.log('\n══ 마른 실행 — 바뀌는 제목 전수 (되돌림 안에서 돌렸습니다) ══');
console.log(psql(견주기));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ───────────────────────── 되돌림 글 ───────────────────────── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '제목쪽_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* ㉫ 되돌리기 — 2026-10-28 전 정의 그대로 (pg_get_functiondef 로 받은 것) */',
  ...전것.map((x) => x.정의.trimEnd() + ';'),
  '/* 새로 만든 함수는 지웁니다 (위 정의들은 이것을 안 씁니다) */',
  'drop function if exists public."제목글자다듬기"(text);',
  '/* 되돌린 뒤 제목을 다시 만듭니다 — **값을 직접 넣습니다**.',
  '   트리거는 보여줄제목 칸에 안 걸립니다 (지침 8-22) */',
  'update job_posts set "보여줄제목" = 제목만들기행(job_posts)',
  '  where "보여줄제목" is distinct from 제목만들기행(job_posts)',
  '    and 제목만들기행(job_posts) is not null',
  "    and not ('보여줄제목' = any(coalesce(edited_fields, '{}')));",
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

/* ───────────────────────── 실행 ───────────────────────── */
console.log(psql(바꾸기SQL));
for (const x of 전것) {
  const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${x.이름}'
     and pg_get_function_identity_arguments(p.oid) = '${x.인수}';`);
  console.log('후 ACL — ' + x.이름 + ' ' + 후acl + (후acl === x.acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));
}
/* 새 함수는 회원에게 열지 않습니다 — 제목 함수들이 안에서만 씁니다 */
console.log(psql(`revoke all on function public."제목글자다듬기"(text) from public, anon;
grant execute on function public."제목글자다듬기"(text) to authenticated, service_role;`));
console.log('새 함수 ACL — 제목글자다듬기 ' + 글만(`select coalesce(p.proacl::text,'(기본값)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '제목글자다듬기';`));

/* 제목 다시 만들기 — **값을 직접 넣습니다** (지침 8-22 · 빈 값은 건너뜁니다) */
const 몇 = 글만(`with x as (
    update job_posts set "보여줄제목" = 제목만들기행(job_posts)
     where "보여줄제목" is distinct from 제목만들기행(job_posts)
       and 제목만들기행(job_posts) is not null
       and not ('보여줄제목' = any(coalesce(edited_fields, '{}'))) returning id)
  select count(*) from x;`);
console.log('제목을 다시 만든 줄 — ' + 몇 + '개');
console.log('회원 화면에 제목이 빈 공고 — ' + 글만(`select count(*) from job_posts p
  join job_posts_pub v on v.id = p.id where coalesce(p."보여줄제목",'') = '';`) + '건 (0 이어야 합니다)');
