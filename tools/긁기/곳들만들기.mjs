/* 긁기 **곳 목록**을 만듭니다 — 분류표(①HTML게시판)에서 꼴별로 골라 기관번호를 붙여
 * `tools/긁기/<꼴>_곳들.json` 으로 적습니다 (2026-10-24 세중님 C2·C3)
 *
 *   node tools/긁기/곳들만들기.mjs --꼴 그누보드          봅니다 (적지 않습니다)
 *   node tools/긁기/곳들만들기.mjs --꼴 그누보드 --적기    파일로 적습니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 긁기는 **어느 기관인지 알고** 시작합니다 — 그래서 기관번호를 설정에 **직접** 적습니다
 * (이름 매칭을 안 거칩니다 · 세중님 C3 · docs/매칭규칙_1024.md).
 *
 * ★ 기관번호는 `기관` 표에서 **이름키가 딱 하나**로 풀릴 때만 적습니다.
 *   여럿이거나 없으면 `null` 로 두고 **왜**를 적습니다 — 짐작하지 않습니다 (지침 10-3).
 *   null 인 곳은 긁어도 **기관을 안 붙입니다** (손확인 길로 갑니다).
 * ★ 주소는 분류표에서 **실제로 열어 본 것**만 씁니다 (docs/사각지대_분류_1024.json).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 꼴 = argv.includes('--꼴') ? argv[argv.indexOf('--꼴') + 1] : '그누보드';
const 적기 = argv.includes('--적기');

/** 꼴을 가리는 자 — 분류표의 주소·게시판 링크로 봅니다 */
export const 꼴가리기 = {
  그누보드: (주소) => /\/bbs\/board\.php\?/.test(주소),
  경기도의료원: (주소) => /medical\.or\.kr\/front\/boardList\.do/.test(주소),
};

const 분류자리 = path.join(여기, '..', '..', 'docs', '사각지대_분류_1024.json');
if (!fs.existsSync(분류자리)) { console.error('✗ 분류표가 없습니다 — ' + 분류자리); process.exit(1); }
const 분류 = JSON.parse(fs.readFileSync(분류자리, 'utf8'));
const 가려 = 꼴가리기[꼴];
if (!가려) { console.error('✗ 모르는 꼴 — ' + Object.keys(꼴가리기).join(' · ')); process.exit(1); }

const 곳들 = 분류.목록
  .filter((x) => x.갈래 === '①HTML게시판')
  .map((x) => ({ 이름: x.기관, 종류: x.종류, 지역: (x.시도 + ' ' + x.시군구).trim(),
    주소: x.끝주소 || x.주소 }))
  .filter((x) => x.주소 && 가려(x.주소));
console.log(꼴 + ' 꼴 — ' + 곳들.length + '곳 (①HTML게시판 가운데)');

/* ── 기관번호 찾기 (psql · 이름키가 딱 하나일 때만) ── */
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '곳들_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

for (const 곳 of 곳들) {
  const 줄 = psql("select 기관번호, 이름 from 기관 where 이름키 = hira_name_key('"
    + 따옴(곳.이름) + "') order by 기관번호;").split('\n').filter(Boolean).map((l) => l.split('\t'));
  if (줄.length === 1) { [곳.기관번호] = 줄[0]; 곳.왜 = '기관 표에서 이름키로 하나'; }
  else if (!줄.length) { 곳.기관번호 = null; 곳.왜 = '기관 표에 그 이름이 없습니다 — 손확인'; }
  else { 곳.기관번호 = null; 곳.왜 = '이름키로 ' + 줄.length + '곳 — 손확인 (짐작 금지)'; }
}
const 붙음 = 곳들.filter((x) => x.기관번호);
console.log('기관번호 붙은 곳 ' + 붙음.length + ' · 없는 곳 ' + (곳들.length - 붙음.length) + '\n');
for (const 곳 of 곳들) {
  console.log('  ' + (곳.기관번호 ? '○' : '·') + ' ' + 곳.이름.slice(0, 22).padEnd(23)
    + (곳.종류 || '').padEnd(7) + (곳.기관번호 ? 곳.기관번호.slice(0, 18) + '…' : 곳.왜));
}

if (!적기) { console.log('\n[보기만] 파일로 적으려면 --적기'); process.exit(0); }
const 낼곳 = path.join(여기, 꼴 + '_곳들.json');
fs.writeFileSync(낼곳, JSON.stringify({ 꼴, 만든때: new Date().toLocaleString('sv-SE').replace('T', ' '),
  곳: 곳들.length, 기관번호붙음: 붙음.length, 곳들 }, null, 1) + '\n');
console.log('\n○ ' + 낼곳 + ' 에 적었습니다');
