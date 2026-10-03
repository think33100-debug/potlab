/* ═══════════════════════════════════════════════════════════════
 *  퇴직금·연차 — 옛 앱과 새 앱이 같은 답을 내나 (2026-10-03)
 * ═══════════════════════════════════════════════════════════════
 *
 *   node tools/계산기대조.mjs
 *
 *  옛 앱 공식은 index.html 의 calcSev()·calcAnn() 에서 **그대로 옮겼습니다.**
 *  옛 앱을 건드리지 않습니다 — 읽기만 했습니다 (심사 기간).
 *
 *  새 앱은 web/lib/labor.ts 를 직접 부릅니다.
 * ═══════════════════════════════════════════════════════════════ */
import { severance, leave, daysBetween } from '../web/lib/labor.ts';

/* ── 옛 앱 공식 (index.html 6764~6800줄에서 옮김) ──
   평균임금 = (3개월 임금 + 상여×3/12 + 연차수당×3/12) ÷ 3개월 일수
   퇴직금  = 평균임금 × 30 × 재직일수 ÷ 365                        */
const 옛days2 = (a, b) => Math.round((b - a) / 86400000);
function 옛퇴직금(입사, 퇴사, 월급, 상여 = 0, 연차수당 = 0) {
  const din = new Date(입사); const dout = new Date(퇴사);
  const work = 옛days2(din, dout);
  if (work < 365) return { 못받음: true, 재직일: work };
  const s3 = new Date(dout); s3.setMonth(s3.getMonth() - 3);
  const d3 = 옛days2(s3, dout);
  const total = 월급 * 3 + 상여 * 3 / 12 + 연차수당 * 3 / 12;
  const avg = total / d3;
  return { 퇴직금: avg * 30 * work / 365, 평균임금: avg, 삼개월일수: d3, 재직일: work };
}

const 만 = (v) => Math.round(v / 10000) + '만원';
const 원 = (v) => Math.round(v).toLocaleString('ko-KR') + '원';

console.log('퇴직금 — 옛 앱 ↔ 새 앱\n');
const 볼것 = [
  ['2023-03-01', '2026-03-01', 3_000_000, 0, 0],
  ['2020-07-15', '2026-10-03', 2_800_000, 2_000_000, 600_000],
  ['2025-01-02', '2026-10-01', 3_500_000, 1_200_000, 0],
];
let 다름 = 0;
for (const [입사, 퇴사, 월급, 상여, 연차수당] of 볼것) {
  const 옛 = 옛퇴직금(입사, 퇴사, 월급, 상여, 연차수당);
  const 새 = severance({
    joined: new Date(입사), left: new Date(퇴사),
    monthlyWage: 월급, bonusYear: 상여, leavePayYear: 연차수당,
  });
  console.log('  입사 ' + 입사 + ' · 퇴사 ' + 퇴사
    + ' · 월급 ' + 만(월급) + ' · 상여 ' + 만(상여) + ' · 연차수당 ' + 만(연차수당));
  if (옛.못받음 || !새.eligible) {
    console.log('     옛 ' + (옛.못받음 ? '못 받음 (재직 ' + 옛.재직일 + '일)' : 원(옛.퇴직금))
      + '   새 ' + (새.eligible ? 원(새.amount) : '못 받음 (재직 ' + 새.workedDays + '일)'));
    continue;
  }
  const 차 = Math.abs(옛.퇴직금 - 새.amount);
  const 같나 = 차 < 1000;
  if (!같나) 다름++;
  console.log('     옛 ' + 원(옛.퇴직금) + '   새 ' + 원(새.amount)
    + '   ' + (같나 ? '○ 같습니다' : '★ ' + 원(차) + ' 다릅니다'));
  console.log('        3개월 일수   옛 ' + 옛.삼개월일수 + '일 · 새 ' + 새.months3Days + '일');
  console.log('        1일 평균임금  옛 ' + 원(옛.평균임금) + ' · 새 ' + 원(새.dailyAvg));
  console.log('        재직일수     옛 ' + 옛.재직일 + '일 · 새 ' + 새.workedDays + '일');
}

/* ── 연차 — 옛 앱 calcAnn() 공식을 그대로 옮겼습니다 (index.html) ── */
function 옛연차(입사, 기준 = '2026-10-03') {
  const din = new Date(입사); const at = new Date(기준);
  let months = (at.getFullYear() - din.getFullYear()) * 12 + (at.getMonth() - din.getMonth());
  if (at.getDate() < din.getDate()) months--;
  const years = Math.floor(months / 12);
  let give;
  if (years < 1) give = Math.min(months, 11);
  else if (years < 3) give = 15;
  else give = Math.min(15 + Math.floor((years - 1) / 2), 25);
  return { 일수: give, 년: years, 개월: months % 12 };
}

console.log('\n연차 — 옛 앱 ↔ 새 앱 (기준일 2026-10-03)\n');
let 연차다름 = 0;
for (const 입사 of ['2020-03-01', '2025-06-01', '2026-06-01', '2016-01-01', '2024-10-03']) {
  const 옛 = 옛연차(입사);
  const 새 = leave(new Date(입사), new Date('2026-10-03'));
  const 같나 = 옛.일수 === 새.days;
  if (!같나) 연차다름++;
  console.log('  입사 ' + 입사 + '   옛 ' + String(옛.일수).padStart(2) + '일   새 '
    + String(새.days).padStart(2) + '일   ' + (같나 ? '○ 같습니다' : '★ 다릅니다')
    + '   (근속 옛 ' + 옛.년 + '년 ' + 옛.개월 + '개월 · 새 ' + 새.years + '년 ' + 새.months + '개월)');
}

console.log('\n' + (다름 ? '★ 퇴직금에서 ' + 다름 + '개 다릅니다' : '○ 퇴직금 세 가지 다 같습니다')
  + ' · ' + (연차다름 ? '★ 연차에서 ' + 연차다름 + '개 다릅니다' : '○ 연차 다섯 가지 다 같습니다'));
