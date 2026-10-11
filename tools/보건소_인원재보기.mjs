/* 보건소에 물리치료사·작업치료사가 **몇 명 있나** 심평원 자료로 셉니다
 * (2026-10-11 · 표본).
 *
 *   node tools/보건소_인원재보기.mjs [몇곳]
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 나라일터 30일치 2,049건을 전수로 세었는데 보건소 치료사 공고가 **0건**
 * 이었습니다 (docs/보건소_어디에올라오나_1011.md). 둘 중 하나입니다 —
 *   ㉮ 보건소가 우리 직군을 거의 안 뽑는다
 *   ㉯ 뽑는데 시군구청 고시공고에만 올리고 나라일터에 안 올린다
 * ㉮ 라면 475곳 수집기는 **품만 드는 일**입니다.
 *
 * **사람이 없으면 공고도 없습니다.** 그러니 인원을 먼저 셉니다 —
 * 웹을 안 긁고, 이미 붙여 둔 API 한 번으로 끝납니다.
 *
 * ── 어디서 받나 (이미 쓰는 곳) ──────────────────────────────
 *   https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8
 *     ykiho 로 묻습니다. 항목 — dtlGnlNopCdNm · gnlNopCnt · gnlNopDtlCd · yadmNm
 *     gnlNopDtlCd 100 = 물리치료사 · 110 = 작업치료사
 *     **값이 없으면 null 입니다 — 0 과 다릅니다** (collect-hira-인원.mjs 머리말)
 *
 * **아무것도 담지 않습니다.** 한도도 기록만 합니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const URL_ = 'https://apis.data.go.kr/B551182/MadmDtlInfoService2.8/getEtcHstInfo2.8';
const 몇곳 = Number(process.argv[2]) || 40;

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
for (const k of ['HIRA_KEY_ENC', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* 보건소·보건의료원 — 시도가 고르게 섞이도록 이름 순으로 띄워 가며 고릅니다 */
const r0 = await fetch(cfg.SUPABASE_URL
  + '/rest/v1/hira_org?select=ykiho,yadm_nm,cl_cd,sido_nm&cl_cd=in.(71,75)&order=yadm_nm.asc&limit=1000',
  { headers: H });
const 전부 = await r0.json();
if (!Array.isArray(전부)) { console.error('기관을 못 받음 — ' + JSON.stringify(전부).slice(0, 200)); process.exit(1); }
const 걸음 = Math.max(1, Math.floor(전부.length / 몇곳));
const 볼것 = 전부.filter((_, i) => i % 걸음 === 0).slice(0, 몇곳);
console.log('보건소·보건의료원 ' + 전부.length + '곳 중 ' + 볼것.length + '곳을 띄워 가며 봅니다 (걸음 ' + 걸음 + ')\n');

const 한칸 = (글, 이름) => {
  const m = 글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? m[1].trim() : '';
};
const 아이템들 = (글) => [...글.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

const 셈 = { 본곳: 0, 못받음: 0, 자료없음: 0, 물리있음: 0, 작업있음: 0, 둘다0: 0 };
let 물리합 = 0; let 작업합 = 0;
const 있는곳 = [];
let 첫원문 = null;

for (const o of 볼것) {
  셈.본곳++;
  let t = '';
  try {
    const r = await fetch(URL_ + '?serviceKey=' + cfg.HIRA_KEY_ENC
      + '&ykiho=' + encodeURIComponent(o.ykiho) + '&numOfRows=100&pageNo=1',
      { headers: { accept: 'application/xml' } });
    t = await r.text();
    if (!r.ok) { 셈.못받음++; continue; }
  } catch { 셈.못받음++; continue; }

  /* 첫 응답은 **원문을 찍습니다** (지침 2절) */
  if (첫원문 === null) {
    첫원문 = t;
    console.log('── 첫 응답 원문 (앞 900자) ──');
    console.log(t.replace(cfg.HIRA_KEY_ENC, '<열쇠>').slice(0, 900));
    const 태그 = [...new Set([...t.matchAll(/<([A-Za-z_][A-Za-z0-9_]*)>/g)].map((m) => m[1]))];
    console.log('\n   항목 이름 — ' + 태그.join(' · ') + '\n');
  }

  const items = 아이템들(t);
  if (!items.length) { 셈.자료없음++; continue; }

  let 물 = null; let 작 = null;
  for (const it of items) {
    const 코드 = String(한칸(it, 'gnlNopDtlCd') || '').padStart(3, '0');
    const n = Number(한칸(it, 'gnlNopCnt'));
    if (코드 === '100') 물 = Number.isFinite(n) ? n : null;
    if (코드 === '110') 작 = Number.isFinite(n) ? n : null;
  }
  if (물) { 셈.물리있음++; 물리합 += 물; }
  if (작) { 셈.작업있음++; 작업합 += 작; }
  if (!물 && !작) 셈.둘다0++;
  else 있는곳.push({ 이름: o.yadm_nm, 시도: o.sido_nm, 물, 작 });
}

console.log('── 결과 ──────────────────────────────────────────');
console.log('  본 곳                ' + 셈.본곳);
console.log('  못 받음              ' + 셈.못받음);
console.log('  인력 자료가 없음      ' + 셈.자료없음);
console.log('  **물리치료사가 있는 곳** ' + 셈.물리있음 + '  (합 ' + 물리합 + '명)');
console.log('  **작업치료사가 있는 곳** ' + 셈.작업있음 + '  (합 ' + 작업합 + '명)');
console.log('  둘 다 없음            ' + 셈.둘다0);
console.log('');
if (있는곳.length) {
  console.log('── 사람이 있는 곳 ──');
  for (const x of 있는곳) console.log('   ' + String(x.시도 || '').padEnd(8) + x.이름
    + '   물리 ' + (x.물 ?? '-') + ' · 작업 ' + (x.작 ?? '-'));
} else {
  console.log('표본에서 **우리 직군이 있는 보건소가 한 곳도 없습니다.**');
}

/* 한도를 기록합니다 (담는 것이 아니라 셈만) */
console.log('\n이번에 쓴 심평원 호출 ' + 셈.본곳 + '번 (하루 한도 10,000)');
console.log('아무것도 담지 않았습니다.');
