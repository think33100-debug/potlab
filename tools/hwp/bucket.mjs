/* 클린아이 다운로드 한도를 잽니다 — 「몇 건이고 얼마나 쉬면 다시 차나」.
 *
 *   node tools/hwp/bucket.mjs            10분 쉬었다가 잽니다
 *   node tools/hwp/bucket.mjs --바로      바로 잽니다 (통이 비어 있으면 0 이 나옵니다)
 *
 * 왜 있나 — 429 를 만나고 「간격을 늘리면 되겠지」 하고 1.2초로 바꿨는데
 * **똑같이 15건**에서 막혔습니다. 간격이 아니라 통이라는 뜻입니다.
 * 통 크기와 다시 차는 시간을 모르면 수집기 주기를 정할 수 없습니다.
 *
 * 재는 법 — 다시 시도를 **끄고**(다시: 0) 1.2초 간격으로 계속 두드려
 * 몇 번째에서 429 가 나는지 셉니다. 그 다음 정해진 시간만큼 쉬었다가
 * 다시 세어 「얼마나 찼나」 를 봅니다.
 */
import fs from 'node:fs';
import { 첨부받기, 쉼 } from '../cleaneye-file.mjs';

const 바로 = process.argv.includes('--바로');

const GAS = fs.readFileSync(new URL('../../gas/wage.js', import.meta.url), 'utf8');
const i0 = GAS.indexOf('const JOB2_API = {');
let d = 0, A = null;
for (let k = GAS.indexOf('{', i0); k < GAS.length; k++) {
  if (GAS[k] === '{') d++;
  else if (GAS[k] === '}' && --d === 0) { A = new Function('return ' + GAS.slice(GAS.indexOf('{', i0), k + 1))(); break; }
}
const 풀 = (s) => { let t = String(s ?? ''), p; do { p = t; t = t.replace(/&amp;/g, '&'); } while (t !== p); return t.trim(); };

const 것들 = [];
for (const s of A.SIDO) {
  const t = await (await fetch(A.URL + '?serviceKey=' + A.KEY + '&type=xml&sidoCd=' + s.cd)).text();
  for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const o = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) o[f[1]] = 풀(f[2]);
    if (o.ENT_KIND === '의료' && o.FILE_NAME1 && o.URL) 것들.push(o);
  }
  if (것들.length >= 80) break;
  await 쉼(150);
}
console.log('시험에 쓸 공고 ' + 것들.length + '건\n');

/* 다시 시도를 끄고 몇 번째에서 막히는지 셉니다 */
async function 세기(꼬리표, 시작) {
  let 됨 = 0;
  for (let i = 시작; i < 것들.length; i++) {
    const g = await 첨부받기(것들[i].URL, { 다시: 0 });
    if (!g.buf) {
      console.log('  ' + 꼬리표 + ' — ' + 됨 + '건 받고 막혔습니다 (' + String(g.왜).slice(0, 60) + ')');
      return { 됨, 다음: i + 1 };
    }
    됨++;
    await 쉼(1200);
  }
  console.log('  ' + 꼬리표 + ' — ' + 됨 + '건 다 받았습니다 (안 막힘)');
  return { 됨, 다음: 것들.length };
}

let 자리 = 0;
if (!바로) {
  console.log('통이 비어 있을 수 있어 10분 쉬고 시작합니다 …');
  await 쉼(600000);
}
const a = await 세기('① 가득 찬 통', 자리); 자리 = a.다음;

for (const 분 of [2, 5, 10]) {
  console.log('\n' + 분 + '분 쉽니다 …');
  await 쉼(분 * 60000);
  const r = await 세기('② ' + 분 + '분 쉰 뒤', 자리); 자리 = r.다음;
  if (자리 >= 것들.length) break;
}
console.log('\n── 통 크기와 다시 차는 시간을 위 숫자로 읽으시면 됩니다');
