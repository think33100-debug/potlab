/* 한국 밖에서 막히던 병원 3곳만 따로 확인합니다 (2026-09-30).
 *
 *   node tools/막힌3곳.mjs          받아 보고 결과만 (아무것도 안 담습니다)
 *   node tools/막힌3곳.mjs --자세히   받은 앞부분도 찍습니다
 *
 * ── 왜 셋만 따로 보나 ─────────────────────────────────────
 * Vercel 을 서울로 옮겼을 때 37곳 중 34곳이 열렸고 **세 곳만 남았습니다.**
 * 2026-09-28 에 잰 것 —
 *
 *   동아병원        HTTP 200 인데 본문이 「한국에서만 접속 가능합니다」
 *   광혜병원        HTTP 403 (집에서는 옛 암호 허용하면 열림)
 *   한마음병원(제주) 8초 안에 못 붙음 (두 번 다)
 *
 * AWS 주소 대역을 막는 곳이라, **한국 가정용 인터넷에서는 셋 다 열립니다.**
 * Lightsail 서울로 옮긴 뒤 이 셋이 어떻게 되는지가 이전의 마지막 관문입니다.
 * 세중님이 「첫 실행 때 이 셋 결과부터 따로 보여 달라」 고 하셨습니다.
 *
 * 인증서 검증은 끄지 않습니다. `tools/certs` 의 받는 자리를 그대로 씁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 자세히 = process.argv.includes('--자세히');

/* hosp-sites.json 에 적힌 그대로의 이름입니다. 바꾸지 마세요 */
export const 막힌곳 = ['동아병원', '의료법인 광혜의료재단 광혜병원', '한마음병원'];

/* 2026-09-28 에 구글(미국) 자리에서 잰 것 — 견줄 자리입니다 */
const 전에 = {
  '동아병원': 'HTTP 200 인데 본문이 「한국에서만 접속 가능합니다」',
  '의료법인 광혜의료재단 광혜병원': 'HTTP 403',
  '한마음병원': '8초 안에 못 붙음',
};

/* hosp-sites.json 은 { 구운날, 사이트: [...] } 꼴입니다 */
const 전부 = JSON.parse(fs.readFileSync(path.join(여기, 'hosp', 'hosp-sites.json'), 'utf8'));
const 목록 = Array.isArray(전부) ? 전부 : (전부.사이트 || []);
const 것 = 목록.filter((s) => 막힌곳.includes(s.name));

if (것.length !== 막힌곳.length) {
  console.error('⚠ 세 곳 중 ' + 것.length + '곳만 찾았습니다 — hosp-sites.json 의 이름이 바뀌었나요');
  console.error('  찾은 것: ' + 것.map((x) => x.name).join(' · '));
}

console.log('한국 밖에서 막히던 병원 ' + 것.length + '곳 — 여기서는 어떤지 봅니다');
console.log('돌리는 자리: ' + (process.env.POTJOB_WHERE || '(POTJOB_WHERE 를 안 정했습니다)'));
console.log('');

const 표 = [];
for (const s of 것) {
  const t0 = Date.now();
  /* 사이트줄 은 { rows, raw } 또는 { err } 를 돌려줍니다. 던지지 않습니다 */
  let g = {};
  try { g = (await 사이트줄(s)) || {}; }
  catch (e) { g = { err: '멈춤 · ' + String((e && (e.cause?.code || e.message)) || e).slice(0, 80) }; }
  const 초 = ((Date.now() - t0) / 1000).toFixed(1);
  const 줄 = g.rows || [];

  /* 「한국에서만 접속 가능합니다」 같은 안내 쪽이 200 으로 오는 일이 있습니다.
     그래서 HTTP 만 보지 않고 **공고 줄이 실제로 나왔는지**로 가립니다 */
  const 결과 = g.err ? '막힘' : (줄.length ? '열림' : '열렸는데 공고 0줄 — 안내 쪽일 수 있음');
  표.push({
    병원: s.name.slice(0, 20), 결과, 공고줄: 줄.length, 초,
    까닭: String(g.err || g.raw || '').slice(0, 44),
    '2026-09-28 구글 자리': 전에[s.name] || '',
  });
  if (자세히) {
    console.log('── ' + s.name + ' · ' + 결과 + (g.raw ? ' · ' + g.raw : ''));
    줄.slice(0, 3).forEach((r) => console.log('   ' + JSON.stringify(r).slice(0, 140)));
    if (g.err) console.log('   ' + g.err);
    console.log('');
  }
}
console.table(표);

const 열림 = 표.filter((x) => x.결과 === '열림').length;
console.log('\n열린 곳 ' + 열림 + ' / ' + 표.length);
if (열림 === 표.length) {
  console.log('○ 세 곳이 다 열렸습니다 — 한국 밖에서 막히던 것이 서울에서는 풀립니다.');
} else {
  console.log('△ 아직 막힌 곳이 있습니다. 「손으로 확인할 곳」 목록에 남겨 두고 마지막 확인일을 적으십시오.');
}
