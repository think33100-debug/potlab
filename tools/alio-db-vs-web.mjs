/* 우리 DB ↔ 알리오 웹 **묶음 단위로** 나란히 견줍니다 (2026-09-29).
 *
 *   node tools/alio-db-vs-web.mjs 264101:0 299403:0 …      sn:묶음차례
 *   node tools/alio-db-vs-web.mjs                          우리 직군에서 무작위 10묶음
 *
 * 앞의 alio-web-table.mjs 는 **웹 ↔ API** 를 견줬습니다.
 * 이건 **우리가 담은 것 ↔ 웹** 입니다 — 담는 과정에서 틀어진 데가 없는지 봅니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 웹읽기 } from './alio-web-check.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return out;
}
const cfg = env();

async function db(q) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/alio_web_peek', {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: cfg.COLLECT_KEY_AL2, p_source: 'AL2', p_keys: q }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 250));
  return JSON.parse(t);
}

const 고른것 = process.argv.slice(2).filter((x) => /^\d+:\d+$/.test(x))
  .map((x) => ({ sn: Number(x.split(':')[0]), group_no: Number(x.split(':')[1]) }));
if (!고른것.length) { console.error('sn:묶음차례 를 넣어 주세요 (예: 264101:0)'); process.exit(1); }

const 우리것 = await db(고른것);
const 표 = [];
const 나쁨 = [];
for (const c of 고른것) {
  const 내 = 우리것.find((x) => x.sn === c.sn && x.group_no === c.group_no);
  const w = await 웹읽기(c.sn);
  const g = (w.묶음 || [])[c.group_no];
  if (!내 || !g) { 나쁨.push(c.sn + ':' + c.group_no + ' 못 찾음'); continue; }

  const 웹단계 = g.단계.map((s) => s.선발 + '/' + s.응시).join(' → ');
  const 내단계 = (내.단계 || []).map((s) => s.선발 + '/' + s.응시).join(' → ');
  const 같나 = 웹단계 === 내단계
    && Math.abs((g.경쟁률 ?? -1) - (Number(내.경쟁률) ?? -2)) < 0.005
    && g.이름 === 내.group_name;
  if (!같나) 나쁨.push(c.sn + ':' + c.group_no);
  표.push({
    sn: c.sn, 기관: String(내.inst_nm || '').slice(0, 12), 해: 내.year,
    묶음: String(g.이름 || '').slice(0, 26),
    '웹 단계(선발/응시)': 웹단계, '우리 단계': 내단계,
    '웹 경쟁률': g.경쟁률, '우리 경쟁률': Number(내.경쟁률),
    같나: 같나 ? '같음' : '다름',
  });
  await 쉼(700);
}
console.table(표);
console.log('\n묶음 ' + 표.length + '개 중 같음 ' + 표.filter((x) => x.같나 === '같음').length
  + ' · 다름 ' + 표.filter((x) => x.같나 === '다름').length);
if (나쁨.length) console.log('살펴볼 것: ' + 나쁨.join(' · '));
