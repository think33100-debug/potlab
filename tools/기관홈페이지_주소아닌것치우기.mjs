/* `detail.기관홈페이지` 에 **주소가 아닌 값**이 담긴 줄을 봅니다 · 치웁니다 (2026-10-24)
 *
 *   node tools/기관홈페이지_주소아닌것치우기.mjs            봅니다 (안 바꿉니다)
 *   node tools/기관홈페이지_주소아닌것치우기.mjs --지우기     그 열쇠만 뺍니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 워크넷 `homePg`(기관 홈페이지) 칸에 기관이 **메일 주소**를 적어 넣습니다 —
 * 경상북도립김천노인전문요양병원이 `silverhp@naver.com` 이었고, 그 값이
 * `detail.기관홈페이지` 로 **회원 화면까지** 갔습니다 (job_one 허용 목록을 올린
 * 뒤에도 남은 1건이 이것입니다 · `docs/오류잡기_1023.md`).
 *
 * 담는 쪽은 `collect-worknet.mjs` 의 `홈페이지손질()` 로 막았습니다 (자기점검 8가지).
 * 그런데 `collect_put` 은 `detail` 을 **합칩니다** — 수집기가 그 열쇠를 안 보내도
 * **이미 담긴 값은 그대로 남습니다** (지침 9절). 그래서 이 도구로 뺍니다.
 *
 * ★ 뺄 것은 `홈페이지손질()` 이 **빈 값으로 판정한 것**뿐입니다 (같은 자 하나 · 지침 6절).
 * ★ 전 원문을 `~/되돌림/` 에 남깁니다 (지침 8-19). `updated_at` 은 안 건드립니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { 홈페이지손질 } from './워크넷칸손질.mjs';
import { 차례붙이기 } from './쪽나눠받기.mjs';

const 지우기 = process.argv.includes('--지우기');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
const DB = cfg.SUPABASE_DB_URL;
if (!U || !K || !DB) { console.error('✗ 열쇠가 모자랍니다 (서버에서 돌리십시오)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const 길2 = 차례붙이기(길);
    const r = await fetch(U + '/rest/v1/' + 길2 + (길2.includes('?') ? '&' : '?')
      + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 40000) break;
  }
  return out;
}

const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,detail');
const 있는것 = 다.filter((x) => (x.detail || {})['기관홈페이지']);
const 뺄것 = 있는것.filter((x) => !홈페이지손질((x.detail || {})['기관홈페이지']));

console.log('기관홈페이지 담긴 것 ' + 있는것.length + '건 · **주소가 아닌 것 '
  + 뺄것.length + '건** (회원 화면 ' + 뺄것.filter((x) => 보임.has(x.id)).length + '건)\n');
for (const x of 뺄것) {
  console.log('  ● ' + String(x.id).padEnd(20) + '[' + x.source + '] '
    + String(x.org_name).slice(0, 18).padEnd(19)
    + '「' + (x.detail || {})['기관홈페이지'] + '」'
    + (보임.has(x.id) ? ' · **회원 화면**' : ''));
}
if (!뺄것.length) { console.log('  치울 것이 없습니다'); process.exit(0); }
if (!지우기) { console.log('\n아무것도 안 바꿨습니다 — 지우려면 --지우기'); process.exit(0); }

const u = new URL(DB);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
const psql = (sql) => {
  const 임시 = path.join(os.tmpdir(), '홈페이지치우기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trim();
};

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 둘곳 = path.join(되돌림터, '기관홈페이지_되돌리기_' + 때 + '.sql');
fs.writeFileSync(둘곳, 뺄것.map((x) => "update job_posts set detail = detail || '"
  + JSON.stringify({ 기관홈페이지: (x.detail || {})['기관홈페이지'] }).replace(/'/g, "''")
  + "'::jsonb where id = '" + x.id + "';").join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글을 남겼습니다 — ' + 둘곳 + ' (' + 뺄것.length + '줄)');

const 센것 = psql("update job_posts set detail = detail - '기관홈페이지'\n"
  + " where id in ('" + 뺄것.map((x) => x.id).join("','") + "')\n"
  + " and detail ? '기관홈페이지'\n returning id;");
console.log('○ 열쇠를 뺀 공고 ' + (센것 ? 센것.split('\n').length : 0) + '건');
console.log('  ' + (센것 || '(없음)').split('\n').join(' · '));
