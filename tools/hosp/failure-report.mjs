/* 병원 수집 실패 응답 기록 (멘토-2차-02-2) — 진단만 합니다.
 * 네트워크를 타지 않고, 수집 판단·쪽 넘김·동시 수·재시도를 바꾸지 않습니다.
 *
 * ── 글이 두 벌입니다. 섞지 마십시오 ───────────────────────────
 * ① 안전글 · 앞글 — 「안전한 투영」입니다. **공개 자리(옛 요약 err·왜 → 곳별 → 아침 재기,
 *    DB 보류사유, 콘솔)** 는 이쪽만 씁니다. 자유 글 속 사람 이름은 정규식으로 알아낼 수
 *    없어서 **아는 낱말만 남기고 나머지를 가립니다.** 대신 처음 보는 오류 문구가 사라집니다.
 *    Content-Type 과 JSON 항목 이름도 같습니다 — 목록에 있는 값만 남습니다.
 * ② 비공개글 · 비공개앞글 — **원문 앞 1,200자에서 비밀만 찍어 가립니다** (Q66 · 진단 충실도).
 *    열쇠·토큰·쿠키·메일·전화·주민번호 꼴·아이피·주소의 사용자정보와 쿼리·이름/연락처 **칸**을
 *    가립니다. ★ **자유 글 속 이름은 가리지 못합니다.** 안전하다는 뜻이 아니라, 저장소에
 *    안 올라가는 보고 파일 tools/hosp/reports/collect-hosp.json 에만 두기로 한 것입니다.
 *    커밋 · PR · Slack · 아침 재기 · 회원 화면 · DB 로 옮기지 마십시오.
 *    err · 왜 · 상세왜 에 이어 붙이면 그 자리들로 샙니다 (시험이 막습니다).
 * 순서: 둘 다 가리기 → 자르기. 값이 자르는 자리에 걸쳐도 앞조각이 안 남습니다.
 */

/* 지침 2절(원문 500~1,200자) 안에서 고른 앞글 길이 */
export const 본문길이 = 800;
export const 비공개길이 = 1200;
const 원문상한 = 32000;   // 가리기 전 앞자르기 — 큰 응답에서도 정규식 시간을 묶습니다
const 항목상한 = 40;

const 아는형식 = new Set(`text/html text/plain text/xml text/css text/javascript text/csv
application/json application/xml application/xhtml+xml application/javascript application/octet-stream
application/pdf application/x-www-form-urlencoded application/problem+json application/problem+xml
multipart/form-data image/png image/jpeg image/gif image/webp image/svg+xml`.split(/\s+/));
const 아는문자셋 = new Set(['utf-8', 'utf8', 'euc-kr', 'euckr', 'ks_c_5601-1987', 'cp949', 'x-windows-949', 'windows-949',
  'iso-8859-1', 'us-ascii']);
/* JSON 항목 이름 — 사람 이름·번호가 열쇠로 올 수 있어 아는 진단 칸만 남깁니다 (대소문자까지 같아야 합니다) */
const 진단칸 = new Set(['message', 'msg', 'error', 'errors', 'code', 'status', 'statusCode', 'result', 'results', 'success',
  'data', 'list', 'rows', 'items', 'total', 'count', 'page', 'pageUtil', 'recordCount', 'timestamp', 'path', 'detail', 'title',
  'recruitAnnouncementListMain']);

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

/* ── 비공개글 — 칸 이름은 남기고 값만 가립니다 ── */
const 비밀낱말 = 'authorization|cookie|token|secret|password|passwd|pwd|key|session|sessid|sid|signature|sig|auth|csrf|xsrf|jwt|credential';
const 사람낱말 = '담당|성명|이름|주민|연락처|전화|휴대|핸드폰|이메일|메일|사번|아이디|주소|e-?mail|name|user|phone|tel|mobile|address';
const 칸값 = String.raw`\\{0,3}"[^"\\]*(?:\\[\s\S][^"\\]*)*"?|\\{0,3}'[^'\\]*(?:\\[\s\S][^'\\]*)*'?`
  + String.raw`|(?:-?\d[\d.]*|true|false|null)(?=\s*[,}\]])`;
