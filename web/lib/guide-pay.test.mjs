/* lib/guide-pay.ts 가 DB 에서 뽑은 값과 같은지 합계로 맞춰 봅니다 (2026-11-13).
   돌리기: node web/lib/guide-pay.test.mjs
   아래 「DB」 숫자는 운영 DB 「병원보수」 표에 같은 날 같은 질의로 물어 받은 합계입니다 — 옮겨 적다 틀리면 여기서 걸립니다.
   표를 다시 뽑으면 이 숫자도 그때 받은 합계로 바꿉니다 */
import { 알리미, 알리오, 공시해 } from './guide-pay.ts';

const DB = {
  알리미: { n: 42, 보건직합: 2427466000, 신입n: 41, 신입합: 1730423000 },
  알리오: { n: 18, 신입합: 760631000 },
  해: 2025,
};

const 합 = (xs) => xs.reduce((a, b) => a + b, 0);
const 본 = {
  알리미: {
    n: 알리미.length,
    보건직합: 합(알리미.map((r) => r[1])),
    신입n: 알리미.filter((r) => r[2] != null).length,
    신입합: 합(알리미.map((r) => r[2] ?? 0)),
  },
  알리오: { n: 알리오.length, 신입합: 합(알리오.map((r) => r[1])) },
  해: 공시해,
};

const 이름겹침 = (xs) => xs.length - new Set(xs.map((r) => r[0])).size;
const 틀림 = [];
if (JSON.stringify(본) !== JSON.stringify(DB)) 틀림.push(`합계가 다릅니다 — 파일 ${JSON.stringify(본)} · DB ${JSON.stringify(DB)}`);
if (이름겹침(알리미) || 이름겹침(알리오)) 틀림.push('같은 기관 이름이 두 번 있습니다');

if (틀림.length) { console.error(틀림.join('\n')); process.exit(1); }
console.log(`맞음 — 알리미 ${본.알리미.n}곳(신입 ${본.알리미.신입n}곳) · 알리오 ${본.알리오.n}곳 · ${본.해}년`);
