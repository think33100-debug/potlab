/* ㉡ `시험자료볼까()` 가 **역할도 봅니다** (2026-10-28 세중님 ㉡ 승인)
 *
 *   node tools/시험자료_역할울타리_1028.mjs           마른 실행 (되돌림 안에서 전·후)
 *   node tools/시험자료_역할울타리_1028.mjs --진짜     바꿉니다
 *
 * ── 지금 ────────────────────────────────────────────────────
 *   시험자료볼까() = is_admin() or 마스터인가()        (sql/기준구조_1025.sql:10582)
 *   마스터인가()   = 마스터페르소나 표에 auth_id 있나  (sql/기준구조_1025.sql:9629)
 *   → **계정** 기준이라 역할을 학생·치료사로 바꿔도 시험 자료가 보입니다
 *     (「시험병원 (마스터 전용)」이 그래서 보였습니다)
 *
 * ── 바꾼 뒤 ─────────────────────────────────────────────────
 *   마스터가 **회원 역할**(학생·작업치료사·물리치료사·비회원)을 쓰고 있으면 **거짓**.
 *   그 밖이면 전과 같습니다 (관리자·채용담당자·교육담당자·가입중).
 *   ★ 울타리를 **맨 앞**에 둡니다 — 마스터 계정이 `admins` 에도 있어서
 *     (2026-10-28 확인) `is_admin()` 이 참이고, 뒤에 두면 안 듣습니다.
 *   ★ 담당자 역할은 **그대로 봅니다** — 페르소나바꾸기() 가 그 역할에 시험 자격·
 *     시험 기관을 만들어 줍니다 (sql:13376~13387). 안 보이면 그 기능을 못 봅니다.
 *   ★ 「비회원」을 함께 넣었습니다 — 세중님은 「학생·치료사」만 말씀하셨지만 같은 결이고
 *     (보는 눈을 비회원으로 바꾸는 역할), 빼라시면 한 낱말만 지우면 됩니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
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
function psql(sql, 꼴 = ['-X', '-q']) {
  const 임시 = path.join(os.tmpdir(), '시험자료울타리_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 머리 = '\\pset pager off\n';

const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '시험자료볼까';`);
if (몇벌 !== '1') { console.error('✗ 시험자료볼까 가 ' + 몇벌 + '벌입니다'); process.exit(1); }
const 전정의 = psql(머리 + `select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '시험자료볼까';`, ['-X', '-A', '-t', '-q']);
const 전acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '시험자료볼까';`);
console.log('전 정의 —\n' + 전정의);
console.log('전 ACL — ' + 전acl);

const 옛몸통 = `select is_admin() or 마스터인가()`;
if ((전정의.split(옛몸통).length - 1) !== 1) {
  console.error('✗ 바꿀 몸통을 못 찾았습니다 (1번 나와야 합니다). 멈춥니다');
  process.exit(1);
}
const 새몸통 = `select case
    /* ★ 2026-10-28 세중님 ㉡ — **역할도 봅니다.** 마스터 계정이 회원 역할을
       쓰고 있으면 시험 자료를 **안 보여 줍니다** (「회원처럼 보기」가 참이 되게).
       울타리를 맨 앞에 둔 까닭 — 마스터 계정이 admins 에도 있어서 is_admin() 이
       참입니다. 뒤에 두면 안 듣습니다 (2026-10-28 확인) */
    when "마스터인가"() and coalesce("마스터역할"(), '관리자')
         in ('학생', '작업치료사', '물리치료사', '비회원') then false
    else is_admin() or "마스터인가"() end`;
const 바꾸기SQL = 전정의.split(옛몸통).join(새몸통).trimEnd() + ';';

/* 자기점검 — 역할마다 어떻게 나오나 (되돌림 안에서 역할을 바꿔 봅니다) */
const 역할들 = ['관리자', '학생', '작업치료사', '물리치료사', '채용담당자', '교육담당자', '비회원'];
const 점검SQL = 역할들.map((r) => `
  update "마스터페르소나" set "지금역할" = '${r}';
  select '${r}' as 역할, "시험자료볼까"() as 시험자료볼까,
         (select count(*) from job_posts_pub v join job_posts p on p.id = v.id
           where p.org_name like '%마스터%') as "회원 화면에 보이는 마스터 시험 공고";`).join('\n');

console.log('\n══ 전 — 역할마다 (되돌림 안 · 역할을 바꿔 봅니다) ══');
console.log(psql(머리 + `begin;\n${점검SQL}\nrollback;`));
console.log('\n══ 마른 실행 — 바꾼 뒤 역할마다 (되돌림 안) ══');
console.log(psql(머리 + `begin;\n${바꾸기SQL}\n${점검SQL}\nrollback;`));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  console.log('★ 역할은 되돌림 안에서만 바꿨습니다 — 지금 역할은 그대로입니다');
  process.exit(0);
}

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '시험자료볼까_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, '/* ㉡ 되돌리기 — 2026-10-28 전 정의 그대로 */\n'
  + 전정의.trimEnd() + ';\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '시험자료볼까';`);
console.log('후 ACL — ' + 후acl + (후acl === 전acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));
console.log('\n══ 후 — 지금 역할과 셈 ══');
console.log(psql(머리 + `
  select m."지금역할", "시험자료볼까"() as 시험자료볼까 from "마스터페르소나" m;`));
console.log('── 역할마다 (되돌림 안에서 바꿔 보고 되돌립니다) ──');
console.log(psql(머리 + `begin;\n${점검SQL}\nrollback;`));
console.log('\n── 지금 역할이 그대로인지 ──');
console.log(psql(머리 + `select m."지금역할" from "마스터페르소나" m;`));
