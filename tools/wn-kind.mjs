/* 워크넷 기관종별 — **gas/wage.js 의 규칙을 떼어 씁니다** (2026-09-30).
 *
 *   import { 기관종별, 시설구분 } from './wn-kind.mjs';
 *   기관종별('그 외 기타 보건업', '주몽재활의원')  → { 종별:'재활센터', 왜:'이름 추정' }
 *   시설구분('요양원·주야간보호')                  → '요양·주간보호'
 *
 * ── 왜 베끼지 않나 ───────────────────────────────────────────
 * 업종 목록과 이름 규칙이 길고, 옛 수집기가 이미 이 말로 1,000건 가까이 담아
 * 놨습니다 (요양원 168 · 요양원·주야간보호 107 · 요양병원 47 …).
 * 베껴 쓰면 두 벌이 되어 한쪽만 고치게 됩니다. 병원 설정표(HOSP_SITES)와 같은 방식으로
 * **gas 에서 떼어 오고, 집에서 구워 두면 서버가 그것을 씁니다.**
 *
 * ── 시설 구분 (2026-09-30 · 세중님 지시) ─────────────────────
 * 나중에 「전체 / 병원 / 요양」 화면을 만들 수 있게 세 갈래만 따로 둡니다.
 * **화면에는 아직 쓰지 않습니다.** 저장만 해 둡니다.
 *   병원 · 요양·주간보호 · 모름
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const gas길 = path.join(여기, '..', 'gas', 'wage.js');
const 구운것 = path.join(여기, 'wn-kind.json');

function 규칙읽기() {
  if (fs.existsSync(gas길)) {
    const g = fs.readFileSync(gas길, 'utf8');
    const 배열 = (이름) => {
      const m = g.match(new RegExp('const ' + 이름 + ' = (\\[[\\s\\S]*?\\]);'));
      return m ? new Function('return ' + m[1])() : [];
    };
    const 정규 = (이름) => {
      const m = g.match(new RegExp('const ' + 이름 + ' = /([^\\n]*?)/;'));
      return m ? m[1] : '';
    };
    const r = {
      구운날: new Date().toISOString().slice(0, 10),
      요양업종: 배열('WN_CARE_IND'),
      공공업종: 배열('WN_PUBLIC_IND'),
      요양이름: 정규('WN_NAME_CARE'),
      공공이름: 정규('WN_NAME_PUBLIC'),
      재활이름: 정규('WN_NAME_REHAB'),
    };
    /* 서버에는 gas 가 없습니다. 집에서 구워 두면 서버가 그것을 씁니다 */
    if (r.요양업종.length && r.요양이름) {
      try { fs.writeFileSync(구운것, JSON.stringify(r) + '\n'); } catch { /* 못 써도 계속 */ }
    }
    return r;
  }
  if (fs.existsSync(구운것)) return JSON.parse(fs.readFileSync(구운것, 'utf8'));
  throw new Error('gas/wage.js 도 tools/wn-kind.json 도 없습니다. '
    + '집에서 node tools/wn-kind.mjs 를 한 번 돌려 구우세요');
}

const R = 규칙읽기();
const 요양RE = new RegExp(R.요양이름 || '요양');
const 공공RE = new RegExp(R.공공이름 || '복지관');
const 재활RE = new RegExp(R.재활이름 || '재활');

