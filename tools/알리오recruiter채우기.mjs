/* 알리오 공고 가운데 **주소가 recruiter 공고 쪽**인 것을 상세로 채웁니다
 * (2026-10-22 세중님 3번 ③)
 *
 *   node tools/알리오recruiter채우기.mjs                 무엇이 열릴지만 (기본 · 마른)
 *   POTJOB_ATTACH_WRITE=1 node tools/알리오recruiter채우기.mjs --진짜
 *   node tools/알리오recruiter채우기.mjs --몇개 10
 *
 * ── 왜 ──────────────────────────────────────────────────────────
 * 「알리오는 JS 라 못 읽는다」고 적어 뒀는데, **주소를 세어 보니 아니었습니다**
 * (지침 6절 — 받는 길을 새로 만들기 전에 이미 담긴 주소가 맞는지 먼저 봅니다).
 * AL·AL2 546건의 주소 꼴 —
 *     226 알리오 · 195 그밖 쪽 · 62 **기관/recruiter 첫 화면** ·
 *      32 recruiter 공고 쪽(MRS2) · 31 recruiter 공고 쪽(신형)
 * 신형 31건은 `career/jobs/<positionSn>` 이라 **오늘 만든 jobflex 상세()** 로
 * 바로 열립니다. 첫 화면 62건은 공고 쪽이 아니어서 이 도구로는 못 엽니다
 * (제목으로 목록에서 찾는 길은 따로 재고 정합니다 — 짐작으로 안 만듭니다).
 */
import fs from 'node:fs';
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 상세 } from './hosp/jobflex.mjs';
import { 첨부모으기 } from './첨부담기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(값('--몇개', 40));

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
    const r = await fetch(바탕 + '/rest/v1/' + 차례붙이기(길)
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

/** `https://<호스트>.recruiter.co.kr/career/jobs/<sn>` 에서 호스트와 번호 */
export function 갈라보기(주소) {
  const m = String(주소 || '').match(/^https?:\/\/([a-z0-9-]+)[.]recruiter[.]co[.]kr\/career\/jobs\/(\d+)/i);
  return m ? { 호스트: m[1], 번호: m[2] } : null;
}

if (argv.includes('--자기점검')) {
  let 틀림 = 0;
  const 봐 = (이름, 참) => { if (!참) { 틀림++; console.error('✗ ' + 이름); } };
  봐('신형 공고 쪽을 가른다',
    JSON.stringify(갈라보기('https://scmc.recruiter.co.kr/career/jobs/131589'))
      === JSON.stringify({ 호스트: 'scmc', 번호: '131589' }));
  봐('첫 화면은 안 가른다', 갈라보기('https://nhimc.recruiter.co.kr/') === null);
  봐('MRS2 는 안 가른다',
    갈라보기('https://cbnuh.recruiter.co.kr/app/jobnotice/view?jobnoticeSn=267767') === null);
  봐('알리오 주소는 안 가른다', 갈라보기('https://www.alio.go.kr/recruit') === null);
  console.log(틀림 ? '★ 자기 점검 ' + 틀림 + '가지 실패' : '○ 자기 점검 통과 — 주소 가름 4가지');
  process.exit(틀림 ? 1 : 0);
}

const 공고 = await 전부('job_posts?select=id,source,org_name,title,url&source=in.(AL,AL2)');
const 본문있 = new Set((await 전부('job_body?select=job_id')).map((x) => x.job_id));
const 볼것 = 공고.map((j) => ({ ...j, 쪼갠것: 갈라보기(j.url) }))
  .filter((j) => j.쪼갠것 && !본문있.has(j.id));

console.log('AL·AL2 ' + 공고.length + '건 · recruiter 신형 공고 쪽이고 본문이 없는 것 '
  + 볼것.length + '건 → 앞 ' + Math.min(몇개, 볼것.length) + '건'
  + (진짜 ? '' : ' · **마른**'));

const 첨부 = 첨부모으기('AL2', { 마른: !진짜 });
const 원문들 = [];
let 열림 = 0, 탈 = 0, 첨부줄 = 0;
const 견본 = [];
for (const j of 볼것.slice(0, 몇개)) {
  const d = await 상세(j.쪼갠것.호스트, j.쪼갠것.번호);
  if (d.왜) {
    탈++;
    if (탈 <= 3) console.error('  ✗ ' + j.id + ' · ' + d.왜);
    await new Promise((y) => setTimeout(y, 400));
    continue;
  }
  열림++;
  const 글만 = String(d.글 || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (글만.length > 60) 원문들.push({ job_id: j.id, kind: '상세', ord: 0, url: j.url, body: d.글 });
  for (const f of d.첨부) {
    첨부.더하기({ job_id: j.id, kind: '공고문', name: f.이름, url: f.주소 });
    첨부줄++;
  }
  if (견본.length < 10) {
    견본.push({ id: j.id, 기관: j.org_name, 글: 글만.length, 첨부: d.첨부.length,
      마감: d.마감, 시각: d.마감시각, 첫첨부: (d.첨부[0] || {}).이름 || '' });
  }
  await new Promise((y) => setTimeout(y, 400));
}

console.log('\n열림 ' + 열림 + '건 · 탈 ' + 탈 + '건 · 글 60자 넘는 것 ' + 원문들.length
  + '건 · 첨부 ' + 첨부줄 + '개');
if (견본.length) {
  console.log('\n견본 (앞 ' + 견본.length + '건) —');
  for (const s of 견본) {
    console.log('  ' + s.id.padEnd(9) + String(s.기관 || '').slice(0, 14).padEnd(16)
      + '글 ' + String(s.글).padStart(5) + '자 · 첨부 ' + s.첨부 + '개 · 마감 '
      + (s.마감 || '-') + ' ' + (s.시각 || '') + ' · ' + s.첫첨부.slice(0, 34));
  }
}

if (!진짜) {
  await 첨부.끝내기(cfg);
  console.log('\n[마른] 담지 않았습니다 — 담으려면 POTJOB_ATTACH_WRITE=1 … --진짜');
} else {
  /* 본문은 collect_body 창구로 (AL2 열쇠) */
  const 열쇠이름 = cfg.COLLECT_KEY_AL2 ? 'COLLECT_KEY_AL2' : (cfg.COLLECT_KEY_JF ? 'COLLECT_KEY_JF' : null);
  let 글담음 = 0;
  if (!열쇠이름) console.error('  ★ collect_body 열쇠가 없습니다 — 본문은 못 담습니다');
  else {
    for (let i = 0; i < 원문들.length; i += 50) {
      const r = await fetch(바탕 + '/rest/v1/rpc/collect_body', {
        method: 'POST',
        headers: { ...머리, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_secret: cfg[열쇠이름], p_source: 'AL2', p_rows: 원문들.slice(i, i + 50) }),
      });
      const t = await r.text();
      if (!r.ok) { console.error('  ✗ collect_body — ' + t.slice(0, 140)); break; }
      try { 글담음 += (JSON.parse(t)['담음']) || 0; } catch { /* 셈만 못 셉니다 */ }
    }
    console.log('전문        ' + 글담음 + '건 (job_body · 보낸 것 ' + 원문들.length + ')');
  }
  await 첨부.끝내기(cfg);
}
