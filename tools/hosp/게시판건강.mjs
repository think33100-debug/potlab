/* 병원 게시판 아침 가르기 — 고장 · 의심 · 정상 (2026-11-18)
 *   멘토-1.15-1 · 멘토-1.15-3 · 멘토-추가-지시문4 · 멘토-요약-1
 *
 * ── 무엇을 하나 ──────────────────────────────────────────────
 * 수집기(collect-hosp.mjs ①)가 게시판마다 받은 결과를 **관측 한 줄**로 줄이고(관측하기),
 * 바퀴가 끝나면 기록에 쌓습니다(바퀴정리). 아침 메일(hold-digest.mjs)은 그 기록을 읽어
 *   「고장 n · 의심 n · 정상 n」 한 줄과 고장 목록(기관 · 유형 · 시작 시각)을 냅니다(아침가르기 · 아침줄).
 *
 *   고장   마지막으로 받아 본 결과가 **실패**이거나 **글이 0개** (우리 직군만이 아니라 게시판의 모든 글)
 *   의심   글은 있는데 가장 최근 글이 **60일 넘게** 묵음 · 글 수가 평소의 1/3 이하 · 이틀 넘게 못 봄
 *   정상   그 밖
 *
 * ── 실패 유형 (멘토 지시문4 · PR #17 기록의 HTTP 코드 + PR #13 화면 서명) ──
 *   차단          401 · 403 · 로봇 확인/접근 거부 화면(BLOCK_SCREEN · LOGIN_SCREEN) ·
 *                 같은 플랫폼 3곳 넘게 한 바퀴에 함께 실패(다 일시 장애인 때는 뺍니다)
 *   속도 제한     429 (Retry-After 만큼 쉼 · 없으면 1분 → 5분 → 30분)
 *   일시 장애     5xx · 시간 초과 · DNS · 연결 끊김
 *   우리 쪽 고장  200 인데 글 0개 · JSON 아님 · 규칙 깨짐 · 404 · 그 밖 4xx · 인증서
 *   ※ 「다른 주소로 이동」은 못 가립니다 — fetch 가 따라가 버려 마지막 주소를 안 남깁니다.
 *   ※ 「글 수가 평소보다 크게 적음」은 고장이 아니라 **의심**으로 둡니다 (멘토-1.15-1 의 고장 = 글 0개).
 *
 * ── 한 번은 관찰 · 두 번이면 확정 · 도메인으로 셉니다 ─────────
 * 도메인 = 주소의 등록 도메인(xx.recruiter.co.kr → recruiter.co.kr). 한 바퀴에 그 도메인에서 받아 본 곳이
 * **다 실패**하면 그 도메인이 실패한 것이고, 같은 유형이 **연달아 두 바퀴**면 확정입니다.
 * 한 곳이라도 받으면 도메인 기록을 지웁니다(살아 있음). 곳 하나만 탈난 것은 곳 기록에만 남습니다.
 * **차단 확정 도메인은 다시 요청하지 않습니다** — collect-hosp 가 robots 「봇 금지 · 손확인」과 같은 자리에서
 * 건너뜁니다(건너뛸까). 풀 때는 사람이 `node tools/collect-hosp.mjs --차단풀기 <도메인>`.
 *
 * ── 순수 함수만 ───────────────────────────────────────────────
 * 네트워크·파일·시계를 쓰지 않습니다(지금ms 를 받습니다). 기록 파일은 부르는 쪽이 읽고 씁니다 —
 * `POTJOB_BOARD_STATE || ~/게시판건강기록.json` (저장소 밖 · ~/천천히기록.json 과 같은 결).
 * 응답 글은 받지도 내지도 않습니다 — 고정 코드 · 숫자 · 기관 이름 · 도메인만 다룹니다
 * (failure-report.mjs 머리의 「비공개앞글」을 여기로 옮기지 않습니다).
 */

