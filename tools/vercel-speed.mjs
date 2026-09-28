/* 운영 화면이 얼마나 빨리 뜨는지 잽니다 (2026-09-28).
 *
 *   node tools/vercel-speed.mjs           재서 찍습니다
 *   node tools/vercel-speed.mjs 이전       이름표를 붙여 파일로 남깁니다
 *
 * ── 왜 ────────────────────────────────────────────────────────
 * Vercel 함수 자리를 미국(iad1)에서 서울(icn1)로 옮기려 합니다.
 * DB(Supabase)가 서울이라 가까워질 것 같지만 **재보기 전에는 모릅니다.**
 * 옮기기 전과 뒤를 같은 방법으로 재서 견줍니다. 느려지면 되돌립니다.
 *
 * ── 어떻게 재나 ───────────────────────────────────────────────
 * · 한 길을 여러 번 부르고 **가운데값**을 씁니다. 한 번만 재면 들쭉날쭉합니다
 * · 첫 바이트까지 걸린 시간(TTFB)을 봅니다 — 서버가 생각한 시간입니다
 * · 캐시를 끕니다. 캐시된 답을 재면 아무 뜻이 없습니다
 * · `x-vercel-id` 를 같이 남깁니다 — **어느 리전이 답했는지**가 거기 있습니다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 바탕 = process.env.VERCEL_BASE || 'https://potjob-web.vercel.app';
const 이름표 = process.argv[2] || '잰것';
const 몇번 = Number(process.env.SPEED_N || 7);

const 길 = [
  { 이름: '첫 화면', 길: '/' },
  { 이름: '공고 목록', 길: '/jobs' },
  { 이름: '공고 상세', 길: process.env.SPEED_JOB || '/jobs/HS236379585' },
  { 이름: '기관 목록', 길: '/orgs' },
];

async function 한번(u) {
  const t0 = Date.now();
  let 첫 = 0;
  try {
    const r = await fetch(u, {
      headers: { 'User-Agent': 'potjob-speed-check', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      cache: 'no-store',
    });
    /* 몸통을 읽기 시작할 때까지가 「서버가 생각한 시간」 에 가깝습니다 */
    const reader = r.body?.getReader();
    if (reader) { await reader.read(); 첫 = Date.now() - t0; await reader.cancel(); }
    const buf = 첫 ? 0 : (await r.arrayBuffer()).byteLength;
    return {
      code: r.status, 첫바이트: 첫 || (Date.now() - t0), 전체: Date.now() - t0, 바이트: buf,
      리전: r.headers.get('x-vercel-id') || '',
      캐시: r.headers.get('x-vercel-cache') || '',
    };
  } catch (e) {
    return { code: 0, 왜: String(e && (e.cause?.code || e.message)).slice(0, 60), 첫바이트: Date.now() - t0, 전체: Date.now() - t0 };
  }
}

const 가운데 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

console.log('잰 곳 ' + 바탕 + ' · 길마다 ' + 몇번 + '번 · ' + 이름표);
console.log();
console.log('화면        HTTP  가운데값   가장빠름  가장느림   답한 곳                       캐시');
const 결과 = [];
for (const g of 길) {
  const 잰것 = [];
  let 마지막 = null;
  for (let i = 0; i < 몇번; i++) {
    const r = await 한번(바탕 + g.길);
    마지막 = r;
    if (r.code === 200) 잰것.push(r.첫바이트);
    await new Promise((y) => setTimeout(y, 400));
  }
  if (!잰것.length) {
    console.log(g.이름.padEnd(12) + '✗     ' + (마지막?.왜 || 'HTTP ' + 마지막?.code));
    결과.push({ ...g, 실패: 마지막?.왜 || 'HTTP ' + 마지막?.code });
    continue;
  }
  const m = 가운데(잰것);
  /* x-vercel-id 는 「cle1::icn1::xxxx」 처럼 거쳐온 곳이 적혀 있습니다 */
  const 곳 = String(마지막.리전 || '').split('::').filter((x) => /^[a-z]{3}\d$/.test(x)).join(' → ');
  console.log(g.이름.padEnd(12) + String(마지막.code).padEnd(6)
    + (m + 'ms').padEnd(11) + (Math.min(...잰것) + 'ms').padEnd(10)
    + (Math.max(...잰것) + 'ms').padEnd(11)
    + (곳 || 마지막.리전 || '(모름)').slice(0, 30).padEnd(30) + (마지막.캐시 || ''));
  결과.push({ ...g, code: 마지막.code, 가운데값: m, 가장빠름: Math.min(...잰것), 가장느림: Math.max(...잰것), 곳, 캐시: 마지막.캐시, 잰것 });
}

const 둘곳 = path.join(여기, 'hosp', 'reports', 'vercel-speed-' + 이름표 + '.json');
fs.writeFileSync(둘곳, JSON.stringify({ 이름표, 바탕, 몇번, 잰때: new Date().toISOString(), 결과 }, null, 1), 'utf8');
console.log('\n남겼습니다 — ' + 둘곳);
