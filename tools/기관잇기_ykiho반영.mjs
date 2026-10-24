/* ㉪ `기관잇기()` 가 **사이트표 ykiho** 를 보게 — 두 군데만 고칩니다 (2026-10-24 세중님 ㉪ 승인)
 *
 *   node tools/기관잇기_ykiho반영.mjs --전문보기     새 전문을 찍습니다 (아무것도 안 바꿈)
 *   node tools/기관잇기_ykiho반영.mjs --진짜        올리고 한 바퀴 돌려 전후 셈
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * `사이트` 짝이 「도메인 ↔ **이름키**」라, 같은 이름 다른 병원(한일병원 꼴)에서 후보가
 * 둘이 되어 **못 고릅니다**. 이제 `hosp_sites.ykiho` 가 있으니(266/297줄) **번호로** 봅니다.
 *
 * ── 울타리 ───────────────────────────────────────────────────
 *   ★ 치환은 **딱 한 번씩** 맞아야 합니다 — 아니면 멈춥니다 (블록을 통째로 안 갈아끼웁니다 · 지침 7절)
 *   ★ 전 ACL·전 전문을 `~/되돌림/` 에 먼저 적습니다 (지침 6-2a · 8-19)
 *   ★ 공고의 `기관번호·연결상태·연결근거` **전부를 스냅샷**으로 남깁니다 — 함수가 줄을
 *     고치므로 그게 유일한 되돌림입니다
 *   ★ 올린 뒤 ACL 을 **글자까지** 견줍니다 (create or replace 는 ACL 을 지키지만 확인합니다)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');

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
function psql(sql, 꼴 = ['-X', '-A', '-t', '-q']) {
  const 임시 = path.join(os.tmpdir(), '잇기ykiho_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── 전 — 전문·ACL ── */
