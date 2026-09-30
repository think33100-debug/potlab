/* 옛 열쇠로 **실제 저장**이 되는지 봅니다 (2026-09-30).
 *
 *   node tools/열쇠시험.mjs
 *
 * collect_secret 의 기본 열쇠를 (source) → (source, secret) 으로 바꾸기 전과 뒤에
 * 각각 돌려, 옛 수집기가 계속 도는지 확인하는 자리입니다.
 * 읽기만 하지 않고 **쓰기**까지 해 봅니다 — 읽기만 되고 쓰기가 막히면 못 봅니다.
 *
 * 값은 한 글자도 안 찍습니다.
 */
import fs from 'node:fs';
const env = {};
for (const f of ['.env.local', 'web/.env.local']) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !env[m[1]]) env[m[1]] = m[2];
  });
}
const U = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rpc(fn, body) {
  const r = await fetch(U + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return { ok: r.ok, code: r.status, 답: t.slice(0, 120) };
}

const 표 = [];
/* ① 읽기 — 열쇠가 틀리면 42501 이 옵니다 */
for (const [이름, fn, body] of [
  ['AL2 · 읽기 (alio_compete_state_get)', 'alio_compete_state_get',
    { p_secret: env.COLLECT_KEY_AL2, p_source: 'AL2' }],
  ['CE2 · 읽기 (collect_peek)', 'collect_peek',
    { p_secret: env.COLLECT_KEY_CE2, p_source: 'CE2', p_of: 'CE' }],
]) {
  if (!body.p_secret) { 표.push({ 무엇: 이름, 됐나: '열쇠가 제 쪽에 없음', 답: '' }); continue; }
  const r = await rpc(fn, body);
  표.push({ 무엇: 이름, 됐나: r.ok ? '○ 됨' : '✗ ' + r.code, 답: r.ok ? '' : r.답 });
}

/* ② 쓰기 — 박동을 한 번 남깁니다. 진짜 저장입니다 */
for (const [이름, src, 열쇠] of [
  ['AL2 · 쓰기 (collect_beat)', 'AL2', env.COLLECT_KEY_AL2],
  ['CE2 · 쓰기 (collect_beat)', 'CE2', env.COLLECT_KEY_CE2],
]) {
  if (!열쇠) { 표.push({ 무엇: 이름, 됐나: '열쇠가 제 쪽에 없음', 답: '' }); continue; }
  /* collect_beat(p_secret, p_source, p_beat jsonb) — 박동 한 줄을 실제로 담습니다 */
  const r = await rpc('collect_beat', {
    p_secret: 열쇠, p_source: src,
    p_beat: { 어디: '열쇠 시험', 언제: new Date().toISOString(), 사이트: 0, 줄: 0, 초: 0 },
  });
  표.push({ 무엇: 이름, 됐나: r.ok ? '○ 저장됨' : '✗ ' + r.code, 답: r.ok ? '' : r.답 });
}

/* ③ 틀린 열쇠는 막혀야 합니다 — 안 막히면 그게 더 큰일입니다 */
const 나쁜 = await rpc('alio_compete_state_get', { p_secret: 'x'.repeat(48), p_source: 'AL2' });
표.push({ 무엇: '틀린 열쇠 (막혀야 함)', 됐나: 나쁜.ok ? '★ 안 막힘 — 큰일입니다' : '○ 막힘 ' + 나쁜.code, 답: '' });

console.table(표);
const 나쁨 = 표.filter((x) => String(x.됐나).startsWith('✗') || String(x.됐나).startsWith('★'));
console.log(나쁨.length ? '\n✗ 어긋난 것 ' + 나쁨.length + '개' : '\n○ 옛 열쇠가 그대로 돕니다');
process.exit(나쁨.length ? 1 : 0);
