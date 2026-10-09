/* 공고통일점검 — 회원에게 **보이는 공고 전부**가 일곱 칸으로 통일돼 있나.
 *
 *   node tools/공고통일점검.mjs [--낼곳 tmp/점검전.json]
 *
 * **DB 를 한 줄도 안 바꿉니다** (select 만). 결과는 파일로만 냅니다.
 *
 * ── 화면과 **같은 규칙**으로 셉니다 (web/app/jobs/[id]/page.tsx) ──────
 *   모집 인원   headcount != null                     ← 뽑은값은 **안 봅니다**
 *   접수 마감   apply_to (없으면 「마감일 공고문 확인」으로 늘 그려집니다)
 *   근무지      지역보임 ?? work_place
 *   지원 자격   뽑은값.지원자격 ?? detail.지원자격
 *   예상 연봉   뽑은값.예상연봉 ?? detail.연봉 ?? detail.예상연봉
 *   얼마나 바쁜 곳 · 병원 뜯어보기 — **기관 자료**라 공고와 무관합니다.
 *     세중님 기준대로 「채움」으로 따로 표시만 하고 채움 비율에서 뺍니다.
 *
 * 기준을 두 벌로 만들면 화면 숫자와 도구 숫자가 달라집니다 (작업지침 6절).
 * 화면 코드를 읽고 맞췄습니다 — 짐작으로 쓰지 않았습니다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.'); process.exit(2); }

const 인수 = (이름, 기본) => {
  const i = process.argv.indexOf('--' + 이름);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : 기본;
};
const 낼곳 = path.join(뿌리, 인수('낼곳', 'tmp/점검전.json'));
const 보류도 = process.argv.includes('--보류도');

async function 한쪽(길, 부터, 까지) {
  const r = await fetch(URL_ + '/rest/v1/' + 길,
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${부터}-${까지}` } });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
/* PostgREST 는 한 번에 100줄에서 끊습니다 (작업지침 6절) */
async function 읽기(길, 한쪽수 = 100, 최대 = 40000) {
  const out = [];
  for (let 부터 = 0; 부터 < 최대; 부터 += 한쪽수) {
    const 묶음 = await 한쪽(길, 부터, 부터 + 한쪽수 - 1);
    if (!묶음.length) break;
    out.push(...묶음);
    if (묶음.length < 한쪽수) break;
  }
  return out;
}

const 칸 = 'id,source,org_name,title,job_group,headcount,apply_from,apply_to,apply_to_time,'
  + 'work_place,detail,뽑은값,뽑은때,edited_fields,admin_locked,hidden,hold,url';

const 보이는 = await 읽기(`job_posts?select=${encodeURIComponent(칸)}`
  + '&hidden=eq.false&hold=eq.false&order=id.asc');
/* 지역보임은 job_posts 칸이 아니라 **뷰가 만드는 값**입니다 — 화면이 그걸 먼저 봅니다 */
const 터집 = new Map((await 읽기('job_posts_pub?select=id,지역보임&order=id.asc')).map((x) => [x.id, x.지역보임]));
for (const j of 보이는) j.지역보임 = 터집.get(j.id) ?? null;
const 보류 = 보류도
  ? await 읽기(`job_posts?select=${encodeURIComponent(칸)}&hold=eq.true&order=id.asc`)
  : [];
const 글자 = await 읽기('job_body?select=job_id,kind,file_name,url,body');
const 글자집 = new Map(글자.map((b) => [b.job_id, b]));

