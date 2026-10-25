/* 채용 게시판 찾기 **보강** — ⓐ robots 의 Sitemap · ⓑ 손으로 넣은 후보 (2026-10-25 세중님 2번)
 *
 *   node tools/긁기/채용게시판_보강.mjs --사이트맵 --몇개 40        ⓐ 봅니다 (마른)
 *   node tools/긁기/채용게시판_보강.mjs --사이트맵 --몇개 40 --진짜  ⓐ 담습니다
 *   node tools/긁기/채용게시판_보강.mjs --후보 tmp/후보.json --진짜   ⓑ 담습니다
 *
 * ── ⓐ Sitemap (짐작 아님) ───────────────────────────────────
 * **robots.txt 에 기관이 직접 적어 둔 `Sitemap:` 줄만** 읽습니다. 주소를 지어내지
 * 않습니다 (지침 3절). 그 안에서 `recruit·채용·job·인사·employ` 꼴 주소만 후보로 봅니다.
 *
 * ── ⓑ 손으로 넣은 후보 ─────────────────────────────────────
 * 웹 검색 결과 가운데 **그 기관 도메인과 같은 집**인 주소만 적은 파일을 받습니다.
 *   [{ "기관번호": "HIRA:…", "후보": ["https://같은집/recruit"] }, …]
 * 도메인이 기관 표 홈페이지와 **다르면 건너뜁니다** (이 파일이 울타리입니다).
 *
 * ── 둘 다 지나야 담습니다 ───────────────────────────────────
 *   ① robots 가 그 길을 막지 않았나 · 같은 집 3.5초 (공통.mjs)
 *   ② HTTP 200 이고 ③ **채용 게시판 꼴**인가 —
 *      `표준읽기` 로 줄이 나오거나, 쪽 글에 **날짜 꼴 3개 이상 + 「채용·모집」 글자**가 있어야 합니다
 *   ④ 담을 때 근거 — '사이트맵에서 찾음 <날짜> (…)' 또는 '검색 후보 확인 <날짜> (…)'
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { 가도되나집, 받기, 자고, UA } from './공통.mjs';
import { 표준읽기 } from './읽기들.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..', '..');
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 40) || 40;
const 후보파일 = argv.includes('--후보') ? argv[argv.indexOf('--후보') + 1] : '';

export const 채용주소꼴 = /(recruit|채용|chaeyong|job|jobs|employ|인사|hr|career)/i;
export const 날짜꼴 = /20\d\d[-.\/]\s?\d{1,2}[-.\/]\s?\d{1,2}/g;
/** 쪽이 **채용 게시판 꼴**인가 — 줄이 나오거나, 날짜 3개 + 채용 글자 */
export function 게시판꼴인가(html, 글, 주소) {
  const 줄 = 표준읽기(html, 주소) || [];
  if (줄.length) return { 됨: true, 왜: '목록 줄 ' + 줄.length + '개', 줄: 줄.length };
  const 날 = (String(글).match(날짜꼴) || []).length;
  const 말 = /(채용|모집|공고)/.test(String(글));
  if (날 >= 3 && 말) return { 됨: true, 왜: '날짜 ' + 날 + '개 + 채용 글자', 줄: 0 };
  return { 됨: false, 왜: '목록 줄 0 · 날짜 ' + 날 + '개' };
}
/** 같은 집인가 (www 는 봐줍니다) */
export const 같은집 = (a, b) => {
  const 집 = (x) => { try { return new URL(String(x).startsWith('http') ? x : 'http://' + x).host.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
  const A = 집(a); const B = 집(b);
  return !!A && !!B && (A === B || A.endsWith('.' + B) || B.endsWith('.' + A));
};

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('채용 주소 꼴을 잡는다', 채용주소꼴.test('/recruit/list.do') && 채용주소꼴.test('/board/채용'));
  보('엉뚱한 주소는 안 잡는다', !채용주소꼴.test('/intro/greeting'));
  보('같은 집 — www 봐줌', 같은집('https://www.a.or.kr/x', 'http://a.or.kr/'));
  보('같은 집 — 아래 집도 봐줌', 같은집('https://recruit.a.or.kr/', 'https://www.a.or.kr'));
  보('다른 집은 아님', !같은집('https://b.or.kr', 'https://a.or.kr'));
  보('날짜 셋 + 채용 글자면 게시판 꼴',
    게시판꼴인가('<p>x</p>', '채용 2026-10-01 2026-10-02 2026-10-03', 'https://a.or.kr/').됨);
  보('날짜만 둘이면 아님',
    !게시판꼴인가('<p>x</p>', '채용 2026-10-01 2026-10-02', 'https://a.or.kr/').됨);
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
  const 임시 = path.join(os.tmpdir(), '보강_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 26, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 800)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}
const 따옴 = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const d = new Date(); const 두 = (n) => String(n).padStart(2, '0');
const 오늘 = String(d.getFullYear()) + '-' + 두(d.getMonth() + 1) + '-' + 두(d.getDate());
const 때 = String(d.getFullYear()) + 두(d.getMonth() + 1) + 두(d.getDate()) + '_'
  + 두(d.getHours()) + 두(d.getMinutes()) + 두(d.getSeconds());

/** 담기 — 한 자리 */
const 담은것 = [];
function 담기(번호, 이름, 주소, 근거) {
  담은것.push({ 번호, 이름, 주소, 근거 });
  if (!진짜) return;
  psql(`update 기관
          set "채용페이지" = '${따옴(주소)}',
              "불변근거" = coalesce("불변근거",'{}'::jsonb)
                || jsonb_build_object('채용페이지', '${따옴(근거)}'),
              "고친때" = now()
        where "기관번호" = '${따옴(번호)}' and coalesce("채용페이지",'') = '';`);
}

/* ── ⓐ Sitemap ── */
if (argv.includes('--사이트맵')) {
  const 줄들 = psql(`
    select o."기관번호", o.이름, o."홈페이지"
      from 기관 o
     where coalesce(o."홈페이지",'') <> '' and coalesce(o."채용페이지",'') = ''
       and o."불변근거"->>'홈페이지' like '%열어서 확인%'
     order by case coalesce(o."종별이름",'')
                when '상급종합' then 1 when '종합병원' then 2 when '병원' then 3 else 4 end, o.이름
     limit ${몇개};`).split('\n').filter(Boolean).map((l) => l.split('\t'));
  console.log('ⓐ 사이트맵으로 찾기 — ' + 줄들.length + '곳\n');
  let 맵있음 = 0;
  for (const [번호, 이름, 홈] of 줄들) {
    let 뿌리주소 = '';
    try { 뿌리주소 = new URL(홈).origin; } catch { continue; }
    /* robots.txt 를 직접 읽습니다 — **그 안의 Sitemap 줄만** 씁니다 */
    let robots = '';
    try {
      const r = await fetch(뿌리주소 + '/robots.txt', { headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(12000), redirect: 'follow' });
      if (r.ok) robots = await r.text();
    } catch { /* 없으면 넘어갑니다 */ }
    await 자고(1200);
    const 맵들 = [...String(robots).matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 3);
    if (!맵들.length) { console.log('  · ' + 이름.slice(0, 20).padEnd(21) + 'robots 에 Sitemap 줄 없음'); continue; }
    맵있음++;
    let 후보 = [];
    for (const 맵 of 맵들) {
      try {
        const r = await fetch(맵, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const xml = await r.text();
        후보.push(...[...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1])
          .filter((x) => 채용주소꼴.test(decodeURIComponent(x))));
      } catch { /* 넘어갑니다 */ }
      await 자고(1200);
    }
    후보 = [...new Set(후보)].slice(0, 5);
    if (!후보.length) { console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '사이트맵에 채용 꼴 주소 없음'); continue; }
    let 정함 = null;
    for (const c of 후보) {
      const 됨 = await 가도되나집(c);
      if (!됨.됨) continue;
      const r = await 받기(c);
      await 자고(3500);
      if (!r.됨) continue;
      const 봄 = 게시판꼴인가(r.html, r.글, c);
      if (봄.됨) { 정함 = { 주소: r.주소 || c, 왜: 봄.왜 }; break; }
    }
    if (!정함) { console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '사이트맵 후보 ' + 후보.length + '개 — 게시판 꼴 아님'); continue; }
    담기(번호, 이름, 정함.주소, '사이트맵에서 찾음 ' + 오늘 + ' (' + 정함.왜 + ')');
    console.log('  ○ ' + 이름.slice(0, 20).padEnd(21) + 정함.주소.slice(0, 54) + '  ' + 정함.왜);
  }
  console.log('\nrobots 에 Sitemap 이 있던 곳 ' + 맵있음 + '곳 · **담은 곳 ' + 담은것.length + '곳**');
}

/* ── ⓑ 손으로 넣은 후보 ── */
if (후보파일) {
  const 받은것 = JSON.parse(fs.readFileSync(path.join(뿌리, 후보파일), 'utf8'));
  console.log('\nⓑ 손 후보 — ' + 받은것.length + '곳');
  for (const x of 받은것) {
    const 줄 = psql(`select 이름, coalesce("홈페이지",''), coalesce("채용페이지",'')
                       from 기관 where "기관번호" = '${따옴(x['기관번호'])}';`).split('\t');
    const [이름, 홈, 이미] = 줄;
    if (!이름) { console.log('  ✗ ' + x['기관번호'] + ' — 기관 표에 없습니다'); continue; }
    if (이미) { console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '이미 채용페이지가 있습니다'); continue; }
    let 정함 = null;
    for (const c of (x.후보 || []).slice(0, 4)) {
      if (!같은집(c, 홈)) { console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + '다른 집 — 건너뜁니다 (' + String(c).slice(0, 40) + ')'); continue; }
      const 됨 = await 가도되나집(c);
      if (!됨.됨) { console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + 'robots 금지'); continue; }
      const r = await 받기(c);
      await 자고(3500);
      if (!r.됨) { console.log('  ✗ ' + 이름.slice(0, 20).padEnd(21) + r.왜); continue; }
      const 봄 = 게시판꼴인가(r.html, r.글, c);
      if (봄.됨) { 정함 = { 주소: r.주소 || c, 왜: 봄.왜 }; break; }
      console.log('  · ' + 이름.slice(0, 20).padEnd(21) + '열렸는데 ' + 봄.왜);
    }
    if (!정함) continue;
    담기(x['기관번호'], 이름, 정함.주소, '검색 후보 확인 ' + 오늘 + ' (' + 정함.왜 + ')');
    console.log('  ○ ' + 이름.slice(0, 20).padEnd(21) + 정함.주소.slice(0, 54) + '  ' + 정함.왜);
  }
}

