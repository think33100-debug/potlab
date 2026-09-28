/* 받아둔 중간 인증서를 요청에 붙여 줍니다 (2026-09-28).
 *
 *   import { 붙여받기 } from './certs/index.mjs';
 *   const r = await 붙여받기(url, { headers: … });
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────
 * 병원 10곳이 **잎사귀 인증서 한 장만** 보냅니다. 인증서는 멀쩡한데 사슬이
 * 끊겨서 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` 가 납니다.
 * 빠진 중간 인증서를 잎사귀 안 AIA 주소에서 받아 이 폴더에 뒀습니다
 * (`node tools/certs.mjs` 가 받습니다).
 *
 * ── 검증은 안 끕니다 ─────────────────────────────────────────
 * `rejectUnauthorized` 는 늘 true 입니다. 뿌리 묶음에 그 중간 인증서를
 * **더해** 사슬을 잇는 것뿐입니다. 「누가 답하든 받는다」 가 아닙니다.
 *
 * 호스트마다 파일이 하나씩 있습니다 — <호스트>.pem
 */
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

/* 한 번만 읽습니다 */
const 가진것 = new Map();
try {
  for (const f of fs.readdirSync(여기)) {
    if (!f.endsWith('.pem')) continue;
    가진것.set(f.replace(/\.pem$/, ''), fs.readFileSync(path.join(여기, f), 'latin1'));
  }
} catch { /* 폴더가 없으면 그냥 없는 것입니다 */ }

export const 호스트들 = [...가진것.keys()];

/* ── 줄 끝이 망가진 머리글을 보내는 곳 (2026-09-28) ──────────
 * 군산의료원은 `Content-Security-Policy` 를 **여러 줄에 걸쳐 LF 만으로** 내보냅니다.
 * HTTP/1.1 머리글은 줄 끝이 CRLF 여야 해서 node 파서가 `HPE_CR_EXPECTED` 를 냅니다.
 * 앞 500바이트를 16진수로 찍어 확인한 것입니다 —
 *     ... 'unsafe-eval'␊       ← CR 이 없습니다
 *         code.jquery.com␊
 *         fonts.gstatic.com␊
 *         https://t1.kakaocdn.net;...␍␊
 * 서버 설정에 CSP 를 줄바꿈해 적은 것이 그대로 나가는 것입니다. 우리가 고칠 수 없습니다.
 *
 * ⚠ `insecureHTTPParser` 는 **줄 끝만 관용**합니다.
 *    인증서 검증(`rejectUnauthorized`)은 그대로 켠 채입니다 — 끄지 않습니다.
 *    그래도 이름이 그런 것이라 **적은 호스트에만** 켭니다. 전체에 켜지 않습니다. */
const 느슨한파서 = new Set(['www.kunmed.or.kr']);

/** 이 호스트에 붙일 인증서가 있나 */
export function 있나(호스트) { return 가진것.has(String(호스트 || '')); }

/**
 * 인증서를 붙여 받습니다. 없으면 그냥 fetch 와 같습니다.
 * 돌려주는 것 { code, buf, headers, 왜 } — 던지지 않습니다.
 */
