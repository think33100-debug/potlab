/* 능력시험 ③ **채점** (2026-10-19 밤)
 *
 *   node tools/능력시험/시험.mjs                    정답지에 있는 공고를 채점
 *   node tools/능력시험/시험.mjs --표 docs/…md      결과를 문서로도
 *   node tools/능력시험/시험.mjs --자기점검
 *
 * ── 무엇을 재나 (세중님 2번) ─────────────────────────────────────
 *   ① 목록에서 찾음        ← `목록시험.mjs` 가 따로 잽니다 (여기서는 받아 씁니다)
 *   ② 상세 본문            메뉴뿐이 아닌 **진짜 본문**인가
 *   ③ 첨부 찾음            **쪽에 걸린 수** 대비 우리가 적어 둔 수
 *   ④ 첨부 받음            앞 바이트로 가린 **진짜 형식**인가 (HTML 이면 못 받은 것)
 *   ⑤ 첨부 읽음            글자 수 · 표 보존
 *   ⑥ 직군 판정            정답 ↔ 우리 값
 *   ⑦ 일곱 칸              맞음 / 틀림 / **빈칸**(정답 있는데 비움) / **헛채움**(정답 없는데 채움)
 *
 * ★ 두 가지를 **갈라** 잽니다 —
 *     지금값   DB 에 들어 있는 값 (= 회원이 보는 값)
 *     다시뽑음 같은 원문에 **뽑기 규칙만** 다시 걸어 본 값 (`칸뽑기()`)
 *   둘이 다르면 「규칙은 되는데 담길 때 안 들어간 것」입니다.
 * ★ DB 에 아무것도 쓰지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 칸뽑기, 고용형태판정, 본문직군 } from '../공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};

/* ── 채점 규칙 (한 자리) ──────────────────────────────────────── */
export const 없음말 = ['원문에 없음', '없음', null, ''];
export const 애매인가 = (v) => typeof v === 'string' && /^애매/.test(v);
export const 없나 = (v) => v == null || 없음말.includes(v);

/** 한 칸 채점 — 정답 ↔ 우리 값 */
export function 칸채점(정답, 우리) {
  if (애매인가(정답)) return { 점: '애매', 왜: '정답이 애매라 안 셉니다' };
  const 정없 = 없나(정답); const 우없 = 없나(우리);
  if (정없 && 우없) return { 점: '둘다없음' };
  if (정없 && !우없) return { 점: '헛채움', 왜: '정답은 「원문에 없음」인데 우리는 「' + String(우리).slice(0, 40) + '」' };
  if (!정없 && 우없) return { 점: '빈칸', 왜: '정답은 「' + String(정답).slice(0, 40) + '」인데 우리는 비었습니다' };
  return 같나(정답, 우리)
    ? { 점: '맞음' }
    : { 점: '틀림', 왜: '정답 「' + String(정답).slice(0, 40) + '」 ↔ 우리 「' + String(우리).slice(0, 40) + '」' };
}

/** 값이 같은가 — 칸마다 결이 다릅니다 */
export function 같나(a, b) {
  const A = String(a).trim(); const B = String(b).trim();
  if (A === B) return true;
  /* 날짜 — 2026-10-24 · 2026.10.24 · 20261024 를 같게 봅니다 */
  const 날 = (s) => {
    const m = s.match(/(20\d\d)\D?(\d{1,2})\D?(\d{1,2})/);
    return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : null;
  };
  if (날(A) && 날(B)) return 날(A) === 날(B);
  /* 시각 — 18:00 · 18시 · 오후 6시 */
  const 시 = (s) => {
    const m = s.match(/(오전|오후)?\s*(\d{1,2})\s*(?::|시)\s*(\d{2})?/);
    if (!m) return null;
    let h = Number(m[2]); if (m[1] === '오후' && h < 12) h += 12;
    return String(h).padStart(2, '0') + ':' + (m[3] || '00');
  };
  if (시(A) && 시(B)) return 시(A) === 시(B);
  /* 숫자 — 2 · 2명 */
  const n = (s) => (/^\D*(\d{1,3})\D*$/.test(s) ? s.match(/(\d{1,3})/)[1] : null);
  if (n(A) && n(B)) return n(A) === n(B);
  /* 금액·글 — 공백·쉼표를 지우고 **한쪽이 다른 쪽을 품으면** 같게 봅니다
     (우리 값에 「(세전)」 같은 꼬리가 붙는 일이 흔합니다) */
  const 납 = (s) => s.replace(/[\s,·()]/g, '');
  const a2 = 납(A); const b2 = 납(B);
  if (a2 && b2 && (a2.includes(b2) || b2.includes(a2))) return true;
  return false;
}

