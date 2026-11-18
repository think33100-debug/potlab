/* 공공 API 네 출처 경보 — 규칙 (2026-11-18 · 멘토-1.7-2 · 멘토-1.7-3 · 멘토-1.7-4)
 *
 *   ① 같은 출처가 **두 번 연속** 실패
 *   ② 받은 건수가 **지난 4주 같은 요일 평균의 절반 이하**
 *   ③ 평일(공휴일 빼고)인데 알리오·워크넷이 **하루 종일 새 공고 0건**
 *
 * 출처 — 워크넷(고용24) WN2 · 알리오 AL2 · 나라일터 GJ2 · 클린아이 CE2.
 * 재료는 이미 있는 것만 씁니다 — DB 의 collector_beat(바퀴마다 박동) · job_posts.db_insert_at ·
 * job_trash.trashed_at · 공휴일. 새 표·새 DB 함수는 없습니다.
 *
 * ── 「실패한 바퀴」 의 자 ────────────────────────────────────
 *   박동 ok=false                           (WN2·CE2 는 2026-11-18 부터 실패 바퀴도 박동을 남깁니다)
 *   AL2  메모.목록멈춘쪽 = 1                  (첫 쪽부터 못 받음 · 순찰은 받음 0 이 정상이라 이 칸으로 봅니다)
 *   GJ2  메모.읽은줄 = 0 이고 못받음 > 0        (목록 첫 쪽부터 실패)
 *   ※ 박동 없이 죽은 바퀴(열쇠 없음·프로세스가 죽음)는 여기서 못 셉니다 — 수집기멈춤경보(2시간)가 봅니다.
 *
 * ── 「받은 건수」 의 자 (박동 메모) ─────────────────────────────
 *   WN2 읽은줄 · GJ2 읽은줄 · AL2 받음 · CE2 의료.   하루에 여러 바퀴가 돌고 순찰(첫 쪽만)과 전체가
 *   섞이므로 **그날 성공한 바퀴 중 가장 큰 값**을 그날 값으로 씁니다. 박동 표는 출처마다 최근 500줄만
 *   남아(collect_beat) 4주치가 없을 수 있어서, 날마다 값을 서버 파일에 쌓습니다(부르는 쪽).
 *   같은 요일 값이 **두 주 이상** 쌓이기 전에는 ② 를 재지 않습니다(「기준 부족」).
 *
 * 순수 함수만 — 네트워크·파일·시계·환경을 쓰지 않습니다(지금ms 를 받습니다).
 */

export const 출처들 = ['WN2', 'AL2', 'GJ2', 'CE2'];
export const 출처이름 = { WN2: '워크넷(고용24)', AL2: '알리오', GJ2: '나라일터', CE2: '클린아이' };
export const 새공고볼출처 = ['AL2', 'WN2'];          // 멘토-1.7-4 「알리오·고용24」
export const 쉬는시간 = 6;                          // 같은 출처는 6시간에 한 번 (수집기멈춤경보와 같은 결)
const 한국 = 9 * 3600e3;
const 하루 = 86400e3;
const 남길날 = 40;

export const 한국날 = (ms) => new Date(ms + 한국).toISOString().slice(0, 10);
export const 한국시 = (ms) => new Date(ms + 한국).getUTCHours();
const 날더하기 = (날, n) => new Date(Date.parse(날 + 'T00:00:00Z') + n * 하루).toISOString().slice(0, 10);
const 수 = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

/** 박동 한 줄의 받은 건수 — 모르면 null */
export function 받은수(b) {
  const m = (b && b['메모']) || {};
  switch (b && b.source) {
    case 'WN2': case 'GJ2': return 수(m['읽은줄']);
    case 'AL2': return 수(m['받음']);
    case 'CE2': return 수(m['의료']);
    default: return null;
  }
}

/** 실패한 바퀴인가 (머리 주석의 자) */
export function 실패인가(b) {
  if (!b) return false;
  if (b.ok === false) return true;
  const m = b['메모'] || {};
  if (b.source === 'AL2') return 수(m['목록멈춘쪽']) === 1;
  if (b.source === 'GJ2') return 수(m['읽은줄']) === 0 && (수(b['못받음']) || 0) > 0;
  return false;
}

const 최근순 = (박동들) => [...(박동들 || [])].filter((b) => b && b.ran_at)
  .sort((a, b) => Date.parse(b.ran_at) - Date.parse(a.ran_at) || (Number(b.id) || 0) - (Number(a.id) || 0));

