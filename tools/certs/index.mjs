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
  if (!pem && u.protocol === 'https:') {
    /* 붙일 것이 없으면 평범하게 */
    try {
      const r = await fetch(url, opt);
      return { code: r.status, buf: Buffer.from(await r.arrayBuffer()), headers: r.headers, url: r.url };
    } catch (e) { return { 왜: String(e && (e.cause?.code || e.name || e.message)).slice(0, 60) }; }
  }

  return new Promise((done) => {
    const 머리 = (opt && opt.headers) || {};
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      headers: { ...머리, Host: u.hostname }, servername: u.hostname,
      rejectUnauthorized: true,                              // ← 끄지 않습니다
      ca: [...tls.rootCertificates, pem],                    // ← 사슬만 이어줍니다
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
