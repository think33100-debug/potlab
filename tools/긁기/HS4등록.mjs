/* 긁기 출처 **HS4** 를 등록합니다 (2026-10-24 세중님 1번 ㄱㄱ)
 *
 *   node tools/긁기/HS4등록.mjs            지금 모습만 (기본 · 마른)
 *   node tools/긁기/HS4등록.mjs --진짜      등록합니다
 *
 * ── 무엇을 만드나 ───────────────────────────────────────────
 *   ① `collect_source` 한 줄 — HS4 · 「병원 홈페이지 긁기(2판)」 · **짝 없음**
 *      늦음기준시간·마감시각줌은 **비웁니다**(미정) — 아직 크론이 없고, 그 출처가
 *      마감 시각을 주는지 확인하지 않았습니다. 짐작으로 채우지 않습니다 (지침 10-3)
 *   ② `collect_secret` 한 줄 — 열쇠는 **여기서 지어** 바로 담습니다
 *   ③ 서버 `.env` 에 `COLLECT_KEY_HS4=…` 한 줄
 *
 * ★ **열쇠 값을 화면에 찍지 않습니다** (지침 8-11) — 길이만 적습니다.
 * ★ `수집기짝` 에는 **안 넣습니다** — 짝이 없는 새 길입니다 (빨간 줄 규칙과 무관).
 * ★ 되돌림 글을 `~/되돌림/` 에 남깁니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const 진짜 = process.argv.includes('--진짜');
const 출처 = 'HS4';
const ENV = path.join(os.homedir(), 'potlab', '.env');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql, 꼴 = ['-X', '-A', '-q', '-F', '  ']) {
  const 임시 = path.join(os.tmpdir(), 'HS4등록_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 한값 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']).trim();

const 보기 = `
  select 'collect_source' as 표, count(*)::text as 줄,
         count(*) filter (where code = 'HS4')::text as HS4
    from collect_source
  union all
  select 'collect_secret', count(*)::text,
         count(*) filter (where source = 'HS4')::text
    from collect_secret
  union all
  select '수집기짝', count(*)::text,
         count(*) filter (where "새출처" = 'HS4')::text
    from "수집기짝";`;
console.log('── 등록 전 ──\n' + psql(보기));
const 이미있나 = 한값("select count(*) from collect_source where code = 'HS4';") !== '0';
const 열쇠있나 = 한값("select count(*) from collect_secret where source = 'HS4';") !== '0';
const env있나 = fs.existsSync(ENV) && /^COLLECT_KEY_HS4=/m.test(fs.readFileSync(ENV, 'utf8'));
console.log('\n지금 — collect_source ' + (이미있나 ? '있음' : '없음')
  + ' · collect_secret ' + (열쇠있나 ? '있음' : '없음')
  + ' · .env ' + (env있나 ? '있음' : '없음'));

if (이미있나 && 열쇠있나 && env있나) { console.log('\n○ 셋 다 이미 있습니다 — 할 일이 없습니다'); process.exit(0); }
if (!진짜) {
  console.log('\n만들 것 —');
  if (!이미있나) console.log("  collect_source  ('HS4', '병원 홈페이지 긁기(2판)', 'tools/긁기/*.mjs · Lightsail 서울 · 짝 없음 · 10/31 까지 보류함만', true, null, null)");
  if (!열쇠있나) console.log('  collect_secret  HS4 · 열쇠 32자 (값은 안 찍습니다)');
  if (!env있나) console.log('  ' + ENV + ' 에 COLLECT_KEY_HS4 한 줄');
  console.log('\n[마른] 아무것도 안 만들었습니다 — --진짜 로 만듭니다');
  process.exit(0);
}

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
fs.writeFileSync(path.join(되돌림터, 'HS4등록_되돌리기_' + 때 + '.sql'),
  '/* 되돌리기 — HS4 출처 등록 (2026-10-24) */\n'
  + "delete from collect_secret where source = 'HS4';\n"
  + "delete from collect_source where code   = 'HS4';\n"
  + '/* 그리고 ~/potlab/.env 에서 COLLECT_KEY_HS4 줄을 지웁니다 */\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + path.join(되돌림터, 'HS4등록_되돌리기_' + 때 + '.sql'));

const 열쇠 = crypto.randomBytes(24).toString('base64url');   /* 32자 */
if (!이미있나) {
  psql(`insert into collect_source(code, name, note, live, "늦음기준시간", "마감시각줌")
        values ('HS4', '병원 홈페이지 긁기(2판)',
                'tools/긁기/*.mjs · Lightsail 서울 · 짝 없음 · 2026-10-24 부터 · 10/31 까지 보류함만(hold=true 고정)',
                true, null, null);`);
  console.log('○ collect_source 에 HS4 를 넣었습니다');
}
if (!열쇠있나) {
  psql(`insert into collect_secret(source, secret, note, made_on)
        values ('HS4', '${열쇠}', '긁기 2판 · tools/긁기/ 가 씁니다', current_date);`);
  console.log('○ collect_secret 에 열쇠를 넣었습니다 (길이 ' + 열쇠.length + '자 · 값은 안 찍습니다)');
}
if (!env있나) {
  fs.appendFileSync(ENV, (fs.readFileSync(ENV, 'utf8').endsWith('\n') ? '' : '\n')
    + 'COLLECT_KEY_HS4=' + 열쇠 + '\n', 'utf8');
  console.log('○ ' + ENV + ' 에 한 줄 더했습니다 (길이 ' + 열쇠.length + '자)');
}

console.log('\n── 등록 뒤 ──\n' + psql(보기));
console.log('\n── collect_source HS4 ──\n' + psql(`
  select code, name, live::text,
         coalesce("늦음기준시간"::text,'(미정)') as 늦음기준,
         coalesce("마감시각줌"::text,'(미정)') as 마감시각줌
    from collect_source where code = 'HS4';`));
console.log('\n★ 열쇠 값은 어디에도 찍지 않았습니다 (지침 8-11).');
