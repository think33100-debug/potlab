/* 긁기 ④ — **공지사항에 섞인** 채용 글만 (2026-10-29 세중님 3번)
 *
 *   node tools/긁기/공지섞임.mjs                  마른 — 담길 글 목록만
 *   node tools/긁기/공지섞임.mjs --곳 드림,비에스,복주   이름에 그 글자가 든 곳만
 *   node tools/긁기/공지섞임.mjs --진짜            보류함으로 담습니다 (hold=true 고정)
 *   node tools/긁기/공지섞임.mjs --자기점검
 *
 * ── 왜 따로 ─────────────────────────────────────────────────
 * 손확인 ② 에서 세중님이 「**채용 전용 게시판이 없고 공지사항에 섞여 있다**」고
 * 적어 주신 곳들입니다 (10곳 가운데 목록 주소가 있는 **9곳**).
 * 그 목록을 그대로 긁으면 **진료시간 변경·휴진 안내**가 보류함에 쌓입니다 —
 * 보류함은 사람이 한 건씩 보는 자리입니다 (CLAUDE.md 15절).
 * 그래서 **제목에 채용·모집이 든 글만** 고릅니다 (세중님 말 그대로).
 *
 *   세중님 낱말   채용 · 모집 · 채용공고 · 인재채용 · 직원 모집
 *   → 뒤 셋은 앞 둘을 품습니다 (채용공고⊃채용 · 인재채용⊃채용 · 직원 모집⊃모집)
 *     그래서 자는 `채용|모집` 둘이고, 읽는 사람을 위해 다섯을 다 적어 둡니다
 *
 * ★ 우리 직군 판정은 **기존 길**입니다 (`sortJob` · 쓰레기통이면 버립니다).
 * ★ 올린날 90일 안인 것만 · `hold=true` 고정 · robots·틈은 `공통.mjs` 가 지킵니다.
 * ★ **크론에 넣지 않았습니다** — 크론 줄은 승인 자리입니다 (지침 0-0).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기, 설정, 담기, 최근인가, HS3가긁나 } from './공통.mjs';
import { sortJob } from '../sort-rule.mjs';
import { 꼴정하기, 그누읽기, 표준읽기, 게시판인가 } from './읽기들.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';
const 고른곳 = argv.includes('--곳')
  ? String(argv[argv.indexOf('--곳') + 1] || '').split(',').filter(Boolean) : [];

/** 제목에 채용 말이 있나 — 세중님 낱말 다섯 (뒤 셋은 앞 둘을 품습니다) */
export const 채용말 = /채용|모집/;
export const 채용말다섯 = ['채용', '모집', '채용공고', '인재채용', '직원 모집'];

/** 그 꼴에 맞는 목록 읽기 (읽기들.mjs 한 자리 · 지침 6절) */
export const 읽기고르기 = (주소) => (꼴정하기(주소) === '그누보드' ? 그누읽기 : 표준읽기);

/* ── 올린날이 목록에 없을 때 — **상세를 열어 받습니다** (2026-10-29 세중님 3번 ⓑ) ──
 * ★ 열어 보는 글은 **제목 자를 통과한 것만**입니다 (세중님). 남의 쪽을 쓸데없이
 *   두드리지 않습니다 — 틈 3.5초는 `공통.mjs` 가 지킵니다.
 * ★ **표식 뒤 날짜만** 씁니다 (작성일·등록일·게시일·올린날·날짜·일자). 표식이 없으면
 *   **비웁니다** — 쪽에 있는 아무 날짜를 올린날로 쓰면 접수기간·행사날이 섞입니다
 *   (지침 3절 · 「등록일을 마감으로 오해하면 그 공고가 조용히 빠집니다」).
 * ★ 날짜 꼴 자는 `collect-edu.mjs` 의 `날짜꼴` 과 같은 규칙입니다. 그 파일은
 *   **들여오면 바로 수집을 시작해서**(지침 6-3) 빌려 쓸 수 없어 여기 다시 적었습니다.
 */
