/* 손확인 ① 적용 뒤 **무엇이 붙었나** — 읽기만 (2026-10-29 세중님)
 *
 *   node tools/붙음확인_1029.mjs
 *
 * 세중님 10/29 답으로 번호를 넣은 뒤, 그 공고들이 job_one 에서 **기관 칸을 받는지**
 * 그대로 봅니다 (㉣ 의 네 칸 — 채용게시판·기관홈·기관주소·기관전화).
 * ★ job_one 은 auth.uid() 가 없으면 비회원 갈래를 갑니다 — 회원 갈래를 재려면
 *   요청 claim 을 세웁니다 (이 연결에서만 · 자료는 안 건드립니다).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '붙음확인_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 회원되기 = String.raw`\o /dev/null
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', false);
\o
\pset pager off
`;

console.log('══ 손확인(번호)·손확인(아님) 공고가 받는 기관 칸 ══');
console.log(psql(회원되기 + `
  select p.id, left(p.org_name, 16) as 기관, p."연결근거" as 근거,
         left(coalesce(p."기관번호",'(없음)'), 10) as 번호,
         (j.detail ? '채용게시판') as "①게시판", (j.detail ? '기관홈') as "②홈",
         (j.detail ? '기관주소') as 주소, (j.detail ? '기관전화') as 전화,
         exists (select 1 from job_posts_pub v where v.id = p.id) as 회원화면
    from job_posts p
    left join lateral job_one(p.id) j on true
   where p."연결근거" in ('손확인(번호)','손확인(아님)')
   order by p."연결근거", p.id;`));

console.log('\n══ 새로 붙은 기관 줄 — 심평원이 주는 칸과 안 주는 칸 ══');
console.log(psql(`
  select count(*) as 줄, count(주소) as 주소있음, count(전화) as 전화있음,
         count(홈페이지) as 홈페이지있음, count(채용페이지) as 채용페이지있음
    from 기관
   where 기관번호 in (select "기관번호" from job_posts where "연결근거" = '손확인(번호)');`));
