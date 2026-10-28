/* 「보조원」 꼴 공고 — 우리 직군이 아닙니다 (2026-10-28 세중님 19:30 승인)
 *
 *   node tools/보조원_1028.mjs --자기점검   판정 자 견본
 *   node tools/보조원_1028.mjs             전수 (회원 화면·보류함·숨김 · 읽기만)
 *   node tools/보조원_1028.mjs --진짜       **회원 화면에 있는 것만** 보류함으로
 *
 * ── 판정 자 (여기 한 자리) ───────────────────────────────────
 *   「물리치료보조 · 작업치료보조 · 치료보조원 · 보조원 · 보조인력」이 **원문 제목**에
 *   있고, **우리 직군 말이 따로 없으면** 우리 직군이 아닙니다.
 *   ★ 「물리치료사 1명, 보조원 1명」처럼 **둘 다** 있으면 우리 직군 공고입니다 —
 *     그래서 우리 직군 말이 있나를 **함께** 봅니다 (안 보면 멀쩡한 공고를 내립니다)
 *
 * ── 어디까지 하나 ───────────────────────────────────────────
 *   지금        회원 화면에 있는 것만 **보류함으로** (세중님 19:30 승인)
 *   동결 뒤      수집 규칙(직군 판정 제외 낱말)·직군의심() 자 — 승인대기
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/* ── 판정 자 ── */
export const 보조말 = /물리\s*치료\s*보조|작업\s*치료\s*보조|치료\s*보조\s*원|보조\s*원|보조\s*인력/;
export const 우리직군말 = /(물리|작업|도수)\s*치료\s*(사|직|선생)/;

export function 보조원인가(제목) {
  const t = String(제목 || '');
  const 보조 = 보조말.test(t);
  const 우리 = 우리직군말.test(t);
  return { 됨: 보조 && !우리, 보조, 우리 };
}

if (process.argv.includes('--자기점검')) {
  const 잼 = []; const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('★ 물리치료보조원 구함 → 우리 직군 아님', 보조원인가('물리치료보조원 구함').됨);
  보('작업치료보조 모집 → 아님', 보조원인가('작업치료보조 모집').됨);
  보('치료보조원 채용 → 아님', 보조원인가('치료보조원 채용').됨);
  보('재활보조인력 채용 → 아님', 보조원인가('재활 보조인력 채용').됨);
  보('★ 물리치료사 1명, 보조원 1명 → **우리 직군 공고** (둘 다 있음)',
    !보조원인가('물리치료사 1명, 보조원 1명 채용').됨);
  보('물리치료사 채용 → 우리 직군 공고', !보조원인가('물리치료사 채용').됨);
  보('작업치료사(계약직) 모집 → 우리 직군 공고', !보조원인가('작업치료사(계약직) 모집').됨);
  보('간호조무사 채용 → 안 걸림 (보조 말이 아닙니다)', !보조원인가('간호조무사 채용').됨);
  보('빈 제목 → 안 걸림', !보조원인가('').됨);
  보('★ 「진료보조원」도 걸립니다 (보조원)', 보조원인가('진료보조원 모집').됨);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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
  const 임시 = path.join(os.tmpdir(), '보조원_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 1200)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t']);
const 머리 = '\\pset pager off\n';

/* 우리 직군이 붙은 공고 전수를 받아 **제목으로** 가립니다 */
const 줄들 = 글만(`
  select p.id || E'\\t' || p.source || E'\\t'
      || (case when exists (select 1 from job_posts_pub v where v.id = p.id) then '회원화면'
               when p.hold then '보류함' when p.hidden then '숨김' else '그밖' end) || E'\\t'
      || left(p.org_name, 26) || E'\\t' || coalesce(p.job_group,'(빈칸)') || E'\\t'
      || regexp_replace(coalesce(p.title,''), '[\\r\\n\\t]+', ' ', 'g')
    from job_posts p
   where coalesce(p.job_group,'') <> '' and p.source <> 'BIZ'
   order by p.id;`).split('\n').filter(Boolean);

