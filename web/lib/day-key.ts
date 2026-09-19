/* 「방문 수」를 세려고 브라우저에 두는 하루짜리 번호입니다.

   자정(한국 시각)이 지나면 새 번호를 만듭니다.
   그래서 어제의 그 브라우저와 오늘의 이 브라우저를 이을 수 없습니다.
   IP 도 안 쓰고, 회원번호와도 안 엮습니다.

   이걸로 세는 값의 정확한 이름은 「하루에 서로 다른 브라우저 몇 개가 왔나」입니다.
   화면에는 「방문 수」라고 쓰고, 아래에 단서를 답니다 —
   한 분이 폰과 PC 로 보면 2 로 셉니다. */

const KEY = 'potjob.day-key';

function seoulToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function dayKey(): string {
  const today = seoulToday();

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { day?: string; id?: string };
      if (saved.day === today && saved.id) return saved.id;
    }
  } catch {
    /* 시크릿 창·저장 차단. 아래에서 새로 만들고, 저장만 못 합니다 */
  }

  const id = crypto.randomUUID();
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: today, id }));
  } catch {
    /* 저장이 막히면 이 방문은 매번 새 번호가 됩니다.
       그만큼 방문 수가 조금 많게 나옵니다 — 적게 나오는 것보다 낫습니다 */
  }
  return id;
}
