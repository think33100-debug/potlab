/* 긁기 ① — **경기도의료원 꼴** (medical.or.kr · 한 꼴로 세 병원) (2026-10-24 세중님 C2)
 *
 *   node tools/긁기/경기도의료원.mjs            목록만 (기본 · 마른 · 담지 않습니다)
 *   node tools/긁기/경기도의료원.mjs --진짜      보류함으로 담습니다 (출처 등록 뒤)
 *   node tools/긁기/경기도의료원.mjs --자기점검   읽는 규칙만 (사이트 안 두드림)
 *
 * ── 왜 이 꼴부터 ────────────────────────────────────────────
 * 1층 분류표에서 **①HTML 게시판 139곳** 가운데 「같은 꼴 묶음」이 가장 큰 자리입니다
 * (`docs/사각지대_분류_1024.md`). 경기도의료원은 **한 집(medical.or.kr)에 세 병원**이
 * 게시판 번호만 다르게 올립니다 — 설정 세 줄로 세 곳이 풀립니다.
 *
 * ── 쪽 꼴 (2026-10-24 에 열어서 본 것) ──────────────────────
 *   목록   https://www.medical.or.kr/front/boardList.do?brd_mgrno=<게시판>&menu_no=<메뉴>
 *          <tr><td class="number">1411</td><td class="title"><a href="javascript:fView('100844')">제목</a></td>
 *              <td class="writer">나*</td><td>2026.10.22</td><td class="view">113</td></tr>
 *   상세   같은 쪽에서 fView() 가 **POST** 로 보내는데, **GET 으로도 열립니다** —
 *          /front/boardView.do?brd_mgrno=<게시판>&menu_no=<메뉴>&brd_no=<번호>  (HTTP 200 확인)
 *          그래서 **회원에게 줄 원문 주소**가 생깁니다
 *   robots robots.txt 가 **없습니다**(404) → 규칙이 없어 가도 됩니다 (tools/robots.mjs 머리글)
 *
 * ★ 제목을 **거르지 않고** 담습니다 — 가르는 일은 기존 규칙(`sortJob`)이 합니다.
 * ★ 10/31 까지 **보류함만** (hold=true 고정 · 공통.mjs).
 * ★ 기관번호를 **설정에 적어** 둡니다 (이름 매칭을 거치지 않습니다 · 세중님 C3).
 */
import { 받기, 설정, 담기, HS3가긁나 } from './공통.mjs';
import { sortJob } from '../sort-rule.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';

/* 곳마다 **열어서 확인한** 주소입니다 (짐작 금지 · 지침 3절).
   기관번호는 2026-10-24 기준 `기관` 표에서 찾아 적습니다 — 비면 담기 전에 채웁니다 */
