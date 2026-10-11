/* 시험 계정 셋의 비번을 **새로 지어 서버 .env 에만** 넣습니다 (2026-10-11).
 *
 *   node tools/시험계정비번.mjs            (서버에서 · 세중님 승인)
 *
 * 왜 — 10-09 에 만든 test-pt · test-student · test-empty 의 비번이 어디에도
 * 안 적혀 있습니다. 한 바퀴 시험(대화·재직인증·담당자)을 돌리려면 그 계정으로
 * 로그인해야 합니다.
 *
 * ── 값은 한 글자도 안 찍습니다 (작업지침 8-11) ──────────────
 * 새 비번은 **메모리에서 바로** admin API 로 보내고 `~/potlab/.env` 에
 * 적습니다. 화면에는 **열쇠 이름과 길이만** 나옵니다.
 * `.env` 는 저장소 바깥이고 `.gitignore` 에 있습니다.
 *
 * 이미 .env 에 있으면 **안 건드립니다** — 돌려도 비번이 안 바뀝니다.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const ENV = (process.env.HOME || process.env.USERPROFILE || '.') + '/potlab/.env';
if (!fs.existsSync(ENV)) { console.error('.env 가 없습니다 — ' + ENV); process.exit(2); }

const 지금 = {};
for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_0-9]+)\s*=/);
  if (m) 지금[m[1]] = true;
}
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(2); }

const 계정 = [
  ['TEST_PT_PW', 'test-pt@potjob.co.kr'],
  ['TEST_STUDENT_PW', 'test-student@potjob.co.kr'],
  ['TEST_EMPTY_PW', 'test-empty@potjob.co.kr'],
];

/* 사람이 안 읽을 비번. 길게 짓습니다 */
const 비번짓기 = () => crypto.randomBytes(24).toString('base64url') + 'aA1!';

const 머리 = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const 더할줄 = [];

for (const [이름, 메일] of 계정) {
  if (지금[이름]) { console.log('  — 이미 있습니다 ' + 이름); continue; }
  const r = await fetch(`${URL_}/auth/v1/admin/users?page=1&per_page=200`, { headers: 머리 });
  if (!r.ok) { console.error('  ✗ 회원 목록 HTTP ' + r.status); process.exit(1); }
  const { users } = await r.json();
  const u = (users ?? []).find((x) => x.email === 메일);
  if (!u) { console.error('  ✗ 그 계정이 없습니다 — ' + 메일); continue; }

  const 비번 = 비번짓기();
  const r2 = await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, {
    method: 'PUT', headers: 머리, body: JSON.stringify({ password: 비번 }),
  });
  if (!r2.ok) { console.error('  ✗ ' + 메일 + ' 바꾸기 HTTP ' + r2.status + ' · ' + (await r2.text()).slice(0, 120)); continue; }
  더할줄.push(`${이름}='${비번}'`);
  console.log('  ○ ' + 메일 + ' → ' + 이름 + ' (' + 비번.length + '자 · 값은 안 찍습니다)');
}

if (더할줄.length) {
  fs.appendFileSync(ENV, '\n# 시험 계정 비번 (2026-10-11 · 10/25 에 계정과 함께 치웁니다)\n'
    + 더할줄.join('\n') + '\n');
  console.log('\n' + 더할줄.length + '줄을 ' + ENV + ' 에 적었습니다 (값은 거기에만 있습니다)');
} else {
  console.log('\n새로 적을 것이 없습니다');
}
