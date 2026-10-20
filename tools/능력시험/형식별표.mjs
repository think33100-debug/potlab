/* 능력시험 ④ **첨부 형식별 능력표** — 받아 둔 원문에서 세기만 합니다
 *
 *   node tools/능력시험/형식별표.mjs
 *   node tools/능력시험/형식별표.mjs --자기점검
 *
 * 세는 것 — 형식마다 ① 받기 성공률 ② 글로 바꾸기 성공률 ③ 표 보존 ④ 대표 실패 까닭.
 * 자료는 `원문/<id>/사실.json` 입니다 (원문받기.mjs 가 쌓아 둔 것).
 *
 * ★ 「받기 성공」은 **앞 바이트로 가린 진짜 형식**이 문서일 때입니다 —
 *   PDF 인 척하는 HTML 을 성공으로 세면 점수가 거짓이 됩니다 (지침 5절).
 * ★ 주소 갈래(JS주소·뷰어형·받기POST)도 함께 셉니다 — 「못 받은 까닭」이
 *   형식이 아니라 **주소를 만드는 방식**인 때가 많습니다.
 * ★ DB 를 두드리지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

/** 파일 이름·형식·읽기탈로 **능력표의 갈래**를 정합니다 */
export function 갈래정하기(한첨) {
  const 이름 = String(한첨.받은이름 || 한첨.이름 || '').toLowerCase();
  const 꼴 = String(한첨.진짜형식 || '');
  const 탈 = String(한첨.읽기탈 || '');
  if (꼴 === 'pdf') {
    /* 스캔(그림) PDF — 글자가 거의 없거나 OCR 이 필요하다고 적힌 것 */
    if (한첨.OCR필요쪽 > 0 || 한첨.OCR썼나) return '스캔(그림) PDF';
    if ((한첨.글자수 || 0) < 100 && (한첨.쪽수 || 0) > 0) return '스캔(그림) PDF';
    return '글자 PDF';
  }
  if (꼴 === 'hwp') return 'HWP';
  if (꼴 === 'zip계열') {
    if (/\.hwpx(\?|$)/.test(이름)) return 'HWPX';
    if (/\.docx(\?|$)/.test(이름)) return 'DOCX';
    if (/\.xlsx(\?|$)/.test(이름)) return 'XLSX';
    if (/\.zip(\?|$)/.test(이름)) return 'ZIP';
    if (/섹션 파일을 찾을 수 없/.test(탈)) return 'HWPX 로 읽으려다 실패(ZIP 계열)';
    return 'ZIP 계열(이름으로 못 가림)';
  }
  if (꼴 === 'jpg' || /\.(jpe?g|png|tiff?)(\?|$)/.test(이름)) return '그림(JPG·PNG)';
  if (꼴 === 'HTML') return 'HTML 이 옴 (못 받은 것)';
  return 꼴 || '(모름)';
}

