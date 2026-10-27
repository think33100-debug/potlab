/* 회원 화면 **표시 꼴**을 전수로 재 봅니다 — 전·후 표 (2026-10-28 세중님 1·2·3번)
 *
 *   node tools/화면표시_점검.mjs             전수 전·후 (읽기만)
 *   node tools/화면표시_점검.mjs --열어보기   지원 링크 **표본 20**을 열어 200 확인
 *   node tools/화면표시_점검.mjs --다보기     안 바뀐 줄도 함께
 *
 * ── 무엇을 재나 ──────────────────────────────────────────────
 *   ① 연봉 꼴      `연봉말()` 의 전(원문) → 후(0,000만원). **못 읽은 줄은 목록**으로
 *   ② 기관 이름     `기관이름말()` 로 법인 표기를 뗀 전 → 후
 *   ③ 지원 링크     `지원링크()` 갈래별 건수 — 공고 / 자사 / 기관홈 / 없음
 *
 * ★ **아무것도 바꾸지 않습니다.** 화면이 쓰는 함수를 **그대로 들여와** 재는 것입니다 —
 *   도구가 제 나름대로 다시 계산하면 자가 두 벌이 됩니다 (지침 6절 · 10-5).
 * ★ 공고를 받는 길은 공용 `모두받기()` 입니다 (지침 8-20 ③).
 */
import fs from 'node:fs';
import path from 'node:path';
import { 모두받기, 받아보기 } from './쪽나눠받기.mjs';
import { 연봉말, 금액있나, 돈꼴, 기관이름말, 지원링크, 내규말 } from '../web/lib/job-state.ts';

const 뿌리 = path.join(import.meta.dirname, '..');
const 열어보기 = process.argv.includes('--열어보기');
const 다보기 = process.argv.includes('--다보기');

const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL·SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

/* 회원 화면 공고 — 먼저 번호를 받고, 90개씩 묶어 칸을 받습니다 */
const 눈 = await 모두받기(U + '/rest/v1/job_posts_pub?select=id', H, { 차례: 'id' });
const ids = 눈.map((r) => r.id);
console.log('회원 화면 공고 ' + ids.length + '건');

const 칸 = ['id', 'org_name', 'url', '뽑은값', 'detail'].map(encodeURIComponent).join(',');
const 줄들 = [];
for (let i = 0; i < ids.length; i += 90) {
  const 묶 = ids.slice(i, i + 90);
  const r = await 받아보기(U + '/rest/v1/job_posts?select=' + 칸
    + '&order=id.asc&id=in.(' + 묶.map((x) => '"' + x + '"').join(',') + ')', { headers: H });
  if (!r.ok) { console.error('✗ 공고 받기 ' + r.status + ' ' + (await r.text()).slice(0, 200)); process.exit(1); }
  줄들.push(...await r.json());
}
console.log('칸을 받은 공고 ' + 줄들.length + '건'
  + (줄들.length === ids.length ? '' : '  ⚠ 분모와 다릅니다'));

/* ══ ① 연봉 꼴 ══ */
const 연봉바뀜 = [];
const 못읽음 = [];
let 연봉있는것 = 0;
for (const j of 줄들) {
  const 뽑 = j['뽑은값'] || {};
  const d = j.detail || {};
  const 원문 = (뽑['예상연봉'] ?? d['연봉'] ?? d['예상연봉'] ?? null) || null;
  if (!원문) continue;
  연봉있는것++;
  const 후 = 연봉말(원문);
  const 전 = 금액있나(원문) ? String(원문).trim() : 내규말;
  if (!돈꼴(원문) && 금액있나(원문)) 못읽음.push({ id: j.id, 원문: String(원문).trim() });
  if (후 !== 전) 연봉바뀜.push({ id: j.id, 전, 후 });
}
console.log('\n══ ① 연봉 꼴 ══');
console.log('연봉 원문이 있는 공고 ' + 연봉있는것 + '건 · **꼴이 바뀐 것 ' + 연봉바뀜.length + '건**'
  + ' · 못 읽어 원문 그대로 둔 것 ' + 못읽음.length + '건');
