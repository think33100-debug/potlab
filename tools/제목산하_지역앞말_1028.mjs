/* ㉧ 제목이 「중구」 하나로 남는 것 — `지역앞말떼기()`·`제목산하()` 고침
 *   (2026-10-28 세중님 ㉧ 승인 · **마른 실행 먼저**)
 *
 *   node tools/제목산하_지역앞말_1028.mjs           마른 실행 (되돌림 안에서 돌려 봅니다)
 *   node tools/제목산하_지역앞말_1028.mjs --진짜     바꿉니다
 *
 * ── 마른 실행을 어떻게 하나 ─────────────────────────────────
 * PostgreSQL 은 **DDL 도 트랜잭션 안**입니다. 그래서 `begin` → 함수 바꾸기 →
 * 새 제목 뽑아 보기 → **`rollback`** 으로 **한 글자도 남기지 않고** 전·후를 봅니다.
 * (함수를 새 이름으로 만들어 보는 길은 그 자체가 DB 변경이라 피했습니다)
 *
 * ── 무엇을 고치나 ───────────────────────────────────────────
 *   ㉠ `지역앞말떼기` — 떼고 나서 **「○구」·「○군」 하나만** 남으면 **안 뗍니다**
 *      「대구광역시 중구」 → (전) 「중구」 · (후) 「대구광역시 중구」
 *   ㉡ `제목산하` — 제목 **어디에 있든** 산하 기관말을 찾습니다
 *      치매안심센터 · 치매센터 · 보건의료원 · 보건지소 · 보건소
 *      「2026년 대구광역시 중구 **치매안심센터** 시간선택제…」 → 산하 「치매안심센터」
 *   → 「대구광역시 중구 치매안심센터 작업치료사 계약직 채용공고」
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');

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
  const 임시 = path.join(os.tmpdir(), '제목산하_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

/* ── 새 본문 둘 ── */
export const 새_지역앞말떼기 = `
  select coalesce(
    (select btrim(substr("p_기관", length(g."긴이름") + 1))
       from (values
         ('서울','서울특별시'),('부산','부산광역시'),('대구','대구광역시'),('인천','인천광역시'),
         ('광주','광주광역시'),('대전','대전광역시'),('울산','울산광역시'),('세종','세종특별자치시'),
         ('경기','경기도'),('강원','강원특별자치도'),('강원','강원도'),
         ('충북','충청북도'),('충남','충청남도'),
         ('전북','전북특별자치도'),('전북','전라북도'),('전남','전라남도'),
         ('경북','경상북도'),('경남','경상남도'),('제주','제주특별자치도'),
         ('전남광주','전남광주통합특별시')) g("짧","긴이름")
      where g."짧" = "p_지역"
        and "p_기관" like g."긴이름" || '%'
        and btrim(substr("p_기관", length(g."긴이름") + 1)) <> ''
        and btrim(substr("p_기관", length(g."긴이름") + 1)) !~ '^립'
        /* ★ 범위를 가리키는 말로 시작하면 안 뗍니다 (2026-10-07) */
        and btrim(substr("p_기관", length(g."긴이름") + 1))
              !~ '^(광역|권역|남부|북부|동부|서부|중부|동남권|서남권)'
        and split_part(btrim(substr("p_기관", length(g."긴이름") + 1)), ' ', 1)
              !~ '^(의료원|병원|보건소|센터|복지관)$'
        /* ★ 2026-10-28 세중님 ㉧ — 떼고 나서 **「○구」·「○군」 하나만** 남으면
           안 뗍니다. 「대구광역시 중구」가 「중구」가 되어 어느 중구인지 모릅니다 */
        and btrim(substr("p_기관", length(g."긴이름") + 1)) !~ '^[가-힣]{1,3}(구|군)$'
      order by length(g."긴이름") desc
      limit 1),
    "p_기관")`;

export const 새_제목산하 = `
declare v text;
begin
  /* 앞의 꺾쇠 — [순천병원] · [구포] · [서울병원] */
  v := (select m[1] from regexp_matches(coalesce(p_title,''), '^\\s*\\[([^\\]]{1,20})\\]') m limit 1);
  if v is null then
    /* 꺾쇠가 없으면 제목 맨 앞의 「…병원」 — 경인권역재활병원 */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '^\\s*([가-힣]{2,12}(?:병원|의료원|센터))\\s') m limit 1);
  end if;
  if v is null then
    /* ★ 2026-10-28 세중님 ㉧ — **제목 어디에 있든** 산하 기관말을 찾습니다.
       「2026년 대구광역시 중구 치매안심센터 시간선택제…」 처럼 맨 앞이 아닌 자리에
       산하 기관이 적힌 공고가 있습니다. 낱말을 **적어 둔 것만** 봅니다 (지침 10-3) */
    v := (select m[1] from regexp_matches(coalesce(p_title,''),
            '([가-힣]{0,10}(?:치매안심센터|치매센터|보건의료원|보건지소|보건소))') m limit 1);
  end if;
  v := btrim(coalesce(v, ''));
  if v = '' then return null; end if;
  /* 「모집」 「채용」 같은 꾸밈은 지점이 아닙니다 */
  if v ~ '^(모집|채용|공고|온라인|긴급|재공고|마감|신규)$' then return null; end if;
  /* 기관명에 이미 있으면 안 붙입니다 */
  if coalesce(p_org,'') like '%' || v || '%' then return null; end if;
  return v;
end`;

