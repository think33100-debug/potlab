/* tools/hwp 부품 시험 — 클린아이 의료 공고의 한글 첨부를 전부 받아 읽어봅니다.
 *
 *   node tools/hwp/check.mjs            한글 첨부 전부 (49건이면 2분쯤)
 *   node tools/hwp/check.mjs --n 5      앞 5건만
 *
 * 왜 있나 — 맨손으로 읽는 방법이라 「어제 4건이 됐다」 가 「된다」 는 아닙니다.
 * 규칙을 손댈 때마다 실제 파일로 다시 세야 합니다.
 * 실패한 것은 **원문 앞 200자**를 찍습니다 (CLAUDE.md 2번).
 */
import fs from 'node:fs';
import { hwp글자, 한글파일인가 } from './index.mjs';
import { 첨부받기, 기본간격, 묶음, 묶음쉼, 쉼 } from '../cleaneye-file.mjs';

const 인자 = process.argv.slice(2);
const 몇 = Number((인자[인자.indexOf('--n') + 1]) || 0) || 0;

/* 클린아이 열쇠는 gas 에 있습니다 (동결이라 읽기만) */
const GAS = fs.readFileSync(new URL('../../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const JOB2_API = {');
let d = 0, A = null;
for (let k = GAS.indexOf('{', i0); k < GAS.length; k++) {
  if (GAS[k] === '{') d++;
  else if (GAS[k] === '}' && --d === 0) { A = new Function('return ' + GAS.slice(GAS.indexOf('{', i0), k + 1))(); break; }
}
if (!A) { console.error('gas/wage.js 에서 JOB2_API 를 못 찾았습니다'); process.exit(1); }

const 풀 = (s) => { let t = String(s ?? ''), p; do { p = t; t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'); } while (t !== p); return t.trim(); };

/* ── 목록 — 17개 시도 ── */
const 의료 = [];
for (const s of A.SIDO) {
  const t = await (await fetch(A.URL + '?serviceKey=' + A.KEY + '&type=xml&sidoCd=' + s.cd)).text();
  for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const o = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = 풀(f[2]);
    if (o.ENT_KIND === '의료' && 한글파일인가(o.FILE_NAME1) && o.URL) 의료.push(o);
  }
  await 쉼(150);
}
const 볼것 = 몇 ? 의료.slice(0, 몇) : 의료;
console.log('클린아이 의료 공고 중 한글 첨부 ' + 의료.length + '건 · 이번에 볼 것 ' + 볼것.length
  + '건 · 간격 ' + 기본간격 + 'ms\n');

let 됨 = 0, 못받음 = 0, 못읽음 = 0, 넘침 = 0, 다시받음 = 0, 받은수 = 0;
const 실패 = [], 글자수 = [], 직군찾음 = [];
for (const o of 볼것) {
  /* 클린아이는 15건마다 막습니다 — 통이 다시 찰 때까지 쉽니다 */
  if (받은수 && 받은수 % 묶음 === 0) {
    console.log('   … ' + 받은수 + '건 받았습니다. 클린아이 통이 다시 찰 때까지 ' + (묶음쉼 / 1000) + '초 쉽니다');
    await 쉼(묶음쉼);
  }
  받은수++;
  const g = await 첨부받기(o.URL);
  if (!g.buf) {
    못받음++; if (g.넘침) 넘침++;
    실패.push({ o, 왜: g.왜, buf: null });
    console.log('✗ ' + String(o.ENT_NAME).slice(0, 16).padEnd(18) + g.왜.slice(0, 110));
    await 쉼(기본간격); continue;
  }
  if (g.다시받음) 다시받음++;
  const r = hwp글자(g.buf, g.이름);
  if (!r.글) {
    못읽음++; 실패.push({ o, 왜: r.왜, buf: g.buf });
    console.log('✗ ' + String(o.ENT_NAME).slice(0, 16).padEnd(18) + r.왜.slice(0, 120));
  } else {
    됨++; 글자수.push(r.한글);
    const 우리 = /작업치료|물리치료/.test(r.글);
    if (우리) 직군찾음.push(o);
    console.log('○ ' + String(o.ENT_NAME).slice(0, 16).padEnd(18) + String(g.buf.length).padStart(7) + '바이트 · 한글 '
      + String(r.한글).padStart(5) + '자 · ' + r.어떻게 + (우리 ? ' ★우리 직군' : ''));
  }
  await 쉼(기본간격);
}

console.log('\n── ' + 볼것.length + '건 — 읽음 ' + 됨 + ' · 못 읽음 ' + 못읽음 + ' · 첨부를 못 받음 ' + 못받음
  + (넘침 ? ' (그중 속도 제한 ' + 넘침 + ')' : '') + (다시받음 ? ' · 429 로 다시 받은 것 ' + 다시받음 : ''));
if (글자수.length) {
  글자수.sort((a, b) => a - b);
  console.log('   한글 글자수 — 가장 적은 것 ' + 글자수[0] + ' · 가운데 ' + 글자수[글자수.length >> 1]
    + ' · 가장 많은 것 ' + 글자수[글자수.length - 1]);
}
console.log('   첨부 안에 우리 직군(작업치료·물리치료)이 적힌 공고 ' + 직군찾음.length + '건');
직군찾음.forEach((o) => console.log('     · ' + o.ENT_NAME + ' — ' + String(o.ENT_TITLE).slice(0, 44)));

if (실패.length) {
  console.log('\n── 실패한 것 (앞 3건 · 원문 앞 200자) ──');
  실패.slice(0, 3).forEach((x, i) => {
    console.log('\n' + (i + 1) + '. ' + x.o.ENT_NAME + ' · ' + String(x.o.ENT_TITLE).slice(0, 50));
    console.log('   첨부 ' + x.o.FILE_NAME1);
    console.log('   ' + x.o.URL);
    console.log('   왜 — ' + x.왜);
    if (x.buf) {
      console.log('   앞 8바이트 — ' + [...x.buf.subarray(0, 8)].map((y) => y.toString(16).padStart(2, '0')).join(' '));
      console.log('   원문 앞 200자 — ' + x.buf.subarray(0, 400).toString('utf8').replace(/\s+/g, ' ').slice(0, 200));
    }
  });
}
process.exit(못읽음 || 못받음 ? 1 : 0);
