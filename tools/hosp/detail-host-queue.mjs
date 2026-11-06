/* 상세 요청 host 큐 — 같은 host 는 동시에 1개, 다른 host 는 상한(`동시`) 안에서 병렬.
 *
 * 범위(이 파일이 하는 것)
 *   · 처음 요청하는 상세 주소의 URL.host(포트 포함)가 같으면 한 번에 하나만 돕니다.
 *   · host 를 사이트 이름에서 만들지 않습니다. 주소를 못 읽으면 열쇠 null → 잠그지 않고
 *     기존 오류 처리 길로 그대로 갑니다.
 *   · 같은 host 대기 작업이 상한 자리를 차지하지 않습니다 (기다리는 건 건너뛰고 다음 host 를 시작).
 *
 * 한계(이 파일이 못 하는 것)
 *   · 간격(요청 사이 쉬는 시간)은 없습니다. 동시 1 만입니다.
 *   · 리다이렉트로 옮겨 간 최종 host 의 중복은 보장하지 못합니다 (처음 주소 기준).
 *   · 효과(속도·실패 감소·바퀴 시간)는 실측 전이라 주장하지 않습니다.
 */

/* 처음 요청 주소 → URL.host (포트 포함). 못 읽으면 null */
export function 호스트열쇠(주소) {
  try { return new URL(String(주소 || '')).host || null; } catch { return null; }
}

/* 상세 한 건의 열쇠. 목록이 준 본문(x.글)을 쓰면 요청이 없으니 null.
   주소만들기 = collect-hosp 의 상세주소(). 던져도 null (기존 길로) */
export function 상세요청열쇠(x, 주소만들기) {
  try {
    if (x && x.글) return null;
    return 호스트열쇠(주소만들기(x.url));
  } catch { return null; }
}

/* 항목을 입력 순서대로 시작하되 상한·host 잠금을 지킨다.
   작업이 던져도 잠금은 풀리고 나머지는 계속 돈다. 처음 오류는 모두 끝난 뒤 던진다. */
export function 호스트별실행(항목들, 상한, 열쇠함수, 작업) {
  const 대기 = Array.from(항목들);
  const 잠긴 = new Set();
  let 도는수 = 0, 처음오류, 오류있음 = false;
  const 칸 = Math.max(1, Number(상한) || 1);

  return new Promise((끝, 실패) => {
    const 열쇠얻기 = (x) => { try { return 열쇠함수(x) || null; } catch { return null; } };
    const 밀기 = () => {
      for (let i = 0; i < 대기.length && 도는수 < 칸;) {
        const x = 대기[i];
        const k = 열쇠얻기(x);
        if (k !== null && 잠긴.has(k)) { i++; continue; }
        대기.splice(i, 1);
        if (k !== null) 잠긴.add(k);
        도는수++;
        Promise.resolve().then(() => 작업(x)).catch((e) => {
          if (!오류있음) { 오류있음 = true; 처음오류 = e; }
        }).finally(() => {
          if (k !== null) 잠긴.delete(k);
          도는수--;
          밀기();
        });
      }
      if (!대기.length && 도는수 === 0) { 오류있음 ? 실패(처음오류) : 끝(); }
    };
    밀기();
  });
}
