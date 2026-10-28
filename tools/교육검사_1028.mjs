/* 교육 쪽 **검사** — 11/10 에 「보기만」으로 열 수 있나 (2026-10-28 세중님 2번)
 *
 *   node tools/교육검사_1028.mjs            검사 (읽기만)
 *   node tools/교육검사_1028.mjs --표본 30   표본 수를 바꿔서
 *
 * ── 무엇을 보나 ─────────────────────────────────────────────
 *   ① 지난 교육이 **화면에 보이나** — `교육목록(…, p_지난것)` 이 가르는지, 기본값이 무엇인지
 *   ② 표본 20 **원문 대조** — 제목·시작·끝·장소·모집인원이 `교육.원문` 에 있나
 *   ③ **무관 교육** — 직군이 우리(물리·작업·공통) 가 아닌 줄
 *   ④ 마감 지난 교육을 **내리는 자리**가 있나 (크론·함수·상태 칸)
 *
 * ★ 읽기만 합니다. 교육 자료는 손대지 않습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const 뿌리 = path.join(import.meta.dirname, '..');
const 표본수 = Number(process.argv.includes('--표본')
  ? process.argv[process.argv.indexOf('--표본') + 1] : 20) || 20;

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
  const 임시 = path.join(os.tmpdir(), '교육검사_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 줄로 = (sql) => psql(sql, ['-X', '-A', '-t', '-q', '-F', '\t'])
  .split('\n').filter(Boolean).map((l) => l.split('\t'));
const 글만 = (sql) => psql(sql, ['-X', '-A', '-t', '-q']);

console.log('══ 교육 — 지금 ══');
console.log(psql(`
  \\pset pager off
  select count(*) as 전체,
         count(*) filter (where "끝" >= (now() at time zone 'Asia/Seoul')::date) as 안지난것,
         count(*) filter (where "끝" <  (now() at time zone 'Asia/Seoul')::date) as 지난것,
         count(*) filter (where "끝" is null) as 끝_없음,
         count(*) filter (where coalesce("원문",'') = '') as 원문_없음
    from "교육";`));
console.log(psql(`
  \\pset pager off
  select "출처", count(*) as 교육,
         count(*) filter (where "끝" < (now() at time zone 'Asia/Seoul')::date) as 지난것,
         min("시작") as 가장이른, max("끝") as 가장늦은
    from "교육" group by 1 order by 2 desc;`));

/* ① 지난 교육이 화면에 보이나 — 함수 원문에서 p_지난것 을 어떻게 쓰나 */
console.log('\n══ ① 지난 교육이 화면에 보이나 ══');
const 목록원문 = 글만(`select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = '교육목록';`);
const 지난줄 = 목록원문.split('\n').filter((l) => /지난것|끝|상태/.test(l)).slice(0, 8);
for (const l of 지난줄) console.log('  ' + l.trim().slice(0, 110));
console.log('  → 화면(web/app/edu/page.tsx)이 보내는 기본값은 `지난것 = false` 입니다');

/* ② 표본 원문 대조 */
console.log('\n══ ② 표본 ' + 표본수 + '건 원문 대조 ══');
const 표본 = 줄로(`
  select "번호", coalesce("제목",''), coalesce("시작"::text,''), coalesce("끝"::text,''),
         coalesce("장소",''), coalesce("모집인원"::text,''),
         replace(replace(coalesce("원문",''), E'\\n', ' '), E'\\t', ' ')
    from "교육"
   where coalesce("원문",'') <> ''
   order by "올린날" desc nulls last
   limit ${표본수};`);
let 틀림 = 0;
const 틀린것 = [];
/** 날짜를 원문에서 찾을 꼴들 — 2026-11-05 · 2026. 11. 5. · 11/5 · 11월 5일 */
function 날짜꼴들(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return [];
  const [, y, mo, d] = m;
  const mo0 = String(Number(mo));
  const d0 = String(Number(d));
  return [
    `${y}-${mo}-${d}`, `${y}.${mo}.${d}`, `${y}. ${mo}. ${d}`, `${y}. ${mo0}. ${d0}`,
    `${y}년 ${mo0}월 ${d0}일`, `${mo}/${d}`, `${mo0}/${d0}`, `${mo0}월 ${d0}일`,
    `${mo}.${d}`, `${mo0}.${d0}`,
  ];
}
for (const [번호, 제목, 시작, 끝, 장소, 인원, 원문] of 표본) {
  const 글 = String(원문);
  const 눕힌 = 글.replace(/\s+/g, ' ');
  const 탈 = [];
  /* 제목 — 앞 12글자가 원문에 있나 (제목은 출처가 다듬어 적는 일이 많습니다) */
  const 제목조각 = String(제목).replace(/\s+/g, ' ').slice(0, 12);
  if (제목조각 && !눕힌.includes(제목조각)) 탈.push('제목「' + 제목조각 + '」');
  for (const [이름, 값] of [['시작', 시작], ['끝', 끝]]) {
    if (!값) continue;
    const 꼴 = 날짜꼴들(값);
    if (꼴.length && !꼴.some((x) => 눕힌.includes(x))) 탈.push(이름 + ' ' + 값);
  }
  if (장소) {
    const 장소조각 = String(장소).replace(/\s+/g, ' ').slice(0, 6);
    if (장소조각 && !눕힌.includes(장소조각)) 탈.push('장소「' + 장소조각 + '」');
  }
  if (인원 && 인원 !== '0' && !눕힌.includes(인원)) 탈.push('모집인원 ' + 인원);
  if (탈.length) { 틀림++; 틀린것.push({ 번호, 제목: String(제목).slice(0, 34), 탈 }); }
}
console.log('표본 ' + 표본.length + '건 · **원문에서 못 찾은 값이 있는 줄 ' + 틀림 + '건**');
for (const x of 틀린것) {
  console.log('  ✗ ' + String(x.번호).padEnd(8) + x.제목.padEnd(36) + x.탈.join(' · '));
}
console.log('★ 「못 찾음」은 **우리가 틀렸다는 뜻이 아닙니다** — 원문이 날짜를 다른 꼴로');
console.log('  적었거나 원문 자체가 토막일 수 있습니다 (지침 10-2a · 10-5). 그래서 목록으로만 냅니다');

/* ③ 무관 교육 */
console.log('\n══ ③ 우리 직군과 무관한 교육 ══');
console.log(psql(`
  \\pset pager off
  select coalesce("직군",'(빈칸)') as 직군, count(*) as 교육,
         count(*) filter (where "끝" >= (now() at time zone 'Asia/Seoul')::date) as 안지난것
    from "교육" group by 1 order by 2 desc;`));

/* ④ 마감 지난 교육 내리는 자리 */
console.log('\n══ ④ 마감 지난 교육을 내리는 자리 ══');
console.log(psql(`
  \\pset pager off
  select coalesce("상태",'(빈칸)') as 상태, count(*) as 교육 from "교육" group by 1 order by 2 desc;`));
const 내리는함수 = 줄로(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname ~ '교육' and p.prosrc ~ '끝|상태|지난'
  order by 1;`);
console.log('교육 자료에서 「끝·상태·지난」을 보는 함수 — '
  + (내리는함수.length ? 내리는함수.map((r) => r[0]).join(' · ') : '(없습니다)'));
console.log('\n★ 아무것도 바꾸지 않았습니다 (읽기만).');