export const 기록파일이름 = '게시판건강기록.json';
export const 기록환경이름 = 'POTJOB_BOARD_STATE';
export const 유형 = Object.freeze({ 차단: '차단', 속도: '속도 제한', 일시: '일시 장애', 우리: '우리 쪽 고장' });
export const 오래된날수 = 60;       // 멘토-1.15-3 「최근 글 60일 넘음」
export const 못본시간 = 48;          // 마지막으로 받아 본 지 이만큼 지나면 의심
export const 플랫폼곳수 = 3;          // 같은 플랫폼에서 한 바퀴에 이만큼 넘게 함께 실패하면 차단
const 남길수 = 10;                   // 곳마다 남기는 최근 관측 수
const 버릴날수 = 14;                 // 이보다 오래 안 본 곳·도메인은 기록에서 뺍니다 (차단 확정은 남김)
const 한국 = 9 * 3600e3;
const 하루 = 86400e3;
const 쉼단계초 = [60, 300, 1800];    // 속도 제한 · Retry-After 가 없을 때 (멘토: 1분 → 5분 → 30분)

/* ── 도메인 ── */
const 두단계 = new Set(['co', 'or', 'ac', 'go', 're', 'ne', 'pe', 'hs', 'ms', 'es', 'sc', 'kg', 'mil']);
/** 사이트 설정(s.url · s.host) → 등록 도메인. 모르면 null */
export function 도메인(s) {
  try {
    const h = new URL(String((s && (s.url || s.host)) || '')).hostname.toLowerCase().replace(/\.$/, '');
    if (!h) return null;
    if (/^[\d.]+$/.test(h) || h.includes(':') || h.includes('[')) return h;
    const 칸 = h.split('.');
    const n = 칸.length >= 3 && 칸[칸.length - 1] === 'kr' && 두단계.has(칸[칸.length - 2]) ? 3 : 2;
    return 칸.slice(-n).join('.');
  } catch { return null; }
}

/* ── 실패 유형 ── */
const 차단서명 = new Set(['BLOCK_SCREEN', 'LOGIN_SCREEN']);
/** { http, 왜, 서명 } → 유형 하나. 입력 글을 돌려주지 않습니다 */
export function 실패유형({ http = null, 왜 = null, 서명 = null } = {}) {
  if (차단서명.has(서명) || http === 401 || http === 403) return 유형.차단;
  if (http === 429) return 유형.속도;
  if (Number.isInteger(http) && http >= 500 && http <= 599) return 유형.일시;
  if (Number.isInteger(http) && http >= 100) return 유형.우리;         // 200(0줄·JSON 아님·규칙 깨짐)·3xx·404·그밖 4xx
  if (/CERT|SSL|TLS|EPROTO|DH_KEY|SELF_SIGNED|UNABLE_TO|주소가 아닙니다|모르는 type/i.test(String(왜 || ''))) return 유형.우리;
  return 유형.일시;                                                      // 시간 초과·DNS·연결 끊김·모르는 네트워크 탈
}

/** Retry-After → 초 (숫자 또는 HTTP 날짜). 모르면 null */
export function 쉴초(retryAfter, 지금ms) {
  const v = String(retryAfter ?? '').trim();
  if (/^\d{1,7}$/.test(v)) return Number(v);
  const t = Date.parse(v);
  if (Number.isFinite(t) && Number.isFinite(지금ms)) return Math.max(0, Math.round((t - 지금ms) / 1000));
  return null;
}

