/* ㉪ 지난 교육을 **창구에서도** 내립니다 (2026-10-28 세중님 승인)
 *
 *   node tools/교육창구_지난것_1028.mjs            마른 실행 (되돌림 안에서 전·후)
 *   node tools/교육창구_지난것_1028.mjs --진짜      바꿉니다
 *   node tools/교육창구_지난것_1028.mjs --자기점검   울타리 바꾸는 규칙만
 *
 * ── 무엇 ─────────────────────────────────────────────────────
 *   ① 새 함수 `지난교육인가(끝, 시작, 올린날, 오늘) → boolean`
 *      규칙은 `web/lib/edu-state.ts` 와 **같은 뜻**입니다 —
 *      끝 → 시작 → **담은 날 +30일** · 셋 다 모르면 **안 내립니다**
 *   ② `교육목록()`·`교육셈()` 의 울타리를 그 함수로 바꿉니다
 *
 * ── 왜 창구까지 ─────────────────────────────────────────────
 * 화면은 2026-10-28 부터 걸러 그립니다. 창구가 그대로라
 *   ㉠ 한 쪽(20줄) 가운데 몇 줄이 걸러져 **쪽마다 건수가 들쭉날쭉**하고
 *   ㉡ 탭 숫자(`교육셈`)가 **걸러내기 전 수**였습니다 (110건)
 *
 * ── 창구를 손으로 다시 쓰지 않습니다 ───────────────────────
 * **지금 정의(`pg_get_functiondef`)를 받아 울타리만 바꿉니다.** 손으로 쓰면
 * 인수 기본값이 빠져 `cannot remove parameter defaults` 로 막히고(2026-10-28 에
 * 한 번 막혔습니다), 받아서 고치면 기본값·권한·`security definer`·`stable` 이
 * 그대로 따라옵니다. 되돌림 글도 **지금 정의 그대로**가 됩니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 진짜 = process.argv.includes('--진짜');
const 줄바꿈 = String.fromCharCode(10);

/* ── 바꾸는 규칙 ── */
export const 옛울타리 = /and \(p_지난것\s*or e\.끝 is null\s*or e\.끝 >= \(now\(\) at time zone 'Asia\/Seoul'\)::date\)/;
export const 새울타리 = [
  'and (p_지난것',
  "         or not \"지난교육인가\"(e.끝, e.시작, e.올린날, (now() at time zone 'Asia/Seoul')::date))",
].join(줄바꿈);

/** 지금 정의를 받아 울타리를 바꿉니다 — 못 찾으면 **null** (짐작으로 안 고칩니다) */
export function 고친정의(정의) {
  if (!옛울타리.test(String(정의 || ''))) return null;
  return String(정의).replace(옛울타리, 새울타리);
}

export const 새함수 = [
  'create or replace function public."지난교육인가"(',
  '  "p_끝" date, "p_시작" date, "p_올린날" date, "p_오늘" date)',
  'returns boolean language sql immutable as $fn$',
  '  select case',
  '    when "p_오늘" is null then false',
  '    when "p_끝" is not null then "p_끝" < "p_오늘"',
  '    when "p_시작" is not null then "p_시작" < "p_오늘"',
  '    when "p_올린날" is not null then ("p_올린날" + 30) < "p_오늘"',
  '    else false                      -- 셋 다 모르면 안 내립니다',
  '  end',
  '$fn$;',
  'revoke execute on function public."지난교육인가"(date, date, date, date) from public, anon;',
  'grant execute on function public."지난교육인가"(date, date, date, date)',
  '  to authenticated, service_role;',
].join(줄바꿈);

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public."교육셈"("p_직군" text DEFAULT NULL::text,',
    ' "p_출처" text DEFAULT NULL::text, "p_지난것" boolean DEFAULT false)',
    ' RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $function$',
    '  select count(*)::int',
    '  from 교육 e',
    '  where (p_출처 is null or e.출처 = p_출처)',
    '    and (p_지난것',
    '         or e.끝 is null',
    "         or e.끝 >= (now() at time zone 'Asia/Seoul')::date);",
    '$function$',
  ].join(줄바꿈);
  const 고친 = 고친정의(본);
  보('울타리를 찾아 바꾼다', 고친 !== null);
  보('지난교육인가 를 부른다', /"지난교육인가"\(e\.끝, e\.시작, e\.올린날/.test(고친));
  보('옛 울타리는 사라진다', !/e\.끝 is null/.test(고친));
  보('인수 기본값은 그대로', /DEFAULT NULL::text/.test(고친) && /DEFAULT false/.test(고친));
  보('security definer 도 그대로', /SECURITY DEFINER/.test(고친));
  보('p_지난것 갈래는 남는다', /and \(p_지난것/.test(고친));
  보('울타리가 없으면 null', 고친정의('select 1') === null);
  보('두 번 고치지 않는다', 고친정의(고친) === null);
  보('새 함수에 revoke 가 붙는다', /revoke execute/.test(새함수) && /from public, anon/.test(새함수));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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
  const 임시 = path.join(os.tmpdir(), '교육창구_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql' + 줄바꿈 + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 정의받기 = (이름) => 글만(`select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '${이름}';`);
const acl받기 = (이름) => 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '${이름}';`);

const 이름들 = ['교육목록', '교육셈'];
const 옛정의 = {};
const 옛acl = {};
for (const 이름 of 이름들) {
  옛정의[이름] = 정의받기(이름);
  옛acl[이름] = acl받기(이름);
  if (!옛정의[이름].trim()) { console.error('✗ ' + 이름 + ' 정의를 못 읽었습니다'); process.exit(1); }
  console.log('전 — ' + 이름 + ' · ACL ' + 옛acl[이름]);
}
console.log('전 — 지난교육인가 가 이미 있나: '
  + (글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '지난교육인가';`) === '0' ? '없습니다' : '있습니다'));

