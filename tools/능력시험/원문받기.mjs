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

/* ★ 그누보드·XE 같은 게시판은 첨부를 줄 때 **쪽을 먼저 본 사람인지** 봅니다 —
 *   `Referer` 와 **쪽에서 받은 쿠키**가 있어야 파일을 줍니다. 없으면 5,704바이트
 *   HTML(「잘못된 접근」 쪽)이 옵니다. 2026-10-19 에 청주성모로 재 봤습니다 —
 *     머리글 없음        5,704바이트 HTML
 *     Referer 만         5,845바이트 HTML
 *     Referer + 쿠키     **165,020바이트 %PDF-1.7**
 *   그래서 쪽을 받을 때 쿠키를 모아 두고 첨부에 함께 보냅니다 */
let 쪽쿠키 = '';
let 쪽주소 = '';
async function 받기(u, 쪽인가 = false, 몸 = null) {
  const 기본 = await 머리(u);
  const 더 = (!쪽인가 && 쪽쿠키) ? { Cookie: [기본.Cookie, 쪽쿠키].filter(Boolean).join('; ') } : {};
  const 리퍼 = (!쪽인가 && 쪽주소) ? { Referer: 쪽주소 } : {};
  const r = await fetch(u, { method: 몸 ? 'POST' : 'GET', body: 몸 || undefined,
    headers: { ...기본, ...리퍼, ...더,
      ...(몸 ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const buf = Buffer.from(await r.arrayBuffer());
  if (쪽인가) {
    쪽쿠키 = (r.headers.getSetCookie?.() || []).map((c) => String(c).split(';')[0]).join('; ');
    쪽주소 = r.url || u;
  }
  return { code: r.status, ct: r.headers.get('content-type') || '', buf, 끝주소: r.url || u,
    cd: r.headers.get('content-disposition') || '' };
}
/* ★ 고용24(work24.go.kr) 상세쪽은 때때로 **스스로 POST 하는 빈 껍데기**로 옵니다 —
 *   1,307바이트에 <title></title> 과 `<form id="frm" action="(같은 주소)" method="post">`
 *   + 숨은 칸(wantedAuthNo·infoTypeGroup)만 있습니다. 브라우저는 이 꼴을 곧바로
 *   보내서 본문을 받습니다. 우리는 GET 한 번으로 끝내고 **글자 0자**로 적었습니다
 *   (WNK161332608120004 · WNKJ20912609230013. 2026-10-20 에 가렸습니다).
 *   그래서 이 꼴이면 숨은 칸을 모아 **같은 주소로 POST 해서 다시** 받습니다 */
function 스스로보내는쪽(html, 밑바탕) {
  if (html.length > 8000) return null;
  const f = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*method=["']?post/i)
    || html.match(/<form[^>]+method=["']?post["']?[^>]*action=["']([^"']+)["']/i);
  if (!f) return null;
  const 몸 = new URLSearchParams();
  for (const m of html.matchAll(/<input[^>]+name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi)) {
    몸.set(엔티티풀기(m[1]), 엔티티풀기(m[2]));
  }
  if (![...몸.keys()].length) return null;
  let u; try { u = new URL(엔티티풀기(f[1]), 밑바탕).href; } catch { return null; }
  return { url: u, 몸 };
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
const 아이콘길 = /\/(images?|img|assets?|static|skin|resources?|css|js|favicons?|icons?|thumb(nail)?s?)\//i;
/* 꾸밈 그림은 **언제나** 뺍니다 — `favicon/apple-icon-57x57.png` 가 첨부로 세어졌습니다.
   공고문이 그림(JPG)인 곳이 있으니 **jpg·jpeg·tif 는 남깁니다** (갈래로 적습니다) */
const 꾸밈그림 = /\.(png|gif|svg|ico|webp|bmp)(\?|$|#)/i;
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
    const 문서확장자 = /\.(pdf|hwpx?|docx?|xlsx?|pptx?|zip|txt)(\?|$|#)/i.test(h);
    if (꾸밈그림.test(h) && !문서확장자) return;                    /* png·ico 는 첨부가 아닙니다 */
    if (아이콘길.test(h) && !문서확장자) return;                    /* 꾸밈 폴더도 */
    let u; try { u = new URL(h, 밑바탕).href; } catch { return; }
    /* ★ `;jsessionid=…` 는 **받을 때마다 바뀝니다.** 같은 파일을 여러 개로 세지
       않게 **열쇠에서 뺍니다**. (2026-10-19 — 우리 `job_attachments` 가 이 때문에
       HS987933081 한 건에 **196줄**(참 파일 4개)을 쌓아 두고 있었습니다) */
    const 열쇠 = u.replace(/;jsessionid=[^?#]*/i, '');
    if (나온것.some((x) => x.열쇠 === 열쇠)) return;
    나온것.push({ 갈래: 뷰어길.test(u) ? '뷰어형' : '파일주소', url: u, 열쇠, 글 });
    /* ★ pdf.js 뷰어(`viewer.html?file=…`)는 **참 파일 주소를 품고** 있습니다 —
       `file=` 값만 떼면 그대로 받아집니다. 2026-10-20 에 제주대 305467 로 재 봤습니다:
         viewer.html?file=/thumbnail/…PDF  →  그 값만 받으니 143,375바이트 %PDF-1.4 (5쪽)
       뷰어 주소를 그냥 두드리면 HTML 만 옵니다 */
    const 품은 = (u.match(/[?&]file=([^&]+)/) || [])[1];
    if (품은) {
      try {
        const v = new URL(decodeURIComponent(품은), u).href;
        if (/[.](pdf|hwpx?|docx?|xlsx?|zip|jpe?g)([?]|$|[#])/i.test(v) && !나온것.some((y) => y.열쇠 === v)) {
          나온것.push({ 갈래: '뷰어속참파일', url: v, 열쇠: v, 글: 글 + ' (뷰어가 품은 참 파일)' });
        }
      } catch { /* 주소가 아니면 버립니다 */ }
    }
  };
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) 보기(m[1], m[2]);
  /* onclick 안의 주소도 봅니다 — 지침 5절(첨부가 href 가 아니라 onclick 에 있던 자리) */
  for (const m of html.matchAll(/on(?:click|Click)=["']([^"']+)["']/gi)) {
    const s = 엔티티풀기(m[1]);
    const 안 = [...s.matchAll(/['"]([^'"]{4,160})['"]/g)].map((y) => y[1]);
    if (/(file|down|atch)/i.test(s) && !안.length) 보기('javascript:' + s, '(onclick)');
    for (const v of 안) 보기(v, '(onclick)');
  }
  /* ★ `<a>…</a>` 로 안 잡히는 자리도 봅니다 — `<iframe src=FileViewer.do…>` 처럼
     **src** 에 걸린 뷰어가 있습니다 (제주대 305467 이 그 꼴입니다. 2026-10-19 에
     이 줄을 지웠다가 2건을 놓쳤습니다) */
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)) 보기(m[1], '(주소꼴)');
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

  let 쪽HTML = '';
  if (!x['주소'] || !/^https?:/.test(String(x['주소']))) {
    한건.쪽 = { 왜: '쪽 주소가 없습니다 (API 출처거나 주소를 안 담았습니다)' };
  } else {
    try {
      쪽쿠키 = ''; 쪽주소 = '';            /* 공고마다 새로 모읍니다 */
      let r = await 받기(x['주소'], true);
      let html = 글자로(r.buf, r.ct);
      const 또 = 스스로보내는쪽(html, r.끝주소);
      if (또) {
        const r2 = await 받기(또.url, true, 또.몸);
        const html2 = 글자로(r2.buf, r2.ct);
        if (html2.length > html.length) {
          console.log('   (' + x.id + ' — 스스로 POST 하는 쪽이라 다시 보냈습니다: '
            + html.length + '자 → ' + html2.length + '자)');
          r = r2; html = html2;
        }
      }
      쪽HTML = html;
      const 글 = 태그걷기(html);
      fs.writeFileSync(path.join(방, '쪽.html'), html, 'utf8');
      fs.writeFileSync(path.join(방, '쪽.txt'), 글, 'utf8');
      한건.쪽 = { code: r.code, 바이트: r.buf.length, 끝주소: r.끝주소, 글자수: 글.length,
        다시보냄: !!또 || undefined,
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

  /* ★ 클린아이(job.cleaneye.go.kr) 첨부는 **POST /file/FileDownload.do** 로만 옵니다 —
     `fn_FileDown('<UPLOAD>','<ORIGINAL>','<PATH>')` 의 세 인자 + Referer 가 다 있어야
     파일을 줍니다 (tools/cleaneye-file.mjs · 지침 6절). GET 으로 두드리면 공고 쪽
     HTML 이 그대로 와서 「PDF 인 척하는 HTML」로 세어집니다 — 우리 표의 23줄이 그 꼴입니다.
     ⚠ 통이 15건·2분이라 **10초 간격**을 지킵니다 (줄이면 429 가 나고 더 느립니다) */
  if (/job[.]cleaneye[.]go[.]kr/.test(String(x["주소"] || "")) && 쪽HTML) {
    for (const m of 쪽HTML.matchAll(/fn_FileDown[(]['"]([^'"]*)['"],['"]([^'"]*)['"],['"]([^'"]*)['"]/g)) {
      const 몸 = new URLSearchParams();
      몸.set('UPLOAD_FILENAME', m[1]); 몸.set('ORIGINAL_FILENAME', m[2]); 몸.set('FILE_PATH', m[3]);
      const 이름 = m[2] || m[1];
      if (!받을것.some((y) => y.name === 이름 && y.post)) {
        받을것.unshift({ url: 'https://job.cleaneye.go.kr/file/FileDownload.do', name: 이름,
          어디서: '쪽(POST)', 갈래: '받기POST', post: 몸, 쉼: 10000 });
      }
    }
  }

  const 첨방 = path.join(방, '첨부');
  if (받을것.length) fs.mkdirSync(첨방, { recursive: true });
  for (const [k, a] of 받을것.slice(0, 첨부뚜껑).entries()) {
    const 한첨 = { 어디서: a.어디서, 이름: a.name, url: a.url };
    try {
      const r = await 받기(a.url, false, a.post || null);
      한첨.갈래 = a.갈래 || null;
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
    await 자고(a.쉼 || 400);
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
