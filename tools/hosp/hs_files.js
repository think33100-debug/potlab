// 병원 상세 HTML 에서 **공고문 첨부 주소**를 뽑습니다 (2026-10-11 · 세중님 3번).
//
// ★ HS3 는 첨부를 **아예 안 받고 있었습니다.** 그래서 상세 본문에 접수기간이
//   없는 공고(264건 중 142건)의 일곱 칸을 채울 재료가 없었습니다.
//   그중 68건은 본문에 **첨부 파일 이름이 보입니다** (hwp 39 · pdf 25).
//
// ★ 주소를 규칙으로 만들 수 없습니다. 충주의료원 한 곳을 열어 확인했습니다 —
//     /board/download/syfsx/7141/file/1/8496/<해시>/<해시>/<해시>.hwp
//   해시가 셋 들어갑니다. **상세 HTML 에서 긁는 수밖에 없습니다** (지침 3절 —
//   주소를 짐작으로 만들지 않기).
//
// 고르는 규칙은 `collect-nara.mjs` 의 점수() 와 같은 생각입니다 —
//   공고문 > 그밖 > 지원서·서식. 기준을 한 자리에 두려고 여기로 모았습니다.
//
// 쓰는 법:  const fs_ = require('./hosp/hs_files.js');
//           const 목록 = fs_.hs첨부주소(html, 공고주소);
//
// 자기 점검:  node tools/hosp/hs_files.js

/** 첨부로 쓸 확장자 — **주소**에서 (끝이거나 `?` 앞) */
const 쓸꼴 = /\.(hwpx?|pdf|docx?)(\?|$)/i;

/** ★ 2026-10-14 — **이름에서는 끝에 고정하지 않습니다.**
 *
 * 그누보드5 게시판은 링크 글에 크기를 붙입니다 —
 *     「직원채용 공고 … 및 방사선사.hwp (135.5K)」
 * 그래서 `쓸꼴`(끝 고정)로 이름을 보면 **안 걸립니다.** 주소 쪽도
 *     /bbs/download.php?bo_table=recurit_new&wr_id=648&no=0
 * 처럼 확장자가 아예 없어서, 둘 다 빠져 **첨부 0개**가 됐습니다 —
 * 청주의료원(본문이 「첨부 파일 확인바랍니다.」뿐)이 그랬습니다.
 *
 * 이름 쪽만 느슨하게 봅니다. 주소 쪽을 느슨하게 하면 `…/pdf_viewer/x`
 * 같은 길이 걸립니다. */
const 이름꼴 = /\.(hwpx?|pdf|docx?)(\b|$)/i;

/** 이름으로 본 쓸모 — 높을수록 공고문에 가깝습니다 */
/* ★ 2026-10-22 밤 — **서식 낱말 목록도 한 자리**입니다.
   묶음파일.mjs(ZIP 안 파일 줄 세우기)가 거의 같은 목록을 따로 들고 있었습니다 —
   한쪽에 「동의서」, 다른 쪽에 「명세서·직무기술」. 같은 일을 하는 두 벌은 또
   갈라집니다 (오늘 점수() 다섯 벌에서 겪은 그것입니다). 여기 하나로 둡니다. */
const 서식말 = /지원서|응시원서|서식|양식|이력서|자기소개|명세서|직무기술|제출서류|동의서/;

function 점수(이름) {
  const s = String(이름 || '');
  /* ★ 2026-10-22 세중님 추가 2번 — **이 함수가 첨부 고르는 순서 한 자리입니다.**
     전에는 같은 규칙이 **다섯 벌**이었습니다 (첨부되메우기·collect-nara·GJ2보류읽기·
     나라일터_직군근거·첨부한건확인). 벌마다 낱말이 달라서 「자기소개서」가 한쪽에서는
     0점, 다른 쪽에서는 1점이었습니다. 전수 마른 실행 — 첨부 있는 공고 1,153건 중
     고를 것이 바뀌는 것 **1건**(회원 화면 0건) */
  /* ★ 2026-11-21 규칙숙제 #7 — **공고문이 아닌 사이트 공통 파일은 -1** (아예 안 고릅니다).
     사진 대조에서 「공고문」으로 골라 읽은 것 — wa_busanmc2026.pdf(부산의료원 · 웹접근성 마크) ·
     「4.블라인드 관련 유의사항.pdf」(서울대병원) · safe.pdf(포항세명기독). 판정은 공고아닌첨부() 한 자리 */
  if (공고아닌첨부(s)) return -1;
  if (서식말.test(s)) return 0;
  if (/공고|모집|채용|요강/.test(s)) return 2;
  return 1;
}

