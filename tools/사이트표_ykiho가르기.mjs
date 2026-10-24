/* ★ 사이트표(hosp_sites)에 **요양기관번호(ykiho)** 를 붙여 **같은 이름 다른 병원**을 가릅니다
 * (2026-10-24 세중님 1번 승인 — 「한일병원 이름열쇠 가르기 · ykiho 로 두 줄 분리」)
 *
 *   node tools/사이트표_ykiho가르기.mjs            봅니다 (마른 · 전후 원문)
 *   node tools/사이트표_ykiho가르기.mjs --진짜      칸을 더하고 채웁니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 사이트표는 병원을 **이름열쇠**로 가립니다. 그런데 `hira_name_key()` 가 법인 말을 떼므로
 * **서로 다른 병원 셋이 같은 열쇠**가 됩니다 —
 *   한일병원            055-759-7777  경남 진주  종합병원   (hanilhosp.co.kr)
 *   의료법인한전의료재단 한일병원  02-901-3114   서울 도봉  종합병원   (hanilmed.net)  ← 1층 대상
 *   한일병원            062-600-1000  광주 남구  병원      (hanilmd.co.kr · 2층)
 *
 * 그 때문에 `기관잇기()` 의 `사이트` 짝이 **두 곳을 다 가리켜** 공고가 안 붙습니다
 * (HS3 공고 3건이 그렇게 떠 있었습니다 — 함수가 틀린 것이 아니라 **재료가 모자란 것**입니다).
 *
 * ── 하는 일 ─────────────────────────────────────────────────
 *   ① `hosp_sites.ykiho` 칸을 더합니다 (text · null 허용 · 아무도 아직 안 읽습니다)
 *   ② 채웁니다 — **심평원에 그 이름열쇠가 딱 한 곳일 때만** 자동으로 (근거 「심평원 한 곳」)
 *   ③ 여러 곳인 줄은 **열어서 확인한 것만** 손으로 (전화·주소를 심평원과 대 봤습니다)
 *   ④ 못 가린 줄은 **비워 두고 목록**으로 냅니다 — 짐작하지 않습니다 (지침 3·10-3절)
 *
 * ★ `기관잇기()` 가 이 칸을 보게 고치는 것은 **DB 함수** 라 승인 자리입니다 —
 *   전문을 `docs/승인대기_1024.md ㉪` 에 올렸습니다. 이 도구는 **재료만** 만듭니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 진짜 = process.argv.includes('--진짜');

/* ★ **열어서 확인한** 줄만 적습니다 (2026-10-24 19:20 · 쪽을 열어 전화·주소를 심평원과 대 봤습니다).
   짐작이 아닙니다 — 왼쪽이 사이트표의 집이고 오른쪽이 심평원 요양기관번호입니다 */
export const 손으로가린것 = [
  { 집: 'hanilhosp.co.kr',
    ykiho: 'JDQ4MTYyMiM4MSMkMSMkNCMkODkkMzgxMzUxIzExIyQxIyQzIyQ4MiQzNjEyMjIjNjEjJDEjJDQjJDgz',
    왜: '쪽 전화 055-759-7777 · 「경남」 = 심평원 진주 한일병원(종합병원)' },
  { 집: 'hanilmed.net',
    ykiho: 'JDQ4MTg4MSM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQ3IyQ4OSQ0NjEwMDIjODEjJDEjJDYjJDgz',
    왜: '쪽 주소 「서울특별시 도봉구 우이천로 308」 · 전화 02-901-3114 = 심평원 한전의료재단 한일병원(종합병원 · 1층 대상)' },
];

/** 전화번호를 숫자만 남겨 견줍니다 (「02-901-3114」 ↔ 「029013114」) */
export const 전화숫자 = (s) => String(s || '').replace(/[^0-9]/g, '');
/** 쪽에서 전화 꼴을 모읍니다 */
export const 쪽전화들 = (html) => {
  const 글 = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return [...new Set((글.match(/0\d{1,2}[-)\s]\s?\d{3,4}[-\s]\d{4}/g) || []).map(전화숫자))];
};

