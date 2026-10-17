// 재시작 뒤 상태 한 번에 — 네숫자 · 수집기 마지막 성공 · 보류함 (읽기만)
// 사용: node tools/상태한번보기.mjs
// .env.local 은 셸로 source 하지 않고 node 로 읽습니다 (지침 8-12)
import fs from 'node:fs';

const cfg = {};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);              /* 이름 없는 줄은 버립니다 */
  if (m) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const URL_ = cfg.SUPABASE_URL, KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.log('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }

const 머리 = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function rpc(fn, body = {}) {
  const r = await fetch(URL_ + '/rest/v1/rpc/' + encodeURIComponent(fn), {
    method: 'POST', headers: 머리, body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) return { 오류: r.status + ' ' + t.slice(0, 160) };
  try { return JSON.parse(t); } catch { return t; }
}
async function 표(path) {
  const r = await fetch(URL_ + '/rest/v1/' + path, { headers: { ...머리, Prefer: 'count=exact' } });
  return { 수: r.headers.get('content-range'), 몸: (await r.text()).slice(0, 400) };
}

console.log('=== 네숫자 ===');
console.log(JSON.stringify(await rpc('네숫자'), null, 1));

console.log('\n=== 출처별 마지막 수집 (collect_source) ===');
const src = await 표('collect_source?select=*&order=코드');
console.log(src.몸);

console.log('\n=== 보류함 건수 ===');
const hold = await 표('job_posts?select=id&hold=eq.true&limit=1');
console.log('  ' + hold.수);

console.log('\n=== 회원 화면 공고 수 (job_posts_pub) ===');
const pub = await 표('job_posts_pub?select=id&limit=1');
console.log('  ' + pub.수);