/** gas 의 wnKind_ 와 같은 차례입니다 */
export function 기관종별(업종, 기관명) {
  const ind = String(업종 || '').trim();
  const nm = String(기관명 || '').trim();
  if (R.요양업종.includes(ind)) return { 종별: '요양원·주야간보호', 왜: '업종 신고' };
  if (ind === '요양 병원') return { 종별: '요양병원', 왜: '업종 신고' };
  if (ind === '일반 병원' || ind === '종합 병원' || ind === '한방 병원') return { 종별: '병원', 왜: '업종 신고' };
  if (ind === '사회복지 상담서비스 제공업') {
    if (요양RE.test(nm)) return { 종별: '요양원·주야간보호', 왜: '업종 신고' };
    if (재활RE.test(nm)) return { 종별: '재활센터', 왜: '업종 신고' };
    return { 종별: '공공·복지기관', 왜: '업종 신고' };
  }
  if (R.공공업종.includes(ind)) {
    if (요양RE.test(nm) && !공공RE.test(nm)) return { 종별: '요양원·주야간보호', 왜: '업종 신고' };
    if (재활RE.test(nm) && !공공RE.test(nm)) return { 종별: '재활센터', 왜: '업종 신고' };
    return { 종별: '공공·복지기관', 왜: '업종 신고' };
  }
  if (공공RE.test(nm)) return { 종별: '공공·복지기관', 왜: '이름 추정' };
  if (요양RE.test(nm)) return { 종별: '요양원·주야간보호', 왜: '이름 추정' };
  if (/요양병원/.test(nm)) return { 종별: '요양병원', 왜: '이름 추정' };
  if (/병원|의원|의료원/.test(nm)) return { 종별: '병원·의원', 왜: '이름 추정' };
  if (재활RE.test(nm)) return { 종별: '재활센터', 왜: '이름 추정' };
  return { 종별: '기타', 왜: '이름 추정' };
}

/* 진료과 이름 — 「바른정형외과」 처럼 이름에 병원·의원이 없는 의원이 있습니다.
   gas 의 wnKind_ 는 그런 곳을 「기타」 로 봅니다. **기관종별은 옛 수집기와 같게 두고**
   시설 구분에서만 한 번 더 봅니다 (2026-09-30 에 찾았습니다) */
const 진료과 = /정형외과|신경외과|재활의학과|신경과|내과|외과|소아(청소년)?과|한의원|치과|이비인후과|피부과|산부인과|비뇨(기)?과|안과|마취통증|클리닉|메디컬|의료재단/;

/** 나중에 만들 「전체 / 병원 / 요양」 화면용 세 갈래. **아직 화면에 안 씁니다** */
export function 시설구분(종별, 기관명) {
  const t = String(종별 || '');
  const nm = String(기관명 || '');
  if (/요양원|주야간|주간보호|요양병원/.test(t)) return '요양·주간보호';
  if (/병원|의원|상급종합|종합병원|재활센터/.test(t)) return '병원';
  if (진료과.test(nm)) return '병원';
  return '모름';
}

export const 구운날 = R.구운날;

/* ── 스스로 하는 검사 ────────────────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('wn-kind.mjs')) {
  const 시험 = [
    ['그 외 기타 보건업', '복지법인주몽재단주몽재활의원', '병원·의원', '병원']  /* gas 는 「의원」 을 먼저 봅니다 */,
    ['요양 병원', '유성요양병원', '요양병원', '요양·주간보호'],
    ['노인 요양 복지시설 운영업', '봄봄노인요양원', '요양원·주야간보호', '요양·주간보호'],
    ['종합 병원', '○○의료원', '병원', '병원'],
    /* 기관종별은 gas 와 **같아야** 합니다 — 이름에 병원·의원이 없어 「기타」.
       시설 구분만 진료과 이름을 보고 「병원」 으로 잡습니다 */
    ['', '바른정형외과', '기타', '병원'],
    ['', '신현주야간보호센터', '요양원·주야간보호', '요양·주간보호'],
    ['', '가람', '기타', '모름'],
  ];
  let 틀림 = 0;
  console.log('규칙 구운 날 ' + R.구운날 + ' · 요양업종 ' + R.요양업종.length
    + '가지 · 공공업종 ' + R.공공업종.length + '가지\n');
  for (const [업종, 이름, 바란종별, 바란구분] of 시험) {
    const k = 기관종별(업종, 이름);
    const g = 시설구분(k.종별, 이름);
    const ok = k.종별 === 바란종별 && g === 바란구분;
    if (!ok) 틀림++;
    console.log((ok ? '○ ' : '★ ') + 이름.slice(0, 20).padEnd(22)
      + k.종별.padEnd(16) + '→ ' + g + (ok ? '' : '   (바란 것 ' + 바란종별 + ' / ' + 바란구분 + ')'));
  }
  console.log(틀림 ? '\n★ ' + 틀림 + '개 틀렸습니다' : '\n○ 다 맞습니다');
  process.exit(틀림 ? 1 : 0);
}
