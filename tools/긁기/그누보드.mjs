/* 긁기 ② — **그누보드 꼴** (`/bbs/board.php?bo_table=…`) (2026-10-24 세중님 C2)
 *
 *   node tools/긁기/그누보드.mjs                 목록만 (기본 · 마른)
 *   node tools/긁기/그누보드.mjs --몇개 6         앞 몇 곳만
 *   node tools/긁기/그누보드.mjs --진짜           보류함으로 담습니다
 *   node tools/긁기/그누보드.mjs --자기점검        읽는 규칙만 (사이트 안 두드림)
 *
 * ── 왜 이 꼴 ────────────────────────────────────────────────
 * ①HTML 게시판 139곳 가운데 **그누보드가 22곳**입니다 — 가장 큰 묶음입니다
 * (`docs/사각지대_분류_1024.md`). 한 읽기로 스물둘이 풀립니다.
 *
 * ── 쪽 꼴 (2026-10-24 에 두 곳을 열어서 본 것) ──────────────
 *   목록 링크   <a href="…board.php?bo_table=recruit&amp;wr_id=1234">제목 … 상세보기</a>
 *   제목 꼬리    스킨이 「… 채용공고 상세보기」·「상세보기」 를 붙입니다 → **떼어 냅니다**
 *   날짜        스킨마다 다릅니다 (삼척 `2026-10-23` · 청주는 목록에 없음) →
 *               링크 **가까이**에서 찾고, 없으면 **비웁니다** (지어내지 않습니다)
 *   엔티티      `&amp;` 를 **풀어서** 주소로 씁니다 (지침 5절 — 안 풀면 HTML 이 옵니다)
 *
 * ★ 10/31 까지 **보류함만** (hold=true 고정 · 공통.mjs).
 * ★ 기관번호는 `그누보드_곳들.json` 에 적힌 것만 붙입니다 (없으면 안 붙입니다).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기, 설정, 담기, 최근인가 } from './공통.mjs';
import { sortJob } from '../sort-rule.mjs';
import { 그누읽기, 꼬리말, 엔티티풀기 } from './읽기들.mjs';

export { 꼬리말, 엔티티풀기 };

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 99) || 99;
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';

/* 읽는 함수는 **읽기들.mjs 한 자리**입니다 (지침 6절) — 여기서는 이름만 빌려 씁니다.
   떼어 낸 까닭: 이 파일은 들여오면 바로 긁기를 시작해서, 다른 도구가 읽기만
   쓸 수 없었습니다 (한바퀴표.mjs 가 그것을 씁니다) */
export const 목록읽기 = 그누읽기;

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  /* 2026-10-24 에 삼척의료원·청주의료원에서 **실제로 받은 꼴**입니다 */
  const 견본 = `<tr><td>107</td><td>
     <a href="https://www.ksmc.or.kr/board/bbs/board.php?bo_table=recruit&amp;wr_id=1621">
       공고 2026-68 간호사(간호직8급) 채용(재)공고 채용공고 상세보기</a></td>
     <td>2026-10-23</td></tr>
     <tr><td>106</td><td>
     <a href="/bbs/board.php?bo_table=recurit_new&amp;wr_id=980">
       &lt;제26-12회&gt; 직원채용 공고(방사선사, 간호업무보조)</a></td><td>관리자</td></tr>
     <tr><td><a href="https://www.ksmc.or.kr/board/bbs/board.php?bo_table=recruit&amp;wr_id=1600">
       [합격자발표] 공고 2026-64 진료비심사청구담당직 채용공고 상세보기</a></td><td>2026-10-20</td></tr>`;
  const r = 목록읽기(견본, 'https://www.cjmc.or.kr/bbs/board.php?bo_table=recurit_new');
  보('세 줄을 읽는다', r.length === 3);
  보('★ 「상세보기」 꼬리를 뗀다', r[0].제목 === '공고 2026-68 간호사(간호직8급) 채용(재)공고');
  보('★ &amp; 를 풀어 주소로 쓴다', /wr_id=1621$/.test(r[0].주소) && !/&amp;/.test(r[0].주소));
  보('상대 주소를 절대 주소로', r[1].주소.startsWith('https://www.cjmc.or.kr/bbs/board.php?'));
  보('엔티티 제목도 푼다', r[1].제목.startsWith('<제26-12회>'));
  보('날짜가 가까이 있으면 집는다', r[0].올린날 === '2026-10-23');
  보('날짜가 없으면 비운다 (지어내지 않습니다)', r[1].올린날 === null);
  보('★ 합격자 발표는 쓰레기통', sortJob(r[2].제목, null, null).갈래 === '쓰레기통');
  보('같은 wr_id 는 한 번만', 목록읽기(견본 + 견본, 'https://a.b/').length === 3);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 설정자리 = path.join(여기, '그누보드_곳들.json');
