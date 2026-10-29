/* 긁기 — **목록 읽기 함수 한 자리** (2026-10-24 · 지침 6절)
 *
 * 왜 떼어 냈나 — `그누보드.mjs`·`표준게시판.mjs` 는 **들여오면 바로 긁기를 시작합니다**
 * (맨 바깥에서 돕니다). 그래서 다른 도구(`한바퀴표.mjs`)가 읽기 함수만 쓸 수 없었습니다.
 * `오류잡기_1023.mjs` 에서 같은 일을 겪었습니다 (들여오기만으로 부르는 쪽이 끝났습니다).
 */

export const 엔티티풀기 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
export const 꼬리말 = /\s*(?:채용\s*공고)?\s*상세\s*보기\s*$|\s*새글\s*$|\s*N\s*$|\s*\[?알림\]?\s*$/;
export const 메뉴말 = /^(?:더\s*보기|목\s*록|처음|이전|다음|맨\s*끝|검\s*색|닫\s*기|자세히|바로가기|home|list|more)$/i;
export const 번호열쇠 = /(?:^|[?&])(?:seq|seqno|seq_no|nttSn|ntt_sn|wr_id|bbsSeq|bbs_seq|brd_no|brdNo|idx|no|num|articleNo|article_no|bno|boardSeq|board_seq|id|pk)=(\d{1,12})(?:&|$)/i;
export const 자바열쇠 = /(?:fn?View|goView|view_?detail|boardView|viewPage|detail)\s*\(\s*['"]?(\d{1,12})['"]?/i;

/** 그 줄(tr·li) 안에서만 날짜를 찾습니다 — 창을 넓히면 **윗줄 날짜**가 붙습니다 */
export function 줄안의날(t, 자리, 길이) {
  const 앞 = Math.max(t.lastIndexOf('<tr', 자리), t.lastIndexOf('<li', 자리));
  const 뒤끝 = t.slice(자리).search(/<\/tr>|<\/li>/i);
  const 창 = 앞 >= 0 && 뒤끝 >= 0 ? t.slice(앞, 자리 + 뒤끝)
    : t.slice(Math.max(0, 자리 - 150), 자리 + 길이 + 150);
  const m = 창.match(/(20\d\d)[-.\/](\d{1,2})[-.\/](\d{1,2})/);
  return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : null;
}

/** 그누보드 꼴 — `/bbs/board.php?…wr_id=NNN` */
export function 그누읽기(html, 바탕) {
  const t = String(html || '');
  const 본것 = new Set();
  const 낸것 = [];
  const re = /<a[^>]+href=["']([^"']*wr_id=(\d+)[^"']*)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
  for (const m of t.matchAll(re)) {
    const [, 날주소, wr, 속] = m;
    if (본것.has(wr)) continue;
    /* 태그를 먼저 걷고 엔티티를 풉니다 (거꾸로 하면 「&lt;제26-12회&gt;」 가 태그로 걷힙니다) */
    const 제목 = 엔티티풀기(String(속).replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ').trim().replace(꼬리말, '').trim();
    if (!제목 || 제목.length < 4) continue;
    본것.add(wr);
    let 주소 = 엔티티풀기(날주소);
    try { 주소 = new URL(주소, 바탕).toString(); } catch { /* 그대로 */ }
    /* `자리`·`창길이` 는 **진단용**입니다 (2026-10-29) — 날짜를 왜 못 집었나 볼 때
       원문에서 그 줄이 어디인지 알아야 합니다. 긁기 쪽은 이 칸을 안 씁니다 */
    낸것.push({ wr, 번호: wr, 제목, 주소, 올린날: 줄안의날(t, m.index, m[0].length),
      자리: m.index, 창길이: m[0].length });
  }
  return 낸것;
}

/** 표준게시판 꼴 — 글 번호가 든 링크(seq·nttSn·brd_no…)나 javascript 번호 */
export function 표준읽기(html, 바탕) {
  const t = String(html || '');
  const 본것 = new Set();
  const 낸것 = [];
  for (const m of t.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi)) {
    const [, 날주소, 속] = m;
    const 주소글 = 엔티티풀기(날주소);
    const 번호 = (주소글.match(번호열쇠) || [])[1] || (주소글.match(자바열쇠) || [])[1]
      || (String(m[0]).match(자바열쇠) || [])[1];
    if (!번호) continue;
    if (/\.(?:css|js|png|jpe?g|gif|svg|ico|woff2?|ttf|zip|pdf|hwpx?)(?:[?#]|$)/i.test(주소글)) continue;
    const 제목 = 엔티티풀기(String(속).replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ').trim().replace(꼬리말, '').trim();
    if (제목.length < 6 || 메뉴말.test(제목)) continue;
    const 열쇠 = 번호 + '|' + 제목.slice(0, 20);
    if (본것.has(열쇠)) continue;
    본것.add(열쇠);
    let 주소 = 주소글;
    if (/^javascript:/i.test(주소)) 주소 = 바탕;      /* POST 로 여는 쪽 — 목록 주소를 둡니다 */
    else { try { 주소 = new URL(주소, 바탕).toString(); } catch { /* 그대로 */ } }
    /* `자리`·`창길이` — 진단용 (위 그누읽기와 같은 까닭) */
    낸것.push({ 번호, 제목, 주소, 올린날: 줄안의날(t, m.index, m[0].length),
      자리: m.index, 창길이: m[0].length });
  }
  return 낸것;
}

/* ── 「채용 게시판 목록인가」 울타리 넷 (2026-10-28 세중님 1번) ───────────────
 * 전에는 「목록 줄이 **하나라도** 나오면 게시판」이었습니다. 그래서 —
 *   · 기관 **첫 화면**(main.do · index.jsp)이 공지 목록 때문에 통과했습니다 (5곳)
 *   · **글 하나**(mode=view&idx=62)인 쪽도 줄이 하나 나와 통과했습니다 (1곳)
 *   · 분원이 본원과 **같은 주소**를 받았습니다 (인천의료원 ↔ 백령병원)
 * 21곳 가운데 일곱이 그렇게 들어와 있었습니다 (docs/1층넓히기_1028.md ⑥).
 * ★ 넷째(같은 주소 두 기관)는 주소만 보고 알 수 없어 **표를 보는 쪽**에서 봅니다 —
 *   여기서는 ㉠㉡㉢ 만 보고, 넷째는 담는 도구가 `같은주소쓰는기관()` 으로 가립니다.
 */
export const 글하나꼴 =
  /[?&](?:mode=view|mode=read|wr_id|idx|nttSn|ntt_sn|articleNo|article_no|bbsIdx|bIdx|seq|seqno|num|no)=\d/i;
export const 첫화면꼴 =
  /^https?:\/\/[^/]+\/?$|\/(?:main|index|default|home)(?:\.(?:do|jsp|php|html?|aspx?))?(?:\?.*)?$/i;

export function 게시판인가(주소, 줄들) {
  const 줄 = Array.isArray(줄들) ? 줄들 : [];
  /* ㉠ 글 하나를 가리키는 주소는 목록이 아닙니다 */
  if (글하나꼴.test(주소)) return { 됨: false, 왜: '글 하나 꼴 주소' };
  /* ㉢ 첫 화면은 게시판이 아닙니다 (공지 목록이 있어도) */
  if (첫화면꼴.test(주소)) return { 됨: false, 왜: '첫 화면' };
  /* ㉡ 줄이 둘 이상이고 **글 번호가 서로 달라야** 합니다 */
  if (줄.length < 2) return { 됨: false, 왜: '목록 줄 ' + 줄.length + '개 (둘 이상이어야)' };
  const 번호들 = new Set(줄.map((x) => x && x.번호).filter(Boolean));
  if (번호들.size < 2) return { 됨: false, 왜: '글 번호가 ' + 번호들.size + '가지 (둘 이상이어야)' };
  return { 됨: true, 왜: '줄 ' + 줄.length + ' · 글 번호 ' + 번호들.size + '가지' };
}

/** 꼴을 가리는 자 — 게시판 주소로 **어느 읽기**로 긁을지 (2026-10-24 곳들만들기 에 있던 것)
 *  ★ 2026-10-28 에 여기로 옮겼습니다. 곳들만들기.mjs 는 **들여오면 바로 돌아서**
 *    다른 도구가 이 자만 빌려 쓸 수 없었습니다 (표준게시판.mjs 가 읽기를 떼어 낸 것과 같은 까닭) */
export const 꼴가리기 = {
  그누보드: (주소) => /\/bbs\/board\.php\?/.test(주소),
  경기도의료원: (주소) => /medical\.or\.kr\/front\/boardList\.do/.test(주소),
  표준게시판: (주소) => !/\/bbs\/board\.php\?/.test(주소)
    && !/medical\.or\.kr\/front\/boardList\.do/.test(주소),
};
export const 꼴정하기 = (주소) => (꼴가리기.그누보드(주소) ? '그누보드'
  : (꼴가리기.경기도의료원(주소) ? '경기도의료원' : '표준게시판'));
