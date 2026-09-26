/* HOSP_SITES 에 이미 들어 있는 곳을 **지금 긁어봅니다** (2026-09-26).
 *
 *   node tools/hosp/hs_run.mjs 한림 순천향        이름에 그 말이 든 곳
 *   node tools/hosp/hs_run.mjs --제목 5 한림       뽑힌 제목을 5개까지 찍습니다
 *
 * ── 왜 있나 ────────────────────────────────────────────────
 * 「공고 0건」 은 두 가지 뜻입니다 —
 *   ① 긁었는데 우리 직군이 없었다
 *   ② 아예 안 긁혔다 (주소가 틀렸거나 규칙이 안 맞거나)
 * `site_checks`·`site_state` 는 **꺼진 곳만** 담아서 이걸 못 가립니다.
 * 그래서 직접 긁어 「목록에서 몇 줄이 나오나 · 그중 우리 직군이 몇 줄인가」 를 셉니다.
 *
 * 규칙은 `hs_test.js` 의 `hospParseHtml` 을 **그대로 빌려 씁니다.**
 * Apps Script 의 `hospParseHtml_` 과 같은 것이라 여기서 다시 만들지 않습니다.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hs_test.js');
import { matchJob, notOurs } from '../gas-rules.mjs';

const argv = process.argv.slice(2);
const 제목수 = argv.includes('--제목') ? Number(argv[argv.indexOf('--제목') + 1]) || 5 : 0;
const 찾을말 = argv.filter((x, i) => !x.startsWith('--') && argv[i - 1] !== '--제목');

/* HOSP_SITES 를 gas 에서 그대로 떼어 옵니다 (베끼지 않습니다) */
const GAS = fs.readFileSync(new URL('../../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const HOSP_SITES = [');
let d = 0, end = -1;
for (let k = GAS.indexOf('[', i0); k < GAS.length; k++) {
  if (GAS[k] === '[') d++; else if (GAS[k] === ']' && --d === 0) { end = k + 1; break; }
}
const SITES = new Function('return ' + GAS.slice(GAS.indexOf('[', i0), end))();
const 볼것 = 찾을말.length ? SITES.filter((s) => 찾을말.some((w) => s.name.includes(w))) : SITES;
console.log('HOSP_SITES ' + SITES.length + '곳 · 이번에 볼 곳 ' + 볼것.length + '곳\n');

let 합계 = { 줄: 0, 우리: 0, 못긁음: 0 };
for (const s of 볼것) {
  if (s.type !== 'html') {
    console.log('－ ' + s.name.slice(0, 26).padEnd(28) + 'type=' + s.type + ' — 전용 처리기라 여기서는 못 돌립니다');
    continue;
  }
  if (!s.url) { console.log('－ ' + s.name.slice(0, 26).padEnd(28) + '주소가 없습니다'); continue; }

  let html = '', code = 0, 바이트 = 0, 왜 = '';
  try {
    const r = await fetch(s.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, redirect: 'follow' });
    code = r.status;
    const buf = Buffer.from(await r.arrayBuffer());
    바이트 = buf.length;
    /* EUC-KR 쪽이 아직 많습니다. 머리글 → <meta> 차례로 봅니다 */
    const ct = r.headers.get('content-type') || '';
    let cs = s.enc || (ct.match(/charset=["']?([\w-]+)/i) || [])[1]
      || (buf.subarray(0, 2048).toString('latin1').match(/charset=["']?([\w-]+)/i) || [])[1] || 'utf-8';
    try { html = new TextDecoder(cs.toLowerCase()).decode(buf); }
    catch { html = buf.toString('utf8'); cs += '(못 읽어 utf-8)'; }
    s.__cs = cs;
  } catch (e) { 왜 = String(e && (e.cause?.code || e.message) || e).slice(0, 60); }

  if (왜 || code >= 400) {
    합계.못긁음++;
    console.log('✗ ' + s.name.slice(0, 26).padEnd(28) + (왜 || 'HTTP ' + code) + '   ← 아예 못 긁었습니다');
    continue;
  }

  let 줄 = [];
  try { 줄 = hospParseHtml(html, s); }
  catch (e) { 합계.못긁음++; console.log('✗ ' + s.name.slice(0, 26).padEnd(28) + '규칙이 깨졌습니다 · ' + e.message); continue; }

  const 우리 = 줄.filter((r) => matchJob(r.title) && !notOurs(r.title));
  합계.줄 += 줄.length; 합계.우리 += 우리.length;
  if (!줄.length) 합계.못긁음++;

  console.log((줄.length ? (우리.length ? '★' : '○') : '✗') + ' ' + s.name.slice(0, 26).padEnd(28)
    + 'HTTP ' + code + ' · ' + String(바이트).padStart(7) + '바이트 · ' + String(s.__cs).padEnd(7)
    + ' · 뽑힌 줄 ' + String(줄.length).padStart(3)
    + ' · 우리 직군 ' + String(우리.length).padStart(2)
    + (줄.length ? '' : '   ← 규칙이 한 줄도 못 뽑았습니다'));
  if (제목수) {
    줄.slice(0, 제목수).forEach((r, i) => console.log('      ' + (i + 1) + '. ' + r.title.slice(0, 62)
      + (r.to ? '  ~' + r.to : r.posted ? '  올림 ' + r.posted : '')));
    우리.forEach((r) => console.log('      ★ ' + r.title.slice(0, 62)));
  }
  await new Promise((x) => setTimeout(x, 600));
}
console.log('\n── 뽑힌 줄 합계 ' + 합계.줄 + ' · 그중 우리 직군 ' + 합계.우리 + ' · 한 줄도 못 뽑은 곳 ' + 합계.못긁음);
