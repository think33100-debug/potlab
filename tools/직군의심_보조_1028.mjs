/* ㉲ `직군의심()` 에 **「보조」 꼴**을 넣습니다 (2026-10-28 세중님 ㉲ 승인)
 *
 *   node tools/직군의심_보조_1028.mjs             마른 실행 (되돌림 안에서 전·후)
 *   node tools/직군의심_보조_1028.mjs --진짜       바꿉니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 「물리치료보조원 구함」(제생의원)이 **물리치료사**로 회원 화면에 있었습니다.
 * 지금 자는 **우리 직군 말이 글에 없으면** 의심인데, 본문이나 detail 에 「물리치료사」가
 * 한 번이라도 나오면 **의심에서 빠집니다**. 보조원 자리인데도 그렇습니다.
 *
 * ── 바꾸는 자리 셋 ──────────────────────────────────────────
 *   ㉠ `잼` 에 **보조꼴** 칸 — **제목**에 보조 말이 있고 **제목**에 우리 직군 말이 없으면 참
 *   ㉡ `걸린것` 에 넣기 — `not 근거있음` **또는 보조꼴**
 *   ㉢ 낸 값에 `보조꼴`·`보조꼴목록` 과 ※ 한 줄
 *   ★ 세중님 — 「**둘 다 있으면 우리 직군 유지**」. 그래서 제목에 둘 다 있으면 안 걸립니다
 *     (「물리치료사 1명, 보조원 1명」 꼴). 자 글자는 `tools/보조원규칙.mjs` 와 같습니다
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
  const 임시 = path.join(os.tmpdir(), '직군의심보조_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1500)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);
const 머리 = '\\pset pager off\n';

/* ── 지금 정의·ACL ── */
const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '직군의심';`);
if (몇벌 !== '1') { console.error('✗ 직군의심 가 ' + 몇벌 + '벌입니다 (1 이어야 합니다)'); process.exit(1); }
const 전정의 = psql(머리 + `select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '직군의심';`, ['-X', '-A', '-t', '-q']);
const 전acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '직군의심';`);
if (!전정의.trim()) { console.error('✗ 정의를 못 읽었습니다'); process.exit(1); }
console.log('전 — 직군의심 ' + 전정의.split('\n').length + '줄 · ACL ' + 전acl);

/* ── 바꿀 자리 셋. **글자가 정확히 한 번** 나와야 바꿉니다 (아니면 멈춥니다) ── */
const 바꿈들 = [
  {
    무엇: '㉠ 잼 에 보조꼴 칸',
    옛: `            || '|(기간제|계약직)[[:space:]]*(직원|근로자)|신규[[:space:]]*직원')) as "뭉뚱그림"
   from 글모음 g`,
    새: `            || '|(기간제|계약직)[[:space:]]*(직원|근로자)|신규[[:space:]]*직원')) as "뭉뚱그림",
    /* ★ 2026-10-28 세중님 ㉲ — **「보조원」은 우리 직군이 아닙니다.**
       「물리치료보조원 구함」(제생의원)이 물리치료사로 회원 화면에 있었습니다.
       **제목**으로만 봅니다 — 본문에 「물리치료사」가 한 번 나온다고 보조원 자리가
       우리 자리가 되지는 않습니다. 그리고 세중님 뜻대로 **제목에 둘 다 있으면**
       우리 직군 공고로 둡니다 (「물리치료사 1명, 보조원 1명」 꼴).
       자 글자는 tools/보조원규칙.mjs 와 **같은 글자**입니다 (지침 6절 — 한 자리) */
    (g.title ~ '물리\\s*치료\\s*보조|작업\\s*치료\\s*보조|치료\\s*보조\\s*원|보조\\s*원|보조\\s*인력'
     and g.title !~ '(물리|작업|도수)\\s*치료\\s*(사|직|선생)') as "보조꼴"
   from 글모음 g`,
  },
  {
    무엇: '㉡ 걸린것 에 보조꼴 넣기',
    옛: `   where not "근거있음" and not "잘린제목" and "조교연구" is null`,
    새: `   /* ★ 2026-10-28 ㉲ — 우리 직군 말이 없거나 **보조원 꼴이면** 걸립니다 */
   where (not "근거있음" or "보조꼴") and not "잘린제목" and "조교연구" is null`,
  },
  {
    무엇: '㉢ 낸 값에 보조꼴 셈·목록',
    옛: `  '잘린제목', (select count(*) from 잼 where not "근거있음" and "잘린제목"),`,
    새: `  /* ★ 2026-10-28 세중님 ㉲ — 보조원 꼴을 따로 셉니다 (아침 메일이 읽습니다) */
  '보조꼴', (select count(*) from 걸린것 where "보조꼴"),
  '보조꼴목록', (select coalesce(jsonb_agg(jsonb_build_object(
                 '기관', org_name, '제목', left(title, 80), '직군', job_group,
                 '경로', source, '주소', url) order by source, id), '[]'::jsonb)
                 from 걸린것 where "보조꼴"),
  '잘린제목', (select count(*) from 잼 where not "근거있음" and "잘린제목"),`,
  },
  {
    무엇: '㉣ ※ 한 줄',
    옛: `       || ' 「조교·연구」 갈래는 의심에서 빼고 따로 셉니다 (조교연구갈래() 한 자리)'`,
    새: `       || ' 「조교·연구」 갈래는 의심에서 빼고 따로 셉니다 (조교연구갈래() 한 자리).'
       || ' 「보조원」 꼴(제목에 보조 말이 있고 우리 직군 말이 없는 것)은 본문에 우리 직군'
       || ' 말이 있어도 의심으로 셉니다 — 보조원은 우리 직군이 아닙니다 (2026-10-28 세중님)'`,
  },
];
let 새정의 = 전정의;
for (const x of 바꿈들) {
  const 몇 = 새정의.split(x.옛).length - 1;
  if (몇 !== 1) {
    console.error('✗ ' + x.무엇 + ' — 바꿀 글자가 ' + 몇 + '번 나옵니다 (1 이어야 합니다). 멈춥니다');
    console.error('  찾던 글자 ↓\n' + x.옛);
    process.exit(1);
  }
  새정의 = 새정의.split(x.옛).join(x.새);
  console.log('○ ' + x.무엇);
}
const 바꾸기SQL = 새정의.trimEnd() + ';';

