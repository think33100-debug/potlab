/* 2026-10-23 에 **운영 DB 에 넣은 시험 열쇠**를 봅니다 · 지웁니다 (세중님 지시)
 *
 *   node tools/evidence시험값치우기.mjs            봅니다 (아무것도 안 바꿉니다)
 *   node tools/evidence시험값치우기.mjs --지우기     시험 열쇠만 뺍니다 (전후 원문을 찍습니다)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * `collect_put` 이 `evidence` 를 **덮는** 것을 고쳤습니다(합치기). 고친 것이 참말인지
 * 보려고 GJ305543·GJ305988 의 `evidence` 에 **시험 열쇠**를 넣었습니다.
 * 세중님 지시 — 「19:22 바퀴 뒤 남는지 확인 → **시험 열쇠는 바로 지우고**
 * (지우기 전후 원문) · 운영 DB 시험값은 **이번 한 번만**」.
 *
 * ★ 지우는 것은 **제가 넣은 열쇠 하나**뿐입니다. 다른 열쇠는 `-` 로 건드리지 않습니다.
 * ★ 지우기 전 원문을 `~/되돌림/` 에 남깁니다 (지침 8-19).
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const 공고들 = ['GJ305543', 'GJ305988'];
const 시험열쇠 = '직군근거원문';   /* 2026-10-23 에 넣은 열쇠 */
const 지우기 = process.argv.includes('--지우기');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const DB = cfg.SUPABASE_DB_URL;
if (!DB) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(DB);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
const psql = (sql) => {
  const 임시 = path.join(os.tmpdir(), 'evidence시험_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trim();
};

const 어디 = "('" + 공고들.join("','") + "')";
const 보기 = "select id || '  evidence=' || coalesce(evidence::text, '(null)')\n"
  + "       || '\n    뽑은값.직군근거원문=' || coalesce(\"뽑은값\"->>'직군근거원문', '(없음)')\n"
  + '  from job_posts where id in ' + 어디 + ' order by id;';

console.log('── 지금 원문 ──');
const 전 = psql(보기);
console.log(전 || '(줄이 없습니다)');

if (!지우기) {
  console.log('\n아무것도 안 바꿨습니다 — 지우려면 --지우기');
  process.exit(0);
}

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 때 = new Date().toLocaleString('sv-SE').replace(/[-: ]/g, '').slice(0, 15)
  .replace(/^(\d{8})(\d{6})$/, '$1_$2');
const 둘곳 = path.join(되돌림터, 'evidence시험값_' + 때 + '.txt');
fs.writeFileSync(둘곳, '지우기 전 원문 (2026-10-23 시험 열쇠 「' + 시험열쇠 + '」)\n\n' + 전 + '\n');
console.log('\n○ 지우기 전 원문을 남겼습니다 — ' + 둘곳);

/* 그 열쇠 하나만 뺍니다. updated_at 은 안 건드립니다 (지침 9절) */
const 센것 = psql("update job_posts set evidence = evidence - '" + 시험열쇠 + "'\n"
  + ' where id in ' + 어디 + " and evidence ? '" + 시험열쇠 + "'\n"
  + ' returning id;');
console.log('○ 열쇠를 뺀 공고 — ' + (센것 ? 센것.split('\n').join(' · ') : '(없음 — 이미 빠져 있었습니다)'));

console.log('\n── 지운 뒤 원문 ──');
console.log(psql(보기) || '(줄이 없습니다)');
