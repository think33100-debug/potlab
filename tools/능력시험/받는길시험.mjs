/* 「HTML 이 옴」 줄을 **주소 바로잡기를 거쳐 다시 받아 봅니다** (2026-10-21)
 *
 *   node tools/능력시험/받는길시험.mjs            받아 둔 사실.json 의 HTML 줄 전부
 *   node tools/능력시험/받는길시험.mjs --몇개 3
 *   node tools/능력시험/받는길시험.mjs --자기점검   받지 않습니다
 *
 * 무엇을 보나 — `고친주소()` 가 버릴 줄은 안 받고, 고친 줄은 **받아서**
 *   ① 앞 바이트로 진짜 형식  ② kordoc 으로 글자 수 를 찍습니다.
 *   「HTML 12건이 글로 바뀌는지」(세중님)를 재는 자리입니다.
 *
 * ★ 같은 사이트는 3.5초 띄웁니다. DB 에 아무것도 안 씁니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 고친주소 } from '../첨부주소고치기.mjs';
import { 첨부읽기, 진짜형식, 워커끝내기 } from '../공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 몇개 = Number(값('--몇개', 99));
const 틈ms = 3500;
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';

/* ── 볼 줄 모으기 — 받아 둔 사실.json 에서 진짜형식이 HTML 인 것 ── */
const 볼것 = [];
const 원문 = path.join(여기, '원문');
if (fs.existsSync(원문)) {
  for (const d of fs.readdirSync(원문)) {
    const p = path.join(원문, d, '사실.json');
    if (!fs.existsSync(p)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    for (const a of (j.받은첨부 || [])) {
      if (a.진짜형식 !== 'HTML') continue;
      볼것.push({ id: j.id, source: j.source, 바탕: j.주소, url: a.url, 이름: a.이름, 전바이트: a.바이트 });
    }
  }
}

if (argv.includes('--자기점검')) {
  console.log('○ 받는길시험 — 볼 줄 ' + 볼것.length + '건 (받지 않았습니다)');
  for (const x of 볼것) {
    const g = 고친주소(x.url, x.바탕);
    console.log('  ' + String(x.id).padEnd(13) + (g.버릴것 ? '버림  ' : g.url !== x.url ? '고침  ' : '그대로')
      + '  ' + (g.왜 || '') );
  }
  process.exit(0);
}

console.log('「HTML 이 옴」 ' + 볼것.length + '건을 주소 바로잡기를 거쳐 다시 받습니다'
  + (몇개 < 볼것.length ? ' (앞 ' + 몇개 + '건만)' : ''));

const 끝때 = new Map();
const 셈 = { 버림: 0, 받음: 0, 또HTML: 0, 글됨: 0, 못받음: 0 };
for (const x of 볼것.slice(0, 몇개)) {
  const g = 고친주소(x.url, x.바탕);
  if (g.버릴것) {
    셈.버림++;
    console.log('\n── ' + x.id + ' [' + x.source + '] ' + String(x.이름).slice(0, 40));
    console.log('   버렸습니다 — ' + g.왜);
    console.log('   ' + x.url.slice(0, 96));
    continue;
  }
  const host = (() => { try { return new URL(g.url).host; } catch { return ''; } })();
  const 지난 = Date.now() - (끝때.get(host) || 0);
  if (지난 < 틈ms) await 자고(틈ms - 지난);
  끝때.set(host, Date.now());

  console.log('\n── ' + x.id + ' [' + x.source + '] ' + String(x.이름).slice(0, 40));
  if (g.url !== x.url) console.log('   주소를 고쳤습니다 — ' + g.왜);
  let r;
  try {
    r = await fetch(g.url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ko',
        ...(g.받는법 && g.받는법.Referer ? { Referer: g.받는법.Referer } : {}) },
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) { 셈.못받음++; console.log('   ✗ ' + String(e && e.message || e).slice(0, 60)); continue; }
  if (!r.ok) { 셈.못받음++; console.log('   ✗ HTTP ' + r.status); continue; }
  let buf;
  try { buf = Buffer.from(await r.arrayBuffer()); }
  catch (e) { 셈.못받음++; console.log('   ✗ 몸 읽기 — ' + String(e && e.message || e).slice(0, 50)); continue; }
  const 꼴 = 진짜형식(buf);
  const 앞 = buf.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.');
  console.log('   받음 ' + buf.length + '바이트 (전 ' + x.전바이트 + ') · 진짜형식 ' + 꼴 + ' · 앞 「' + 앞 + '」');
  셈.받음++;
  if (꼴 === 'HTML') { 셈.또HTML++; console.log('   ★ 또 HTML 입니다'); continue; }
  const 읽 = await 첨부읽기(buf, x.이름 || 'a');
  const md = String((읽 && 읽.md) || '');
  console.log('   글자 ' + md.length + '자' + (읽 && 읽.왜 ? ' · ' + 읽.왜 : ''));
  if (md.length > 200) 셈.글됨++;
}

console.log('\n── 셈 ──');
console.log('  버림 ' + 셈.버림 + ' · 받음 ' + 셈.받음 + ' (또 HTML ' + 셈.또HTML
  + ' · 글이 된 것 ' + 셈.글됨 + ') · 못받음 ' + 셈.못받음);
await 워커끝내기?.();
