/* gas/wage.js 의 직군 판정을 **떼어 와서** 씁니다 — 베끼지 않습니다 (2026-09-26).
 *
 * ── 왜 이렇게 하나 ───────────────────────────────────────────
 * 새 수집기가 옛 수집기와 **같은 답**을 내야 사흘 대조가 뜻이 있습니다.
 * 규칙을 베껴 두면 한쪽만 고치고 나머지를 빼먹습니다 — 이 저장소에서
 * 실제로 여러 번 있었던 일입니다.
 * 그래서 `gas/wage.js` 에서 함수 본문을 떼어 와 그대로 돌립니다.
 *
 * 알리오 경로를 다 옮기고 gas 에서 끄면, 그때 이 파일이 **규칙의 집**이
 * 됩니다 (gas 사본을 지우고 여기 본문을 붙입니다).
 *
 * ── gas 가 없으면 ────────────────────────────────────────────
 * `gas/` 는 저장소 밖(.gitignore)이라 GitHub Actions 에는 없습니다.
 * 그래서 **떼어 온 결과를 `tools/gas-rules.json` 에 구워 둡니다.**
 * 집 컴퓨터에서 `node tools/gas-rules.mjs --굽기` 를 돌리면 다시 굽습니다.
 * Actions 는 구운 파일만 씁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const GAS_경로 = path.join(여기, '..', 'gas', 'wage.js');
const 구운것 = path.join(여기, 'gas-rules.json');

/* 떼어 올 것 — 상수와 함수. 늘리면 아래 만들기() 도 같이 봅니다 */
/* multiRole_ 은 정규식을 함수 안에 품고 있어 떼어 올 상수가 없습니다 */
const 상수이름 = ['JOB_WORDS', 'NOT_OURS', 'MEDTECH', 'MED_ONLY_OTHER', 'OTHER_JOBS', 'OTHER_PROF_RE', 'OUR_PROF_RE',
  /* 병원 게시판 판정에 쓰는 것 — hospVerdict_ 가 이 셋을 봅니다 (2026-09-28) */
  'HS_SKIP_RE', 'HS_BROAD_RE', 'HS_OTHER_RE',
  /* sort-rule 에서 구워 넣은 갈래 규칙 (2026-09-28). hospVerdict_ 가 이걸 부릅니다 */
  'SR_확정단어', 'SR_보류보장단어', 'SR_받기예외', 'SR_버림단어',
  /* 「뽑을 단어」 (2026-09-28) */
  'SR_확정', 'SR_가능성', 'SR_기존에만', 'SR_쌓아둘직종', 'SR_뭉뚱그림', 'SR_잘린제목'];
const 함수이름 = ['matchJob_', 'notOurs_', 'multiRole_', 'mixedTitle_', 'titleOtherOnly_', 'fmtDate_',
  /* 「담음 · 보류 · 버림」 을 가르는 곳. 확정 낱말을 고칠 때 여기까지 돌려 봐야
     보류함으로 가는지 쓰레기통으로 가는지 알 수 있습니다 (2026-09-28) */
  'hospVerdict_',
  /* 구워 넣은 것 — 판정은 이제 여기서 합니다 */
  'SR_갈래', 'SR_여럿나열', 'SR_붙이기',
  'SR_확정찾기', 'SR_가능성찾기', 'SR_쌓아둘것인가'];

function 함수떼기(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return null;
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}
/* 상수는 여러 줄에 걸치고 안에 `;` 가 든 글자도 있습니다.
   정규식으로 끝을 찾으면 틀립니다 — 괄호 짝을 세어 끝을 찾습니다.
   (정규식으로 하다가 한 번 전부 「못 찾음」 이 났습니다) */