function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('글자 PDF', 갈래정하기({ 진짜형식: 'pdf', 글자수: 5000, 쪽수: 5 }) === '글자 PDF');
  보('스캔 PDF — OCR 필요쪽', 갈래정하기({ 진짜형식: 'pdf', 글자수: 5000, OCR필요쪽: 3 }) === '스캔(그림) PDF');
  보('스캔 PDF — 글자가 거의 없음', 갈래정하기({ 진짜형식: 'pdf', 글자수: 12, 쪽수: 2 }) === '스캔(그림) PDF');
  보('HWP', 갈래정하기({ 진짜형식: 'hwp', 글자수: 3000 }) === 'HWP');
  보('HWPX', 갈래정하기({ 진짜형식: 'zip계열', 받은이름: '공고문.hwpx' }) === 'HWPX');
  보('DOCX', 갈래정하기({ 진짜형식: 'zip계열', 받은이름: '서식.docx' }) === 'DOCX');
  보('ZIP', 갈래정하기({ 진짜형식: 'zip계열', 받은이름: '직무기술서.zip' }) === 'ZIP');
  보('그림', 갈래정하기({ 진짜형식: 'jpg', 받은이름: '공고.jpg' }) === '그림(JPG·PNG)');
  보('HTML 은 못 받은 것', 갈래정하기({ 진짜형식: 'HTML', 받은이름: '공고문.pdf' }) === 'HTML 이 옴 (못 받은 것)');
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 형식별표 자기점검 통과 — ' + 잼.length + '가지') + ' (파일·DB 를 안 읽었습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (argv.includes('--자기점검')) process.exit(0);

/* ── 모으기 ─────────────────────────────────────────────── */
const 방들 = fs.readdirSync(path.join(여기, '원문'))
  .filter((n) => fs.existsSync(path.join(여기, '원문', n, '사실.json')));
const 사실 = 방들.map((n) => JSON.parse(fs.readFileSync(path.join(여기, '원문', n, '사실.json'), 'utf8')));
console.log('\n원문을 받아 둔 공고 ' + 사실.length + '건');

const 형식 = new Map();
const 주소갈래 = new Map();
const 못읽은까닭 = new Map();
for (const x of 사실) {
  for (const a of (x.쪽첨부 || [])) {
    const k = a.갈래 || '(모름)';
    주소갈래.set(k, (주소갈래.get(k) || 0) + 1);
  }
  for (const a of (x.받은첨부 || [])) {
    const g = 갈래정하기(a);
    const t = 형식.get(g) || { 건수: 0, 받음: 0, 읽음: 0, 표있음: 0, 글자합: 0, 공고: new Set(), 탈: new Map() };
    t.건수++;
    t.공고.add(x.id);
    const 문서인가 = ['pdf', 'hwp', 'zip계열'].includes(String(a.진짜형식 || ''));
    if (문서인가) t.받음++;
    if ((a.글자수 || 0) > 50) t.읽음++;
    if ((a.표수 || 0) > 0) t.표있음++;
    t.글자합 += (a.글자수 || 0);
    if (a.읽기탈) {
      const 까 = String(a.읽기탈).slice(0, 60);
      t.탈.set(까, (t.탈.get(까) || 0) + 1);
      못읽은까닭.set(까, (못읽은까닭.get(까) || 0) + 1);
    }
    형식.set(g, t);
  }
}

const 퍼 = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
console.log('\n── 첨부 형식별 ──');
console.log('  형식                          받아 본 수  공고  받기   글로   표보존  평균글자');
for (const [g, t] of [...형식].sort((a, b) => b[1].건수 - a[1].건수)) {
  console.log('  ' + g.padEnd(30)
    + String(t.건수).padStart(6) + String(t.공고.size).padStart(6)
    + 퍼(t.받음, t.건수).padStart(7) + 퍼(t.읽음, t.건수).padStart(7)
    + 퍼(t.표있음, t.건수).padStart(8)
    + String(t.건수 ? Math.round(t.글자합 / t.건수) : 0).padStart(9));
  const 첫탈 = [...t.탈].sort((a, b) => b[1] - a[1])[0];
  if (첫탈) console.log('      대표 실패 — ' + 첫탈[0] + ' (' + 첫탈[1] + '번)');
}

console.log('\n── 쪽에 걸린 첨부의 **주소 갈래** ──');
for (const [k, n] of [...주소갈래].sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(n).padStart(4) + '개  ' + k);
}

console.log('\n── 못 읽은 까닭 모음 ──');
for (const [k, n] of [...못읽은까닭].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log('  ' + String(n).padStart(3) + '번  ' + k);
}

/* 쪽 ↔ DB 첨부 수 견주기 */
let 쪽많음 = 0; let 같음 = 0; let DB많음 = 0; let 둘다0 = 0;
for (const x of 사실) {
  const 쪽n = (x.쪽첨부 || []).length;
  const dbn = x.DB첨부 || 0;
  if (!쪽n && !dbn) 둘다0++;
  else if (쪽n > dbn) 쪽많음++;
  else if (쪽n === dbn) 같음++;
  else DB많음++;
}
console.log('\n── 쪽에 걸린 첨부 ↔ 우리 DB ──');
console.log('  쪽이 더 많음 ' + 쪽많음 + '건 · 같음 ' + 같음 + '건 · DB 가 더 많음 ' + DB많음 + '건 · 둘 다 0 ' + 둘다0 + '건');

fs.writeFileSync(path.join(여기, '형식별표.json'), JSON.stringify({
  만든때: new Date().toISOString(),
  형식: [...형식].map(([g, t]) => ({ 형식: g, 건수: t.건수, 공고: t.공고.size, 받음: t.받음,
    읽음: t.읽음, 표있음: t.표있음, 평균글자: t.건수 ? Math.round(t.글자합 / t.건수) : 0,
    탈: [...t.탈] })),
  주소갈래: [...주소갈래], 못읽은까닭: [...못읽은까닭],
  쪽대DB: { 쪽많음, 같음, DB많음, 둘다0 },
}, null, 1) + '\n', 'utf8');
console.log('\n' + path.join(여기, '형식별표.json') + ' 에 적었습니다. DB 에 아무것도 쓰지 않았습니다.');
