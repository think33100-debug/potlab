/* 빠진 중간 인증서를 받아 두고, 그걸로 열리는지 시험합니다 (2026-09-28).
 *
 *   node tools/certs.mjs            SSL 로 안 열리던 곳 전부
 *   node tools/certs.mjs 경상국립     이름에 그 말이 든 곳만
 *
 * ── 왜 검증을 끄지 않나 ──────────────────────────────────────
 * `rejectUnauthorized: false` 는 「누가 답하든 받는다」 는 뜻입니다.
 * 중간에 누가 끼어들어 다른 내용을 줘도 알 수 없습니다.
 * 공고를 받아 회원에게 보여주는 자리라 그건 안 됩니다.
 *
 * ── 그럼 무엇이 문제인가 ─────────────────────────────────────
 * `UNABLE_TO_VERIFY_LEAF_SIGNATURE` 는 **서버가 중간 인증서를 안 보내서**
 * 사슬이 끊긴 것입니다. 인증서 자체는 멀쩡합니다.
 *   경상국립대  잎사귀 1장만 · 발급자 「TuringSign RSA Secure CA 2」
 *   제주한라    잎사귀 1장만 · 발급자 「Sectigo … CA OV R36」
 *
 * ── 어디서 받나 — **짐작하지 않습니다** ──────────────────────
 * 잎사귀 인증서 안에 **AIA(Authority Information Access)** 칸이 있고
 * 거기에 `CA Issuers - URI` 로 중간 인증서 주소가 적혀 있습니다.
 * 그 주소를 그대로 따라갑니다. 우리가 주소를 만들지 않습니다.
 *
 * 받은 것은 `tools/certs/<호스트>.pem` 에 둡니다. 저장소에 올려도 됩니다 —
 * 공개 인증서이고 비밀이 아닙니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 둘곳 = path.join(여기, 'certs');
fs.mkdirSync(둘곳, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';

/* SSL 로 안 열리던 곳 — hs_census 가 남긴 기록에서 이름을 가져옵니다 */
const 찾을말 = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const GAS = fs.readFileSync(new URL('../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const HOSP_SITES = [');
let d = 0, end = -1;
for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
  if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
}
const SITES = new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();
const 이름들 = ['경상국립대학교병원', '제주한라병원', '동래봉생병원', '동수원병원',
  '중앙제일병원', '세명종합병원', '안동성소병원', '대전선병원', '유성선병원'];
const 볼것 = [];
for (const n of (찾을말.length ? 찾을말 : 이름들)) {
  for (const s of SITES.filter((x) => x.name.includes(n) && x.url)) {
    let h; try { h = new URL(s.url).hostname; } catch { continue; }
    if (!볼것.some((x) => x.host === h)) 볼것.push({ 이름: s.name, host: h, url: s.url });
  }
}

const 일층 = /대학교병원|의료원|국립|시립|도립|보훈|산재|근로복지|적십자|보건소/;

/** 잎사귀에서 AIA 의 중간 인증서 주소를 읽습니다 */
function 사슬보기(host) {
  return new Promise((done) => {
    /* ⚠ **여기서만** 검증을 끕니다 — 인증서를 **읽기 위해서**입니다.
       이 연결로는 어떤 자료도 받지 않습니다. 아래 시험은 검증을 켠 채로 합니다 */
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const c = s.getPeerCertificate(true);
      const aia = (c && c.infoAccess && (c.infoAccess['CA Issuers - URI'] || [])) || [];
      let n = 0, cur = c, 장수 = 0;
      while (cur && n++ < 6) { 장수++; if (!cur.issuerCertificate || cur.issuerCertificate === cur) break; cur = cur.issuerCertificate; }
      done({ 주체: (c && c.subject && c.subject.CN) || '?', 발급: (c && c.issuer && c.issuer.CN) || '?', 장수, aia });
      s.end();
    });
    s.on('error', (e) => done({ 왜: e.code || e.message }));
    s.setTimeout(12000, () => { s.destroy(); done({ 왜: 'TIMEOUT' }); });
  });
}

