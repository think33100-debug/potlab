/* 상세 HTML 에서 **본문 영역만** 잘라냅니다 (2026-10-17 세중님 2-②).
 *
 *   왜 — collect-hosp 는 지금 페이지 **전체**에서 태그만 걷습니다. 그래서
 *   왼쪽 메뉴가 본문으로 들어옵니다. 강진의료원 906자짜리가 「의료원소개
 *   병원소개 원장님인사말 연혁 …」 이었습니다 (docs/1층_본문없음_29건_진단_1014.md).
 *   본문이 메뉴뿐인 공고가 **36건 / 20기관** 입니다.
 *
 *   의존성을 쓰지 않습니다 — CLAUDE.md 가 저장소 package.json 을 일부러
 *   안 올립니다(서버에서 npm install 이 playwright 까지 받으려 합니다).
 *   그래서 **여는 태그 ↔ 닫는 태그만 세는 최소 추출기**입니다.
 *
 *   쓰는 꼴 (사이트 설정 cfgs/*.json 의 `본문선택자`)
 *     "#bo_v_con"        id
 *     ".board_view"      class
 *     "td.view_content"  태그+class
 *     ["#content", ".view"]   여러 개 — 먼저 맞는 것
 *
 *   못 찾으면 **null 을 돌려줍니다.** 부르는 쪽이 「그러면 전체를 쓴다」를
 *   정합니다 — 여기서 몰래 전체를 돌려주면 선택자가 틀려도 안 드러납니다.
 *
 *   자기 점검 ·  node tools/hosp/본문자르기.mjs
 */

/* 선택자 하나를 { tag, id, cls } 로 */
function 쪼개기(sel) {
  const s = String(sel || '').trim();
  const m = s.match(/^([a-zA-Z][\w-]*)?(?:#([\w-]+))?(?:\.([\w-]+))?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return { tag: m[1] ? m[1].toLowerCase() : null, id: m[2] || null, cls: m[3] || null };
}

/* 여는 태그가 선택자에 맞나 */
function 맞나(여는, p) {
  const tag = (여는.match(/^<\s*([a-zA-Z][\w-]*)/) || [])[1];
  if (!tag) return false;
  if (p.tag && tag.toLowerCase() !== p.tag) return false;
  if (p.id) {
    const id = (여는.match(/\sid\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (id !== p.id) return false;
  }
  if (p.cls) {
    const c = (여는.match(/\sclass\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (!c.split(/\s+/).includes(p.cls)) return false;
  }
  return true;
}

/** html 에서 선택자에 맞는 첫 덩어리의 **안쪽 HTML** · 못 찾으면 null */
export function 본문자르기(html, 선택자) {
  const 목록 = Array.isArray(선택자) ? 선택자 : [선택자];
  for (const sel of 목록) {
    const p = 쪼개기(sel);
    if (!p) continue;
    const 태그들 = /<\s*([a-zA-Z][\w-]*)([^>]*)>|<\s*\/\s*([a-zA-Z][\w-]*)\s*>/g;
    let m;
    태그들.lastIndex = 0;
    while ((m = 태그들.exec(html))) {
      if (m[3]) continue;                                   /* 닫는 태그 */
      const 여는 = m[0];
      if (여는.endsWith('/>')) continue;                     /* 혼자 닫는 태그 */
      if (!맞나(여는, p)) continue;
      const 이름 = m[1].toLowerCase();
      /* 같은 이름의 여는/닫는 태그를 세며 짝을 찾습니다 */
      let 깊이 = 1;
      const 안쪽시작 = 태그들.lastIndex;
      const 안 = new RegExp('<\\s*(/?)' + 이름 + '(?=[\\s>/])[^>]*>', 'gi');
      안.lastIndex = 안쪽시작;
      let n;
      while ((n = 안.exec(html))) {
        if (n[0].endsWith('/>')) continue;
        깊이 += n[1] ? -1 : 1;
        if (깊이 === 0) return html.slice(안쪽시작, n.index);
      }
      return html.slice(안쪽시작);                            /* 닫는 태그가 없으면 끝까지 */
    }
  }
  return null;
}

/* ── 자기 점검 ───────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('본문자르기.mjs')) {
  const 어겼나 = [];
  const 봐 = (이름, 참) => { if (!참) 어겼나.push(이름); };

  const 쪽 = `<html><body>
    <div id="lnb"><ul><li>병원소개</li><li>진료과</li></ul></div>
    <div class="board_view"><p>물리치료사 1명</p><div class="inner">접수 2026-10-20</div></div>
    <div id="footer">주소 서울</div></body></html>`;

  봐('id 로 자른다', /병원소개/.test(본문자르기(쪽, '#lnb') || ''));
  봐('class 로 자른다', /물리치료사/.test(본문자르기(쪽, '.board_view') || ''));
  봐('같은 이름 안쪽 태그를 세어 끝을 맞춘다',
    /접수 2026-10-20/.test(본문자르기(쪽, '.board_view') || ''));
  봐('본문만 — 메뉴를 안 먹는다', !/병원소개/.test(본문자르기(쪽, '.board_view') || ''));
  봐('본문만 — 바닥글을 안 먹는다', !/주소 서울/.test(본문자르기(쪽, '.board_view') || ''));
  봐('태그+class', /물리치료사/.test(본문자르기(쪽, 'div.board_view') || ''));
  봐('틀린 태그면 안 맞는다', 본문자르기(쪽, 'td.board_view') === null);
  봐('못 찾으면 null', 본문자르기(쪽, '#없는것') === null);
  봐('여러 개 — 먼저 맞는 것', /물리치료사/.test(본문자르기(쪽, ['#없는것', '.board_view']) || ''));
  봐('빈 선택자는 null', 본문자르기(쪽, '') === null);
  /* 혼자 닫는 태그가 깊이를 흔들면 안 됩니다 */
  봐('<br/> 가 깊이를 안 흔든다',
    /끝까지/.test(본문자르기('<div class="v">가운데<br/>끝까지</div><div>뒤</div>', '.v') || ''));
  봐('<br/> 뒤 덩어리를 안 먹는다',
    !/뒤/.test(본문자르기('<div class="v">가운데<br/>끝까지</div><div>뒤</div>', '.v') || ''));

  if (어겼나.length) {
    console.error('✗ 자기 점검 실패 — ' + 어겼나.join(' · '));
    process.exit(1);
  }
  console.log('○ 자기 점검 통과 — 본문만 자르고 메뉴·바닥글은 안 가져옵니다 (12가지)');
}
