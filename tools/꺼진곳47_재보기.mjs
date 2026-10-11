/* 「꺼진 것」으로 적힌 47곳을 **서버에서 fetch 로 전수 확인**합니다
 * (2026-10-12 밤 · 읽기만).
 *
 *   node tools/꺼진곳47_재보기.mjs [--쉼 3000]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * `hosp_sites.off_why` 가 47곳에 **「구글 서버에서 못 엶」** 한 가지로 적혀
 * 있습니다. 그런데 —
 *   · 그 칸을 **읽는 수집기 코드가 없습니다** (저장소 전체 grep — copy_jobs.js 뿐)
 *   · 그 47곳 중 **17곳에서 최근 30일 공고 34건이 들어왔습니다** (회원 화면 6건)
 *   · 우리는 2026-09-30 에 **Apps Script(구글) → Lightsail 서울**로 옮겼습니다
 * 즉 **묶은 쪽지**입니다. 「지금 어디가 안 되나」를 다시 재야 합니다.
 *
 * ── 예의 ────────────────────────────────────────────────────
 * 한 곳에 **목록 1쪽만**, 요청 사이 **3초**. 로그인·양식·올리기 없음.
 * 결과를 **한 곳 끝날 때마다** 파일에 적습니다 (끊겨도 이어갑니다).
 *
 * **DB 를 안 건드립니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 글받기 } from './certs/index.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 낼곳 = path.join(여기, '..', 'docs', '시험_playwright_1012', '꺼진곳47_fetch.json');
const argv = process.argv.slice(2);
const 쉼ms = Number(argv[argv.indexOf('--쉼') + 1]) || 3000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

async function 전부(길) {
  const 모두 = [];
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' HTTP ' + r.status);
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) return 모두;
  }
}

/* 제대로 걷기 — <style>·주석까지 (hs_dates.js 의 hsText() 와 같게) */
const 걷기 = (h) => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

/* 「막힘」의 모양 — 막힌3곳.mjs 에서 본 그대로 */
function 막힘판정(code, 글, 왜) {
  if (왜) {
    if (/TIMEOUT/i.test(왜)) return { 막힘: true, 까닭: '접속 시간 초과' };
    if (/CERT|SSL|TLS/i.test(왜)) return { 막힘: true, 까닭: '인증서 오류' };
    return { 막힘: true, 까닭: '못 받음 · ' + String(왜).slice(0, 60) };
  }
  if (code === 403) return { 막힘: true, 까닭: 'HTTP 403 접속 차단' };
  if (code === 404) return { 막힘: true, 까닭: 'HTTP 404 주소 바뀜·폐쇄' };
  if (code >= 500) return { 막힘: true, 까닭: 'HTTP ' + code + ' 서버 탈' };
  if (code !== 200) return { 막힘: true, 까닭: 'HTTP ' + code };
  if (글.length < 200) return { 막힘: true, 까닭: 'HTTP 200 인데 ' + 글.length + '자 (한국만·차단문)' };
  if (/한국에서만|접근\s*불가|차단되었|Access Denied|Forbidden/i.test(글)) {
    return { 막힘: true, 까닭: 'HTTP 200 인데 차단 문구' };
  }
  return { 막힘: false, 까닭: '' };
}

/* 대행 사이트 자국 */
const 대행 = [
  [/incruit\.com/i, '인크루트'], [/saramin\.co\.kr/i, '사람인'],
  [/jobkorea\.co\.kr/i, '잡코리아'], [/greetinghr\.com/i, '그리팅'],
  [/recruiter\.co\.kr/i, '리크루터'], [/midasweb|midasin/i, '마이다스'],
  [/jobda\.im/i, '잡다'], [/applyin/i, '어플라이인'],
];

const 곳들 = (await 전부('hosp_sites?select=name,url,base,kind,off_why,note&order=name.asc'))
  .filter((x) => x.off_why && x.off_why.trim());
