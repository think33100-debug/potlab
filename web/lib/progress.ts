/* 설문 진행 멘트. 「2 / 9」 숫자만 있으면 밋밋해서 한 줄 붙입니다.
   (node lib/progress.test.mjs)

   남은 시간은 「남은 화면 수 × 한 화면」으로 어림합니다.
   한 화면 20초는 잰 값이 아니라 어림입니다 — 칸이 2~4개이고 대부분
   고르는 것이라 그쯤으로 뒀습니다. 그래서 화면에도 「쯤」을 붙여 씁니다.
   실제로 얼마나 걸리는지 재보면 이 상수만 고치면 됩니다. */
export const SECONDS_PER_STEP = 20;

export type Progress = { msg: string; left: string | null };

/* at = 지금 화면 번호(0부터), total = 전체 화면 수 */
export function progress(at: number, total: number): Progress {
  const done = Math.max(0, Math.min(at, total - 1));
  const rest = Math.max(0, total - 1 - done);          // 앞으로 남은 화면
  const ratio = total <= 1 ? 1 : done / (total - 1);

  const msg =
    rest === 0 ? '마지막이에요!'
    : done === 0 ? '이제 시작이에요'
    : ratio < 0.45 ? '잘 하고 계세요'
    : ratio < 0.55 ? '절반 왔어요!'
    : rest <= 2 ? '조금만 더 하면 돼요'
    : '거의 다 왔어요';

  return { msg, left: leftText(rest) };
}

/* 「3분쯤 남았어요」. 30초 미만은 숫자를 안 붙입니다 —
   「0분 남았어요」 보다 「곧 끝나요」 가 낫습니다.
   초 단위로 적으면 지키지도 못할 정확도를 약속하는 셈이라 분으로만 적습니다 */
function leftText(rest: number): string | null {
  if (rest === 0) return null;
  const sec = rest * SECONDS_PER_STEP;
  if (sec < 30) return '곧 끝나요';
  if (sec < 90) return '1분쯤 남았어요';
  return `${Math.round(sec / 60)}분쯤 남았어요`;
}