/* 따옴표 없는 값 — 「칸: 값」 은 줄 끝까지(Cookie: a=1; b=2), 「칸=값」 은 구분 글자까지(?token=a&x=1 뒤 진단) */
const 값칸꼴 = (칸, 구분, 끝) => new RegExp(String.raw`(?<![\w-])(${칸})(\\{0,3}["']?\s*${구분}\s*)(?:${칸값}|${끝})`, 'giu');
const 비밀칸글 = String.raw`[\w-]{0,32}?(?:${비밀낱말})[\w-]{0,16}|비밀번호|암호|토큰|인증키`;
const 비공개비밀쌍점 = 값칸꼴(비밀칸글, ':', String.raw`[^\n<]*`);
const 비공개비밀등호 = 값칸꼴(비밀칸글, '=', String.raw`[^\s&;,<"']*`);
/* 복합 사람 칸 — 칸 앞에 글자가 붙으면 값칸꼴의 앞 울타리에 걸리므로 이름째 적습니다 (태그 칸과 한 자리) */
const 복합사람칸 = String.raw`(?:contact|person|manager|first|last|full|sender)[_-]?name|(?:tele|cell)phone`;
/* name 은 태그 속성(<meta name="description">)이면 안 가립니다 — 그 자리의 값은 민감입력칸이 봅니다 */
const 비공개사람칸 = 값칸꼴(String.raw`담당자?|성명|이름|주민(?:등록)?(?:번호)?|연락처|전화(?:번호)?|휴대(?:폰|전화)?|핸드폰|이메일|사번|아이디|주소|e-?mail|(?<!<[a-z][^<>]{0,300})name|user(?:[_-]?(?:name|id))?|phone|tel|mobile|address|${복합사람칸}`,
  '[:=]', String.raw`[^\n<]*`);
const 표칸꼴 = /(담당자?|성명|이름|연락처|전화(?:번호)?|휴대(?:폰|전화)?|핸드폰|이메일|주소)(\s*(?:<[^<>]{0,60}>\s*){1,6})([^<\n]{1,120})/gu;
const 민감이름꼴 = new RegExp(String.raw`\b(?:name|id|property)\s*=\s*["']?[^"'\s>]*(?:${비밀낱말}|${사람낱말})`, 'i');
/* XML 태그 칸 <token>값</token> — 안쪽 태그째 가립니다. 안 닫혔으면 이어지는 태그와 글까지 가립니다.
   비밀 낱말은 글자 일부로도 잡으므로 aside(sid) · keygen(key) 같은 보통 태그는 뺍니다 */
const 태그칸꼴 = (칸) => new RegExp(String.raw`<((?:[\w.-]+:)?(?:${칸}))(\s[^<>]*?)?(?:/>|>(?:[\s\S]{0,8000}?(</\1\s*>)|(?:\s*<[^<>]*>)*[^<]*))`, 'giu');
const 비밀태그칸 = 태그칸꼴(String.raw`(?!aside\b|keygen\b)(?:${비밀칸글})`);
const 사람태그칸 = 태그칸꼴(String.raw`(?:[\w.-]*[_-])?(?:담당자?|성명|이름|주민(?:등록)?(?:번호)?|연락처|전화(?:번호)?|휴대(?:폰|전화)?|핸드폰|이메일|사번|아이디|주소|e-?mail|mail|name|user(?:name|id)?|phone|tel|mobile|address)(?:[_-][\w.-]*)?|${복합사람칸}`);
const 태그값가림 = (표) => (m, 이름, 속성, 닫음) => {
  const 속 = 속성 ? ' ‹가림›' : '';
  return m.endsWith('/>') && !닫음 ? `<${이름}${속}/>` : `<${이름}${속}>${표}${닫음 || ''}`;
};

function 풀기(s) {
  return s
    .normalize('NFKC')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(quot|amp|apos|lt|gt|nbsp));/gi, (m, 십, 육, 이름) => {
      if (이름) return { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[이름.toLowerCase()];
      const n = 십 ? Number(십) : parseInt(육, 16);
      return n <= 0x10FFFF ? String.fromCodePoint(n) : m;
    })
    .normalize('NFKC');
}

