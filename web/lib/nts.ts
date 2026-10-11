/* 국세청 사업자등록 상태조회 — 열쇠 모양 두 가지를 **둘 다** 받습니다 (2026-10-11).
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 공공데이터포털은 인증키를 **두 벌**로 줍니다.
 *   Encoding  이미 퍼센트로 싼 것   예) abc%2Bdef%3D
 *   Decoding  날것                  예) abc+def=
 * 어느 쪽을 넣었는지 모르는 채 `encodeURIComponent()` 를 걸면,
 * Encoding 쪽은 `%` 가 `%25` 로 **두 번 싸여** 열쇠가 안 맞습니다.
 * 그래서 넣기 전에 **한 번 풀고 한 번만 싸맵니다.**
 *
 * **값은 어디에도 안 찍습니다** (작업지침 8-11). 모양만 봅니다.
 */

/** 퍼센트로 싸여 있으면 한 번 풀어 **날것**으로 되돌립니다. */
export function 열쇠날것(k: string): string {
  if (!/%[0-9A-Fa-f]{2}/.test(k)) return k;      /* Decoding 쪽 — 그대로 */
  try { return decodeURIComponent(k); } catch { return k; }
}

/** 열쇠를 **값 없이** 가늠합니다 — 길이 · 앞 4글자 · % 포함 여부. */
export function 열쇠모양(k: string | undefined) {
  if (!k) return { 있나: false as const };
  return {
    있나: true as const,
    길이: k.length,
    앞4: k.slice(0, 4),
    퍼센트포함: /%[0-9A-Fa-f]{2}/.test(k),
    어느쪽: /%[0-9A-Fa-f]{2}/.test(k) ? 'Encoding(퍼센트로 싼 것)' : 'Decoding(날것)',
  };
}

export type 사업자상태 = '계속사업자' | '휴업자' | '폐업자' | '없는 번호' | '수동 확인' | '모름';

export type 사업자결과 = { 번호: string; 상태: 사업자상태; 원문?: string };

const 주소 = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

/**
 * 사업자번호 여럿의 상태를 봅니다.
 * 열쇠가 없으면 **아무것도 두드리지 않고** 「수동 확인」으로 돌려줍니다 —
 * 기능이 멈추지 않습니다.
 */
export async function 사업자상태보기(번호들: string[], 열쇠: string | undefined)
  : Promise<{ 줄: 사업자결과[]; HTTP: number; 왜?: string }> {
  const 깨끗 = 번호들.map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length === 10);
  if (!깨끗.length) return { 줄: [], HTTP: 0, 왜: '열 자리 숫자가 아닙니다' };
  if (!열쇠) return { 줄: 깨끗.map((b) => ({ 번호: b, 상태: '수동 확인' as const })), HTTP: 0 };

  const r = await fetch(주소 + '?serviceKey=' + encodeURIComponent(열쇠날것(열쇠)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ b_no: 백건까지(깨끗) }),
    cache: 'no-store',
  });
  const 글 = await r.text();
  if (!r.ok) return { 줄: [], HTTP: r.status, 왜: 글.slice(0, 300) };

  let j: { data?: { b_no?: string; b_stt?: string; tax_type?: string }[] };
  try { j = JSON.parse(글); } catch { return { 줄: [], HTTP: r.status, 왜: '응답이 JSON 이 아닙니다 — ' + 글.slice(0, 200) }; }

  const 줄 = (j.data ?? []).map((x) => ({
    번호: String(x.b_no ?? ''),
    상태: 상태말(x),
  }));
  return { 줄, HTTP: r.status };
}

/* 국세청은 없는 번호일 때 b_stt 를 **빈 글자**로 주고
   tax_type 에 「국세청에 등록되지 않은 사업자등록번호입니다」 를 넣습니다 */
function 상태말(x: { b_stt?: string; tax_type?: string }): 사업자상태 {
  const s = (x.b_stt ?? '').trim();
  if (s === '계속사업자' || s === '휴업자' || s === '폐업자') return s;
  if ((x.tax_type ?? '').includes('등록되지')) return '없는 번호';
  return s ? '모름' : '없는 번호';
}

/* 국세청은 한 번에 100건까지 받습니다 */
function 백건까지(xs: string[]) { return xs.slice(0, 100); }
