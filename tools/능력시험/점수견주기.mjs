/* 능력시험 — **전후 점수 견주기** (파일만 읽습니다)
 *
 *   node tools/능력시험/점수견주기.mjs                     1회 ↔ 지금
 *   node tools/능력시험/점수견주기.mjs 시험결과_1회.json 시험결과.json
 *   node tools/능력시험/점수견주기.mjs --자기점검
 *
 * ── 왜 (2026-10-20 세중님) ────────────────────────────────────
 * 「고칠 때마다 점수 전후」 · 「**틀림이 늘어난 칸은 되돌리고 까닭**」.
 * 눈으로 두 표를 번갈아 보면 늘어난 칸을 놓칩니다. 그래서 **늘어난 것을
 * 먼저 찍습니다** — 맞음이 늘어도 틀림이 같이 늘면 그것부터 봅니다.
 *
 * ★ 그물·DB 를 두드리지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];
const 갈래 = ['맞음', '틀림', '빈칸', '헛채움', '둘다없음', '애매'];

/** 한 칸의 정답률 — 분모에서 「둘다없음」을 뺍니다 (맞게 비운 것) */
export function 정답률(c) {
  const 분모 = 갈래.filter((k) => k !== '둘다없음').reduce((s, k) => s + (c[k] || 0), 0);
  return 분모 ? Math.round((1000 * (c.맞음 || 0)) / 분모) / 10 : null;
}

/** 두 칸셈을 견줍니다 — [{칸, 전, 후, 바뀜, 나빠짐}] */
export function 견주기(전칸셈, 후칸셈) {
  const 줄 = [];
  for (const k of 칸이름) {
    const a = (전칸셈 && 전칸셈[k]) || {};
    const b = (후칸셈 && 후칸셈[k]) || {};
    const 바뀜 = {};
    for (const g of 갈래) 바뀜[g] = (b[g] || 0) - (a[g] || 0);
    줄.push({ 칸: k, 전: a, 후: b, 바뀜,
      전율: 정답률(a), 후율: 정답률(b),
      /* ★ **나빠짐** — 틀림이나 헛채움이 늘었으면 되돌릴 거리입니다 */
      나빠짐: (바뀜.틀림 > 0) || (바뀜.헛채움 > 0) });
  }
  return 줄;
}

function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('정답률 — 둘다없음은 분모에서 뺍니다',
    정답률({ 맞음: 1, 틀림: 1, 둘다없음: 8 }) === 50);
  보('빈 칸은 null', 정답률({}) === null);
  const g = 견주기({ 모집인원: { 맞음: 1, 틀림: 2 } }, { 모집인원: { 맞음: 3, 틀림: 1 } });
  보('맞음이 늘면 +', g[0].바뀜.맞음 === 2);
  보('틀림이 줄면 −', g[0].바뀜.틀림 === -1);
  보('나빠지지 않았으면 false', g[0].나빠짐 === false);
  보('모집인원이 첫 줄', g[0].칸 === '모집인원');
  /* ★ 돌려주는 줄은 **일곱 칸 차례**입니다 — 칸 이름으로 찾아야 합니다
     (처음에 h[0] 로 집었다가 모집인원 줄을 보고 자기점검이 틀렸습니다) */
  const 찾 = (줄, k) => 줄.find((x) => x.칸 === k);
  const h = 견주기({ 근무지: { 맞음: 1, 틀림: 1 } }, { 근무지: { 맞음: 5, 틀림: 3 } });
  보('★ 맞음이 늘어도 틀림이 늘면 나빠짐', 찾(h, '근무지').나빠짐 === true);
  const i = 견주기({ 근무지: { 맞음: 1 } }, { 근무지: { 맞음: 1, 헛채움: 2 } });
  보('헛채움이 늘면 나빠짐', 찾(i, '근무지').나빠짐 === true);
  보('안 바뀐 칸은 나빠짐이 아닙니다', 찾(i, '지원자격').나빠짐 === false);
  보('일곱 칸을 다 셉니다', g.length === 7);
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 점수견주기 자기점검 통과 — ' + 잼.length + '가지') + ' (파일·그물을 안 읽었습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (argv.includes('--자기점검')) process.exit(0);

const [앞파일 = '시험결과_1회.json', 뒤파일 = '시험결과.json'] = argv.filter((a) => !a.startsWith('--'));
const 읽 = (f) => JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(여기, f), 'utf8'));
let 앞, 뒤;
try { 앞 = 읽(앞파일); } catch (e) { console.error('✗ ' + 앞파일 + ' — ' + e.message); process.exit(1); }
try { 뒤 = 읽(뒤파일); } catch (e) { console.error('✗ ' + 뒤파일 + ' — ' + e.message); process.exit(1); }