export const 곳들 = [
  /* 기관번호는 2026-10-24 에 `기관` 표에서 찾아 적었습니다 (ykiho 와 같은 값입니다).
     긁기는 어느 기관인지 알고 시작하므로 **이름 매칭을 거치지 않습니다** (세중님 C3) */
  { 이름: '경기도의료원 수원병원', 게시판: 227, 메뉴: 731,
    기관번호: 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQzIyQxMyQ0NjE0ODEjODEjJDEjJDIjJDgz' },
  { 이름: '경기도의료원 이천병원', 게시판: 266, 메뉴: 913,
    기관번호: 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQ3IyQ4OSQzNjEwMDIjNDEjJDEjJDgjJDgz' },
  { 이름: '경기도의료원의정부병원', 게시판: 240, 메뉴: 786,
    기관번호: 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQzIyQ5OSQ0NjE0ODEjNzEjJDEjJDgjJDgz' },
];
export const 목록주소 = (곳) => 'https://www.medical.or.kr/front/boardList.do?brd_mgrno='
  + 곳.게시판 + '&menu_no=' + 곳.메뉴;
export const 상세주소 = (곳, 번호) => 'https://www.medical.or.kr/front/boardView.do?brd_mgrno='
  + 곳.게시판 + '&menu_no=' + 곳.메뉴 + '&brd_no=' + 번호;

/** 목록 쪽에서 줄을 읽습니다 — 번호·제목·올린날 */
export function 목록읽기(html) {
  const 낸것 = [];
  const 줄꼴 = /<tr>([\s\S]*?)<\/tr>/gi;
  for (const m of String(html || '').matchAll(줄꼴)) {
    const 줄 = m[1];
    const 번호 = (줄.match(/fView\('(\d+)'/) || [])[1];
    if (!번호) continue;
    const 제목 = (줄.match(/<a[^>]*fView[^>]*>([\s\S]*?)<\/a>/i) || [, ''])[1]
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
    const 날 = (줄.match(/(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})/) || []);
    낸것.push({ 번호, 제목,
      올린날: 날.length ? 날[1] + '-' + String(날[2]).padStart(2, '0') + '-' + String(날[3]).padStart(2, '0') : null });
  }
  return 낸것;
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  /* 2026-10-24 에 **실제로 받은 글**입니다 */
  const 견본 = `<tbody> <tr> <td class="number">1409</td> <td class="title">
    <a href="javascript:fView('100725')"> [2026-41호]경기도의료원 수원병원 장애인 의료기관 이용편의
    지원사업 작업치료사(비정규직) 채용 공고 </a> </td> <td class="writer">나*</td>
    <td>2026.10.12</td> <td class="view">747</td> </tr>
    <tr> <td class="number">1410</td> <td class="title">
    <a href="javascript:fView('100762')"> 제2회 경기도의료원 수원병원 통합채용(행정직) 최종합격자 발표 </a>
    </td> <td class="writer">나*</td> <td>2026.10.13</td> </tr> </tbody>`;
  const 읽은것 = 목록읽기(견본);
  보('두 줄을 읽는다', 읽은것.length === 2);
  보('번호를 집는다', 읽은것[0].번호 === '100725');
  보('제목을 집는다', /작업치료사\(비정규직\) 채용 공고$/.test(읽은것[0].제목));
  보('올린날을 집는다', 읽은것[0].올린날 === '2026-10-12');
  보('★ 우리 직군 공고는 회원목록으로 갈라진다',
    sortJob(읽은것[0].제목, null, null).갈래 === '회원목록');
  보('★ 최종합격자 발표는 쓰레기통으로 갈라진다',
    sortJob(읽은것[1].제목, null, null).갈래 === '쓰레기통');
  보('상세 주소를 만든다',
    상세주소(곳들[0], '100725')
      === 'https://www.medical.or.kr/front/boardView.do?brd_mgrno=227&menu_no=731&brd_no=100725');
  보('줄이 없으면 빈 목록', 목록읽기('<table></table>').length === 0);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const cfg = 설정();
let 건너뜀 = 0;
const 담을것 = [];
for (const 곳 of 곳들) {
  /* ★ 세중님 ㉩ (10/24 밤) — HS3 가 긁는 곳은 건너뜁니다 */
  if (HS3가긁나(곳.이름)) { 건너뜀++; continue; }
  const 주소 = 목록주소(곳);
  const r = await 받기(주소);
  if (!r.됨) { console.log('✗ ' + 곳.이름 + ' — ' + r.왜); continue; }
  const 줄들 = 목록읽기(r.html);
  const 우리것 = 줄들.filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  console.log('\n● ' + 곳.이름 + ' — 목록 ' + 줄들.length + '줄 · 버릴 것 뺀 뒤 '
    + 우리것.length + '줄  (' + r.글.length + '자)');
  for (const x of 우리것.slice(0, 8)) {
    const 갈 = sortJob(x.제목, null, null);
    console.log('   ' + (x.올린날 || '날짜없음') + '  [' + 갈.갈래 + ']  '
      + x.제목.slice(0, 62));
  }
  for (const x of 우리것) {
    담을것.push({
      id: 'HS4-' + 곳.게시판 + '-' + x.번호,
      source: 출처,
      org_name: 곳.이름,
      title: x.제목,
      url: 상세주소(곳, x.번호),
      posted_at: x.올린날,
      기관번호: 곳.기관번호,
    });
  }
}

console.log('\nHS3 가 긁어 건너뜀 ' + 건너뜀 + '곳 (세중님 ㉩) · 담을 것 ' + 담을것.length + '건 (hold=true 고정) ──');
const 결과 = await 담기(cfg, 출처, 담을것, { 진짜 });
if (!결과.됨) {
  console.log('✗ 담지 못했습니다 — ' + (결과.왜 || 결과.답));
  console.log('\n★ 출처 등록이 먼저입니다 (승인 자리) —');
  console.log('   ① collect_source 에 「' + 출처 + '」 줄 (이름·꼴·짝)');
  console.log('   ② collect_secret 에 열쇠 + .env 에 COLLECT_KEY_' + 출처);
  console.log('   ③ 기관번호 세 곳을 설정에 적기 (기관 표에서 찾아)');
  process.exit(0);
}
console.log(결과.마른 ? '[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'
  : '○ 담았습니다 — ' + 결과.답);
