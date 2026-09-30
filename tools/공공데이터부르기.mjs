/* 공공데이터포털(data.go.kr)을 부르는 **한 곳** (2026-09-30 · 세중님 지시).
 *
 *     import { 공공부르기 } from './공공데이터부르기.mjs';
 *     const { code, 글, 한도, 남음 } = await 공공부르기(주소);
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 9월 30일에 429 를 받고 「너무 빨리 불렀나 · 키가 아직 반영 안 됐나 ·
 * 하루 한도인가」 를 가리지 못했습니다. 부르는 자리가 일곱 군데로 흩어져
 * 있어서 간격도 재시도도 제각각이었습니다.
 *
 * ── 헤더에 답이 있습니다 ─────────────────────────────────────
 * 포털은 응답 헤더에 적어 줍니다. 이걸 안 보고 있었습니다 —
 *
 *     x-ratelimit-limit       그 열쇠·그 기능의 하루 한도
 *     x-ratelimit-remaining   오늘 남은 횟수
 *
 * ── 그래서 429 를 둘로 가릅니다 ──────────────────────────────
 *   남음이 0 이면   **하루 한도**입니다. 기다려도 안 풀립니다(자정에 돌아옴).
 *                   → 다시 안 합니다. 천 번 × 30초를 헛되이 기다리지 않습니다
 *   남음이 있으면   **너무 빨리 부른 것**입니다.
 *                   → 2초 · 4초 · 8초 · 16초로 늘려 가며 네 번까지 다시
 *
 * Retry-After 헤더가 오면 그 값을 먼저 따릅니다.
 *
 * ── 간격 ─────────────────────────────────────────────────────
 * 같은 도메인으로 잇달아 쏘지 않게 **최소 간격**을 지킵니다 (기본 350밀리초).
 * 부르는 쪽이 각자 sleep 을 넣던 것을 여기 한 곳으로 모았습니다.
 */

/* 도메인마다 마지막으로 쏜 때 */
const 마지막 = new Map();
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/** 이번 실행에서 하루 한도에 부딪힌 주소들 — 수집기가 마지막에 알립니다 */
const 한도끝난곳 = new Set();
export function 한도끝났나() { return [...한도끝난곳]; }

const 기본간격 = 350;
const 기다림들 = [2000, 4000, 8000, 16000];

/**
 * @param {string} url  serviceKey 까지 붙은 온전한 주소
 * @param {object} 옵션 { 간격, 최대다시, headers, 떠들기 }
 * @returns {Promise<{code:number, 글:string, 한도:string, 남음:string, 다시:number, 한도끝:boolean, 왜:string}>}
 */
export async function 공공부르기(url, 옵션 = {}) {
  const 간격 = 옵션.간격 ?? 기본간격;
  const 최대다시 = 옵션.최대다시 ?? 기다림들.length;
  const headers = 옵션.headers || { accept: 'application/json' };

  let host = '';
  try { host = new URL(url).host; } catch { host = 'unknown'; }
  /* 기능(경로)까지 구분합니다 — /list 와 /detail 은 한도가 따로입니다 */
  let 길 = '';
  try { 길 = new URL(url).pathname; } catch { 길 = ''; }
  const 열쇠칸 = host + 길;

  let 다시 = 0;
  for (;;) {
    /* ① 최소 간격 지키기 */
    const 앞 = 마지막.get(host) || 0;
    const 남은쉼 = 간격 - (Date.now() - 앞);
    if (남은쉼 > 0) await 쉼(남은쉼);
    마지막.set(host, Date.now());

    let r, 글 = '';
    try {
      r = await fetch(url, { headers });
      글 = await r.text();
    } catch (e) {
      /* 그물이 끊긴 것 — 이건 다시 해 볼 값이 있습니다 */
      if (다시 < 최대다시) { await 쉼(기다림들[Math.min(다시, 기다림들.length - 1)]); 다시++; continue; }
      return { code: 0, 글: '', 한도: '—', 남음: '—', 다시, 한도끝: false,
        왜: '못 받음 · ' + String(e.message).slice(0, 80) };
    }

    const 한도 = r.headers.get('x-ratelimit-limit') || '—';
    const 남음 = r.headers.get('x-ratelimit-remaining') || '—';

    if (r.status !== 429 && r.status < 500) {
      return { code: r.status, 글, 한도, 남음, 다시, 한도끝: false, 왜: '' };
    }

    /* ② 429 를 둘로 가릅니다 */
    if (r.status === 429) {
      if (남음 === '0') {
        /* 하루 한도 — 기다려도 안 풀립니다. 다시 하지 않습니다 */
        if (!한도끝난곳.has(열쇠칸)) {
          한도끝난곳.add(열쇠칸);
          console.error('  ★ 하루 한도를 다 썼습니다 — ' + 열쇠칸
            + ' (한도 ' + 한도 + ' · 남음 0). 자정에 돌아옵니다');
        }
        return { code: 429, 글, 한도, 남음, 다시, 한도끝: true,
          왜: '하루 한도 (한도 ' + 한도 + ' · 남음 0)' };
      }
      /* 남음이 있는데 429 → 너무 빨리 부른 것 */
    }

    if (다시 >= 최대다시) {
      return { code: r.status, 글, 한도, 남음, 다시, 한도끝: false,
        왜: 'HTTP ' + r.status + ' 가 ' + (다시 + 1) + '번 이어졌습니다' };
    }

    const 시킨쉼 = Number(r.headers.get('retry-after') || 0) * 1000;
    const 기다릴것 = 시킨쉼 || 기다림들[Math.min(다시, 기다림들.length - 1)];
    if (옵션.떠들기 !== false) {
      console.error('  … HTTP ' + r.status + ' (남음 ' + 남음 + ') — '
        + (기다릴것 / 1000) + '초 쉬고 다시 (' + (다시 + 1) + '/' + 최대다시 + ')');
    }
    await 쉼(기다릴것);
    다시++;
  }
}

/** 응답이 포털 오류인지 — <returnAuthMsg> 를 꺼냅니다 */
export function 포털오류(글) {
  const m = String(글).match(/"returnAuthMsg"\s*:\s*"([^"]*)"|<returnAuthMsg>([^<]*)</);
  return m ? (m[1] || m[2]) : '';
}
