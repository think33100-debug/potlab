/* 중앙보훈 첨부 — **Synap 길**을 한 번 두드립니다 (2026-10-19 · 마지막 시도)
 *
 * 1차 — `/common/nttFileDownload.do?fileKey=…&bbsSysId=seoul` 쿠키 있/없 둘 다 **0바이트**
 * 2차 — 쪽의 `fn_fileDownload` 본문을 읽었습니다. 주소는 맞았습니다 (그냥 GET)
 *       그러면서 **다른 길**을 봤습니다 —
 *         jsonData.urlPath + '/common/nttFileDownloadForSynap.do?synap=Y&fileKey=' + fileKey
 *       그 앞에 ajax 가 하나 있습니다. 그 ajax 주소를 쪽에서 읽어 두드립니다.
 *
 * ★ 이것으로 멈춥니다 (지침 3절 — 두 번 실패하면 명세를 요청).
 */
const 상세 = 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=187161';
const 머리 = { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' };

const r = await fetch(상세, { headers: 머리, signal: AbortSignal.timeout(25000) });
const 쿠키 = (r.headers.getSetCookie?.() || []).map((s) => s.split(';')[0]).join('; ');
const 글 = await r.text();
const fileKey = (글.match(/fn_fileDownload\s*\(\s*['"]([^'"]+)['"]/) || [])[1];
console.log('상세 ' + r.status + ' · fileKey ' + fileKey + '\n');

/* ① Synap 쪽 코드를 넉넉히 찍습니다 — ajax 주소를 눈으로 봅니다 (지침 2절) */
const 여 = 글.indexOf('nttFileDownloadForSynap');
console.log('── ① Synap 자리 원문 ──');
console.log(글.slice(Math.max(0, 여 - 1400), 여 + 400).replace(/\s+/g, ' '));

/* ② 거기서 보이는 ajax url 을 집습니다 — 짐작하지 않고 **그 글자**를 씁니다 */
const 토막 = 글.slice(Math.max(0, 여 - 1400), 여 + 400);
const ajax = [...토막.matchAll(/url\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]);
console.log('\n── ② 그 자리의 ajax url ──\n  ' + (ajax.join('\n  ') || '없습니다'));

const 앞글자 = (b) => {
  const s = Buffer.from(b).subarray(0, 5).toString('latin1');
  return s.startsWith('%PDF-') ? 'PDF' : s.startsWith('PK\u0003\u0004') ? 'zip/hwpx'
    : /^\s*<(!doctype|html|\?xml)/i.test(Buffer.from(b).subarray(0, 40).toString('utf8')) ? 'HTML/XML'
    : s.replace(/[^\x20-\x7e]/g, '.');
};

/* ③ 그 ajax 를 두드려 urlPath 를 받습니다 */
for (const u of ajax.slice(0, 2)) {
  const url = u.startsWith('http') ? u : 'https://www.bohun.or.kr' + (u.startsWith('/') ? u : '/' + u);
  for (const 법 of ['POST', 'GET']) {
    try {
      const rr = await fetch(url + (법 === 'GET' ? (url.includes('?') ? '&' : '?') + 'fileKey=' + fileKey : ''), {
        method: 법,
        headers: { ...머리, cookie: 쿠키, referer: 상세,
          ...(법 === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
        ...(법 === 'POST' ? { body: 'fileKey=' + encodeURIComponent(fileKey) + '&bbsSysId=seoul' } : {}),
        signal: AbortSignal.timeout(20000),
      });
      const t = await rr.text();
      console.log('\n── ③ ' + 법 + ' ' + u + ' — ' + rr.status + ' · ' + t.length + '자');
      console.log('   ' + t.replace(/\s+/g, ' ').slice(0, 300));
      const p = (t.match(/"urlPath"\s*:\s*"([^"]*)"/) || [])[1];
      if (p) {
        const dw = p + '/common/nttFileDownloadForSynap.do?synap=Y&fileKey=' + fileKey;
        const r3 = await fetch(dw, { headers: { ...머리, cookie: 쿠키, referer: 상세 }, signal: AbortSignal.timeout(30000) });
        const b = await r3.arrayBuffer();
        console.log('   ★ ' + dw.slice(0, 110));
        console.log('     HTTP ' + r3.status + ' · **' + b.byteLength + '바이트** · ' + 앞글자(b));
      }
    } catch (e) { console.log('\n── ③ ' + 법 + ' ' + u + ' — ✗ ' + String(e.message).slice(0, 50)); }
  }
}
