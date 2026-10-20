/* 능력시험 — **형식별 견본 모으기** (ZIP · DOCX · XLSX · 그림) + 바로 읽어 보기
 *
 *   node tools/능력시험/형식모으기.mjs --쪽 120        쪽 120개를 열어 후보를 모읍니다
 *   node tools/능력시험/형식모으기.mjs --받기           모은 후보를 받아 읽어 봅니다
 *   node tools/능력시험/형식모으기.mjs --자기점검
 *
 * ── 왜 (2026-10-20 세중님) ─────────────────────────────────────
 * 「형식마다 실제 공고 첨부 10건 이상」이 기준입니다. 그런데
 *   · 우리 `job_attachments` 에는 zip 1줄 · docx 3줄 · 그림 1줄뿐입니다
 *     (수집기가 이 꼴을 **놓쳐서** 안 담긴 것입니다)
 *   · 표본 50건의 그림 4개는 전부 **쪽 꾸밈 그림**(「시신기증안내」)이었습니다
 * 그래서 **쪽을 열어** 후보를 모읍니다. 쪽에 걸린 것과 **본문 안 <img>** 를 함께 봅니다
 * (세중님 4번 — 「그림이 본문 안에 img 로만 들어간 공고도 같은 길로」).
 *
 * ★ 사이트 간격 3.5초 · 하루 뚜껑 300 (규칙 그대로).
 * ★ DB 에 아무것도 쓰지 않습니다. 받은 것은 `원문형식/` 아래에 둡니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부읽기, 진짜형식, 칸뽑기, 본문직군, 워커끝내기 } from '../공고문읽기.mjs';
import { 묶음갈래 } from '../묶음파일.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 쪽몇개 = Number(값('--쪽', 0));
const 받기 = argv.includes('--받기');
const 자기점검만 = argv.includes('--자기점검');

export const 간격ms = 3500;
export const 하루뚜껑 = 300;
const 낼곳 = path.join(여기, '원문형식');

/* ── 첨부로 볼 것 가리기 ─────────────────────────────────────── */
/* ★ 확장자 뒤에 `?` 말고 **`;` 와 `&`** 도 붙습니다 —
     `/a.pdf;jsessionid=AA` · `download.aspx?path=a.hwp&filename=…`
   `(\?|$|#)` 만 보면 이 둘을 통째로 놓칩니다 (2026-10-20 자기점검이 잡았습니다) */
