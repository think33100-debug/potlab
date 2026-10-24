/* 긁기 ③ — **표준게시판 꼴** (list.do · board · php·html·jsp 섞인 것) (2026-10-24 세중님 3번)
 *
 *   node tools/긁기/표준게시판.mjs              목록만 (기본 · 마른)
 *   node tools/긁기/표준게시판.mjs --몇개 20
 *   node tools/긁기/표준게시판.mjs --진짜        보류함으로 담습니다
 *   node tools/긁기/표준게시판.mjs --자기점검
 *
 * ── 왜 한 읽기로 묶나 ───────────────────────────────────────
 * ①HTML 게시판 139곳에서 그누보드(19)·경기도의료원(3)을 빼면 **117곳**이 남는데,
 * 꼴 이름은 달라도(list.do 16 · board 10 · php·html·jsp …) **읽는 법은 같습니다** —
 * 「**글 번호가 든 링크** + 그 줄의 제목·날짜」. 그래서 읽기 하나로 넓게 덮습니다.
 *
 * ── 글 번호가 든 링크로 보는 것 ─────────────────────────────
 *   href 에 `…view…?…=123` · `?seq=123` · `nttSn=123` · `wr_id=123` · `bbsSeq=123` ·
 *   `brd_no=123` · `idx=123` · `no=123` 같은 **숫자 열쇠**가 있는 것
 *   ★ 번호가 **없는** 링크는 안 씁니다 (메뉴·붙박이 파일이 섞입니다)
 *   ★ `javascript:…('123')` 꼴도 집습니다 (쪽이 POST 로 여는 자리)
 *
 * ★ 제목이 6자보다 짧거나 메뉴말(「더보기」·「목록」…)이면 버립니다.
 * ★ 날짜는 **그 줄 안에서만** 찾습니다. 없으면 비웁니다 (지어내지 않습니다).
 * ★ 올린날 90일 안인 것만 담습니다 · hold=true 고정 (공통.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기, 설정, 담기, 최근인가 } from './공통.mjs';
import { sortJob } from '../sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 999) || 999;
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';

export const 메뉴말 = /^(?:더\s*보기|목\s*록|처음|이전|다음|맨\s*끝|검\s*색|닫\s*기|자세히|바로가기|home|list|more)$/i;
export const 번호열쇠 = /(?:^|[?&])(?:seq|seqno|seq_no|nttSn|ntt_sn|wr_id|bbsSeq|bbs_seq|brd_no|brdNo|idx|no|num|articleNo|article_no|bno|boardSeq|board_seq|id|pk)=(\d{1,12})(?:&|$)/i;
export const 자바열쇠 = /(?:fn?View|goView|view_?detail|boardView|viewPage|detail)\s*\(\s*['"]?(\d{1,12})['"]?/i;
export const 엔티티풀기 = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#38;/g, '&')
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
export const 꼬리말 = /\s*(?:채용\s*공고)?\s*상세\s*보기\s*$|\s*새글\s*$|\s*N\s*$|\s*\[?알림\]?\s*$/;

/** 목록 쪽에서 줄을 읽습니다 — 번호·제목·(있으면) 올린날 */
export function 목록읽기(html, 바탕) {
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
    /* 날짜는 그 줄(tr·li) 안에서만 */
    const 앞 = Math.max(t.lastIndexOf('<tr', m.index), t.lastIndexOf('<li', m.index));
    const 뒤끝 = t.slice(m.index).search(/<\/tr>|<\/li>/i);
    const 창 = 앞 >= 0 && 뒤끝 >= 0 ? t.slice(앞, m.index + 뒤끝)
      : t.slice(Math.max(0, m.index - 150), m.index + m[0].length + 150);
    const 날 = 창.match(/(20\d\d)[-.\/](\d{1,2})[-.\/](\d{1,2})/);
    let 주소 = 주소글;
    if (/^javascript:/i.test(주소)) 주소 = 바탕;           /* POST 로 여는 쪽 — 목록 주소를 둡니다 */
    else { try { 주소 = new URL(주소, 바탕).toString(); } catch { /* 그대로 */ } }
    낸것.push({ 번호, 제목, 주소,
      올린날: 날 ? 날[1] + '-' + String(날[2]).padStart(2, '0') + '-' + String(날[3]).padStart(2, '0') : null });
  }
  return 낸것;
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 견본 = `<table><tr><td>12</td>
     <td><a href="/board/view.do?menuId=3&amp;seq=5821">물리치료사 채용 공고</a></td>
     <td>2026-10-20</td></tr>
     <tr><td><a href="/recruit/selectNttInfo.do?nttSn=190472">작업치료사 모집(계약직)</a></td>
     <td>2026.10.18</td></tr>
     <tr><td><a href="javascript:fView('100725')">장애인 의료기관 이용편의 지원사업 작업치료사 채용</a></td>
     <td>2026-10-12</td></tr>
     <tr><td><a href="/menu/sub.do?menuId=7">더보기</a></td><td>-</td></tr>
     <tr><td><a href="/files/공고문.pdf?seq=3">공고문 내려받기</a></td><td>-</td></tr></table>`;
  const r = 목록읽기(견본, 'https://a.or.kr/board/list.do?menuId=3');
  보('번호 든 링크 셋만 읽는다', r.length === 3);
  보('seq 를 집는다', r[0].번호 === '5821');
  보('nttSn 도 집는다', r[1].번호 === '190472');
  보('javascript 번호도 집는다', r[2].번호 === '100725');
  보('★ 메뉴(더보기)는 버린다', !r.some((x) => /더보기/.test(x.제목)));
  보('★ 붙박이 파일(pdf)은 버린다', !r.some((x) => /내려받기/.test(x.제목)));
  보('상대 주소를 절대 주소로', r[0].주소.startsWith('https://a.or.kr/board/view.do?'));
  보('&amp; 를 푼다', !/&amp;/.test(r[0].주소));
  보('javascript 는 목록 주소를 둔다', r[2].주소 === 'https://a.or.kr/board/list.do?menuId=3');
  보('날짜를 집는다', r[0].올린날 === '2026-10-20' && r[1].올린날 === '2026-10-18');
  보('우리 직군 공고는 회원목록', sortJob(r[0].제목, null, null).갈래 === '회원목록');
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 설정자리 = path.join(여기, '표준게시판_곳들.json');
if (!fs.existsSync(설정자리)) {
  console.error('✗ ' + 설정자리 + ' 가 없습니다 — 먼저 node tools/긁기/곳들만들기.mjs --꼴 표준게시판 --적기');
  process.exit(1);
}
const { 곳들 } = JSON.parse(fs.readFileSync(설정자리, 'utf8'));
const cfg = 설정();
const 담을것 = []; const 안담음 = [];
let 열림 = 0; let 못열림 = 0; let 줄없음 = 0;
for (const 곳 of 곳들.slice(0, 몇개)) {
  const r = await 받기(곳.주소);
  if (!r.됨) { 못열림++; console.log('  ✗ ' + 곳.이름.slice(0, 20).padEnd(21) + r.왜); continue; }
  열림++;
  const 줄들 = 목록읽기(r.html, 곳.주소);
  if (!줄들.length) { 줄없음++; console.log('  · ' + 곳.이름.slice(0, 20).padEnd(21) + '줄 0 (꼴이 다릅니다 — 손확인)'); continue; }
  const 우리것 = 줄들.filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  const 담을 = 우리것.filter((x) => 최근인가(x.올린날, 90));
  안담음.push(...우리것.filter((x) => !최근인가(x.올린날, 90)).map((x) => ({ 곳: 곳.이름, ...x })));
  console.log('  ○ ' + 곳.이름.slice(0, 20).padEnd(21) + '목록 ' + String(줄들.length).padStart(3)
    + ' → 버릴 것 뺀 뒤 ' + String(우리것.length).padStart(3)
    + ' → 90일 안 ' + String(담을.length).padStart(3)
    + (곳.기관번호 ? '' : '  (기관번호 없음)'));
  for (const x of 담을.slice(0, 2)) {
    console.log('      ' + x.올린날 + '  [' + sortJob(x.제목, null, null).갈래 + ']  ' + x.제목.slice(0, 50));
  }
  for (const x of 담을) {
    담을것.push({ id: 'HS4-' + (곳.기관번호 ? 곳.기관번호.slice(5, 13) : 'x') + '-' + x.번호,
      source: 출처, org_name: 곳.이름, title: x.제목, url: x.주소, posted_at: x.올린날,
      sido: (곳.지역 || '').split(' ')[0] || null, 기관번호: 곳.기관번호 || null });
  }
}
console.log('\n열린 곳 ' + 열림 + ' · 못 연 곳 ' + 못열림 + ' · 줄 0 인 곳 ' + 줄없음
  + ' · 담을 것 ' + 담을것.length + '건 (안 담음 ' + 안담음.length
  + ' — 날짜 없음 ' + 안담음.filter((x) => !x.올린날).length + ' · 오램 '
  + 안담음.filter((x) => x.올린날).length + ')');

const 결과 = await 담기(cfg, 출처, 담을것, { 진짜 });
if (!결과.됨) { console.log('✗ 담지 못했습니다 — ' + (결과.왜 || 결과.답)); process.exit(1); }
console.log(결과.마른 ? '[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'
  : '○ 담았습니다 — ' + 결과.답 + ' · 기관번호 붙임 ' + 결과.기관붙임 + '건');
