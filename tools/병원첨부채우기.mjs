/* 병원 쪽(HS·HS3)의 **첨부 줄을 만듭니다** (2026-10-22 세중님 2번)
 *
 *   node tools/병원첨부채우기.mjs                    무엇이 생길지만 (기본 · 마른)
 *   node tools/병원첨부채우기.mjs --집 dkuh          한 집만 (주소에 그 말이 든 것)
 *   POTJOB_ATTACH_WRITE=1 node tools/병원첨부채우기.mjs --진짜 --몇개 80
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 단국대병원 공고는 본문(`#bo_v_con`)이 **0자**이고 첨부가 본문입니다 —
 *   「붙임 1. 책임연구원 … 응시원서 및 관련 제출 서류.hwp (110.5K)」
 * 그런데 DB 에 **첨부 0줄**이었습니다. 쪽에 걸고 `hs첨부주소()` 를 돌려 보니
 * **세 개를 그대로 집습니다** — 뽑는 규칙이 아니라 **되메우기가 없던 것**입니다.
 * (나라일터는 2026-10-22 에 `나라일터첨부채우기.mjs` 로 같은 일을 했습니다)
 *
 * ★ 주소를 지어내지 않습니다 — 쪽에 적힌 href 만 씁니다 (hs첨부주소 한 자리).
 * ★ 담는 길은 `첨부담기` 창구뿐입니다 (하루 상한·겹침 거르기·저장이름이 거기 있습니다).
 *   `POTJOB_ATTACH_WRITE=1` 이 없으면 창구가 스스로 마른으로 돕니다.
 * ★ 같은 집은 **3.5초** 띄웁니다 (지침 — 병원 사이트 3초 이상).
 */
import fs from 'node:fs';
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기, 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 첨부모으기 } from './첨부담기.mjs';

const require_ = createRequire(import.meta.url);
const { hs첨부주소 } = require_('./hosp/hs_files.js');

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(값('--몇개', 40));
const 집고르기 = 값('--집', '');
const 틈ms = Number(값('--틈', 3500));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const 자고 = (ms) => new Promise((y) => setTimeout(y, ms));

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
for (const [k, v] of Object.entries(process.env)) if (v != null) cfg[k] = v;
const 바탕 = cfg.SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

/** ★ 이 서버는 100줄에서 끊습니다 — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 전부(길) {
  const 모은것 = [];
  for (let off = 0; ;) {
    /* ★ 2026-10-26 — 지나가는 401·5xx 에 다리가 죽지 않게 **다시 두드립니다** */
    const r = await 받아보기(바탕 + '/rest/v1/' + 차례붙이기(길)
      + '&limit=1000&offset=' + off, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
  return 모은것;
}

const 공고 = await 전부('job_posts?select=id,source,org_name,title,url,hidden,hold&source=in.(HS,HS3)');
const 첨있 = new Set((await 전부('job_attachments?select=job_id')).map((x) => x.job_id));
/* ★ 2026-10-22 밤 — **--회원만**. 바퀴는 오래된 것부터 보지만, 맞음률을 재려면
   **회원 화면에 보이는 공고**의 공고문이 먼저 담겨야 합니다
   (알리오·나라일터·첨부되메우기와 같은 깃발) */
const 회원만 = argv.includes('--회원만');
const 보임 = 회원만 ? new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id)) : null;
const 볼것 = 공고
  .filter((j) => /^https?:\/\//.test(String(j.url || '')))
  .filter((j) => !첨있.has(j.id))
  .filter((j) => !회원만 || 보임.has(j.id))
  .filter((j) => !집고르기 || String(j.url).includes(집고르기));

/* 집별로 모아 돌립니다 — 같은 집을 줄줄이 때리지 않게 번갈아 */
const 집의 = (u) => { try { return new URL(u).host; } catch { return '?'; } };
const 집별 = new Map();
for (const j of 볼것) {
  const h = 집의(j.url);
  if (!집별.has(h)) 집별.set(h, []);
  집별.get(h).push(j);
}
const 차례 = [];
{
  const 쌓 = [...집별.values()];
  for (let i = 0; 차례.length < 볼것.length; i++) {
    let 넣음 = false;
    for (const a of 쌓) if (a[i]) { 차례.push(a[i]); 넣음 = true; }
    if (!넣음) break;
  }
}

console.log('HS·HS3 공고 ' + 공고.length + '건 · 첨부 줄 없는 것 ' + 볼것.length + '건 ('
  + 집별.size + '집)' + (집고르기 ? ' · 집 「' + 집고르기 + '」' : '') + (회원만 ? ' · **회원 화면만**' : '')
  + ' → 앞 ' + Math.min(몇개, 차례.length) + '건' + (진짜 ? '' : ' · **마른**'));

const 첨부 = 첨부모으기('HS3', { 마른: !진짜 });
const 끝때 = new Map();
let 열림 = 0, 탈 = 0, 줄수 = 0, 첨부없음 = 0;
const 집셈 = new Map();
const 견본 = [];
for (const j of 차례.slice(0, 몇개)) {
  const h = 집의(j.url);
  const 지난 = Date.now() - (끝때.get(h) || 0);
  if (지난 < 틈ms) await 자고(틈ms - 지난);
  끝때.set(h, Date.now());
  let html;
  try {
    const r = await fetch(j.url, { headers: { 'User-Agent': UA } });
    html = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    탈++;
    if (탈 <= 3) console.error('  ✗ ' + j.id + ' · ' + String(e.message).slice(0, 50));
    continue;
  }
  열림++;
  let 목록 = [];
  try { 목록 = hs첨부주소(html, j.url) || []; } catch { 목록 = []; }
  if (!목록.length) { 첨부없음++; continue; }
  const s = 집셈.get(h) || { 공고: 0, 첨부: 0 };
  s.공고++; s.첨부 += 목록.length;
  집셈.set(h, s);
  for (const f of 목록) {
    첨부.더하기({ job_id: j.id, kind: '공고문', name: f.name, url: f.url });
    줄수++;
  }
  if (견본.length < 10) {
    견본.push({ id: j.id, 기관: j.org_name, 개수: 목록.length,
      첫: (목록[0] && 목록[0].name) || '' });
  }
}

console.log('\n쪽 열림 ' + 열림 + '건 · 첨부 잡힌 공고 ' + [...집셈.values()].reduce((a, v) => a + v.공고, 0)
  + '건 · 첨부 줄 ' + 줄수 + '개 · 첨부 없는 공고 ' + 첨부없음 + '건 · 탈 ' + 탈 + '건');
if (집셈.size) {
  console.log('\n── 집별 (첨부가 새로 잡히는 수) ──');
  for (const [h, v] of [...집셈].sort((a, b) => b[1].첨부 - a[1].첨부)) {
    console.log('  ' + String(v.첨부).padStart(4) + '개  공고 ' + String(v.공고).padStart(3) + '건  ' + h);
  }
}
if (견본.length) {
  console.log('\n견본 (앞 ' + 견본.length + '건) —');
  for (const s of 견본) {
    console.log('  ' + s.id.padEnd(16) + String(s.기관 || '').slice(0, 14).padEnd(16)
      + '첨부 ' + s.개수 + '개 · 첫 것 ' + s.첫.slice(0, 48));
  }
}
await 첨부.끝내기(cfg);
if (!진짜) console.log('\n[마른] 담지 않았습니다 — 담으려면 POTJOB_ATTACH_WRITE=1 … --진짜');
