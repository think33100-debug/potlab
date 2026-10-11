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

/** 첨부로 쓸 확장자 */
const 쓸꼴 = /\.(hwpx?|pdf|docx?)(\?|$)/i;

/** 이름으로 본 쓸모 — 높을수록 공고문에 가깝습니다 */
function 점수(이름) {
  const s = String(이름 || '');
  if (/지원서|응시원서|서식|양식|이력서|자기소개|명세서|직무기술/.test(s)) return 0;
  if (/공고|모집|채용/.test(s)) return 2;
  return 1;
}

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
  const 더하기 = (주소, 이름, 이름믿음) => {
    const u = 온전히(주소, 바탕주소);
    if (!u) return;
    /* 확장자가 주소에도 이름에도 없으면 안 씁니다 */
    if (!쓸꼴.test(u) && !쓸꼴.test(이름 || '')) return;
    const 준이름 = String(이름 || '').trim();
    const nm = 준이름 || (u.split('/').pop() || '').slice(0, 120);
    const 전 = 모은것.get(u);
    if (전 && (전.이름믿음 || !이름믿음)) return;      /* 이미 믿을 이름이 있으면 그대로 */
    모은것.set(u, { name: nm, 점수: 점수(nm), 이름믿음: !!이름믿음 && !!준이름 });
  };

  /* ① <a href="…"> 글 </a> — 가장 흔한 꼴 (충주의료원이 이것입니다) */
  for (const m of s.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const 속글 = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    더하기(m[1], 속글);
  }

  /* ② onclick 안에 작은따옴표로 든 주소 — 지침 5절에서 밟은 그 꼴입니다 */
  for (const m of s.matchAll(/onclick\s*=\s*["'][^"']*?['"]([^'"]*?\.(?:hwpx?|pdf|docx?))['"]/gi)) {
    더하기(m[1], '');
  }

  /* ③ href 없이 주소만 든 꼴 (download 경로) */
  for (const m of s.matchAll(/["'](\/[^"']*?(?:download|file|attach)[^"']*?\.(?:hwpx?|pdf|docx?))["']/gi)) {
    더하기(m[1], '');
  }

  return [...모은것].map(([url, v]) => ({ url, name: v.name, 점수: v.점수 }))
    .sort((a, b) => b.점수 - a.점수);
}

module.exports = { hs첨부주소, 점수 };

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
  ].join('\n');

  const r = hs첨부주소(html, 바탕);
  const 어겼나 = [];
  const 봐 = (말, 참) => { if (!참) 어겼나.push(말); };

  봐('셋을 찾는다', r.length === 3);
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