const 바꾸기SQL = `
create or replace function public."지역앞말떼기"("p_지역" text, "p_기관" text)
returns text language sql immutable as $fn$${새_지역앞말떼기}
$fn$;
create or replace function public."제목산하"(p_title text, p_org text)
returns text language plpgsql immutable as $fn$${새_제목산하}
$fn$;`;

/* ── 전 본문·ACL (되돌림) ── */
const 전것 = ['지역앞말떼기', '제목산하'].map((이름) => ({
  이름,
  본문: 글만(`select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '${이름}';`),
  acl: 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${이름}';`),
  언어: 글만(`select l.lanname from pg_proc p join pg_language l on l.oid = p.prolang
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${이름}';`),
  인수: 글만(`select pg_get_function_identity_arguments(p.oid) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${이름}';`),
}));
for (const x of 전것) {
  console.log('전 — ' + x.이름 + '(' + x.인수 + ') · ' + x.언어 + ' · ACL ' + x.acl);
  if (!x.본문.trim()) { console.error('✗ ' + x.이름 + ' 본문을 못 읽었습니다'); process.exit(1); }
}

/* ── 마른 실행 — begin … rollback 안에서 전·후를 뽑습니다 ── */
const 견주기 = `
\\pset pager off
begin;
${바꾸기SQL}
select p.id, p.source, coalesce(p.job_group,'(없음)') as 직군,
       (exists (select 1 from job_posts_pub v where v.id = p.id)) as 회원화면,
       p."보여줄제목" as 전, 제목만들기행(p) as 후
  from job_posts p
 where p."보여줄제목" is distinct from 제목만들기행(p)
   and not ('보여줄제목' = any(coalesce(p.edited_fields, '{}')))
   and p."보여줄제목" is not null
 order by (exists (select 1 from job_posts_pub v where v.id = p.id)) desc, p.id;
rollback;`;
console.log('\n══ 마른 실행 — 바뀌는 제목 전수 (되돌림 안에서 돌렸습니다) ══');
console.log(psql(견주기));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ── 되돌림 글 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '제목산하_지역앞말_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 2026-10-28 ㉧ 전 본문으로 (ACL 은 그대로 유지됩니다 · create or replace) */',
  ...전것.map((x) => [
    'create or replace function public."' + x.이름 + '"(' + x.인수 + ')',
    'returns text language ' + x.언어 + ' immutable as $fn$',
    x.본문.trimEnd(),
    '$fn$;',
  ].join('\n')),
  '/* 되돌린 뒤 제목을 다시 만듭니다 (트리거는 보여줄제목 칸에 안 걸립니다 · 지침 8-22) */',
  'update job_posts set "보여줄제목" = 제목만들기행(job_posts)',
  '  where "보여줄제목" is distinct from 제목만들기행(job_posts)',
  '    and 제목만들기행(job_posts) is not null',
  "    and not ('보여줄제목' = any(coalesce(edited_fields, '{}')));",
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
for (const x of 전것) {
  const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = '${x.이름}';`);
  console.log('후 ACL — ' + x.이름 + ' ' + 후acl + (후acl === x.acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));
}

/* 제목 다시 만들기 — **값을 직접 넣습니다** (지침 8-22) */
const 몇 = 글만(`with x as (
    update job_posts set "보여줄제목" = 제목만들기행(job_posts)
     where "보여줄제목" is distinct from 제목만들기행(job_posts)
       and 제목만들기행(job_posts) is not null
       and not ('보여줄제목' = any(coaleske(edited_fields, '{}'))) returning id)
  select count(*) from x;`.replace('coaleske', 'coalesce'));
console.log('제목을 다시 만든 줄 — ' + 몇 + '개');
console.log('회원 화면에 제목이 빈 공고 — ' + 글만(`select count(*) from job_posts p
  join job_posts_pub v on v.id = p.id where coalesce(p."보여줄제목",'') = '';`) + '건 (0 이어야 합니다)');