/** 올릴 글 — 새 함수 + 울타리만 고친 창구 둘 */
function 바꿀글() {
  const 글 = [새함수];
  for (const 이름 of 이름들) {
    const 고친 = 고친정의(옛정의[이름]);
    if (!고친) {
      console.error('✗ ' + 이름 + ' — 옛 울타리를 못 찾았습니다 (짐작으로 안 고칩니다)');
      process.exit(1);
    }
    글.push(고친 + ';');
  }
  return 글.join(줄바꿈);
}

const 재기 = [
  'select \'전체\' as 탭, "교육셈"(null, null, false) as 안지난것, "교육셈"(null, null, true) as 끝난것까지',
  'union all select \'물리치료사\', "교육셈"(\'물리치료사\', null, false), "교육셈"(\'물리치료사\', null, true)',
  'union all select \'작업치료사\', "교육셈"(\'작업치료사\', null, false), "교육셈"(\'작업치료사\', null, true);',
].join(줄바꿈);
const 머리 = '\\pset pager off' + 줄바꿈;

console.log(줄바꿈 + '── 지금 탭 숫자 ──');
console.log(psql(머리 + 재기));
console.log('── 고친 뒤 탭 숫자 (되돌림 안에서) ──');
console.log(psql(머리 + 'begin;' + 줄바꿈 + 바꿀글() + 줄바꿈 + 재기 + 줄바꿈 + 'rollback;'));

if (!진짜) {
  console.log(줄바꿈 + '[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '교육창구_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 교육목록·교육셈 을 2026-10-28 ㉪ 전 정의로',
  '   (pg_get_functiondef 그대로 · 인수 기본값·권한·security definer 가 다 있습니다) */',
  옛정의['교육목록'] + ';',
  옛정의['교육셈'] + ';',
  '/* 새 함수는 아무도 안 쓰면 내려도 됩니다 (안 내려도 해는 없습니다) */',
  '-- drop function if exists public."지난교육인가"(date, date, date, date);',
].join(줄바꿈) + 줄바꿈, 'utf8');
console.log(줄바꿈 + '○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꿀글()));
for (const 이름 of 이름들) {
  const 후 = acl받기(이름);
  console.log('후 ACL — ' + 이름 + ' ' + 후 + (후 === 옛acl[이름] ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));
}
console.log('후 ACL — 지난교육인가 ' + acl받기('지난교육인가'));

console.log(줄바꿈 + '── 고친 뒤 탭 숫자 ──');
console.log(psql(머리 + 재기));
console.log('── 창구가 내리는 첫 쪽 줄 수 (20이 꽉 차면 다음 쪽이 있습니다) ──');
console.log(psql(머리 + 'select count(*) as 첫쪽줄수 from "교육목록"(null, null, false, 0);'));
