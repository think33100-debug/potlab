/* **수집 열쇠가 출처마다 통하나** 한 번에 봅니다 (2026-10-22 밤 · 10/25 열쇠 교체용)
 *
 *   node tools/수집열쇠확인.mjs              출처마다 통함/막힘
 *   node tools/수집열쇠확인.mjs --조용히      안 통하는 것만
 *
 * ── 왜 ───────────────────────────────────────────────────────────
 * 10/25 에 열쇠를 바꾸고 나서 「새 값이 통하나 · 옛 값이 막혔나」를 봐야 하는데,
 * 그 일을 하는 도구가 **없었습니다**. 수집기를 한 바퀴 돌려 보는 것은 느리고
 * 사이트를 두드립니다. 그래서 **창구만** 두드려 봅니다.
 *
 * 어떻게 — `collect_body` 에 **줄 0개**를 보냅니다.
 *   맞는 열쇠  → 200 `{"담음": 0, …}`     아무것도 안 담깁니다
 *   틀린 열쇠  → 401 `열쇠가 맞지 않습니다`
 * 그래서 **쓰지 않고** 열쇠만 가립니다.
 *
 * ★ 열쇠 값을 화면에 안 찍습니다 — 길이와 앞 4글자까지만 (지침 8-11).
 * ★ `.env` 를 셸로 source 하지 않습니다 — node 로 그 줄만 읽습니다 (지침 8-12).
 * ★ 비로그인(anon) 열쇠로 두드립니다 — 수집기가 그렇게 합니다.
 * ★ 아무것도 담지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 조용히 = process.argv.includes('--조용히');

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const ANON = cfg.SUPABASE_ANON_KEY;
const SERVICE = cfg.SUPABASE_SERVICE_KEY;
if (!U || !ANON) { console.error('SUPABASE_URL · SUPABASE_ANON_KEY 가 있어야 합니다 (서버에서)'); process.exit(1); }

/** 길이와 앞 4글자까지만 (지침 8-11) */
const 가린값 = (v) => (v ? v.length + '자 · 앞 ' + String(v).slice(0, 4) : '**없음**');

/* ★ 2026-10-22 밤 — **열쇠 이름이 출처마다 다릅니다.** 처음에는
   `COLLECT_KEY_<출처>` 하나만 보고 ALIVE·HS2·AL2C 를 「막힘」으로 찍었는데,
   `ALIVE` 는 `.env` 에 **ALIVE_KEY** 로 있고 `AL2C` 는 `AL2` 와 같은 값을 씁니다.
   도구가 틀려서 멀쩡한 것을 탈로 세는 꼴입니다 (지침 10-5). 그래서 이름
   후보를 차례로 두드려 보고 **통한 이름**을 적습니다. */
const 후보이름 = (출처) => {
  const 들 = ['COLLECT_KEY_' + 출처, 출처 + '_KEY'];
  /* AL2C → AL2 → AL · HS2 → HS · WN2 → WN 처럼 꼬리를 하나씩 떼어 봅니다 */
  let x = 출처;
  while (x.length > 1) {
    x = x.slice(0, -1);
    들.push('COLLECT_KEY_' + x);
  }
  들.push('COLLECT_KEY_HS3');                 /* 적어 둔 되돌아갈 자리 */
  return [...new Set(들)].filter((n) => cfg[n]);
};

async function 두드리기(비밀, 출처) {
  if (!비밀) return { ok: false, code: 0, 왜: '.env 에 열쇠가 없습니다' };
  const r = await fetch(U + '/rest/v1/rpc/collect_body', {
    method: 'POST',
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: 비밀, p_source: 출처, p_rows: [] }),
  });
  const t = await r.text();
  if (r.ok) return { ok: true, code: r.status, 왜: '' };
  let 왜 = t.slice(0, 70);
  try { 왜 = (JSON.parse(t) || {}).message || 왜; } catch { /* 모양이 다르면 그대로 */ }
  return { ok: false, code: r.status, 왜 };
}