export async function 붙여받기(url, opt) {
  let u;
  try { u = new URL(url); } catch { return { 왜: '주소가 아닙니다' }; }
  const pem = 가진것.get(u.hostname);
  const 느슨 = 느슨한파서.has(u.hostname);

  /* ⚠ **`http://` 주소를 https.request 로 보내고 있었습니다** (2026-09-28 에 찾음).
     조건이 `u.protocol === 'https:'` 여서, http 주소는 평범한 fetch 를 건너뛰고
     아래 https.request(443포트)로 갔습니다. 그래서 병원 5곳이
     `ERR_TLS_CERT_ALTNAME_INVALID` · `DEPTH_ZERO_SELF_SIGNED_CERT` 로 나왔는데
     **평범하게 받으면 HTTP 200 이었습니다** —
       김해복음병원 · 무안병원 · 포천우리병원 · 전주고려병원 · 뉴성민병원
     (인증서가 딴 도메인 것이거나 자체 서명인데, 우리는 http 로 부르고 있었습니다) */
  if (u.protocol !== 'https:') {
    try {
      const r = await fetch(url, opt);
      return { code: r.status, buf: Buffer.from(await r.arrayBuffer()), headers: r.headers, url: r.url };
    } catch (e) { return { 왜: String(e && (e.cause?.code || e.name || e.message)).slice(0, 60) }; }
  }

  /* https 인데 붙일 것도 없으면 먼저 평범하게 받아 봅니다 */
  if (!pem && !느슨) {
    try {
      const r = await fetch(url, opt);
      return { code: r.status, buf: Buffer.from(await r.arrayBuffer()), headers: r.headers, url: r.url };
    } catch (e) {
      const 왜 = String(e && (e.cause?.code || e.name || e.message));
      /* SSL 쪽 까닭이면 **옛 암호를 허용해** 한 번 더 해 봅니다.
         검증은 그대로 켠 채입니다 — 암호 목록만 넓힙니다.
         광혜병원(ERR_SSL_DH_KEY_TOO_SMALL) · 평택성모병원이 이걸로 열립니다 */
      if (!/SSL|TLS|CERT|DH_KEY|EPROTO/i.test(왜)) return { 왜: 왜.slice(0, 60) };
    }
  }

  return new Promise((done) => {
    const 머리 = (opt && opt.headers) || {};
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      headers: { ...머리, Host: u.hostname }, servername: u.hostname,
      rejectUnauthorized: true,                              // ← 끄지 않습니다
      ...(pem ? { ca: [...tls.rootCertificates, pem] } : {}),  // ← 사슬만 이어줍니다
      ...(느슨 ? { insecureHTTPParser: true } : {}),           // ← 줄 끝만 관용 (군산의료원)
      ciphers: 'DEFAULT@SECLEVEL=1', minVersion: 'TLSv1',
    }, (res) => {
      /* 자리 옮김을 한 번 따라갑니다 */
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const 다음 = new URL(res.headers.location, url).toString();
        return done(붙여받기(다음, opt));
      }
      const 덩이 = [];
      res.on('data', (c) => 덩이.push(c));
      res.on('end', () => done({ code: res.statusCode, buf: Buffer.concat(덩이),
        headers: { get: (k) => res.headers[String(k).toLowerCase()] }, url }));
    });
    req.on('error', (e) => done({ 왜: e.code || e.message }));
    req.setTimeout((opt && opt.timeout) || 20000, () => { req.destroy(); done({ 왜: 'TIMEOUT' }); });
    req.end();
  });
}

/**
 * 받아서 **글자로** 돌려줍니다 — 중간 인증서 붙이기 + 인코딩 읽기까지.
 *
 * 이 다섯 줄짜리 인코딩 코드가 `hs_run` `hs_census` `hs_pages` `probe-pages`
 * 네 군데에 베껴져 있었습니다. 강동경희대 글 수가 0으로 나온 것도
 * 그중 한 군데가 EUC-KR 을 안 본 탓이었습니다. 한 벌로 모읍니다 (2026-09-28).
 *
 * `enc` 를 주면 그걸 씁니다 (사이트 설정의 `s.enc`).
 * 돌려주는 것 { code, html, cs, 바이트, buf, 왜 } — 던지지 않습니다.
 */
export async function 글받기(url, opt) {
  const o = opt || {};
  const g = await 붙여받기(url, { headers: o.headers || {}, timeout: o.timeout });
  if (g.왜) return { 왜: g.왜 };
  const ct = (g.headers && g.headers.get('content-type')) || '';
  /* 머리글 → <meta> 차례로 봅니다. EUC-KR 쪽이 아직 많습니다 */
  let cs = o.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
    || (g.buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
  let html;
  try { html = new TextDecoder(cs.toLowerCase()).decode(g.buf); }
  catch { html = g.buf.toString('utf8'); cs += '(못 읽어 utf-8)'; }
  return { code: g.code, html, cs, 바이트: g.buf.length, buf: g.buf };
}