function 상수떼기(src, name) {
  /* ⚠ **이름이 정확히 맞아야 합니다** (2026-09-28).
     전에는 앞부분만 맞아도 잡혔습니다 — `SR_확정` 을 찾으면 `SR_확정단어` 가
     먼저 걸려서 같은 상수를 두 번 떼어 왔고,
     「Identifier 'SR_확정단어' has already been declared」 로 죽었습니다.
     이름 바로 뒤에 공백이나 `=` 이 와야 그 이름입니다. */
  const 머리 = '\nconst ' + name;
  let i = -1;
  for (let k = src.indexOf(머리); k > -1; k = src.indexOf(머리, k + 1)) {
    const 뒤 = src[k + 머리.length];
    if (뒤 === ' ' || 뒤 === '=') { i = k; break; }
  }
  if (i < 0 && src.startsWith('const ' + name)) i = -1; else if (i < 0) return null;
  i = i < 0 ? 0 : i + 1;
  const eq = src.indexOf('=', i);
  if (eq < 0) return null;
  let 깊이 = 0, 따옴표 = '';
  for (let k = eq; k < src.length; k++) {
    const c = src[k];
    /* 역슬래시는 **따옴표 밖에서도** 다음 글자를 덮습니다.
       정규식 안의 `\(` 를 여는 괄호로 세다가 MEDTECH 가 다음 상수까지
       통째로 삼켰습니다 (2026-09-26). */
    if (c === '\\') { k++; continue; }
    if (따옴표) { if (c === 따옴표) 따옴표 = ''; continue; }
    if (c === "'" || c === '"' || c === '`') { 따옴표 = c; continue; }
    if (c === '[' || c === '{' || c === '(') 깊이++;
    /* 0 아래로 내리지 않습니다. 정규식 낱말칸 안의 닫는 괄호를 짝으로 세면
       깊이가 음수가 되고, 그러면 그 줄의 `;` 를 끝으로 못 알아봅니다.
       `HS_BROAD_RE` 의 `보건\s*[,)/·]` 가 그랬습니다 — 630자를 삼켜
       다음 함수까지 끌고 왔습니다 (2026-09-28). */
    else if (c === ']' || c === '}' || c === ')') 깊이 = Math.max(0, 깊이 - 1);
    else if (c === ';' && 깊이 === 0) return src.slice(i, k + 1);
  }
  return null;
}

/* gas 에서 떼어 와 한 덩어리 글로 만듭니다 */
export function 굽기() {
  const src = fs.readFileSync(GAS_경로, 'utf8');
  const 조각 = [];
  const 없는것 = [];
  /* 조각마다 「말이 되나」 를 바로 봅니다. 안 보면 아래 new Function 에서
     `<anonymous_script>:113 Unexpected token ')'` 만 뜨고 **어느 상수인지 안 나옵니다**
     — 그 줄 번호로 원인을 찾느라 헤맸습니다 (2026-09-28). */
  const 깨진것 = [];
  const 담기 = (이름, t) => {
    if (!t) { 없는것.push(이름); return; }
    try { new Function(t); } catch (e) { 깨진것.push(이름 + ' (' + e.message + ' · ' + t.length + '자)'); return; }
    조각.push(t);
  };
  for (const n of 상수이름) 담기('const ' + n, 상수떼기(src, n));
  for (const n of 함수이름) 담기('function ' + n, 함수떼기(src, n));
  if (없는것.length) throw new Error('gas 에서 못 찾은 것: ' + 없는것.join(' · '));
  if (깨진것.length) throw new Error('잘못 잘린 것: ' + 깨진것.join(' · '));
  return { 구운날: new Date().toISOString().slice(0, 10), 글: 조각.join('\n') };
}

function 읽기() {
  /* 집 컴퓨터면 gas 에서 바로, Actions 면 구운 것에서 */
  if (fs.existsSync(GAS_경로)) {
    /* 구운 것이 있으면 넘어가되, **까닭을 삼키지 않습니다.**
       한 번 이 catch 가 「못 찾음」 을 가려서 엉뚱한 데를 팠습니다 */
    try { return 굽기(); }
    catch (e) {
      if (!fs.existsSync(구운것)) throw e;
      console.error('※ gas 에서 못 떼어 왔습니다 (' + e.message + ') — 구운 것을 씁니다');
    }
  }
  if (!fs.existsSync(구운것)) {
    throw new Error('gas/wage.js 도 tools/gas-rules.json 도 없습니다. 집 컴퓨터에서 '
      + 'node tools/gas-rules.mjs --굽기 를 먼저 돌리세요');
  }
  return JSON.parse(fs.readFileSync(구운것, 'utf8'));
}