const 걸린것 = [];
for (const l of 줄들) {
  const [id, 출처, 어디, 기관, 직군, 제목] = l.split('\t');
  const r = 보조원인가(제목);
  if (r.됨) 걸린것.push({ id, 출처, 어디, 기관, 직군, 제목 });
}
const 셈 = {};
for (const x of 걸린것) 셈[x.어디] = (셈[x.어디] || 0) + 1;
console.log('══ 직군이 붙은 공고 ' + 줄들.length + '건 가운데 **「보조」 꼴 ' + 걸린것.length + '건** ══');
console.log('  ' + (Object.entries(셈).map(([k, v]) => k + ' ' + v).join(' · ') || '(없음)') + '\n');
for (const x of 걸린것) {
  console.log('  ' + x.어디.padEnd(9) + x.id.padEnd(20) + x.출처.padEnd(5)
    + x.기관.slice(0, 20).padEnd(22) + x.직군.padEnd(12) + x.제목.slice(0, 40));
}

const 회원것 = 걸린것.filter((x) => x.어디 === '회원화면');
console.log('\n**회원 화면에 있는 것 ' + 회원것.length + '건** ← 지금 보류함으로 보낼 것 (세중님 19:30 승인)');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 **회원 화면에 있는 것만** 보류함으로');
  process.exit(0);
}
if (!회원것.length) { console.log('\n보낼 것이 없습니다'); process.exit(0); }

const 목록 = 회원것.map((x) => "'" + x.id + "'").join(',');
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '보조원_보류함_되돌리기_' + 때 + '.sql');
const 전값 = 글만(`select p.id, p.hold::text, p.admin_locked::text,
    coalesce(p.edited_fields::text,'{}'), coalesce(p.admin_note,'')
  from job_posts p where p.id in (${목록}) order by p.id;`);
fs.writeFileSync(되돌림, ['/* 되돌리기 — 2026-10-28 「보조」 꼴 공고를 보류함으로 (세중님 19:30) */',
  ...전값.split('\n').filter(Boolean).map((l) => {
    const [id, h, lock, ef, note] = l.split('\t');
    return `update job_posts set hold = ${h}, admin_locked = ${lock}`
      + `, edited_fields = '${ef}'::text[]`
      + `, admin_note = ${note ? "'" + note.replace(/'/g, "''") + "'" : 'null'}`
      + ` where id = '${id}';`;
  })].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림 + ' (' + 회원것.length + '건)');

/* 세중님이 「admin 대행(칸기록·잠금)」이라 하셨으므로 —
   ㉠ `app.누가` 를 '관리자' 로 두어 **칸기록·상태기록에 남게** 하고
   ㉡ `admin_locked` 로 **잠그고**
   ㉢ `edited_fields` 에 'hold' 를 적어 **수집기가 못 풀게** 합니다 (지침 8-24) */
console.log(psql(머리 + `
select set_config('app.누가', '관리자', true);
select set_config('app.왜', '보류함으로 · 「보조원」은 우리 직군이 아닙니다 — 세중님 2026-10-28 19:30 승인 (코드 대행)', true);
update job_posts p set hold = true, hidden = false,
       admin_locked = true, admin_at = now(),
       admin_note = '「보조원」 꼴 — 우리 직군 아님 (세중님 2026-10-28 19:30 승인 · 코드 대행)',
       edited_fields = (select array_agg(distinct x)
                          from unnest(coalesce(p.edited_fields, '{}') || array['hold']) x)
 where p.id in (${목록});`));
console.log('── 후 ──');
console.log(psql(머리 + `
  select p.id, p.hold as 보류함, p.admin_locked as 잠금,
         exists (select 1 from job_posts_pub v where v.id = p.id) as "회원 화면(거짓이어야)",
         (select count(*) from job_state_log l where l.job_id = p.id) as 상태기록줄
    from job_posts p where p.id in (${목록}) order by p.id;`));
console.log('── 칸기록 (hold 가 남나) ──');
console.log(psql(머리 + `
  select k.job_id, k."칸", k."누가", left(coalesce(k."왜",''), 46) as 왜,
         coalesce(k."옛값",'(널)') as 옛값, coalesce(k."새값",'(널)') as 새값
    from "칸기록" k where k.job_id in (${목록}) and k."바뀐때" > now() - interval '5 minutes'
   order by k.job_id, k.id;`));
console.log('\n회원 화면 — ' + 글만('select count(*) from job_posts_pub;') + '건');
console.log('── ③ 직군 의심 다시 ──');
console.log(psql(머리 + `select ("직군의심"()->>'의심')::int as "③ 직군 의심";`));