/* 호스트 · 경로는 진단에 쓰므로 남깁니다. 사용자정보 · 쿼리 · 조각 · 경로 인자만 가립니다 */
function 주소가림(m) {
  const x = m.match(/^((?:[a-z][a-z0-9+.-]*:)?\/\/)(?:[^/?#]*@)?([^/?#;]*)([^?#;]*)([\s\S]*)$/i);
  return x ? x[1] + x[2] + x[3] + (x[4] ? '‹가림›' : '') : '‹주소›';
}

/** 원문 앞 1,200자 · 찍어서 가립니다. **자유 글 속 이름은 남습니다** (머리 주석). 던지지 않습니다. */
export function 비공개글(값, 길이 = 비공개길이) {
  try {
    let s = 글로(값);
    /* 앞자르기 자리에 걸친 값(띄어 쓴 전화 등)은 조각째 버립니다 */
    if (s.length > 원문상한) s = s.slice(0, 원문상한).replace(/[^\n<>]{0,64}$/, '');
    s = 풀기(s)
      .replace(/<(?:input|meta)\b[^<>]*>/gi, (태그) => (민감이름꼴.test(태그)
        ? 태그.replace(/\b(value|content)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1=‹가림›') : 태그))
      .replace(비밀태그칸, 태그값가림('‹가림›'))
      .replace(사람태그칸, 태그값가림('‹이름›'))
      .replace(/\b(?:bearer|basic)\s+\S+/gi, '‹가림›')
      .replace(비공개비밀쌍점, '$1$2‹가림›')
      .replace(비공개비밀등호, '$1$2‹가림›')
      .replace(비공개사람칸, '$1$2‹이름›')
      .replace(표칸꼴, '$1$2‹이름›')
      .replace(/[a-z][a-z0-9+.-]{0,20}:\/\/[^\s<>"']*/gi, 주소가림)
      .replace(/(?<![\w/:])\/\/[^\s<>"']+/g, 주소가림)
      .replace(/[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}.-]{1,255}/gu, '‹메일›')
      .replace(/\b\d{6}[\s-]?\d{7}\b/g, '‹번호›')
      .replace(/(?:\+?82[\s.\-)]*|\b0)\d{1,2}[\s.\-)]*\d{3,4}[\s.\-]*\d{4}\b/g, '‹전화›')
      .replace(/\b\d{4}[\s.-]\d{4}\b/g, '‹전화›')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '‹값›')
      .replace(/\beyJ[\w-]+(?:\.[\w-]+){0,2}/g, '‹가림›')
      .replace(/(?<![\w-])(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{32,}(?![\w-])/g, '‹가림›')
      .replace(/\s+/g, ' ')
      .trim();
    return [...s].slice(0, 길이).join('');
  } catch { return ''; }
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
  return Object.keys(j).slice(0, 항목상한).map((k) => (진단칸.has(k) ? k : '‹칸›'));
}

/* 아는 값만 남깁니다 — 모르는 MIME 은 통째로, 모르는 charset 은 그 값만 가립니다 */
function 안전형식(ct) {
  const 형식 = (ct.match(/^\s*([^\s;]{1,100})\s*(?:;|$)/) || [])[1]?.toLowerCase();
  if (!아는형식.has(형식)) return '‹가림›';
  const cs = (ct.match(/;\s*charset\s*=\s*["']?([^"'\s;]{1,40})/i) || [])[1]?.toLowerCase();
  if (!cs) return 형식;
  return 형식 + '; charset=' + (아는문자셋.has(cs) ? cs : '‹가림›');
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
  let 머리받음 = !!읽기;
  if (읽기) { try { r.headers.get('server'); } catch { 머리받음 = false; } }
  return {
    http: Number.isInteger(r.code) && r.code >= 100 && r.code <= 599 ? r.code : null,
    왜: r.왜 ? 안전왜(r.왜) : null,
    retryAfter: ra == null ? null
      : (/^(?:\d{1,7}|[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT)$/.test(ra.trim()) ? ra.trim() : '‹가림›'),
    server: sv == null ? null : 안전글(sv, 120),
    contentType: ct == null ? null : 안전형식(ct),
    머리받음,                      // false 면 머리 셋의 null 은 「응답에 없음」이 아니라 「못 받음」입니다
    본문자수: 본문.length,
    앞글: 안전글(본문),
    비공개앞글: 비공개글(본문),      // ★ 보고 파일 전용 — 머리 주석을 보십시오
    항목이름: 항목이름(본문),
  };
}
