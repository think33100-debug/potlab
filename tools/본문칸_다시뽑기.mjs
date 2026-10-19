/* 이미 담긴 **본문에서 칸을 다시 뽑습니다** (2026-10-19)
 *
 *   node tools/본문칸_다시뽑기.mjs                무엇이 채워질지만 (기본 · 마른)
 *   node tools/본문칸_다시뽑기.mjs --진짜         담습니다
 *   node tools/본문칸_다시뽑기.mjs --출처 HS3,HS  출처 고르기 (기본 HS3,HS,GJ2,CE2)
 *   node tools/본문칸_다시뽑기.mjs --전부         회원 화면 밖까지
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 뽑기 규칙을 고쳐도 **이미 담긴 공고는 안 고쳐집니다**(지침 9절). 본문은
 * `job_body` 에 있으니 **API·사이트를 두드리지 않고** 다시 뽑을 수 있습니다.
 *
 * 2026-10-19 에 회원 화면 1층 공고의 칸을 재 보니 —
 *   HS3 20건  모집인원 10% · 지원자격 30% · 예상연봉 20%
 *   GJ2  7건  모집인원  0% · 예상연봉 14%
 * 그래서 글 꼴 모집인원 규칙을 더했고(공고문읽기.mjs ②-2), 그 규칙을
 * 이미 담긴 본문에 **되먹입니다.**
 *
 * ★ 담는 길은 `칸되메우기` 창구뿐입니다 — `edited_fields`·`admin_locked` 를
 *   건너뛰고 `updated_at` 을 안 바꿉니다.
 * ★ 되돌리는 법 — `칸기록` 에 칸마다 옛값이 남습니다:
 *     select job_id, 칸, 옛값 from 칸기록 where 누가='첨부 되메우기' and 바뀐때 > '…';
 *   그 옛값을 같은 창구로 다시 보내면 돌아갑니다.
 */
import fs from 'node:fs';
import { 칸뽑기 } from './공고문읽기.mjs';
import { 차례붙이기 } from './쪽나눠받기.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 전부다 = argv.includes('--전부');
const 출처 = (argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS3,HS,GJ2,CE2')
  .split(',').map((s) => s.trim()).filter(Boolean);

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

async function 전부(길) {
  const out = [];
  const 길2 = 차례붙이기(길);
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길2 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 40000) break;
  }
  return out;
}

const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,title,headcount,work_place,'
  + 'apply_to,apply_to_time,detail,뽑은값,edited_fields,admin_locked&source=in.('
  + 출처.join(',') + ')');
const 볼것 = 다.filter((x) => 전부다 || 보임.has(x.id));
console.log('출처 ' + 출처.join('·') + ' — 공고 ' + 다.length + '건 중 볼 것 ' + 볼것.length + '건'
  + (전부다 ? ' (--전부)' : ' (회원 화면만)'));

/* 본문을 묶어 받습니다 — 한 공고에 여러 줄(본문·첨부)이 있습니다 */
const 글표 = new Map();
for (let i = 0; i < 볼것.length; i += 40) {
  const 조각 = 볼것.slice(i, i + 40).map((x) => encodeURIComponent(x.id)).join(',');
  for (const b of await 전부('job_body?select=job_id,kind,ord,body&job_id=in.(' + 조각 + ')')) {
    글표.set(b.job_id, (글표.get(b.job_id) || '') + '\n' + String(b.body || ''));
  }
}
console.log('본문이 있는 공고 ' + 글표.size + '건\n');

