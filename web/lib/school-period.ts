/* 학생·취준생의 졸업 시점과 무료 열람 끝날 (2026-11-15 · 피그마 07 B 「U05-03 학력·학점」).

   피그마 원문
     · 「선택한 학력과 입학 연월로 졸업 예정일을 계산해요. 수정이 필요하면 운영자에게 문의해 주세요.」
     · 「졸업한 다음 해 같은 달 말일까지 무료 열람 — 2026년 2월 졸업자는 2027년 2월 28일까지」
     · 화면 예시 — 4년제 · 2023년 03월 입학 → 「졸업 예정 2027년 02월 · 2028년 2월 29일까지 무료 열람」

   ★ 지금은 **보여 주기만** 합니다. 기간이 끝났다고 막는 장치는 없습니다 (막는 것은 세중님이 정할 자리 — 돈·권한).
   수업 연한은 피그마에 숫자가 없어 정했습니다 — 전문대학 3 · 4년제 4 · 석사 2 · 박사 3 (대학원 학칙의 수업연한). */

export const 학력목록 = ['전문대학', '4년제 대학', '석사', '박사', '학교 경험 없음'] as const;
export type 학력 = (typeof 학력목록)[number];

export const 수업연한: Record<Exclude<학력, '학교 경험 없음'>, number> = {
  '전문대학': 3, '4년제 대학': 4, '석사': 2, '박사': 3,
};

export type 연월 = { y: number; m: number };   // m 은 1~12

/** 'YYYY-MM' 또는 'YYYY-MM-DD' → 연월. 틀리면 null */
export function 연월읽기(s: string | null | undefined): 연월 | null {
  const m = /^(\d{4})-(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]);
  return mo >= 1 && mo <= 12 ? { y, m: mo } : null;
}

const 더하기 = (a: 연월, 달: number): 연월 => {
  const n = a.y * 12 + (a.m - 1) + 달;
  return { y: Math.floor(n / 12), m: (n % 12) + 1 };
};

/** 졸업(예정) 연월 — 입학 연월 + 연한 − 1달 (2023-03 · 4년 → 2027-02) */
export function 졸업연월(학력: string, 입학: 연월 | null): 연월 | null {
  const 연한 = 수업연한[학력 as keyof typeof 수업연한];
  if (!연한 || !입학) return null;
  return 더하기(입학, 연한 * 12 - 1);
}

/** 무료 열람 뒤 안내 — 2026-11-15 세중님. 막는 장치는 아직 없습니다(보여 주기만) */
export const 취업인증안내 = '무료 열람이 끝나고 나면 1년 이내에 취업 인증을 해 주셔야 이어서 무료로 이용할 수 있어요.';
/** 가입 끝 화면의 둘째 줄 — 2026-11-17 세중님 「후기 인증해 주면 평생 무료로 이용 가능해요」. 이것도 보여 주기만 합니다 */
export const 후기인증안내 = '후기 인증해 주면 평생 무료로 이용 가능해요.';

/** 무료 열람 끝날 — 졸업 다음 해 같은 달 말일 ('YYYY-MM-DD') */
export function 무료끝날(졸업: 연월 | null): string | null {
  if (!졸업) return null;
  const y = 졸업.y + 1, m = 졸업.m;
  const 말일 = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(말일).padStart(2, '0')}`;
}

export const 연월말 = (a: 연월) => `${a.y}년 ${String(a.m).padStart(2, '0')}월`;
export const 날말 = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };

/** 입학 연월이 오늘(KST) 달보다 뒤면 틀림 — 피그마 「입학 연월은 현재 또는 이전으로 선택해 주세요.」 */
export function 미래인가(a: 연월, 오늘 = new Date(Date.now() + 9 * 3600_000)): boolean {
  return a.y * 12 + a.m > 오늘.getUTCFullYear() * 12 + (오늘.getUTCMonth() + 1);
}
