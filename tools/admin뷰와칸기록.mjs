/* ㉡ `admin_jobs` 뷰에 **`뽑은값` 한 칸** · ㉢ `칸기록` 이 **맨 위 뽑은값 변경도** 남기게
 * (2026-10-24 세중님 ㉡㉢ 승인)
 *
 *   node tools/admin뷰와칸기록.mjs            바꿀 전문만 (기본 · 마른)
 *   node tools/admin뷰와칸기록.mjs --진짜      올립니다
 *
 * ── ㉡ 왜 ───────────────────────────────────────────────────
 * 관리자 공고 수정 화면이 「원문 그대로 글꼴(○명·0명)」을 못 봅니다 — 그 값은
 * `job_posts."뽑은값"->>'모집인원'` 이고 뷰에 그 칸이 없습니다.
 * `create or replace view` 는 **칸을 끝에 더할 때만** 됩니다 — 그래서 끝에 붙입니다.
 * 뷰 본문은 `where is_admin()` 이라 **회원은 못 봅니다** (올린 뒤 다시 확인합니다).
 *
 * ── ㉢ 왜 ───────────────────────────────────────────────────
 * 트리거가 `detail->'뽑은값'` 만 봅니다. 그런데 `칸되메우기` 창구는 **맨 위
 * `뽑은값` 칸**에 씁니다 — 그래서 2026-10-24 에 지원자격 11건을 덮었는데
 * `칸기록` 에 **한 줄도 안 남았습니다**. 되돌릴 근거가 없어지는 자리입니다.
 *
 * ★ 지원자격·예상연봉·모집인원 **세 칸**을 맨 위 뽑은값에서도 봅니다.
 *   읽는 순서는 화면과 같게 — 맨 위 뽑은값 → detail 뽑은값 → detail (지침 6절).
 * ★ 되돌림은 `~/되돌림/` 에 전문 그대로.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 진짜 = process.argv.includes('--진짜');
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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q']) {
  const 임시 = path.join(os.tmpdir(), 'adminview_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return r.stdout || '';
}

/* ── 지금 모습 ── */
const 뷰권한 = () => psql(`select coalesce(c.relacl::text,'(없음)')
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='admin_jobs';`).trim();
const 뷰칸 = () => psql(`select count(*)::text from pg_attribute a
   where a.attrelid='admin_jobs'::regclass and a.attnum>0 and not a.attisdropped;`).trim();
const 트리거권한 = () => psql(`select coalesce(p.proacl::text,'(없음)') || '  secdef=' || p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='칸기록남기기';`).trim();

const 전뷰 = 뷰권한(); const 전칸 = 뷰칸(); const 전트 = 트리거권한();
console.log('── 올리기 전 ──');
console.log('  admin_jobs  ACL ' + 전뷰 + ' · 칸 ' + 전칸 + '개');
console.log('  칸기록남기기  ' + 전트);

const 뷰본문 = psql(`select pg_get_viewdef('admin_jobs'::regclass, true);`).trimEnd();
if (!/from job_posts/i.test(뷰본문)) { console.error('✗ 뷰 전문을 못 떴습니다'); process.exit(1); }
if (/"뽑은값"/.test(뷰본문)) { console.log('○ ㉡ 는 이미 들어 있습니다'); }

const 트본문 = psql(`select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='칸기록남기기';`).trim();
if (!트본문.startsWith('CREATE OR REPLACE FUNCTION')) { console.error('✗ 트리거 전문을 못 떴습니다'); process.exit(1); }

/* ── ㉡ 새 뷰 전문 — 끝에 한 칸 ── */
const 새뷰 = 'create or replace view admin_jobs as\n'
  + 뷰본문.replace(/;?\s*$/, '')
    .replace(/AS "마감표시"/, 'AS "마감표시",\n    "뽑은값"')
  + ';\n';

/* ── ㉢ 새 트리거 전문 — 맨 위 뽑은값 세 칸도 ── */
export const 트낡은 = `  if coalesce(new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격')
     is distinct from coalesce(old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격') then`;
export const 트새 = `  /* ★ 2026-10-24 세중님 ㉢ — **맨 위 「뽑은값」 칸도** 봅니다.
     \`칸되메우기\` 창구는 맨 위 뽑은값에 씁니다(detail 이 아닙니다). 그래서
     2026-10-24 에 지원자격 11건을 덮었는데 칸기록에 한 줄도 안 남았습니다.
     읽는 순서는 화면과 같게 — 맨 위 뽑은값 → detail.뽑은값 → detail */
  if coalesce(new."뽑은값"->>'지원자격', new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격')
     is distinct from coalesce(old."뽑은값"->>'지원자격', old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격') then`;