const 통 = 읽기();
/* 함수뿐 아니라 **정규식 상수도** 꺼냅니다 — gas 의 collectJobs 가
   MEDTECH 로 「보류함으로 보낼지 그냥 버릴지」 를 가릅니다.
   그걸 안 옮겼다가 보류함이 362건이 됐습니다 (2026-09-26) */
const 밖으로 = new Function(통.글 + '\nreturn { '
  + 함수이름.concat(['MEDTECH', 'MED_ONLY_OTHER', 'OTHER_PROF_RE', 'OUR_PROF_RE', 'OTHER_JOBS',
    'HS_SKIP_RE', 'HS_BROAD_RE', 'HS_OTHER_RE']).join(', ') + ' };')();

export const matchJob = 밖으로.matchJob_;
export const notOurs = 밖으로.notOurs_;
export const mixedTitle = 밖으로.mixedTitle_;
export const titleOtherOnly = 밖으로.titleOtherOnly_;
export const fmtDate = 밖으로.fmtDate_;
/* 정규식 상수도 내보냅니다 — gas 의 collectJobs 가 이걸로 「보류함으로 보낼지
   그냥 버릴지」 를 가릅니다. 안 옮겼다가 보류함이 362건이 됐습니다 (2026-09-26) */
export const MEDTECH = 밖으로.MEDTECH;
export const MED_ONLY_OTHER = 밖으로.MED_ONLY_OTHER;
/* 첨부를 읽고 「그럼 무슨 직군이 적혀 있었나」 를 적어 주려고 씁니다 (sort-rule 5단계) */
export const OTHER_PROF_RE = 밖으로.OTHER_PROF_RE;
export const OUR_PROF_RE = 밖으로.OUR_PROF_RE;
export const OTHER_JOBS = 밖으로.OTHER_JOBS;
/* 병원 게시판 판정 — 「담음(직군) · 보류(…) · 버림(…)」 를 글자로 돌려줍니다 */
export const hospVerdict = 밖으로.hospVerdict_;
export const HS_SKIP_RE = 밖으로.HS_SKIP_RE;
export const HS_BROAD_RE = 밖으로.HS_BROAD_RE;
export const HS_OTHER_RE = 밖으로.HS_OTHER_RE;
export const 구운날 = 통.구운날;

/* node tools/gas-rules.mjs --굽기 */
if (process.argv[1] && process.argv[1].endsWith('gas-rules.mjs')) {
  if (process.argv.includes('--굽기')) {
    const g = 굽기();
    fs.writeFileSync(구운것, JSON.stringify(g, null, 0) + '\n');
    console.log('구웠습니다 · ' + 구운것 + ' · ' + g.글.length + '자 · ' + g.구운날);
  } else {
    console.log('구운 날 ' + 구운날 + ' · 떼어 온 함수 ' + 함수이름.length + '개');
    console.log('  matchJob("물리치료사 채용")        → ' + matchJob('물리치료사 채용'));
    console.log('  matchJob("작업치료사·물리치료사")   → ' + matchJob('작업치료사·물리치료사'));
    console.log('  notOurs("간호사 채용")            → ' + notOurs('간호사 채용'));
    console.log('  notOurs("간호사 및 작업치료사")     → ' + notOurs('간호사 및 작업치료사'));
    console.log('  mixedTitle("직원 채용(행정, 작업치료사)") → ' + mixedTitle('직원 채용(행정, 작업치료사)'));
    console.log('\n--굽기 를 붙이면 tools/gas-rules.json 을 다시 굽습니다');
  }
}
