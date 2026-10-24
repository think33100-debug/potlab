/* `job_one` 이 회원에게 내리는 `detail` 을 **허용 목록**으로 좁힙니다
 * (2026-10-24 세중님 ㉠ 승인)
 *
 *   node tools/job_one_detail허용목록.mjs            올릴 자리만 (기본 · 마른)
 *   node tools/job_one_detail허용목록.mjs --진짜      올립니다
 *   node tools/job_one_detail허용목록.mjs --자기점검   규칙만 (DB 안 두드림)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 회원에게 `detail` 열쇠 **28가지**가 나가는데 화면이 읽는 것은 **여덜**입니다
 * (`web/app/jobs/[id]/page.tsx`). 나머지 스물에 이런 것이 섞여 있었습니다 —
 *
 *   문의처(2건)      기관 담당자 **전화번호** — 제주의료원 · 성남시의료원
 *   사업자번호(265건) 기관 사업자등록번호
 *   근거(271건)      **우리가 쓴 글**입니다 (회원에게 보일 글이 아닙니다)
 *   직종코드·업종·경력·휴일·모바일·시설구분·기관종별근거·마감메모 …
 *
 * 2026-10-23 에 제가 워크넷 `rcptMthd` 를 `detail.접수방법` 에 담기 시작했을 때
 * 거기 담당자 메일이 들어와 **회원 화면 6건**에 나갔습니다. 담는 쪽을 막았지만
 * **통째로 내리는 창구가 그대로면 다음에 또 같은 일이 납니다.**
 *
 * ── 무엇을 바꾸나 — 한 자리 ──────────────────────────────────
 * 회원 갈래의 `else coalesce(j.detail, '{}'::jsonb)` 를 **열쇠를 골라 담는 select**
 * 로 바꿉니다. 비회원 갈래(`jsonb_build_object` 로 세 칸만 주는 쪽)는 **안 건드립니다.**
 *
 * ★ 인수가 그대로라 `create or replace` 가 ACL 을 유지합니다 (지침 6-2).
 *   그래도 전후로 `pg_proc.proacl` 을 찍어 글자까지 같은지 봅니다.
 * ★ 되돌림은 `~/되돌림/` 에 날짜(KST)를 붙여 남깁니다 (지침 8-19).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');

/* 화면이 **실제로 읽는** 여덜 + 2026-10-23 에 담기 시작한 지원 방법 둘.
   「조교연구」는 아래에서 한 번 더 덧붙습니다(배지) — 열쇠에도 두면 detail 쪽 값이
   살아 있어 앞뒤가 맞습니다. */
export const 허용열쇠 = ['연봉', '예상연봉', '지원자격', '접수마감글', '직군인원',
  '모집인원', '조교연구', '기관홈', '접수방법', '기관홈페이지'];

export const 낡은줄 = [
  "              else coalesce(j.detail, '{}'::jsonb)",
  '                   || jsonb_strip_nulls(jsonb_build_object(\'조교연구\', j."조교연구"))',
].join('\n');

export const 새줄 = [
  '              /* ★ 2026-10-24 세중님 ㉠ 승인 — **허용 목록**으로 좁힙니다.',
  '                 전에는 `coalesce(j.detail, …)` 로 **통째로** 내렸습니다. 열쇠 28가지가',
  '                 나가는데 화면이 읽는 것은 여덜이고, 그 속에 기관 담당자 **전화**',
  '                 (detail.문의처 · 2건) · 사업자번호(265건) · **우리가 쓴 근거 글**(271건)이',
  '                 섞여 있었습니다 (docs/오류잡기_1023.md ①②).',
  '                 아래 열쇠는 web/app/jobs/[id]/page.tsx 가 읽는 여덜과, 2026-10-23 에',
  '                 담기 시작한 지원 방법 둘(접수방법·기관홈페이지)입니다.',
  '                 ★ 비회원 갈래(위)는 안 건드렸습니다. 칸을 더 보여 줄 일이 생기면',
  '                   **이 목록에 열쇠를 더합니다** — 통째로 돌리지 않습니다. */',
  '              else (select coalesce(jsonb_object_agg(e.k, e.v), \'{}\'::jsonb)',
  "                      from jsonb_each(coalesce(j.detail, '{}'::jsonb)) as e(k, v)",
  "                     where e.k in ('" + 허용열쇠.join("', '") + "'))",
  '                   || jsonb_strip_nulls(jsonb_build_object(\'조교연구\', j."조교연구"))',
].join('\n');

