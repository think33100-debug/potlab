/* 알리오 `/detail` **응답 항목을 전부** 찍습니다 (지침 2·4절)
 *
 *   node tools/알리오_상세항목이름.mjs [번호]
 *
 * 왜 — 2026-10-19 세중님 2번 「알리오 본문(본문줄 0 · 483건)은 /detail 에
 * 본문 항목이 있는지도 함께」. 짐작하지 않고 **항목 이름과 값을 찍습니다.**
 */
import fs from 'node:fs';

const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
if (!cfg.ALIO_DETAIL_KEY) { console.error('✗ ALIO_DETAIL_KEY 가 없습니다'); process.exit(1); }

const sn = process.argv[2] || '306122';   /* 광주보훈 작업치료사 — 우리 직군 */
const u = 'https://apis.data.go.kr/1051000/recruitment/detail?serviceKey='
  + encodeURIComponent(cfg.ALIO_DETAIL_KEY) + '&sn=' + sn;
const r = await fetch(u, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
const t = await r.text();
console.log('번호 ' + sn + ' · HTTP ' + r.status + ' · ' + t.length + '바이트\n');
let j;
try { j = JSON.parse(t); } catch { console.log('JSON 이 아닙니다 — ' + t.slice(0, 400)); process.exit(1); }
const box = Array.isArray(j && j.result) ? j.result[0] : (j && j.result) || j;

/* ── 항목 이름과 값 전부 (지침 2절 — 「몇 건 왔다」 는 쓸모없음) ── */
console.log('── 항목 ' + Object.keys(box).length + '개 ──');
for (const [k, v] of Object.entries(box)) {
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  console.log('  ' + k.padEnd(22) + (s.length > 120 ? s.slice(0, 120) + ' …(' + s.length + '자)' : s));
}

/* ── 본문으로 쓸 만한 항목이 있나 — **긴 글**을 찾습니다 ── */
console.log('\n── 글이 긴 항목 (본문 후보) ──');
const 긴것 = Object.entries(box)
  .filter(([, v]) => typeof v === 'string' && v.length >= 80)
  .sort((a, b) => b[1].length - a[1].length);
if (!긴것.length) console.log('  **없습니다** — /detail 에 공고 본문 항목이 없습니다');
for (const [k, v] of 긴것) {
  console.log('  ★ ' + k + ' (' + v.length + '자)');
  console.log('     「' + v.replace(/\s+/g, ' ').slice(0, 200) + '」');
}

/* ── 첨부 ── */
const files = box.files || [];
console.log('\n── 첨부 ' + (Array.isArray(files) ? files.length : 0) + '개 ──');
for (const f of (Array.isArray(files) ? files : [])) {
  console.log('  ' + Object.entries(f).map(([k, v]) => k + '=' + String(v).slice(0, 70)).join(' · '));
}

/* ── 전형단계(steps) — CLAUDE.md 4절의 그 항목 ── */
for (const 이름 of ['steps', 'step', 'recrutSteps']) {
  if (box[이름]) {
    console.log('\n── ' + 이름 + ' ──');
    console.log('  ' + JSON.stringify(box[이름]).slice(0, 600));
  }
}
