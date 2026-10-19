/* 능력시험 ② **원문 받아 두기** (2026-10-19 밤)
 *
 *   node tools/능력시험/원문받기.mjs            표본.json 의 공고를 전부
 *   node tools/능력시험/원문받기.mjs --몇개 10
 *   node tools/능력시험/원문받기.mjs --아이디 HS123,CE80464
 *
 * ── 무엇을 하나 ──────────────────────────────────────────────────
 * 표본 공고의 **쪽과 첨부를 그대로 받아** `원문/<id>/` 에 쌓습니다.
 * 제가 **사람처럼 읽어 정답지를 쓰기 위한** 자료이고, 동시에 시험의
 * ③④⑤(첨부 찾음·받음·읽음)를 재는 **잣대**가 됩니다 —
 *   · 쪽에 **실제로 걸려 있는 첨부 수** (우리 DB 가 아니라 **쪽**이 기준)
 *   · 받은 파일의 **앞 바이트로 가린 진짜 형식** (PDF 인 척하는 HTML 을 가립니다)
 *   · 글자로 바꾼 뒤 **글자 수와 표 수**
 *
 * ★ 수집기의 **뽑기 규칙을 쓰지 않습니다.** 받기와 글자 바꾸기만 공용 도구를
 *   씁니다 (`첨부읽기`·`진짜형식`). 칸을 뽑는 `칸뽑기()` 는 **안 부릅니다** —
 *   정답지가 수집기 답을 베끼면 시험이 아닙니다 (세중님).
 * ★ DB 에 아무것도 쓰지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부읽기, 진짜형식, 워커끝내기 } from '../공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 몇개 = Number(값('--몇개', 999));
const 아이디들 = String(값('--아이디', '')).split(',').map((s) => s.trim()).filter(Boolean);
const 첨부뚜껑 = Number(값('--첨부뚜껑', 4));

const 표본파일 = path.join(여기, '표본.json');
if (!fs.existsSync(표본파일)) { console.error('✗ 먼저 표본뽑기.mjs 를 돌리십시오'); process.exit(1); }
const { 표본 } = JSON.parse(fs.readFileSync(표본파일, 'utf8'));
const 볼것 = (아이디들.length ? 표본.filter((x) => 아이디들.includes(x.id)) : 표본).slice(0, 몇개);
console.log('원문을 받을 공고 ' + 볼것.length + '건');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 알리오 포털 쿠키 — `첨부되메우기.mjs` 와 **같은 길**입니다 (지침 6절) */
let 알리오쿠키 = null;
async function 머리(주소) {
  const 기본 = { 'User-Agent': UA, 'Accept-Language': 'ko' };
  if (!/opendata\.alio\.go\.kr/.test(String(주소))) return 기본;
  if (알리오쿠키 === null) {
    const jar = {};
    let u = 'https://opendata.alio.go.kr/new/';
    const 담기 = () => Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
    for (let hop = 0; hop < 4 && u; hop++) {
      const r = await fetch(u, { redirect: 'manual', headers: { ...기본, Cookie: 담기() } });
      (r.headers.getSetCookie?.() || []).forEach((x) => {
        const kv = String(x).split(';')[0]; const i = kv.indexOf('=');
        if (i > 0) jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
      const loc = r.headers.get('location');
      u = (r.status >= 300 && r.status < 400 && loc)
        ? (/^https?:/.test(loc) ? loc : 'https://opendata.alio.go.kr' + loc) : '';
    }
    알리오쿠키 = 담기();
    console.log('   (알리오 포털 쿠키 ' + (알리오쿠키 ? 알리오쿠키.split(';').length + '개' : '없음') + ')');
  }
  return { ...기본, Cookie: 알리오쿠키, Referer: 'https://opendata.alio.go.kr/new/' };
}

async function 받기(u) {
  const r = await fetch(u, { headers: await 머리(u), redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const buf = Buffer.from(await r.arrayBuffer());
  return { code: r.status, ct: r.headers.get('content-type') || '', buf, 끝주소: r.url || u,
    cd: r.headers.get('content-disposition') || '' };
}
function 글자로(buf, ct) {
  const cs = (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (buf.subarray(0, 3000).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  try { return new TextDecoder(cs.toLowerCase()).decode(buf); } catch { return buf.toString('utf8'); }
}
const 태그걷기 = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
  .replace(/<td[^>]*>/gi, ' | ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
  .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/* 쪽에 걸려 있는 **첨부로 보이는 링크** — 확장자나 내려받기 길
 *
 * ★ 2026-10-19 — 첫 6건을 받아 보고 **재는 쪽을 고쳤습니다**:
 *   ① `&amp;` 를 안 풀어 주소가 틀렸습니다 (HS490653413 → 5,704바이트 HTML).
 *      지침 5절에 적힌 바로 그 자리입니다
 *   ② `javascript:fn_FileDown(` 같은 **함수 호출**을 주소로 받아 두드렸습니다 —
 *      그건 「JS 로 만드는 주소」 갈래로 **적고 두드리지 않습니다**
 *   ③ `images/download.png` 같은 **아이콘**을 첨부로 셌습니다 — 뺍니다
 *   ④ `FileViewer.do`·`synap` 은 **뷰어형**이라 따로 적습니다 */
const 파일꼴 = /\.(pdf|hwpx?|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|tiff?|txt)(\?|$|#)/i;
const 내려받기길 = /(download|filedown|fileDown|getFile|nttFileDownload|downFile|atchFile|fileidDownLoad|cmm\/fms|FileViewer|fileView)/i;
const 아이콘길 = /\/(images?|img|assets?|static|skin|resources?|css|js)\//i;
const 뷰어길 = /(FileViewer|synap|docview|viewer|preview|hwpViewer)/i;
const 엔티티풀기 = (s) => String(s || '')
  .replace(/&amp;/g, '&').replace(/&amp;/g, '&')   /* 두 번 — 겹쳐 적힌 쪽이 있습니다 */
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

function 쪽첨부들(html, 밑바탕) {
  const 나온것 = [];
  const 보기 = (h0, t) => {
    const h = 엔티티풀기(h0).trim();
    if (!h || /^(#|mailto|tel)/i.test(h)) return;
    const 글 = String(t || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    /* JS 로 주소를 만드는 꼴 — **적고 두드리지 않습니다** */
    if (/^javascript:/i.test(h)) {
      if (/void\s*\(/i.test(h)) return;
      if (!/(file|down|atch|attach|첨부)/i.test(h)) return;
      const 이름 = (h.match(/javascript:\s*([A-Za-z_$][\w$.]*)/) || [])[1] || '(모름)';
      if (!나온것.some((x) => x.갈래 === 'JS주소' && x.함수 === 이름)) {
        나온것.push({ 갈래: 'JS주소', 함수: 이름, url: null, 글, 원문: h.slice(0, 90) });
      }
      return;
    }
    if (!(파일꼴.test(h) || 내려받기길.test(h))) return;
    if (아이콘길.test(h) && !내려받기길.test(h.replace(아이콘길, '/'))) return;   /* 아이콘은 뺍니다 */
    let u; try { u = new URL(h, 밑바탕).href; } catch { return; }
    if (나온것.some((x) => x.url === u)) return;
    나온것.push({ 갈래: 뷰어길.test(u) ? '뷰어형' : '파일주소', url: u, 글 });
  };
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) 보기(m[1], m[2]);
  /* onclick 안의 주소도 봅니다 — 지침 5절(첨부가 href 가 아니라 onclick 에 있던 자리) */
  for (const m of html.matchAll(/on(?:click|Click)=["']([^"']+)["']/gi)) {
    const s = 엔티티풀기(m[1]);
    const 안 = [...s.matchAll(/['"]([^'"]{4,160})['"]/g)].map((y) => y[1]);
    if (/(file|down|atch)/i.test(s) && !안.length) 보기('javascript:' + s, '(onclick)');
    for (const v of 안) 보기(v, '(onclick)');
  }
  return 나온것;
}

const 낼곳 = path.join(여기, '원문');
fs.mkdirSync(낼곳, { recursive: true });
const 목록 = [];
let 첨부받은수 = 0;

for (const [i, x] of 볼것.entries()) {
  const 방 = path.join(낼곳, x.id);
  fs.mkdirSync(방, { recursive: true });
  const 한건 = { id: x.id, source: x.source, 기관: x['기관'], 제목: x['제목'], 주소: x['주소'],
    숨김: x['숨김'], 보류: x['보류'], DB첨부: (x['첨부'] || []).length, 쪽: null, 쪽첨부: [], 받은첨부: [] };
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + ' ' + x.id + '        ');

  if (!x['주소'] || !/^https?:/.test(String(x['주소']))) {
    한건.쪽 = { 왜: '쪽 주소가 없습니다 (API 출처거나 주소를 안 담았습니다)' };
  } else {
    try {
      const r = await 받기(x['주소']);
      const html = 글자로(r.buf, r.ct);
      const 글 = 태그걷기(html);
      fs.writeFileSync(path.join(방, '쪽.html'), html, 'utf8');
      fs.writeFileSync(path.join(방, '쪽.txt'), 글, 'utf8');
      한건.쪽 = { code: r.code, 바이트: r.buf.length, 끝주소: r.끝주소, 글자수: 글.length,
        우리직군말: /(물리|작업|도수)\s*치료/.test(글), 제목글자: (html.match(/<title>([^<]{0,80})/i) || [])[1] || null };
      한건.쪽첨부 = 쪽첨부들(html, r.끝주소);
    } catch (e) { 한건.쪽 = { 왜: String(e.message).slice(0, 60) }; }
  }

  /* 첨부 — **DB 에 있는 것 ∪ 쪽에 걸려 있는 것** 을 받아 봅니다 */
  const 받을것 = [];
  for (const a of (x['첨부'] || [])) 받을것.push({ url: 엔티티풀기(a.url), name: a.name, 어디서: 'DB' });
  /* JS 로 만드는 주소는 **두드리지 않습니다** — 갈래만 적습니다 */
  for (const a of 한건.쪽첨부) {
    if (!a.url) continue;
    if (!받을것.some((y) => y.url === a.url)) 받을것.push({ url: a.url, name: a.글, 어디서: '쪽', 갈래: a.갈래 });
  }

  const 첨방 = path.join(방, '첨부');
  if (받을것.length) fs.mkdirSync(첨방, { recursive: true });
  for (const [k, a] of 받을것.slice(0, 첨부뚜껑).entries()) {
    const 한첨 = { 어디서: a.어디서, 이름: a.name, url: a.url };
    try {
      const r = await 받기(a.url);
      한첨.code = r.code; 한첨.바이트 = r.buf.length;
      한첨.앞바이트 = r.buf.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
      한첨.진짜형식 = 진짜형식(r.buf);
      const 파일이름 = (r.cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) || [])[1] || a.name || ('첨부' + k);
      한첨.받은이름 = decodeURIComponent(String(파일이름)).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      fs.writeFileSync(path.join(첨방, (k + 1) + '_' + 한첨.받은이름), r.buf);
      /* 글자로 바꿔 봅니다 — **읽기 도구만** 씁니다 (칸뽑기는 안 부릅니다) */
      if (r.buf.length > 200) {
        /* 돌려주는 꼴은 `공고문읽기.mjs` 의 `첨부읽기()` 그대로입니다 —
           { md, blocks, 글, 왜, 초, 꼴, OCR썼나, 쪽수, OCR필요쪽 } (찍어 확인했습니다) */
        const 읽 = await 첨부읽기(r.buf, 한첨.받은이름);
        const md = String((읽 && 읽.md) || '');
        한첨.글자수 = md.length;
        한첨.표수 = (md.match(/\n\s*\|/g) || []).length;
        한첨.읽기탈 = 읽 && 읽.왜 ? String(읽.왜).slice(0, 90) : null;
        한첨.읽은꼴 = 읽 && 읽.꼴 || null;
        한첨.쪽수 = 읽 && 읽.쪽수 != null ? 읽.쪽수 : null;
        한첨.OCR썼나 = !!(읽 && 읽.OCR썼나);
        한첨.OCR필요쪽 = 읽 && 읽.OCR필요쪽 != null ? 읽.OCR필요쪽 : null;
        한첨.초 = 읽 && 읽.초 != null ? Math.round(읽.초 * 10) / 10 : null;
        if (md) fs.writeFileSync(path.join(첨방, (k + 1) + '_' + 한첨.받은이름 + '.txt'), md, 'utf8');
      }
      첨부받은수++;
    } catch (e) { 한첨.왜 = String(e.message).slice(0, 60); }
    한건.받은첨부.push(한첨);
    await 자고(400);
  }
  목록.push(한건);
  fs.writeFileSync(path.join(방, '사실.json'), JSON.stringify(한건, null, 1) + '\n', 'utf8');
  await 자고(300);
}
process.stderr.write('\n');
await 워커끝내기?.();

fs.writeFileSync(path.join(낼곳, '원문사실.json'),
  JSON.stringify({ 만든때: new Date().toISOString(), 목록 }, null, 1) + '\n', 'utf8');

/* ── 한눈에 ── */
const 셈 = (f) => 목록.filter(f).length;
console.log('\n── 쪽 ──');
console.log('  받음 ' + 셈((x) => x.쪽 && x.쪽.code === 200) + ' · 못 받음 '
  + 셈((x) => x.쪽 && (x.쪽.왜 || x.쪽.code !== 200)) + ' · 주소 없음 '
  + 셈((x) => x.쪽 && /주소가 없/.test(x.쪽.왜 || '')));
console.log('  쪽 글에 우리 직군 말이 있는 것 ' + 셈((x) => x.쪽 && x.쪽.우리직군말) + '건');
console.log('\n── 첨부 (쪽 기준 ↔ 우리 DB) ──');
for (const x of 목록) {
  const 쪽n = x.쪽첨부.length; const dbn = x.DB첨부;
  if (!쪽n && !dbn) continue;
  console.log('  ' + x.id.padEnd(20) + x.source.padEnd(5) + '쪽 ' + String(쪽n).padStart(3)
    + ' · DB ' + String(dbn).padStart(3) + (쪽n > dbn ? '   ← **DB 가 적습니다**' : ''));
}
console.log('\n  받아 본 첨부 ' + 첨부받은수 + '개 · 글자로 바뀐 것 '
  + 목록.reduce((a, x) => a + x.받은첨부.filter((y) => y.글자수).length, 0) + '개');
console.log('\n' + 낼곳 + ' 에 쌓았습니다. DB 에 아무것도 쓰지 않았습니다.');