const 전ACL = psql(`select coalesce(p.proacl::text,'(비어 있음)') from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='기관잇기';`);
const 몇벌 = psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='기관잇기';`);
if (몇벌.trim() !== '1') { console.error('✗ 기관잇기 가 ' + 몇벌 + '벌입니다 — 멈춥니다'); process.exit(1); }
const 전전문 = psql(`select pg_get_functiondef(p.oid) from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='기관잇기';`);
console.log('전 ACL — ' + 전ACL + ' · 전문 ' + 전전문.split('\n').length + '줄');

/* ── 두 군데 치환 ── */
const 옛1 = `), 사이트 as (
    select distinct 주소도메인(url) as 도메인, hira_name_key(name) as 이름키
      from hosp_sites where 주소도메인(url) is not null
    union
    select 주소도메인(our_name), hira_name_key(hira_name)
      from org_alias where kind = '호스트' and 주소도메인(our_name) is not null`;
const 새1 = `), 사이트 as (
    /* ★ 2026-10-24 세중님 ㉪ — **번호(ykiho)까지** 함께 봅니다. 같은 이름 다른 병원
       (한일병원: 진주 ↔ 서울 한전)에서 이름키로만 보면 후보가 둘이 되어 **못 골랐습니다**.
       사이트표에 ykiho 를 채워 두었습니다 (266/297줄 · 열어서 전화로 가린 것만) */
    select distinct 주소도메인(url) as 도메인, hira_name_key(name) as 이름키, ykiho
      from hosp_sites where 주소도메인(url) is not null
    union
    select 주소도메인(our_name), hira_name_key(hira_name), null
      from org_alias where kind = '호스트' and 주소도메인(our_name) is not null`;
const 옛2 = `      exists (select 1 from 사이트 s
               where s.도메인 = c.도메인 and s.이름키 = o.name_key)        as 사이트맞나,`;
const 새2 = `      exists (select 1 from 사이트 s
               where s.도메인 = c.도메인
                 and (s.ykiho = o.ykiho                     /* 번호가 있으면 번호로 */
                      or (s.ykiho is null and s.이름키 = o.name_key)))     as 사이트맞나,`;
for (const [이름, 옛] of [['사이트 CTE', 옛1], ['사이트맞나', 옛2]]) {
  const n = 전전문.split(옛).length - 1;
  if (n !== 1) { console.error('✗ ' + 이름 + ' 자리가 ' + n + '번 맞습니다 (한 번이어야 합니다) — 멈춥니다'); process.exit(1); }
}
const 새전문 = 전전문.split(옛1).join(새1).split(옛2).join(새2);
const 새자리 = path.join(os.homedir(), '되돌림', '기관잇기_새전문_' + Date.now() + '.sql');
fs.mkdirSync(path.dirname(새자리), { recursive: true });
fs.writeFileSync(새자리, 새전문 + '\n', 'utf8');
console.log('새 전문 — ' + 새전문.split('\n').length + '줄 · ' + 새자리);

if (argv.includes('--전문보기')) {
  console.log('\n════════ 새 전문 (그대로 올립니다) ════════');
  console.log(새전문);
  console.log('════════ 끝 ════════');
  process.exit(0);
}
if (!진짜) { console.log('\n[마른] --전문보기 로 전문을, --진짜 로 올립니다'); process.exit(0); }

/* ── 되돌림 ── */
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림터 = path.join(os.homedir(), '되돌림');
const 되돌림 = path.join(되돌림터, '기관잇기_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  ['/* 되돌리기 — 기관잇기() 를 2026-10-24 ㉪ 전으로 (전문 그대로 · ACL 동일) */',
    전전문, ';', '',
    '/* ACL 은 create or replace 가 지킵니다 — 전: ' + 전ACL + ' */'].join('\n'), 'utf8');
const 스냅 = path.join(되돌림터, '기관잇기_공고스냅샷_' + 때 + '.sql');
const 줄들 = psql(`select 'update job_posts set "기관번호" = ' ||
         coalesce(quote_literal("기관번호"),'null') || ', "연결상태" = ' ||
         coalesce(quote_literal("연결상태"),'null') || ', "연결근거" = ' ||
         coalesce(quote_literal("연결근거"),'null') ||
         ' where id = ' || quote_literal(id) || ';'
    from job_posts;`);
fs.writeFileSync(스냅, '/* 되돌리기 — 공고의 기관 연결을 ' + 때 + ' 직전으로 */\n' + 줄들 + '\n', 'utf8');
console.log('되돌림 — ' + 되돌림 + '\n스냅샷 — ' + 스냅 + ' (' + 줄들.split('\n').length + '줄)');

/* ── 전 셈 ── */
const 셈SQL = `
  select count(*) filter (where "기관번호" is not null and "기관번호" like 'HIRA:%') as 번호로,
         count(*) filter (where "기관번호" is not null and "기관번호" like 'NAME:%') as 이름으로,
         count(*) filter (where "기관번호" is null) as 안붙음,
         count(*) as 전체
    from job_posts_pub;`;
const 전셈 = psql(셈SQL, ['-X', '-A', '-t', '-q', '-F', '\t']);
console.log('\n전 (회원 화면) — 번호로/이름으로/안붙음/전체 = ' + 전셈);

/* ── 올리기 ── */
psql(새전문 + ';');
const 후ACL = psql(`select coalesce(p.proacl::text,'(비어 있음)') from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='기관잇기';`);
console.log('후 ACL — ' + 후ACL + (후ACL === 전ACL ? '  ○ 글자까지 같습니다' : '  ✗ 달라졌습니다!'));
if (후ACL !== 전ACL) {
  console.error('✗ ACL 이 달라졌습니다 — 되돌림을 바로 올리십시오: ' + 되돌림);
  process.exit(1);
}

/* ── 한 바퀴 ── */
console.log('\n── 기관잇기() 한 바퀴 ──\n' + psql(`select * from "기관잇기"();`, ['-X', '-A', '-t', '-q', '-F', '\t']));
const 후셈 = psql(셈SQL, ['-X', '-A', '-t', '-q', '-F', '\t']);
console.log('\n후 (회원 화면) — 번호로/이름으로/안붙음/전체 = ' + 후셈);
console.log('\n── 연결근거별 (회원 화면) ──\n' + psql(`
  select coalesce("연결근거",'(빈칸)') || '  ' || count(*) from job_posts_pub
   group by 1 order by 2 desc;`));
console.log('\n── 사이트표 ykiho 로 바뀐 공고 견본 ──\n' + psql(`
  select id || '  ' || left(org_name, 22) || '  ' || coalesce("연결근거",'')
    from job_posts_pub where "연결근거" ilike '%사이트%' order by id limit 10;`));