/* ── 칸 재기 — 화면과 같은 규칙 ─────────────────────────── */
export function 칸재기(j) {
  const d = j.detail ?? {}; const p = j.뽑은값 ?? {};
  const 잠김 = new Set(j.edited_fields ?? []);
  const 값 = {};

  값.모집인원 = j.headcount != null
    ? { 값: j.headcount + '명', 출처: '상세API(headcount)', 근거: `headcount = ${j.headcount}` }
    : null;

  값.접수마감 = j.apply_to
    ? { 값: j.apply_to, 출처: '상세API(apply_to)', 근거: `apply_to = ${j.apply_to}` }
    : null;

  const 터 = j.지역보임 ?? j.work_place ?? null;
  값.근무지 = 터
    ? { 값: 터, 출처: j.지역보임 ? '상세API(지역보임)' : '상세API(work_place)',
        근거: `${j.지역보임 ? '지역보임' : 'work_place'} = ${터}` }
    : null;

  const 자격 = (p['지원자격'] ?? d['지원자격'] ?? null) || null;
  값.지원자격 = 자격
    ? { 값: String(자격).slice(0, 200),
        출처: p['지원자격'] ? '뽑은값' : '상세API(detail.지원자격)',
        근거: (p['지원자격'] ? '뽑은값.지원자격' : 'detail.지원자격') }
    : null;

  const 연봉 = (p['예상연봉'] ?? d['연봉'] ?? d['예상연봉'] ?? null) || null;
  값.예상연봉 = 연봉
    ? { 값: String(연봉).slice(0, 120),
        출처: p['예상연봉'] ? '뽑은값' : '상세API(detail.연봉)',
        근거: (p['예상연봉'] ? '뽑은값.예상연봉' : 'detail.연봉') }
    : null;

  /* 기관 자료 둘 — 공고와 무관합니다. 세중님 기준대로 따로 표시만 */
  값.얼마나바쁜곳 = { 값: '(심평원 치료사 수)', 출처: '기관 자료', 근거: '공고와 무관' };
  값.병원뜯어보기 = { 값: '(기관표)', 출처: '기관 자료', 근거: '공고와 무관' };

  /* 사람이 정한 칸은 비교만 합니다 */
  for (const k of Object.keys(값)) {
    if (잠김.has(k) || j.admin_locked) {
      값[k] = 값[k] ? { ...값[k], 사람이정함: true } : { 값: null, 출처: '사람이 정함(비움)', 사람이정함: true };
    }
  }
  return 값;
}

const 공고칸 = ['모집인원', '접수마감', '근무지', '지원자격', '예상연봉'];
const 기관칸 = ['얼마나바쁜곳', '병원뜯어보기'];

function 재기(줄들) {
  const 결과 = [];
  const 셈 = Object.fromEntries([...공고칸, ...기관칸].map((k) => [k, 0]));
  const 출처별 = {};
  for (const j of 줄들) {
    const 값 = 칸재기(j);
    const 빈칸 = 공고칸.filter((k) => !값[k] || !값[k].값);
    for (const k of [...공고칸, ...기관칸]) if (값[k] && 값[k].값) 셈[k]++;
    출처별[j.source] ||= { 공고: 0, ...Object.fromEntries(공고칸.map((k) => [k, 0])) };
    출처별[j.source].공고++;
    for (const k of 공고칸) if (값[k] && 값[k].값) 출처별[j.source][k]++;
    결과.push({
      id: j.id, source: j.source, org_name: j.org_name,
      title: String(j.title ?? '').slice(0, 120), job_group: j.job_group,
      url: j.url ?? null,
      공고문있나: 글자집.has(j.id),
      공고문글자수: (글자집.get(j.id)?.body ?? '').length,
      공고문이름: 글자집.get(j.id)?.file_name ?? null,
      공고문주소: 글자집.get(j.id)?.url ?? null,
      사람이정한칸: j.edited_fields ?? [],
      admin_locked: !!j.admin_locked,
      값, 빈칸,
    });
  }
  return { 결과, 셈, 출처별 };
}

const 전 = 재기(보이는);
const 보류결과 = 보류도 ? 재기(보류) : null;

fs.mkdirSync(path.dirname(낼곳), { recursive: true });
fs.writeFileSync(낼곳, JSON.stringify({
  잰때: new Date().toISOString(),
  보이는공고: 보이는.length,
  보류공고: 보류.length,
  공고문있는줄: 글자.length,
  공고칸, 기관칸,
  전: 전,
  보류: 보류결과,
}, null, 1) + '\n');

console.log(`\n── 지금 상태 (전) · ${보이는.length}건 ──────────────────`);
for (const k of 공고칸) {
  console.log('  ' + k.padEnd(10) + String(전.셈[k]).padStart(4) + '/' + 보이는.length
    + '  ' + String(Math.round(전.셈[k] / 보이는.length * 100)).padStart(3) + '%');
}
for (const k of 기관칸) console.log('  ' + k.padEnd(10) + '   — 기관 자료 (따로)');

console.log('\n── 수집원별 ─────────────────────────────────────────');
console.log('  출처   공고   ' + 공고칸.map((k) => k.slice(0, 4).padStart(6)).join(''));
for (const [s, v] of Object.entries(전.출처별).sort((a, b) => b[1].공고 - a[1].공고)) {
  console.log('  ' + s.padEnd(6) + String(v.공고).padStart(4) + '   '
    + 공고칸.map((k) => (Math.round(v[k] / v.공고 * 100) + '%').padStart(6)).join(''));
}

const 빈칸많은것 = 전.결과.filter((r) => r.빈칸.length);
console.log(`\n  빈 칸이 있는 공고 ${빈칸많은것.length}건`
  + ` · 공고문 글자가 있는 것 ${전.결과.filter((r) => r.공고문있나).length}건`);
console.log(`\n○ → ${path.relative(뿌리, 낼곳)}`);
