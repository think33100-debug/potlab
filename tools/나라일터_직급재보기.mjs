/* getItemPosition 이 **직군·인원을 얼마나 채워 주나**를 재 봅니다 (2026-10-11).
 *
 *   node tools/나라일터_직급재보기.mjs [몇개]
 *
 * 연결하기 전에 「쓸 만한가」를 숫자로 봅니다 — 지침 4절·2절.
 * **아무것도 담지 않습니다.**
 *
 * 보는 것
 *   ① name 에 우리 직군(물리치료사·작업치료사)이 그대로 있나
 *   ② name 에 「치료사」만 있어 못 가리는 것은 몇 건인가
 *   ③ cnt 가 모집인원으로 쓸 만한가 (0·빈칸이 얼마나 되나)
 *   ④ 지금 DB 의 job_group·headcount 와 견주면 몇 건이 새로 채워지나
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 몇개 = Number(process.argv[2]) || 60;

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
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
if (!cfg.ALIO_DETAIL_KEY || !cfg.SUPABASE_SERVICE_KEY) {
  console.error('ALIO_DETAIL_KEY 또는 SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1);
}

/* 지금 DB 의 GJ2 공고 — 견줄 자료 */
const r0 = await fetch(cfg.SUPABASE_URL
  + '/rest/v1/job_posts?select=id,title,job_group,headcount,hold'
  + '&source=eq.GJ2&' + encodeURIComponent('시험자료') + '=eq.false'
  + '&order=db_insert_at.desc&limit=' + 몇개,
  { headers: { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY } });
const 공고들 = await r0.json();
if (!Array.isArray(공고들)) { console.error('공고를 못 받음 — ' + JSON.stringify(공고들).slice(0, 200)); process.exit(1); }
console.log('견줄 공고 ' + 공고들.length + '건 (GJ2 · 최근 순)\n');

const 한칸 = (글, 이름) => {
  const m = 글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? m[1].trim() : '';
};
const 아이템들 = (글) => [...글.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

const 셈 = {
  두드림: 0, 응답없음: 0, 줄0: 0,
  직군그대로: 0, 치료사만: 0, 직군없음: 0,
  cnt있음: 0, cnt0: 0, cnt없음: 0,
  새로채울직군: 0, 새로채울인원: 0,
};
const 견본 = [];

for (const j of 공고들) {
  const idx = String(j.id).replace(/^GJ/, '');
  셈.두드림++;
  let t = '';
  try {
    const r = await fetch(BASE + '/getItemPosition?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&idx=' + idx
      + '&numOfRows=50&pageNo=1', { headers: { accept: 'application/xml' } });
    t = await r.text();
  } catch { 셈.응답없음++; continue; }
  const items = 아이템들(t);
  if (!items.length) { 셈.줄0++; continue; }

  const 줄들 = items.map((x) => ({ name: 한칸(x, 'name'), cnt: 한칸(x, 'cnt'), code: 한칸(x, 'code') }));
  const 이름합 = 줄들.map((x) => x.name).join(' / ');

  /* ① 우리 직군이 그대로 적혀 있나 */
  const 물 = /물리\s*치료/.test(이름합);
  const 작 = /작업\s*치료/.test(이름합);
  if (물 || 작) 셈.직군그대로++;
  else if (/치료사|치료실|재활/.test(이름합)) 셈.치료사만++;
  else 셈.직군없음++;

  /* ③ cnt */
  const cnt합 = 줄들.reduce((a, x) => a + (Number(x.cnt) || 0), 0);
  if (!줄들.some((x) => x.cnt !== '')) 셈.cnt없음++;
  else if (cnt합 === 0) 셈.cnt0++;
  else 셈.cnt있음++;

  /* ④ 지금 DB 와 견주기 */
  const 지금직군 = String(j.job_group || '').trim();
  if (!지금직군 && (물 || 작)) 셈.새로채울직군++;
  if (j.headcount == null && cnt합 > 0) 셈.새로채울인원++;

  if (견본.length < 10 && (물 || 작 || /치료사|재활/.test(이름합))) {
    견본.push({ id: j.id, 제목: String(j.title).slice(0, 48), DB직군: 지금직군 || '(빈칸)',
      DB인원: j.headcount, 직급: 이름합.slice(0, 80), cnt합 });
  }
}

console.log('── 두드린 결과 ───────────────────────────────────');
console.log('  두드림 ' + 셈.두드림 + ' · 응답 못 받음 ' + 셈.응답없음 + ' · item 0줄 ' + 셈.줄0);
console.log('');
console.log('① 직급 이름(name) 에 우리 직군이');
console.log('   그대로 있음 (물리치료/작업치료)  ' + 셈.직군그대로 + '건');
console.log('   「치료사·재활」까지만              ' + 셈.치료사만 + '건   ← 이것만으로는 못 가립니다');
console.log('   아예 없음                        ' + 셈.직군없음 + '건');
console.log('');
console.log('③ cnt (인원)');
console.log('   1 이상  ' + 셈.cnt있음 + '건 · 0  ' + 셈.cnt0 + '건 · 칸 자체가 없음  ' + 셈.cnt없음 + '건');
console.log('');
console.log('④ 지금 DB 와 견주면');
console.log('   직군이 빈칸인데 getItemPosition 으로 채워지는 것   ' + 셈.새로채울직군 + '건');
console.log('   모집인원이 빈칸인데 cnt 로 채워지는 것             ' + 셈.새로채울인원 + '건');
console.log('');
console.log('── 견본 ──────────────────────────────────────────');
for (const s of 견본) {
  console.log('  ' + s.id + '  DB직군 ' + s.DB직군 + ' · DB인원 ' + (s.DB인원 ?? '빈칸') + ' · cnt합 ' + s.cnt합);
  console.log('     제목  ' + s.제목);
  console.log('     직급  ' + s.직급);
}
console.log('\n아무것도 담지 않았습니다.');
