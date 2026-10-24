/* `기관잇기()` 가 **이름 글자로 붙은 것도 근거를 남기게** 합니다
 * (2026-10-24 세중님 ㉮ — 「이름으로 붙은 건 연결근거=「이름」 남기기」)
 *
 *   node tools/기관잇기_이름근거.mjs            바꿀 자리만 (기본 · 마른)
 *   node tools/기관잇기_이름근거.mjs --진짜      올립니다
 *   node tools/기관잇기_이름근거.mjs --자기점검   규칙만
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 첫 바퀴를 돌리니 회원 화면 288건이 **자동 85 · 없음 202 · 대기 1** 로 붙었는데,
 * 「없음」 202건의 `연결근거` 가 **비어 있었습니다**. 「없음」은 심평원에 그 이름이
 * 없어서 `'NAME:<이름키>'` 로 이은 것이고, **이름 글자로 이은 것**입니다.
 *
 * ★ 「이름」은 좁히기 ①(이름키가 심평원 한 곳뿐)에도 쓰는 말입니다. 그래도
 *   **연결상태가 둘을 가립니다** — `자동/이름`(심평원 한 곳) ↔ `없음/이름`(심평원에 없음).
 *   세중님 글 그대로 「이름」으로 적습니다 (제가 말을 바꾸지 않습니다).
 *
 * ★ 인수가 그대로라 `create or replace` 가 ACL 을 유지합니다 (지침 6-2). 그래도 전후 비교.
 * ★ 되돌림 — `~/되돌림/기관잇기_되돌리기_<날짜>.sql`
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

export const 낡은줄 = '      coalesce(h.근거, g.근거) as 근거,';
export const 새줄 = [
  '      /* ★ 2026-10-24 세중님 ㉮ — **이름 글자로 이은 것도 근거를 남깁니다.**',
  "         전에는 '없음'(심평원에 그 이름이 없어 'NAME:<이름키>' 로 이은 것) 줄의",
  '         근거가 비어 있어서, 회원 화면 202건이 「근거 빈칸」으로 보였습니다.',
  '         「이름」은 좁히기 ①에도 쓰는 말이지만 **연결상태가 가립니다** —',
  '         자동/이름(심평원 한 곳뿐) ↔ 없음/이름(심평원에 없음). */',
  '      coalesce(h.근거, g.근거,',
  '               case when h.ykiho is null and g.근거 is null',
  '                     and not exists (select 1 from hira_org o where o.name_key = c.이름키)',
  "                    then '이름' end) as 근거,",
].join('\n');

export function 바꾸기(본문) {
  const s = String(본문 || '');
  if (s.includes('이름 글자로 이은 것도 근거를 남깁니다')) throw new Error('이미 들어 있습니다');
  const 몇 = s.split(낡은줄).length - 1;
  if (몇 !== 1) throw new Error('바꿀 자리가 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
  return s.replace(낡은줄, 새줄);
}

function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = ['CREATE OR REPLACE FUNCTION public."기관잇기"()', '  ), 정할것 as (',
    '    select c.id,', "      case when h.ykiho is not null then 'HIRA:' || h.ykiho",
    낡은줄, "      case when h.ykiho is not null or g.근거 is not null then '자동'",
    '  update job_posts j', '     set 기관번호 = t.기관번호, 연결상태 = t.상태, 연결근거 = t.근거'].join('\n');
  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('빈 근거 자리가 사라졌다', !새.includes('coalesce(h.근거, g.근거) as 근거,'));
    보("이름 갈래가 생겼다", 새.includes("then '이름' end) as 근거,"));
    보('심평원에 있으면(대기) 「이름」을 안 적는다',
      새.includes('and not exists (select 1 from hira_org o where o.name_key = c.이름키)'));
    보('자동 갈래 근거는 그대로 먼저', 새.includes('coalesce(h.근거, g.근거,'));
    보('상태 정하는 줄은 안 건드렸다', 새.includes("case when h.ykiho is not null or g.근거 is not null then '자동'"));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
  }
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
}
console.log('── 자기점검 ──');
자기점검();
if (자기점검만) process.exit(0);

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
  const 임시 = path.join(os.tmpdir(), '기관잇기근거_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return r.stdout || '';
}
const 권한보기 = "select p.oid::regprocedure::text || '  ' || coalesce(p.proacl::text, '(없음)')\n"
  + "       || '  secdef=' || p.prosecdef\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '기관잇기';";
const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '기관잇기';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 — ' + 본문.slice(0, 80)); process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄');
let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');
console.log('\n════════ 바꾸는 한 자리 ════════\n낡  ' + 낡은줄.trim()
  + '\n새  ' + 새줄.split('\n').filter((l) => !l.trim().startsWith('/*') && !l.trim().startsWith('*')
    && !l.trim().endsWith('*/')).map((l) => l.trim()).join(' ⏎ ') + '\n════════ 끝 ════════');

if (!진짜) { console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '기관잇기_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다 (' + 본문.split('\n').length + '줄)');
psql(새본문 + ';');
console.log('○ 올렸습니다');
const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 **글자까지 같습니다**' : '✗ ACL 이 달라졌습니다');
