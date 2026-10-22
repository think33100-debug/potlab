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
function 점수(이름) {
  const s = String(이름 || '');
  /* ★ 2026-10-22 세중님 추가 2번 — **이 함수가 첨부 고르는 순서 한 자리입니다.**
     전에는 같은 규칙이 **다섯 벌**이었습니다 (첨부되메우기·collect-nara·GJ2보류읽기·
     나라일터_직군근거·첨부한건확인). 벌마다 낱말이 달라서 「자기소개서」가 한쪽에서는
     0점, 다른 쪽에서는 1점이었습니다. 전수 마른 실행 — 첨부 있는 공고 1,153건 중
     고를 것이 바뀌는 것 **1건**(회원 화면 0건) */
  if (/지원서|응시원서|서식|양식|이력서|자기소개|명세서|직무기술|제출서류/.test(s)) return 0;
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
    const src = 집('src'); const alt = 집('alt');
    if (!그림공고문인가({ src, alt, width: 집('width'), height: 집('height') })) continue;
    더하기(src, alt || '공고문 그림', true, null, true);
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
  봐('아이콘 길은 뺀다', 그림공고문인가({ src: '/img/icon_file.gif', alt: '채용 공고문', width: 900, height: 900 }) === false);
  봐('웹접근성 인증서는 공고가 아니다', 공고아닌첨부('wa_qualith_certificate.pdf') === true);
  console.log(틀림 ? '★ 자기 점검 ' + 틀림 + '가지 실패' : '○ 자기 점검 통과 — 그림 공고문 가름 7가지');
  process.exit(틀림 ? 1 : 0);
}

module.exports = { hs첨부주소, 점수, 공고아닌첨부, 그림공고문인가 };

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