if (!담은것.length) { console.log('\n담을 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 기관 표에 안 담았습니다 — --진짜 로 담습니다'); process.exit(0); }
const 되돌림터 = path.join(os.homedir(), '되돌림');
fs.mkdirSync(되돌림터, { recursive: true });
const 되돌림 = path.join(되돌림터, '채용게시판보강_되돌리기_' + 때 + '.sql');
fs.writeFileSync(되돌림, ['/* 되돌리기 — 보강으로 담은 채용페이지를 비웁니다 */',
  ...담은것.map((x) => `update 기관 set "채용페이지" = null where "기관번호" = '${따옴(x.번호)}';`)].join('\n') + '\n', 'utf8');
console.log('\n○ 담은 곳 ' + 담은것.length + ' · 되돌림 ' + 되돌림);
console.log('\n── 후 · 기관 표 ──\n' + psql(`
  select count(*) || '줄 · 홈페이지 ' || count("홈페이지") || ' · 채용페이지 ' || count("채용페이지")
      || ' (홈페이지에서 ' || count(*) filter (where "불변근거"->>'채용페이지' like '홈페이지에서%')
      || ' · 사이트맵 ' || count(*) filter (where "불변근거"->>'채용페이지' like '사이트맵%')
      || ' · 검색 후보 ' || count(*) filter (where "불변근거"->>'채용페이지' like '검색 후보%') || ')'
    from 기관;`));