export const 날짜표식 = /(작성일|등록일|게시일|올린날|작성날짜|일자|날짜)\s*[:|]?\s*((?:20)?\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/;
export const 아무날짜 = /((?:20)?\d{2})[-.\/](\d{1,2})[-.\/](\d{1,2})/g;
export function 날맞춤(해, 달, 날) {
  const y = String(해).length === 2 ? '20' + 해 : String(해);
  const s = y + '-' + String(달).padStart(2, '0') + '-' + String(날).padStart(2, '0');
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : '';
}
export function 상세에서날(글) {
  const m = String(글 || '').match(날짜표식);
  if (m) {
    const 날 = 날맞춤(m[2], m[3], m[4]);
    if (날) return { 날, 어디서: '「' + m[1] + '」 표식' };
  }
  /* 표식이 없으면 **안 씁니다.** 본 날짜는 세중님께 보이기만 합니다 */
  const 본것 = [...String(글 || '').matchAll(아무날짜)]
    .map((x) => 날맞춤(x[1], x[2], x[3])).filter(Boolean);
  return { 날: null, 어디서: '표식 없음', 본것: [...new Set(본것)].slice(0, 4) };
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('채용 든 제목을 고른다', 채용말.test('2026년 물리치료사 채용 공고'));
  보('모집 든 제목을 고른다', 채용말.test('작업치료사 직원 모집'));
  보('인재채용도 걸린다', 채용말.test('[인재채용] 간호직 공고'));
  보('진료시간 안내는 버린다', !채용말.test('추석 연휴 진료시간 변경 안내'));
  보('휴진 안내는 버린다', !채용말.test('2026년 하계 휴진 안내'));
  보('다섯 낱말이 다 자에 걸린다', 채용말다섯.every((w) => 채용말.test(w)));
  보('우리 직군은 회원목록', sortJob('물리치료사 채용 공고', null, null).갈래 === '회원목록');
  /* ★ 남의 직군은 **쓰레기통이 아니라 숨김보관**입니다 — `표준게시판.mjs` 와 **같은 길**로
     담고(버리지 않습니다) 회원 화면에는 안 나갑니다 (CLAUDE.md 15절 · 세중님 「기존 길」) */
  보('남의 직군은 숨김보관', sortJob('방사선사 모집 공고', null, null).갈래 === '숨김보관');
  보('채용말 없는 안내는 sortJob 도 버린다',
    sortJob('추석 연휴 진료시간 변경 안내', null, null).갈래 === '쓰레기통');
  보('그누보드 주소는 그누읽기', 읽기고르기('http://bs.ibsh.kr/bbs/board.php?bo_table=sosig') === 그누읽기);
  보('그밖은 표준읽기', 읽기고르기('http://dreamh.co.kr/front/board/list.php?code=notice') === 표준읽기);
  보('첫 화면은 게시판이 아니다', !게시판인가('http://wkgh.co.kr/', [{ 번호: '1' }, { 번호: '2' }]).됨);
  보('상세의 작성일을 집는다', 상세에서날('조회수 91 작성일 2026-07-16 첨부').날 === '2026-07-16');
  보('등록일도 집는다', 상세에서날('등록일: 26-08-23 11:24').날 === '2026-08-23');
  보('표식이 없으면 안 쓴다', 상세에서날('접수기간 2026-11-01 ~ 2026-11-30').날 === null);
  보('표식이 없으면 본 날짜를 보여만 준다',
    상세에서날('접수기간 2026-11-01 ~ 2026-11-30').본것.join(',') === '2026-11-01,2026-11-30');
  보('없는 날은 버린다', 상세에서날('작성일 2026-02-30').날 === null);
  const 견본 = `<table>
    <tr><td><a href="/front/board/view.php?code=notice&idx=91">2026년 물리치료사 채용 공고</a></td><td>2026-10-20</td></tr>
    <tr><td><a href="/front/board/view.php?code=notice&idx=90">추석 연휴 진료시간 변경 안내</a></td><td>2026-10-18</td></tr>
    <tr><td><a href="/front/board/view.php?code=notice&idx=89">작업치료사 직원 모집</a></td><td>2026-10-15</td></tr>
    <tr><td><a href="/front/board/view.php?code=notice&idx=88">방사선사 모집 공고</a></td><td>2026-10-14</td></tr></table>`;
  const 줄들 = 표준읽기(견본, 'http://a.or.kr/front/board/list.php?code=notice');
  보('견본 목록 넷을 읽는다', 줄들.length === 4);
  const 고른것 = 줄들.filter((x) => 채용말.test(x.제목))
    .filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  보('견본에서 안내 글이 빠진다 (제목 자에서)',
    고른것.length === 3 && !고른것.some((x) => /안내/.test(x.제목)));
  보('그중 둘이 우리 직군(회원목록)',
    고른것.filter((x) => sortJob(x.제목, null, null).갈래 === '회원목록').length === 2);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 설정자리 = path.join(여기, '공지섞임_곳들.json');
if (!fs.existsSync(설정자리)) { console.error('✗ ' + 설정자리 + ' 가 없습니다'); process.exit(1); }
const { 곳들 } = JSON.parse(fs.readFileSync(설정자리, 'utf8'));
const 볼곳 = 고른곳.length ? 곳들.filter((c) => 고른곳.some((g) => c.이름.includes(g))) : 곳들;
console.log('공지 섞임 — 곳 ' + 볼곳.length + '/' + 곳들.length
  + (고른곳.length ? ' (고른 것 ' + 고른곳.join('·') + ')' : '') + ' · 자 「채용|모집」');

const cfg = 설정();
const 담을것 = [];
let 열림 = 0; let 못열림 = 0; let 게시판아님 = 0; let 건너뜀 = 0;
let 상세열음 = 0; let 상세못읽음 = 0;
for (const 곳 of 볼곳) {
  if (HS3가긁나(곳.이름)) { 건너뜀++; continue; }     /* ㉩ — HS3 땅은 안 긁습니다 */
  const r = await 받기(곳.주소);
  if (!r.됨) { 못열림++; console.log('  ✗ ' + 곳.이름.slice(0, 20).padEnd(21) + r.왜); continue; }
  열림++;
  const 줄들 = 읽기고르기(곳.주소)(r.html, 곳.주소);
  const 판 = 게시판인가(곳.주소, 줄들);
  if (!판.됨) {
    게시판아님++;
    console.log('  · ' + 곳.이름.slice(0, 20).padEnd(21) + '목록 ' + String(줄들.length).padStart(3)
      + ' → **목록이 아닙니다** (' + 판.왜 + ') · 담지 않습니다');
    continue;
  }
  const 채용글 = 줄들.filter((x) => 채용말.test(x.제목));
  const 우리것 = 채용글.filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  /* ★ 올린날이 목록에 없으면 **상세를 열어 받습니다** (세중님 3번 ⓑ · 한 곳에 최대 10건).
     여는 것은 제목 자를 통과하고 **우리 직군인** 글만입니다 — 쓰레기통 글은 안 엽니다 */
  for (const x of 우리것.filter((y) => !y.올린날).slice(0, 10)) {
    const d = await 받기(x.주소);
    if (!d.됨) { x.날어디서 = '상세를 못 열었습니다 — ' + d.왜; 상세못읽음++; continue; }
    const 본날 = 상세에서날(d.글);
    x.올린날 = 본날.날 || null;
    x.날어디서 = 본날.날 ? '상세 ' + 본날.어디서
      : '상세에도 표식이 없습니다' + (본날.본것 && 본날.본것.length
        ? ' (쪽에 있는 날짜 — ' + 본날.본것.join(' · ') + ')' : '');
    상세열음++;
  }
  const 담을 = 우리것.filter((x) => 최근인가(x.올린날, 90));
  console.log('  ○ ' + 곳.이름.slice(0, 20).padEnd(21) + '목록 ' + String(줄들.length).padStart(3)
    + ' → 제목에 채용·모집 ' + String(채용글.length).padStart(3)
    + ' → 우리 직군 ' + String(우리것.length).padStart(3)
    + ' → 90일 안 ' + String(담을.length).padStart(3)
    + (곳.기관번호 ? '' : '  (기관번호 없음 — 기관을 안 붙입니다)'));
  /* ★ **버린 것도 찍습니다** — 「담길 글 목록」을 보시려면 버린 까닭이 함께 보여야
     합니다 (지침 2절 · 「몇 건 왔다」만 찍는 진단은 쓸모없음) */
  for (const x of 채용글) {
    const 갈래 = sortJob(x.제목, null, null).갈래;
    const 왜 = 갈래 === '쓰레기통' ? '   ← 우리 직군 아님 (안 담음)'
      : !최근인가(x.올린날, 90) ? '   ← 90일 밖·날짜없음 (안 담음)' : '   ← **담깁니다**';
    console.log('      ' + (x.올린날 || '날짜없음') + '  [' + 갈래 + ']  ' + x.제목.slice(0, 54) + 왜);
    if (x.날어디서) console.log('          날짜 — ' + x.날어디서);
  }
  for (const x of 담을) {
    담을것.push({ id: 'HS4-' + (곳.기관번호 ? 곳.기관번호.slice(5, 13) : 'x') + '-' + x.번호,
      source: 출처, org_name: 곳.이름, title: x.제목, url: x.주소, posted_at: x.올린날,
      sido: (곳.지역 || '').split(' ')[0] || null, 기관번호: 곳.기관번호 || null });
  }
}
console.log('\n열린 곳 ' + 열림 + ' · 못 연 곳 ' + 못열림 + ' · 목록 아님 ' + 게시판아님
  + ' · HS3 땅이라 건너뜀 ' + 건너뜀
  + ' · 상세 열어 날짜 받은 글 ' + 상세열음 + '건(못 연 것 ' + 상세못읽음 + ')'
  + ' · 담을 것 ' + 담을것.length + '건');

const 결과 = await 담기(cfg, 출처, 담을것, { 진짜 });
if (!결과.됨) { console.log('✗ 담지 못했습니다 — ' + (결과.왜 || 결과.답)); process.exit(1); }
console.log(결과.마른 ? '[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'
  : '○ 담았습니다 — ' + 결과.답 + ' · 기관번호 붙임 ' + 결과.기관붙임 + '건');