/* ── 자바스크립트가 주소를 만드는 곳 — **찾아서** 적습니다 (2026-10-14) ──
 *
 * ⚠ 짐작으로 만든 규칙이 아닙니다 (지침 3절). playwright 로 페이지를 열어
 *   **그 함수 본문을 읽고**, 받아 봐서 **앞 글자까지** 확인했습니다.
 *   근거는 `docs/첨부주소_자바스크립트_1014.md` 에 그대로 있습니다.
 *
 * ① 중앙보훈병원 (보훈공단 계열 · 눌린 요소 `<a href="#none" onclick=…>`)
 *      onclick   fn_fileDownload('189c72f1…6704', 'seoul')
 *      함수 본문  location.href = "/common/nttFileDownload.do?fileKey=" + fileKey
 *                                + "&bbsSysId=" + sysId
 *      받아 보니  HTTP 200 · 658,469바이트 · 앞 8글자 `%PDF-1.4`
 *      ★ **상세 페이지의 쿠키가 있어야 합니다.** 맨손 fetch 는 HTTP 200 에
 *        **0바이트**였습니다. 페이지 안에서 받으니 제대로 왔습니다
 *
 * ② 성주군 (고용24 고시공고 · `<a href="javascript:gfn_fileDown(…)">`)
 *      href      gfn_fileDown('<이름>.hwpx', '5635219160355651', 'employ/kny940827')
 *      함수 본문  document.fileFrm.{filenm,uuid,saveGbn} 에 넣고
 *                action = "/downFile.do" 로 **POST**
 *      받아 보니  HTTP 200 · 116,695바이트 · 앞 글자 `PK\x03\x04` (hwpx 는 zip)
 */
const JS주소꼴 = [
  {
    이름: '보훈공단 fn_fileDownload',
    꼴: /fn_fileDownload\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i,
    만들기: (m) => ({
      url: '/common/nttFileDownload.do?fileKey=' + encodeURIComponent(m[1])
        + '&bbsSysId=' + encodeURIComponent(m[2]),
      받는법: { 꼴: 'GET', 쿠키: '상세' },   /* 상세 페이지 쿠키가 있어야 합니다 */
    }),
  },
  {
    이름: '고용24 gfn_fileDown',
    꼴: /gfn_fileDown\s*\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/i,
    만들기: (m) => ({
      url: '/downFile.do',
      받는법: { 꼴: 'POST', 폼: { filenm: m[1], uuid: m[2], saveGbn: m[3] }, 쿠키: '상세' },
    }),
  },
];

