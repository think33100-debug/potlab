/* A~E **마른 실행** — 기관 이름·인턴·한자·지역 토막·지원 링크 (2026-10-28 세중님)
 *
 *   node tools/표시규칙_마른_1028.mjs
 *
 * 읽기만 합니다. 바꾸는 것은 전·후를 보신 뒤입니다.
 *   A 기관 이름 = **근무처 이름** — 워크넷 상세가 주는 칸 이름을 **원문으로** 확인
 *   B **인턴 ≠ 정규직** — 원문에 인턴이 있는데 고용형태가 정규직인 줄
 *   C 기관명·제목의 **한자·특수문자**
 *   D 제목 앞머리 **지역 토막** (`[구포]` 꼴)
 *   E **지원 링크** 갈래 — 새 차례(① 채용 게시판 → ② 기관 홈페이지 → ③ 원문)로 셈
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 줄바꿈 = String.fromCharCode(10);
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
  const 임시 = path.join(os.tmpdir(), '표시규칙_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql' + 줄바꿈 + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 머리 = '\\pset pager off' + 줄바꿈;

console.log('══ A-1 워크넷 상세가 주는 칸 이름 (원문 그대로 · 담긴 detail 열쇠를 셉니다) ══');
console.log(psql(머리 + `
  with x as (
    select jsonb_object_keys(coalesce(p.detail, '{}'::jsonb)) as 열쇠
      from job_posts p where p.source like 'WN%'
  )
  select 열쇠, count(*) as 공고 from x group by 1 order by 2 desc, 1;`));
console.log('── 그 가운데 **근무처·사업장** 꼴 열쇠가 있나 ──');
console.log(psql(머리 + `
  with x as (
    select jsonb_object_keys(coalesce(p.detail, '{}'::jsonb)) as 열쇠
      from job_posts p where p.source like 'WN%'
  )
  select 열쇠, count(*) as 공고 from x
   where 열쇠 ~ '근무|사업장|사업체|지점|점|기관|회사|업체|부서|장소'
   group by 1 order by 2 desc;`));

console.log(줄바꿈 + '══ B 인턴 ≠ 정규직 ══');
console.log(psql(머리 + `
  select coalesce(p.employ_type, '(빈칸)') as 고용형태, count(*) as 회원화면
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`));
console.log('── 원문에 **인턴**이 있는데 고용형태가 인턴이 아닌 줄 ──');
console.log(psql(머리 + `
  select p.id, p.source, coalesce(p.employ_type,'(빈칸)') as 지금고용형태,
         left(p.title, 50) as 원문제목, left(p."보여줄제목", 46) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where (p.title ~ '인턴' or coalesce(p.detail::text,'') ~ '체험형 인턴|채용형 인턴|청년인턴|청년 인턴')
     and coalesce(p.employ_type,'') !~ '인턴'
   order by p.id;`));

console.log(줄바꿈 + '══ C 기관명·제목의 한자·특수문자 ══');
console.log(psql(머리 + `
  select count(*) filter (where p.org_name ~ '[一-龥]') as 기관명에_한자,
         count(*) filter (where p."보여줄제목" ~ '[一-龥]') as 제목에_한자,
         count(*) filter (where p.org_name ~ '[★※【】◇◆□■○●▲▼]') as 기관명에_기호,
         count(*) filter (where p."보여줄제목" ~ '[★※【】◇◆□■○●▲▼]') as 제목에_기호,
         count(*) filter (where p.org_name ~ '㈜|㈐|\\(주\\)') as 기관명에_주식회사꼴
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log(psql(머리 + `
  select p.id, p.org_name, left(p."보여줄제목", 50) as 보여줄제목
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.org_name ~ '[一-龥★※【】㈜]' or p."보여줄제목" ~ '[一-龥★※【】㈜]'
   order by p.id;`));

console.log(줄바꿈 + '══ D 제목 앞머리 지역 토막 ══');
console.log(psql(머리 + `
  select p.id, p.source, substring(p.title from '^\\s*\\[([^\\]]{1,12})\\]') as 앞머리,
         left(p.title, 44) as 원문제목, left(p."보여줄제목", 46) as 보여줄제목, p.org_name
    from job_posts p join job_posts_pub v on v.id = p.id
   where p.title ~ '^\\s*\\[[^\\]]{1,12}\\]'
   order by p.id;`));

console.log(줄바꿈 + '══ E 지원 링크 — 새 차례로 셈 ══');
console.log(psql(머리 + `
  select count(*) as 회원화면,
         count(*) filter (where coalesce(p.detail->>'채용게시판','') <> '') as 채용게시판있음,
         count(*) filter (where coalesce(p.detail->>'기관홈','') <> '') as 기관홈있음,
         count(*) filter (where coalesce(p.url,'') <> '') as 원문주소있음,
         count(*) filter (where coalesce(p.detail->>'접수방법','') ~ '자사채용사이트') as 자사채용사이트말
    from job_posts p join job_posts_pub v on v.id = p.id;`));
console.log('── 기관 표에 홈페이지가 있는 곳 (②의 밑감) ──');
console.log(psql(머리 + `
  select count(*) as 회원화면_공고,
         count(*) filter (where o."홈페이지" is not null and o."홈페이지" <> '') as 기관표에_홈페이지
    from job_posts p join job_posts_pub v on v.id = p.id
    left join "기관" o on o."기관번호" = p."기관번호";`));
console.log(줄바꿈 + '★ 아무것도 바꾸지 않았습니다 (읽기만).');
