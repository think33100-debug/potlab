/* 3-3 「지원 방법」 한 줄이 **회원 눈에 실제로 보이나** (2026-10-25 세중님 3-3)
 *
 *   node tools/지원방법_회원눈확인.mjs            공고 5건 (기본)
 *   node tools/지원방법_회원눈확인.mjs --몇개 10
 *
 * ── 무엇을 보나 ─────────────────────────────────────────────
 * 화면은 `web/lib/job-state.ts` 의 `지원방법말()` 로 그 줄을 만듭니다. 재료는
 * `job_one` 이 내려 주는 `detail.접수방법` 과 `detail.기관홈페이지` 입니다.
 * 그래서 **test-pt 로 로그인해 `job_one` 응답 원문**을 보고, 같은 함수를 돌려
 * 「회원 화면에 찍힐 글자」를 그대로 찍습니다 (지침 2절 — 원문을 함께).
 *
 * ★ 쓰기 없음. 열쇠는 안 찍습니다 (지침 8-11).
 */
import fs from 'node:fs';
import path from 'node:path';

const 뿌리 = path.join(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 5) || 5;

const cfg = {};
for (const f of ['.env', '.env.local']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const ANON = cfg.SUPABASE_ANON_KEY; const PW = cfg.TEST_PT_PW;
if (!U || !ANON) { console.error('✗ SUPABASE_URL·ANON 이 없습니다'); process.exit(1); }
if (!PW) { console.error('✗ TEST_PT_PW 가 없습니다 (회원으로 로그인해야 detail 이 보입니다)'); process.exit(1); }

/* ── 화면과 **같은 자** — web/lib/job-state.ts 의 규칙을 그대로 옮겨 적지 않고,
   그 파일에서 글자를 읽어 확인합니다 (두 벌이 되지 않게 · 지침 6-3) ── */
const 화면파일 = fs.readFileSync(path.join(뿌리, 'web', 'lib', 'job-state.ts'), 'utf8');
const 아는낱말 = [...화면파일.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const 낱말묶음 = (화면파일.match(/아는접수낱말[^=]*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
const 아는것 = [...낱말묶음.matchAll(/'([^']+)'/g)].map((m) => m[1]);
console.log('화면이 아는 접수 낱말 ' + 아는것.length + '개 — ' + 아는것.join(' · '));
const 확인된채용 = (화면파일.match(/확인된채용페이지[^=]*=\s*\{([\s\S]*?)\}/) || [])[1] || '';
console.log('확인된 채용페이지 줄 — ' + (확인된채용.match(/'/g) || []).length / 2 + '곳\n');

/* ── 로그인 ── */
const r0 = await fetch(U + '/auth/v1/token?grant_type=password', {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test-pt@potjob.co.kr', password: PW }),
});
const j0 = await r0.json();
if (!j0.access_token) {
  /* 메일 주소가 다를 수 있습니다 — 시험계정 도구가 쓰는 주소를 그대로 씁니다 */
  console.error('✗ test-pt 로그인 실패 ' + r0.status + ' — ' + JSON.stringify(j0).slice(0, 120));
  process.exit(1);
}
console.log('○ test-pt 로 로그인했습니다 (회원 눈)');
const H = { apikey: ANON, Authorization: 'Bearer ' + j0.access_token, 'Content-Type': 'application/json' };

/* ── 회원 화면 공고 몇 건 ── */
const r1 = await fetch(U + '/rest/v1/job_posts_pub?select=id,org_name,title&order=id.asc&limit=' + 몇개, { headers: H });
const 공고 = await r1.json();
if (!Array.isArray(공고) || !공고.length) { console.error('✗ 공고를 못 받았습니다'); process.exit(1); }

let 보임 = 0; let 공고문확인 = 0;
for (const x of 공고) {
  const r = await fetch(U + '/rest/v1/rpc/job_one', {
    method: 'POST', headers: H, body: JSON.stringify({ p_id: x.id }),
  });
  const t = await r.text();
  if (!r.ok) { console.log('  ✗ ' + x.id + ' job_one ' + r.status + ' ' + t.slice(0, 100)); continue; }
  let j = JSON.parse(t); if (Array.isArray(j)) j = j[0];
  const d = (j && j.detail) || {};
  const 접수 = d['접수방법'] || ''; const 기관홈 = d['기관홈페이지'] || d['기관홈'] || '';
  /* 화면이 하는 일과 같은 갈래 — 아는 낱말만 남기고, 없으면 「공고문 확인」 */
  const 조각 = String(접수).split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
  const 남는것 = 조각.filter((s) => 아는것.some((w) => s.includes(w)));
  const 찍힐글 = 남는것.length ? 남는것.join(' · ') : '공고문 확인';
  if (남는것.length) 보임++; else 공고문확인++;
  console.log('\n■ ' + x.id + '  ' + String(x.org_name).slice(0, 18) + '  ' + String(x.title).slice(0, 30));
  console.log('   detail 칸 — ' + Object.keys(d).join(' · '));
  console.log('   원문 접수방법 — 「' + String(접수).slice(0, 80) + '」');
  console.log('   원문 기관홈페이지 — 「' + String(기관홈).slice(0, 60) + '」');
  console.log('   ★ 회원 화면에 찍힐 「지원 방법」 — **' + 찍힐글 + '**');
  await new Promise((z) => setTimeout(z, 300));
}
console.log('\n── 셈 ──\n  공고 ' + 공고.length + '건 가운데 낱말이 찍히는 것 ' + 보임
  + '건 · 「공고문 확인」 ' + 공고문확인 + '건');
