/* 사각지대 1층 기관을 **셋으로 갈라** 적습니다 (2026-10-24 세중님 7번)
 *
 *   node tools/사각지대_분류_1024.mjs                전부 (기본 · 읽기만)
 *   node tools/사각지대_분류_1024.mjs --몇개 40       몇 곳만
 *   node tools/사각지대_분류_1024.mjs --자기점검
 *
 * ── 갈래 (세중님 7번) ───────────────────────────────────────
 *   ① HTML 게시판    우리가 긁습니다 — 쪽 글에 **공고 목록**이 보입니다
 *   ② 막힌 것        JS 렌더링 · 로그인 · 봇검사 · 배포용 HWP 뿐 → **개발자 미팅 안건**
 *   ③ 공고 안 올림   쪽은 열리는데 채용 게시판·글이 없습니다 → 손확인
 *   그밖             주소 없음 · robots 금지 · 못 열었음 (근거를 적습니다)
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 * ★ **실제로 연 것만** 적습니다. 짐작으로 갈래를 정하지 않습니다 (지침 3·10절).
 * ★ `robots.txt` 를 먼저 읽고 **금지면 두드리지 않습니다** (tools/robots.mjs).
 * ★ 같은 집은 **3.5초**, 다른 집은 0.8초 띄웁니다 (지침).
 * ★ 주소는 **기관 표(기관번호 기준)**에서만 옵니다 — 채용페이지 → 홈페이지 순.
 *   없으면 「주소 없음」입니다. 지어내지 않습니다.
 * ★ 아무것도 바꾸지 않습니다. 결과를 docs/사각지대_분류_1024.json 에 적습니다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { robots읽기, 가도되나 } from './robots.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 9999) || 9999;
/* ★ 2026-10-24 — 상태 셋입니다 (일층병원_구멍) —
     사각지대 456곳    **주소를 모르는 곳**입니다. 열어 볼 거리가 없습니다
                       (기관 표·심평원·사이트표 어디에도 주소가 없습니다 — 0곳 확인)
     사이트있음 301곳  **사이트표에 줄이 있는 곳 = HS3 가 이미 긁는 곳**입니다
                       ★ 2026-10-24 밤 정정 — 「공고가 안 들어오는 곳」이 아닙니다.
                       함수가 `사이트` 를 `들어옴` 보다 **먼저** 보므로 공고가 잘
                       들어오는 곳도 여기로 찍힙니다 (docs/HS3진단_1024.md)
     공고만들어옴 20곳  이미 들어옵니다
   그래서 기본은 「사이트있음」입니다. `--상태 사각지대` 로 바꿀 수 있습니다. */
const 상태고름 = argv.includes('--상태') ? argv[argv.indexOf('--상태') + 1] : '사이트있음';

