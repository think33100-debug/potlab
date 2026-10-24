/* ★ **진단만** — 139곳에서 HS3 가 최근 30일 공고 0건인 까닭 갈래 (2026-10-24 세중님 2번)
 *
 *   node tools/긁기/HS3진단.mjs            봅니다 (아무것도 안 바꿉니다)
 *   node tools/긁기/HS3진단.mjs --적기      docs/HS3진단_1024.md · .json 으로 적습니다
 *
 * ★ **고치지 않습니다.** HS3 는 10/31 동결 대상이고 세중님이 「지금은 HS3 손대지 않음」
 *   이라 하셨습니다 (3번). 이 도구는 **세고 적기만** 합니다.
 *
 * ── 갈래 (세중님 2번 ⓐⓑⓒ + 제가 둘을 더했습니다) ─────────────
 *   ⓧ 구멍 아님   HS3·HS 가 **최근 30일 공고를 받고 있습니다** (셈에서 뺍니다)
 *   ⓑ HS3 가 못 읽음   HS3 30일 0건인데 **오늘 긁기는 읽었습니다** (겹치지 않는 공고를 담음)
 *   ⓒ 주소가 다름   HS3 설정 주소의 **집(host)이 우리가 연 집과 다릅니다** (옛 주소 의심)
 *   ⓐ 진짜 없음   둘 다 0건이고 **우리 목록은 열려 줄이 있었습니다** (최근 공고가 없는 것)
 *   ⓓ 알 수 없음   **우리도 목록을 못 읽었습니다** (막힘·목록 아님·onclick 등)
 *                 → 「진짜 없음」으로 세지 않습니다. 못 본 것을 없다고 적지 않습니다 (지침 15절)
 *
 * ★ 갈래를 고르는 차례는 위 그대로입니다 (ⓧ 먼저). 한 곳이 두 갈래에 걸리면 **앞 것**입니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
/* 주소 꼴을 가리는 자는 **한 자리**에서 가져옵니다 (지침 6절 · 손확인_주소 와 같은 자) */
import { 홈페이지손질 } from '../워크넷칸손질.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..', '..');
const argv = process.argv.slice(2);
const 적기 = argv.includes('--적기');
const 며칠 = Number(argv.includes('--며칠') ? argv[argv.indexOf('--며칠') + 1] : 30) || 30;

