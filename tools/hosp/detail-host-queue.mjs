/* 상세 요청 host 큐 — 같은 host 는 동시에 1개 + 간격, 다른 host 는 상한(`동시`) 안에서 병렬.
 *
 * 멘토 11/9 지시문 3 (멘토-2차-02-2) 의 요청 규칙
 *   · 같은 서버는 한 번에 하나씩
 *   · robots.txt 에 Crawl-delay 가 있으면 그 값, 없으면 3~5초에 0~1초를 무작위로 더한다 (쉴틈)
 *   · 서버가 다르면 동시에 5개까지 (다른호스트상한 — 부르는 쪽이 상한에 씁니다)
 *   · 429 면 Retry-After 만큼, 없으면 1분 → 5분 → 30분. 그래도 안 되면 그 바퀴는 건너뜀
 *     (속도제한기다림 — null 이면 건너뜀)
 *
 * 범위(이 파일이 하는 것)
 *   · 처음 요청하는 상세 주소의 URL.host(포트 포함)가 같으면 한 번에 하나만 돕니다.
 *   · host 를 사이트 이름에서 만들지 않습니다. 주소를 못 읽으면 열쇠 null → 잠그지 않고
 *     기존 오류 처리 길로 그대로 갑니다.
 *   · 같은 host 대기 작업이 상한 자리를 차지하지 않습니다 (기다리는 건 건너뛰고 다음 host 를 시작).
 *   · 같은 host 의 다음 요청은 `틀.간격(host)` ms 뒤에 시작합니다. **기다리는 동안 자리를
 *     쥐지 않습니다** — 다른 host 가 그 자리를 씁니다.
 *   · 작업이 `{ 다시: ms }` 를 돌려주면(429·robots 를 막 읽음) 그 건을 맨 앞에 다시 넣고
 *     그 host 를 ms 뒤까지 쉬게 합니다. 이때도 자리를 쥐지 않습니다.
 *   · 작업이 `{ 요청안함: true }` 를 돌려주면(건너뛴 건) 간격을 걸지 않습니다.
 *
 * 한계(이 파일이 못 하는 것)
 *   · 리다이렉트로 옮겨 간 최종 host 의 중복은 보장하지 못합니다 (처음 주소 기준).
 *   · 목록 단계(①)는 이 큐를 안 탑니다 — PR 「다음」.
 *   · 효과(속도·실패 감소·바퀴 시간)는 실측 전이라 주장하지 않습니다.
 */
import { 붙여받기 } from '../certs/index.mjs';
import { robots읽기 } from '../robots.mjs';

/* 서버가 다르면 동시에 5개까지 (멘토 11/9 지시문 3) */
export const 다른호스트상한 = 5;
/* Retry-After 가 없을 때 기다림 — 1분 → 5분 → 30분. 넷째 429 면 그 바퀴는 그 host 를 건너뜁니다 */
export const 물러남 = [60_000, 300_000, 1_800_000];

/** 같은 host 다음 요청까지 쉴 ms — Crawl-delay(초)가 있으면 그 값, 없으면 3~5초 + 0~1초 */
export function 쉴틈(crawlDelay초, 무작위 = Math.random) {
  if (crawlDelay초 != null && Number.isFinite(Number(crawlDelay초)) && Number(crawlDelay초) >= 0) {
    return Math.round(Number(crawlDelay초) * 1000);
  }
  return Math.round(3000 + 무작위() * 2000 + 무작위() * 1000);
}

/** Retry-After 머리 → ms (초 수 또는 HTTP 날짜). 못 읽으면 null */
export function 다시때ms(값, 지금 = Date.now()) {
  const s = String(값 ?? '').trim();
  if (!s) return null;
  if (/^\d{1,7}$/.test(s)) return Number(s) * 1000;
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.max(0, t - 지금) : null;
}

/** 429 를 n번째(1부터 · 같은 host 에서 이어서) 받았을 때 기다릴 ms.
 *  null 이면 **그 바퀴는 그 host 를 건너뜁니다** — 셋을 기다려도 안 됐거나,
 *  Retry-After 가 30분(물러남 끝)보다 길 때 */
