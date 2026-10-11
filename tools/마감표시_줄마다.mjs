/* 회원에게 보이는 공고가, **그 사이트 목록 줄에서는 「마감」 인가**
 * (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/마감표시_줄마다.mjs
 *   → docs/시험_playwright_1012/C_줄마다마감.json
 *
 * ── 규칙은 여기 없습니다 ─────────────────────────────────────
 * 판정은 `tools/hosp/hs_목록상태.mjs` 의 `목록상태()` 한 곳에서 합니다.
 * **`alive.mjs` 의 ⑥ 과 같은 함수**입니다 (지침 6절 — 기준은 한 자리).
 * 처음에는 이 파일이 규칙을 따로 갖고 있었는데, 그러면 정기 판정과
 * 조사 결과가 어긋납니다. 그래서 떼어 공통 자리로 옮겼습니다.
 *
 * 이 도구는 **세는 일만** 합니다 — 회원 화면 공고를 모아 `목록상태()` 에 묻고
 * 표로 보여줍니다. DB 를 안 건드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 목록상태, 목록상태셈 } from './hosp/hs_목록상태.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

function env() {
  const out = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(여기, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);     /* 이름 없는 줄은 버립니다 (지침 8-12) */
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* PostgREST 는 한 쪽에 100줄만 줍니다. **고유한 칸(id)으로** 넘겨야 줄이 안 샙니다
   (2026-10-12 에 first_seen 으로 넘겨 줄을 잃고 헛경보를 냈습니다) */
async function 전부(길) {
  const 모두 = [];
  let 참값 = null;
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items', Prefer: 'count=exact' } });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const cr = r.headers.get('content-range');
    if (cr && cr.includes('/')) 참값 = Number(cr.split('/')[1]);
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) break;
  }
  if (!/order=id\.(asc|desc)/.test(길)) throw new Error('쪽을 넘길 때는 id 로 정렬해야 합니다');
  if (참값 !== null && 모두.length !== 참값) {
    throw new Error('줄 수가 안 맞습니다 — 받은 ' + 모두.length + ' · 실제 ' + 참값);
  }
  return 모두;
}

const 인수 = process.argv.slice(2);
const 앞글자 = 인수.find((a) => !a.startsWith('--')) || 'HS';

const 보이는것 = (await 전부('job_posts_pub?select=id,org_name,title,원문제목,apply_to&order=id.asc'))
  .filter((v) => String(v.id).startsWith(앞글자));
console.log('회원에게 보이는 ' + 앞글자 + ' 공고 ' + 보이는것.length + '건을 목록 줄에서 다시 봅니다');
console.log('');

const 결과 = [];
for (const v of 보이는것) {
  const r = await 목록상태(v.org_name, v.원문제목 || v.title);
  결과.push({ ...v, ...r });
  await new Promise((y) => setTimeout(y, 250));
}

fs.mkdirSync(폴더, { recursive: true });
fs.writeFileSync(path.join(폴더, 'C_줄마다마감.json'),
  JSON.stringify({ 센날: new Date().toISOString(), 줄: 결과 }, null, 1));

const 셈 = {};
for (const r of 결과) 셈[r.결과] = (셈[r.결과] ?? 0) + 1;
console.log('── 판정 ──');
for (const [k, v] of Object.entries(셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(4) + '건  ' + k
    + (k === 'closed' ? '   ← **마감인데 회원에게 보입니다**' : '')
    + (k === 'open' ? '   접수중' : '')
    + (k === '없음' ? '   상태말이 없거나 목록에 없음' : '')
    + (k === '모름' ? '   가릴 수 없음 (같은 제목이 여럿 · 둘 다 있음 · 못 받음)' : ''));
}
const 목셈 = 목록상태셈();
console.log('  목록 — 받은 기관 ' + 목셈.받은곳 + ' · 못 받은 기관 ' + 목셈.못받은곳);
console.log('');
for (const 말 of ['closed', '모름']) {
  const 것 = 결과.filter((r) => r.결과 === 말);
  if (!것.length) continue;
  console.log('── ' + (말 === 'closed' ? '마감인데 보이는 공고' : '가릴 수 없는 것') + ' ' + 것.length + '건 ──');
  for (const r of 것) {
    console.log('   ' + String(r.org_name).slice(0, 18).padEnd(20)
      + String(r.원문제목 || r.title).slice(0, 38).padEnd(40)
      + (r.apply_to ? '마감일 ' + r.apply_to : '마감일 없음'));
    console.log('        ' + r.왜 + (r.줄글 ? '' : ''));
  }
  console.log('');
}
console.log('→ docs/시험_playwright_1012/C_줄마다마감.json');
console.log('DB 를 안 건드렸습니다.');
