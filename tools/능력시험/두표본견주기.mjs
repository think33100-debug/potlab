/* 두 표본 **나란히 견주기** — 과적합이 있나 (2026-10-21 세중님 2번)
 *
 *   node tools/능력시험/두표본견주기.mjs
 *
 * 첫 표본 50건(정답지·규칙 다듬기에 쓴 것) ↔ 둘째 표본 30건(한 번도 안 쓴 것)을
 * **같은 잣대**로 견줍니다. 그냥 합계만 보면 까닭을 못 가리므로 갈래로도 나눕니다 —
 *   · 전체
 *   · **우리 직군 공고만** (물리·작업치료사가 원문에 있는 것)
 *   · **원문을 연 것만** (쪽·첨부를 받아 읽은 것 — 「원문을 못 열었음」 제외)
 *
 * ★ 파일만 읽습니다. 그물·DB 를 안 두드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];
const 갈래 = ['맞음', '틀림', '빈칸', '헛채움', '둘다없음', '애매'];

const 읽 = (f) => JSON.parse(fs.readFileSync(path.join(여기, f), 'utf8'));
const 정답읽 = (f) => fs.readFileSync(path.join(여기, f), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));

/** 결과의 틀린것 + 칸셈으로 갈래별 셈을 다시 만듭니다 (틀린것에 id 가 있습니다) */
export function 갈래셈(결과, 걸러) {
  const 셈 = {};
  for (const k of 칸이름) 셈[k] = { 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0 };
  /* 틀린것(틀림·빈칸·헛채움)은 줄마다 있고, 맞음은 칸셈에서 빼서 구합니다 */
  const 틀린 = ((결과.다시틀린것 || 결과.틀린것) || []).filter((x) => 걸러(x.id));
  for (const x of 틀린) if (셈[x.칸] && 셈[x.칸][x.점] != null) 셈[x.칸][x.점]++;
  return { 셈, 틀린수: 틀린.length };
}

const 표 = [];
for (const [이름, 결과파일, 정답파일] of [
  ['첫 표본 50건', '시험결과_다시_33.json', '정답지.jsonl'],
  ['둘째 표본 30건', '시험결과_둘째8.json', '정답지2.jsonl'],
]) {
  if (!fs.existsSync(path.join(여기, 결과파일))) { console.log('(없음 — ' + 결과파일 + ')'); continue; }
  const 결과 = 읽(결과파일);
  const 정답 = 정답읽(정답파일);
  const 우리 = new Set(정답.filter((r) => r.우리직군 && r.우리직군 !== '아님').map((r) => r.id));
  const 못열 = new Set(정답.filter((r) => JSON.stringify(r.칸 || {}).includes('못 열었음')).map((r) => r.id));
  const 칸셈 = 결과.칸셈 || {};

  /* 전체는 칸셈 그대로 */
  const 율 = (c) => {
    const 분모 = (c.맞음 || 0) + (c.틀림 || 0) + (c.빈칸 || 0) + (c.헛채움 || 0);
    return 분모 ? Math.round((1000 * (c.맞음 || 0)) / 분모) / 10 : null;
  };
  const 한줄 = { 이름, 공고: 정답.length, 우리직군: 우리.size, 못열: 못열.size, 전체: {}, 열린것: {}, 우리것: {} };
  /* ★ 전체도 **같은 셈**으로 냅니다 — 결과의 칸셈은 「지금값」 채점이라 아래 갈래(다시뽑음)와 잣대가 섞입니다 (2026-10-21) */

  /* 「원문을 연 것만」·「우리 직군만」 — 틀린것에서 그 id 를 빼고 맞음을 다시 셉니다.
     맞음은 전체 맞음에서 (그 갈래 밖의 맞음)을 뺄 수 없으니, 정답 수로 다시 셉니다 */
  const 칸값 = (r, k) => (r.칸 && r.칸[k] ? r.칸[k].값 : undefined);
  const 없나 = (v) => v == null || ['원문에 없음', '없음', ''].includes(v);
  for (const [열, 거름] of [['전체', () => true], ['열린것', (id) => !못열.has(id)], ['우리것', (id) => 우리.has(id)]]) {
    const 셈 = {};
    for (const k of 칸이름) 셈[k] = { 맞음: 0, 틀림: 0, 빈칸: 0, 헛채움: 0, 둘다없음: 0 };
    const 틀린판 = new Map();
    for (const x of ((결과.다시틀린것 || 결과.틀린것) || [])) 틀린판.set(x.id + '|' + x.칸, x.점);
    for (const r of 정답) {
      if (!거름(r.id)) continue;
      for (const k of 칸이름) {
        const v = 칸값(r, k);
        if (v === undefined) continue;
        const 점 = 틀린판.get(r.id + '|' + k);
        if (점) 셈[k][점]++;
        else if (없나(v)) 셈[k].둘다없음++;
        else 셈[k].맞음++;
      }
    }
    for (const k of 칸이름) 한줄[열][k] = 율(셈[k]);
  }
  표.push(한줄);
}

const 폭 = 10;
for (const 열 of ['전체', '열린것', '우리것']) {
  const 이름 = 열 === '전체' ? '전체' : 열 === '열린것' ? '원문을 연 것만' : '우리 직군 공고만';
  console.log('\n══ ' + 이름 + ' ══');
  console.log('  표본'.padEnd(18) + 칸이름.map((k) => k.padStart(폭)).join(''));
  for (const r of 표) {
    console.log('  ' + r.이름.padEnd(16)
      + 칸이름.map((k) => (r[열][k] == null ? '—' : r[열][k] + '%').padStart(폭)).join(''));
  }
}
console.log('\n  (공고 수 — ' + 표.map((r) => r.이름 + ' ' + r.공고 + '건 · 우리 직군 ' + r.우리직군
  + ' · 원문 못 연 것 ' + r.못열).join(' / ') + ')');