/** ① 마지막 두 바퀴가 다 실패한 출처 — [{ 출처, 종류, 때, 왜 }] */
export function 연속실패(박동들) {
  const out = [];
  const 다 = 최근순(박동들);
  for (const s of 출처들) {
    const 둘 = 다.filter((b) => b.source === s).slice(0, 2);
    if (둘.length === 2 && 둘.every(실패인가)) {
      out.push({ 종류: '연속실패', 출처: s, 때: 둘[0].ran_at, 앞때: 둘[1].ran_at, 왜: 가린왜(둘[0]['왜']) });
    }
  }
  return out;
}
/* 박동의 왜 는 우리 수집기가 적은 짧은 글입니다. 혹시 몰라 열쇠 꼴은 가립니다 */
function 가린왜(w) {
  return String(w || '').replace(/((?:service)?key|token|secret|serviceKey)=[^&\s]+/gi, '$1=‹가림›').slice(0, 100);
}

/** 박동들 → { 출처: { 날: 그날 성공 바퀴의 가장 큰 받은 건수 } } */
export function 하루최대(박동들) {
  const out = {};
  for (const b of 박동들 || []) {
    if (!b || !출처들.includes(b.source) || 실패인가(b)) continue;
    const n = 받은수(b);
    const t = Date.parse(b.ran_at);
    if (n == null || !Number.isFinite(t)) continue;
    const 날 = 한국날(t);
    out[b.source] = out[b.source] || {};
    out[b.source][날] = Math.max(out[b.source][날] ?? -Infinity, n);
  }
  return out;
}

/** 쌓인 하루 기록에 새 값을 합칩니다(큰 쪽) · 오래된 날은 뺍니다. 같은 객체를 고쳐 돌려줍니다 */
export function 하루합치기(쌓인, 새것, 지금ms) {
  const 기 = 쌓인 && typeof 쌓인 === 'object' && !Array.isArray(쌓인) ? 쌓인 : {};
  const 바닥 = 한국날(지금ms - 남길날 * 하루);
  for (const [s, 날들] of Object.entries(새것 || {})) {
    기[s] = 기[s] && typeof 기[s] === 'object' ? 기[s] : {};
    for (const [날, n] of Object.entries(날들)) 기[s][날] = Math.max(Number.isFinite(기[s][날]) ? 기[s][날] : -Infinity, n);
  }
  for (const s of Object.keys(기)) {
    for (const 날 of Object.keys(기[s] || {})) if (날 < 바닥) delete 기[s][날];
  }
  return 기;
}

/**
 * ② 그날 받은 건수가 지난 4주 같은 요일 평균의 절반 이하인 출처.
 * @returns {{ 경보: [{종류,출처,날,받은,평균,몇주}], 기준부족: [{출처,날,몇주}] }}
 */
export function 반토막(하루기록, 날) {
  const 경보 = [], 기준부족 = [];
  for (const s of 출처들) {
    const 값 = (하루기록 || {})[s] || {};
    const 오늘값 = 값[날];
    if (!Number.isFinite(오늘값)) continue;                       // 그날 성공한 바퀴가 없음 — ① · 멈춤경보 몫
    const 앞 = [7, 14, 21, 28].map((n) => 값[날더하기(날, -n)]).filter(Number.isFinite);
    if (앞.length < 2) { 기준부족.push({ 출처: s, 날, 몇주: 앞.length }); continue; }
    const 평균 = 앞.reduce((a, b) => a + b, 0) / 앞.length;
    if (평균 >= 2 && 오늘값 <= 평균 / 2) {
      경보.push({ 종류: '반토막', 출처: s, 날, 받은: 오늘값, 평균: Math.round(평균 * 10) / 10, 몇주: 앞.length });
    }
  }
  return { 경보, 기준부족 };
}

/** 평일인가 — 월~금이고 공휴일이 아니면 */
export function 평일인가(날, 공휴일들 = []) {
  const 요일 = new Date(날 + 'T00:00:00Z').getUTCDay();
  return 요일 >= 1 && 요일 <= 5 && !new Set(공휴일들).has(날);
}

/** ③ 어느 날을 보나 — 21시(평일 업무시간 끝 · 새공고마름() 과 같은 자)가 지났으면 오늘, 아니면 어제 */
export function 새공고볼날(지금ms) {
  return 한국시(지금ms) >= 21 ? 한국날(지금ms) : 한국날(지금ms - 하루);
}

