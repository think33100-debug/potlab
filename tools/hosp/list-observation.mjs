/* 병원 게시판 목록 **최소 관측** — 순수 함수 · 오프라인 · 운영 미연결 (2026-11-04 Q10 축소판)
 *
 *   import { observeList } from './hosp/list-observation.mjs';
 *   const r = observeList({ status, networkError, html, rowCount });
 *
 * 왜 줄였나 — 전체 글 수·최근 등록일을 HTML 에서 추정하던 앞 판은 모형 시험을 다 통과하고도 숨긴 칸의
 * 마감일을 등록일로 냈습니다. 추정을 고치는 대신 **추정 기능을 없앴습니다.** 표 구조·칸 위치·숫자·날짜를
 * 읽는 코드가 이 파일에 없습니다.
 *
 * ★ 앞 판과 **호환되지 않습니다.** 입력 이름(parsedRows → rowCount)과 출력 칸이 다르고, reasonCode·
 *   notes·scope·boardKeySha256·observedAt·receivedBytes 와 _internal 이 사라졌습니다.
 *   이 모듈을 부르는 운영 코드는 없습니다 (report·수집기·설정·분류·크론 미연결).
 *
 * ── 입력 ─────────────────────────────────────────────────────
 *   status        받은 HTTP 상태. 100~599 정수만. 글자 '200' 도 비정상입니다
 *   networkError  요청이 응답 없이 실패했으면 true. true/false/없음만 받습니다.
 *                 오류 객체·오류 글을 넘기면 값을 버리고 NETWORK_STATE_INVALID 입니다
 *   html          받은 본문 (이미 글자로 풀린 것). 오류 서명을 찾는 데만 씁니다
 *   rowCount      **호출자가 이미 돌린 기존 파서**의 행 수. 0 ~ MAX_ROW_COUNT 정수만.
 *                 이 모듈은 HTML 로 행을 다시 세지 않고, 값이 HTML 과 달라도 고치지 않습니다
 *   그 밖의 입력(URL·기관명·회원 식별자·오류 글 …)은 읽지 않습니다.
 *
 * ── 출력 ─────────────────────────────────────────────────────
 *   칸은 아래 열 개로 고정이고 값은 null / 불리언 / 정수 / 이 파일의 고정 코드뿐입니다.
 *   입력 글을 어떤 꼴로도 돌려주지 않습니다.
 *     httpStatus · networkError · rowCount   검증을 통과한 입력. 아니면 null (모르는 값)
 *                                            rowCount 는 네트워크 오류·networkError 비정상·status 가 200 이 아니면
 *                                            (없음·비정상 포함) 언제나 null 입니다 — 받지 못했거나 오류 응답의 행 수는 0행이 아닙니다
 *     errorSignature                         ERROR_SIGNATURE 또는 null (아래 뜻 참고)
 *     state · unknownReason                  아래 표
 *     boardTotal · latestPosted              **언제나 null**
 *     boardTotalState · latestPostedState    **언제나 NOT_MEASURED**
 *
 * ── state — 먼저 맞는 줄이 이깁니다 ─────────────────────────────
 *   UNDETERMINED          networkError 값이 비정상 (NETWORK_STATE_INVALID)
 *   NETWORK_ERROR         networkError=true · status 없음. 게시판 상태는 미상입니다
 *   UNDETERMINED          networkError=true 인데 status 도 있음 (CONFLICTING_INPUT)
 *   UNDETERMINED          status 없음/비정상 (STATUS_MISSING · STATUS_INVALID)
 *   HTTP_NOT_OK           200 이 아닌 status. 기관 고장 확정이 아닙니다 (우리 쪽 차단·일시 장애일 수 있음)
 *   UNDETERMINED          200 인데 html 이 없음/상한 초과 (HTML_MISSING · HTML_TOO_LARGE)
 *   HTML_ERROR_SUSPECT    200 + 오류 서명 (ERROR_SIGNATURE_UNCONFIRMED). **의심일 뿐 운영 고장 확정이 아닙니다.**
 *                         행 수가 양수여도 이 상태이고, rowCount 는 그대로 남깁니다
 *   UNDETERMINED          문서 끝이 잘려 끝까지 못 읽음 (HTML_TRUNCATED)
 *   UNDETERMINED          rowCount 없음/비정상 (ROW_COUNT_MISSING · ROW_COUNT_INVALID) — 0 으로 메우지 않습니다
 *   ZERO_ROWS_UNCONFIRMED 200 + 0행 (ZERO_ROWS_CAUSE_UNKNOWN). **정상 0 도 기관 고장도 확정하지 않습니다**
 *   ROWS_PARSED           200 + 양수. 파서가 그만큼 냈다는 뜻뿐이고 건강 판정·전수 수집이 아닙니다
 *   unknownReason 은 UNDETERMINED·HTML_ERROR_SUSPECT·ZERO_ROWS_UNCONFIRMED 에만 있고 나머지는 null 입니다.
 *
 * ── errorSignature ─ null 은 「안 보였다」일 뿐 「오류가 없다」가 아닙니다 ───
 *   LOGIN_SCREEN      제목 전체가 로그인 문구 + 보이는 비밀번호 칸 (옆 로그인 상자만으로는 안 잡습니다)
 *   BLOCK_SCREEN      제목 전체가 차단 문구
 *   ERROR_SCREEN      제목 전체가 서버 오류 문구
 *   APP_ERROR_TRACE   보이는 글의 PHP 오류 구조(오류 머리 + on line 번호) · ASP.NET 오류 머리
 *   DB_ERROR_TRACE    보이는 글의 DB 오류 구문
 *   「오류」 같은 낱말 하나로는 잡지 않습니다. 공고 글일 수 있습니다.
 *   읽지 않는 자리: 주석 · script · style · template · noscript · textarea · iframe 류 · 링크·svg 안의 글 ·
 *   hidden 속성 · 인라인 display:none / visibility:hidden. 상태가 200 이 아니어도 서명은 함께 남깁니다.
 *
 * 한계 — 스타일시트로 숨긴 글은 구분하지 못합니다(의심까지만 갑니다). 스크립트가 그리는 화면은 못 봅니다.
 *   닫히지 않은 링크·숨김 요소 뒤의 글은 읽지 않습니다 — 서명을 놓칠 뿐 없는 서명을 만들지 않습니다.
 */