const 칸줄 = []; const 채울것 = { 모집인원: 0, 지원자격: 0, 예상연봉: 0, 근무지: 0, 마감시각: 0 };
const 견본 = [];
for (const x of 볼것) {
  const 글 = 글표.get(x.id);
  if (!글 || 글.trim().length < 50) continue;
  let r;
  try { r = 칸뽑기(글, 글); } catch (e) { console.error('✗ ' + x.id + ' · ' + String(e.message).slice(0, 60)); continue; }
  const 줄 = { id: x.id }; const 뽑은값 = {}; const 근거 = {};

  /* 모집인원 — **우리 직군 인원의 합**. 칸뽑기가 직군별로 냅니다 */
  const 인원합 = Object.values(r.모집인원 || {}).reduce((a, b) => a + (Number(b) || 0), 0);
  if (인원합 > 0 && x.headcount == null) {
    줄.headcount = 인원합; 채울것.모집인원++;
    근거.모집인원 = Object.entries(r.근거 || {}).filter(([k]) => k.startsWith('모집인원'))
      .map(([, v]) => v).join(' / ').slice(0, 200);
  }
  const 이미자격 = (x['뽑은값'] && x['뽑은값'].지원자격)
    || (x.detail && (x.detail['뽑은값']?.지원자격 || x.detail.지원자격)) || null;
  if (r.지원자격 && !이미자격) { 뽑은값.지원자격 = r.지원자격; 근거.지원자격 = r.근거?.지원자격 || ''; 채울것.지원자격++; }
  const 이미연봉 = (x['뽑은값'] && x['뽑은값'].예상연봉)
    || (x.detail && (x.detail['뽑은값']?.예상연봉 || x.detail.연봉)) || null;
  if (r.예상연봉 && !이미연봉) { 뽑은값.예상연봉 = r.예상연봉; 근거.예상연봉 = r.근거?.예상연봉 || ''; 채울것.예상연봉++; }
  if (r.근무지 && !String(x.work_place || '').trim()) { 줄.work_place = r.근무지; 채울것.근무지++; }
  /* ★ 마감 **날짜**가 없으면 시각만 넣지 않습니다 — 화면에 쓸모가 없고,
     날짜 없는 시각은 어느 날 몇 시인지 말해 주지 못합니다 (2026-10-19) */
  if (r.접수시각 && x.apply_to_time == null && x.apply_to != null) {
    줄.apply_to_time = r.접수시각; 근거.마감시각 = r.근거?.접수시각 || ''; 채울것.마감시각++;
  }

  if (Object.keys(뽑은값).length) {
    뽑은값.본문다시뽑은근거 = 근거;
    줄.뽑은값 = 뽑은값;
  }
  if (Object.keys(줄).length > 1) {
    칸줄.push(줄);
    if (견본.length < 20) 견본.push({ x, 줄, r, 근거 });
  }
}

console.log('── 채워질 칸 ──');
for (const [k, v] of Object.entries(채울것)) console.log('  ' + k.padEnd(6) + v + '건');
console.log('\n── 견본 (앞 ' + 견본.length + '건 · 근거와 함께) ──');
for (const { x, 줄, 근거 } of 견본) {
  console.log('  ' + x.id + ' [' + x.source + '] ' + String(x.org_name).slice(0, 16)
    + (보임.has(x.id) ? ' (회원 화면)' : ''));
  console.log('     ' + String(x.title).slice(0, 56));
  if (줄.headcount) console.log('     모집인원 → ' + 줄.headcount + '   근거 「' + String(근거.모집인원 || '').slice(0, 110) + '」');
  if (줄.work_place) console.log('     근무지 → 「' + String(줄.work_place).slice(0, 50) + '」');
  if (줄.apply_to_time) {
    console.log('     마감시각 → ' + 줄.apply_to_time + '   마감일 ' + (x.apply_to || '(없음)')
      + '   근거 「' + String(근거.마감시각 || '').replace(/s+/g, ' ').slice(0, 90) + '」');
  }
  if (줄.뽑은값?.지원자격) console.log('     지원자격 → 「' + String(줄.뽑은값.지원자격).replace(/\s+/g, ' ').slice(0, 80) + '」');
  if (줄.뽑은값?.예상연봉) console.log('     예상연봉 → 「' + String(줄.뽑은값.예상연봉).slice(0, 50) + '」');
}

if (!칸줄.length) { console.log('\n채울 것이 없습니다'); process.exit(0); }
if (!진짜) { console.log('\n[마른] 아무것도 안 담습니다 — 담으려면 --진짜'); process.exit(0); }

console.log('\n칸을 담습니다 — ' + 칸줄.length + '건');
let 함 = 0;
for (let i = 0; i < 칸줄.length; i += 50) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 칸줄.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  함 += 칸줄.slice(i, i + 50).length;
  if (i === 0) console.log('  창구가 답한 것 — ' + t.slice(0, 240));
}
console.log('  ' + 함 + '/' + 칸줄.length);
console.log('\n되돌리는 법 — 칸기록에서 옛값을 꺼내 같은 창구로 다시 보냅니다:');
console.log("  select job_id, 칸, 옛값 from 칸기록 where 누가='첨부 되메우기' and 바뀐때 > now() - interval '1 hour';");