/** ③ { AL2: 새줄수, WN2: 새줄수 } → 0건인 출처 경보 (평일만) */
export function 새공고없음(셈, 날, 공휴일들 = []) {
  if (!평일인가(날, 공휴일들)) return [];
  return 새공고볼출처
    .filter((s) => Number.isInteger((셈 || {})[s]) && 셈[s] === 0)
    .map((s) => ({ 종류: '새공고0', 출처: s, 날 }));
}

/* 경보 열쇠 — ① 은 출처마다(이어지는 동안 6시간마다 다시), ②③ 은 날마다 한 번 */
export const 열쇠 = (x) => (x.종류 === '연속실패' ? x.종류 + ':' + x.출처 : x.종류 + ':' + x.출처 + ':' + x.날);

/**
 * 조용히 — 같은 출처는 6시간에 한 번 · ②③ 은 같은 날 것을 두 번 안 보냅니다.
 * @param 보냄 { 열쇠: ms, '출처:WN2': ms }
 */
export function 보낼것고르기(경보들, 보냄, 지금ms, 시간 = 쉬는시간) {
  const 기 = 보냄 || {};
  const 막힌출처 = new Set(출처들.filter((s) => Number.isFinite(기['출처:' + s]) && 지금ms - 기['출처:' + s] < 시간 * 3600e3));
  return (경보들 || []).filter((x) => !막힌출처.has(x.출처) && !(x.종류 !== '연속실패' && 기[열쇠(x)]));
}
/** 보낸 뒤 기록 — 같은 객체를 고쳐 돌려줍니다 */
export function 보냄적기(보냄, 보낸것, 지금ms) {
  const 기 = 보냄 && typeof 보냄 === 'object' ? 보냄 : {};
  for (const x of 보낸것) { 기[열쇠(x)] = 지금ms; 기['출처:' + x.출처] = 지금ms; }
  const 바닥 = 지금ms - 남길날 * 하루;
  for (const [k, v] of Object.entries(기)) if (!(v >= 바닥)) delete 기[k];
  return 기;
}

const 때말 = (iso) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '?';
  const d = new Date(t + 한국);
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
};

/** 메일 — { 제목, 본문 } (쉬운 말 먼저 · 수집기멈춤경보와 같은 꼴) */
export function 메일글(경보들, { 시험 = false } = {}) {
  const 이름 = (s) => (출처이름[s] || s) + ' ' + s;
  const 짧게 = (x) => x.종류 === '연속실패' ? x.출처 + ' 두 번 연속 실패'
    : x.종류 === '반토막' ? x.출처 + ' 받은 건수 절반 이하'
      : x.출처 + ' 평일 새 공고 0';
  const 제목 = (시험 ? '[RAPO · 시험] ' : '[RAPO] ') + '⚠ 공공 출처 경보 — ' + 경보들.map(짧게).join(' · ');
  const 줄 = ['■ 한눈에 — 공공 API 출처에 ' + 경보들.length + '가지 이상한 점이 있습니다', ''];
  for (const x of 경보들) {
    if (x.종류 === '연속실패') {
      줄.push('● ' + 이름(x.출처) + ' — 두 번 연속 실패 (' + 때말(x.앞때) + ' · ' + 때말(x.때) + ')');
      if (x.왜) 줄.push('   마지막 까닭: ' + x.왜);
      줄.push('   회원에게: 이 출처의 새 공고가 늦게 올라옵니다');
    } else if (x.종류 === '반토막') {
      줄.push('● ' + 이름(x.출처) + ' — ' + x.날 + ' 받은 건수 ' + x.받은 + '건 · 지난 ' + x.몇주 + '주 같은 요일 평균 ' + x.평균 + '건의 절반 이하');
      줄.push('   뜻: 목록을 덜 받아 온 것일 수 있습니다 (출처 쪽 변화 · 우리 쪽 고장 · 한도)');
    } else {
      줄.push('● ' + 이름(x.출처) + ' — ' + x.날 + '(평일) 하루 종일 새 공고 0건');
      줄.push('   뜻: 평일에 0건은 드뭅니다 — 수집이 멈췄거나 거르기가 다 버렸을 수 있습니다');
    }
    줄.push('');
  }
  줄.push('할 일: 서버 로그 확인은 세중님 몫입니다. 이 메일을 앱 Claude 에게 보여 주면 원인을 찾아 드려요.');
  줄.push('같은 출처는 ' + 쉬는시간 + '시간에 한 번만 보냅니다 · 규칙 tools/공공출처경보규칙.mjs');
  return { 제목, 본문: 줄.join('\n') };
}