/* ── 갈래 가리기 (자기점검이 보는 자리) ───────────────────── */
export const 봇검사꼴 = /cf-browser-verification|cf_chl_|recaptcha|hcaptcha|captcha|보안문자|자동입력\s*방지|Incapsula|imperva|AWSALB.*challenge/i;
export const 로그인꼴 = /로그인\s*(?:이|후|하신)|회원\s*(?:가입|로그인)|login\s*required|인증서\s*로그인|아이디\s*(?:저장|찾기)/i;
export const 게시판꼴 = /bbs|board|게시판|notice|공고\s*(?:목록|번호)|list\.do|selectBbs|articleList|lmxsrl|wr_id/i;
export const 공고글꼴 = /채\s*용|모\s*집|공\s*고|구\s*인|인\s*재/;
export const 배포HWP꼴 = /\.hwp(?:x)?["'\s>]|한글\s*뷰어|hwp\s*viewer/i;

/** 쪽 글·링크·script 양으로 갈래를 정합니다. **본 것만** 근거로 씁니다 */
export function 갈래가리기({ 코드, html, 글자수, 링크수, 게시판링크수, 스크립트비율 }) {
  if (코드 >= 400) return { 갈래: '그밖', 왜: 'HTTP ' + 코드 };
  if (봇검사꼴.test(html)) return { 갈래: '②막힘', 왜: '봇검사' };
  if (로그인꼴.test(html) && 글자수 < 1500) return { 갈래: '②막힘', 왜: '로그인 요구' };
  /* JS 렌더링 — 글자는 거의 없는데 script 가 쪽의 대부분입니다 */
  if (글자수 < 400 && 스크립트비율 > 0.5) return { 갈래: '②막힘', 왜: 'JS 렌더링 (글자 ' + 글자수 + '자)' };
  if (게시판링크수 > 0 && 공고글꼴.test(html)) {
    return { 갈래: '①HTML게시판', 왜: '게시판 링크 ' + 게시판링크수 + '개 · 채용말 있음' };
  }
  if (게시판꼴.test(html) && 공고글꼴.test(html) && 글자수 >= 400) {
    return { 갈래: '①HTML게시판', 왜: '게시판 꼴 + 채용말 (글자 ' + 글자수 + '자)' };
  }
  if (배포HWP꼴.test(html) && !게시판링크수) return { 갈래: '②막힘', 왜: '배포용 HWP 뿐' };
  if (글자수 >= 400 && !공고글꼴.test(html)) return { 갈래: '③안올림', 왜: '쪽은 열리는데 채용말이 없음' };
  if (글자수 >= 400) return { 갈래: '③안올림', 왜: '채용 게시판·목록이 안 보임' };
  return { 갈래: '그밖', 왜: '글자 ' + 글자수 + '자 · 링크 ' + 링크수 + '개 — 가릴 거리가 모자람' };
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 기본 = { 코드: 200, html: '', 글자수: 2000, 링크수: 30, 게시판링크수: 0, 스크립트비율: 0.1 };
  보('봇검사를 집는다', 갈래가리기({ ...기본, html: '<div class="cf-browser-verification">' }).갈래 === '②막힘');
  보('로그인 요구를 집는다',
    갈래가리기({ ...기본, 글자수: 300, html: '회원 로그인 후 이용하세요' }).갈래 === '②막힘');
  보('JS 렌더링을 집는다',
    갈래가리기({ ...기본, 글자수: 120, 스크립트비율: 0.8, html: '<script>app()</script>' }).갈래 === '②막힘');
  보('게시판 링크가 있으면 ①',
    갈래가리기({ ...기본, 게시판링크수: 3, html: '채용 공고 목록 bbs' }).갈래 === '①HTML게시판');
  보('게시판 꼴 + 채용말이면 ①',
    갈래가리기({ ...기본, html: '<a href="/bbs/list.do">채용 안내</a>' }).갈래 === '①HTML게시판');
  보('채용말이 없으면 ③',
    갈래가리기({ ...기본, html: '병원 소개 진료과 안내 오시는 길' }).갈래 === '③안올림');
  보('HTTP 403 은 그밖', 갈래가리기({ ...기본, 코드: 403 }).갈래 === '그밖');
  보('배포용 HWP 뿐이면 ②',
    갈래가리기({ ...기본, 게시판링크수: 0, html: '<a href="/down/서식.hwp">서식</a>' }).갈래 === '②막힘');
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ── 목록 받기 (psql · 기관 번호 기준) ───────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (!cfg.SUPABASE_DB_URL) { console.error('✗ SUPABASE_DB_URL 이 없습니다'); process.exit(1); }
const u = new URL(cfg.SUPABASE_DB_URL);
const env = {
  ...process.env,
  PGHOST: u.hostname, PGPORT: u.port || '5432',
  PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password),
  PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  PGSSLMODE: u.searchParams.get('sslmode') || 'require',
};
function psql(sql) {
  const 임시 = path.join(os.tmpdir(), '사각분류_' + process.pid + '.sql');
  fs.writeFileSync(임시, sql, 'utf8');
  const r = spawnSync('psql', ['-X', '-A', '-t', '-q', '-F', '\t', '-v', 'ON_ERROR_STOP=1', '-f', 임시],
    { encoding: 'utf8', maxBuffer: 1 << 28, env });
  fs.unlinkSync(임시);
  if (r.status) { console.error('✗ psql\n' + (r.stderr || '').slice(0, 900)); process.exit(1); }
  return (r.stdout || '').trimEnd();
}

const 줄들 = psql(`
  select g."갈래", g."종류", g."기관", coalesce(g."시도",''), coalesce(g."시군구",''),
         coalesce(o."기관번호",''), coalesce(o."채용페이지",''), coalesce(o."홈페이지",''),
         coalesce(h.hosp_url,''), coalesce(s.url,'')
    from "일층병원_구멍"() g
    /* ★ 2026-10-24 세중님 ㉫ — **번호로** 잇습니다. 이름키로 이으면 같은 이름 다른
       병원에서 엉뚱한 줄이 붙습니다 (한일병원: 서울 한전 → 진주 줄) */
    left join 기관 o on o."기관번호" = "기관번호_이름으로"(g."기관")
    left join hira_org h on h.ykiho = o.ykiho
    left join hosp_sites s on s."이름열쇠" = o.이름키 and coalesce(s."끔", false) = false
   where g."상태" = '${상태고름}'
   order by g."갈래", g."기관";`).split('\n').filter(Boolean).map((l) => {
  const [갈래, 종류, 기관, 시도, 시군구, 기관번호, 채용페이지, 홈페이지, 심평원주소, 사이트표] = l.split('\t');
  return { 갈래, 종류, 기관, 시도, 시군구, 기관번호, 채용페이지, 홈페이지, 심평원주소, 사이트표 };
});
console.log('사각지대 1층 ' + 줄들.length + '곳 (일층병원_구멍 · 기관 번호로 이어 봤습니다)');
const 주소있는것 = 줄들.filter((x) => x.채용페이지 || x.홈페이지 || x.심평원주소 || x.사이트표);
console.log('주소가 있는 곳 ' + 주소있는것.length + '곳 · 주소 없는 곳 '
  + (줄들.length - 주소있는것.length) + '곳 (손확인으로 넘깁니다)\n');

/* ── 열어 봅니다 ─────────────────────────────────────────── */
const UA = 'Mozilla/5.0 (compatible; potjob-check/1.0; +https://potjob.co.kr)';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const robots표 = new Map();
const 집마다 = new Map();
const 낸것 = [];
let 본것 = 0;

for (const x of 주소있는것.slice(0, 몇개)) {
  const 주소 = x.채용페이지 || x.사이트표 || x.홈페이지 || x.심평원주소;
  const 어디서 = x.채용페이지 ? '기관표 채용페이지' : x.사이트표 ? '병원사이트표'
    : x.홈페이지 ? '기관표 홈페이지' : '심평원 hosp_url';
  let 집;
  try { 집 = new URL(주소.startsWith('http') ? 주소 : 'http://' + 주소).host; }
  catch { 낸것.push({ ...x, 주소, 어디서, 갈래: '그밖', 왜: '주소 꼴이 아님' }); continue; }

  /* 같은 집 틈 */
  const 앞때 = 집마다.get(집) || 0;
  const 기다림 = Math.max(0, (집마다.has(집) ? 3500 : 800) - (Date.now() - 앞때));
  if (기다림) await 자고(기다림);
  집마다.set(집, Date.now());

  /* robots */
  if (!robots표.has(집)) {
    try {
      const rr = await fetch('https://' + 집 + '/robots.txt', { headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(12000), redirect: 'follow' });
      robots표.set(집, rr.ok ? robots읽기(await rr.text()) : null);
    } catch { robots표.set(집, null); }
    await 자고(500);
  }
  const rb = robots표.get(집);
  const 길 = (() => { try { return new URL(주소.startsWith('http') ? 주소 : 'http://' + 주소).pathname; } catch { return '/'; } })();
  if (rb) {
    const 됨 = 가도되나(rb, 길);
    if (!됨.됨) { 낸것.push({ ...x, 주소, 어디서, 갈래: '그밖', 왜: 'robots 금지 (' + 됨.왜 + ')' }); continue; }
  }

  본것++;
  try {
    const r = await fetch(주소.startsWith('http') ? 주소 : 'http://' + 주소,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
        signal: AbortSignal.timeout(20000), redirect: 'follow' });
    const html = (await r.text()).slice(0, 400000);
    const 스크립트 = (html.match(/<script[\s\S]*?<\/script>/gi) || []).join('').length;
    const 글 = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const 링크 = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    /* ★ 2026-10-24 — **붙박이 파일(css·js·그림)을 뺍니다.** 안 빼면
       `/skin/board/css/default.css` 같은 것이 「게시판 링크」로 잡혀, 근거 줄에
       뜬금없는 스타일시트가 적힙니다 (첫 판에서 ① 근거가 다 그 꼴이었습니다) */
    const 붙박이 = /\.(?:css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|map)(?:[?#]|$)/i;
    const 게시판링크 = 링크.filter((l) => 게시판꼴.test(l) && !붙박이.test(l));
    const 판 = 갈래가리기({ 코드: r.status, html, 글자수: 글.length, 링크수: 링크.length,
      게시판링크수: 게시판링크.length, 스크립트비율: html.length ? 스크립트 / html.length : 0 });
    낸것.push({ ...x, 주소, 어디서, 끝주소: r.url, 코드: r.status, 글자수: 글.length,
      링크수: 링크.length, 게시판링크: 게시판링크.slice(0, 2), ...판 });
  } catch (e) {
    낸것.push({ ...x, 주소, 어디서, 갈래: '그밖', 왜: '못 열었음 (' + String(e.message).slice(0, 40) + ')' });
  }
  if (본것 % 25 === 0) console.log('  ' + 본것 + '곳 봤습니다…');
}
for (const x of 줄들.filter((y) => !(y.채용페이지 || y.홈페이지 || y.심평원주소 || y.사이트표))) {
  낸것.push({ ...x, 주소: '', 어디서: '', 갈래: '그밖', 왜: '주소 없음 (기관 표·심평원·사이트표에 없습니다)' });
}

/* ── 셈 ─────────────────────────────────────────────────── */
const 셈 = new Map();
for (const x of 낸것) 셈.set(x.갈래, (셈.get(x.갈래) || 0) + 1);
console.log('\n══ 갈래별 ══');
for (const [k, v] of [...셈].sort((a, b) => b[1] - a[1])) console.log('  ' + k.padEnd(12) + v + '곳');
console.log('\n══ 왜(근거)별 — 많은 것부터 ══');
const 왜셈 = new Map();
for (const x of 낸것) {
  const k = x.갈래 + ' · ' + String(x.왜).replace(/\([^)]*\)/g, '').replace(/\d+/g, 'N').trim();
  왜셈.set(k, (왜셈.get(k) || 0) + 1);
}
for (const [k, v] of [...왜셈].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
  console.log('  ' + String(v).padStart(4) + '곳  ' + k);
}

const 낼곳 = path.join(여기, '..', 'docs', '사각지대_분류_1024.json');
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toLocaleString('sv-SE').replace('T', ' '),
  곳: 낸것.length, 실제로열어본곳: 본것, 목록: 낸것 }, null, 1) + '\n');
console.log('\n○ docs/사각지대_분류_1024.json 에 적었습니다 (실제로 연 곳 ' + 본것 + ')');
console.log('★ 아무것도 바꾸지 않았습니다.');