/* ── 자기점검 ─────────────────────────────────────────────────── */
function 검사() {
  let n = 0; const 재다 = (조건, 글) => { n++; if (!조건) throw new Error('자기점검 ' + n + ' ' + 글); };
  재다(칸채점('2026-10-24', '2026.10.24').점 === '맞음', '날짜 꼴이 달라 틀림이 됩니다');
  재다(칸채점('18:00', '오후 6시').점 === '맞음', '시각 꼴이 달라 틀림이 됩니다');
  재다(칸채점(2, '2명').점 === '맞음', '2 와 2명을 다르게 봅니다');
  재다(칸채점('원문에 없음', null).점 === '둘다없음', '둘 다 없음을 못 봅니다');
  재다(칸채점('원문에 없음', '3400만원').점 === '헛채움', '헛채움을 못 봅니다');
  재다(칸채점('2명', null).점 === '빈칸', '빈칸을 못 봅니다');
  재다(칸채점('2명', '5명').점 === '틀림', '틀림을 못 봅니다');
  재다(칸채점('애매 — 통합 공고라 우리 직군 인원이 안 적혀 있음', '3명').점 === '애매', '애매를 안 걸러 냅니다');
  재다(칸채점('3,400만원', '3400만원 (세전)').점 === '맞음', '꼬리 붙은 금액을 틀림으로 봅니다');
  재다(칸채점('내규에 따름', '내규에 따름').점 === '맞음', '같은 글을 틀림으로 봅니다');
  재다(!같나('2026-10-24', '2026-11-03'), '다른 날짜를 같다고 합니다');
  재다(!같나('2명', '20명'), '2명과 20명을 같다고 합니다');
  console.log('○ 시험 채점 규칙 자기점검 통과 — ' + n + '가지');
}
검사();
if (argv.includes('--자기점검')) process.exit(0);

/* ── 자료 읽기 ───────────────────────────────────────────────── */
const 정답파일 = path.join(여기, '정답지.jsonl');
if (!fs.existsSync(정답파일)) { console.error('✗ 정답지.jsonl 이 없습니다 — 먼저 원문을 읽고 정답을 적습니다'); process.exit(1); }
const 정답들 = fs.readFileSync(정답파일, 'utf8').split('\n').map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//')).map((l) => JSON.parse(l));
const { 표본 } = JSON.parse(fs.readFileSync(path.join(여기, '표본.json'), 'utf8'));
const 표본맵 = new Map(표본.map((x) => [x.id, x]));
const 원문사실 = JSON.parse(fs.readFileSync(path.join(여기, '원문', '원문사실.json'), 'utf8'));
const 사실맵 = new Map(원문사실.목록.map((x) => [x.id, x]));
const 목록결과 = fs.existsSync(path.join(여기, '목록시험.json'))
  ? JSON.parse(fs.readFileSync(path.join(여기, '목록시험.json'), 'utf8')) : null;

const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];
const 셈 = {
  목록: { '○': 0, '✗': 0, 안재봄: 0 },
  본문: { '○': 0, '△': 0, '✗': 0 },
  첨부찾기: { '○': 0, '△': 0, '✗': 0, 첨부없음: 0 },
  첨부받기: { '○': 0, '△': 0, '✗': 0, 해당없음: 0 },
  첨부읽기: { '○': 0, '△': 0, '✗': 0, 해당없음: 0 },
  직군: { 맞음: 0, 틀림: 0, 빈칸: 0, 애매: 0 },
};
const 칸셈 = {};
for (const k of 칸이름) 칸셈[k] = { 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0, 둘다없음: 0, 애매: 0 };
const 출처셈 = new Map();
const 틀린것 = [];