for (const x of 연봉바뀜.slice(0, 다보기 ? 999 : 40)) {
  console.log('  ' + x.id.padEnd(20) + String(x.전).slice(0, 44).padEnd(46) + '→  ' + x.후);
}
if (못읽음.length) {
  console.log('\n── 못 읽은 줄 (원문 그대로 그립니다 · 단위 모름·문단) ──');
  for (const x of 못읽음) console.log('  ' + x.id.padEnd(20) + x.원문.slice(0, 80));
}

/* ══ ② 기관 이름 ══ */
const 이름바뀜 = new Map();
for (const j of 줄들) {
  const 후 = 기관이름말(j.org_name);
  if (후 !== String(j.org_name || '').trim()) 이름바뀜.set(j.org_name, 후);
}
console.log('\n══ ② 기관 이름 — 법인 표기 뗀 곳 ' + 이름바뀜.size + '곳 ══');
for (const [전, 후] of [...이름바뀜].slice(0, 다보기 ? 999 : 30)) {
  console.log('  ' + String(전).slice(0, 40).padEnd(42) + '→  ' + 후);
}

/* ══ ③ 지원 링크 갈래 ══ */
const 갈래셈 = { 공고: 0, 자사: 0, 기관홈: 0, 없음: 0 };
const 없는것 = [];
const 표본 = [];
for (const j of 줄들) {
  const d = j.detail || {};
  const r = 지원링크(j.url, d['접수방법'], d['기관홈']);
  갈래셈[r.갈래] += 1;
  if (r.갈래 === '없음') 없는것.push(j.id);
  else 표본.push({ id: j.id, 갈래: r.갈래, 주소: r.주소 });
}
console.log('\n══ ③ 지원 링크 ══');
console.log('공고 주소 ' + 갈래셈.공고 + '건 · 자사채용사이트 ' + 갈래셈.자사 + '건'
  + ' · 기관 홈페이지 ' + 갈래셈.기관홈 + '건 · **없음(단추 숨김) ' + 갈래셈.없음 + '건**');
if (없는것.length) console.log('  없음 — ' + 없는것.slice(0, 20).join(' '));

if (!열어보기) { console.log('\n[마른] 주소를 안 열었습니다 — --열어보기 로 표본 20을 봅니다'); process.exit(0); }

/* 표본 20 — **출처마다 골고루** 뽑습니다. 한 출처에서 몰아 뽑으면 그 출처만 본 셈입니다
   (번호 차례로 앞에서 스무 개를 집으면 알리오·고용24만 나옵니다 — 워크넷이 제일 많은데) */
const 출처 = (id) => (String(id).match(/^[A-Za-z]+/) || ['번호'])[0];
const 통 = new Map();
for (const x of 표본) {
  const k = x.갈래 + '/' + 출처(x.id);
  if (!통.has(k)) 통.set(k, []);
  통.get(k).push(x);
}
const 뽑기 = [];
for (let 차례 = 0; 뽑기.length < 20; 차례 += 1) {
  let 더넣었나 = false;
  for (const [, 것들] of 통) {
    if (것들[차례] && 뽑기.length < 20) { 뽑기.push(것들[차례]); 더넣었나 = true; }
  }
  if (!더넣었나) break;
}
console.log('\n── 표본 ' + 뽑기.length + '건 열어 보기 ──');
let 열림 = 0;
for (const x of 뽑기) {
  let 글 = '';
  try {
    const r = await fetch(x.주소, { redirect: 'follow', signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; potjob/1.0)' } });
    글 = r.status + (r.ok ? '' : ' ✗');
    if (r.ok) 열림++;
  } catch (e) { 글 = '못 받음 · ' + String(e.message || e).slice(0, 40); }
  console.log('  [' + x.갈래 + '] ' + x.id.padEnd(20) + 글.padEnd(16) + String(x.주소).slice(0, 70));
}
console.log('\n열린 것 ' + 열림 + ' / ' + 뽑기.length);
console.log('★ 아무것도 바꾸지 않았습니다 (읽기만).');
