/* 교육이 **지난 것인가** — 한 자리 (2026-10-28 세중님 1번)
 *
 * 왜 필요한가 — 교육 113건 가운데 **끝 날짜가 있는 것이 3건**뿐입니다. 학회 쪽 자료에
 * 날짜가 없어서, `교육목록()` 의 `끝 is null` 울타리에 걸려 **105건이 영영 목록에
 * 남습니다.** 회원에게는 「지난 교육이 보임」이고, 공고의 신뢰 셋 ①과 같은 결입니다.
 *
 * 세중님이 정한 규칙 (2026-10-28) —
 *   ① 끝 날짜가 있으면   **끝 < 오늘** 이면 지난 것
 *   ② 끝이 없고 시작이 있으면  **시작 < 오늘** 이면 지난 것
 *   ③ 둘 다 없으면       **담은 날 + 30일 < 오늘** 이면 지난 것
 *   ④ 셋 다 없으면       **지난 것으로 보지 않습니다** (모르면 안 내립니다)
 *
 * ★ 날짜를 **지어내지 않습니다** — 내리는 판단만 합니다 (지침 10-3).
 * ★ 이 규칙은 `tools/hold-digest.mjs` 도 **같은 파일을 들여다** 씁니다 (지침 6절).
 */

/** 담은 날만 아는 교육을 며칠까지 보여 줄까 (세중님 2026-10-28 — 30일) */
export const 담은날유효일 = 30;

export type 교육날짜 = {
  끝?: string | null;
  시작?: string | null;
  올린날?: string | null;
};

/** `YYYY-MM-DD` 만 씁니다 — 시각이 붙어 와도 앞 열 글자만 봅니다 */
function 날(v: string | null | undefined): string | null {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** 날짜에 며칠을 더합니다 (UTC 로 더해도 날짜 글자만 쓰므로 어긋나지 않습니다) */
export function 날더하기(날짜: string, 며칠: number): string {
  const t = Date.parse(날짜 + 'T00:00:00Z');
  return new Date(t + 며칠 * 86400000).toISOString().slice(0, 10);
}

export function 교육지났나(e: 교육날짜, 오늘: string): boolean {
  const 오 = 날(오늘);
  if (!오) return false;
  const 끝 = 날(e.끝);
  if (끝) return 끝 < 오;
  const 시작 = 날(e.시작);
  if (시작) return 시작 < 오;
  const 올 = 날(e.올린날);
  if (올) return 날더하기(올, 담은날유효일) < 오;
  return false;                       /* 셋 다 모르면 안 내립니다 */
}

/** 왜 지난 것인지 — 보고·메일에 적습니다 */
export function 지난까닭(e: 교육날짜, 오늘: string): string | null {
  if (!교육지났나(e, 오늘)) return null;
  if (날(e.끝)) return '끝 지남';
  if (날(e.시작)) return '시작 지남';
  return '담은 날 +' + 담은날유효일 + '일 지남';
}
