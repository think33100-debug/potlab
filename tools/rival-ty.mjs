/* 땡큐오티 구인정보 목록 읽기 — **목록 한 쪽만** 봅니다 (2026-09-30).
 *
 *   import { 목록읽기, 볼분류 } from './rival-ty.mjs';
 *   node tools/rival-ty.mjs        ← 스스로 하는 검사 + 지금 목록 한 번 보기
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 * · **목록 첫 쪽만** 봅니다. 상세 글은 열지 않고 본문도 안 가져옵니다
 * · robots.txt 를 지킵니다 (2026-09-30 확인 — User-agent: * / Allow: /)
 * · 1시간에 한 번, 아침 7시~밤 10시
 * · **관리자만** 봅니다. 회원 화면에 절대 안 씁니다
 * · 경쟁사 공고를 우리 공고로 옮겨 싣지 않습니다.
 *   쓰는 것은 「이 기관을 우리도 봐야겠다」 는 신호뿐입니다
 *
 * ── 이용약관 ─────────────────────────────────────────────────
 * 세중님이 2026-09-30 에 브라우저로 직접 확인 — 크롤링·복제·상업적 이용 금지 문구 없음.
 * (제가 기계로 읽었을 때는 본문이 자바스크립트로 그려져 못 읽었습니다)
 *
 * ── 목록 한 줄의 생김새 (2026-09-30 원문에서 확인) ───────────
 *   <a href="https://www.thankyouot.com/board1/3915">
 *     <span style='color:#369a4d'>[재활·요양병원]</span>
 *     <span class="na-bar"></span>
 *     진주 베스트 재활병원에서 계약직/정규직 선생님을 모십니다.
 *   </a>
 *   <span class="badge badge-secondary light-grey p-2"> 경남 </span>
 *   정규직|계약직|아르바이트  경력무관  조회 7  댓글 0  채용 시 마감
 *
 * **게시 날짜가 없습니다.** 글 번호가 순서대로 늘어나므로 그것을 시간 대용으로 씁니다.
 */

export const 목록주소 = 'https://www.thankyouot.com/board1';

/* 견줄 분류 — 우리 1층(공공·종합·대학)에 해당하는 것만 저장합니다.
   2026-09-30 목록에 실제로 나온 분류 —
     [재활·요양병원] 9 · [공단·공공병원] 2 · [종합병원] 2 · [대학병원] 1 · [치매안심센터] 1
   재활·요양은 2층이라 저장하지 않습니다 (CLAUDE.md). */
export const 볼분류 = ['대학병원', '공단·공공병원', '종합병원', '치매안심센터'];

const 풀기 = (s) => String(s || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/\s+/g, ' ').trim();

/**
 * 목록 HTML → 줄 목록
 * @returns {{번호:number, 분류:string, 제목:string, 지역:string, 고용형태:string, 링크:string}[]}
 */
export function 목록읽기(html) {
  const h = String(html || '');
  const 줄 = [];
  /* <a href=".../board1/숫자"> … </a> 를 한 건으로 봅니다 */
  for (const m of h.matchAll(/<a\s+href=["']https?:\/\/[^"']*\/board1\/(\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const 번호 = Number(m[1]);
    const 속 = m[2];
    const 분류 = (속.match(/\[([^\]]{2,16})\]/) || [])[1] || '';
    const 제목 = 풀기(속).replace(/^\[[^\]]{2,16}\]\s*/, '').trim();
    if (!제목) continue;
    /* 그 줄 뒤쪽에서 지역 뱃지와 고용형태를 찾습니다 (같은 줄 안에서만) */
    const 뒤 = h.slice(m.index + m[0].length, m.index + m[0].length + 900);
    const 지역 = 풀기((뒤.match(/<span class="badge[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
    const 뒤글 = 풀기(뒤);
    const 고용 = (뒤글.match(/((?:정규직|무기계약·공무직|무기계약|공무직|계약직|인턴|아르바이트|프리랜서|기타)(?:\s*\|\s*(?:정규직|무기계약·공무직|무기계약|공무직|계약직|인턴|아르바이트|프리랜서|기타))*)/) || [])[1] || '';
    if (줄.some((x) => x.번호 === 번호)) continue;      // 같은 글이 두 번 나오면 한 번만
    줄.push({ 번호, 분류, 제목, 지역, 고용형태: 고용, 링크: 목록주소 + '/' + 번호 });
  }
  return 줄.sort((a, b) => b.번호 - a.번호);
}

/* ── 스스로 하는 검사 ────────────────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('rival-ty.mjs')) {
  const 가짜 = `
  <a href="https://www.thankyouot.com/board1/3915" style="word-break: break-word;">
    <span style='color:#369a4d !important;'>[재활·요양병원]</span>
    <span class="na-bar"></span> 진주 베스트 재활병원에서 계약직/정규직 선생님을 모십니다. </a>
  <span class="badge badge-secondary light-grey p-2"> 경남 </span>
  <span>정규직|계약직|아르바이트</span> <span>경력무관</span> 조회 7 댓글 0
  <a href="https://www.thankyouot.com/board1/3914">
    <span style='color:#1a73e8 !important;'>[대학병원]</span>
    <span class="na-bar"></span> ○○대학교병원 작업치료사 채용 </a>
  <span class="badge badge-secondary light-grey p-2"> 서울 </span>
  <span>정규직</span> 조회 3 댓글 0`;
  const r = 목록읽기(가짜);
  let 틀림 = 0;
  const 봐야할것 = [
    [0, 3915, '재활·요양병원', '경남', '정규직|계약직|아르바이트'],
    [1, 3914, '대학병원', '서울', '정규직'],
  ];
  for (const [i, 번호, 분류, 지역, 고용] of 봐야할것) {
    const x = r[i] || {};
    const ok = x.번호 === 번호 && x.분류 === 분류 && x.지역 === 지역 && x.고용형태 === 고용;
    if (!ok) 틀림++;
    console.log((ok ? '○ ' : '★ ') + '번호 ' + x.번호 + ' · [' + x.분류 + '] · ' + x.지역
      + ' · ' + x.고용형태 + ' · ' + String(x.제목).slice(0, 30));
    if (!ok) console.log('    바란 것 — ' + 번호 + ' / ' + 분류 + ' / ' + 지역 + ' / ' + 고용);
  }
  console.log(틀림 ? '\n★ ' + 틀림 + '개 틀렸습니다' : '\n○ 다 맞습니다');
  process.exit(틀림 ? 1 : 0);
}