export const 문서꼴 = /[.](pdf|hwpx?|docx?|xlsx?|pptx?|zip)([?&;]|$|#)/i;
export const 그림꼴 = /[.](jpe?g|png|webp|tiff?|gif)([?&;]|$|#)/i;
/* 쪽 꾸밈 그림은 뺍니다 — 「시신기증안내」 1.2MB 배너가 첨부로 세어졌습니다 */
export const 꾸밈길 = /\/(images?|img|assets?|static|skin|resources?|css|js|favicons?|icons?|thumb(nail)?s?|banner|common|layout|template|editor|_lib\/(?!modulesext))\//i;
export const 꾸밈이름 = /(logo|banner|btn|button|icon|bullet|arrow|bg_|_bg|top_|bottom_|menu|nav|sprite|blank|spacer|loading|quick|sns|facebook|instagram|youtube|kakao|naver|시신기증|비급여|진료시간|오시는길)/i;

/** 쪽 글자에서 첨부 후보를 모읍니다 — 갈래를 함께 적습니다 */
export function 후보들(html, 밑바탕) {
  const 엔티티 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  const 나온것 = [];
  const 본것 = new Set();
  const 보기 = (h0, 어디) => {
    const h = 엔티티(h0).trim();
    if (!h || /^(#|mailto|tel|javascript:)/i.test(h)) return;
    const 문서 = 문서꼴.test(h);
    const 그림 = 그림꼴.test(h);
    /* 내려받기 길처럼 확장자가 없는 것도 **본문 그림**은 아니니 여기서는 안 봅니다 */
    if (!문서 && !그림) return;
    if (그림 && !문서 && (꾸밈길.test(h) || 꾸밈이름.test(h))) return;
    let u;
    try { u = new URL(h, 밑바탕).href; } catch { return; }
    const 열쇠 = u.replace(/;jsessionid=[^?#]*/i, '');
    if (본것.has(열쇠)) return;
    본것.add(열쇠);
    나온것.push({ url: u, 갈래: 문서 ? '문서' : '그림', 어디 });
  };
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) 보기(m[1], 'href');
  /* ★ 본문 안 <img> — 공고가 그림 한 장인 곳이 있습니다 (세중님 4번) */
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) 보기(m[1], 'img');
  for (const m of html.matchAll(/on(?:click|Click)="([^"]*)"/g)) {
    for (const v of [...m[1].matchAll(/['"]([^'"]{4,400})['"]/g)]) 보기(v[1], 'onclick');
  }
  for (const m of html.matchAll(/on(?:click|Click)='([^']*)'/g)) {
    for (const v of [...m[1].matchAll(/['"]([^'"]{4,400})['"]/g)]) 보기(v[1], 'onclick');
  }
  return 나온것;
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 밑 = 'https://x.kr/bbs/view.php?no=1';
  보('문서 첨부를 집는다',
    후보들('<a href="/down/공고문.hwp">공고</a>', 밑).length === 1);
  보('묶음도 집는다', 후보들('<a href="/d/직무기술서.zip">x</a>', 밑)[0].갈래 === '문서');
  보('본문 <img> 를 집는다',
    후보들('<img src="/recruit/644/8510_abc.jpg">', 밑).some((x) => x.어디 === 'img' && x.갈래 === '그림'));
  보('꾸밈 그림은 뺀다 (길)', 후보들('<img src="/images/logo.png">', 밑).length === 0);
  보('꾸밈 그림은 뺀다 (이름)', 후보들('<img src="/recruit/top_banner.jpg">', 밑).length === 0);
  보('「시신기증안내」는 뺀다', 후보들('<img src="/upload/시신기증안내.jpg">', 밑).length === 0);
  보('onclick 속 주소도 집는다 (홑따옴표 속 쌍따옴표)',
    후보들('<a onclick=' + "'" + 'location.href = "/download/download.aspx?path=a.hwp&f=1"' + "'" + '>x</a>', 밑).length === 1);
  보('같은 주소를 두 번 안 센다',
    후보들('<a href="/a.pdf">1</a><a href="/a.pdf">2</a>', 밑).length === 1);
  보('jsessionid 는 열쇠에서 뺀다',
    후보들('<a href="/a.pdf;jsessionid=AA">1</a><a href="/a.pdf;jsessionid=BB">2</a>', 밑).length === 1);
  보('javascript: 는 안 집는다', 후보들('<a href="javascript:f(1)">x</a>', 밑).length === 0);
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 형식모으기 자기점검 통과 — ' + 잼.length + '가지') + ' (쪽·DB 를 두드리지 않았습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (자기점검만) process.exit(0);

/* ── 열쇠 ──────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL · SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(낼곳, { recursive: true });
const 후보파일 = path.join(낼곳, '후보.json');

/* ── ① 쪽을 열어 후보 모으기 ───────────────────────────────── */
if (쪽몇개) {
  const 모두 = [];
  for (let off = 0; off < 2000 && 모두.length < 쪽몇개 * 2; off += 100) {
    const r = await fetch(U + '/rest/v1/job_posts?select=id,source,org_name,title,url'
      + '&source=in.(HS,HS3,CE,CE2,ND2)&url=not.is.null&order=db_insert_at.desc'
      + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) { console.error('✗ ' + r.status); break; }
    const j = await r.json();
    모두.push(...j);
    if (j.length < 100) break;
  }
  /* 기관마다 한 건씩 — 같은 사이트를 여러 번 두드리지 않게 */
  const 기관본것 = new Set();
  const 볼것 = [];
  for (const x of 모두) {
    const 호스트 = (() => { try { return new URL(x.url).host; } catch { return null; } })();
    if (!호스트 || 기관본것.has(호스트)) continue;
    기관본것.add(호스트);
    볼것.push({ ...x, 호스트 });
    if (볼것.length >= 쪽몇개) break;
  }
  console.log('\n쪽 ' + 볼것.length + '개를 엽니다 (기관마다 하나 · 간격 ' + (간격ms / 1000) + '초)');
  const 후보 = [];
  let 본쪽 = 0;
  for (const x of 볼것) {
    try {
      const r = await fetch(x.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' },
        redirect: 'follow', signal: AbortSignal.timeout(25000) });
      const buf = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || '';
      const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
        || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
      let html;
      try { html = new TextDecoder(cs.toLowerCase()).decode(buf); } catch { html = buf.toString('utf8'); }
      const 쿠키 = (r.headers.getSetCookie?.() || []).map((c) => String(c).split(';')[0]).join('; ');
      const 들 = 후보들(html, r.url || x.url);
      const 쓸것 = 들.filter((y) => 그림꼴.test(y.url) || /[.](zip|docx?|xlsx?|pptx?)(\?|$|#)/i.test(y.url));
      for (const y of 쓸것) 후보.push({ ...y, 공고: x.id, source: x.source, 기관: x.org_name, 쪽: r.url || x.url, 쿠키 });
      본쪽++;
      process.stderr.write('\r  ' + 본쪽 + '/' + 볼것.length + ' · 후보 ' + 후보.length + '    ');
    } catch { /* 못 열면 넘어갑니다 */ }
    await 자고(간격ms);
  }
  process.stderr.write('\n');
  fs.writeFileSync(후보파일, JSON.stringify({ 만든때: new Date().toISOString(), 본쪽, 후보 }, null, 1) + '\n', 'utf8');
  const 셈 = {};
  for (const y of 후보) {
    const k = (y.url.match(/[.](zip|docx?|xlsx?|pptx?|jpe?g|png|webp|tiff?|gif)(\?|$|#)/i) || [])[1] || '?';
    셈[k.toLowerCase()] = (셈[k.toLowerCase()] || 0) + 1;
  }
  console.log('쪽 ' + 본쪽 + '개에서 후보 ' + 후보.length + '개 —');
  for (const [k, n] of Object.entries(셈).sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '  ' + k);
  console.log(후보파일 + ' 에 적었습니다');
}

/* ── ② 받아서 읽어 보기 ────────────────────────────────────── */
if (받기) {
  if (!fs.existsSync(후보파일)) { console.error('✗ 먼저 --쪽 N 으로 후보를 모으십시오'); process.exit(1); }
  const { 후보 } = JSON.parse(fs.readFileSync(후보파일, 'utf8'));
  const 본것 = new Set();
  const 결과 = [];
  let 받은수 = 0;
  for (const y of 후보) {
    if (받은수 >= 하루뚜껑) { console.log('\n하루 뚜껑 ' + 하루뚜껑 + '건에 닿았습니다'); break; }
    if (본것.has(y.url)) continue;
    본것.add(y.url);
    let r;
    try {
      r = await fetch(y.url, { headers: { 'User-Agent': UA, Referer: y.쪽, Cookie: y.쿠키 || '' },
        redirect: 'follow', signal: AbortSignal.timeout(30000) });
    } catch (e) { 결과.push({ ...y, 왜: String(e.message).slice(0, 50) }); await 자고(간격ms); continue; }
    const buf = Buffer.from(await r.arrayBuffer());
    받은수++;
    const 꼴 = 진짜형식(buf);
    const 속 = 꼴 === 'zip계열' ? 묶음갈래(buf) : null;
    const 한줄 = { 공고: y.공고, source: y.source, 기관: y.기관, url: y.url, 어디: y.어디,
      code: r.status, 바이트: buf.length, 꼴, 묶음속: 속 };
    if (읽을꼴(꼴, 속)) {
      const 이름 = decodeURIComponent((r.headers.get('content-disposition') || '')
        .match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)?.[1] || y.url.split('/').pop().split('?')[0]).slice(0, 70);
      한줄.이름 = 이름;
      const 읽 = await 첨부읽기(buf, 이름);
      const md = String(읽.md || '');
      한줄.글자수 = md.length;
      한줄.표수 = (md.match(/\n\s*\|/g) || []).length;
      한줄.초 = 읽.초 ?? null;
      한줄.OCR = !!읽.OCR썼나;
      한줄.읽기탈 = 읽.왜 || null;
      if (md) {
        const 칸 = 칸뽑기(md, 읽.글 || '');
        한줄.직군 = 본문직군(읽.글 || md);
        한줄.모집인원 = 칸.모집인원 && Object.keys(칸.모집인원).length ? 칸.모집인원 : (칸.모집인원글 || null);
        한줄.접수마감 = 칸.접수마감 || null;
        한줄.접수시각 = 칸.접수시각 || null;
      }
      const 방 = path.join(낼곳, (속 || 꼴));
      fs.mkdirSync(방, { recursive: true });
      fs.writeFileSync(path.join(방, y.공고 + '_' + 이름.replace(/[\\/:*?"<>|]/g, '_')), buf);
    }
    결과.push(한줄);
    process.stderr.write('\r  받은 것 ' + 받은수 + ' · ' + (한줄.묶음속 || 한줄.꼴) + '        ');
    await 자고(간격ms);
  }
  process.stderr.write('\n');
  fs.writeFileSync(path.join(낼곳, '받은것.json'),
    JSON.stringify({ 만든때: new Date().toISOString(), 결과 }, null, 1) + '\n', 'utf8');

  const 모음 = new Map();
  for (const x of 결과) {
    const k = x.묶음속 || x.꼴 || '?';
    const t = 모음.get(k) || { n: 0, 받음: 0, 읽음: 0, 직군: 0, 인원: 0, 마감: 0, 초합: 0 };
    t.n++;
    if (읽을꼴(x.꼴, x.묶음속)) t.받음++;
    if ((x.글자수 || 0) > 50) t.읽음++;
    if (x.직군) t.직군++;
    if (x.모집인원) t.인원++;
    if (x.접수마감) t.마감++;
    t.초합 += x.초 || 0;
    모음.set(k, t);
  }
  console.log('\n── 받아서 읽어 본 것 ──');
  console.log('  꼴        건수  받기   읽기   직군  인원  마감  평균초');
  for (const [k, t] of [...모음].sort((a, b) => b[1].n - a[1].n)) {
    const 퍼 = (a) => (t.n ? Math.round((100 * a) / t.n) + '%' : '—');
    console.log('  ' + k.padEnd(10) + String(t.n).padStart(4)
      + 퍼(t.받음).padStart(7) + 퍼(t.읽음).padStart(7)
      + String(t.직군).padStart(6) + String(t.인원).padStart(6) + String(t.마감).padStart(6)
      + (t.n ? (t.초합 / t.n).toFixed(1) : '0').padStart(8));
  }
  console.log('\n' + path.join(낼곳, '받은것.json') + ' 에 적었습니다. DB 에 아무것도 쓰지 않았습니다.');
}

function 읽을꼴(꼴, 속) {
  if (['pdf', 'hwp', 'jpg', 'png', 'webp'].includes(꼴)) return true;
  if (꼴 === 'zip계열') return ['hwpx', 'docx', 'xlsx', 'zip'].includes(속);
  return false;
}

await 워커끝내기?.();
