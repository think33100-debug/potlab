/* ㉫ 기관 표를 **이름키 대신 번호(ykiho)로** 잇습니다 (2026-10-24 세중님 ㉫ 승인 · 마른 실행 먼저)
 *
 *   node tools/기관표_번호로잇기.mjs            마른 실행 (전문·바뀌는 줄 수)
 *   node tools/기관표_번호로잇기.mjs --진짜      창구 함수를 올립니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 도구 여럿이 `left join 기관 o on o.이름키 = hira_name_key(g."기관")` 로 잇습니다.
 * 이름키가 겹치는 1층 18곳에서 **엉뚱한 병원 줄**이 붙습니다 —
 *   의료법인한전의료재단 한일병원(서울 도봉) → 기관 표의 **진주 한일병원**(경남 주소)
 * `손확인_주소.mjs` 의 읽기는 더 나쁩니다 — `where 이름키 = … limit 1` 로 **아무 줄 하나**를
 * 골라 거기에 세중님이 적어 주신 주소를 씁니다.
 *
 * ── 길 ───────────────────────────────────────────────────────
 * 이름 → 번호를 **한 자리**에서 풉니다 (지침 6절) —
 *   `기관번호_이름으로(이름)` = 심평원에 그 이름열쇠가 **딱 한 곳**일 때만 'HIRA:'||ykiho,
 *   여러 곳이면 **null** (짐작하지 않습니다 · 지침 10-3).
 * 도구들은 `left join 기관 o on o."기관번호" = 기관번호_이름으로(g."기관")` 로 바꿉니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q', '-F', '\t']) {
  const 임시 = path.join(os.tmpdir(), '번호로잇기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* ── 돌릴 전문 ── */
const 전문 = `create or replace function public."기관번호_이름으로"(p_이름 text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $fn$
  /* 이름 → 기관번호. 심평원에 그 이름열쇠가 **딱 한 곳**일 때만 냅니다.
     여러 곳이면 null — 어느 병원인지 모르면 짐작하지 않습니다 (지침 10-3) */
  select 'HIRA:' || min(h.ykiho)
    from hira_org h
   where h.name_key = hira_name_key(p_이름)
  having count(distinct h.ykiho) = 1
$fn$;
revoke execute on function public."기관번호_이름으로"(text) from public, anon, authenticated;
grant  execute on function public."기관번호_이름으로"(text) to service_role;`;

console.log('── 돌릴 전문 ──\n' + 전문);

const 있나 = psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='기관번호_이름으로';`).trim();
console.log('\n지금 그 이름의 함수 — ' + 있나 + '벌');
if (있나 !== '0') {
  console.log('전 ACL — ' + psql(`select coalesce(p.proacl::text,'(비어 있음)') from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='기관번호_이름으로';`));
}

/* ── 마른 실행 — 두 길이 어떻게 다른가 (함수 없이 같은 셈을 합니다) ── */
const 번호식 = `(select 'HIRA:' || min(h.ykiho) from hira_org h
        where h.name_key = hira_name_key(g."기관")
       having count(distinct h.ykiho) = 1)`;
console.log('\n── 마른 실행 · 1층 대상 777곳에서 두 길을 견줍니다 ──');
console.log(psql(`
  with g as (select "갈래", "기관", "상태" from "일층병원_구멍"()),
  t as (
    select g.*,
           (select o."기관번호" from 기관 o where o.이름키 = hira_name_key(g."기관") limit 1) as 이름키로,
           (select count(*) from 기관 o where o.이름키 = hira_name_key(g."기관")) as 이름키줄,
           ${번호식} as 번호로,
           (select count(*) from 기관 o where o."기관번호" = ${번호식}) as 번호줄
      from g)
  select '전체 ' || count(*)
      || ' · 이름키로 붙는 곳 ' || count(이름키로)
      || ' · 번호로 붙는 곳 ' || count(*) filter (where 번호줄 = 1)
      || E'\\n' ||
         '같은 줄에 붙음 ' || count(*) filter (where 이름키로 is not null and 이름키로 = 번호로)
      || ' · **다른 줄에 붙음 ' || count(*) filter (where 이름키로 is not null and 번호로 is not null and 이름키로 <> 번호로) || '**'
      || ' · 이름키로만 붙음(번호 못 풀림) ' || count(*) filter (where 이름키로 is not null and 번호로 is null)
      || ' · 번호로만 붙음 ' || count(*) filter (where 이름키로 is null and 번호줄 = 1)
    from t;`, ['-X', '-A', '-t', '-q']));

console.log('\n── 「이름키로 붙는데 번호로는 못 푸는 곳」 (이름이 심평원에 여럿 · 짐작이던 자리) ──');
console.log(psql(`
  with g as (select "갈래", "기관", "상태" from "일층병원_구멍"())
  select '  ' || rpad(g."갈래", 12) || rpad(left(g."기관", 26), 28) || g."상태"
      || '  → 기관 표 줄 ' || (select count(*) from 기관 o where o.이름키 = hira_name_key(g."기관"))
      || ' · 심평원 ' || (select count(distinct h.ykiho) from hira_org h where h.name_key = hira_name_key(g."기관")) || '곳'
    from g
   where (select count(*) from 기관 o where o.이름키 = hira_name_key(g."기관")) > 0
     and ${번호식} is null
   order by g."기관";`, ['-X', '-A', '-t', '-q']));

console.log('\n── 기관 표 줄이 **둘 이상** 붙는 이름 (어느 줄을 집을지 모르던 자리) ──');
console.log(psql(`
  with g as (select "기관" from "일층병원_구멍"())
  select '  ' || rpad(left(g."기관", 30), 32) || '기관 표 줄 '
      || (select count(*) from 기관 o where o.이름키 = hira_name_key(g."기관"))
    from g
   where (select count(*) from 기관 o where o.이름키 = hira_name_key(g."기관")) > 1
   order by g."기관";`, ['-X', '-A', '-t', '-q']));

if (!진짜) { console.log('\n[마른] 함수를 안 올렸습니다 — --진짜 로 올립니다'); process.exit(0); }

/* ── 되돌림 ── */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, '기관번호_이름으로_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, 있나 === '0'
  ? '/* 되돌리기 — 새로 만든 함수를 없앱니다 */\ndrop function if exists public."기관번호_이름으로"(text);\n'
  : '/* 되돌리기 — 전 전문 그대로 */\n' + psql(`select pg_get_functiondef(p.oid) from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='기관번호_이름으로';`, ['-X', '-A', '-t', '-q']) + ';\n', 'utf8');
console.log('\n되돌림 — ' + 되돌림);

psql(전문);
console.log('\n── 후 · 함수 ──\n' + psql(`
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      || ' · ACL ' || coalesce(p.proacl::text,'(비어 있음)')
      || ' · definer ' || p.prosecdef::text
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='기관번호_이름으로';`, ['-X', '-A', '-t', '-q']));
console.log('\n── 돌려 보기 (한일병원 꼴) ──\n' + psql(`
  select '  ' || rpad(v, 34) || coalesce("기관번호_이름으로"(v), '(여럿이라 null — 짐작 안 함)')
    from (values ('의료법인한전의료재단 한일병원'), ('한일병원'), ('경상북도포항의료원'),
                 ('강북삼성병원'), ('우리들병원')) as c(v);`, ['-X', '-A', '-t', '-q']));