export const NOT_MEASURED = 'NOT_MEASURED';
export const MAX_ROW_COUNT = 100_000;
export const MAX_HTML_CHARS = 5_000_000;

export const STATE = Object.freeze({
  NETWORK_ERROR: 'NETWORK_ERROR',
  HTTP_NOT_OK: 'HTTP_NOT_OK',
  HTML_ERROR_SUSPECT: 'HTML_ERROR_SUSPECT',
  ZERO_ROWS_UNCONFIRMED: 'ZERO_ROWS_UNCONFIRMED',
  ROWS_PARSED: 'ROWS_PARSED',
  UNDETERMINED: 'UNDETERMINED',
});

export const UNKNOWN_REASON = Object.freeze({
  NETWORK_STATE_INVALID: 'NETWORK_STATE_INVALID',
  CONFLICTING_INPUT: 'CONFLICTING_INPUT',
  STATUS_MISSING: 'STATUS_MISSING',
  STATUS_INVALID: 'STATUS_INVALID',
  HTML_MISSING: 'HTML_MISSING',
  HTML_TOO_LARGE: 'HTML_TOO_LARGE',
  HTML_TRUNCATED: 'HTML_TRUNCATED',
  ROW_COUNT_MISSING: 'ROW_COUNT_MISSING',
  ROW_COUNT_INVALID: 'ROW_COUNT_INVALID',
  ERROR_SIGNATURE_UNCONFIRMED: 'ERROR_SIGNATURE_UNCONFIRMED',
  ZERO_ROWS_CAUSE_UNKNOWN: 'ZERO_ROWS_CAUSE_UNKNOWN',
});

export const ERROR_SIGNATURE = Object.freeze({
  LOGIN_SCREEN: 'LOGIN_SCREEN',
  BLOCK_SCREEN: 'BLOCK_SCREEN',
  ERROR_SCREEN: 'ERROR_SCREEN',
  APP_ERROR_TRACE: 'APP_ERROR_TRACE',
  DB_ERROR_TRACE: 'DB_ERROR_TRACE',
});

