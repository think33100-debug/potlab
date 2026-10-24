/* ★ 사각지대 456곳의 **홈페이지 주소**를 심평원 자료(hira_org.hosp_url)에서 채웁니다
 * (2026-10-24 세중님 3번 ⓐ)
 *
 *   node tools/사각지대_주소채우기.mjs                봅니다 (마른 · 열어 보기까지)
 *   node tools/사각지대_주소채우기.mjs --진짜          기관 표에 담습니다
 *   node tools/사각지대_주소채우기.mjs --몇개 40       앞 40곳만
 *
 * ── ★ 어제 제가 틀리게 보고했습니다 ────────────────────────
 * 「사각지대 456곳은 기관 표·심평원 hosp_url·병원사이트표를 다 대 봤고 주소가 있는 곳이
 * **0곳**」 이라고 적었습니다. **틀렸습니다.** 그때 심평원 주소를 **기관 표를 거쳐**
 * (`기관.ykiho → hira_org.ykiho`) 봤는데, **사각지대 기관은 기관 표에 줄이 없습니다.**
 * 그래서 심평원 주소에 닿지도 못한 것입니다.
 *
 *   이름열쇠로 **바로** 이어 보니 — 456곳 가운데 **292곳에 심평원 홈페이지 주소가 있습니다**
 *   (보건기관 193 · 공공보건의료 64 · 종합병원 30 · 대학병원 3 · 상급종합 2)
 *
 * ── 울타리 (짐작 금지 · 지침 3·10-3절) ──────────────────────
 *   ① 이름열쇠가 심평원에 **여러 줄**이면 건너뜁니다 (어느 병원 주소인지 모릅니다)
 *   ② 주소를 **열어 봅니다** — HTTP 200 이 아니면 담지 않습니다
 *   ③ **그 기관이 맞는지** 봅니다 — 쪽에 ㉠ 심평원 전화번호가 있거나 ㉡ 기관 이름의
 *      속뜻 글자(법인·종별 말을 뗀 것)가 있어야 합니다. 둘 다 없으면 **담지 않습니다**
 *   ④ 담을 때 근거를 남깁니다 — `불변근거.홈페이지 = '심평원 hosp_url · 열어서 확인 (…)'`
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 전화숫자, 쪽글, 속뜻글자, 흔한말, 고유글자, 맞나 } from './주소맞나.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 500) || 500;

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('속뜻글자 — 법인말·괄호를 뗀다',
    속뜻글자('(의)환명의료재단 경상남도립김해노인전문병원') === '환명 경상남 김해노인전문병원');
  보('속뜻글자 — 도립을 뗀다', 속뜻글자('강원특별자치도립 강릉요양병원').includes('강릉요양병원'));
  보('전화가 같으면 맞다', 맞나('<p>대표전화 055-759-7777</p>', '아무개병원', '055-759-7777').됨);
  보('이름 글자가 있으면 맞다', 맞나('<h1>포항의료원 입니다</h1>', '경상북도포항의료원', '').됨);
  보('둘 다 없으면 아니다', !맞나('<p>어서 오세요</p>', '포항의료원', '054-000-0000').됨);
  보('세 글자로는 안 맞춘다', !맞나('<p>의료원</p>', '포항의료원', '').됨);
  보('흔한 종별 말만으로는 안 맞춘다',
    !맞나('<h1>○○노인전문병원</h1>', '천안시립노인전문병원', '').됨);
  보('지역이 붙으면 맞춘다',
    맞나('<h1>천안노인전문병원 누리집</h1>', '천안시립노인전문병원', '').됨);
  보('고유글자 — 흔한 말을 뺀다', 고유글자('노인전문병원') === '' && 고유글자('나주병원') === '나주');
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
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '사각주소_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/* ── 대상 — 사각지대 가운데 심평원 주소가 **딱 한 줄**인 곳 ── */
const 줄들 = psql(`
  with s as (
    select g."갈래", g."종류", g."기관", coalesce(g."시도",'') as 시도, coalesce(g."시군구",'') as 시군구,
           hira_name_key(g."기관") as k
      from "일층병원_구멍"() g where g."상태" = '사각지대'
  )
  /* ★ UNION 뒤에는 order by 에 식을 못 씁니다 (칸 이름만) — 바깥에서 차례를 줍니다 */
  select * from (
  /* ⓐ 심평원 hosp_url — 주소가 **딱 한 줄**일 때만 */
  select s."갈래", s."기관", s.시도, s.시군구, o.ykiho, o.yadm_nm, o.hosp_url,
         coalesce(o.tel,''), coalesce(o.addr,''), coalesce(o.cl_cd,''), coalesce(o.cl_cd_nm,''),
         coalesce(o.sido_nm,''), coalesce(o.sggu_nm,''),
         (select count(*) from 기관 q where q."기관번호" = 'HIRA:' || o.ykiho) as 기관표에있나,
         '심평원 hosp_url' as 어디서
    from s
    join hira_org o on o.name_key = s.k
   where coalesce(o.hosp_url,'') <> ''
     and (select count(*) from hira_org h where h.name_key = s.k and coalesce(h.hosp_url,'') <> '') = 1
  union all
  /* ⓒ 공공보건의료기관 현황표(public_hospitals)의 homepage — 심평원에 주소가 **없을 때만**.
     ★ 요양기관번호는 심평원에서 가져옵니다 (기관 표의 열쇠라 꼭 필요합니다) —
       심평원 줄이 **딱 하나**인 곳만 받습니다 (어느 병원인지 모르면 안 담습니다) */
  select s."갈래", s."기관", s.시도, s.시군구, o.ykiho, o.yadm_nm, btrim(p.homepage),
         coalesce(nullif(o.tel,''), coalesce(p.tel,'')), coalesce(o.addr, coalesce(p.addr,'')),
         coalesce(o.cl_cd,''), coalesce(o.cl_cd_nm,''), coalesce(o.sido_nm,''), coalesce(o.sggu_nm,''),
         (select count(*) from 기관 q where q."기관번호" = 'HIRA:' || o.ykiho) as 기관표에있나,
         '공공표 homepage' as 어디서
    from s
    join hira_org o on o.name_key = s.k
    join public_hospitals p on hira_name_key(p.name) = s.k
   where coalesce(btrim(p.homepage),'') <> ''
     and (select count(*) from hira_org h where h.name_key = s.k and coalesce(h.hosp_url,'') <> '') = 0
     and (select count(*) from hira_org h where h.name_key = s.k) = 1
     and (select count(*) from public_hospitals q where hira_name_key(q.name) = s.k
            and coalesce(btrim(q.homepage),'') <> '') = 1
  ) t
   order by case t."갈래" when '상급종합' then 1 when '대학병원' then 2 when '종합병원' then 3
                          when '공공보건의료' then 4 else 5 end, t."기관"
   limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));

console.log('심평원 주소가 **딱 한 줄**인 사각지대 ' + 줄들.length + '곳 — 열어서 확인합니다 (한 집 0.8초)');

const 담을것 = []; const 못쓴것 = [];
for (const [갈래, 기관, 시도, 시군구, ykiho, 심이름, 주소0, 전화, 심주소, cl, cl이름, 심시도, 심시군구, 있나, 어디서] of 줄들) {
  const 주소 = /^https?:\/\//i.test(주소0) ? 주소0 : 'http://' + 주소0;
  /* ★ 2026-10-24 밤 — 심평원 주소가 **옛 길**일 때가 많습니다. 경주시·익산시는 심평원
     주소로는 안 열리는데 **같은 집의 뿌리 주소**(https://host/)는 200 입니다.
     그래서 ① 적힌 주소 ② https 로 바꾼 것 ③ **같은 집의 뿌리** 를 차례로 두드립니다.
     ★ 다른 집으로 가지 않고, **봇 검사를 우회하지도 않습니다** — 우리 이름(User-Agent)
       그대로이고, 403·404 면 그냥 손확인 길로 보냅니다 (지침 · 우회 금지) */
  const 시도들 = [...new Set([주소,
    주소.replace(/^http:/i, 'https:'),
    (() => { try { return new URL(주소).origin + '/'; } catch { return ''; } })(),
    (() => { try { return 'https://' + new URL(주소).host + '/'; } catch { return ''; } })(),
  ].filter(Boolean))];
  let r = null; let html = ''; let 마지막왜 = '';
  for (const 시도 of 시도들) {
    try {
      const rr = await fetch(시도, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob-collector/1.0; +https://potjob.co.kr)' },
        signal: AbortSignal.timeout(15000), redirect: 'follow' });
      await new Promise((z) => setTimeout(z, 800));
      if (!rr.ok) { 마지막왜 = 'HTTP ' + rr.status; continue; }
      r = rr; html = await rr.text();
      break;
    } catch (e) {
      마지막왜 = '못 열었음 (' + String((e.cause && e.cause.code) || e.message).slice(0, 24) + ')';
      await new Promise((z) => setTimeout(z, 800));
    }
  }
  if (!r) {
    못쓴것.push({ 기관, 주소, 왜: 마지막왜 || '못 열었음' });
    console.log('  ✗ ' + 기관.slice(0, 22).padEnd(23) + 마지막왜 + ' (' + 시도들.length + '가지 길)');
    continue;
  }
  const 봄 = 맞나(html, 기관, 전화);
  if (!봄.됨) {
    못쓴것.push({ 기관, 주소, 왜: '그 기관인지 못 맞춤' });
    console.log('  · ' + 기관.slice(0, 22).padEnd(23) + '열렸는데 **그 기관인지 못 맞춥니다** → 안 담습니다');
    continue;
  }
  담을것.push({ 갈래, 기관, 시도, 시군구, ykiho, 심이름, 주소: r.url || 주소, 전화, 심주소, 어디서,
    cl, cl이름, 심시도, 심시군구, 있나: +있나, 왜: 봄.왜 });
  console.log('  ○ ' + 기관.slice(0, 22).padEnd(23) + (r.url || 주소).slice(0, 44).padEnd(45) + 봄.왜);
}

console.log('\n담을 것 ' + 담을것.length + '곳 (기관 표에 줄 있음 '
  + 담을것.filter((x) => x.있나).length + ' · 새로 만들 줄 ' + 담을것.filter((x) => !x.있나).length + ')'
  + ' · 못 쓴 것 ' + 못쓴것.length + '곳');
const 왜셈 = {};
for (const x of 못쓴것) 왜셈[x.왜.replace(/\(.*/, '').trim()] = (왜셈[x.왜.replace(/\(.*/, '').trim()] || 0) + 1;
console.log('  못 쓴 까닭 — ' + Object.entries(왜셈).map(([k, v]) => k + ' ' + v).join(' · '));

fs.writeFileSync(path.join(뿌리, 'docs', '사각지대_주소_1024.json'),
  JSON.stringify({ 잰때: new Date().toISOString().slice(0, 16).replace('T', ' '),
    담을것, 못쓴것 }, null, 1) + '\n', 'utf8');
console.log('○ docs/사각지대_주소_1024.json 에 적었습니다');

if (!진짜) { console.log('\n[마른] 기관 표에 안 담았습니다 — --진짜 로 담습니다'); process.exit(0); }

/* ── 되돌림 ── */
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());
const 오늘 = String(d.getFullYear()) + '-' + 두(d.getMonth() + 1) + '-' + 두(d.getDate());
const 되돌림 = path.join(되돌림터, '사각지대주소_되돌리기_' + 때 + '.sql');
const 되돌림줄 = ['/* 되돌리기 — 사각지대 주소 채우기 (2026-10-24) */'];
let 새줄 = 0; let 고친줄 = 0;
for (const x of 담을것) {
  const 번호 = 'HIRA:' + x.ykiho;
  if (x.있나) {
    const 전 = psql(`select coalesce("홈페이지",''), coalesce("불변근거"->>'홈페이지','')
                       from 기관 where "기관번호" = '${따옴(번호)}';`).split('\t');
    되돌림줄.push(`update 기관 set "홈페이지" = ${전[0] ? "'" + 따옴(전[0]) + "'" : 'null'} `
      + `where "기관번호" = '${따옴(번호)}';`);
    psql(`update 기관
             set "홈페이지" = '${따옴(x.주소)}',
                 "불변근거" = coalesce("불변근거",'{}'::jsonb)
                   || jsonb_build_object('홈페이지', '${따옴(x.어디서)} · 열어서 확인 ${오늘} (${따옴(x.왜)})'),
                 "고친때" = now()
           where "기관번호" = '${따옴(번호)}' and coalesce("홈페이지",'') = '';`);
    고친줄++;
  } else {
    되돌림줄.push(`delete from 기관 where "기관번호" = '${따옴(번호)}';   -- 새로 만든 줄`);
    psql(`insert into 기관 ("기관번호", 이름, 이름키, ykiho, "시도", "시군구", "종별", "종별이름",
             "주소", "전화", "홈페이지", "불변근거", "올린때", "메모")
           values ('${따옴(번호)}', '${따옴(x.심이름)}', hira_name_key('${따옴(x.심이름)}'),
             '${따옴(x.ykiho)}', ${x.심시도 ? "'" + 따옴(x.심시도) + "'" : 'null'},
             ${x.심시군구 ? "'" + 따옴(x.심시군구) + "'" : 'null'},
             ${x.cl ? "'" + 따옴(x.cl) + "'" : 'null'},
             ${x.cl이름 ? "'" + 따옴(x.cl이름) + "'" : 'null'},
             ${x.심주소 ? "'" + 따옴(x.심주소) + "'" : 'null'},
             ${x.전화 ? "'" + 따옴(x.전화) + "'" : 'null'},
             '${따옴(x.주소)}',
             jsonb_build_object('홈페이지', '${따옴(x.어디서)} · 열어서 확인 ${오늘} (${따옴(x.왜)})',
                                '주소', '심평원 addr', '전화', '심평원 tel'),
             now(), '사각지대 주소 채우기 ${오늘} — 1층 ${따옴(x.갈래)}')
           on conflict ("기관번호") do nothing;`);
    새줄++;
  }
}
fs.writeFileSync(되돌림, 되돌림줄.join('\n') + '\n', 'utf8');
console.log('\n○ 새로 만든 줄 ' + 새줄 + ' · 홈페이지 채운 줄 ' + 고친줄 + ' · 되돌림 ' + 되돌림);
console.log('\n── 후 · 기관 표 ──\n' + psql(`
  select count(*) || '줄 · 홈페이지 있음 ' || count("홈페이지")
         || ' · 심평원 hosp_url 근거 '
         || count(*) filter (where "불변근거"->>'홈페이지' like '심평원 hosp_url%')
         || ' · 공공표 homepage 근거 '
         || count(*) filter (where "불변근거"->>'홈페이지' like '공공표 homepage%')
    from 기관;`));
