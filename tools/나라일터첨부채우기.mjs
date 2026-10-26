/* 나라일터(GJ·GJ2) 공고의 **첨부 줄을 만듭니다** (2026-10-22 세중님 3번 ②)
 *
 *   node tools/나라일터첨부채우기.mjs                무엇이 생길지만 (기본 · 마른)
 *   POTJOB_ATTACH_WRITE=1 node tools/나라일터첨부채우기.mjs --진짜
 *   node tools/나라일터첨부채우기.mjs --몇개 20 --회원만
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * GJ·GJ2 공고 422건 가운데 **292건이 첨부 줄이 없습니다** (API 의 getItemFile 이
 * 늘 주지는 않습니다). 그런데 공고 쪽에는 첨부가 있습니다 —
 *     javascript:gfn_fileDown('공고문_….pdf','1460603110634732','employ/기관이름')
 * 받는 길은 `tools/gojobs-file.mjs` 한 자리입니다 (POST /downFile.do · 원문으로 확인).
 *
 * ★ 주소는 **공고 쪽 주소**를 담습니다 — 클린아이와 같은 꼴입니다.
 *   진짜 내려받기는 POST 라서 주소 하나로 적을 수 없고, **지어내지 않습니다**.
 *   받을 때 쪽을 다시 열어 그 쪽이 말하는 uuid 를 씁니다 (첨부되메우기의 나라일터 갈래).
 * ★ 담는 길은 `첨부담기` 창구뿐입니다 — 하루 상한·겹침 거르기가 거기 있습니다.
 *   `POTJOB_ATTACH_WRITE=1` 이 없으면 창구가 스스로 마른으로 돕니다.
 */
import fs from 'node:fs';
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기, 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부모으기 } from './첨부담기.mjs';
import { 부름찾기, 기본간격 } from './gojobs-file.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(값('--몇개', 40));
const 회원만 = argv.includes('--회원만');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* .env 는 node 로 읽습니다 — 셸에 먹이지 않습니다 (지침 8-12) */
const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
Object.assign(cfg, { ...cfg, ...process.env });
const 바탕 = cfg.SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY || cfg.SUPABASE_ANON_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

/** ★ 이 서버는 **100줄에서 끊습니다** — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 전부(길) {
  const 모은것 = [];
  for (let off = 0; ;) {
    const u = 바탕 + '/rest/v1/' + 차례붙이기(길) + '&limit=1000&offset=' + off;
    /* ★ 2026-10-26 — 지나가는 401·5xx 에 다리가 죽지 않게 **다시 두드립니다** */
    const r = await 받아보기(u, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
  return 모은것;
}

const 공고 = await 전부('job_posts?select=id,source,org_name,title,url,hidden,hold&source=in.(GJ,GJ2)');
const 보임 = 회원만 ? new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id)) : null;
const 첨있 = new Set((await 전부('job_attachments?select=job_id')).map((x) => x.job_id));
const 볼것 = 공고
  .filter((j) => /gojobs\.go\.kr/.test(String(j.url || '')))
  .filter((j) => !첨있.has(j.id))
  .filter((j) => !회원만 || 보임.has(j.id));

console.log('GJ·GJ2 공고 ' + 공고.length + '건 · 첨부 줄 없는 것 ' + 볼것.length + '건'
  + (회원만 ? ' (회원 화면만)' : '') + ' → 앞 ' + Math.min(몇개, 볼것.length) + '건을 봅니다'
  + (진짜 ? '' : ' · **마른**'));

const 첨부 = 첨부모으기('GJ2', { 마른: !진짜 });
let 열림 = 0, 첨부없음 = 0, 탈 = 0, 줄수 = 0;
const 견본 = [];
for (const j of 볼것.slice(0, 몇개)) {
  let 글;
  try {
    const r = await fetch(j.url, { headers: { 'User-Agent': UA } });
    글 = await r.text();
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    탈++;
    if (탈 <= 3) console.error('  ✗ ' + j.id + ' · ' + String(e.message).slice(0, 60));
    await new Promise((y) => setTimeout(y, 기본간격));
    continue;
  }
  열림++;
  const 목록 = 부름찾기(글);
  if (!목록.length) { 첨부없음++; }
  else {
    /* 한 공고에 한 줄 — 주소가 쪽 주소라 겹칩니다. 공고문(점수 높은 것)을 이름으로 */
    첨부.더하기({ job_id: j.id, kind: '공고문', name: 목록[0].이름, url: j.url });
    줄수++;
    if (견본.length < 10) {
      견본.push({ id: j.id, 기관: j.org_name, 이름: 목록[0].이름, 개수: 목록.length });
    }
  }
  await new Promise((y) => setTimeout(y, 기본간격));
}

console.log('\n쪽 열림 ' + 열림 + '건 · 첨부 있는 것 ' + 줄수 + '건 · 첨부 없는 공고 '
  + 첨부없음 + '건 · 탈 ' + 탈 + '건');
if (견본.length) {
  console.log('\n견본 (앞 ' + 견본.length + '건) —');
  for (const s of 견본) {
    console.log('  ' + s.id.padEnd(11) + String(s.기관 || '').slice(0, 14).padEnd(16)
      + '첨부 ' + s.개수 + '개 · 첫 것 ' + s.이름.slice(0, 46));
  }
}
await 첨부.끝내기(cfg);
if (!진짜) console.log('\n[마른] 담지 않았습니다 — 담으려면 POTJOB_ATTACH_WRITE=1 … --진짜');
