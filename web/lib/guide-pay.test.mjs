/* lib/guide-pay.ts 가 DB 에서 뽑은 값과 같은지 합계로 맞춰 봅니다 (2026-11-13).
   돌리기: node web/lib/guide-pay.test.mjs
   아래 「DB」 숫자는 운영 DB 「병원보수」·「기관」 표에 같은 날 같은 질의로 물어 받은 합계입니다 — 옮겨 적다 틀리면 여기서 걸립니다.
   표를 다시 뽑으면 이 숫자도 그때 받은 합계로 바꿉니다 */
import { 알리미, 알리오, 공시해, 병원정보 } from './guide-pay.ts';

const DB = {
  알리미: { n: 42, 보건직합: 2427466000, 신입n: 41, 신입합: 1730423000 },
  알리오: { n: 18, 신입합: 760631000 },
  해: 2025,
};
/* 병원정보(슬러그·시도) 쪽 — 공시 번호의 합과 시도별 곳 수.
   알리오의 「시도가 하나인 곳」은 DB 가 14곳(인천 1 = 대한적십자사)을 주지만, 대한적십자사는 전국 기관이라 파일에서는 비웠습니다 → 13곳 */
const DB정보 = {
  알리미번호합: 420000957,
  알리오번호합: 2882,
  알리미시도: { 강원: 5, 경기: 5, 경남: 3, 경북: 5, 대구: 1, 부산: 1, 서울: 2, 인천: 3, 전남광주: 3, 전북: 2, 제주: 2, 충남: 4, 충북: 2 },
  알리미시도없음: 4,
  알리오시도: { 강원: 1, 경기: 3, 경남: 1, 대구: 1, 대전: 1, 서울: 3, 전남광주: 1, 제주: 1, 충북: 1 },
  알리오시도없음: 5,
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

/* 병원정보 */
const 번호 = (이름) => Number((병원정보[이름]?.슬러그 ?? '').replace(/\D/g, ''));
const 시도셈 = (xs) => { const o = {}; for (const [이름] of xs) { const s = 병원정보[이름]?.시도; if (s) o[s] = (o[s] ?? 0) + 1; } return Object.fromEntries(Object.entries(o).sort()); };
const 없는곳 = [...알리미, ...알리오].filter(([이름]) => !병원정보[이름]).map(([이름]) => 이름);
const 남는곳 = Object.keys(병원정보).filter((k) => ![...알리미, ...알리오].some(([이름]) => 이름 === k));
const 슬러그들 = Object.values(병원정보).map((x) => x.슬러그);
const 본정보 = {
  알리미번호합: 합(알리미.map(([이름]) => 번호(이름))),
  알리오번호합: 합(알리오.map(([이름]) => 번호(이름))),
  알리미시도: 시도셈(알리미),
  알리미시도없음: 알리미.filter(([이름]) => !병원정보[이름]?.시도).length,
  알리오시도: 시도셈(알리오),
  알리오시도없음: 알리오.filter(([이름]) => !병원정보[이름]?.시도).length,
};
if (없는곳.length) 틀림.push(`병원정보에 없는 곳: ${없는곳.join(', ')}`);
if (남는곳.length) 틀림.push(`표에 없는데 병원정보에만 있는 곳: ${남는곳.join(', ')}`);
if (new Set(슬러그들).size !== 슬러그들.length) 틀림.push('슬러그가 겹칩니다');
if (슬러그들.some((s) => !/^(rhs-\d{8}|alio-c\d{4})$/.test(s))) 틀림.push('슬러그 꼴이 다릅니다');
if (JSON.stringify(본정보) !== JSON.stringify(DB정보)) 틀림.push(`병원정보 셈이 다릅니다 — 파일 ${JSON.stringify(본정보)} · DB ${JSON.stringify(DB정보)}`);

if (틀림.length) { console.error(틀림.join('\n')); process.exit(1); }
console.log(`맞음 — 알리미 ${본.알리미.n}곳(신입 ${본.알리미.신입n}곳) · 알리오 ${본.알리오.n}곳 · ${본.해}년 · 병원정보 ${슬러그들.length}곳(시도 있는 곳 ${슬러그들.length - 본정보.알리미시도없음 - 본정보.알리오시도없음})`);