const 정수 = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const 날꼴 = (v) => (/^20\d{2}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

/**
 * 사이트줄() 결과 하나 → 관측 한 줄. 던지지 않습니다.
 * @param s 사이트 설정 (name · url/host)
 * @param g 사이트줄() 이 돌려준 것 — { err, 실패:{http,왜,서명,retryAfter} } 또는 { rows, 전체, 전체최근, 서명 }
 * @param 우리직군 그 곳에서 우리 직군으로 가린 글 수 (부르는 쪽이 셉니다 · 멘토-요약-1)
 */
export function 관측하기(s, g, 우리직군, 지금ms) {
  const 이름 = String((s && s.name) || '이름없음');
  const 기본 = { 이름, 도메인: 도메인(s), 때: 지금ms, 상태: '받음', 유형: null, http: null, 전체: null, 우리: 정수(우리직군), 최근: null, 쉴초: null };
  try {
    const x = g && typeof g === 'object' ? g : { err: '빈 결과' };
    if (x.err) {
      const f = x['실패'] && typeof x['실패'] === 'object' ? x['실패'] : {};
      const http = Number.isInteger(f.http) ? f.http : null;
      const t = 실패유형({ http, 왜: f['왜'] ?? x.err, 서명: f['서명'] ?? null });
      return { ...기본, 상태: '실패', 유형: t, http, 쉴초: t === 유형.속도 ? 쉴초(f.retryAfter, 지금ms) : null };
    }
    const 전체 = 정수(x['전체']) ?? (Array.isArray(x.rows) ? x.rows.length : null);
    if (전체 === 0) {
      /* 200 인데 글 0개 — 화면 서명이 차단이면 차단, 아니면 우리 쪽 고장 */
      return { ...기본, 상태: '실패', 유형: 실패유형({ http: 200, 서명: x['서명'] ?? null }), http: 200, 전체: 0 };
    }
    return { ...기본, 전체, 최근: 날꼴(x['전체최근']) };
  } catch {
    return { ...기본, 상태: '실패', 유형: 유형.일시 };
  }
}

/* ── 기록 ── */
export function 빈기록() { return { 판: 1, 곳: {}, 도메인: {} }; }
function 기록꼴(기록) {
  const 기 = 기록 && typeof 기록 === 'object' && !Array.isArray(기록) ? 기록 : {};
  if (!기['곳'] || typeof 기['곳'] !== 'object') 기['곳'] = {};
  if (!기['도메인'] || typeof 기['도메인'] !== 'object') 기['도메인'] = {};
  기['판'] = 1;
  return 기;
}

/* 실패 유형이 섞이면 센 쪽을 씁니다 */
const 세기순 = [유형.차단, 유형.속도, 유형.우리, 유형.일시];
const 가장센 = (들) => 세기순.find((t) => 들.some((x) => x.유형 === t)) || 유형.일시;

/**
 * 한 바퀴의 관측들을 기록에 쌓습니다 (같은 객체를 고쳐 돌려줍니다).
 * @returns {{ 기록, 탈난곳: number, 탈난도메인: number, 확정: string[] }}
 */
export function 바퀴정리(기록, 관측들, 지금ms) {
  const 기 = 기록꼴(기록);
  const 묶음 = new Map();
  for (const o of 관측들 || []) {
    if (!o || !o.이름) continue;
    const 곳 = 기.곳[o.이름] || { 도메인: o.도메인, 끝: [] };
    곳.도메인 = o.도메인;
    곳.끝 = [...(Array.isArray(곳.끝) ? 곳.끝 : []), {
      때: o.때, 상태: o.상태, 유형: o.유형, http: o.http, 전체: o.전체, 우리: o.우리, 최근: o.최근,
    }].slice(-남길수);
    기.곳[o.이름] = 곳;
    if (!o.도메인) continue;
    if (!묶음.has(o.도메인)) 묶음.set(o.도메인, []);
    묶음.get(o.도메인).push(o);
  }

  const 확정 = [];
  let 탈난도메인 = 0;
  for (const [d, 들] of 묶음) {
    const 실패들 = 들.filter((x) => x.상태 === '실패');
    if (실패들.length < 들.length) { delete 기.도메인[d]; continue; }   // 한 곳이라도 받았으면 산 것
    탈난도메인++;
    let t = 가장센(실패들);
    /* 같은 플랫폼 여러 곳이 한 바퀴에 함께 실패 → 차단 (멘토). 다 일시 장애면 서버가 쓰러진 것으로 봅니다 */
    if (실패들.length >= 플랫폼곳수 && !실패들.every((x) => x.유형 === 유형.일시)) t = 유형.차단;
    const 앞 = 기.도메인[d];
    const 연속 = 앞 && 앞.유형 === t ? Number(앞.연속 || 0) + 1 : 1;
    const 칸 = { 유형: t, 연속, 확정: 연속 >= 2, 시작: (앞 && 앞.시작) || 지금ms, 마지막: 지금ms, 곳수: 들.length, 쉬기끝: null };
    if (t === 유형.속도) {
      const 받은 = 실패들.map((x) => x.쉴초).filter((v) => Number.isFinite(v));
      const 초 = 받은.length ? Math.max(...받은) : 쉼단계초[Math.min(연속, 쉼단계초.length) - 1];
      칸.쉬기끝 = 지금ms + 초 * 1000;
    }
    if (칸.확정 && !(앞 && 앞.확정)) 확정.push(d + ' ' + t);
    기.도메인[d] = 칸;
  }

  /* 오래 안 본 것은 뺍니다 — 차단 확정 도메인은 사람이 풀 때까지 남깁니다 */
  const 바닥 = 지금ms - 버릴날수 * 하루;
  for (const [이름, 곳] of Object.entries(기.곳)) {
    const 끝 = (곳 && 곳.끝) || [];
    if (!끝.length || !(끝[끝.length - 1].때 >= 바닥)) delete 기.곳[이름];
  }
  for (const [d, x] of Object.entries(기.도메인)) {
    if (x && x.유형 === 유형.차단 && x.확정) continue;
    if (!x || !(x.마지막 >= 바닥)) delete 기.도메인[d];
  }
  기.바퀴 = { 때: 지금ms, 본곳: (관측들 || []).length, 탈난곳: (관측들 || []).filter((o) => o && o.상태 === '실패').length };
  return { 기록: 기, 탈난곳: 기.바퀴.탈난곳, 탈난도메인, 확정 };
}

/* ── 다시 요청하나 ── */
const 두자리 = (n) => ('0' + n).slice(-2);
export function 때말(ms) {
  if (!Number.isFinite(ms)) return '?';
  const d = new Date(ms + 한국);
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + 두자리(d.getUTCHours()) + ':' + 두자리(d.getUTCMinutes());
}
/** null 이면 받습니다. 글이면 그 말로 건너뜁니다 (collect-hosp ① 의 「봇 금지 · 손확인」과 같은 자리) */
export function 건너뛸까(기록, s, 지금ms) {
  const d = 도메인(s);
  const x = d && 기록 && 기록['도메인'] ? 기록['도메인'][d] : null;
  if (!x) return null;
  if (x.유형 === 유형.차단 && x.확정) return '차단 확정 · 손확인 (' + d + ' · ' + 때말(x.시작) + '부터)';
  if (x.유형 === 유형.속도 && Number(x.쉬기끝) > 지금ms) return '속도 제한 · ' + 때말(x.쉬기끝) + '까지 쉼 (' + d + ')';
  return null;
}
/** 사람이 차단을 풀 때 — 그 도메인 기록을 지웁니다. 지운 것이 있으면 true */
export function 차단풀기(기록, d) {
  const 기 = 기록꼴(기록);
  const 키 = String(d || '').trim().toLowerCase();
  if (!키 || !기.도메인[키]) return false;
  delete 기.도메인[키];
  return true;
}

/* ── 아침 가르기 ── */
const 한국날 = (ms) => new Date(ms + 한국).toISOString().slice(0, 10);
const 가운데 = (수들) => {
  const a = [...수들].sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null;
};

/**
 * 기록 → { 고장:[{이름,도메인,유형,확정,시작}], 의심:[{이름,까닭}], 정상, 새글, 바퀴때, 곳수 }
 * 곳마다 **마지막으로 받아 본 결과**로 가릅니다 (천천히 곳은 하루 한두 번만 받으니 그때 것).
 */
export function 아침가르기(기록, 지금ms) {
  const 기 = 기록꼴(기록 ? JSON.parse(JSON.stringify(기록)) : null);
  const 어제 = 한국날(지금ms - 하루);
  const 바닥날 = 한국날(지금ms - 오래된날수 * 하루);
  const out = { 고장: [], 의심: [], 정상: 0, 새글: 0, 바퀴때: (기.바퀴 && 기.바퀴.때) || null, 곳수: 0 };
  for (const [이름, 곳] of Object.entries(기.곳).sort((a, b) => a[0].localeCompare(b[0]))) {
    const 끝 = Array.isArray(곳 && 곳.끝) ? 곳.끝 : [];
    const 막 = 끝[끝.length - 1];
    if (!막) continue;
    out.곳수++;
    const dx = 곳.도메인 ? 기.도메인[곳.도메인] : null;
    if (dx && dx.유형 === 유형.차단 && dx.확정) {
      out.고장.push({ 이름, 도메인: 곳.도메인, 유형: 유형.차단, 확정: true, 시작: dx.시작 });
      continue;
    }
    if (막.상태 === '실패') {
      /* 이 곳이 연달아 실패한 첫 때 · 같은 유형이 두 번이면 확정 (도메인이 확정이어도 확정) */
      let i = 끝.length - 1;
      while (i > 0 && 끝[i - 1].상태 === '실패') i--;
      const 곳확정 = 끝.length >= 2 && 끝[끝.length - 2].상태 === '실패' && 끝[끝.length - 2].유형 === 막.유형;
      out.고장.push({ 이름, 도메인: 곳.도메인, 유형: 막.유형, 확정: 곳확정 || !!(dx && dx.확정 && dx.유형 === 막.유형), 시작: 끝[i].때 });
      continue;
    }
    if (!(지금ms - 막.때 <= 못본시간 * 3600e3)) { out.의심.push({ 이름, 까닭: '이틀 넘게 못 봄' }); continue; }
    if (막.최근 && 막.최근 < 바닥날) { out.의심.push({ 이름, 까닭: '최근 글 ' + 오래된날수 + '일 넘음', 최근: 막.최근 }); continue; }
    const 앞수 = 끝.slice(0, -1).filter((x) => x.상태 === '받음' && Number.isInteger(x.전체)).map((x) => x.전체);
    const 평소 = 앞수.length >= 3 ? 가운데(앞수) : null;
    if (평소 != null && 평소 >= 6 && Number.isInteger(막.전체) && 막.전체 * 3 <= 평소) {
      out.의심.push({ 이름, 까닭: '글 수가 평소보다 크게 적음', 전체: 막.전체, 평소 });
      continue;
    }
    out.정상++;
    if (막.최근 && 막.최근 >= 어제) out.새글++;
  }
  out.고장.sort((a, b) => (a.시작 || 0) - (b.시작 || 0) || a.이름.localeCompare(b.이름));
  return out;
}

/** 아침 메일 줄들. 기록이 없으면 그렇다고 한 줄 */
export function 아침줄(가름) {
  if (!가름 || !가름.곳수) {
    return ['■ 병원 게시판 — 아직 기록이 없습니다 (수집기가 새 판으로 한 바퀴 돈 뒤부터 나옵니다)'];
  }
  const 줄 = [];
  줄.push('■ 병원 게시판 — 고장 ' + 가름.고장.length + ' · 의심 ' + 가름.의심.length + ' · 정상 ' + 가름.정상
    + ' (그중 어제·오늘 새 글 있는 곳 ' + 가름.새글 + ')'
    + (가름.바퀴때 ? '   · 마지막 바퀴 ' + 때말(가름.바퀴때) : ''));
  if (가름.고장.length) {
    const 묶 = new Map();
    for (const x of 가름.고장) 묶.set(x.도메인 || x.이름, (묶.get(x.도메인 || x.이름) || 0) + 1);
    const 여럿 = [...묶].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    줄.push('   고장을 도메인으로 묶으면 ' + 묶.size + '곳' + (여럿.length ? ' — ' + 여럿.slice(0, 5).map(([d, n]) => d + ' ' + n + '곳').join(' · ') : ''));
    줄.push('   고장 — 기관 · 유형 · 시작');
    for (const x of 가름.고장.slice(0, 15)) {
      줄.push('     ✗ ' + x.이름.slice(0, 22).padEnd(24) + (x.유형 + (x.확정 ? '(확정)' : '(한 번 · 관찰)')).padEnd(16) + ' ' + 때말(x.시작));
    }
    if (가름.고장.length > 15) 줄.push('     … 그리고 ' + (가름.고장.length - 15) + '곳 더');
  }
  if (가름.의심.length) {
    const 셈 = new Map();
    for (const x of 가름.의심) 셈.set(x.까닭, (셈.get(x.까닭) || 0) + 1);
    줄.push('   의심 — ' + [...셈].map(([k, n]) => k + ' ' + n).join(' · ') + ' (주 1회 확인)');
  }
  줄.push('   (곳마다 마지막으로 받아 본 결과 · 글 0개·못 받음 = 고장 · 같은 유형 두 번 = 확정 · 차단 확정 도메인은 다시 안 두드림)');
  return 줄;
}
