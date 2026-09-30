/* 사이트 한 곳을 캐물어 봅니다 — 원문 500자 · 뽑힌 줄 · 판정까지 (2026-09-30).
 *
 *   node tools/사이트캐묻기.mjs 대우          이름에 「대우」 가 든 곳
 *   node tools/사이트캐묻기.mjs 대우 강진
 *
 * 사흘 대조에서 「gas 에만 있는 것」 이 나왔을 때, 새 수집기가
 *   ① 그 주소를 보긴 했나
 *   ② 봤다면 그 공고 줄을 뽑았나
 *   ③ 뽑았다면 판정에서 어디로 갔나
 * 를 한 번에 봅니다. **아무것도 안 바꿉니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 사이트줄 } from './hosp/sites.mjs';
import { 글받기 } from './certs/index.mjs';
import { sortJob } from './sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 찾을말 = process.argv.slice(2).filter((x) => !x.startsWith('--'));
if (!찾을말.length) { console.error('쓰기: node tools/사이트캐묻기.mjs 대우 강진'); process.exit(1); }

const 전부 = JSON.parse(fs.readFileSync(path.join(여기, 'hosp', 'hosp-sites.json'), 'utf8'));
const 것 = (전부.사이트 || []).filter((s) => 찾을말.some((w) => s.name.includes(w)));
if (!것.length) { console.error('그런 이름의 사이트가 없습니다'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128';

for (const s of 것) {
  console.log('\n' + '═'.repeat(72));
  console.log(s.name + '   (type ' + s.type + ')');
  console.log('주소  ' + (s.url || s.host || '(없음)'));
  console.log('돌린 자리  ' + (process.env.POTJOB_WHERE || '(POTJOB_WHERE 를 안 정했습니다)'));

  /* ① 받아지나 — 원문 그대로 */
  if (s.type === 'html') {
    const t0 = Date.now();
    const g = await 글받기(s.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, enc: s.enc });
    console.log('\n① 받기  HTTP ' + (g.code ?? '-') + ' · ' + ((Date.now() - t0) / 1000).toFixed(1)
      + '초 · ' + (g.바이트 ?? 0) + '바이트 · ' + (g.cs || '') + (g.왜 ? ' · ' + g.왜 : ''));
    if (g.html) {
      console.log('   ── 원문 앞 500자 ──');
      console.log('   ' + String(g.html).replace(/\s+/g, ' ').slice(0, 500));
    }
  }

  /* ② 줄을 뽑았나 */
  const r = await 사이트줄(s);
  if (r.err) { console.log('\n② 줄 뽑기  ✗ ' + r.err); continue; }
  const 줄 = r.rows || [];
  console.log('\n② 줄 뽑기  ' + 줄.length + '줄 (' + (r.raw || '') + ')');

  /* ③ 판정 — 어디로 가나 */
  console.log('\n③ 판정');
  for (const x of 줄.slice(0, 14)) {
    const j = sortJob(String(x.title || ''), '', null);
    console.log('   [' + String(j.갈래).padEnd(5) + '] ' + String(x.title || '').slice(0, 52));
    console.log('           ' + j.왜 + (j.걸린단어?.length ? ' · 걸린단어 ' + j.걸린단어.join(',') : ''));
  }
  if (줄.length > 14) console.log('   … 그리고 ' + (줄.length - 14) + '줄 더');
}
