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

/* ── 남은 한도 기록 (2026-09-30 · 세중님 지시) ─────────────
 * 쓴 양은 **신청 건마다 하나**이고 우리 열쇠 둘이 같이 씁니다 (오늘 확인).
 * 남이 같은 신청 건을 쓰면 우리 몫도 같이 줄어듭니다. 그러니 지켜봐야 합니다.
 * 한 호출마다 DB 에 쓰지 않고, **가장 적게 남았던 값**만 들고 있다가
 * 수집기가 한 바퀴 끝낼 때 서비스마다 한 줄씩 올립니다. */
const 한도본것 = new Map();          // 서비스 → { 한도, 남음 }
export function 한도들() { return [...한도본것.entries()].map(([서비스, v]) => ({ 서비스, ...v })); }

function 한도적기(서비스, 한도, 남음) {
  const a = Number(한도), b = Number(남음);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) return;
  const 앞 = 한도본것.get(서비스);
  if (!앞 || b < 앞.남음) 한도본것.set(서비스, { 한도: a, 남음: b });
}

/** 한 바퀴 끝에 부릅니다. 실패해도 수집을 멈추지 않습니다 */
export async function 한도알리기(경로) {
  const 줄 = 한도들();
  if (!줄.length) return { 올림: 0 };
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  /* ⚠ 경로와 열쇠는 **짝이 맞아야** 합니다. 전에는 경로만 CE2 라 하고
     열쇠는 HS3 것을 집어 401 「열쇠가 맞지 않습니다」 가 났습니다 (2026-09-30) */
  const 고르기 = [String(경로 || '').toUpperCase(), 'HS3', 'AL2', 'CE2', 'JF']
    .filter(Boolean)
    .map((c) => [c, process.env['COLLECT_KEY_' + c]])
    .find(([, v]) => v);
  if (!url || !anon || !고르기) return { 올림: 0, 왜: '열쇠가 없어 못 올립니다' };
  const [쓸경로, 열쇠] = 고르기;
  try {
    const r = await fetch(url + '/rest/v1/rpc/api_quota_put', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: 열쇠, p_source: 쓸경로, p_rows: 줄 }),
    });
    if (!r.ok) return { 올림: 0, 왜: 'HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 120) };
    /* 70% 를 넘은 것은 화면에도 바로 알립니다 */
    줄.filter((x) => (x.한도 - x.남음) / x.한도 >= 0.7).forEach((x) => {
      console.error('  ★ 하루 한도의 ' + Math.round(100 * (x.한도 - x.남음) / x.한도)
        + '% 를 썼습니다 — ' + x.서비스 + ' (' + (x.한도 - x.남음) + '/' + x.한도 + ')');
    });
    return { 올림: 줄.length };
  } catch (e) { return { 올림: 0, 왜: String(e.message).slice(0, 80) }; }
}

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
    한도적기(열쇠칸, 한도, 남음);

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
