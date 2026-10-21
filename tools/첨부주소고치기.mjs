/* 첨부 주소 **바로잡기 한 자리** (2026-10-21 세중님 — 받는 길)
 *
 *   node tools/첨부주소고치기.mjs            자기 점검
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 능력시험에서 「HTML 이 옴」 12건을 열어 보니 **받는 길이 없어서가 아니었습니다.**
 * 거의 다 **같은 파일을 가리키는 잘못된 주소 줄**이고, 참 파일은 이미 다른
 * 줄로 받고 있었습니다 (`원문/<id>/사실.json` 에 나란히 있습니다) —
 *
 *   ① 알리오 5건  opendata.alio.go.kr/recruit/downloadAtchFile?recrutAtchFileNo=3079884
 *                 → 포털 첫 화면 8,333자 HTML.
 *                 같은 번호로 www.alio.go.kr/download/download.json?fileNo=3079884
 *                 를 부르면 **141,027바이트 PDF** 가 옵니다 (쿠키 필요 없음 · Referer 만)
 *   ② 클린아이 3건 job.cleaneye.go.kr/user/ypCareersData.do?idx=80464
 *                 → 그것은 **상세 쪽 주소**입니다. 파일이 아닙니다.
 *                 참 파일은 POST /file/FileDownload.do 로 이미 받고 있습니다
 *   ③ 보훈 1건    /common/nttFileDownload.do?fileKey=   ← 열쇠가 **빈 줄**
 *   ④ allspine 1건 https://allspine.com/home/hosting_users/allspine1/www/…/apply.zip
 *                 ← 서버 **파일 경로**를 주소로 붙인 것 (203바이트 오류 쪽이 옵니다)
 *   ⑤ 제주대 3건  /mayeye/FileViewer.do?atchFileId=… · /pdf.js/web/viewer.html?file=…
 *                 → 뷰어 쪽입니다. `viewer.html?file=` 은 **그 안에 참 경로**가 있습니다
 *
 * 그래서 새 길을 만들기보다 **주소를 고치거나 버리는** 것이 맞습니다.
 * 담는 자리(수집기)와 쓰는 자리(첨부되메우기)가 **같은 이 함수**를 씁니다 (지침 6절).
 *
 * ★ 짐작으로 주소를 만들지 않습니다 (지침 3절) — ①은 같은 번호로 실제로 받아
 *   앞 바이트까지 본 것이고(`%PDF`), 나머지는 **버리는** 규칙입니다.
 */

