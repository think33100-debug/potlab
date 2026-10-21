/* 세중님 확인용 — 둘째 표본 10건의 **원문 근거 ↔ 우리 값** 표 (2026-10-21)
 *
 *   node tools/능력시험/확인용10건.mjs > tmp/확인용10건.md
 *
 * 우리 직군 공고를 먼저, 그다음 틀린·헛채움이 있는 공고를 골라 10건.
 * ★ 파일만 읽습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 칸이름 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];
const 정답 = fs.readFileSync(path.join(여기, '정답지2.jsonl'), 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
const 결과 = JSON.parse(fs.readFileSync(path.join(여기, '시험결과_둘째12.json'), 'utf8'));
const 틀린 = new Map();
for (const x of (결과.다시틀린것 || [])) 틀린.set(x.id + '|' + x.칸, x);
const 우리값 = new Map();
for (const x of (결과.다시틀린것 || [])) 우리값.set(x.id + '|' + x.칸, x.우리);

const 점수 = (r) => (r.우리직군 !== '아님' ? 10 : 0)
  + 칸이름.filter((k) => ['틀림', '헛채움'].includes((틀린.get(r.id + '|' + k) || {}).점)).length;
const 고른것 = [...정답].sort((a, b) => 점수(b) - 점수(a)).slice(0, 10);

console.log('# 둘째 표본 10건 — 원문 근거 ↔ 우리 값 (2026-10-21 · 세중님 확인용)\n');
console.log('정답은 제가 **원문(쪽·첨부)을 읽어** 적은 것이고, 우리 값은 **뽑기 규칙만 다시 걸어**(--다시뽑음) 나온 것입니다.');
console.log('「—」 는 둘 다 없음(맞게 비운 것)입니다.\n');
for (const r of 고른것) {
  console.log('## ' + r.id + ' [' + r.source + '] ' + r.기관 + ' — 우리 직군 ' + r.우리직군);
  console.log('\n| 칸 | 정답(원문) | 원문 근거 | 우리 값 | 판정 |');
  console.log('|---|---|---|---|---|');
  for (const k of 칸이름) {
    const c = (r.칸 || {})[k];
    if (!c) continue;
    const t = 틀린.get(r.id + '|' + k);
    const 판정 = t ? t.점 : (['원문에 없음', '원문을 못 열었음'].includes(c.값) ? '둘다없음' : '맞음');
    const 우리 = t ? (t.우리 == null || t.우리 === '' ? '(빈칸)' : String(t.우리)) : (판정 === '맞음' ? '정답과 같음' : '(빈칸)');
    const 자르 = (s, n) => String(s == null ? '' : s).replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, n);
    console.log('| ' + k + ' | ' + 자르(c.값, 54) + ' | ' + 자르(c.근거, 72)
      + (c.어디 ? ' <sub>(' + 자르(c.어디, 28) + ')</sub>' : '') + ' | ' + 자르(우리, 54) + ' | '
      + (판정 === '맞음' ? '○' : 판정 === '둘다없음' ? '—' : '**' + 판정 + '**') + ' |');
  }
  if (r.메모) console.log('\n' + r.메모);
  console.log('');
}
