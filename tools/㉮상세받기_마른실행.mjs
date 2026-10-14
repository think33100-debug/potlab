/* ㉮ 「상세를 안 받아오던 공고」를 **받아만 보고 재는** 글 — 2026-10-14 (마른 실행)
 *
 *   node tools/㉮상세받기_마른실행.mjs docs/㉮대상_1014.json
 *   node tools/㉮상세받기_마른실행.mjs docs/㉮대상_1014.json --앞 300
 *
 * **아무것도 담지 않습니다.** 세중님께 보여 드릴 것만 찍습니다 —
 *   ① 받은 본문 글자 수
 *   ② 메뉴가 아닌 **진짜 본문**인지 (앞 200자 · 사이트 꾸밈 비율)
 *   ③ 뽑힐 칸 (접수마감 · 접수시각 · 모집인원 · 지원자격 · 근무지 · 예상연봉)
 *
 * ── 규칙은 전부 **쓰는 쪽과 같은 한 벌**입니다 (지침 6절 · 12절) ──────────
 *   받는 길     tools/certs/index.mjs 의 글받기   ← 수집기와 같은 것
 *   주소 바꾸기  tools/hosp/상세주소.mjs           ← 인크루트 /jobcont/ · 한 자리
 *   태그 걷기    collect-hosp 의 그 다섯 줄과 **글자까지 같게** 베껴 둡니다
 *   칸 뽑기     tools/공고문읽기.mjs 의 칸뽑기     ← kordoc 과 같은 것
 *   직군        tools/공고문읽기.mjs 의 본문직군
 *
 * ⚠ 「앞 200자가 메뉴인가」는 **사람이 봐야 합니다.** 이 글은 가려 주지 않고
 *   그대로 찍습니다. 글자 수로 가르면 안 되는 자리입니다 —
 *   2026-10-14 에 `length(body) > 200` 으로 재서 왼쪽 메뉴 17건을
 *   「원문 있음」으로 셀 뻔했습니다 (지침 15절).
 */
import fs from 'node:fs';
import { 글받기 } from './certs/index.mjs';
import { 상세주소 } from './hosp/상세주소.mjs';
import { 칸뽑기, 본문직군 } from './공고문읽기.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const argv = process.argv.slice(2);
const 길 = argv.find((x) => !x.startsWith('--'));
const 앞 = argv.includes('--앞') ? Number(argv[argv.indexOf('--앞') + 1]) || 200 : 200;
if (!길 || !fs.existsSync(길)) {
  console.error('대상 파일을 주세요 — [{ id, 기관, 제목, url }, …] 꼴 JSON');
  process.exit(1);
}
const 대상 = JSON.parse(fs.readFileSync(길, 'utf8'));

/* collect-hosp.mjs 의 태그 걷기와 **글자까지 같습니다** */
const 태그걷기 = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

/* 「사이트 꾸밈인가」를 가리는 **참고 값**입니다 — 판정이 아닙니다.
   왼쪽 메뉴는 짧은 낱말이 길게 이어지고 문장 부호가 거의 없습니다 */
function 꾸밈기색(글) {
  const t = String(글 || '');
  if (!t) return '글 없음';
  const 문장 = (t.match(/[.。:：]/g) || []).length;
  const 메뉴말 = (t.match(/진료과|의료진|오시는길|사이트맵|바로가기|전체메뉴|로그인|개인정보처리방침|장례식장|건강검진|주차/g) || []).length;
  return '문장부호 ' + 문장 + ' · 메뉴낱말 ' + 메뉴말 + (메뉴말 >= 5 && 문장 < 10 ? '  ← 메뉴일 수 있습니다' : '');
}

console.log('㉮ 상세 받아 보기 — ' + 대상.length + '건 · 마른 실행(아무것도 안 담습니다) · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + '\n');

const 셈 = { 받음: 0, 못받음: 0, 자격: 0, 마감: 0, 시각: 0, 인원: 0, 근무지: 0, 연봉: 0 };
const 줄들 = [];

for (const x of 대상) {
  const 주소 = 상세주소(x.url);
  const 바뀜 = 주소 !== x.url;
  let g;
  try {
    g = await 글받기(주소, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
  } catch (e) { g = { 왜: String(e.message || e).slice(0, 80) }; }

  console.log('═══ ' + (x.기관 || '') + '  [' + x.id + ']');
  console.log('    ' + String(x.제목 || '').slice(0, 60));
  console.log('    주소 ' + 주소 + (바뀜 ? '   ← /jobcont/ 로 바꿔 받았습니다' : ''));

  if (g.왜 || (g.code && g.code !== 200)) {
    셈.못받음++;
    console.log('    ✗ 못 받았습니다 — ' + (g.왜 || ('HTTP ' + g.code)) + '\n');
    줄들.push({ ...x, 왜: g.왜 || ('HTTP ' + g.code) });
    continue;
  }
  셈.받음++;
  const 글 = 태그걷기(g.html);
  const r = 칸뽑기(글, 글);
  const j = 본문직군(글);

  if (r.지원자격) 셈.자격++;
  if (r.접수마감) 셈.마감++;
  if (r.접수시각) 셈.시각++;
  if (Object.keys(r.모집인원 || {}).length) 셈.인원++;
  if (r.근무지) 셈.근무지++;
  if (r.예상연봉) 셈.연봉++;

  console.log('    ① 글자 수   ' + 글.length + '자  (HTTP ' + (g.code || '?') + ')');
  console.log('    ② 앞 ' + 앞 + '자  ' + 꾸밈기색(글));
  console.log('       「' + 글.slice(0, 앞) + '」');
  console.log('    ③ 뽑힐 칸');
  console.log('       접수마감  ' + (r.접수마감 || '(못 뽑음)')
    + '   접수시각 ' + (r.접수시각 || '(못 뽑음)'));
  console.log('       모집인원  ' + (Object.keys(r.모집인원 || {}).length
    ? JSON.stringify(r.모집인원) : '(못 뽑음 — 지어내지 않습니다)'));
  console.log('       지원자격  ' + (r.지원자격 ? String(r.지원자격).slice(0, 110) : '(못 뽑음)'));
  console.log('       근무지    ' + (r.근무지 || '(못 뽑음)'));
  console.log('       예상연봉  ' + (r.예상연봉 || '(못 뽑음)'));
  console.log('       직군      ' + (j || '(본문으로는 못 가림)'));
  console.log('');
  줄들.push({ ...x, 주소, 글자수: 글.length, 칸: r, 직군: j, 앞: 글.slice(0, 앞) });
}

console.log('── 셈 ' + '─'.repeat(50));
console.log('  받음 ' + 셈.받음 + ' · 못 받음 ' + 셈.못받음 + '  (대상 ' + 대상.length + ')');
console.log('  뽑힌 칸 —  접수마감 ' + 셈.마감 + ' · 접수시각 ' + 셈.시각
  + ' · 모집인원 ' + 셈.인원 + ' · 지원자격 ' + 셈.자격
  + ' · 근무지 ' + 셈.근무지 + ' · 예상연봉 ' + 셈.연봉);
console.log('\n  ★ 마른 실행입니다 — 아무것도 담지 않았습니다.');

const 낼곳 = 길.replace(/\.json$/, '_결과.json');
fs.writeFileSync(낼곳, JSON.stringify(줄들, null, 1));
console.log('  자세한 것 → ' + 낼곳);
