/* 이미 받아 둔 본문으로 **칸 뽑기만 다시** 해 봅니다 — 2026-10-14 (마른 실행)
 *
 *   node tools/칸뽑기_마른실행.mjs <본문파일.json>
 *
 * **아무것도 담지 않습니다.** DB 에 쓰지도 않습니다.
 * 들어오는 파일은 `[{ id, 기관, 제목, 1층, 지금: {…}, body }]` 꼴입니다.
 *
 * 내는 것 (세중님 3번) —
 *   ① 1층 모집인원·지원자격·예상연봉(금액)·마감시각 % 를 「지금 → 고치면」으로
 *   ② 바뀌는 공고 견본 10건 (전·후)
 *   ③ **잘못 뽑힌 것**도 따로 셉니다 — 채움률만 오르고 틀리면 안 됩니다
 *
 * 「잘못」을 어떻게 아나 — 사람이 봐야 합니다. 그래서 **의심스러운 꼴**만
 * 셉니다(아래 `수상한가`). 가려 주는 것이 아니라 **눈에 띄게** 하는 것입니다
 * (지침 15절 — 빈 칸을 「그런 상태」로 읽지 않습니다).
 */
import fs from 'node:fs';
import { 칸뽑기 } from './공고문읽기.mjs';
/* 금액이 있는지 가르는 꼴 — web/lib/job-state.ts 의 `금액꼴` 과 **같은 것**입니다
   (2026-10-14 세중님 확정 · CLAUDE.md). 여기서 새로 만들지 않습니다 */
const 금액꼴 = /[0-9][0-9,.s]*(만|천|억)?s*원/;
const 금액있나 = (v) => !!v && 금액꼴.test(String(v));

const 길 = process.argv[2];
if (!길 || !fs.existsSync(길)) {
  console.error('본문 파일을 주세요 — [{ id, 기관, 제목, 1층, 지금, body }]');
  process.exit(1);
}
const 줄들 = JSON.parse(fs.readFileSync(길, 'utf8'));

/* 「이 값은 사람이 봐야 합니다」 — 가려 주지 않고 눈에 띄게만 합니다 */
function 수상한가(칸) {
  const 말 = [];
  const g = String(칸.근무지 || '');
  const p = String(칸.예상연봉 || '');
  if (g && /^[는은이가을를의에도와과만]/.test(g)) 말.push('근무지가 조사로 시작');
  if (g && /습니다|됩니다|바랍니다/.test(g)) 말.push('근무지가 문장');
  if (g.length > 50) 말.push('근무지가 깁니다(' + g.length + '자)');
  if (p && !/\d[\d,.\s]*(만|천|억)?\s*원|내규|협의|규정|호봉/.test(p)) 말.push('연봉에 금액도 내규도 없음');
  if (p.length > 120) 말.push('연봉이 깁니다(' + p.length + '자)');
  if (칸.접수시각 && !/^([01]\d|2[0-4]):[0-5]\d$/.test(칸.접수시각)) 말.push('시각 꼴이 이상');
  for (const [k, v] of Object.entries(칸.모집인원 || {})) {
    if (!(v > 0 && v <= 50)) 말.push('인원이 이상(' + k + ' ' + v + ')');
  }
  return 말;
}

const 셈 = {
  지금: { 모집인원: 0, 지원자격: 0, 예상연봉: 0, 마감시각: 0 },
  고치면: { 모집인원: 0, 지원자격: 0, 예상연봉: 0, 마감시각: 0 },
  일층: 0, 수상: 0,
};
const 바뀐것 = [];
const 수상한것 = [];

