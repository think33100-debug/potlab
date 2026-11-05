/* 병원 수집 실패 응답 기록 (멘토-2차-02-2) — 진단만 합니다.
 * 네트워크를 타지 않고, 수집 판단·쪽 넘김·동시 수·재시도를 바꾸지 않습니다.
 *
 * ── 앞글은 원문이 아니라 「안전한 투영」입니다 ─────────────────
 * 자유 글 속 사람 이름은 정규식으로 알아낼 수 없습니다. 그래서 **아는 낱말만 남기고
 * 나머지를 가립니다** — 태그 이름 · 진단 낱말 · 네 자리 이하 숫자 · 문장부호만 통과합니다.
 * 한계: 이름이 허용 낱말과 우연히 같으면 통과합니다. 기관 이름·처음 보는 오류 문구는
 * 가려지므로, 진단에 더 필요하면 그 낱말을 목록에 더합니다.
 * 순서: 가리기 → 자르기. 값이 자르는 자리에 걸쳐도 앞조각이 안 남습니다.
 */

/* 지침 2절(원문 500~1,200자) 안에서 고른 앞글 길이 */
export const 본문길이 = 800;
const 원문상한 = 32000;   // 가리기 전 앞자르기 — 큰 응답에서도 정규식 시간을 묶습니다
const 항목상한 = 40;

const 영어 = new Set(`html head title body meta div span p h1 h2 h3 h4 h5 h6 hr br center table tbody thead tr td th
ul ol li a pre form input link b i strong em address main section header footer nav doctype
error errors err exception failed failure fail fetch forbidden denied access unauthorized blocked block bad gateway
request requests requested response service services unavailable temporarily temporary timeout time out not found
internal server too many rate limit limited maintenance redirect moved permanently please try again later retry
invalid method allowed page unable to the of is are was were has have been you your this that and or for from by at
in on with without an as be cannot sorry json xml text charset utf euc kr null true false status code message result
success ok http https typeerror aborterror timeouterror
nginx apache cloudflare microsoft iis tomcat jeus webtob openresty envoy gws awselb amazons3 litespeed
waf firewall captcha security ssl tls cert certificate`.split(/\s+/));

const 한글낱말 = new RegExp('^(?:오류|에러|장애|차단|접근|거부|권한|인증|로그인|요청|응답|서버|서비스|점검|일시|중단|'
  + '페이지|찾을|없습니다|존재|잘못|보안|방화벽|과도|초과|제한|잠시|다시|시도|주세요|주소|아닙니다|실패|연결|불가|접속)+'
  + '(?:이|가|을|를|은|는|에|의|로|으로|에서|입니다|합니다|됩니다|되었습니다|했습니다|하였습니다|하십시오|해주세요|된|한|할|하는)?$');
const 한글홀로 = new Set(['수', '할', '후', '및', '또는', '해', '더']);

const 자리값 = new Set(['‹주소›', '‹가림›', '‹이름›', '‹메일›', '‹전화›', '‹번호›', '‹스크립트›', '‹값›', '‹수›', '‹영문›', '‹한글›']);
const 비밀칸 = String.raw`[\w-]{0,32}?(?:authorization|cookie|token|secret|password|passwd|pwd|key|session|sessid|signature|sig|auth)|비밀번호|암호|토큰|인증키`;
const 사람칸 = String.raw`담당자?|성명|이름|주민(?:등록)?(?:번호)?|연락처|전화(?:번호)?|휴대(?:폰|전화)?|핸드폰|이메일|사번|아이디|e-?mail|name|user(?:name|id)?|phone|tel|mobile`;
const 칸꼴 = (칸) => new RegExp(String.raw`(?<![\w-])(?:${칸})["']?\s*[:=：]\s*[^\n<]{0,400}`, 'giu');
const 비밀칸꼴 = 칸꼴(비밀칸);
const 사람칸꼴 = 칸꼴(사람칸);

function 낱말(t) {
  if (t.startsWith('‹')) return 자리값.has(t) ? t : '‹값›';
  if (/^\d{1,4}$/.test(t) || 영어.has(t.toLowerCase()) || 한글홀로.has(t) || 한글낱말.test(t)) return t;
  if (/^\p{N}+$/u.test(t)) return '‹수›';
  if (/^[A-Za-z]+$/.test(t)) return '‹영문›';
  return /^\p{Script=Hangul}+$/u.test(t) ? '‹한글›' : '‹값›';
}

function 글로(v) {
  try {
    if (v == null) return '';
    return Buffer.isBuffer(v) ? v.toString('utf8') : String(v);
  } catch { return ''; }
}