export function 트바꾸기(본문) {
  let s = String(본문 || '');
  if (s.includes('맨 위 「뽑은값」 칸도')) throw new Error('이미 들어 있습니다');
  if (s.split(트낡은).length !== 2) throw new Error('지원자격 자리가 1번이 아닙니다');
  s = s.replace(트낡은, 트새);
  /* 같은 꼴로 값만 바꿔 쓰는 두 줄 — 지원자격 갈래 안의 old/new 읽기 */
  s = s.replace(
    `            left(coalesce(old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격'), 200),
            left(coalesce(new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격'), 200), v_누가, v_왜);`,
    `            left(coalesce(old."뽑은값"->>'지원자격', old.detail->'뽑은값'->>'지원자격', old.detail->>'지원자격'), 200),
            left(coalesce(new."뽑은값"->>'지원자격', new.detail->'뽑은값'->>'지원자격', new.detail->>'지원자격'), 200), v_누가, v_왜);`);
  /* 예상연봉·모집인원도 같은 결로 */
  s = s.replace(/coalesce\((old|new)\.detail->'뽑은값'->>'예상연봉', \1\.detail->>'연봉', \1\.detail->>'예상연봉'\)/g,
    (m, p) => `coalesce(${p}."뽑은값"->>'예상연봉', ${p}.detail->'뽑은값'->>'예상연봉', ${p}.detail->>'연봉', ${p}.detail->>'예상연봉')`);
  s = s.replace(/coalesce\((old|new)\.detail->>'직군인원', \1\.detail->'뽑은값'->>'모집인원'\)/g,
    (m, p) => `coalesce(${p}.detail->>'직군인원', ${p}."뽑은값"->>'모집인원', ${p}.detail->'뽑은값'->>'모집인원')`);
  return s;
}

let 새트;
try { 새트 = 트바꾸기(트본문); } catch (e) { console.error('✗ ㉢ ' + e.message); process.exit(1); }

console.log('\n════════ ㉡ 새 뷰 전문 (끝 다섯 줄) ════════');
console.log(새뷰.split('\n').slice(-7).join('\n'));
console.log('════════ ㉢ 바뀐 줄 ════════');
for (const l of 새트.split('\n')) if (/"뽑은값"->>/.test(l)) console.log('  ' + l.trim().slice(0, 150));
console.log('════════ 끝 ════════');

if (!진짜) { console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다'); process.exit(0); }

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, 'admin뷰와칸기록_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, '/* ㉡ 뷰 되돌리기 */\ncreate or replace view admin_jobs as\n'
  + 뷰본문.replace(/;?\s*$/, '') + ';\n\n/* ㉢ 트리거 되돌리기 */\n' + 트본문 + ';\n', 'utf8');
console.log('\n○ 되돌릴 전문 — ' + 되돌림);

if (!/"뽑은값"/.test(뷰본문)) { psql(새뷰); console.log('○ ㉡ 뷰에 칸을 더했습니다'); }
psql(새트 + ';');
console.log('○ ㉢ 트리거를 올렸습니다');

console.log('\n── 올린 뒤 ──');
const 후뷰 = 뷰권한(); const 후칸 = 뷰칸(); const 후트 = 트리거권한();
console.log('  admin_jobs  ACL ' + 후뷰 + ' · 칸 ' + 후칸 + '개');
console.log('  칸기록남기기  ' + 후트);
console.log(전뷰 === 후뷰 ? '○ 뷰 ACL 이 **글자까지 같습니다**' : '✗ 뷰 ACL 이 달라졌습니다');
console.log(전트 === 후트 ? '○ 트리거 ACL 이 **글자까지 같습니다**' : '✗ 트리거 ACL 이 달라졌습니다');
console.log('  칸 ' + 전칸 + ' → ' + 후칸 + '개');
console.log('\n── 회원 뷰는 안 바뀌었나 (job_posts_pub 칸 수) ──\n  '
  + psql(`select count(*)::text from pg_attribute a
     where a.attrelid='job_posts_pub'::regclass and a.attnum>0 and not a.attisdropped;`).trim() + '개');