if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('전화 숫자만', 전화숫자('02-901-3114') === '029013114');
  보('쪽에서 전화를 모은다', 쪽전화들('<p>대표전화 : 02-901-3114</p>').includes('029013114'));
  보('괄호 꼴도 모은다', 쪽전화들('TEL 055) 759-7777').includes('0557597777'));
  보('전화가 없으면 빈 배열', 쪽전화들('<p>전화 없음</p>').length === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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
  const 임시 = path.join(os.tmpdir(), 'ykiho가르기_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', [...꼴, '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

/* ── 전 원문 ── */
console.log('── 전 · hosp_sites 칸 ──\n' + psql(
  `select string_agg(column_name, ' · ' order by ordinal_position)
     from information_schema.columns where table_name = 'hosp_sites';`));
console.log('\n── 전 · 권한(ACL) ──\n' + psql(
  `select coalesce(relacl::text, '(기본값 — 비어 있음)') from pg_class where relname = 'hosp_sites';`));
console.log('\n── 전 · 줄 수 ──\n' + psql(
  `select count(*) || '줄 (끈 것 ' || count(*) filter (where "끔") || ')' from hosp_sites;`));
console.log('\n── 이름열쇠가 심평원 여러 곳을 가리키는 줄 ──');
const 여럿 = psql(`
  select s."이름열쇠", s.name, coalesce(s.url,''),
         (select count(distinct h.ykiho) from hira_org h where h.name_key = s."이름열쇠")
    from hosp_sites s
   where coalesce(s."끔", false) = false
     and (select count(distinct h.ykiho) from hira_org h where h.name_key = s."이름열쇠") > 1
   order by 4 desc, 1;`).split('\n').filter(Boolean).map((l) => l.split('\t'));
for (const [열쇠, 이름, 주소, n] of 여럿) {
  const 손 = 손으로가린것.find((x) => String(주소).includes(x.집));
  console.log('  ' + String(열쇠).slice(0, 18).padEnd(19) + String(이름).slice(0, 26).padEnd(27)
    + '심평원 ' + String(n).padStart(2) + '곳 · ' + String(주소).slice(0, 34)
    + (손 ? '  ← 손으로 가림' : ''));
}
console.log('  — 모두 ' + 여럿.length + '줄 (손으로 가린 것 '
  + 여럿.filter(([, , 주소]) => 손으로가린것.some((x) => String(주소).includes(x.집))).length + '줄)');

/* ── ★ 여럿인 줄을 **열어서 전화로** 가립니다 (짐작 아님 · 세중님 1번) ──
   심평원 후보의 전화와 쪽의 전화가 **딱 하나** 맞을 때만 받습니다. 둘 이상 맞거나
   하나도 안 맞으면 **비워 둡니다** (지침 3절 — 짐작하지 않습니다) */
const 전화로가린것 = [];
console.log('\n── 여럿인 줄을 열어 전화로 가립니다 (한 집마다 0.8초) ──');
for (const [열쇠, 이름, 주소] of 여럿) {
  if (손으로가린것.some((x) => String(주소).includes(x.집))) continue;
  if (!주소) { console.log('  · ' + String(이름).slice(0, 24).padEnd(25) + '주소 없음'); continue; }
  const 후보 = psql(`select ykiho, yadm_nm, coalesce(tel,''), sido_nm, sggu_nm
       from hira_org where name_key = '${String(열쇠).replace(/'/g, "''")}' order by ykiho;`)
    .split('\n').filter(Boolean).map((l) => l.split('\t'));
  let html = '';
  try {
    const r = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob-collector/1.0; +https://potjob.co.kr)' },
      signal: AbortSignal.timeout(15000), redirect: 'follow' });
    if (!r.ok) { console.log('  ✗ ' + String(이름).slice(0, 24).padEnd(25) + 'HTTP ' + r.status); continue; }
    html = await r.text();
  } catch (e) { console.log('  ✗ ' + String(이름).slice(0, 24).padEnd(25) + String(e.message).slice(0, 34)); continue; }
  await new Promise((z) => setTimeout(z, 800));
  const 쪽들 = 쪽전화들(html);
  const 맞음 = 후보.filter((c) => c[2] && 쪽들.includes(전화숫자(c[2])));
  if (맞음.length === 1) {
    전화로가린것.push({ 주소, ykiho: 맞음[0][0],
      왜: '쪽 전화 ' + 맞음[0][2] + ' = 심평원 ' + 맞음[0][1] + '(' + 맞음[0][3] + ' ' + 맞음[0][4] + ')' });
    console.log('  ○ ' + String(이름).slice(0, 24).padEnd(25) + 전화로가린것.at(-1).왜);
  } else {
    console.log('  · ' + String(이름).slice(0, 24).padEnd(25)
      + '못 가립니다 — 쪽 전화 ' + (쪽들.slice(0, 2).join(',') || '없음')
      + ' · 맞는 후보 ' + 맞음.length + '/' + 후보.length + ' → **비워 둡니다**');
  }
}
console.log('  — 전화로 가린 것 ' + 전화로가린것.length + '줄 / 여럿 ' + 여럿.length + '줄');

if (!진짜) {
  console.log('\n[마른] 아무것도 안 바꿨습니다 — --진짜 로 합니다');
  console.log('\n── 돌릴 글 ──');
  console.log('  alter table hosp_sites add column if not exists ykiho text;');
  console.log('  comment on column hosp_sites.ykiho is \'심평원 요양기관번호 — 같은 이름 다른 병원을 가립니다 (2026-10-24)\';');
  console.log('  update hosp_sites s set ykiho = (심평원에 이름열쇠가 한 곳인 줄만)  …');
  console.log('  update hosp_sites s set ykiho = \'…\' where url like \'%hanilhosp.co.kr%\';   (열어서 확인)');
  console.log('  update hosp_sites s set ykiho = \'…\' where url like \'%hanilmed.net%\';      (열어서 확인)');
  process.exit(0);
}

/* ── 되돌림 ── */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 되돌림 = path.join(되돌림터, 'hosp_sites_ykiho_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림,
  ['/* 되돌리기 — hosp_sites.ykiho 칸을 없앱니다 (칸을 더하기 전 상태) */',
    'alter table hosp_sites drop column if exists ykiho;', ''].join('\n'), 'utf8');
console.log('\n되돌림 — ' + 되돌림);

/* ── ① 칸 더하기 ── */
psql(`alter table hosp_sites add column if not exists ykiho text;
comment on column hosp_sites.ykiho is '심평원 요양기관번호 — 같은 이름 다른 병원을 가립니다 (2026-10-24 세중님 1번)';`);
/* ── ② 심평원에 한 곳뿐인 줄 ── */
const 자동 = psql(`
  with 한곳 as (
    select name_key, min(ykiho) as ykiho from hira_org group by 1 having count(distinct ykiho) = 1
  )
  update hosp_sites s set ykiho = h.ykiho
    from 한곳 h where h.name_key = s."이름열쇠" and s.ykiho is null
  returning 1;`).split('\n').filter(Boolean).length;
/* ── ③ 열어서 확인한 줄 ── */
let 손 = 0;
for (const x of 손으로가린것) {
  const n = psql(`update hosp_sites set ykiho = '${x.ykiho}'
     where url like '%${x.집}%' and (ykiho is null or ykiho <> '${x.ykiho}') returning 1;`)
    .split('\n').filter(Boolean).length;
  console.log('  ○ ' + x.집.padEnd(22) + n + '줄 — ' + x.왜);
  손 += n;
}
let 전화 = 0;
for (const x of 전화로가린것) {
  전화 += psql(`update hosp_sites set ykiho = '${x.ykiho}'
     where url = '${String(x.주소).replace(/'/g, "''")}' and ykiho is distinct from '${x.ykiho}'
     returning 1;`).split('\n').filter(Boolean).length;
}
console.log('\n채운 줄 — 심평원 한 곳 ' + 자동 + '줄 · 열어서 확인(손) ' + 손
  + '줄 · 전화로 가림 ' + 전화 + '줄');

/* ── 후 원문 ── */
console.log('\n── 후 · 칸 ──\n' + psql(
  `select string_agg(column_name, ' · ' order by ordinal_position)
     from information_schema.columns where table_name = 'hosp_sites';`));
console.log('\n── 후 · 권한(ACL) ──\n' + psql(
  `select coalesce(relacl::text, '(기본값 — 비어 있음)') from pg_class where relname = 'hosp_sites';`));
console.log('\n── 후 · 채움 ──\n' + psql(`
  select count(*) || '줄 가운데 ykiho 있음 ' || count(ykiho)
         || ' · 비어 있음 ' || count(*) filter (where ykiho is null)
    from hosp_sites where coalesce("끔", false) = false;`));
console.log('\n── 아직 비어 있는 줄 (짐작하지 않습니다) ──\n' + psql(`
  select '  ' || rpad(s.name, 30) || ' 심평원 '
         || (select count(distinct h.ykiho) from hira_org h where h.name_key = s."이름열쇠") || '곳 · '
         || left(coalesce(s.url,''), 40)
    from hosp_sites s where s.ykiho is null and coalesce(s."끔", false) = false
   order by s.name limit 40;`));