/* ── 보이는 글 훑기 — 한 번 지나가며 끝납니다 (끝나지 않는 꼴을 만나면 그 자리에서 멈춤) ── */
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TAGS = new Set(['script', 'style', 'template', 'noscript', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
const WS = /\s/;

/** s[i] 가 '<' 인 여는 태그를 따옴표를 가려 읽습니다. 끝나지 않으면 null */
function readOpenTag(s, i) {
  const n = s.length; let p = i + 1;
  while (p < n && !WS.test(s[p]) && s[p] !== '/' && s[p] !== '>') p++;
  const tag = s.slice(i + 1, p).toLowerCase();
  const attrs = new Map();
  while (p < n) {
    while (p < n && (WS.test(s[p]) || s[p] === '/')) p++;
    if (p >= n) return null;
    if (s[p] === '>') return { tag, attrs, end: p + 1 };
    const st = p;
    if (s[p] === '=') p++;
    while (p < n && !WS.test(s[p]) && s[p] !== '/' && s[p] !== '>' && s[p] !== '=') p++;
    const name = s.slice(st, p).toLowerCase();
    while (p < n && WS.test(s[p])) p++;
    let value = '';
    if (s[p] === '=') {
      p++;
      while (p < n && WS.test(s[p])) p++;
      if (s[p] === '"' || s[p] === "'") {
        const e = s.indexOf(s[p], p + 1);
        if (e < 0) return null;
        value = s.slice(p + 1, e); p = e + 1;
      } else {
        const vs = p;
        while (p < n && !WS.test(s[p]) && s[p] !== '>') p++;
        value = s.slice(vs, p);
      }
    }
    if (!attrs.has(name)) attrs.set(name, value);
  }
  return null;
}

/** 속성 **이름**으로 봅니다. hidden 은 값이 false·0 이어도 숨김입니다 */
function isInlineHidden(attrs) {
  if (attrs.has('hidden')) return true;
  const style = attrs.get('style');
  if (!style) return false;
  for (const decl of style.split(';')) {
    const k = decl.indexOf(':');
    if (k < 0) continue;
    const prop = decl.slice(0, k).trim().toLowerCase();
    const val = decl.slice(k + 1).replace(/!important/i, '').trim().toLowerCase();
    if (prop === 'display' && val === 'none') return true;
    if (prop === 'visibility' && (val === 'hidden' || val === 'collapse')) return true;
  }
  return false;
}

/**
 * @returns {{ text: string, title: string|null, hasPassword: boolean, truncated: boolean }}
 * text·title 은 이 파일 안에서 서명을 찾는 데만 쓰고 밖으로 내보내지 않습니다.
 */
function scanVisible(s) {
  const parts = [];
  let title = null; let hasPassword = false; let truncated = false;
  let skipTag = null; let skipDepth = 0; // 링크·숨김 요소 안이면 그 태그 이름과 깊이
  const n = s.length; let i = 0;

  while (i < n) {
    const lt = s.indexOf('<', i);
    if (lt < 0) { if (!skipTag) parts.push(s.slice(i)); break; }
    if (!skipTag && lt > i) parts.push(s.slice(i, lt));
    if (s.startsWith('<!--', lt)) {
      const e = s.indexOf('-->', lt + 4);
      if (e < 0) { truncated = true; break; }
      i = e + 3; continue;
    }
    const nx = s[lt + 1];
    if (nx === '!' || nx === '?' || nx === '/') {
      const e = s.indexOf('>', lt + 2);
      if (e < 0) { truncated = true; break; }
      if (nx === '/' && skipTag) {
        const closing = s.slice(lt + 2, e).trim().split(/\s/)[0].toLowerCase();
        if (closing === skipTag && --skipDepth === 0) skipTag = null;
      }
      i = e + 1; continue;
    }
    if (!/[a-zA-Z]/.test(nx || '')) { if (!skipTag) parts.push('<'); i = lt + 1; continue; }

    const t = readOpenTag(s, lt);
    if (!t) { truncated = true; break; }
    i = t.end;

    if (RAW_TAGS.has(t.tag)) {
      const close = new RegExp('</' + t.tag + '[\\s>]', 'gi');
      close.lastIndex = i;
      const m = close.exec(s);
      if (!m) { truncated = true; break; }
      if (t.tag === 'title' && title === null && !skipTag) title = s.slice(i, m.index);
      const e = s.indexOf('>', m.index);
      if (e < 0) { truncated = true; break; }
      i = e + 1;
      continue;
    }
    if (VOID_TAGS.has(t.tag)) {
      if (!skipTag && t.tag === 'input' && !isInlineHidden(t.attrs) && (t.attrs.get('type') || '').trim().toLowerCase() === 'password') hasPassword = true;
      parts.push(' ');
      continue;
    }
    if (skipTag) { if (t.tag === skipTag) skipDepth++; continue; }
    if (t.tag === 'a' || t.tag === 'svg' || isInlineHidden(t.attrs)) { skipTag = t.tag; skipDepth = 1; continue; } // HTML 은 <div hidden/> 의 「/」 를 무시합니다
    parts.push(' ');
  }
  return { text: tidy(parts.join(' ')), title: title === null ? null : tidy(title), hasPassword, truncated };
}

const tidy = (t) => t
  .replace(/&nbsp;|&#160;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&')
  .replace(/[\s　]+/g, ' ').trim();

/* ── 서명 — 제목은 **전체가 일치**할 때만 ──────────────────────── */
const LOGIN_TITLES = new Set(['로그인', '회원 로그인', 'login', 'log in', 'sign in', 'member login']);
const BLOCK_TITLES = new Set(['403 forbidden', 'forbidden', 'access denied', '403 access denied', '접근이 거부되었습니다', '접근 권한이 없습니다', '접근이 제한되었습니다', 'attention required! | cloudflare', 'just a moment...']);
const ERROR_TITLES = new Set(['400 bad request', '404 not found', 'not found', '500 internal server error', 'internal server error', '502 bad gateway', '503 service unavailable', 'service unavailable', '504 gateway time-out', '504 gateway timeout', 'runtime error', '페이지를 찾을 수 없습니다', '오류가 발생했습니다']);

const APP_TRACE = [
  /\b(?:Fatal error|Parse error)\s*:\s*\S[\s\S]{0,1200}?\bon line\s+\d+/,
  /Server Error in '[^']{0,200}' Application/,
];
const DB_TRACE = [
  /You have an error in your SQL syntax/,
  /\bUncaught mysqli_sql_exception\b/,
  /\bSQLSTATE\[[0-9A-Z]{5}\]\s*:/,
  /\bORA-\d{5}\s*:/,
];

function findSignature({ text, title, hasPassword }) {
  const t = title === null ? null : title.toLowerCase();
  if (t !== null) {
    if (LOGIN_TITLES.has(t) && hasPassword) return ERROR_SIGNATURE.LOGIN_SCREEN;
    if (BLOCK_TITLES.has(t)) return ERROR_SIGNATURE.BLOCK_SCREEN;
    if (ERROR_TITLES.has(t)) return ERROR_SIGNATURE.ERROR_SCREEN;
  }
  if (APP_TRACE.some((re) => re.test(text))) return ERROR_SIGNATURE.APP_ERROR_TRACE;
  if (DB_TRACE.some((re) => re.test(text))) return ERROR_SIGNATURE.DB_ERROR_TRACE;
  return null;
}

/* ── 입력 검증 ───────────────────────────────────────────────── */
const validStatus = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : null);
const validRowCount = (v) => (Number.isInteger(v) && v >= 0 && v <= MAX_ROW_COUNT ? (v === 0 ? 0 : v) : null); // -0 → 0

/* ── 본체 ────────────────────────────────────────────────────── */
/** 계약은 파일 머리 주석입니다. 네트워크·env·파일·시계를 쓰지 않고 입력을 고치지 않습니다 */
export function observeList(input) {
  const i = input !== null && typeof input === 'object' ? input : {};
  const networkGiven = i.networkError !== undefined && i.networkError !== null;
  const networkValid = !networkGiven || typeof i.networkError === 'boolean';
  const out = {
    httpStatus: validStatus(i.status),
    networkError: networkGiven && networkValid ? i.networkError : null,
    errorSignature: null,
    rowCount: (i.networkError === true || (networkGiven && !networkValid) || validStatus(i.status) !== 200) ? null : validRowCount(i.rowCount),
    boardTotal: null,
    boardTotalState: NOT_MEASURED,
    latestPosted: null,
    latestPostedState: NOT_MEASURED,
    state: STATE.UNDETERMINED,
    unknownReason: null,
  };
  const undetermined = (reason) => { out.unknownReason = reason; return out; };
  const statusGiven = i.status !== undefined && i.status !== null;

  if (!networkValid) return undetermined(UNKNOWN_REASON.NETWORK_STATE_INVALID);
  if (i.networkError === true) {
    if (statusGiven) return undetermined(UNKNOWN_REASON.CONFLICTING_INPUT);
    out.state = STATE.NETWORK_ERROR;
    return out;
  }
  if (!statusGiven) return undetermined(UNKNOWN_REASON.STATUS_MISSING);
  if (out.httpStatus === null) return undetermined(UNKNOWN_REASON.STATUS_INVALID);

  const hasHtml = typeof i.html === 'string';
  const tooLarge = hasHtml && i.html.length > MAX_HTML_CHARS;
  const scan = hasHtml && !tooLarge ? scanVisible(i.html) : null;
  if (scan) out.errorSignature = findSignature(scan);

  if (out.httpStatus !== 200) { out.state = STATE.HTTP_NOT_OK; return out; }
  if (!hasHtml) return undetermined(UNKNOWN_REASON.HTML_MISSING);
  if (tooLarge) return undetermined(UNKNOWN_REASON.HTML_TOO_LARGE);
  if (out.errorSignature) {
    out.state = STATE.HTML_ERROR_SUSPECT;
    out.unknownReason = UNKNOWN_REASON.ERROR_SIGNATURE_UNCONFIRMED;
    return out;
  }
  if (scan.truncated) return undetermined(UNKNOWN_REASON.HTML_TRUNCATED);
  if (i.rowCount === undefined || i.rowCount === null) return undetermined(UNKNOWN_REASON.ROW_COUNT_MISSING);
  if (out.rowCount === null) return undetermined(UNKNOWN_REASON.ROW_COUNT_INVALID);
  if (out.rowCount === 0) {
    out.state = STATE.ZERO_ROWS_UNCONFIRMED;
    out.unknownReason = UNKNOWN_REASON.ZERO_ROWS_CAUSE_UNKNOWN;
    return out;
  }
  out.state = STATE.ROWS_PARSED;
  return out;
}

export default observeList;
