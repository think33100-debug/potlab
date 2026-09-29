/* 알리오 웹에서 공고 머리 정보를 읽습니다 — 근무지 · 고용형태 · 전형절차 (2026-09-29).
 *
 *   node tools/alio-post-meta.mjs --dry --몇 5
 *   node tools/alio-post-meta.mjs --분 30
 *
 * 왜 필요한가 —
 *   ① 근무지   묶음을 「기관 + 직군 + 지역」 으로 이으려면 지역이 있어야 합니다
 *   ② 전형절차  1차·2차·최종이 서류인지 필기인지 면접인지 가리려면 필요합니다
 *              (API 의 scrnprcdrMthdExpln 과 같은 글입니다. 웹에서 같이 읽습니다)
 *
 * 전형단계 숫자는 tools/alio-compete-web.mjs 가 읽습니다. 이건 머리 정보만.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 웹읽기 } from './alio-web-check.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = 'AL2';
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

function env() {
  const out = {};
  for (const f of ['.env.local', '.env', 'web/.env.local'].map((x) => path.join(여기, '..', x))) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return out;
}
const cfg = env();

async function rpc(fn, body) {
  const k = cfg.SUPABASE_ANON_KEY;
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 250));
  return t ? JSON.parse(t) : null;
}

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const 뽑 = (n, d) => (argv.includes(n) ? Number(argv[argv.indexOf(n) + 1]) || d : d);
const 시간예산 = 뽑('--분', 40) * 60000;
const 몇개 = 뽑('--몇', 0);
const 간격 = 뽑('--간격', 500);
const 줄수 = 뽑('--줄', 4);
const t0 = Date.now();

if (!cfg.COLLECT_KEY_AL2) { console.error('COLLECT_KEY_AL2 가 없습니다'); process.exit(1); }

let 할것 = await rpc('alio_post_meta_todo', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE, p_limit: 5000 });
if (몇개) 할것 = 할것.slice(0, 몇개);
console.log('공고 머리 정보 읽기 — 할 것 ' + 할것.length + '건 · ' + 줄수 + '줄' + (dry ? ' · --dry' : ''));

const 셈 = { 읽음: 0, 절차있음: 0, 근무지있음: 0, 못읽음: 0 };
let 담을것 = [];
const 담기 = async () => {
  while (담을것.length >= 300) {
    await rpc('alio_post_meta_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_rows: 담을것.splice(0, 300) });
  }
};

let 다음 = 0, 멈춤 = false;
async function 한줄() {
  for (;;) {
    if (멈춤 || 다음 >= 할것.length) return;
    if (Date.now() - t0 > 시간예산) { 멈춤 = true; return; }
    const c = 할것[다음++];
    const w = await 웹읽기(c.sn);
    셈.읽음++;
    const m = w.머리 || {};
    if (!w.머리) 셈.못읽음++;
    if (m.전형절차) 셈.절차있음++;
    if (m.근무지) 셈.근무지있음++;
    담을것.push({ sn: c.sn, 근무지: m.근무지 ?? null, 고용형태: m.고용형태 ?? null,
      근무분야: m.근무분야 ?? null, 전형절차: m.전형절차 ?? null });
    if (셈.읽음 % 200 === 0) {
      console.log('  ' + 셈.읽음 + '/' + 할것.length + '건 · 절차 ' + 셈.절차있음
        + ' · 근무지 ' + 셈.근무지있음 + ' · 못 읽음 ' + 셈.못읽음
        + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
    }
    await 쉼(간격);
  }
}
const 담는줄 = (async () => {
  while (!멈춤 && (다음 < 할것.length || 담을것.length)) { if (!dry) await 담기(); await 쉼(500); }
})();

await Promise.all(Array.from({ length: 줄수 }, 한줄));
멈춤 = true;
await 담는줄;
if (!dry && 담을것.length) {
  for (let i = 0; i < 담을것.length; i += 300) {
    await rpc('alio_post_meta_put', { p_secret: cfg.COLLECT_KEY_AL2, p_source: SOURCE,
      p_rows: 담을것.slice(i, i + 300) });
  }
}
console.log('\n── 읽음 ' + 셈.읽음 + '건 · 전형절차 있음 ' + 셈.절차있음
  + ' · 근무지 있음 ' + 셈.근무지있음 + ' · 못 읽음 ' + 셈.못읽음
  + ' · ' + Math.round((Date.now() - t0) / 1000) + '초');
if (dry) console.log('   --dry 라 담지 않았습니다');