for (const x of 줄들) {
  const 일층 = !!x['1층'];
  if (일층) 셈.일층++;
  const 지금 = x.지금 || {};
  const 후 = 칸뽑기(x.body || '', x.body || '');

  const 재기 = (칸, 어디) => {
    if (!일층) return;
    if (칸.모집인원 && Object.keys(칸.모집인원).length) 셈[어디].모집인원++;
    else if (칸['모집인원있나']) 셈[어디].모집인원++;
    if (칸.지원자격) 셈[어디].지원자격++;
    if (금액있나(칸.예상연봉)) 셈[어디].예상연봉++;
    if (칸.접수시각) 셈[어디].마감시각++;
  };
  재기({ 모집인원있나: !!지금.모집인원, 지원자격: 지금.지원자격,
    예상연봉: 지금.예상연봉, 접수시각: 지금.접수시각, 모집인원: {} }, '지금');
  재기(후, '고치면');

  const 수상 = 수상한가(후);
  if (수상.length) { 셈.수상++; 수상한것.push({ ...x, 후, 수상 }); }

  const 달라진 = [];
  for (const k of ['접수시각', '지원자격', '예상연봉', '근무지']) {
    const a = String(지금[k] ?? ''), b = String(후[k] ?? '');
    if (a.slice(0, 60) !== b.slice(0, 60)) 달라진.push(k);
  }
  const 인원전 = JSON.stringify(지금.모집인원 ?? null);
  const 인원후 = JSON.stringify(후.모집인원 ?? {});
  if (인원전 !== 인원후 && 인원후 !== '{}') 달라진.push('모집인원');
  if (달라진.length) 바뀐것.push({ ...x, 후, 달라진 });
}

const 퍼 = (a, b) => (b ? (a * 100 / b).toFixed(1) : '0.0');
console.log('칸 뽑기 마른 실행 — 본문 ' + 줄들.length + '건 (1층 ' + 셈.일층 + '건) · 아무것도 안 담았습니다\n');
console.log('── 1층 채움률 「지금 → 고치면」 ' + '─'.repeat(32));
for (const k of ['모집인원', '지원자격', '예상연봉', '마감시각']) {
  console.log('  ' + k.padEnd(6) + 퍼(셈.지금[k], 셈.일층).padStart(5) + '%  →  '
    + 퍼(셈.고치면[k], 셈.일층).padStart(5) + '%   (' + 셈.지금[k] + ' → ' + 셈.고치면[k] + '건)');
}

console.log('\n── 바뀌는 공고 ' + 바뀐것.length + '건 중 앞 10건 ' + '─'.repeat(24));
for (const x of 바뀐것.slice(0, 10)) {
  console.log('\n  ' + String(x.기관 || '').slice(0, 20).padEnd(22) + String(x.제목 || '').slice(0, 44)
    + '  [' + x.id + (x['1층'] ? ' · 1층' : '') + ']');
  console.log('    바뀌는 칸 — ' + x.달라진.join(' · '));
  for (const k of x.달라진) {
    const a = k === '모집인원' ? JSON.stringify(x.지금?.모집인원 ?? null) : String(x.지금?.[k] ?? '(없음)');
    const b = k === '모집인원' ? JSON.stringify(x.후.모집인원) : String(x.후[k] ?? '(없음)');
    console.log('      ' + k.padEnd(6) + ' 전 ' + a.slice(0, 64));
    console.log('      ' + ' '.repeat(6) + ' 후 ' + b.slice(0, 64));
  }
}

console.log('\n── ★ 수상한 값 ' + 셈.수상 + '건 ' + '─'.repeat(30));
console.log('  (채움률만 오르고 틀리면 안 됩니다 — 사람이 봐야 하는 것만 모았습니다)');
for (const x of 수상한것.slice(0, 10)) {
  console.log('  ' + String(x.기관 || '').slice(0, 18).padEnd(20) + x.수상.join(' · '));
  if (x.후.근무지) console.log('      근무지 ' + String(x.후.근무지).slice(0, 70));
  if (x.후.예상연봉) console.log('      연봉   ' + String(x.후.예상연봉).slice(0, 70));
}

const 낼곳 = 길.replace(/\.json$/, '_결과.json');
fs.writeFileSync(낼곳, JSON.stringify({ 셈, 바뀐것: 바뀐것.slice(0, 60), 수상한것 }, null, 1));
console.log('\n  ★ 마른 실행입니다 — DB 에 아무것도 안 썼습니다.');
console.log('  자세한 것 → ' + 낼곳);