for (const 답 of 정답들) {
  const x = 표본맵.get(답.id); const f = 사실맵.get(답.id);
  if (!x || !f) { console.log('  (표본·원문에 없는 정답 — ' + 답.id + ')'); continue; }
  const s = x.source || '?';
  if (!출처셈.has(s)) 출처셈.set(s, { 공고: 0, 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0 });
  출처셈.get(s).공고++;

  /* ① 목록 */
  if (목록결과 && 목록결과[답.id] != null) 셈.목록[목록결과[답.id] ? '○' : '✗']++;
  else 셈.목록.안재봄++;

  /* ② 본문 — 메뉴뿐이 아닌가 */
  const 쪽글 = (() => {
    const p = path.join(여기, '원문', 답.id, '쪽.txt');
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  })();
  const 본문표식 = ['접수', '모집', '자격', '채용', '제출', '기간'].filter((w) => 쪽글.includes(w)).length;
  셈.본문[쪽글.length >= 300 && 본문표식 >= 3 ? '○' : (쪽글.length >= 120 ? '△' : '✗')]++;

  /* ③ 첨부 찾기 — 쪽에 걸린 수 대비
     ★ `JS주소`(javascript:gfn_fileDown…)는 **쪽만 보고는 받을 수 없는 꼴**이라
       「쪽에 있는 첨부」로 세지 않습니다. 따로 적습니다 (워크넷·나라일터가 그 꼴이고
       거기는 **API** 로 받습니다 — getItemFile) */
  const 쪽첨 = (f.쪽첨부 || []).filter((a) => a.url).length;
  const js첨 = (f.쪽첨부 || []).filter((a) => !a.url).length;
  if (js첨) 셈.첨부찾기.JS주소 = (셈.첨부찾기.JS주소 || 0) + 1;
  const db첨 = f.DB첨부 || 0;
  if (!쪽첨 && !db첨) 셈.첨부찾기.첨부없음++;
  else if (db첨 >= 쪽첨 && db첨 > 0) 셈.첨부찾기['○']++;
  else if (db첨 > 0) 셈.첨부찾기['△']++;
  else 셈.첨부찾기['✗']++;

  /* ④⑤ 첨부 받기·읽기 */
  const 받은 = f.받은첨부 || [];
  if (!받은.length) { 셈.첨부받기.해당없음++; 셈.첨부읽기.해당없음++; } else {
    const 진짜 = 받은.filter((a) => ['pdf', 'hwp', 'zip계열'].includes(a.진짜형식)).length;
    셈.첨부받기[진짜 === 받은.length ? '○' : (진짜 ? '△' : '✗')]++;
    const 읽힘 = 받은.filter((a) => (a.글자수 || 0) > 200).length;
    셈.첨부읽기[읽힘 === 받은.length ? '○' : (읽힘 ? '△' : '✗')]++;
  }

  /* ⑥ 직군 */
  const 직답 = 답.우리직군 || null;
  if (애매인가(직답)) 셈.직군.애매++;
  else if (!x.지금값.직군) 셈.직군[직답 === '아님' ? '맞음' : '빈칸']++;
  else if (직답 === '아님') 셈.직군.틀림++;
  else 셈.직군[String(x.지금값.직군).includes(String(직답).replace('사', '')) ? '맞음' : '틀림']++;

  /* ⑦ 일곱 칸 — 지금값(회원이 보는 값) 으로 채점 */
  for (const k of 칸이름) {
    const 정 = 답.칸 && 답.칸[k] ? 답.칸[k].값 : undefined;
    if (정 === undefined) continue;             /* 정답을 아직 안 적은 칸 */
    const 우 = x.지금값[k] ?? null;
    const r = 칸채점(정, 우);
    칸셈[k][r.점] = (칸셈[k][r.점] || 0) + 1;
    if (['맞음', '틀림', '빈칸', '헛채움'].includes(r.점)) 출처셈.get(s)[r.점] = (출처셈.get(s)[r.점] || 0) + 1;
    if (['틀림', '빈칸', '헛채움'].includes(r.점)) {
      틀린것.push({ id: 답.id, source: s, 칸: k, 점: r.점, 왜: r.왜,
        근거: (답.칸[k].근거 || '').slice(0, 60), 어디: 답.칸[k].어디 || '' });
    }
  }
}

/* ── 찍기 ────────────────────────────────────────────────────── */
console.log('\n채점한 공고 ' + 정답들.length + '건');
console.log('\n── 단계별 ──');
for (const [단, v] of Object.entries(셈)) {
  console.log('  ' + 단.padEnd(10) + Object.entries(v).map(([k, n]) => k + ' ' + n).join(' · '));
}
console.log('\n── 칸별 (정답 ↔ 회원이 보는 값) ──');
console.log('  칸        맞음  틀림  빈칸  헛채움  둘다없음  애매');
for (const k of 칸이름) {
  const c = 칸셈[k];
  const 분모 = c.맞음 + c.틀림 + c.빈칸 + c.헛채움 + c.둘다없음;
  console.log('  ' + k.padEnd(8) + String(c.맞음).padStart(4) + String(c.틀림).padStart(6)
    + String(c.빈칸).padStart(6) + String(c.헛채움).padStart(7) + String(c.둘다없음).padStart(9)
    + String(c.애매).padStart(6)
    + (분모 ? '   정답률 ' + (100 * (c.맞음 + c.둘다없음) / 분모).toFixed(0) + '%' : ''));
}
console.log('\n── 출처별 ──');
for (const [s, c] of [...출처셈].sort((a, b) => b[1].공고 - a[1].공고)) {
  const 분모 = c.맞음 + c.틀림 + c.빈칸 + c.헛채움;
  console.log('  ' + s.padEnd(5) + '공고 ' + String(c.공고).padStart(3) + ' · 맞음 ' + String(c.맞음).padStart(3)
    + ' · 틀림 ' + String(c.틀림).padStart(3) + ' · 빈칸 ' + String(c.빈칸).padStart(3)
    + ' · 헛채움 ' + String(c.헛채움).padStart(3)
    + (분모 ? ' · ' + (100 * c.맞음 / 분모).toFixed(0) + '%' : ''));
}
console.log('\n── 틀린 것·놓친 것 ' + 틀린것.length + '개 ──');
for (const v of 틀린것.slice(0, 40)) {
  console.log('  ' + v.id.padEnd(20) + v.source.padEnd(5) + v.칸.padEnd(7) + v.점.padEnd(5) + (v.왜 || ''));
  if (v.근거) console.log('      정답 근거 「' + v.근거 + '」 ' + (v.어디 ? '(' + v.어디 + ')' : ''));
}

const 낼곳 = path.join(여기, '시험결과.json');
fs.writeFileSync(낼곳, JSON.stringify({ 잰때: new Date().toISOString(), 셈, 칸셈,
  출처별: Object.fromEntries(출처셈), 틀린것 }, null, 1) + '\n', 'utf8');
console.log('\n' + 낼곳 + ' 에 적었습니다. DB 에 아무것도 쓰지 않았습니다.');
