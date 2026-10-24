/* 공고를 기관에 잇습니다 — **하루 한 번** (2026-10-24 세중님 ㉮ 승인)
 *
 *   node tools/기관잇기돌리기.mjs            잇고 셈을 찍습니다 (크론이 이것을 부릅니다)
 *   node tools/기관잇기돌리기.mjs --마른      셈만 (아무것도 안 바꿉니다)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 표와 함수는 2026-10-08 에 만들었는데 **크론에 올리지 않았습니다.** 그래서
 * 기관 표가 **2026-10-09 11:19** 뒤로 안 고쳐지고, 10-12~10-23 에 들어온 공고
 * **155건**이 아무 데도 안 붙어 있었습니다 (`docs/기관표_현황_1024.md` ②).
 *
 * ── 차례 ─────────────────────────────────────────────────────
 *   ① `기관잇기()`      공고 → 기관번호 (좁히는 차례 ⓪~⑤ · 연결근거를 남깁니다)
 *   ② `기관표채우기()`   붙은 기관번호로 `기관` 줄을 넣고 고칩니다
 *   ③ 회원 화면 공고가 **번호로 / 이름 글자로 / 안 붙음** 몇 건인지 찍습니다
 *
 * ★ `연결상태='사람'`(관리자가 손으로 이은 것)과 `기관.확인한때`가 있는 줄은
 *   두 함수가 **안 건드립니다** (함수 본문에 그렇게 쓰여 있습니다).
 * ★ `updated_at` 은 안 건드립니다 (지침 9절).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 마른 = process.argv.includes('--마른');
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '기관잇기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-q', '-F', '  ', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 때글 = () => new Date().toLocaleString('sv-SE').replace('T', ' ');
const 셈sql = `
  select coalesce(p."연결상태", '(안 붙음)') as 연결상태,
         count(*) as 공고,
         count(*) filter (where p."기관번호" like 'HIRA:%') as 번호로,
         count(*) filter (where p."기관번호" like 'NAME:%') as 이름으로
    from job_posts p join job_posts_pub v on v.id = p.id
   group by 1 order by 2 desc;`;

console.log('[' + 때글() + '] ── 기관잇기' + (마른 ? ' · 마른' : ''));
console.log('\n── 전 (회원 화면) ──\n' + psql(셈sql));

if (마른) { console.log('\n[마른] 아무것도 안 바꿨습니다'); process.exit(0); }

console.log('\n── ① 기관잇기() ──\n' + psql('select * from "기관잇기"();'));
console.log('\n── ② 기관표채우기() ──\n' + psql('select * from "기관표채우기"();'));
console.log('\n── 후 (회원 화면) ──\n' + psql(셈sql));
console.log('\n── 연결근거별 (회원 화면) ──\n'
  + psql(`select coalesce(p."연결근거", '(빈칸)') as 근거, count(*) as 공고
            from job_posts p join job_posts_pub v on v.id = p.id
           group by 1 order by count(*) desc;`));
console.log('\n── 기관 표 ──\n'
  + psql(`select count(*) as 줄, count(*) filter (where 기관번호 like 'HIRA:%') as 심평원번호,
                 count(*) filter (where 기관번호 like 'NAME:%') as 이름열쇠,
                 max(고친때)::text as 마지막_고친때
            from 기관;`));
