/* 중앙보훈 상세 쪽의 **`fn_fileDownload` 본문을 그 쪽에서 읽습니다**
 *   (2026-10-19 · 두 번째 시도 — 지침 2·3절. 짐작으로 주소를 만들지 않습니다)
 *
 * 1차 시도(중앙보훈_첨부쿠키시험.mjs)는 쿠키를 들고도 **0바이트**였습니다.
 * 2026-10-14 에 playwright 로는 658,469바이트가 왔습니다. 그러면 **맨손 fetch 에
 * 없는 것**이 있습니다 — 그게 무엇인지 쪽에서 직접 읽습니다.
 */
const 상세 = 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=187161';
const 머리 = { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)', 'Accept-Language': 'ko' };

const r = await fetch(상세, { headers: 머리, signal: AbortSignal.timeout(25000) });
const 쿠키 = (r.headers.getSetCookie?.() || []).map((s) => s.split(';')[0]).join('; ');
const 글 = await r.text();
console.log('상세 HTTP ' + r.status + ' · ' + 글.length + '자\n');

/* ① fn_fileDownload 가 쪽 안에 정의돼 있나 */
const 정의 = 글.match(/function\s+fn_fileDownload\s*\([^)]*\)\s*\{[\s\S]{0,700}?\n\s*\}/);
console.log('── ① fn_fileDownload 본문 ──');
console.log(정의 ? 정의[0] : '  쪽 안에 정의가 없습니다 — 밖에서 불러오는 .js 파일일 것입니다');

/* ② 불러오는 스크립트 파일 이름들 */
console.log('\n── ② 불러오는 .js ──');
for (const m of 글.matchAll(/<script[^>]*src="([^"]+)"/g)) console.log('  ' + m[1]);

/* ③ 첨부 자리 주변 HTML 을 그대로 — 폼이 있는지 봅니다 */
const 여 = 글.indexOf('fn_fileDownload');
if (여 > -1) {
  console.log('\n── ③ 첨부 자리 주변 원문 ──');
  console.log(글.slice(Math.max(0, 여 - 500), 여 + 300).replace(/\s+/g, ' '));
}

/* ④ nttFileDownload 라는 글자가 쪽이나 스크립트에 어떻게 쓰이나 */
console.log('\n── ④ nttFileDownload 가 쓰인 자리 ──');
let 셈 = 0;
for (const m of 글.matchAll(/nttFileDownload/g)) {
  console.log('  …' + 글.slice(Math.max(0, m.index - 110), m.index + 110).replace(/\s+/g, ' ') + '…');
  if (++셈 >= 3) break;
}
if (!셈) console.log('  쪽 원문에는 없습니다');

/* ⑤ 밖에서 불러오는 공통 스크립트에서 찾아봅니다 (두 개까지만) */
const 스크립트 = [...글.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1])
  .filter((u) => /common|script|ntt|file/i.test(u)).slice(0, 2);
for (const u of 스크립트) {
  const url = u.startsWith('http') ? u : 'https://www.bohun.or.kr' + (u.startsWith('/') ? u : '/' + u);
  try {
    const rr = await fetch(url, { headers: { ...머리, cookie: 쿠키 }, signal: AbortSignal.timeout(20000) });
    const t = await rr.text();
    const mm = t.match(/function\s+fn_fileDownload\s*\([^)]*\)\s*\{[\s\S]{0,700}?\n\s*\}/);
    console.log('\n── ⑤ ' + u + ' (' + rr.status + ' · ' + t.length + '자) ──');
    console.log(mm ? mm[0] : '  그 함수는 여기에도 없습니다');
  } catch (e) { console.log('\n── ⑤ ' + u + ' — ✗ ' + String(e.message).slice(0, 50)); }
}