export function 속도제한기다림(n, retryAfter, 지금 = Date.now()) {
  if (!Number.isInteger(n) || n < 1 || n > 물러남.length) return null;
  const ra = 다시때ms(retryAfter, 지금);
  if (ra != null) return ra > 물러남[물러남.length - 1] ? null : ra;
  return 물러남[n - 1];
}

/** 그 주소 host 의 robots.txt Crawl-delay(초). 없거나 못 받으면 null · 던지지 않습니다.
 *  받기 = 붙여받기 꼴(시험에서 바꿔 끼움) */
export async function robots지연읽기(주소, UA, 받기 = 붙여받기) {
  try {
    const u = new URL(String(주소 || ''));
    const g = await 받기(u.origin + '/robots.txt', { headers: { 'User-Agent': UA }, timeout: 12000 });
    if (!g || g.왜 || g.code !== 200 || !g.buf) return null;
    const 지연 = robots읽기(g.buf.toString('utf8')).지연;
    return Number.isFinite(지연) ? 지연 : null;
  } catch { return null; }
}

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

/* 항목을 입력 순서대로 시작하되 상한·host 잠금·host 간격을 지킨다.
   작업이 던져도 잠금은 풀리고 나머지는 계속 돈다. 처음 오류는 모두 끝난 뒤 던진다.
   틀.간격(host) → 그 host 의 다음 요청까지 쉴 ms (없으면 0 — 전과 같음) */
export function 호스트별실행(항목들, 상한, 열쇠함수, 작업, 틀 = {}) {
  const 대기 = Array.from(항목들);
  const 잠긴 = new Set();
  const 다음때 = new Map();            // host → 이 시각(ms) 전에는 시작하지 않음
  const 간격 = typeof 틀.간격 === 'function' ? 틀.간격 : () => 0;
  let 도는수 = 0, 처음오류, 오류있음 = false, 타이머 = null, 끝남 = false;
  const 칸 = Math.max(1, Number(상한) || 1);

  return new Promise((끝, 실패) => {
    const 열쇠얻기 = (x) => { try { return 열쇠함수(x) || null; } catch { return null; } };
    const 쉬게 = (k, ms) => {
      const n = Number(ms);
      if (k !== null && Number.isFinite(n) && n > 0) 다음때.set(k, Date.now() + n);
    };
    const 간격걸기 = (k) => { if (k === null) return; let ms = 0; try { ms = 간격(k); } catch { ms = 0; } 쉬게(k, ms); };
    const 밀기 = () => {
      if (끝남) return;
      if (타이머) { clearTimeout(타이머); 타이머 = null; }
      const 지금 = Date.now();
      let 가장이른 = Infinity;
      for (let i = 0; i < 대기.length && 도는수 < 칸;) {
        const x = 대기[i];
        const k = 열쇠얻기(x);
        if (k !== null && 잠긴.has(k)) { i++; continue; }
        const 때 = k !== null ? (다음때.get(k) || 0) : 0;
        if (때 > 지금) { 가장이른 = Math.min(가장이른, 때); i++; continue; }
        대기.splice(i, 1);
        if (k !== null) 잠긴.add(k);
        도는수++;
        Promise.resolve().then(() => 작업(x)).then((답) => {
          /* 429·robots 를 막 읽음 — 그 건을 맨 앞에 다시 넣고 host 를 쉬게 합니다 (자리는 놓습니다) */
          if (k !== null && 답 && Number.isFinite(Number(답.다시)) && Number(답.다시) >= 0) {
            대기.unshift(x);
            쉬게(k, Number(답.다시));
            return;
          }
          if (!(답 && 답.요청안함)) 간격걸기(k);
        }, (e) => {
          if (!오류있음) { 오류있음 = true; 처음오류 = e; }
          간격걸기(k);   // 던진 작업도 요청은 나갔을 수 있으니 간격은 지킵니다
        }).finally(() => {
          if (k !== null) 잠긴.delete(k);
          도는수--;
          밀기();
        });
      }
      if (!대기.length && 도는수 === 0) { 끝남 = true; 오류있음 ? 실패(처음오류) : 끝(); return; }
      /* 자리가 남았는데 쉬는 host 뿐이면, 가장 먼저 풀리는 때에 다시 밉니다 */
      if (도는수 < 칸 && 가장이른 < Infinity) 타이머 = setTimeout(밀기, Math.max(1, 가장이른 - Date.now()));
    };
    밀기();
  });
}
