/* 알리오 공고 한 건이 **어느 관문에서 어떻게 갈리는지** 짚어 봅니다.
 *
 *   node tools/alio-one.mjs 305299
 *
 * 새 수집기(collect-alio.mjs)와 같은 함수를 같은 차례로 부릅니다.
 * 「왜 이게 안 담겼지」 를 다섯 번 짐작하는 대신 한 번에 보려고 만들었습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchJob, notOurs, titleOtherOnly, MEDTECH } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const de = (s) => String(s ?? '').replace(/&#xD;/gi, '\n').replace(/&amp;/g, '&');

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !out[m[1]]) out[m[1]] = m[2];
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  const gas = path.join(여기, '..', 'gas', 'wage.js');
  if (fs.existsSync(gas)) {
    const src = fs.readFileSync(gas, 'utf8');
    out.ALIO_LIST_KEY = out.ALIO_LIST_KEY || (src.match(/const JOB_API = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1];
    out.ALIO_DETAIL_KEY = out.ALIO_DETAIL_KEY || (src.match(/const ALIO_D = \{[\s\S]*?KEY:\s*'([^']+)'/) || [])[1];
  }
  return out;
}
const cfg = env();
const sn = process.argv[2];
if (!sn) { console.log('공고 번호를 주세요 — node tools/alio-one.mjs 305299'); process.exit(1); }

/* 목록에서 그 건을 찾습니다 (수집기가 보는 것과 같은 줄) */
let r0 = null;
for (let p = 1; p <= 10 && !r0; p++) {
  const q = new URLSearchParams({ pageNo: String(p), numOfRows: '100', ongoingYn: 'Y' });
  const res = await fetch('https://opendata.alio.go.kr/new/v1/recruit/list.do?serviceKey='
    + cfg.ALIO_LIST_KEY + '&' + q, { method: 'POST', headers: { accept: 'application/json' } });
  const j = JSON.parse(await res.text());
  r0 = (j.result || []).find((x) => String(x.recrutPblntSn) === String(sn)) || null;
  if ((j.result || []).length < 100) break;
}
if (!r0) { console.log('접수중 목록에 없습니다 (마감됐거나 번호가 다릅니다)'); process.exit(0); }

const title = de(r0.recrutPbancTtl);
console.log('제목   ' + title);
console.log('기관   ' + de(r0.instNm) + '\n');

const 줄 = (n, 값, 말) => console.log('  ' + String(n).padEnd(26) + String(값).padEnd(14) + (말 || ''));
console.log('── 관문을 차례로 ──');
줄('① notOurs(제목)', notOurs(title), notOurs(title) ? '← 여기서 버립니다' : '');
if (notOurs(title)) process.exit(0);

let job = matchJob(title), 근거 = job ? '제목' : '';
줄('② matchJob(제목)', JSON.stringify(job), job ? '← 회원 목록' : '');

/* 우대 칸은 빼고 봅니다 — collect-alio.mjs 와 **같은 잣대**여야 합니다.
   진단이 수집기와 다르게 생각하면 진단이 거짓말을 합니다 */
const 우대칸 = ['prefCn', 'prefCondCn'];
const hay = Object.entries(r0).filter(([k]) => !우대칸.includes(k))
  .map(([, v]) => String(v ?? '')).join(' ');
const 우대글 = 우대칸.map((k) => String(r0[k] ?? '')).join(' ');
let 우대에만 = !!matchJob(우대글);
if (!job) { job = matchJob(hay); if (job) 근거 = '목록'; }
줄('③ matchJob(목록 · 우대 뺀 것)', JSON.stringify(job), job ? '← 회원 목록 (근거: 목록)' : '');
줄('   우대 칸에 있나', 우대에만, 우대에만 && !job ? '← 보류함 후보' : '');
console.log('\n  ※ 어느 칸에 있나 —');
for (const [k, v] of Object.entries(r0)) {
  const t = de(typeof v === 'object' ? JSON.stringify(v) : v);
  if (/작업치료|물리치료/.test(t)) {
    console.log('     ★ ' + k + ' (' + t.length + '자)' + (우대칸.includes(k) ? '   ← 우대 칸' : ''));
  }
}

if (!job) {
  const res = await fetch('https://apis.data.go.kr/1051000/recruitment/detail?serviceKey='
    + cfg.ALIO_DETAIL_KEY + '&sn=' + String(sn).replace(/\D/g, ''));
  const j = JSON.parse(await res.text());
  const box = Array.isArray(j.result) ? j.result[0] : j.result;
  if (!box) { 줄('④ 상세', '못 받음'); process.exit(0); }
  const names = (box.steps || []).map((s) => de(s.recrutPbancTtl).trim()).filter(Boolean);
  줄('④ steps', names.length + '개', names.join(' / ').slice(0, 60));
  const j1 = matchJob(names.join(' · '));
  줄('   matchJob(steps)', JSON.stringify(j1), j1 ? '← 회원 목록' : '');
  if (!j1) {
    const j2 = matchJob(String(box.aplyQlfcCn || ''));
    줄('⑤ matchJob(자격요건)', JSON.stringify(j2), j2 ? '← 회원 목록' : '');
    if (!우대에만) 우대에만 = !!matchJob(String(box.prefCn || '') + ' ' + String(box.prefCondCn || ''));
    줄('⑥ 우대 칸에만 있나', 우대에만, 우대에만 ? '← 보류함 (회원 목록에 안 올림)' : '');
    줄('⑦ titleOtherOnly(제목)', titleOtherOnly(title),
      (!j2 && !우대에만 && titleOtherOnly(title)) ? '← 여기서 버립니다' : (우대에만 ? '(우대가 있어 안 버립니다)' : ''));
    줄('⑧ MEDTECH.test(목록)', MEDTECH.test(hay));
    const 첨부 = (box.files || []).map((f) => '[' + f.atchFileType + ']' + f.atchFileNm);
    줄('⑨ 첨부', 첨부.length + '개', 첨부.join(' · ').slice(0, 70));
  }
}
const g = sortJob(title, job || '');
console.log('\n── 네 갈래 ──');
줄('갈래', g.갈래, g.왜);
