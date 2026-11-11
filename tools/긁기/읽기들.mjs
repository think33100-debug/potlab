/* 긁기 — **목록 읽기 함수 한 자리** (2026-10-24 · 지침 6절)
 *
 * 왜 떼어 냈나 — `그누보드.mjs`·`표준게시판.mjs` 는 **들여오면 바로 긁기를 시작합니다**
 * (맨 바깥에서 돕니다). 그래서 다른 도구(`한바퀴표.mjs`)가 읽기 함수만 쓸 수 없었습니다.
 * `오류잡기_1023.mjs` 에서 같은 일을 겪었습니다 (들여오기만으로 부르는 쪽이 끝났습니다).
 */

export const 엔티티풀기 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  /* ★ 2026-11-11 — 숫자 꼴(&#45380; · &#xBCF4;)도 풉니다. 수원시 보건소 게시판 제목이 통째로 그 꼴입니다.
     `&#38;`(&) 은 위에서 먼저 풀었으므로 「&amp;lt;」 같은 두 겹을 한 번 더 풀지 않습니다 */
  .replace(/&#(\d{2,7});/g, (m, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; })
  .replace(/&#x([0-9a-f]{2,6});/gi, (m, h) => { const c = parseInt(h, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; })
  .replace(/&middot;/g, '·');
export const 꼬리말 = /\s*(?:채용\s*공고)?\s*상세\s*보기\s*$|\s*새글\s*$|\s*N\s*$|\s*\[?알림\]?\s*$/;
export const 메뉴말 = /^(?:더\s*보기|목\s*록|처음|이전|다음|맨\s*끝|검\s*색|닫\s*기|자세히|바로가기|home|list|more)$/i;
/* ★ 2026-11-11 — 시·군·구청 게시판 열쇠를 보탭니다 (열어서 본 꼴 그대로) —
     nttNo(강릉 selectBbsNttView) · notAncmtMgtNo(안동 saeol/gosi/view) · ancmtMgtNo(울진) ·
     q_bbscttSn(광명 BD_selectBbs · **17자리**라 자릿수 뚜껑도 12 → 20) · bod_uid(성주 page.do) */
export const 번호열쇠 = /(?:^|[?&])(?:seq|seqno|seq_no|nttSn|ntt_sn|nttNo|wr_id|bbsSeq|bbs_seq|brd_no|brdNo|idx|no|num|articleNo|article_no|bno|boardSeq|board_seq|id|pk|notAncmtMgtNo|not_ancmt_mgt_no|ancmtMgtNo|q_bbscttSn|bbscttSn|bod_uid)=(\d{1,20})(?:&|$)/i;
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

/* ── 보건소 공고를 시·군·구청 게시판에서 받기 (2026-11-11 · 멘토-1.2-3 · 멘토-1.13-2) ──
 * 보건소 채용 공고는 대개 보건소 누리집이 아니라 **시·군·구청 고시공고(새올)** 에 올라옵니다.
 * 그 게시판에는 모든 부서 글이 섞이므로 **보건 글만** 남깁니다 — 직군 가리기는 그 뒤에
 * 늘 하던 대로 `sortJob` → (보류함이면) `상세읽기.mjs` 가 합니다. 새 직군 규칙은 없습니다.
 */
/** 그 공고가 보건 쪽인가 (제목·기관 이름으로) — 2026-10-24 `시군청채용.mjs` 에 있던 것을 여기로 옮겼습니다 */
export const 보건말 = /(보건소|보건지소|보건의료원|치매안심|치매센터|정신건강|방문건강|건강증진)/;
/** **부서 칸**만 보는 말 — 부서 이름은 짧아서(「보건정책과」·「건강증진과」·「감염병관리과」) 넓게 봅니다 */
export const 보건부서말 = /(보건|건강|치매|감염병|의약|정신)/;
/** 우리 직군 쪽 말 — 부서가 보건이 아니어도(복지관·재활원) 남깁니다 */
export const 재활말 = /(재활(?!용)|물리\s*치료|작업\s*치료)/;   /* 「재활용품」을 막습니다 (괴산군 마른 시험에서 걸림) */
/** 남길 줄인가 — 제목은 보건말·재활말, 부서(또는 그 줄 글)는 보건부서말까지 */
export const 보건거름 = (제목, 부서 = '') => 보건말.test(제목 || '') || 재활말.test(제목 || '')
  || 보건말.test(부서 || '') || 보건부서말.test(부서 || '');

/** 그 링크가 든 **줄(tr·li) 글자** — 부서 칸을 따로 못 집는 누리집 게시판에서 거름에 씁니다 */
export function 줄글(html, 자리) {
  const t = String(html || '');
  const 앞 = Math.max(t.lastIndexOf('<tr', 자리), t.lastIndexOf('<li', 자리));
  const 뒤끝 = t.slice(자리).search(/<\/tr>|<\/li>/i);
  if (앞 < 0 || 뒤끝 < 0) return '';
  return 엔티티풀기(t.slice(앞, 자리 + 뒤끝).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** 새올(eminwon) 목록·상세 길 — 2026-11-11 에 eminwon.gangdong.go.kr 로 열어 확인했습니다.
 *  목록 쪽(OfrNotAncmtLSub.jsp)은 GET 으로 열면 표가 비고, 화면이 이 action 에 POST 합니다 */
export const 새올길 = '/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do';
/** 목록 POST 몸 — `ofr_pageSize` 30 은 **요청 한 번**에 30줄입니다(10 이면 강동구 엿새치뿐 · 30 이 받아들여짐 확인) */
/* ★ 옛판(곳 설정 `새올옛판: true`) — `homepagetype` 칸을 **뺍니다**. 2026-11-11 예산·화천·동해 새올이
     이 칸이 있으면 HTTP 400 을 냈고, 그 호스트의 목록 쪽(OfrNotAncmtLSub.jsp) form 에는 이 칸이 없었습니다.
     빼고 보내니 셋 다 200 · 줄 14·8·30 (search() 가 넣는 method 값은 같습니다) */
export const 새올목록몸 = (갈래 = '05', 몇줄 = 30, 옛판 = false) => {
  const 몸 = {
    pageIndex: '1', jndinm: 'OfrNotAncmtEJB', context: 'NTIS', method: 'selectListOfrNotAncmt',
    methodnm: 'selectListOfrNotAncmtHomepage', not_ancmt_mgt_no: '', homepage_pbs_yn: 'Y', subCheck: 'Y',
    ofr_pageSize: String(몇줄), not_ancmt_se_code: 갈래, cha_dep_code_nm: '', initValue: '', countYn: 'Y',
    list_gubun: '', homepagetype: 'new', not_ancmt_sj: '' };
  if (옛판) delete 몸.homepagetype;
  return 몸;
};
/** 회원이 누를 **GET 상세 주소** — 화면의 searchDetail() 이 보내는 form 값 그대로입니다.
 *  ★ 몇 칸을 빼고 GET 하면 400(Bad Request)이 났습니다 — 칸을 줄이지 마십시오 */
export function 새올상세주소(바탕, 번호, 갈래 = '05') {
  const q = new URLSearchParams({ jndinm: 'OfrNotAncmtEJB', context: 'NTIS', method: 'selectOfrNotAncmt',
    methodnm: 'selectOfrNotAncmtRegst', not_ancmt_mgt_no: String(번호), homepage_pbs_yn: 'Y', subCheck: 'Y',
    ofr_pageSize: '10', not_ancmt_se_code: 갈래, title: '고시공고', cha_dep_code_nm: '', initValue: 'Y',
    countYn: 'Y', list_gubun: '', not_ancmt_sj: '', not_ancmt_cn: '', dept_nm: '', epcCheck: 'Y',
    yyyy: '', pageIndex: '1' });
  return new URL(새올길, 바탕).origin + 새올길 + '?' + q.toString();
}
/** 새올 목록 읽기 — `<tr>` 마다 searchDetail(번호) · 고시공고번호 · 제목 · 담당부서 · 등록일
 *  ★ 꼴이 둘입니다 (2026-11-11 에 열어 봄) —
 *    새 꼴(강동구)  `<td class="title"><a href="javascript:searchDetail(59320)">제목</a></td>`
 *    옛 꼴(경산시)  `<td onclick="javaScript:searchDetail('51656')">…</td>` 가 **칸마다** 붙고 <a> 가 없습니다
 *  그래서 **머리줄의 칸 이름**(제목·담당부서·등록일)으로 자리를 잡고, 머리줄이 없으면
 *  searchDetail 이 든 <a> 칸을 제목으로 봅니다 */
export function 새올읽기(html, 바탕, 갈래 = '05') {
  const 낸것 = [];
  const 본것 = new Set();
  const 풀기 = (s) => 엔티티풀기(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  let 머리 = null;
  /* ★ 줄은 「<tr 부터 다음 <tr 앞까지」로 자릅니다 — 진주시는 줄 끝을 `</tr>` 대신 `<tr>` 로 닫아서
     `<tr>…</tr>` 로 찾으면 30줄 가운데 1줄만 나왔습니다 (2026-11-11) */
  for (const 조각 of String(html || '').split(/(?=<tr[\s>])/i)) {
    if (!/^<tr[\s>]/i.test(조각)) continue;
    const 끝 = 조각.search(/<\/tr>/i);
    const 줄 = 끝 >= 0 ? 조각.slice(0, 끝) : 조각;
    const 칸 = [...줄.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => c[1]);
    const 글칸 = 칸.map(풀기);
    const 번호 = (줄.match(/searchDetail\(\s*['"]?(\d{1,12})['"]?\s*\)/) || [])[1]
      || (줄.match(/not_ancmt_mgt_no=(\d{1,12})/) || [])[1];
    if (!번호) {
      const 제 = 글칸.findIndex((s) => /^제\s*목$/.test(s));
      if (제 >= 0) {
        머리 = { 제목: 제, 부서: 글칸.findIndex((s) => /부서/.test(s)),
          날: 글칸.findIndex((s) => /등록일|게시일|작성일|날짜/.test(s)),
          공고번호: 글칸.findIndex((s) => /공고\s*번호/.test(s)) };
      }
      continue;
    }
    if (본것.has(번호)) continue;
    let 제목칸 = 머리 && 칸.length > 머리.제목 ? 머리.제목 : -1;
    if (제목칸 < 0) 제목칸 = 칸.findIndex((c) => /<a[^>]+(?:searchDetail|not_ancmt_mgt_no=)/i.test(c));
    if (제목칸 < 0) continue;
    /* 셋째 꼴(남동구) — 제목 <a> 가 **GET 상세 주소**를 그대로 품습니다. 그때는 그 쪽 링크를 씁니다 */
    const 쪽링크 = (칸[제목칸].match(/<a[^>]+href\s*=\s*["']([^"']*not_ancmt_mgt_no=\d+[^"']*)["']/i) || [])[1];
    let 상세 = 새올상세주소(바탕, 번호, 갈래);
    if (쪽링크) { try { 상세 = new URL(엔티티풀기(쪽링크), 바탕).toString(); } catch { /* 위 주소 그대로 */ } }
    const 제목 = 풀기((칸[제목칸].match(/<a[^>]*>([\s\S]*?)<\/a>/i) || [])[1] || 칸[제목칸]);
    if (!제목) continue;
    const 부서칸 = 머리 && 머리.부서 >= 0 ? 머리.부서 : 제목칸 + 1;
    const 공고칸 = 머리 && 머리.공고번호 >= 0 ? 머리.공고번호 : 제목칸 - 1;
    const 날 = ((머리 && 머리.날 >= 0 ? 글칸[머리.날] : 글칸.join(' ')) || '').match(/(20\d\d)-(\d\d)-(\d\d)/);
    본것.add(번호);
    낸것.push({ 번호, 제목, 공고번호: 공고칸 >= 0 ? (글칸[공고칸] || '') : '',
      부서: 글칸[부서칸] || '', 올린날: 날 ? 날[0] : null, 주소: 상세 });
  }
  return 낸것;
}
/** 새올 상세 쪽에서 **온 제목** — 목록 제목이 「…」로 잘렸을 때만 씁니다 */
export function 새올상세제목(html) {
  const 글 = 엔티티풀기(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  /* 칸 이름이 곳마다 조금씩 다릅니다 — 강동 「제목 … 담당부서」 · 진주 「제목 … 고시공고구분」 ·
     남동 「제 목 … 번 호」. 그다음 칸 이름 앞에서 끊습니다 */
  return ((글.match(/제\s*목\s+(.{4,300}?)\s+(?:번\s*호|고시공고구분|게재제호|고시공고번호|구\s*분|담당\s*부서|등\s*록\s*일)\s/) || [])[1] || '').trim();
}
export const 잘린꼴 = /(?:\.\.\.|…)\s*$/;

/* ── 곳마다 읽기 규칙 (곳 설정 `읽기: "규칙"` + `규칙: {...}`) — 2026-11-11 ──────────────
 * 표준읽기(글 번호가 든 href)로 못 읽는 시·군·구청 게시판이 있습니다 — 포항시는 제목 <a> 가
 * `href="#" data-action="…view.do?notAncmtMgtNo=76371…"` 꼴이라 표준읽기가 줄 0 이었습니다.
 * ★ 공통 읽기(표준읽기)는 **바꾸지 않습니다.** 대신 병원 수집기의 html 꼴 설정(`tools/hosp/cfgs/*.json`)과
 *   **같은 칸 이름**(row · title · link · linkFmt · date · skip · single)으로 곳마다 규칙을 적고,
 *   읽기는 `tools/hosp/hs_test.js` 의 `hospParseHtml` 을 **그대로 빌려 씁니다** (규칙을 두 벌로 만들지 않습니다 · 지침 6절).
 * 이 자리에서 더하는 것은 둘뿐입니다 —
 *   번호 = 그 줄에서 `link` 의 첫 캡처 (아이디에 씁니다 · 없으면 그 줄은 버립니다 — 지어내지 않습니다)
 *   부서 = 그 줄(row) 글자 전부 (보건 거름·구 이름 가름에 씁니다 — 공고번호 칸 「포항시 남구보건소 공고」 도 들어갑니다)
 * 날짜는 hospParseHtml 의 posted(올린 날)만 씁니다. 줄에 날짜가 둘이면(시작~마감) 시작을 올린 날로 둡니다. */
import { createRequire } from 'node:module';
const 들여오기 = createRequire(import.meta.url);
let 병원읽기 = null;
export function 규칙읽기(html, 규칙) {
  if (!병원읽기) 병원읽기 = 들여오기('../hosp/hs_test.js');
  const { hospParseHtml, stripTags } = 병원읽기;
  const 낸것 = [];
  const 본것 = new Set();
  const 줄틀 = new RegExp(규칙.row, 'g');
  const 링크틀 = 규칙.link ? new RegExp(규칙.link) : null;
  const t = String(html || '');
  for (const m of t.matchAll(줄틀)) {
    const 덩이 = m[0];
    /* 한 줄만 든 덩이를 hospParseHtml 에 그대로 줍니다 — 제목·주소·날짜 규칙이 병원 쪽과 글자까지 같습니다 */
    const [x] = hospParseHtml(덩이, 규칙);
    if (!x) continue;
    /* link 캡처가 주소 통째(쪽이 준 href 그대로 쓰는 곳)면 그 안의 **마지막 숫자**를 번호로 봅니다 */
    /* 규칙에 `번호`(정규식)가 있으면 그것을 먼저 씁니다 — 주소 끝에 다른 숫자 칸이 붙는 곳(해남 pBoardId=…201) */
    const 캡처 = 규칙.번호 ? ((덩이.match(new RegExp(규칙.번호)) || [])[1] || '')
      : (링크틀 ? ((덩이.match(링크틀) || [])[1] || '') : '');
    const 번호 = /^\d+$/.test(캡처) ? 캡처 : ((캡처.match(/(\d+)(?!.*\d)/) || [])[1] || '');
    if (!번호 || 본것.has(번호)) continue;
    본것.add(번호);
    const 날 = (x.posted || x.from || '').replace(/\./g, '-') || null;
    /* ★ 2026-11-11 — 마감일(to)도 넘깁니다. 게시일 칸이 없고 마감일만 있는 게시판(규칙 `single: "deadline"`)은
       올린날이 비고 마감만 찹니다 — 올린날을 마감으로 **채우지 않습니다**(지어내지 않음).
       ★ 이 `마감` 은 **진단(곳별 리포트 최근마감)에만** 씁니다 — 담는 마감(apply_to)으로 쓰지 않습니다
         (멘토 지시문 5 「마감일은 상세나 첨부에서만」 · 표준게시판.mjs 담을만) */
    const 마감 = (x.to || '').replace(/\./g, '-') || null;
    낸것.push({ 번호, 제목: x.title, 주소: x.url, 올린날: 날, 마감, 부서: stripTags(덩이), 자리: m.index });
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