/** 뷰어 주소에 든 참 파일 경로 — `viewer.html?file=/경로/파일.PDF` */
export function 뷰어속참경로(주소) {
  const s = String(주소 || '');
  if (!/viewer\.html/i.test(s)) return null;
  const m = s.match(/[?&]file=([^&]+)/i);
  if (!m) return null;
  let v = m[1];
  try { v = decodeURIComponent(v); } catch { /* 그대로 */ }
  if (!v || /^https?:\/\//i.test(v) === false && !v.startsWith('/')) return null;
  return v;
}

/** 서버 파일 경로가 주소에 박힌 것 — 받을 수 없습니다 */
export const 서버경로꼴 = /\/(?:home|var|usr|data)\/(?:hosting_users|www|html|webapps)\//i;

/**
 * 첨부 주소 하나를 바로잡습니다.
 * @returns { url, 받는법? , 왜 }  고친 주소 · 그대로면 왜 없음
 *          { 버릴것: true, 왜 }   파일이 아니거나 받을 수 없는 줄
 */
/**
 * 주소 꼴로 **받는 법**을 가립니다 (2026-10-21 세중님 4번)
 *
 * 실측 — job_attachments 를 갈래로 세어 보니
 *   고용24  /downFile.do?filenm=..&uuid=..&saveGbn=..   144줄 · **GET 으로 받아집니다**
 *           (폼 값이 **쿼리 문자열로** 담겨 있어 POST 가 필요 없습니다)
 *   보훈    /common/nttFileDownload.do?fileKey=..        14줄 · 탈 0 (쿠키 없이도 옵니다)
 *   그누보드 /bbs/download.php?bo_table=..               105줄 · **탈 7건이 「HTML 이 왔다」**
 *           → 그누보드는 **상세 쪽 쿠키와 Referer** 를 봅니다 (지침 — 받는 길 ①)
 *   클린아이 /file/FileDownload.do                        3줄 · 폼 값이 주소에 없어 못 받습니다
 *           (받는 길은 collect-cleaneye 안에 있습니다 — 거기서는 받아집니다)
 */
/** 그누보드 첨부 주소의 **nonce 를 쪽글에서 새로** 읽습니다 (2026-10-22)
 *
 *  `nonce=<열쇠>|<때>|<해시>` 의 가운데가 때입니다. 쪽을 열 때 세션에 맞춰
 *  만들어지므로 DB 에 담아 둔 주소는 죽습니다 (받아 보면 5~6KB HTML).
 *  그래서 **같은 bo_table·wr_id·no** 를 가리키는 주소를 쪽글에서 찾아 바꿉니다.
 *  못 찾으면 **원래 주소를 그대로** 돌려줍니다 (지어내지 않습니다).
 */
export function 그누보드새주소(주소, 쪽글) {
  const s = String(주소 || '');
  if (!/download[.]php/i.test(s)) return s;
  const 값 = (이름, 글) => {
    const m = String(글).match(new RegExp('[?&]' + 이름 + '=([^&"\'<>\\s]*)'));
    return m ? m[1] : '';
  };
  const 표 = 값('bo_table', s); const wr = 값('wr_id', s); const no = 값('no', s);
  if (!표 || !wr) return s;
  for (const m of String(쪽글 || '').matchAll(/https?:\/\/[^"'<>\s]*download\.php[^"'<>\s]*/g)) {
    const u = m[0].replace(/&amp;/g, '&');
    if (값('bo_table', u) !== 표 || 값('wr_id', u) !== wr) continue;
    if (no && 값('no', u) && 값('no', u) !== no) continue;
    return u;
  }
  return s;
}

export function 받는법가리기(주소, 바탕 = '') {
  const s = String(주소 || '');
  if (/download[.]php/i.test(s)) {
    return { 꼴: 'GET', 쿠키: '상세', Referer: 바탕 || undefined,
      왜: '그누보드는 상세 쪽 쿠키와 Referer 를 봅니다' };
  }
  if (/nttFileDownload[.]do/i.test(s)) {
    return { 꼴: 'GET', Referer: 바탕 || undefined, 왜: '보훈은 Referer 를 봅니다' };
  }
  if (/[/]file[/]FileDownload[.]do/i.test(s)) {
    return { 꼴: 'POST못함', 왜: '클린아이는 폼 세 값이 있어야 합니다 — 주소만으로는 못 받습니다' };
  }
  return null;
}

export function 고친주소(주소, 바탕 = '') {
  const s = String(주소 || '').trim();
  if (!s) return { 버릴것: true, 왜: '주소가 없습니다' };

  /* ① 알리오 — opendata 내려받기 주소는 포털 첫 화면을 줍니다.
     같은 번호를 www.alio.go.kr/download/download.json?fileNo= 로 부릅니다 */
  const 알 = s.match(/opendata\.alio\.go\.kr\/recruit\/downloadAtchFile\?recrutAtchFileNo=(\d+)/i);
  if (알) {
    return {
      url: 'https://www.alio.go.kr/download/download.json?fileNo=' + 알[1],
      받는법: { 꼴: 'GET', Referer: 'https://www.alio.go.kr/' },
      왜: 'opendata 내려받기는 포털 첫 화면을 줍니다 — 같은 번호로 download.json',
    };
  }

  /* ② 상세 쪽 주소가 첨부 줄에 들어온 것 — 파일이 아닙니다 */
  if (/job\.cleaneye\.go\.kr\/user\/\w+\.do/i.test(s)
    || /job\.alio\.go\.kr\/recruitview\.do/i.test(s)
    || (바탕 && s.split('#')[0] === String(바탕).split('#')[0])) {
    return { 버릴것: true, 왜: '상세 쪽 주소입니다 — 파일이 아닙니다' };
  }

  /* ③ 열쇠가 빈 내려받기 주소 */
  if (/[?&](?:fileKey|fileNo|atchFileId|fileUid|recrutAtchFileNo)=(?:&|$)/i.test(s)) {
    return { 버릴것: true, 왜: '열쇠가 빈 주소입니다' };
  }

  /* ④ 서버 파일 경로를 주소로 붙인 것 */
  if (서버경로꼴.test(s)) {
    return { 버릴것: true, 왜: '서버 파일 경로입니다 — 그물 주소가 아닙니다' };
  }

  /* ⑤ 뷰어 주소 — 안에 든 참 경로로 바꿉니다 */
  const 속 = 뷰어속참경로(s);
  if (속) {
    let u = 속;
    if (!/^https?:\/\//i.test(u)) {
      try { u = new URL(u, 바탕 || s).toString(); } catch { return { url: s }; }
    }
    return { url: u, 왜: '뷰어가 품은 참 파일 경로' };
  }

  /* 고칠 것이 없으면 **받는 법만** 붙여 돌려줍니다 */
  const 법 = 받는법가리기(s, 바탕);
  return 법 ? { url: s, 받는법: 법, 왜: 법.왜 } : { url: s };
}

/* ── 자기 점검 ───────────────────────────────────────────────── */
if (import.meta.url === ('file://' + process.argv[1]) || process.argv[1]?.endsWith('첨부주소고치기.mjs')) {
  const 탈 = [];
  const 봐 = (말, 참) => { if (!참) 탈.push(말); };

  const a = 고친주소('https://opendata.alio.go.kr/recruit/downloadAtchFile?recrutAtchFileNo=3079884');
  봐('알리오 — download.json 으로 바뀐다',
    a.url === 'https://www.alio.go.kr/download/download.json?fileNo=3079884');
  봐('알리오 — Referer 가 붙는다', a.받는법?.Referer === 'https://www.alio.go.kr/');

  봐('클린아이 상세 쪽은 버린다',
    고친주소('https://job.cleaneye.go.kr/user/ypCareersData.do?idx=80464').버릴것 === true);
  봐('알리오 상세 쪽도 버린다',
    고친주소('https://job.alio.go.kr/recruitview.do?idx=305876').버릴것 === true);
  봐('바탕과 같은 주소는 버린다',
    고친주소('https://a.kr/view.do?x=1', 'https://a.kr/view.do?x=1').버릴것 === true);

  봐('빈 열쇠는 버린다',
    고친주소('https://www.bohun.or.kr/common/nttFileDownload.do?fileKey=').버릴것 === true);
  봐('빈 열쇠 — 뒤에 다른 값이 와도',
    고친주소('https://a.kr/d.do?fileKey=&bbsSysId=seoul').버릴것 === true);
  봐('찬 열쇠는 안 버린다',
    고친주소('https://www.bohun.or.kr/common/nttFileDownload.do?fileKey=84f6&bbsSysId=gwangju').url
      === 'https://www.bohun.or.kr/common/nttFileDownload.do?fileKey=84f6&bbsSysId=gwangju');

  봐('서버 파일 경로는 버린다',
    고친주소('https://allspine.com/home/hosting_users/allspine1/www/common/recruit/apply.zip').버릴것 === true);

  const v = 고친주소('https://www.jejunuh.co.kr/module/pdf.js/web/viewer.html?file=/thumbnail/rcrutPbanc/x_202609290104075100.PDF');
  봐('뷰어가 품은 참 경로로 바꾼다',
    v.url === 'https://www.jejunuh.co.kr/thumbnail/rcrutPbanc/x_202609290104075100.PDF');
  봐('뷰어 — %2F 로 감싼 것도 푼다',
    고친주소('https://a.kr/web/viewer.html?file=%2Fupload%2Fa.pdf').url === 'https://a.kr/upload/a.pdf');

  봐('그냥 파일 주소는 그대로',
    고친주소('https://cjmct.or.kr/board/download/syfsx/7141/file/1/8496/a/b/c.hwp').url
      === 'https://cjmct.or.kr/board/download/syfsx/7141/file/1/8496/a/b/c.hwp');
  /* ★ 2026-10-22 — nonce 새로 읽기 (셋째 표본 · 청주성모병원) */
  봐('쪽글의 새 nonce 로 바꾼다', 그누보드새주소(
    'https://a.kr/bbs/download.php?bo_table=t&wr_id=48&no=0&nonce=옛것|1|aa',
    '<a href="https://a.kr/bbs/download.php?bo_table=t&amp;wr_id=48&amp;no=0&amp;nonce=새것|2|bb">공고문</a>')
    === 'https://a.kr/bbs/download.php?bo_table=t&wr_id=48&no=0&nonce=새것|2|bb');
  봐('다른 글의 주소는 안 쓴다', 그누보드새주소(
    'https://a.kr/bbs/download.php?bo_table=t&wr_id=48&no=0&nonce=옛것|1|aa',
    '<a href="https://a.kr/bbs/download.php?bo_table=t&amp;wr_id=99&amp;no=0&amp;nonce=새것|2|bb">딴 글</a>')
    === 'https://a.kr/bbs/download.php?bo_table=t&wr_id=48&no=0&nonce=옛것|1|aa');
  봐('그누보드가 아니면 그대로',
    그누보드새주소('https://a.kr/x.pdf', '<a href="https://a.kr/bbs/download.php?bo_table=t&wr_id=1">x</a>')
      === 'https://a.kr/x.pdf');
  봐('그누보드 주소는 그대로',
    고친주소('https://www.cjmc.or.kr/bbs/download.php?bo_table=recurit_new&wr_id=648&no=0').url
      === 'https://www.cjmc.or.kr/bbs/download.php?bo_table=recurit_new&wr_id=648&no=0');
  봐('클린아이 POST 주소는 그대로',
    고친주소('https://job.cleaneye.go.kr/file/FileDownload.do').url
      === 'https://job.cleaneye.go.kr/file/FileDownload.do');
  봐('빈 주소는 버린다', 고친주소('').버릴것 === true);

  /* 받는법 가리기 (2026-10-21) */
  봐('그누보드는 상세 쿠키·Referer', (() => { const g = 고친주소('https://a.kr/bbs/download.php?bo_table=t&wr_id=1', 'https://a.kr/view?x=1');
    return g.받는법 && g.받는법.쿠키 === '상세' && g.받는법.Referer === 'https://a.kr/view?x=1'; })());
  봐('보훈은 Referer 만', (() => { const g = 고친주소('https://www.bohun.or.kr/common/nttFileDownload.do?fileKey=ab12', 'https://www.bohun.or.kr/v?mi=1');
    return g.받는법 && !g.받는법.쿠키 && /bohun/.test(g.받는법.Referer || ''); })());
  봐('클린아이 POST 는 못 받는다고 표시', 고친주소('https://job.cleaneye.go.kr/file/FileDownload.do').받는법?.꼴 === 'POST못함');
  봐('고용24 쿼리 꼴은 그냥 GET', !고친주소('https://www.gojobs.go.kr/downFile.do?filenm=a.hwp&uuid=1&saveGbn=x').받는법);

  if (탈.length) {
    console.error('✗ 자기 점검 실패 ' + 탈.length + '가지 — ' + 탈.join(' · '));
    process.exit(1);
  }
  console.log('○ 첨부주소고치기 자기 점검 통과 — 22가지 (그물을 안 두드렸습니다)');
}
