/* ㉦ `제목부서()` 의 「의학과」를 **「재활의학과」로 좁힙니다** (2026-10-28 세중님 승인)
 *
 *   node tools/제목부서_좁히기_1028.mjs            마른 실행 (바뀌는 줄만 찍습니다)
 *   node tools/제목부서_좁히기_1028.mjs --진짜      함수를 바꾸고 제목을 다시 만듭니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 통합공고의 원문 제목은 **맨 앞 자리**부터 적습니다. 그래서 「마취통증의학과
 * 전문의, … 작업치료사 …」 에서 우리 직군과 무관한 진료과가 제목에 올라왔습니다
 * (docs/승인대기_1025.md ㉦).
 *
 * ── 함수를 바꾼 뒤에 **제목을 다시 만들어야 합니다** ───────
 * `보여줄제목` 은 **담긴 칸**이고 트리거 `제목채우기()` 가 넣습니다. 함수만 바꾸면
 * 이미 담긴 제목은 **그대로 남습니다** (지침 9절 — 이미 쌓인 자료는 안 고쳐집니다).
 * 그래서 바뀌는 줄만 `보여줄제목 = null` 로 건드려 트리거가 다시 만들게 합니다.
 * ★ `edited_fields` 에 '보여줄제목' 이 있는 줄은 트리거가 **옛 값을 지킵니다** —
 *   관리자가 손으로 정한 제목은 안 건드립니다.
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
  const 임시 = path.join(os.tmpdir(), '제목부서좁히기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

export const 새본문 = `  select nullif(btrim((
    select m[1] from regexp_matches(coalesce(p_title,''),
      '([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|재활의학과|의학팀|파트|지원팀))') m
     limit 1)), '')`;

/* ── 되돌림 먼저 (지침 8-19 — ~/되돌림/ · /tmp 아닙니다) ── */
const 전본문 = 글만(`select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '제목부서' and p.pronargs = 1;`);
const 전ACL = 글만(`select coalesce(p.proacl::text, '(비어 있음 = 기본값)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '제목부서' and p.pronargs = 1;`);
const 몇벌 = 글만(`select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '제목부서';`);
console.log('제목부서 — 몇 벌(overload) ' + 몇벌 + ' · 고치는 것은 **인수 하나짜리**입니다');
console.log('전 ACL — ' + 전ACL);
if (!전본문.trim()) { console.error('✗ 지금 함수 본문을 못 읽었습니다'); process.exit(1); }

/* 바뀌는 줄 — **전체 공고**를 봅니다 (회원 화면만 보면 보류함이 빠집니다) */
const 지금식 = "'([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|의학과|의학팀|파트|지원팀))'";
const 새식 = "'([가-힣A-Za-z0-9]*(?:치료실|치료팀|치료센터|재활팀|재활실|재활의학과|의학팀|파트|지원팀))'";
const 뽑기 = (식) => `nullif(btrim((select m[1] from regexp_matches(coalesce(p.title,''), ${식}) m limit 1)), '')`;
const 바뀔것SQL = `
  select p.id from job_posts p
   where ${뽑기(지금식)} is distinct from ${뽑기(새식)}
     and not ('보여줄제목' = any(coalesce(p.edited_fields, '{}')))
     /* ★ 제목이 **담겨 있는 줄만** 건드립니다 — 직군이 없는 보류함 줄은 제목이
        아예 없어서(제목만들기행 이 null) 다시 만들어도 같습니다. 159줄이 그렇습니다.
        쓸데없이 건드리면 칸기록·상태기록만 쌓입니다 (지침 9절) */
     and p."보여줄제목" is not null`;

console.log('\n── 바뀌는 줄 (전체 공고 · 손으로 정한 제목은 뺍니다) ──');
console.log(psql(`
  \\pset pager off
  select p.id, p.source, coalesce(p.job_group,'(없음)') as 직군,
         (exists (select 1 from job_posts_pub v where v.id = p.id)) as 회원화면,
         ${뽑기(지금식)} as 지금부서, coalesce(${뽑기(새식)}, '(없음)') as 새부서,
         p."보여줄제목" as 지금제목
    from job_posts p
   where p.id in (${바뀔것SQL}) order by p.id;`));

if (!진짜) { console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 바꿉니다'); process.exit(0); }

const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate())
  + '_' + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '제목부서_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, [
  '/* 되돌리기 — 제목부서(text) 를 2026-10-28 전 본문으로 (ACL: ' + 전ACL + ') */',
  'create or replace function public."제목부서"(p_title text)',
  'returns text language sql immutable as $$',
  전본문.trimEnd(),
  '$$;',
  '/* 되돌린 뒤 제목을 다시 만듭니다 */',
  'update job_posts set "보여줄제목" = null where id in (',
  "  select id from job_posts where \"보여줄제목\" is distinct from 제목만들기행(job_posts.*)",
  "    and not ('보여줄제목' = any(coalesce(edited_fields, '{}'))));",
].join('\n') + '\n', 'utf8');
console.log('\n○ 되돌릴 글 — ' + 되돌림);

/* 전 제목을 적어 둡니다 (전·후 한 줄을 내기 위해) */
const 전제목 = psql(`\\pset pager off
  select p.id || E'\\t' || coalesce(p."보여줄제목",'(없음)')
    from job_posts p where p.id in (${바뀔것SQL}) order by p.id;`, ['-X', '-A', '-t', '-q'])
  .split('\n').filter(Boolean).map((l) => l.split('\t'));

console.log(psql(`
  create or replace function public."제목부서"(p_title text)
  returns text language sql immutable as $$
${새본문}
  $$;`));
const 후ACL = 글만(`select coalesce(p.proacl::text, '(비어 있음 = 기본값)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = '제목부서' and p.pronargs = 1;`);
console.log('후 ACL — ' + 후ACL + (후ACL === 전ACL ? '  (전과 같습니다)' : '  ⚠ 전과 다릅니다'));

/* 제목 다시 만들기 — 트리거가 합니다 */
const 몇 = 글만(`with x as (
    update job_posts set "보여줄제목" = null
     where id in (${바뀔것SQL.replace(/\bp\./g, 'job_posts.')}) returning id)
  select count(*) from x;`);
console.log('제목을 다시 만든 줄 — ' + 몇 + '개');

console.log('\n── 전 → 후 ──');
for (const [id, 전] of 전제목) {
  const 후 = 글만(`select coalesce("보여줄제목",'(없음)') from job_posts where id = '${id}';`);
  console.log('  ' + id.padEnd(20) + '\n    전  ' + 전 + '\n    후  ' + 후);
}