console.log('「꺼진 것」으로 적힌 곳 ' + 곳들.length + '곳 · 요청 사이 ' + (쉼ms / 1000) + '초\n');

/* 이어하기 — 이미 본 것은 건너뜁니다 */
let 쌓인것 = {};
if (fs.existsSync(낼곳)) {
  try { 쌓인것 = JSON.parse(fs.readFileSync(낼곳, 'utf8')); } catch { 쌓인것 = {}; }
}
console.log('이미 본 곳 ' + Object.keys(쌓인것).length + '곳 — 건너뜁니다\n');

const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));
let 열림 = 0; let 막힘 = 0;

for (const 곳 of 곳들) {
  if (쌓인것[곳.name]) { if (쌓인것[곳.name].막힘) 막힘++; else 열림++; continue; }
  if (!곳.url) {
    쌓인것[곳.name] = { 주소: null, 막힘: true, 까닭: '주소가 없습니다', 판정: '불가 — 주소 먼저' };
    fs.writeFileSync(낼곳, JSON.stringify(쌓인것, null, 1));
    console.log('  ' + 곳.name.slice(0, 24).padEnd(26) + '주소 없음');
    막힘++;
    continue;
  }

  const t0 = Date.now();
  let g;
  try { g = await 글받기(곳.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, enc: 곳.enc }); }
  catch (e) { g = { code: 0, 왜: String(e.message).slice(0, 80), html: '' }; }
  const 초 = Math.round((Date.now() - t0) / 100) / 10;
  const 글 = 걷기(g.html);
  const p = 막힘판정(g.code, 글, g.왜);

  /* 대행 사이트로 보내는가 */
  const 대행자국 = 대행.find(([re]) => re.test(String(g.html || '')) || re.test(곳.url));
  /* 우리 직군 말이 목록에 보이나 */
  const 우리말 = /(물리|작업)\s*치료사/.test(글);
  const 공고말 = (글.match(/채용|모집|공고/g) || []).length;

  const 판정 = p.막힘
    ? (대행자국 ? '대행 사이트 주소로 교체 — ' + 대행자국[1] : '브라우저 또는 불가 — ' + p.까닭)
    : 'fetch 로 충분';

  쌓인것[곳.name] = {
    주소: 곳.url, HTTP: g.code, 초, 글자: 글.length,
    막힘: p.막힘, 까닭: p.까닭,
    대행: 대행자국 ? 대행자국[1] : null,
    우리직군말: 우리말, 공고말수: 공고말,
    판정,
    앞120: 글.slice(0, 120),
  };
  fs.writeFileSync(낼곳, JSON.stringify(쌓인것, null, 1));

  if (p.막힘) 막힘++; else 열림++;
  console.log('  ' + 곳.name.slice(0, 24).padEnd(26)
    + (p.막힘 ? '✗ ' : '○ ')
    + 'HTTP ' + String(g.code).padStart(3)
    + ' · ' + String(글.length).padStart(6) + '자'
    + ' · ' + String(초).padStart(5) + '초'
    + (우리말 ? ' · 우리직군 ○' : '')
    + (대행자국 ? ' · 대행 ' + 대행자국[1] : '')
    + (p.까닭 ? '  ' + p.까닭 : ''));

  await 쉼(쉼ms);
}

console.log('\n── 센 것 ───────────────────────────────────────────');
console.log('  열림 ' + 열림 + ' / 막힘 ' + 막힘 + '  (전체 ' + 곳들.length + ')');
const 갈래 = {};
for (const v of Object.values(쌓인것)) 갈래[v.판정] = (갈래[v.판정] ?? 0) + 1;
for (const [k, n] of Object.entries(갈래).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(3) + '곳  ' + k);
}
console.log('\n결과 → ' + path.relative(path.join(여기, '..'), 낼곳));
console.log('DB 를 안 건드렸습니다.');
