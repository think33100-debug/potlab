/* ★ 사각지대 주소 — **흔한 종별 말만 맞은 것**을 지웁니다 (2026-10-24 밤 · 제 자가 느슨했습니다)
 *
 *   node tools/사각지대_주소_좁힌자로다시.mjs            봅니다 (마른)
 *   node tools/사각지대_주소_좁힌자로다시.mjs --진짜      홈페이지를 비웁니다
 *
 * ── 무슨 일 ─────────────────────────────────────────────────
 * 주소를 담을 때 「그 기관이 맞는지」를 ㉠ 전화 ㉡ 이름 글자로 봤습니다. 그런데 이름 글자
 * 쪽이 느슨해서 **「노인전문병원」 같은 흔한 말**이 맞아도 받았습니다 — 그런 쪽은 수십
 * 곳이라 **엉뚱한 병원 주소**가 담길 수 있습니다 (지침 10-5 — 재는 자를 먼저 의심).
 *
 * 자를 좁혔고(`고유글자(토막) ≥ 2`), **느슨한 자로 담긴 줄은 비웁니다** — 그 곳들은
 * 손확인 ② 목록으로 갑니다. 전화로 맞춘 줄은 그대로 둡니다 (근거가 셉니다).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 고유글자 } from './주소맞나.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '좁힌자_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

const 줄들 = psql(`
  select "기관번호", 이름, coalesce("홈페이지",''), "불변근거"->>'홈페이지'
    from 기관
   where "불변근거"->>'홈페이지' like '%열어서 확인%'
   order by 이름;`).split('\n').filter(Boolean).map((l) => l.split('\t'));
console.log('열어서 확인한 근거로 담긴 줄 ' + 줄들.length + '개');

const 지울것 = [];
for (const [번호, 이름, 주소, 근거] of 줄들) {
  const m = String(근거).match(/쪽에 「([^」]+)」/);
  if (!m) continue;                               /* 전화로 맞춘 것은 그대로 둡니다 */
  if (고유글자(m[1]).length >= 2) continue;        /* 좁힌 자도 통과하는 것은 그대로 */
  지울것.push({ 번호, 이름, 주소, 토막: m[1], 근거 });
}
console.log('흔한 말만 맞은 줄 **' + 지울것.length + '개** (이것만 비웁니다)');
for (const x of 지울것) {
  console.log('  · ' + x.이름.slice(0, 24).padEnd(25) + '「' + x.토막 + '」 · ' + x.주소.slice(0, 40));
}
if (!지울것.length) process.exit(0);
if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 비웁니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '사각지대주소_흔한말비우기_' + 때 + '.sql');
const 줄 = ['/* 되돌리기 — 흔한 종별 말만 맞아 비운 홈페이지를 되살립니다 */'];
for (const x of 지울것) {
  줄.push(`update 기관 set "홈페이지" = '${따옴(x.주소)}',`
    + ` "불변근거" = coalesce("불변근거",'{}'::jsonb) || jsonb_build_object('홈페이지','${따옴(x.근거)}')`
    + ` where "기관번호" = '${따옴(x.번호)}';`);
  psql(`update 기관
          set "홈페이지" = null,
              "불변근거" = coalesce("불변근거",'{}'::jsonb)
                || jsonb_build_object('홈페이지', '비움 — 흔한 종별 말(「${따옴(x.토막)}」)만 맞았습니다 (2026-10-24)'),
              "고친때" = now()
        where "기관번호" = '${따옴(x.번호)}';`);
}
fs.writeFileSync(되돌림, 줄.join('\n') + '\n', 'utf8');
console.log('\n○ ' + 지울것.length + '줄 비웠습니다 · 되돌림 ' + 되돌림);