/** 중간 인증서를 내려받아 PEM 으로 */
async function 중간받기(uri) {
  const r = await fetch(uri, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const t = buf.toString('latin1');
  if (t.includes('-----BEGIN CERTIFICATE-----')) return t;   // 이미 PEM
  /* DER → PEM */
  const b64 = buf.toString('base64').replace(/(.{64})/g, '$1\n');
  return '-----BEGIN CERTIFICATE-----\n' + b64 + '\n-----END CERTIFICATE-----\n';
}

/** 검증을 **켠 채로** 열리는지 시험합니다 */
function 열어보기(url, ca) {
  return new Promise((done) => {
    let u; try { u = new URL(url); } catch { return done({ 왜: '주소가 아닙니다' }); }
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': UA, Host: u.hostname }, servername: u.hostname,
      rejectUnauthorized: true,                    // ← 켠 채로
      ...(ca ? { ca } : {}),
      ciphers: 'DEFAULT@SECLEVEL=1', minVersion: 'TLSv1',
    }, (res) => {
      let n = 0;
      res.on('data', (c) => { n += c.length; });
      res.on('end', () => done({ code: res.statusCode, 바이트: n }));
    });
    req.on('error', (e) => done({ 왜: e.code || e.message }));
    req.setTimeout(20000, () => { req.destroy(); done({ 왜: 'TIMEOUT' }); });
    req.end();
  });
}

console.log('볼 곳 ' + 볼것.length + '곳\n');
const 결과 = [];
for (const x of 볼것) {
  const 그냥 = await 열어보기(x.url);
  if (그냥.code) {
    결과.push({ ...x, 상태: '그냥 열림', code: 그냥.code });
    console.log('○ ' + x.이름.slice(0, 24).padEnd(26) + (일층.test(x.이름) ? '1층 ' : '－  ') + '그냥 열림 (HTTP ' + 그냥.code + ')');
    continue;
  }
  const c = await 사슬보기(x.host);
  if (c.왜) {
    결과.push({ ...x, 상태: '못 붙음', 왜: c.왜 });
    console.log('✗ ' + x.이름.slice(0, 24).padEnd(26) + (일층.test(x.이름) ? '1층 ' : '－  ') + '못 붙음 · ' + c.왜);
    continue;
  }
  if (!c.aia.length) {
    결과.push({ ...x, 상태: '중간 주소 없음', 발급: c.발급 });
    console.log('✗ ' + x.이름.slice(0, 24).padEnd(26) + (일층.test(x.이름) ? '1층 ' : '－  ')
      + '잎사귀에 중간 인증서 주소(AIA)가 없습니다 · 발급자 ' + c.발급);
    continue;
  }
  let pem = null, 받은곳 = '';
  for (const uri of c.aia) {
    try { pem = await 중간받기(uri); 받은곳 = uri; break; } catch (e) { /* 다음 주소 */ }
  }
  if (!pem) {
    결과.push({ ...x, 상태: '중간 못 받음', aia: c.aia });
    console.log('✗ ' + x.이름.slice(0, 24).padEnd(26) + '중간 인증서를 못 받았습니다 · ' + c.aia.join(' '));
    continue;
  }
  const 파일 = path.join(둘곳, x.host + '.pem');
  fs.writeFileSync(파일, pem, 'latin1');
  const 다시 = await 열어보기(x.url, [...tls.rootCertificates, pem]);
  결과.push({ ...x, 상태: 다시.code ? '중간 붙여 열림' : '아직 안 열림',
    code: 다시.code, 왜: 다시.왜, 받은곳, 발급: c.발급 });
  console.log((다시.code ? '★ ' : '✗ ') + x.이름.slice(0, 24).padEnd(26)
    + (일층.test(x.이름) ? '1층 ' : '－  ')
    + (다시.code ? '중간 붙여 열림 (HTTP ' + 다시.code + ')' : '아직 안 열림 · ' + 다시.왜)
    + '   ' + path.basename(파일));
  await new Promise((y) => setTimeout(y, 400));
}

const 열림 = 결과.filter((r) => /열림/.test(r.상태));
console.log('\n── ' + 결과.length + '곳 중 열린 곳 ' + 열림.length + ' · 아직 ' + (결과.length - 열림.length));
console.log('   인증서 검증은 한 곳도 끄지 않았습니다 (사슬을 읽을 때만 껐고, 그 연결로는 자료를 안 받습니다)');
fs.writeFileSync(path.join(여기, 'hosp', 'reports', 'certs.json'), JSON.stringify(결과, null, 1), 'utf8');