console.log('\n앞 ' + 앞파일 + ' (' + (앞.잰때 || '?') + ')');
console.log('뒤 ' + 뒤파일 + ' (' + (뒤.잰때 || '?') + ')');

const 줄 = 견주기(앞.칸셈, 뒤.칸셈);
console.log('\n── 칸별 전후 ──');
console.log('  칸          정답률        맞음    틀림    빈칸   헛채움');
const 부호 = (n) => (n > 0 ? '+' + n : String(n));
for (const x of 줄) {
  console.log('  ' + x.칸.padEnd(10)
    + (x.전율 == null ? '  —' : String(x.전율) + '%').padStart(7) + ' → '
    + (x.후율 == null ? '  —' : String(x.후율) + '%').padStart(7)
    + 부호(x.바뀜.맞음).padStart(8) + 부호(x.바뀜.틀림).padStart(8)
    + 부호(x.바뀜.빈칸).padStart(8) + 부호(x.바뀜.헛채움).padStart(8)
    + (x.나빠짐 ? '   ★ 나빠짐' : ''));
}

const 전합 = 칸이름.reduce((s, k) => s + (((앞.칸셈 || {})[k] || {}).맞음 || 0), 0);
const 후합 = 칸이름.reduce((s, k) => s + (((뒤.칸셈 || {})[k] || {}).맞음 || 0), 0);
const 분모 = (셈) => 칸이름.reduce((s, k) => s + 갈래.filter((g) => g !== '둘다없음')
  .reduce((t, g) => t + (((셈 || {})[k] || {})[g] || 0), 0), 0);
console.log('\n  일곱 칸 합  맞음 ' + 전합 + '/' + 분모(앞.칸셈)
  + ' (' + (분모(앞.칸셈) ? Math.round((1000 * 전합) / 분모(앞.칸셈)) / 10 : 0) + '%)'
  + '  →  ' + 후합 + '/' + 분모(뒤.칸셈)
  + ' (' + (분모(뒤.칸셈) ? Math.round((1000 * 후합) / 분모(뒤.칸셈)) / 10 : 0) + '%)');

const 나쁜것 = 줄.filter((x) => x.나빠짐);
if (나쁜것.length) {
  console.log('\n★ **나빠진 칸 ' + 나쁜것.length + '개 — 되돌리고 까닭을 적어야 합니다** (세중님)');
  for (const x of 나쁜것) {
    console.log('  ' + x.칸 + ' — 틀림 ' + 부호(x.바뀜.틀림) + ' · 헛채움 ' + 부호(x.바뀜.헛채움)
      + ' (맞음은 ' + 부호(x.바뀜.맞음) + ')');
  }
} else {
  console.log('\n○ 틀림·헛채움이 늘어난 칸이 없습니다');
}

/* 단계별도 함께 — 첨부를 더 받고 더 읽었나 */
if (앞.셈 && 뒤.셈) {
  console.log('\n── 단계별 전후 ──');
  for (const k of Object.keys(뒤.셈)) {
    const a = 앞.셈[k] || {}; const b = 뒤.셈[k] || {};
    const 쪽 = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    console.log('  ' + k.padEnd(8) + 쪽.map((g) => g + ' ' + (a[g] || 0) + '→' + (b[g] || 0)).join(' · '));
  }
}