export function 바꾸기(본문) {
  const s = String(본문 || '');
  if (s.includes('허용 목록**으로 좁힙니다')) throw new Error('이미 들어 있습니다 — 두 번 넣지 않습니다');
  const 몇 = s.split(낡은줄).length - 1;
  if (몇 !== 1) throw new Error('바꿀 자리가 ' + 몇 + '번 나옵니다 (1번이어야 합니다)');
  return s.replace(낡은줄, 새줄);
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 본 = [
    'CREATE OR REPLACE FUNCTION public.job_one(p_id text)',
    'AS $function$',
    '  select j.id, j.title,',
    '         case when auth.uid() is null',
    '              then jsonb_strip_nulls(jsonb_build_object(',
    '                     \'조교연구\', j."조교연구",',
    "                     '모집인원', (select x.\"뽑은값\"->>'모집인원'",
    '                                    from job_posts x where x.id = j.id),',
    "                     '접수마감글', (select x.\"뽑은값\"->>'접수마감글'",
    '                                     from job_posts x where x.id = j.id)))',
    낡은줄,
    '         end,',
    '    from job_posts_pub j',
    '   where j.id = p_id',
    '$function$',
  ].join('\n');

  let 새 = null;
  try { 새 = 바꾸기(본); } catch (e) { 보('견본에 적용됨 (' + e.message + ')', false); }
  if (새) {
    보('통째로 내리는 꼴이 사라졌다', !새.includes("else coalesce(j.detail, '{}'::jsonb)\n"));
    보('열쇠를 골라 담는다', 새.includes('jsonb_object_agg(e.k, e.v)'));
    보('허용 열쇠 열 개가 다 들어갔다',
      허용열쇠.every((k) => 새.includes("'" + k + "'")) && 허용열쇠.length === 10);
    보('★ 화면이 읽는 여덜이 다 있다',
      ['연봉', '예상연봉', '지원자격', '접수마감글', '직군인원', '모집인원', '조교연구', '기관홈']
        .every((k) => 새.includes("'" + k + "'")));
    보('★ 개인정보 열쇠는 **없다**',
      !/'문의처'|'사업자번호'|'담당자'/.test(새));
    보('★ 우리가 쓴 글(근거·걸린줄)도 없다', !/'근거'|'걸린줄'|'기관종별근거'/.test(새));
    보('조교연구 배지 줄은 그대로다',
      새.includes('|| jsonb_strip_nulls(jsonb_build_object(\'조교연구\', j."조교연구"))'));
    보('★ 비회원 갈래는 안 건드렸다',
      새.includes("'모집인원', (select x.\"뽑은값\"->>'모집인원'")
      && 새.includes("'접수마감글', (select x.\"뽑은값\"->>'접수마감글'")
      && (새.match(/jsonb_build_object\(\n/g) || []).length === (본.match(/jsonb_build_object\(\n/g) || []).length);
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

/* ── psql ── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
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
function psql(sql) {
  const 임시 = '/tmp/job_one_허용_' + process.pid + '.sql';
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
  + " where n.nspname = 'public' and p.proname = 'job_one';";

const 전권한 = psql(권한보기).trim();
console.log('\n── 올리기 전 ACL ──\n  ' + 전권한);
if (전권한.split('\n').length !== 1) {
  console.error('✗ job_one 이 여러 벌입니다 — 손으로 보십시오'); process.exit(1);
}

const 본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'job_one';").trim();
if (!본문.startsWith('CREATE OR REPLACE FUNCTION')) {
  console.error('✗ 본문을 못 떴습니다 (앞 80자) — ' + 본문.slice(0, 80));
  process.exit(1);
}
console.log('  지금 본문 ' + 본문.split('\n').length + '줄 · ' + 본문.length + '자');

let 새본문;
try { 새본문 = 바꾸기(본문); } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
console.log('  새 본문 ' + 새본문.split('\n').length + '줄 (+'
  + (새본문.split('\n').length - 본문.split('\n').length) + '줄)');

console.log('\n════════ 바꾸는 한 자리 ════════');
console.log('낡\n' + 낡은줄);
console.log('새\n' + 새줄.split('\n').filter((l) => !l.trim().startsWith('/*')
  && !l.trim().startsWith('*') && !l.trim().endsWith('*/')).join('\n'));
console.log('════════ 끝 ════════');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 올립니다 — --진짜 로 올립니다');
  process.exit(0);
}

const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date();
const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, 'job_one_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, 본문 + ';\n', 'utf8');
console.log('\n되돌릴 본문을 ' + 되돌림 + ' 에 남겼습니다 (' + 본문.split('\n').length + '줄)');

psql(새본문 + ';');
console.log('○ 올렸습니다');

const 후권한 = psql(권한보기).trim();
console.log('\n── 올린 뒤 ACL ──\n  ' + 후권한);
console.log(전권한 === 후권한 ? '○ ACL 이 **글자까지 같습니다**' : '✗ ACL 이 달라졌습니다 — 되돌리십시오');
const 후본문 = psql("select pg_get_functiondef(p.oid)\n"
  + '  from pg_proc p join pg_namespace n on n.oid = p.pronamespace\n'
  + " where n.nspname = 'public' and p.proname = 'job_one';").trim();
console.log(후본문.includes('jsonb_object_agg(e.k, e.v)')
  ? '○ 허용 목록이 들어갔습니다' : '✗ 안 들어갔습니다');
if (전권한 !== 후권한) process.exit(1);
