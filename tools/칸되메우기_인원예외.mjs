/* `칸되메우기` 가 **까닭이 적혀 있을 때만** headcount 를 덮게 합니다
 * (2026-10-24 세중님 ㉠ 승인 — 좁힌 안)
 *
 *   node tools/칸되메우기_인원예외.mjs            바꿀 자리만 (기본 · 마른)
 *   node tools/칸되메우기_인원예외.mjs --진짜      올립니다
 *   node tools/칸되메우기_인원예외.mjs --자기점검
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 지금 창구는 `headcount` 를 **null 일 때만** 채웁니다. 통합 공고에서 **다른 직군
 * 인원**을 집은 틀린 숫자를 못 고칩니다 (하온어린이집이 그 꼴이었고 손으로 고쳤습니다).
 *
 * ★ **창구가 「통합 공고인가」를 스스로 가리지 않습니다.** 부르는 쪽이
 *   `인원덮기까닭` 을 적어 보내야 덮습니다 — 그 열쇠가 없으면 **전과 똑같이**
 *   null 일 때만 찹니다. 가리는 자리는 `tools/낡은칸덮기.mjs` 의 `좁은근거인가()`
 *   하나입니다 (지침 6절 — 기준은 한 자리).
 * ★ `edited_fields`(사람이 고친 칸)·`admin_locked` 는 그대로 건너뜁니다.
 * ★ 인수(p_rows jsonb)가 그대로라 `create or replace` 가 ACL 을 유지합니다 (지침 6-2).
 *   그래도 전후로 찍어 글자까지 견줍니다. 되돌림은 `~/되돌림/`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

export const 낡은줄 = [
  '      headcount = case',
  "        when (r ? 'headcount') and j.headcount is null",
  "             and not ('headcount' = any(v_잠긴칸))",
  "        then (r->>'headcount')::int else j.headcount end,",
].join('\n');

export const 새줄 = [
  '      headcount = case',
  "        when (r ? 'headcount') and not ('headcount' = any(v_잠긴칸))",
  '             and (j.headcount is null',
  '                  /* ★ 2026-10-24 세중님 ㉠ 승인 — **까닭이 적혀 있으면 덮습니다.**',
  '                     통합 공고에서 다른 직군 인원을 집은 값을 고치는 자리입니다.',
  '                     창구는 「통합 공고인가」를 스스로 가리지 않습니다 — 부르는 쪽이',
  '                     `인원덮기까닭` 을 적어 보내야 합니다 (좁히는 자는',
  '                     tools/낡은칸덮기.mjs 의 좁은근거인가() 하나입니다).',
  '                     edited_fields·admin_locked 는 위에서 이미 건너뜁니다 */',
  "                  or nullif(r->>'인원덮기까닭','') is not null)",
  "        then (r->>'headcount')::int else j.headcount end,",
].join('\n');

export function 바꾸기(본문) {
  const s = String(본문 || '');
  if (s.includes('까닭이 적혀 있으면 덮습니다')) throw new Error('이미 들어 있습니다');
  const 몇 = s.split(낡은줄).length - 1;
  if (몇 !== 1) throw new Error('바꿀 자리가 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
  return s.replace(낡은줄, 새줄);
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = ['CREATE OR REPLACE FUNCTION public."칸되메우기"(p_rows jsonb)', '    update job_posts j set',
    낡은줄, "      apply_to_time = case", '$function$'].join('\n');
  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('null 일 때는 그대로 찬다', 새.includes('and (j.headcount is null'));
    보('까닭이 있으면 덮는다', 새.includes("or nullif(r->>'인원덮기까닭','') is not null)"));
    보('★ 잠긴 칸은 그대로 건너뛴다', 새.includes("not ('headcount' = any(v_잠긴칸))"));
    보('뒷줄은 안 건드렸다', 새.includes('      apply_to_time = case'));
    보('두 번 넣으면 멈춘다', (() => { try { 바꾸기(새); return false; } catch { return true; } })());
    보('자리가 없으면 멈춘다', (() => { try { 바꾸기('아무 글'); return false; } catch { return true; } })());
  }
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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
  const 임시 = path.join(os.tmpdir(), '인원예외_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return r.stdout || '';
}
const 권한보기 = "select p.oid::regprocedure::text || '  ' || coalesce(p.proacl::text,'(없음)')\n"
  + "       || '  secdef=' || p.prosecdef\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '칸되메우기';";
const 전권한 = psql(권한보기).trim();
console.log('── 올리기 전 ACL ──\n  ' + 전권한);

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = '칸되메우기';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) { console.error('✗ 본문을 못 떴습니다'); process.exit(1); }
console.log('  지금 본문 ' + 본문.split('\n').length + '줄');
let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');
console.log('\n════════ 바꾸는 한 자리 ════════\n낡\n' + 낡은줄 + '\n새\n'
  + 새줄.split('\n').filter((l) => !/^\s*(\/\*|\*|.*\*\/)/.test(l)).join('\n') + '\n════════ 끝 ════════');

if (!진짜) { console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '칸되메우기_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다 (' + 본문.split('\n').length + '줄)');
psql(새본문 + ';');
console.log('○ 올렸습니다');
const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 **글자까지 같습니다**' : '✗ ACL 이 달라졌습니다 — 되돌리십시오');
