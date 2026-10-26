/* 알리오(AL·AL2·AL2C) 공고의 **첨부 줄을 만듭니다** (2026-10-22 세중님 4번의 뒤)
 *
 *   node tools/알리오첨부채우기.mjs                  무엇이 생길지만 (기본 · 마른)
 *   POTJOB_ATTACH_WRITE=1 node tools/알리오첨부채우기.mjs --진짜 --몇개 10
 *   node tools/알리오첨부채우기.mjs --회원만
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 세중님 4번을 걸음별로 짚어 보니, 스캔 PDF 공고(대전보훈병원 306248)의 칸이
 * 비어 있던 **유일한 까닭이 ① 걸음**이었습니다 — `job_attachments` 에 그 공고의
 * 줄이 **0건**이어서 첨부되메우기가 아예 안 봤습니다. 서버에서 그 PDF 를 받아
 * OCR 로 6,525자를 읽고 칸뽑기에 넣으니 **모집인원 {물리치료사: 4}** 까지 나왔습니다.
 * 같은 꼴이 **알리오 547건 중 485건(89%)** 입니다.
 *
 * 까닭은 수집기 쪽 시각입니다 — 첨부를 담기 시작한 것이 2026-10-11 이고,
 * 그 뒤로는 **새 번호만** 상세를 엽니다(호출을 안 늘리려고). 그래서 그 전에 담긴
 * 공고는 첨부 줄이 없습니다. 이 도구가 그 공고들만 한 번 메웁니다.
 *
 * ★ 주소는 상세 API 가 주는 **그 주소 그대로** 담습니다 — 지어내지 않습니다.
 *   `files[].atchFileType === 'A'` 가 공고문입니다 (코드 정의서 · 지침 4절).
 * ★ 담는 길은 `첨부담기` 창구뿐입니다 — 하루 상한·겹침 거르기가 거기 있습니다.
 *   `POTJOB_ATTACH_WRITE=1` 이 없으면 창구가 스스로 마른으로 돕니다.
 * ★ 상세 한도는 하루 100,000 입니다(응답 머리글). 485건은 0.5% 입니다.
 */
import fs from 'node:fs';
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기, 받아보기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 첨부모으기 } from './첨부담기.mjs';
import { 공공부르기 } from './공공데이터부르기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(값('--몇개', 40));
const 회원만 = argv.includes('--회원만');
const 간격 = Number(값('--간격', 400));
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';
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
const 바탕 = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다'); process.exit(1); }
if (!cfg.ALIO_DETAIL_KEY) { console.error('ALIO_DETAIL_KEY 가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
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

const 공고 = await 전부('job_posts?select=id,source,org_name,title,url&source=in.(AL,AL2,AL2C)');
const 보임 = 회원만 ? new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id)) : null;
const 첨있 = new Set((await 전부('job_attachments?select=job_id')).map((x) => x.job_id));
const 볼것 = 공고
  .filter((j) => /^\d+$/.test(String(j.id)))          /* 상세는 번호(sn)로만 엽니다 */
  .filter((j) => !첨있.has(j.id))
  .filter((j) => !회원만 || 보임.has(j.id));

console.log('AL·AL2·AL2C 공고 ' + 공고.length + '건 · 첨부 줄 없는 것 ' + 볼것.length + '건'
  + (회원만 ? ' (회원 화면만)' : '') + ' → 앞 ' + Math.min(몇개, 볼것.length) + '건을 봅니다'
  + (진짜 ? '' : ' · **마른**'));

const 첨부 = 첨부모으기('AL2', { 마른: !진짜 });
let 열림 = 0, 첨부없음 = 0, 탈 = 0, 줄수 = 0, 남음 = '';
const 견본 = [];
for (const j of 볼것.slice(0, 몇개)) {
  let box = null;
  try {
    const r = await 공공부르기(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&sn=' + j.id,
      { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (r.code !== 200) throw new Error('HTTP ' + r.code + ' ' + (r.왜 || ''));
    남음 = r.남음 + '/' + r.한도;
    const o = JSON.parse(r.글);
    box = Array.isArray(o && o.result) ? o.result[0] : (o && o.result) || null;
    if (!box) throw new Error('result 가 비었습니다');
  } catch (e) {
    탈++;
    if (탈 <= 3) console.error('  ✗ ' + j.id + ' · ' + String(e.message).slice(0, 70));
    await new Promise((y) => setTimeout(y, 간격));
    continue;
  }
  열림++;
  const 공고문들 = (box.files || []).filter((f) => String(f.atchFileType) === 'A' && f.url);
  if (!공고문들.length) 첨부없음++;
  else {
    for (const f of 공고문들) {
      첨부.더하기({ job_id: j.id, kind: '공고문',
                   name: String(f.atchFileNm || ''), url: String(f.url) });
      줄수++;
    }
    if (견본.length < 10) {
      견본.push({ id: j.id, 기관: j.org_name, 이름: String(공고문들[0].atchFileNm || ''),
                 개수: 공고문들.length, 주소: String(공고문들[0].url) });
    }
  }
  await new Promise((y) => setTimeout(y, 간격));
}

console.log('\n상세 열림 ' + 열림 + '건 · 첨부(공고문) 줄 ' + 줄수 + '건 · 공고문 없는 공고 '
  + 첨부없음 + '건 · 탈 ' + 탈 + '건' + (남음 ? ' · 오늘 남은 몫 ' + 남음 : ''));
if (견본.length) {
  console.log('\n견본 (앞 ' + 견본.length + '건) —');
  for (const s of 견본) {
    console.log('  ' + String(s.id).padEnd(8) + String(s.기관 || '').slice(0, 14).padEnd(16)
      + '공고문 ' + s.개수 + '개 · ' + s.이름.slice(0, 34)
      + '\n           ' + s.주소.slice(0, 100));
  }
}
await 첨부.끝내기(cfg);
if (!진짜) console.log('\n[마른] 담지 않았습니다 — 담으려면 POTJOB_ATTACH_WRITE=1 … --진짜');