if (!fs.existsSync(설정자리)) {
  console.error('✗ ' + 설정자리 + ' 가 없습니다 — 먼저 node tools/긁기/곳들만들기.mjs --꼴 그누보드 --적기');
  process.exit(1);
}
const { 곳들 } = JSON.parse(fs.readFileSync(설정자리, 'utf8'));
const cfg = 설정();
const 담을것 = [];
const 안담음 = [];
let 열린곳 = 0; let 못연곳 = 0;
for (const 곳 of 곳들.slice(0, 몇개)) {
  const r = await 받기(곳.주소);
  if (!r.됨) { 못연곳++; console.log('✗ ' + 곳.이름.slice(0, 20) + ' — ' + r.왜); continue; }
  열린곳++;
  const 줄들 = 목록읽기(r.html, 곳.주소);
  const 우리것 = 줄들.filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  const 표 = (x) => (x.bo || (곳.주소.match(/bo_table=([^&]+)/) || [, 'b'])[1]);
  console.log('● ' + 곳.이름.slice(0, 20).padEnd(21) + '목록 ' + String(줄들.length).padStart(3)
    + '줄 → 버릴 것 뺀 뒤 ' + String(우리것.length).padStart(3) + '줄'
    + (곳.기관번호 ? '' : '  (기관번호 없음 — 안 붙입니다)'));
  for (const x of 우리것.slice(0, 3)) {
    console.log('    ' + (x.올린날 || '날짜없음') + '  [' + sortJob(x.제목, null, null).갈래 + ']  '
      + x.제목.slice(0, 54));
  }
  for (const x of 우리것) {
    /* ★ 올린날이 있고 **90일 안**인 것만 담습니다 (공통.mjs 의 최근인가) —
       날짜 없는 줄·오래된 줄은 아래에서 세어 찍기만 합니다 */
    if (!최근인가(x.올린날, 90)) { 안담음.push({ 곳: 곳.이름, ...x }); continue; }
    담을것.push({
      id: 'HS4-' + 표(x) + '-' + x.wr,
      source: 출처,
      org_name: 곳.이름,
      title: x.제목,
      url: x.주소,
      posted_at: x.올린날,
      sido: (곳.지역 || '').split(' ')[0] || null,
      기관번호: 곳.기관번호 || null,
    });
  }
}
console.log('\n열린 곳 ' + 열린곳 + ' · 못 연 곳 ' + 못연곳 + ' · 담을 것 ' + 담을것.length
  + '건 (hold=true 고정 · 기관 붙는 것 ' + 담을것.filter((x) => x.기관번호).length + '건)');

const 결과 = await 담기(cfg, 출처, 담을것, { 진짜 });
if (!결과.됨) { console.log('✗ 담지 못했습니다 — ' + (결과.왜 || 결과.답)); process.exit(1); }
console.log(결과.마른 ? '[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'
  : '○ 담았습니다 — ' + 결과.답 + ' · 기관번호 붙임 ' + 결과.기관붙임 + '건');