/** 가린 뒤에 자릅니다. 던지지 않습니다. */
export function 안전글(값, 길이 = 본문길이) {
  let s = 글로(값);
  if (s.length > 원문상한) s = s.slice(0, 원문상한).replace(/[^\s<>"',;]+$/, '');
  s = s
    .replace(/<(script|style)\b[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ‹스크립트› ')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, ' ')
    .replace(/<(\/?)([a-zA-Z][\w-]{0,30})[^<>]*>/g, '<$1$2>')
    .replace(/&#?\w{1,10};/g, ' ')
    .replace(비밀칸꼴, '‹가림›')
    .replace(사람칸꼴, '‹이름›')
    .replace(/[a-z][a-z0-9+.-]{0,20}:\/\/[^\s<>"']*/gi, '‹주소›')
    .replace(/(?<![\w/])\/\/[^\s<>"']+/g, '‹주소›')
    .replace(/\b(?:bearer|basic)\s+\S+/gi, '‹가림›')
    .replace(/[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]{1,255}/gu, '‹메일›')
    .replace(/\b\d{6}[\s-]?\d{7}\b/g, '‹번호›')
    .replace(/(?:\+?82[\s.\-)]*|\b0)\d{1,2}[\s.\-)]*\d{3,4}[\s.\-]*\d{4}\b/g, '‹전화›')
    .replace(/\b\d{4}[\s.-]\d{4}\b/g, '‹전화›')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '‹값›')
    .replace(/‹[^›\n]{0,40}›|[\p{L}\p{N}_]+/gu, 낱말)
    .replace(/\s+/g, ' ')
    .replace(/(‹[^›]{1,8}›)(?: ?\1)+/g, '$1')
    .trim();
  return [...s].slice(0, 길이).join('');
}

/** 네트워크 까닭 — 오류 코드 꼴은 그대로, 나머지는 가립니다 */
export function 안전왜(왜) {
  const s = 글로(왜);
  return /^(?:(?:UND_)?ERR_[A-Z0-9_]{1,60}|E[A-Z]{3,20}|[A-Z]+_[A-Z0-9_]{2,60}|TIMEOUT|HTTP \d{3})$/.test(s) ? s : (안전글(s, 80) || '기타');
}

function 머리읽기(headers) {
  try {
    if (!headers || typeof headers.get !== 'function') return null;
    return (이름) => { const v = headers.get(이름); return v == null ? null : 글로(v); };
  } catch { return null; }
}
const 머리칸 = (읽기, 이름) => { try { return 읽기 ? 읽기(이름) : null; } catch { return null; } };

function 항목이름(본문) {
  if (본문.length > 1e6) return [];
  let j;
  try { j = JSON.parse(본문); } catch { return []; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return [];
  return Object.keys(j).slice(0, 항목상한).map((k) => (/^[A-Za-z_][\w.-]{0,39}$/.test(k)
    && !/token|secret|passw|pwd|key|cookie|auth|session|sessid|sig|name|mail|phone|tel|mobile|user/i.test(k) ? k : '‹칸›'));
}

/** 보고의 「못 받은 곳」 한 줄 — 옛 칸(이름·왜)은 그대로이고 실패 칸만 더합니다 */
export const 목록실패줄 = (이름, g) => ({ 이름, 왜: g.err, 실패: g.실패 ?? null });

/** 상세 실패 줄들 → 기관별 건수 · 까닭별 건수 (많은 차례) */
export function 상세실패표(줄들) {
  const 곳 = new Map();
  for (const x of 줄들 || []) {
    const 이름 = 글로(x?.이름) || '이름없음';
    const 왜 = 안전왜(x?.왜);
    const 칸 = 곳.get(이름) || new Map();
    칸.set(왜, (칸.get(왜) || 0) + 1);
    곳.set(이름, 칸);
  }
  const 차례 = (a, b) => b.건수 - a.건수 || String(a.이름 ?? a.왜).localeCompare(String(b.이름 ?? b.왜));
  return [...곳].map(([이름, 칸]) => {
    const 까닭 = [...칸].map(([왜, 건수]) => ({ 왜, 건수 })).sort(차례);
    return { 이름, 건수: 까닭.reduce((n, c) => n + c.건수, 0), 까닭 };
  }).sort(차례);
}

/** 응답 하나 → 보고에 남길 꼴. r = { code, text|html|buf, headers, 왜 } · 던지지 않습니다 */
export function 실패기록(입력) {
  const r = 입력 && typeof 입력 === 'object' ? 입력 : {};
  const 본문 = 글로(r.text || r.html || r.buf);
  const 읽기 = 머리읽기(r.headers);
  const ra = 머리칸(읽기, 'retry-after');
  const sv = 머리칸(읽기, 'server');
  const ct = 머리칸(읽기, 'content-type');
  const ctm = ct && ct.match(/^\s*([a-z0-9!#$&^_.+-]{1,40}\/[a-z0-9!#$&^_.+-]{1,60})(?:\s*;.{0,200}?\bcharset=["']?([\w-]{1,20}))?/i);
  let 머리받음 = !!읽기;
  if (읽기) { try { r.headers.get('server'); } catch { 머리받음 = false; } }
  return {
    http: Number.isInteger(r.code) && r.code >= 100 && r.code <= 599 ? r.code : null,
    왜: r.왜 ? 안전왜(r.왜) : null,
    retryAfter: ra == null ? null
      : (/^(?:\d{1,7}|[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT)$/.test(ra.trim()) ? ra.trim() : '‹가림›'),
    server: sv == null ? null : 안전글(sv, 120),
    contentType: ct == null ? null : (ctm ? ctm[1] + (ctm[2] ? '; charset=' + ctm[2] : '') : '‹가림›'),
    머리받음,                      // false 면 머리 셋의 null 은 「응답에 없음」이 아니라 「못 받음」입니다
    본문자수: 본문.length,
    앞글: 안전글(본문),
    항목이름: 항목이름(본문),
  };
}