/** 집(host) 만 집습니다 — www·포트·대소문자를 지웁니다 */
export const 집만 = (주소) => {
  const t = 홈페이지손질(주소);      /* 주소 꼴이 아니면 빈 글자를 줍니다 */
  if (!t) return '';
  try {
    return new URL(t.startsWith('http') ? t : 'http://' + t).host.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
};
/** 갈래 고르기 — 위 머리글의 차례 그대로 (셈과 문서가 같은 자를 씁니다) */
export function 갈래고르기(x) {
  if (x.hs3_최근 > 0) return 'ⓧ 구멍 아님';
  if (x.hs4_안겹침 > 0) return 'ⓑ HS3 가 못 읽음';
  const 우리집 = 집만(x.주소); const 저쪽집 = 집만(x.사이트주소 || x.채용주소);
  if (우리집 && 저쪽집 && 우리집 !== 저쪽집) return 'ⓒ 주소가 다름';
  if (x.한바퀴갈래 === '줄 있음') return 'ⓐ 진짜 없음';
  return 'ⓓ 알 수 없음';
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('집만 — www 를 뗀다', 집만('https://www.a.or.kr/x') === 'a.or.kr');
  보('집만 — 꼴이 아니면 빈 글자', 집만('없음') === '' && 집만('') === '');
  보('HS3 가 받고 있으면 ⓧ',
    갈래고르기({ hs3_최근: 2, hs4_안겹침: 1, 한바퀴갈래: '줄 있음' }) === 'ⓧ 구멍 아님');
  보('우리는 읽고 HS3 는 0 이면 ⓑ',
    갈래고르기({ hs3_최근: 0, hs4_안겹침: 1, 한바퀴갈래: '줄 있음' }) === 'ⓑ HS3 가 못 읽음');
  보('집이 다르면 ⓒ',
    갈래고르기({ hs3_최근: 0, hs4_안겹침: 0, 주소: 'https://a.or.kr/b',
      사이트주소: 'http://old.b.or.kr/', 한바퀴갈래: '줄 있음' }) === 'ⓒ 주소가 다름');
  보('같은 집이고 줄이 있었으면 ⓐ',
    갈래고르기({ hs3_최근: 0, hs4_안겹침: 0, 주소: 'https://a.or.kr/b',
      사이트주소: 'https://www.a.or.kr/', 한바퀴갈래: '줄 있음' }) === 'ⓐ 진짜 없음');
  보('우리도 못 읽었으면 ⓓ',
    갈래고르기({ hs3_최근: 0, hs4_안겹침: 0, 한바퀴갈래: '⑤목록 아님' }) === 'ⓓ 알 수 없음');
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 한바퀴 = JSON.parse(fs.readFileSync(path.join(뿌리, 'docs', '긁기_한바퀴_1024.json'), 'utf8'));
const 곳들 = 한바퀴.목록;
console.log('한 바퀴 표 ' + 곳들.length + '곳 — HS3 가 최근 ' + 며칠 + '일 공고를 받나 봅니다');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(path.join(뿌리, f))) continue;
  for (const l of fs.readFileSync(path.join(뿌리, f), 'utf8').split(/\r?\n/)) {
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), 'hs3진단_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── 곳마다 셈 — 이름키로 잇습니다 (기관번호 또는 공고의 org_name) ── */
const 값들 = 곳들.map((x) => `('${따옴(x.이름)}')`).join(',');
const 줄들 = psql(`
  with 곳 as (
    select v.name, hira_name_key(v.name) as k from (values ${값들}) as v(name)
  ), 기 as (
    select 곳.name, 곳.k, o."기관번호", coalesce(o."채용페이지",'') as 채용페이지
      from 곳 left join 기관 o on o.이름키 = 곳.k
  ), 사이트 as (
    select 기.name,
           coalesce(string_agg(nullif(s.url,''), ' | '), '') as 사이트주소,
           coalesce(string_agg(nullif(s."채용주소",''), ' | '), '') as 채용주소,
           coalesce(string_agg(distinct coalesce(s.kind,'') || '/' || coalesce(s."갈래",''), ','), '') as 꼴,
           count(*)::int as 사이트줄,
           count(*) filter (where coalesce(s."끔", false))::int as 끈줄
      from 기 left join hosp_sites s on s."이름열쇠" = 기.k
     group by 1
  ), 공고 as (
    select 기.name,
           count(*) filter (where j.source in ('HS3','HS'))::int as hs3_전체,
           count(*) filter (where j.source in ('HS3','HS')
                   and j.first_seen > (now() at time zone 'Asia/Seoul')::date - ${며칠})::int as hs3_최근,
           coalesce(max(j.first_seen) filter (where j.source in ('HS3','HS'))::text,'') as hs3_마지막,
           count(*) filter (where j.source = 'HS4')::int as hs4,
           count(*) filter (where j.source = 'HS4' and not coalesce(j.hidden,false))::int as hs4_안겹침,
           count(*) filter (where j.source not in ('HS3','HS','HS4')
                   and j.first_seen > (now() at time zone 'Asia/Seoul')::date - ${며칠})::int as 다른출처_최근,
           coalesce(string_agg(distinct j.source, ',') filter (where j.source not in ('HS3','HS','HS4')
                   and j.first_seen > (now() at time zone 'Asia/Seoul')::date - ${며칠}), '') as 다른출처
      from 기
      left join job_posts j
             on (기."기관번호" is not null and j."기관번호" = 기."기관번호")
             or hira_name_key(j.org_name) = 기.k
     group by 1
  )
  select 기.name, coalesce(기."기관번호",''), 기.채용페이지,
         사이트.사이트주소, 사이트.채용주소, 사이트.꼴, 사이트.사이트줄, 사이트.끈줄,
         공고.hs3_전체, 공고.hs3_최근, 공고.hs3_마지막, 공고.hs4, 공고.hs4_안겹침,
         공고.다른출처_최근, 공고.다른출처
    from 기 join 사이트 on 사이트.name = 기.name join 공고 on 공고.name = 기.name
   order by 기.name;`).split('\n').filter(Boolean);

const 표 = new Map();
for (const l of 줄들) {
  const c = l.split('\t');
  표.set(c[0], { 기관번호: c[1], 채용페이지: c[2], 사이트주소: c[3], 채용주소: c[4], 꼴: c[5],
    사이트줄: +c[6], 끈줄: +c[7], hs3_전체: +c[8], hs3_최근: +c[9], hs3_마지막: c[10],
    hs4: +c[11], hs4_안겹침: +c[12], 다른출처_최근: +c[13], 다른출처: c[14] });
}

const 낸것 = 곳들.map((x) => {
  const d = 표.get(x.이름) || {};
  const r = { 이름: x.이름, 꼴: x.꼴, 한바퀴갈래: x.갈래, 줄: x.줄, 주소: x.주소, ...d };
  r.진단 = 갈래고르기(r);
  return r;
});

const 셈 = {};
for (const x of 낸것) 셈[x.진단] = (셈[x.진단] || 0) + 1;
console.log('\n── 갈래별 ──');
for (const [k, v] of Object.entries(셈).sort()) console.log('  ' + k.padEnd(16) + v + '곳');

for (const 갈 of Object.keys(셈).sort()) {
  const 들 = 낸것.filter((x) => x.진단 === 갈);
  console.log('\n■ ' + 갈 + ' — ' + 들.length + '곳');
  for (const x of 들.slice(0, 60)) {
    console.log('  ' + String(x.이름).slice(0, 24).padEnd(25)
      + 'HS3 최근 ' + String(x.hs3_최근).padStart(2) + ' / 전체 ' + String(x.hs3_전체).padStart(3)
      + ' (마지막 ' + (x.hs3_마지막 || '없음') + ')'
      + ' · HS4 ' + x.hs4 + '(안겹침 ' + x.hs4_안겹침 + ')'
      + ' · 사이트줄 ' + x.사이트줄 + (x.끈줄 ? '(끈 것 ' + x.끈줄 + ')' : '')
      + ' · 꼴 ' + String(x.꼴 || '').slice(0, 22)
      + (x.다른출처_최근 ? ' · 다른 출처 ' + x.다른출처_최근 + '(' + x.다른출처 + ')' : ''));
  }
  if (들.length > 60) console.log('  … ' + (들.length - 60) + '곳 더 (문서에 전부 있습니다)');
}

if (!적기) { console.log('\n[보기만] 문서를 안 적었습니다 — --적기 로 적습니다'); process.exit(0); }

const 때 = new Date().toISOString().slice(0, 16).replace('T', ' ');
const 줄 = ['# HS3 진단 — 139곳에서 최근 ' + 며칠 + '일 공고가 0건인 까닭 (2026-10-24 세중님 2번)', '',
  '**진단만입니다 — 아무것도 고치지 않았습니다.** HS3 는 10/31 동결 대상이고',
  '세중님이 「지금은 HS3 손대지 않음」 이라 하셨습니다.', '',
  '```',
  '잰때   ' + 때 + ' (UTC)',
  '분모   긁기 한 바퀴 139곳 (docs/긁기_한바퀴_1024.json)',
  '자     HS3·HS 공고의 first_seen 이 오늘-' + 며칠 + '일 안인 것',
  '잇는 길 기관 표 이름키 → 기관번호, 안 되면 공고 org_name 의 이름키',
  '```', '',
  '| 갈래 | 곳 | 뜻 |', '|---|---:|---|',
  '| ⓧ 구멍 아님 | ' + (셈['ⓧ 구멍 아님'] || 0) + ' | HS3·HS 가 최근 ' + 며칠 + '일 공고를 받고 있습니다 |',
  '| ⓑ HS3 가 못 읽음 | ' + (셈['ⓑ HS3 가 못 읽음'] || 0) + ' | HS3 는 0건인데 **오늘 긁기는 읽었습니다** |',
  '| ⓒ 주소가 다름 | ' + (셈['ⓒ 주소가 다름'] || 0) + ' | HS3 설정 주소의 집이 우리가 연 집과 다릅니다 |',
  '| ⓐ 진짜 없음 | ' + (셈['ⓐ 진짜 없음'] || 0) + ' | 둘 다 0건 · 우리 목록은 열려 줄이 있었습니다 |',
  '| ⓓ 알 수 없음 | ' + (셈['ⓓ 알 수 없음'] || 0) + ' | **우리도 목록을 못 읽었습니다** — 없다고 적지 않습니다 |', ''];
for (const 갈 of ['ⓑ HS3 가 못 읽음', 'ⓒ 주소가 다름', 'ⓐ 진짜 없음', 'ⓓ 알 수 없음', 'ⓧ 구멍 아님']) {
  const 들 = 낸것.filter((x) => x.진단 === 갈);
  if (!들.length) continue;
  줄.push('## ' + 갈 + ' — ' + 들.length + '곳', '',
    '| 기관 | HS3 최근/전체 | HS3 마지막 | HS4(안겹침) | 사이트 꼴 | 우리가 연 주소 | HS3 설정 주소 |',
    '|---|---|---|---|---|---|---|');
  for (const x of 들) {
    줄.push('| ' + String(x.이름).replace(/\|/g, '/')
      + ' | ' + x.hs3_최근 + ' / ' + x.hs3_전체
      + ' | ' + (x.hs3_마지막 || '없음')
      + ' | ' + x.hs4 + '(' + x.hs4_안겹침 + ')'
      + ' | ' + String(x.꼴 || '').replace(/\|/g, '/').slice(0, 26)
      + ' | ' + String(x.주소 || '').slice(0, 52)
      + ' | ' + String(x.사이트주소 || x.채용주소 || '(없음)').replace(/\|/g, '/').slice(0, 52) + ' |');
  }
  줄.push('');
}
fs.writeFileSync(path.join(뿌리, 'docs', 'HS3진단_1024.md'), 줄.join('\n') + '\n', 'utf8');
fs.writeFileSync(path.join(뿌리, 'docs', 'HS3진단_1024.json'),
  JSON.stringify({ 잰때: 때, 며칠, 셈, 목록: 낸것 }, null, 1) + '\n', 'utf8');
console.log('\n○ docs/HS3진단_1024.md · .json 에 적었습니다');
