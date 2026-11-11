/* 11/13 클로즈드 베타 — 「테스터 전용」 (2026-11-11 세중님 결정 · 줄 A).

   ── 무엇을 하나 ──────────────────────────────────────────────
   ① 비회원은 아무것도 못 봅니다. middleware.ts 가 로그인 안 한 사람을
      /beta 안내 화면으로 보냅니다 (아래 「비회원이 열 수 있는 길」만 예외).
   ② 가입은 공용 초대 링크(/join?c=<코드>)로만 합니다. 링크를 가진 사람은
      누구나 가입할 수 있고, 남에게 전달해도 됩니다.
   ③ 코드는 **서버(DB)가 확인합니다.** 화면 검사는 안내일 뿐입니다 —
      `테스터초대` 표의 RLS 가 코드의 해시를 `초대코드` 표와 대 보고,
      profiles 의 새 줄은 트리거가 「초대 줄이 있나」를 봅니다
      (RAPO노트/SQL_1113/A_테스터가입.sql).
   ④ 코드 값은 저장소에 없습니다. 세중님이 SQL 로 DB 에 해시를 넣습니다.

   ── 이름을 영어로 둔 것 ─────────────────────────────────────
   주소(/beta · /join)·localStorage 열쇠는 밖에서 이름으로 부르는 자리라
   영어로 둡니다 (지침 6-2b). */

/** 초대 코드를 잠시 담아 두는 자리 (localStorage). 카카오 앱으로 갔다가
    다른 탭으로 돌아와도 남도록 sessionStorage 가 아니라 localStorage 입니다 */
export const INVITE_KEY = 'rapo.invite';

/** 비회원(로그인 안 함)이 열 수 있는 길. 나머지는 전부 /beta 로 갑니다.
    ★ 여기에 화면을 더하면 그 화면이 비회원에게 열립니다 — 더하기 전에 세중님께 */
export const 비회원길 = [
  '/beta',          // 테스터 전용 안내
  '/join',          // 초대 링크 받는 자리
  '/login',         // 로그인 (이미 가입한 분 · 초대 링크로 온 분)
  '/auth/callback', // 카카오·네이버·애플에서 돌아오는 자리
  '/terms',         // 약관·개인정보처리방침은 누구나 볼 수 있어야 합니다 (법)
  '/contact',       // 문의 — 들어오지 못한 분도 물을 수 있어야 합니다
] as const;

/** 로그인은 했는데 가입(닉네임)을 안 마친 사람이 열 수 있는 길 */
export const 가입중길 = [...비회원길, '/welcome'] as const;

export function 길에있나(pathname: string, 목록: readonly string[]): boolean {
  return 목록.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** 초대 코드 모양만 봅니다 (맞는지는 DB 가 정합니다).
    링크를 통째로 붙여 넣어도 c= 뒤를 꺼냅니다 */
export function 코드꺼내기(글: string | null | undefined): string | null {
  const s = String(글 ?? '').trim();
  if (!s) return null;
  let 코드 = s;
  const m = s.match(/[?&]c=([^&#\s]+)/);
  if (m) {
    try { 코드 = decodeURIComponent(m[1]); } catch { 코드 = m[1]; }
  }
  코드 = 코드.trim();
  /* 너무 짧거나 긴 것, 빈칸이 든 것은 코드가 아닙니다 */
  if (코드.length < 4 || 코드.length > 128 || /\s/.test(코드)) return null;
  return 코드;
}

export function 초대코드읽기(): string | null {
  try { return 코드꺼내기(localStorage.getItem(INVITE_KEY)); } catch { return null; }
}

export function 초대코드담기(코드: string) {
  try { localStorage.setItem(INVITE_KEY, 코드); } catch { /* 사생활 보호 창 — 가입 화면에서 다시 넣습니다 */ }
}

export function 초대코드지우기() {
  try { localStorage.removeItem(INVITE_KEY); } catch { /* 그냥 둡니다 */ }
}

/* ── 가입 화면의 동의 (세중님 문구 그대로 · 2026-11-11) ──────────────
   [필수]만 가입을 막습니다. [선택]은 체크 안 된 채로 시작합니다.
   이 둘은 `테스터초대` 줄의 칸(개인정보동의 · 경품동의)으로 DB 에 남습니다.
   ★ [선택] 연봉·스펙 비교 알림 신청은 **13일 뒤 켭니다** (세중님 「멘토 기준으로」 ·
     오픈 전에는 측정과 보안만) — lib/beta-compare.ts 에 따로 있습니다. */
export type 베타동의키 = 'beta_privacy' | 'survey_prize';

export type 베타동의 = {
  key: string; required: boolean; label: string; lines: string[];
};

export const BETA_AGREEMENTS: 베타동의[] = [
  {
    key: 'beta_privacy',
    required: true,
    label: '개인정보 수집·이용 동의',
    lines: [
      '수집 항목: 이메일, 닉네임, 대략적인 연봉 구간',
      '이용 목적: 회원 확인, RAPO 테스트 서비스 제공, 오류·점검 안내, 설문 요청',
      '보유 기간: 수집일로부터 1년(탈퇴하면 바로 파기)',
      '동의를 거부할 수 있으나, 거부하면 테스트 참여가 어렵습니다.',
    ],
  },
  {
    key: 'survey_prize',
    required: false,
    label: '설문 경품 지급',
    lines: [
      '수집 항목: 이름, 휴대전화번호(설문 때 따로 받음 · 가입 화면에서는 받지 않음)',
      '목적: 커피 쿠폰 발송',
      '보유: 1년.',
    ],
  },
];

/** 베타 표가 아직 DB 에 없을 때의 오류인가 (SQL 을 올리기 전).
    그때는 막지 않고 옛 길로 갑니다 — 막는 자리는 DB 이고, 표가 없으면 트리거도 없습니다 */
export function 표없음(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205'
    || /relation .* does not exist|Could not find the table/i.test(e.message ?? '');
}
