/* ㉭ `job_one` 에 **`source` 칸**을 더합니다 (2026-10-28 세중님 ㉭ 승인)
 *
 *   node tools/job_one_source_1028.mjs           마른 실행 (되돌림 안에서 전·후)
 *   node tools/job_one_source_1028.mjs --진짜     바꿉니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 화면이 「이 공고가 어느 출처인가」를 알아야 지원 링크·배지 같은 것을 가릴 수 있는데
 * 창구가 `source` 를 안 내려줍니다. 지금은 **공고 번호 앞머리**(HS…)로 보고 있습니다
 * (`web/lib/job-state.ts` 의 `긁기공고인가()`). 번호 규칙을 고치는 날 조용히 틀립니다.
 *
 * ── ★ 반환 꼴이 바뀌므로 `create or replace` 가 안 됩니다 ──
 *   `cannot change return type of existing function` 이 납니다 → **drop 뒤 다시 만듭니다**.
 *   그러면 **ACL 이 통째로 지워지고 PUBLIC 이 다시 붙습니다** (지침 6-2a · 6-3).
 *   그래서 전 ACL 을 **원문 그대로 찍어 두고**, 다시 만든 뒤 **글자까지 같게** 되돌립니다.
 *   `delete` 글자가 없어 승인 창은 안 뜹니다 (지침 8-7) — 그래도 세중님 승인 자리입니다.
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
  const 임시 = path.join(os.tmpdir(), 'job_one_source_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 머리 = '\\pset pager off\n';
const 회원되기 = String.raw`\o /dev/null
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
\o
`;

/* ── 지금 정의·ACL·시그니처 ── */
const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'job_one';`);
if (몇벌 !== '1') { console.error('✗ job_one 이 ' + 몇벌 + '벌입니다 (1 이어야 합니다)'); process.exit(1); }
const 전정의 = psql(머리 + `select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`, ['-X', '-A', '-t', '-q']);
const 전acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`);
const 시그 = 글만(`select p.oid::regprocedure::text from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`);
if (!전정의.trim()) { console.error('✗ 정의를 못 읽었습니다'); process.exit(1); }
console.log('전 — ' + 시그 + ' · ' + 전정의.split('\n').length + '줄');
console.log('전 ACL — ' + 전acl);

/* ── 누가 이 함수를 부르나 (다른 함수 안에서 부르면 drop 이 막힙니다) ── */
console.log('── job_one 을 부르는 다른 함수 ──');
console.log(psql(머리 + `
  /* prokind 'f' 만 — 모둠 함수(array_agg 꼴)에 pg_get_functiondef 를 걸면 죽습니다 */
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname <> 'job_one' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) ~ 'job_one\\s*\\(' order by 1;`));

/* ── 바꿀 자리 둘 — 반환 꼴과 select 목록 ── */
const 바꿈들 = [
  { 무엇: '㉠ 반환 꼴에 source 더하기',
    옛: `RETURNS TABLE(id text, org_name text,`,
    새: `RETURNS TABLE(id text, source text, org_name text,` },
  { 무엇: '㉡ select 목록에 j.source 더하기',
    옛: `  select j.id, 기관이름보정_아이디로(j.id, j.org_name,`,
    새: `  select j.id,
         /* ★ 2026-10-28 세중님 ㉭ — 출처를 내립니다. 화면이 공고 번호 앞머리로
            「긁기인가」를 짐작하던 자리를 없앱니다 (web/lib/job-state.ts 긁기공고인가).
            ★ job_posts_pub 뷰에는 source 칸이 **없습니다** — job_posts 를 따로
              읽습니다 (이 함수는 security definer 라 됩니다 · 모집인원과 같은 꼴) */
         (select x.source from job_posts x where x.id = j.id),
         기관이름보정_아이디로(j.id, j.org_name,` },
];
let 새정의 = 전정의;
for (const x of 바꿈들) {
  const 몇 = 새정의.split(x.옛).length - 1;
  if (몇 !== 1) {
    console.error('✗ ' + x.무엇 + ' — 바꿀 글자가 ' + 몇 + '번 나옵니다 (1 이어야 합니다). 멈춥니다');
    process.exit(1);
  }
  새정의 = 새정의.split(x.옛).join(x.새);
  console.log('○ ' + x.무엇);
}

/* ── ACL 되돌리는 글 — 전 ACL 글자에서 **그대로** 만듭니다 (지침 6-2a) ── */
const 역할들 = [...전acl.matchAll(/([A-Za-z_][A-Za-z0-9_]*)=X\//g)].map((m) => m[1]);
if (!역할들.length) { console.error('✗ 전 ACL 에서 역할을 못 읽었습니다 — ' + 전acl); process.exit(1); }
const PUBLIC있나 = /(^|,)\{?=X\//.test(전acl);
console.log('전 ACL 의 역할 — ' + 역할들.join(' · ') + ' · PUBLIC ' + (PUBLIC있나 ? '있음' : '없음'));
const ACL되돌리기 = [
  `revoke all on function public.job_one(p_id text) from public, anon, authenticated;`,
  ...역할들.map((r) => `grant execute on function public.job_one(p_id text) to ${r};`),
  ...(PUBLIC있나 ? [`grant execute on function public.job_one(p_id text) to public;`] : []),
].join('\n');

const 바꾸기SQL = [
  `drop function public.job_one(p_id text);`,
  새정의.trimEnd() + ';',
  ACL되돌리기,
].join('\n');

/* ── 마른 실행 ── */
const 보기SQL = `
  select j.id, j.source, j.org_name, left(j.title, 30) as 제목,
         (j.detail ? '채용게시판') as 채용게시판칸
    from job_posts_pub v, lateral job_one(v.id) j
   order by j.id limit 5;`;
console.log('\n══ 마른 실행 — 되돌림 안에서 바꾸고 불러 봅니다 ══');
console.log(psql(머리 + 회원되기 + `
begin;
${바꾸기SQL}
select coalesce(p.proacl::text,'(기본값)') as "바꾼 뒤 ACL" from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';
${보기SQL}
rollback;`));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, 'job_one_source_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* ㉭ 되돌리기 — 2026-10-28 전 정의·전 ACL 그대로 */',
  '/* 전 ACL: ' + 전acl + ' */',
  'drop function public.job_one(p_id text);',
  전정의.trimEnd() + ';',
  ACL되돌리기,
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'job_one';`);
console.log('후 ACL — ' + 후acl);
console.log(후acl === 전acl ? '○ 전과 **글자까지 같습니다**'
  : '⚠ 전과 다릅니다 — 전 ' + 전acl + ' / 후 ' + 후acl);
console.log('\n══ 후 — 불러 봅니다 (회원 갈래) ══');
console.log(psql(머리 + 회원되기 + 보기SQL));
console.log('── 비회원도 그대로인가 (url 0 이어야) ──');
console.log(psql(머리 + `
  select count(*) as 공고, count(j.url) as "url 준 것(0 이어야)",
         count(j.source) as "source 준 것"
    from job_posts_pub v, lateral job_one(v.id) j;`));
