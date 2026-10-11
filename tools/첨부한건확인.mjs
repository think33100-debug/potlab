/* 나라일터 공고 **한 건**의 공고문을 받아 kordoc 으로 읽고,
 * 뽑은 값이 원문과 맞는지 **나란히** 찍습니다 (2026-10-11).
 *
 *   node tools/첨부한건확인.mjs <공고idx> [찾을낱말]
 *
 * 왜 — API 가 준 마감일과 공고문 마감일이 다른 공고를 봤습니다
 * (GJ305079 · API 2026-10-23 vs 공고문 2026-11-03 · 11일 차이).
 * 제 뽑기가 틀린 것인지 **원문으로** 가려야 합니다 (지침 10-2).
 *
 * **아무것도 담지 않습니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부읽기, 칸뽑기 } from './공고문읽기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
if (!cfg.ALIO_DETAIL_KEY) { console.error('ALIO_DETAIL_KEY 가 없습니다'); process.exit(1); }

const idx = process.argv[2];
const 찾을낱말 = process.argv[3] || '접수|마감|기간|물리치료사|작업치료사|인원';
if (!idx) { console.error('공고 idx 를 주십시오'); process.exit(1); }

const 한칸 = (글, 이름) => {
  const m = String(글).match(new RegExp('<' + 이름 + '>([\\s\\S]*?)<\\/' + 이름 + '>'));
  return m ? m[1].trim() : '';
};
const 아이템들 = (글) => [...String(글).matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

/* 주소를 온전하게 — collect-nara.mjs 의 온전히() 와 같은 규칙 (&amp; 풀기) */
function 온전히(fp) {
  let p = String(fp || '').trim();
  if (!p) return '';
  p = p.replace(/&amp;/g, '&').replace(/&#38;/g, '&');
  if (!p.startsWith('http')) p = 'https://www.gojobs.go.kr/' + p.replace(/^\//, '');
  const q = p.indexOf('?');
  if (q < 0) return p;
  return p.slice(0, q + 1) + p.slice(q + 1).split('&').map((kv) => {
    const e = kv.indexOf('=');
    if (e < 0) return kv;
    const k = kv.slice(0, e); const v = kv.slice(e + 1);
    return k + '=' + (/%[0-9A-Fa-f]{2}/.test(v) ? v : encodeURIComponent(v));
  }).join('&');
}

const r = await fetch(BASE + '/getItemFile?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&idx=' + idx,
  { headers: { accept: 'application/xml' } });
const xml = await r.text();
const 파일들 = 아이템들(xml).map((it) => ({
  이름: 한칸(it, 'filename'), 길: 한칸(it, 'filepath'), 크기: 한칸(it, 'filesize'),
}));
console.log('첨부 ' + 파일들.length + '개 (HTTP ' + r.status + ')');
for (const f of 파일들) console.log('   ' + f.이름.slice(0, 80) + '   ' + f.크기 + '바이트');

/* 공고문 쪽을 고릅니다 — 응시원서·서식은 뒤로 */
const 점수 = (nm) => (/응시원서|지원서|서식|양식|이력서/.test(nm) ? 0 : /공고/.test(nm) ? 2 : 1);
const 고른것 = [...파일들].sort((a, b) => 점수(b.이름) - 점수(a.이름))[0];
if (!고른것) { console.error('첨부가 없습니다'); process.exit(1); }
console.log('\n고른 것 — ' + 고른것.이름.slice(0, 90));

const 주소 = 온전히(고른것.길);
console.log('주소 — ' + 주소.slice(0, 120));
const g = await fetch(주소, { headers: { 'User-Agent': 'Mozilla/5.0' } });
const buf = Buffer.from(await g.arrayBuffer());
console.log('받음 — HTTP ' + g.status + ' · ' + buf.length + '바이트 · 앞5 「'
  + buf.subarray(0, 5).toString('latin1').replace(/[^\x20-\x7e]/g, '.') + '」');

const k = await 첨부읽기(buf, 고른것.이름);
console.log('kordoc — ' + (k.왜 || '읽음') + ' · ' + k.꼴 + ' · ' + k.초 + '초 · 글자 ' + (k.글 || '').length);
if (!k.글) process.exit(0);

console.log('\n── 원문에서 그 낱말이 나온 자리 ──');
const re = new RegExp(찾을낱말, 'g');
let m; let n = 0;
while ((m = re.exec(k.글)) && n < 8) {
  n++;
  console.log('   … ' + k.글.slice(Math.max(0, m.index - 60), m.index + 120).replace(/\s+/g, ' '));
}

console.log('\n── 뽑은 값 ──');
console.log(JSON.stringify(칸뽑기(k.md, k.글), null, 1));
console.log('\n아무것도 담지 않았습니다.');
