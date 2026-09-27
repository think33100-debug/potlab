/* SSL 때문에 안 열리는 곳을 **인증서 검증을 끄지 않고** 열어봅니다 (2026-09-27).
 *
 *   node tools/hosp/ssl_test.mjs
 *
 * ── 왜 검증을 끄지 않나 ──────────────────────────────────────
 * `rejectUnauthorized: false` 는 「누가 답하든 받는다」 는 뜻입니다.
 * 중간에 누가 끼어들어 다른 내용을 줘도 알 수 없습니다. 공고를 받아 회원에게
 * 보여주는 자리라 그건 안 됩니다.
 *
 * ── 대신 하는 것 ─────────────────────────────────────────────
 *   ① ERR_SSL_DH_KEY_TOO_SMALL — 서버가 낡은 DH 열쇠를 씁니다.
 *      **그 호스트에만** 보안 등급을 낮춥니다 (`@SECLEVEL=1`).
 *      인증서 검증은 그대로 켜 둡니다.
 *   ② UNABLE_TO_VERIFY_LEAF_SIGNATURE — 서버가 **중간 인증서를 안 보냅니다.**
 *      뿌리 인증서는 멀쩡한데 사슬이 끊긴 것입니다.
 *      node 가 들고 있는 뿌리 묶음에 더해 **사슬을 이어 받아** 봅니다.
 *      여기서는 「무엇이 빠졌나」 만 알려줍니다 — 중간 인증서를 넣는 것은 다음 걸음입니다.
 *
 * gas(구글 서버)에서는 둘 다 못 합니다. 그래서 이 곳들은 node 쪽 수집으로 갑니다.
 */
import fs from 'node:fs';
import https from 'node:https';
import tls from 'node:tls';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';

const GAS = fs.readFileSync(new URL('../../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const HOSP_SITES = [');
let d = 0, end = -1;
for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
  if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
}
const SITES = new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();

/* 지난번에 못 받은 16곳 */
const 이름들 = ['동래봉생병원', '동수원병원', '경상국립대학교병원', '지샘병원', '광혜병원',
  '김포우리병원', '제주한라병원', '해동병원', '중앙제일병원', '군산의료원', '안양샘병원',
  '세명종합병원', '안동성소병원', '대전선병원', '유성선병원'];
const 볼것 = [];
for (const n of 이름들) {
  const 걸림 = SITES.filter((s) => s.name.includes(n) && s.url);
  걸림.forEach((s) => { if (!볼것.some((x) => x.url === s.url)) 볼것.push(s); });
}

function 받기(url, 옵션) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ 왜: '주소가 아닙니다' }); }
    const req = https.request({
      host: u.hostname, port: u.port || 443, path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': UA, Host: u.hostname, 'Accept-Language': 'ko' },
      servername: u.hostname,
      /* 인증서 검증은 **켠 채로** 둡니다 */
      rejectUnauthorized: true,
      ...옵션,
    }, (res) => {
      let n = 0;
      res.on('data', (c) => { n += c.length; });
      res.on('end', () => resolve({ code: res.statusCode, 바이트: n }));
    });
    req.on('error', (e) => resolve({ 왜: e.code || e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ 왜: 'TIMEOUT' }); });
    req.end();
  });
}

const 일층 = /대학교병원|의료원|국립|시립|도립|보훈|산재|근로복지|적십자|보건소|센터/;
console.log('볼 곳 ' + 볼것.length + '곳\n');
console.log('기관'.padEnd(30) + '1층  그냥        등급낮춤     사슬이어');
const 결과 = [];
for (const s of 볼것) {
  const a = await 받기(s.url);
  /* ① 보안 등급만 낮춥니다 (검증은 켠 채로) */
  const b = a.code ? null : await 받기(s.url, { ciphers: 'DEFAULT@SECLEVEL=1', minVersion: 'TLSv1' });
  /* ② 중간 인증서가 빠진 경우 — node 뿌리 묶음에 시스템 것을 더해 봅니다 */
  const c = (a.code || (b && b.code)) ? null
    : await 받기(s.url, { ca: [...tls.rootCertificates], ciphers: 'DEFAULT@SECLEVEL=1', minVersion: 'TLSv1' });
  const 칸 = (x) => x ? (x.code ? 'HTTP ' + x.code : String(x.왜).slice(0, 11)) : '-';
  const 열림 = a.code || (b && b.code) || (c && c.code);
  결과.push({ 이름: s.name, url: s.url, 그냥: 칸(a), 등급낮춤: 칸(b), 사슬: 칸(c), 열림: !!열림 });
  console.log((열림 ? '○ ' : '✗ ') + s.name.slice(0, 26).padEnd(28)
    + (일층.test(s.name) ? '예 ' : '－ ') + 칸(a).padEnd(12) + 칸(b).padEnd(12) + 칸(c));
  await new Promise((x) => setTimeout(x, 400));
}
const 열린것 = 결과.filter((r) => r.열림);
console.log('\n── ' + 결과.length + '곳 중 열린 곳 ' + 열린것.length + ' · 아직 안 열린 곳 ' + (결과.length - 열린것.length));
console.log('   인증서 검증은 한 곳도 끄지 않았습니다');
fs.writeFileSync(new URL('./reports/ssl_test.json', import.meta.url), JSON.stringify(결과, null, 1), 'utf8');