/* 볼 출처 — collect_source 가 있으면 그것을, 없으면 .env 의 열쇠 이름에서 */
let 출처들 = [];
if (SERVICE) {
  const r = await fetch(U + '/rest/v1/collect_source?select=code&order=code',
    { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } });
  if (r.ok) 출처들 = (await r.json()).map((x) => x.code);
}
if (!출처들.length) {
  출처들 = Object.keys(cfg).filter((k) => k.startsWith('COLLECT_KEY_')).map((k) => k.slice(12));
}

console.log('수집 열쇠 확인 — 출처 ' + 출처들.length + '곳 · 창구 collect_body(줄 0개)');
console.log('★ 아무것도 담지 않습니다. 열쇠 값은 길이와 앞 4글자까지만 찍습니다\n');

const 통함 = []; const 막힘 = [];
for (const 출처 of 출처들) {
  const 이름들 = 후보이름(출처);
  if (!이름들.length) {
    막힘.push({ 출처, 어디서: '없음', 열쇠: '', ok: false, code: 0, 왜: '.env 에 쓸 열쇠가 없습니다' });
    continue;
  }
  let 끝 = null;
  for (const 이름 of 이름들) {
    const r = await 두드리기(cfg[이름], 출처);
    끝 = { 출처, 어디서: 이름 + (이름 === 'COLLECT_KEY_' + 출처 ? '' : ' (다른 이름)'),
      열쇠: cfg[이름], ...r };
    if (r.ok) break;                           /* 통한 이름을 적습니다 */
  }
  (끝.ok ? 통함 : 막힘).push({ ...끝, 본이름수: 이름들.length });
}

if (!조용히) {
  console.log('── 통하는 출처 ' + 통함.length + '곳 ──');
  for (const x of 통함) {
    console.log('  ○ ' + x.출처.padEnd(6) + 가린값(x.열쇠).padEnd(18) + x.어디서);
  }
  console.log('');
}
console.log('── 안 통하는 출처 ' + 막힘.length + '곳 ──');
for (const x of 막힘) {
  console.log('  ✗ ' + x.출처.padEnd(6) + 가린값(x.열쇠).padEnd(18)
    + String(x.어디서).padEnd(26) + 'HTTP ' + x.code + ' · ' + x.왜
    + (x.본이름수 > 1 ? '  (이름 ' + x.본이름수 + '가지 다 해 봤습니다)' : ''));
}
if (!막힘.length) console.log('  (없습니다)');

console.log('\n셈 — 통함 ' + 통함.length + ' · 막힘 ' + 막힘.length);
if (막힘.length) {
  console.log('\n★ 안 통하는 출처로는 **공고문 글이 안 담깁니다** (log/첨부읽기.log 에'
    + ' 「글 보관 못함 [출처] 403」 으로 뜹니다).');
  console.log('  까닭은 둘입니다 — ⓐ `.env` 에 그 출처 열쇠가 없음'
    + ' ⓑ **DB(collect_secret_all) 에 그 출처 줄이 없음**.');
  console.log('  ⓑ 가 옛 출처(HS·CE·GJ·ND·AL·WN)의 까닭입니다 — docs/승인대기_1022.md D 참고');
}
/* 바꾼 뒤 확인에 쓰는 법 — 교체 차례의 ①②에 그대로 넣습니다 */
console.log('\n교체 때 쓰는 법');
console.log('  ① 새 값을 넣은 뒤 — 이 명령이 **막힘 0** 이어야 합니다');
console.log('  ② 옛 줄을 끈 뒤 — 옛 값만 담은 .env.local 을 잠깐 두고 돌려'
  + ' **막힘이 전부**여야 합니다 (그 뒤 .env.local 을 지웁니다)');
process.exit(막힘.length ? 1 : 0);