/** 상대 주소를 온전하게 */
function 온전히(주소, 바탕) {
  const p = String(주소 || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  try { return new URL(p, 바탕).toString(); } catch { return ''; }
}

/**
 * 상세 HTML 에서 첨부 주소를 뽑습니다.
 * @returns [{ url, name, 점수 }] — 점수 높은 것부터
 */
function hs첨부주소(html, 바탕주소) {
  const s = String(html || '');
  const 모은것 = new Map();          // url → {name, 점수}

  /* ⚠ 이름을 **가진** 쪽이 셉니다. 뒤 규칙(②③)은 주소만 알고 이름을 모르는데,
     그때 주소 끝글자로 이름을 지어내면 「입사지원서」(점수 0)가
     「cccc.hwp」(점수 1)로 덮입니다 — 자기 점검에서 걸렸습니다 (2026-10-11) */
  const 더하기 = (주소, 이름, 이름믿음, 받는법, 그림인가) => {
    /* ★ 2026-10-14 — **`&amp;` 를 여기서 풉니다.** 그누보드 주소가
       `…?bo_table=t&amp;wr_id=648&amp;no=0` 꼴로 옵니다. 안 풀면
       `첨부담기.더하기` 가 「&amp; 가 남아 있습니다」로 던집니다 —
       담고 나서 고치면 이미 들어간 줄이 남습니다 (지침 9절). */
    const 날것 = String(주소 || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&');
    /* ★ 2026-10-14 — **자바스크립트가 만드는 주소는 버립니다.**
       성주군(고용24 고시공고)이 이 꼴입니다 —
         href="javascript:gfn_fileDown('…hwpx','5635219160355651','employ/kny940827')"
       진짜 내려받기 주소는 그 함수 안에 있고 **우리는 아직 모릅니다.**
       짐작으로 만들지 않습니다 (지침 3절). 찾으면 상세주소.mjs 처럼 적고 붙입니다. */
    if (/^\s*(javascript:|#)/i.test(날것)) return;
    const u = 온전히(날것, 바탕주소);
    if (!u) return;
    /* ★ 2026-10-14 — **제 페이지를 가리키는 주소는 버립니다.**
       중앙보훈병원이 `<a href="#no">채용공고문….pdf</a>` 꼴이라, 조각(#no)을
       떼면 **상세 페이지 주소 그대로**가 됩니다. 이름에 `.pdf` 가 있어서
       이름 검사만으로는 통과합니다 — 담으면 HTML 을 공고문이라고 담는 셈입니다.
       진짜 주소는 자바스크립트(synap 뷰어)가 만듭니다. 아직 모릅니다. */
    if (u.split('#')[0] === String(바탕주소 || '').split('#')[0]) return;
    /* ★ 2026-10-21 — 쪽 꼬리말의 **웹접근성 인증서**가 첨부로 섞여,
       그 안의 「인증기간 2026.1.27 ~ 2027.1.26」 이 마감일을 눌렀습니다 */
    if (공고아닌첨부(이름, u)) return;
    /* 확장자가 주소에도 이름에도 없으면 안 씁니다 */
    /* ★ 2026-10-22 — **본문 그림 공고문**은 확장자 울타리를 비켜 갑니다.
       그림은 pdf·hwp 가 아니지만 kordoc 이 OCR 로 읽습니다. 아이콘·배너는
       그림공고문인가() 에서 이미 걸렀습니다 */
    if (!그림인가 && !쓸꼴.test(u) && !이름꼴.test(이름 || '')) return;
    const 준이름 = String(이름 || '').trim();
    const nm = 준이름 || (u.split('/').pop() || '').slice(0, 120);
    const 전 = 모은것.get(u);
    if (전 && (전.이름믿음 || !이름믿음)) return;      /* 이미 믿을 이름이 있으면 그대로 */
    모은것.set(u, { name: nm, 점수: 점수(nm), 이름믿음: !!이름믿음 && !!준이름, 받는법 });
  };

  /* ★ 2026-10-22 — **본문의 큰 그림**을 공고문으로 집습니다 (포항세명기독병원).
     `<a>` 가 아니라 `<img>` 라서 아래 고리들에 안 걸립니다. 그림은 OCR 로 읽습니다 */
  for (const m of s.matchAll(/<img\b[^>]*>/gi)) {
    const 토막 = m[0];
    const 집 = (이름) => {
      const g = 토막.match(new RegExp(이름 + '\\s*=\\s*["\']([^"\']*)["\']', 'i'));
      return g ? g[1] : '';
    };
    const src = 집('src'); let alt = 집('alt');
    /* ★ 2026-11-23 세중님 「그림 공고도 수집기가 스스로 읽고 있지 않아?」 — 설명이 alt 가 아니라 **title** 에 있는 꼴 (원광대학교병원 HS1506666763).
       `<img src="/data/userfiles/<uuid>.jpg" title="%ED%98%84…채용공고문_20261123001.jpg">` — 주소 글자로 바뀐(퍼센트) 파일 이름입니다.
       alt 가 비었으면 title 을 풀어 설명으로 씁니다. 그래야 「공고문」 글귀로 받고, 이름에 쪽 번호(001·002…)가 남아 여러 장을 이어 읽습니다 */
    if (!alt) { const t = 집('title'); if (t) { try { alt = decodeURIComponent(t); } catch { alt = t; } } }
    if (!그림공고문인가({ src, alt, width: 집('width'), height: 집('height') })) continue;
    더하기(src, alt || '공고문 그림', true, null, true);
  }

  /* ★ 2026-11-19 세중님 「그것도 고쳐」 — **쪽에 글자로 박힌 그림**(data:image/…;base64) 공고문.
     인천세종병원(HS69368144 · recruit.sejongh.co.kr/_page/notice/view)은 공고 본문이
     `<img id="photoImage" src="data:image/png;base64, …">` 한 장(820KB png)뿐이라, 글만 읽던 우리는
     「부서 · 모집분야」 두 줄만 가져와 근무기간·자격·보수가 다 비었습니다.
     그림에 주소가 없으므로 **쪽 주소 + `#본문그림-N`** 을 첨부 주소로 담고, 첨부되메우기가 받을 때
     쪽을 다시 열어 N 번째 박힌 그림을 꺼냅니다(나라일터 「쪽 주소를 담아 두는」 꼴과 같음 · 본문박힌그림() 한 자리).
     작은 꾸밈 그림은 뺍니다 — base64 55,000자(≈40KB · 첨부읽기 그림최소바이트) 미만 */
  {
    let n = 0;
    for (const m of s.matchAll(박힌그림꼴)) {
      n++;
      if (m[2].replace(/\s+/g, '').length < 55000) continue;
      /* ★ 2026-11-19 검토(지피) 반영 — 번호만 담으면 병원이 위에 배너를 하나 더할 때 **다른 그림**을 읽습니다.
         그림 지문(sha1 앞 10자)을 함께 담고, 받을 때 지문이 같은 그림을 먼저 찾습니다 */
      const 지문 = 그림지문(Buffer.from(m[2].replace(/\s+/g, ''), 'base64'));
      const u = String(바탕주소 || '').split('#')[0] + '#본문그림-' + n + '-' + 지문;
      if (!모은것.has(u)) 모은것.set(u, { name: '공고문 그림(쪽에 박힌 그림 ' + n + ')', 점수: 2, 이름믿음: true });
    }
  }

  /* ① <a href="…"> 글 </a> — 가장 흔한 꼴 (충주의료원이 이것입니다) */
  for (const m of s.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const 속글 = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    더하기(m[1], 속글);
  }

  /* ①-2 ★ 2026-10-14 — **자바스크립트가 주소를 만드는 곳.**
     `<a>` 통째로 보고 `href` 든 `onclick` 이든 그 안에서 함수 호출을 찾습니다.
     규칙은 위 `JS주소꼴` 한 자리입니다 — 짐작이 아니라 함수 본문을 읽은 것입니다 */
  for (const m of s.matchAll(/<a\b([^>]*)>([\s\S]{0,300}?)<\/a>/gi)) {
    const 속성 = m[1] || '';
    const 속글 = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    for (const r of JS주소꼴) {
      const g = 속성.replace(/&amp;/g, '&').match(r.꼴);
      if (!g) continue;
      const { url, 받는법 } = r.만들기(g);
      더하기(url, 속글, true, 받는법);
      break;
    }
  }

  /* ② onclick 안에 작은따옴표로 든 주소 — 지침 5절에서 밟은 그 꼴입니다 */
  for (const m of s.matchAll(/onclick\s*=\s*["'][^"']*?['"]([^'"]*?\.(?:hwpx?|pdf|docx?))['"]/gi)) {
    더하기(m[1], '');
  }

  /* ③ href 없이 주소만 든 꼴 (download 경로) */
  for (const m of s.matchAll(/["'](\/[^"']*?(?:download|file|attach)[^"']*?\.(?:hwpx?|pdf|docx?))["']/gi)) {
    더하기(m[1], '');
  }

  return [...모은것].map(([url, v]) => ({ url, name: v.name, 점수: v.점수,
    ...(v.받는법 ? { 받는법: v.받는법 } : {}) }))
    .sort((a, b) => b.점수 - a.점수);
}

/** **공고문이 그림 여러 장일 때 같은 묶음** (2026-11-23 · 원광대학교병원 HS1506666763 — 쪽마다 한 장, 넉 장).
 *  첨부되메우기는 첨부 하나만 골라 읽습니다. 그림 공고문은 1쪽에 자격, 2쪽에 근무조건·보수가 있어 한 장만 읽으면 반쪽입니다.
 *  고른 것이 그림이면 **같은 자리(주소의 폴더)에 있고 이름이 숫자만 다른 그림**을 쪽 차례(이름 차례)로 돌려줍니다 — 고른 것 포함, 많아야 6장.
 *  쪽에 박힌 그림(`#본문그림-N`)은 주소가 쪽 주소라 여기 안 듭니다 */
const 그림파일꼴 = /[.](jpe?g|png|webp)(?:$|[?#&])/i;
function 그림쪽묶음(첨부들, 고른것) {
  const 그림인가 = (a) => !!a && !/#본문그림-/.test(String(a.url || ''))
    && (그림파일꼴.test(String(a.url || '')) || 그림파일꼴.test(String(a.name || '')));
  if (!그림인가(고른것)) return [];
  const 자리 = (u) => String(u || '').split(/[?#]/)[0].replace(/[^/]*$/, '');
  const 꼴 = (n) => String(n || '').replace(/\d+/g, '#');
  const 묶음 = (첨부들 || []).filter((a) => 그림인가(a) && 자리(a.url) === 자리(고른것.url) && 꼴(a.name) === 꼴(고른것.name));
  if (!묶음.some((a) => a.url === 고른것.url)) 묶음.push(고른것);
  if (묶음.length < 2) return [];
  /* 이름이 다 같으면(설명 없는 그림 — 「공고문 그림」) 받은 차례 그대로 · 다르면 숫자를 수로 견줘 쪽 차례 */
  const 이름다름 = new Set(묶음.map((a) => String(a.name || ''))).size > 1;
  const 차례 = 이름다름 ? [...묶음].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko', { numeric: true })) : 묶음;
  return 차례.slice(0, 6);
}

/* 쪽에 박힌 그림 — `<img … src="data:image/png;base64, …">` (2026-11-19 · 인천세종병원) */
const 박힌그림꼴 = /<img\b[^>]*?\bsrc\s*=\s*["']data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)["']/gi;

const 그림지문 = (buf) => require('node:crypto').createHash('sha1').update(buf).digest('hex').slice(0, 10);

/** 쪽 HTML 에서 박힌 그림을 꺼냅니다 — 첨부되메우기가 `#본문그림-N-지문` 주소를 받을 때 씁니다.
 *  차례: ① 지문이 같은 그림 ② (지문이 없던 옛 주소면) N 번째 ③ 지문이 안 맞으면 **그림이 바뀐 것** — 40KB 이상 가운데 가장 큰 것
 *  @returns { buf, 꼴, 바뀜? } 또는 { 왜 } */
function 본문박힌그림(html, n, 지문 = '') {
  const 다 = [];
  for (const m of String(html || '').matchAll(박힌그림꼴)) {
    const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
    다.push({ buf, 꼴: m[1].toLowerCase().replace('jpeg', 'jpg') });
  }
  if (!다.length) return { 왜: '쪽에 박힌 그림이 없습니다' };
  if (지문) {
    const 같은것 = 다.find((g) => 그림지문(g.buf) === 지문);
    if (같은것) return 같은것;
    const 큰것 = 다.filter((g) => g.buf.length >= 40 * 1024).sort((a, b) => b.buf.length - a.buf.length)[0];
    return 큰것 ? { ...큰것, 바뀜: true } : { 왜: '지문이 같은 그림이 없고 큰 그림도 없습니다 (' + 다.length + '개)' };
  }
  const g = 다[Number(n) - 1];
  if (!g) return { 왜: '쪽에 ' + n + '번째 박힌 그림이 없습니다 (' + 다.length + '개)' };
  return g.buf.length ? g : { 왜: '박힌 그림이 비었습니다' };
}

/** **공고가 아닌 첨부**인가 — 쪽 꼬리말의 인증서·배너 (2026-10-21)
 *
 * 광주보훈병원(HS190712781) 의 첨부 셋째가 `wa_qualith_certificate.pdf`
 * = 웹접근성 품질인증서였습니다. 그 안의 「인증기간 : 2026.1.27 ~ 2027.1.26」 이
 * **범위**라서 공고문의 「마감일(2026.10.26.(월) 10:00)」 을 눌렀습니다
 * → 접수마감 2027-01-26 · 마감시각 12:00. 마감을 석 달 늦게 잡으면
 * **지난 공고가 회원 화면에 남습니다.**
 *
 * 날짜만의 문제가 아닙니다 — 지원자격·근무지·연봉까지 같이 더럽힙니다.
 * 목록은 **본 것만** 적습니다 (지침 3절). 늘릴 때 파일 이름을 주석에 남깁니다. */
function 공고아닌첨부(이름, 주소) {
  const t = (String(이름 || '') + ' ' + String(주소 || '')).toLowerCase();
  /* 이름이 기관마다 다릅니다 — 본 것: wa_qualith_certificate.pdf(광주보훈) ·
     wa_busanmc2026.pdf(부산의료원). 둘 다 wa_ 로 시작합니다 (2026-10-22) */
  if (/(?:^|[/\\])wa_[a-z0-9_-]*\.(?:pdf|jpg|jpeg|png|hwp|hwpx)$/i.test(String(이름 || '').trim())) return true;
  /* ★ 2026-11-21 규칙숙제 #7 — 주소 끝 파일 이름도 봅니다 (이름 칸이 링크 글자일 때) */
  if (/[/\\]wa_[a-z0-9_-]*\.(?:pdf|jpg|jpeg|png|hwp|hwpx)(?:[?#]|$)/i.test(String(주소 || '').trim())) return true;
  /* 사이트 공통 파일 — 본 것만 (2026-11-21 사진 대조):
       safe.pdf(포항세명기독 · 쪽 꼬리 「안전」 안내) ·
       「4.블라인드 관련 유의사항.pdf」(서울대병원) ·
       「입사지원서 작성요령 및 안내사항」(원주의료원 · 서울대병원 5~7번)
     ★ 이름에 「공고」·「요강」이 함께 있으면 공고문으로 봅니다 — 「채용공고 및 유의사항.hwp」 같은 합본 */
  const 이름만 = String(이름 || '').trim();
  if (/(?:^|[/\\])safe\.pdf$/i.test(이름만)) return true;
  if (/블라인드|유의\s*사항|작성\s*요령/.test(이름만) && !/공고|요강|모집/.test(이름만)) return true;
  return /wa_qualith|품질\s*인증|정보통신\s*접근성|웹\s*접근성/.test(t);
}

/** **쪽 본문의 큰 그림이 공고문인가** (2026-10-22)
 *
 * 포항세명기독병원은 공고문을 첨부가 아니라 본문 그림으로 올립니다
 * (950×1343 jpg · alt 「채용 공고 - 작업치료001」). 그림은 kordoc 이 OCR 로 읽습니다.
 * 아이콘·배너가 섞이지 않게 **알림말이나 크기**로 가립니다. */
function 그림공고문인가({ src, alt, width, height }) {
  const u = String(src || '');
  const a = String(alt || '');
  if (!u) return false;
  if (/icon|logo|btn|button|banner|sprite|blank|spacer|thumb/i.test(u)) return false;
  const 그림꼴 = /[.](jpe?g|png|webp)(\b|$|[?&])/i.test(u);
  if (!그림꼴) return false;
  /* ★ 2026-10-22 — **글귀만으로는 안 됩니다.** 「공고|채용|모집」 으로 봤더니
     메뉴 그림(alt 「채용안내」·「채용사이트」·「ENGLISH」)이 섞였습니다.
     글귀는 **공고문 꼴**만 봅니다 */
  const 말 = /공고문|채\s*용\s*공고|모\s*집\s*공고|공고\s*[-–—]|공고\s*제?\s*\d/.test(a);
  const 재어둠 = Number(width) > 0 && Number(height) > 0;
  const 큼 = Number(width) >= 600 && Number(height) >= 700;
  /* 크기가 적혀 있으면 **큰 것만** 봅니다 (메뉴 그림은 작습니다).
     크기가 없으면 공고문 꼴 글귀로만 받습니다 */
  if (재어둠) return 큼;
  /* ★ 2026-11-19 — **편집기로 올린 그림**은 설명 글(alt)도 크기도 없이 옵니다 — 아주대 리크루터 채용관
     `<img src="…/upload/76922/image/202611/<uuid>.jpg" style="max-width: 100%…">` (HS1196586464 · 본문이 이 그림 한 장).
     설명 글이 없고 **올린 그림 자리(upload·editor 의 image)** 면 받습니다. 작은 꾸밈 그림은 읽을 때 40KB 뚜껑에서 걸러집니다 */
  if (!a && /\/(?:upload|uploads|data)\/[^?#]*(?:\/image\/|\/editor\/|\/images\/)/i.test(u)) return true;
  return 말 || 큼;
}

/* ── 자기 점검 — 그림 공고문 가름 (2026-10-22) ──
   node tools/hosp/hs_files.js --자기점검   (그물을 안 두드립니다) */
if (require.main === module && process.argv.includes('--자기점검')) {
  let 틀림 = 0;
  const 봐 = (이름, 참) => { if (!참) { 틀림++; console.error('✗ ' + 이름); } };
  봐('950x1343 공고 그림을 받는다', 그림공고문인가({ src: '/x/s.jpg?fid=a', alt: '채용 공고 - 작업치료001', width: 950, height: 1343 }) === true);
  봐('작은 그림은 뺀다', 그림공고문인가({ src: '/x/a.jpg', alt: '채용 공고', width: 120, height: 60 }) === false);
  봐('메뉴 글귀(채용안내)는 뺀다', 그림공고문인가({ src: '/x/m.jpg', alt: '채용안내' }) === false);
  봐('ENGLISH 는 뺀다', 그림공고문인가({ src: '/x/e.jpg', alt: 'ENGLISH' }) === false);
  봐('공고문 글귀는 받는다', 그림공고문인가({ src: '/x/n.jpg', alt: '2026년 채용 공고문' }) === true);
  /* 2026-11-23 설명이 title 에 퍼센트 글자로 (원광대학교병원 HS1506666763 — 넉 장) */
  {
    const t = encodeURIComponent('현대자동차(주)의원물리치료사채용공고문_2026112300');
    const 쪽4 = [1, 2, 3, 4].map((n) => '<img src="/data/userfiles/aaaa-' + n + '.jpg" title="' + t + n + '.jpg" />').join('<br>') + '<img src="/data/builder/logo.jpg" title="logo">';
    const 잡 = hs첨부주소(쪽4, 'https://www.wkuh.org/recruit/jobs/recruit_notice.do?rc_idx=1');
    {
      const 뒤섞음 = [잡[2], 잡[0], 잡[3], 잡[1]];
      const 묶 = 그림쪽묶음(뒤섞음, 뒤섞음[0]);
      봐('그림 넉 장을 쪽 차례로 묶는다', 묶.length === 4 && 묶.map((a) => a.name.slice(-7, -4)).join(',') === '001,002,003,004');
      봐('pdf 를 골랐으면 묶지 않는다', 그림쪽묶음([...잡, { url: 'https://www.wkuh.org/data/a.pdf', name: '공고문.pdf' }], { url: 'https://www.wkuh.org/data/a.pdf', name: '공고문.pdf' }).length === 0);
      봐('그림이 한 장이면 묶지 않는다', 그림쪽묶음([잡[0]], 잡[0]).length === 0);
      봐('다른 폴더·다른 이름 꼴은 안 묶는다', 그림쪽묶음([잡[0], { url: 'https://www.wkuh.org/other/x.jpg', name: 잡[1].name }, { url: 'https://www.wkuh.org/data/userfiles/y.jpg', name: '지원서 양식.jpg' }], 잡[0]).length === 0);
      봐('쪽에 박힌 그림은 안 묶는다', 그림쪽묶음([{ url: 'https://a.kr/v?id=1#본문그림-1-abc', name: '공고문 그림.png' }, { url: 'https://a.kr/v?id=1#본문그림-2-abd', name: '공고문 그림.png' }], { url: 'https://a.kr/v?id=1#본문그림-1-abc', name: '공고문 그림.png' }).length === 0);
    }
    봐('title 의 공고문 이름으로 그림 넉 장을 받는다', 잡.length === 4 && 잡.every((a) => /채용공고문_2026112300[1-4][.]jpg$/.test(a.name)) && /userfiles[/]aaaa-1[.]jpg$/.test(잡.map((a) => a.url).sort()[0]));
  }
  봐('아이콘 길은 뺀다', 그림공고문인가({ src: '/img/icon_file.gif', alt: '채용 공고문', width: 900, height: 900 }) === false);
  봐('웹접근성 인증서는 공고가 아니다', 공고아닌첨부('wa_qualith_certificate.pdf') === true);
  /* 2026-11-19 쪽에 박힌 그림 (인천세종병원 HS69368144 꼴) */
  const 큰그림 = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(50000, 7)]).toString('base64');
  const 쪽 = '<div class="view_con"><img id="photoImage" src="data:image/png;base64, ' + 큰그림 + '" /></div>';
  const 잡은것 = hs첨부주소(쪽, 'http://recruit.example.kr/_page/notice/view?id=26215');
  봐('쪽에 박힌 큰 그림 → 쪽 주소#본문그림-1-지문', 잡은것.length === 1 && /view\?id=26215#본문그림-1-[0-9a-f]{10}$/.test(잡은것[0].url) && 잡은것[0].점수 === 2);
  const 지문1 = 잡은것[0].url.split('-').pop();
  const 배너더함 = '<img src="data:image/png;base64, ' + Buffer.concat([Buffer.from('89504e47', 'hex'), Buffer.alloc(45000, 3)]).toString('base64') + '">' + 쪽;
  봐('위에 배너가 더해져도 지문으로 원래 그림을 찾는다', (본문박힌그림(배너더함, 1, 지문1).buf || Buffer.alloc(0)).length === 50008);
  봐('지문이 안 맞으면 가장 큰 그림 · 바뀜 표시', 본문박힌그림(배너더함, 1, '0000000000').바뀜 === true);
  봐('박힌 그림을 다시 꺼내면 PNG', (본문박힌그림(쪽, 1).buf || Buffer.alloc(0)).subarray(0, 4).toString('hex') === '89504e47');
  봐('작은 박힌 그림(꾸밈)은 안 담는다', hs첨부주소('<img src="data:image/png;base64,iVBORw0KGgo=">', 'http://x.kr/v?id=1').length === 0);
  봐('없는 번호는 왜를 낸다', !!본문박힌그림(쪽, 2).왜);
  봐('편집기로 올린 설명 없는 그림(아주대)은 받는다', 그림공고문인가({ src: 'https://ajoumc.recruiter.co.kr/upload/76922/image/202611/e3e3f814.jpg', alt: '' }) === true);
  봐('편집기 그림이라도 설명이 메뉴 글귀면 뺀다', 그림공고문인가({ src: '/upload/1/image/m.jpg', alt: '채용안내' }) === false);
  /* 2026-11-21 규칙숙제 #7 — 사진 대조에서 「공고문」으로 골라 읽은 공통 파일 (운영 job_attachments 이름 그대로) */
  봐('#7 wa_ 는 주소 끝으로도 가린다', 공고아닌첨부('첨부파일', 'https://www.busanmc.or.kr/busanmc/_Img/Content/wa_busanmc2026.pdf') === true);
  봐('#7 wa_busanmc2026.pdf 점수 -1', 점수('wa_busanmc2026.pdf') === -1);
  봐('#7 블라인드 유의사항은 공고가 아니다', 점수('4.블라인드 관련 유의사항.pdf') === -1);
  봐('#7 safe.pdf 는 공고가 아니다', 점수('safe.pdf') === -1);
  봐('#7 입사지원서 작성요령은 공고가 아니다', 점수('1. 강원특별자치도원주의료원_온라인 입사지원서 작성요령 및 안내사항[37].pdf') === -1);
  봐('#7 부산의료원 — 진짜 공고문이 먼저', ['wa_busanmc2026.pdf', '작업치료사 공고.pdf (276.84 KB)'].sort((a, b) => 점수(b) - 점수(a))[0] === '작업치료사 공고.pdf (276.84 KB)');
  봐('#7 공고 합본(공고+유의사항)은 공고문', 점수('채용공고 및 유의사항.hwp') === 2);
  봐('#7 블라인드 채용 모집요강은 공고문', 점수('2026 블라인드 채용 모집요강.pdf') === 2);
  봐('#7 그냥 이름(cccc.hwp)은 그대로 1', 점수('cccc.hwp') === 1);
  봐('#7 입사지원서는 그대로 0', 점수('●충주의료원입사지원서.hwp') === 0);
  console.log(틀림 ? '★ 자기 점검 ' + 틀림 + '가지 실패' : '○ 자기 점검 통과 — 그림 공고문 가름 15가지 · 그림 여러 장(title 이름 · 쪽 묶음) 6가지 · 공통 파일 가름 10가지');
  process.exit(틀림 ? 1 : 0);
}

module.exports = { hs첨부주소, 점수, 서식말, 공고아닌첨부, 그림공고문인가, 본문박힌그림, 그림쪽묶음 };

/* ── 자기 점검 ───────────────────────────────────────────────── */
if (require.main === module) {
  const 바탕 = 'https://cjmct.or.kr/board/view/syfsx/7141';
  /* 충주의료원 화면에서 실제로 본 꼴 (2026-10-11) */
  const html = [
    '<div class="files">',
    '<a href="/board/download/syfsx/7141/file/1/8496/4ee6cf0d/879bc60d/4ee6cf0d.hwp">',
    '  충주의료원_육아휴직_대체자_[보건직(물리치료사),_행정직]_채용공고(2026.09.04.).hwp</a>',
    '<a href="/board/download/syfsx/7141/file/2/8497/aaaa/bbbb/cccc.hwp">●충주의료원입사지원서.hwp</a>',
    '<a href="/board/view/syfsx/7140">이전 글</a>',
    '</div>',
    '<a href="#" onclick="down(\'/upload/2026/notice.pdf\')">공고문 내려받기</a>',
    /* ★ 2026-10-14 — 그누보드5 꼴. 청주의료원 화면에서 그대로 떼어 왔습니다.
       주소에 확장자가 없고 `&amp;` 가 들어 있으며, 이름 뒤에 크기가 붙습니다 */
    '<a href="https://www.cjmc.or.kr/bbs/download.php?bo_table=recurit_new&amp;wr_id=648&amp;no=0"'
      + ' class="view_file_download"> <img src="/img/icon_file.gif" alt="첨부">'
      + ' <strong>직원채용 공고 1부조리원,시설미화원,작업치료사,물리치료사 및 방사선사.hwp</strong> (135.5K) </a>',
  ].join('\n');

  const r = hs첨부주소(html, 바탕);
  const 어겼나 = [];
  const 봐 = (말, 참) => { if (!참) 어겼나.push(말); };

  봐('넷을 찾는다', r.length === 4);
  /* ★ 2026-10-14 — 그누보드5 꼴 (주소에 확장자 없음 · 이름 뒤에 크기 · &amp;) */
  const 그누 = r.find((x) => /download\.php/.test(x.url));
  봐('그누보드 첨부를 찾는다', !!그누);
  봐('그누보드 주소의 &amp; 를 풀었다',
    !!그누 && !/&amp;/.test(그누.url) && /wr_id=648&no=0$/.test(그누.url));
  봐('그누보드 이름이 공고문 점수', 그누?.점수 === 2);

  /* ★ 2026-10-14 — 자바스크립트가 만드는 주소 · 제 페이지 가리키는 주소는 버립니다.
     성주군(고용24)과 중앙보훈병원 화면에서 그대로 떼어 왔습니다 */
  const 가짜 = hs첨부주소([
    '<a href="javascript:gfn_fileDown(\'성주군 공고.hwpx\',\'5635219160355651\',\'employ/x\')">'
      + '3. 2026년도 제2회 성주군 … 재공고.hwpx</a>',
    '<a href="#no">채용공고문및직무설명서(기간제_10월).pdf</a>',
    '<a href="/real/notice.pdf">진짜 공고문.pdf</a>',
  ].join('\n'), 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=1&nttSn=2');
  봐('javascript: 주소는 그대로 안 담는다', !가짜.some((x) => /^javascript:/i.test(x.url)));
  봐('제 페이지 가리키는 #주소는 안 담는다', !가짜.some((x) => /selectNttInfo\.do/.test(x.url)));
  봐('진짜 주소는 담는다', 가짜.some((x) => /\/real\/notice\.pdf$/.test(x.url)));
  /* ★ 2026-10-14 — 성주군 꼴은 **버리지 않고 만들어 냅니다**(아래 점검 참고).
     그래서 이 묶음에서도 /downFile.do 가 하나 나옵니다 */
  봐('gfn_fileDown 은 /downFile.do 로 바뀐다',
    가짜.some((x) => /\/downFile\.do$/.test(x.url) && x.받는법?.꼴 === 'POST'));

  /* ★ 2026-10-14 — 자바스크립트가 주소를 만드는 두 곳. 화면에서 그대로 떼어 왔고
     함수 본문을 읽어 주소 꼴을 알아낸 것입니다 (docs/첨부주소_자바스크립트_1014.md) */
  const 보훈 = hs첨부주소(
    '<a href="#none" onclick="fn_fileDownload(\'189c72f1443ba8ac00691423b9676704\', \'seoul\')">'
      + '채용공고문및직무설명서(기간제_10월).pdf</a>',
    'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=189986');
  봐('보훈 첨부를 하나 찾는다', 보훈.length === 1);
  봐('보훈 주소 꼴', 보훈[0]?.url
    === 'https://www.bohun.or.kr/common/nttFileDownload.do'
      + '?fileKey=189c72f1443ba8ac00691423b9676704&bbsSysId=seoul');
  봐('보훈은 쿠키가 있어야 한다', 보훈[0]?.받는법?.쿠키 === '상세' && 보훈[0]?.받는법?.꼴 === 'GET');
  봐('보훈 이름이 공고문 점수', 보훈[0]?.점수 === 2);

  const 성주 = hs첨부주소(
    '<a style="word-break:break-all;" href="javascript:gfn_fileDown(\'3. 재공고.hwpx\','
      + '\'5635219160355651\',\'employ/kny940827\')"> 3. 재공고.hwpx</a>',
    'https://www.gojobs.go.kr/apmView.do?empmnsn=304827');
  봐('성주 첨부를 하나 찾는다', 성주.length === 1);
  봐('성주는 POST 로 받는다', 성주[0]?.받는법?.꼴 === 'POST');
  봐('성주 폼 셋', 성주[0]?.받는법?.폼?.uuid === '5635219160355651'
    && 성주[0]?.받는법?.폼?.saveGbn === 'employ/kny940827');
  봐('성주 주소는 /downFile.do', /\/downFile\.do$/.test(성주[0]?.url || ''));
  봐('첫째가 공고문', /채용공고/.test(r[0].name));
  봐('첫째 주소가 온전하다', r[0].url === 'https://cjmct.or.kr/board/download/syfsx/7141/file/1/8496/4ee6cf0d/879bc60d/4ee6cf0d.hwp');
  봐('입사지원서는 점수 0', r.find((x) => /입사지원서/.test(x.name))?.점수 === 0);
  봐('이전 글 링크는 안 센다', !r.some((x) => /board\/view/.test(x.url)));
  봐('onclick 안 주소도 찾는다', r.some((x) => /notice\.pdf$/.test(x.url)));
  봐('점수 높은 것이 먼저', r[0].점수 >= r[r.length - 1].점수);

  if (어겼나.length) {
    console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · '));
    console.error(JSON.stringify(r, null, 1));
    process.exit(1);
  }
  console.log('○ 자기 점검 통과 — 공고문을 먼저 집고, 입사지원서를 뒤로 보냅니다');
  for (const x of r) console.log('   [' + x.점수 + '] ' + x.name.slice(0, 56) + '  ' + x.url.slice(0, 70));
}
