/* 세전 ↔ 세후 계산. 값은 전부 공식 자료에서 확인한 것입니다 — 짐작한 숫자가 없습니다.
   (node lib/tax.test.mjs)

   **요율은 여기 없습니다.** 해마다 확인할 값은 lib/rates.ts 한 곳에 모았습니다 —
   계산기 셋과 가입 설문이 같은 파일을 봅니다. 아래 re-export 는 이 파일을
   쓰던 화면들이 그대로 돌게 두는 것뿐입니다.

   ※ 소득세는 월급명세서와 같은 「근로소득 간이세액표」(lib/tax-table.ts)로 뗍니다
     (2026-11-16 세중님 「명세서 기준으로」 — 전에는 한 해 결정세액을 12로 나눠 어림해
      명세서보다 월 1~1.5만 원 많이 나왔습니다).
     8~20세 자녀 공제와 비과세(식대 등)는 안 넣었습니다 — 묻는 칸이 없습니다. */

import { 건강보험, 고용보험, 국민연금, 장기요양_대_건강보험 } from './rates.ts';
import { 간이세액_천만원, 간이세액표 } from './tax-table.ts';

export { RATE_YEAR, 국민연금, 건강보험, 장기요양_대_건강보험, 고용보험 } from './rates.ts';

/* 보험료는 10원 미만을 버립니다 (공단 실무).
   round 를 먼저 하는 이유는 부동소수점 때문입니다 —
   300만원 × 0.9% 가 26,999.9999… 로 나와 그냥 버리면 26,990원이 됩니다 */
const won10 = (x: number) => Math.floor(Math.round(x) / 10) * 10;

/* 간이세액표에서 월 소득세를 찾습니다. 가족 수는 본인 포함 (표 머리 2호 — 본인·배우자 각 1명) */
function 표세액(월급: number, 가족: number): number {
  const 천원 = 월급 / 1000;
  const 칸 = (줄: readonly number[]) => 줄[Math.min(가족, 11) - 1];
  if (천원 < 10_000) {
    const 줄 = 간이세액표.find((r) => 천원 >= r[0] && 천원 < r[1]);
    return 줄 ? 칸(줄.slice(2)) : 0;            // 첫 줄(77만원)보다 적으면 0
  }
  /* 1천만원 넘으면 표 6호 아래 산식 — 1천만원 줄 값에 넘는 몫의 세액을 더합니다 */
  const 넘음 = 월급 - 10_000_000;
  if (넘음 <= 0) return 칸(간이세액_천만원);    // 딱 1천만원은 그 줄 그대로
  const 더함 =
    월급 <= 14_000_000 ? 넘음 * 0.98 * 0.35 + 25_000
    : 월급 <= 28_000_000 ? 1_397_000 + (월급 - 14_000_000) * 0.98 * 0.38
    : 월급 <= 30_000_000 ? 6_610_600 + (월급 - 28_000_000) * 0.98 * 0.40
    : 월급 <= 45_000_000 ? 7_394_600 + (월급 - 30_000_000) * 0.40
    : 월급 <= 87_000_000 ? 13_394_600 + (월급 - 45_000_000) * 0.42
    : 31_034_600 + (월급 - 87_000_000) * 0.45;
  return 칸(간이세액_천만원) + 더함;
}

/* 가족이 11명을 넘으면 표 머리 4호 — 11명 세액에서 (10명 − 11명 차이) × 넘는 수를 뺍니다 */
export function 간이세액(월급: number, 가족 = 1): number {
  const n = Math.max(1, Math.floor(가족));
  if (n <= 11) return won10(표세액(월급, n));
  const 열하나 = 표세액(월급, 11);
  return won10(Math.max(0, 열하나 - (표세액(월급, 10) - 열하나) * (n - 11)));
}

export type Breakdown = {
  gross: number;        // 월 세전
  net: number;          // 월 세후
  국민연금: number; 건강보험: number; 장기요양: number; 고용보험: number;
  소득세: number; 지방소득세: number;
  공제합계: number;
};

/* 월 세전 → 월 세후. 금액은 전부 「원」 단위입니다.
   dependents = 부양가족 수 (본인 포함, 최소 1) */
export function netFromGross(grossMonthly: number, dependents = 1): Breakdown {
  const g = Math.max(0, Math.round(grossMonthly));
  const 연금 = won10(g * 국민연금);
  const 건강 = won10(g * 건강보험);
  const 요양 = won10(건강 * 장기요양_대_건강보험);
  const 고용 = won10(g * 고용보험);

  /* 소득세는 간이세액표 그대로 — 비과세는 안 뺍니다(회사마다 달라 넣으면 오히려 틀립니다) */
  const 소득세 = 간이세액(g, dependents);
  const 지방 = won10(소득세 * 0.1);
  const 공제합계 = 연금 + 건강 + 요양 + 고용 + 소득세 + 지방;

  return {
    gross: g, net: g - 공제합계,
    국민연금: 연금, 건강보험: 건강, 장기요양: 요양, 고용보험: 고용,
    소득세, 지방소득세: 지방, 공제합계,
  };
}

/* 월 세후 → 월 세전. 공제가 세전에 물려 있어 바로 못 뒤집습니다.
   세전을 조금씩 올려가며 맞는 자리를 찾습니다 (이분법, 40번이면 1원까지 붙습니다) */
export function grossFromNet(netMonthly: number, dependents = 1): number {
  const target = Math.max(0, Math.round(netMonthly));
  if (target === 0) return 0;
  let lo = target, hi = target * 2 + 1_000_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (netFromGross(mid, dependents).net < target) lo = mid; else hi = mid;
  }
  return Math.round(hi);
}

/* 만원 단위로 주고받는 화면용 — 십원 단위까지 흔들리는 숫자를 안 보여줍니다 */
export const 만원 = (원: number) => Math.round(원 / 10_000);