/* ── 마른 실행 — begin … rollback 안에서 전·후 ── */
/* ── 재는 자 — 전에는 `보조꼴` 열쇠가 **없습니다** (아직 안 넣었으니) ── */
const 전재기 = `
  select ("직군의심"()->>'의심')::int as "③ 의심",
         ("직군의심"()->>'통합공고')::int as 통합공고,
         ("직군의심"()->>'조교연구')::int as 조교연구,
         ("직군의심"()->>'잘린제목')::int as 잘린제목;`;
const 후재기 = `
  select ("직군의심"()->>'의심')::int as "③ 의심",
         ("직군의심"()->>'보조꼴')::int as 보조꼴,
         ("직군의심"()->>'통합공고')::int as 통합공고,
         ("직군의심"()->>'조교연구')::int as 조교연구,
         ("직군의심"()->>'잘린제목')::int as 잘린제목;`;

console.log('\n══ 전 — 지금 셈 ══');
console.log(psql(머리 + 전재기));
console.log('\n══ 마른 실행 — 바꾼 뒤 (되돌림 안) ══');
console.log(psql(머리 + 'begin;\n' + 바꾸기SQL + '\n' + 후재기 + '\nrollback;'));
console.log('── 바꾼 뒤 「보조꼴」 목록 (되돌림 안) ──');
console.log(psql(머리 + 'begin;\n' + 바꾸기SQL
  + '\nselect jsonb_pretty("직군의심"()->\'보조꼴목록\') as 보조꼴목록;\nrollback;'));

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 (rollback) — --진짜 로 바꿉니다');
  process.exit(0);
}

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '직군의심_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  '/* ㉲ 되돌리기 — 2026-10-28 전 정의 그대로 (pg_get_functiondef 로 받은 것) */\n'
  + '/* 이 함수는 **세는 함수**입니다 — 공고를 한 줄도 안 바꿉니다. 되돌리면 숫자만 돌아갑니다 */\n'
  + 전정의.trimEnd() + ';\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

console.log(psql(바꾸기SQL));
const 후acl = 글만(`select coalesce(p.proacl::text,'(기본값)') from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '직군의심';`);
console.log('후 ACL — ' + 후acl + (후acl === 전acl ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));

console.log('\n══ 후 — 함수를 한 번 불러 봅니다 ══');
console.log(psql(머리 + 후재기));
console.log('── 「보조꼴」 목록 ──');
console.log(psql(머리 + `select jsonb_pretty("직군의심"()->'보조꼴목록') as 보조꼴목록;`));
console.log('── 아침 메일이 읽는 자리도 함께 (네숫자 의 ③) ──');
console.log(psql(머리 + `select ("직군의심"()->>'의심')::int as "③ 의심"
    , ("직군의심"()->>'보조꼴')::int as 보조꼴;`));
