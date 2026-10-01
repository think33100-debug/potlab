/* ═══════════════════════════════════════════════════════════════
 *  옛 수집기 ↔ 새 수집기 짝 대조 — 10/3 이사 판단용
 *  2026-10-02. **읽기만 합니다.** 아무것도 담거나 고치지 않습니다.
 * ═══════════════════════════════════════════════════════════════
 *
 *  왜 job_posts.source 로 세면 안 되는가
 *    collect_put 의 「짝 아니면 못 가져감」 규칙 때문에, 옛 수집기가 **읽어도**
 *    이미 새 수집기가 가진 공고는 주인이 안 바뀝니다. 그래서 source 로 세면
 *    옛 것이 아무것도 안 읽은 것처럼 보입니다 (실제로 10/1 에 시트는 15줄 늘었는데
 *    Supabase 「새로 늘어난 줄」은 0건이었습니다).
 *
 *  그래서 기준을 「**실제로 읽은 공고**」로 바꿉니다
 *    옛 쪽   gas 시트 원문 (exportRows) — 수집기가 적어 넣은 줄 그대로
 *    새 쪽   job_posts + job_trash (담은 것 + 버린 것 둘 다 「읽은 것」입니다)
 *
 *  쓰는 법
 *    node tools/짝대조.mjs
 *    node tools/짝대조.mjs --날 2026-10-01     그 날 시트에 들어온 줄만
 * ═══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(여기, '..');
const 읽기 = (f) => {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
  }
  return o;
};
const cfg = {
  ...읽기(path.join(ROOT, '.env.local')),
  ...읽기(path.join(ROOT, 'web', '.env.local')),
  ...읽기(path.join(ROOT, '.env.server')),
  ...읽기(path.join(ROOT, '.env')),
  ...process.env,
};
cfg.SUPABASE_URL = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;

const 모자란것 = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'APPS_SCRIPT_URL', 'EXPORT_KEY']
  .filter((k) => !cfg[k]);
if (모자란것.length) {
  console.error('없는 값 — ' + 모자란것.join(' · '));
  console.error('이 도구는 gas 시트를 읽어야 해서 EXPORT_KEY·APPS_SCRIPT_URL 이 꼭 있어야 합니다');
  process.exit(1);
}

const argv = process.argv.slice(2);
const 날 = argv.includes('--날') ? String(argv[argv.indexOf('--날') + 1] || '') : '';

/* 짝 — 옛 출처 → 새 출처 */
const 짝들 = [
  ['AL', 'AL2', '알리오'],
  ['CE', 'CE2', '클린아이'],
  ['GJ', 'GJ2', '나라일터'],
  ['HS', 'HS3', '병원 홈페이지'],
  ['ND', 'ND2', '치매센터'],
  ['WN', 'WN2', '워크넷'],
];

const SHEET = '채용공고';   // sync_jobs.js 와 같은 이름 — 짐작하지 않고 가져왔습니다
const PAGE = 300;
let seq = 0;

async function 시트한쪽(from, cnt) {
  const cb = '__potlab_cb_' + (++seq) + '_' + Date.now();
  const url = cfg.APPS_SCRIPT_URL
    + (cfg.APPS_SCRIPT_URL.includes('?') ? '&' : '?')
    + 'callback=' + cb
    + '&action=exportRows'
    + '&args=' + encodeURIComponent(JSON.stringify([cfg.EXPORT_KEY, SHEET, from, cnt]))
    + '&t=' + Date.now();
  const res = await fetch(url, { redirect: 'follow' });
  const txt = await res.text();
  const m = txt.match(/^__potlab_cb_\d+_\d+\((.*)\);\s*$/s);
  if (!m) {
    throw new Error('JSONP 가 아니라 화면이 왔습니다 · HTTP ' + res.status
      + ' · ' + txt.length + '자 · 앞 400자 — ' + txt.slice(0, 400).replace(/\s+/g, ' '));
  }
  const j = JSON.parse(m[1]);
  if (!j.ok) throw new Error('내보내기 거절: ' + j.error);
  return j.data;
}

console.log('짝 대조 · ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('  기준 — 옛 쪽은 gas 시트 원문, 새 쪽은 job_posts + job_trash (담은 것 + 버린 것)');
if (날) console.log('  --날 ' + 날 + ' — 그 날 시트에 들어온 줄만 봅니다');

/* ① gas 시트 전부 */
console.log('\n── gas 시트 읽기 ──');
const 첫쪽 = await 시트한쪽(0, PAGE);
const total = 첫쪽.total;
const head = 첫쪽.head;
let 줄들 = 첫쪽.rows;
while (줄들.length < total) {
  const nx = await 시트한쪽(줄들.length, PAGE);
  if (!nx.rows.length) break;
  줄들 = 줄들.concat(nx.rows);
}
const 자리 = {}; head.forEach((h, i) => { 자리[String(h).trim()] = i; });
console.log('  ' + 줄들.length + ' / ' + total + '줄 · 칸 이름 — ' + head.join(' · '));

const 칸 = (r, 이름) => (자리[이름] === undefined ? '' : String(r[자리[이름]] ?? ''));
/* 출처·공고ID 칸 이름을 눈으로 확인하고 씁니다 (짐작하지 않습니다) */
const 출처칸 = ['출처', 'source', '수집기'].find((n) => 자리[n] !== undefined);
const ID칸 = ['공고ID', 'id', 'ID'].find((n) => 자리[n] !== undefined);
const 날칸 = ['담은날', '수집일', 'collected_at', '등록일'].find((n) => 자리[n] !== undefined);
console.log('  쓰는 칸 — 출처 「' + (출처칸 || '(칸이 없습니다)') + '」 · 공고ID 「' + ID칸
  + '」 · 날짜 「' + (날칸 || '(없음)') + '」');
if (!ID칸) { console.error('\n★ 공고ID 칸을 못 찾았습니다 — 멈춥니다'); process.exit(1); }

/* gas 시트에는 **출처 칸이 없습니다** — 칸 이름 36개를 다 찍어 확인했습니다
   (2026-10-02). 공고ID 앞머리가 출처입니다. 짐작하지 않게 분포를 먼저 찍습니다 */
const 앞머리 = (id) => (/^[A-Z]+/.test(id) ? id.match(/^[A-Z]+/)[0] : (/^\d/.test(id) ? '(숫자)' : '(그 밖)'));
const 앞머리셈 = {};
const 앞머리본보기 = {};
for (const r of 줄들) {
  const id = 칸(r, ID칸).trim();
  if (!id) continue;
  const k = 앞머리(id);
  앞머리셈[k] = (앞머리셈[k] || 0) + 1;
  if (!앞머리본보기[k]) 앞머리본보기[k] = id;
}
console.log('\n  공고ID 앞머리 분포 —');
for (const [k, n] of Object.entries(앞머리셈).sort((x, y) => y[1] - x[1])) {
  console.log('    ' + k.padEnd(8) + String(n).padStart(5) + '건   본보기 ' + 앞머리본보기[k]);
}

/* 앞머리 → 옛 출처. 모르는 꼴은 '(모름)' 으로 둡니다 — 짐작해 묶지 않습니다 */
const 앞머리에서출처 = (id) => {
  const m = id.match(/^(AL|CE|GJ|HS|WN|ND|BZ)/);
  if (m) return m[1];
  if (/^\d+$/.test(id)) return 'AL';   // 알리오는 번호만 씁니다 (recrutPblntSn)
  return '(모름)';
};

const 옛읽은것 = new Map();   // 옛 출처 → Set(공고ID)
for (const r of 줄들) {
  const id = 칸(r, ID칸).trim();
  if (!id) continue;
  const s = 출처칸 ? 칸(r, 출처칸).trim() : 앞머리에서출처(id);
  if (!s) continue;
  if (날 && 날칸 && !칸(r, 날칸).startsWith(날)) continue;
  if (!옛읽은것.has(s)) 옛읽은것.set(s, new Set());
  옛읽은것.get(s).add(id);
}
console.log('\n  시트 출처별 줄 수 —');
for (const [s, v] of [...옛읽은것].sort()) console.log('    ' + s.padEnd(6) + v.size + '건');

/* ② 새 쪽 — job_posts + job_trash */
async function 쿼리(sql) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + 'exec_sql', {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
               'Content-Type': 'application/json' },
    body: JSON.stringify({ q: sql }),
  });
  if (!r.ok) throw new Error('exec_sql 없음 — ' + r.status);
  return r.json();
}
/* Supabase 는 한 번에 **100줄까지만** 내줍니다 (Range 를 1000 으로 줘도 100 입니다 —
   2026-10-02 에 job_posts 1,966줄을 100줄로 받고 알았습니다). 그래서 100씩 넘깁니다 */
const 쪽크기 = 100;
const 다음날 = (d) => {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};
async function 표읽기(표, 칸들, 정렬 = 'id') {
  const 모은것 = [];
  for (let off = 0; ; off += 쪽크기) {
    const u = cfg.SUPABASE_URL + '/rest/v1/' + 표 + '?select=' + 칸들
      + '&order=' + 정렬 + '&limit=' + 쪽크기 + '&offset=' + off;
    const r = await fetch(u, {
      headers: { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY },
    });
    const j = await r.json();
    if (!Array.isArray(j)) throw new Error(표 + ' 읽기 실패 — ' + JSON.stringify(j).slice(0, 300));
    if (!j.length) break;
    모은것.push(...j);
    if (j.length < 쪽크기) break;
    if (off > 200000) throw new Error(표 + ' — 끝없이 돕니다, 멈춥니다');
  }
  return 모은것;
}

/* ★ 날을 맞추지 않으면 뜻이 없습니다 (2026-10-02 에 겪었습니다).
   gas 시트는 **쌓인 역사**라 9월에 마감된 공고까지 들고 있고, 새 수집기는
   **지금 접수중**만 봅니다. 그래서 날짜를 안 맞추고 견주면 「옛 것만 읽음」이
   67·9·41건으로 나오는데, 그건 구멍이 아니라 그냥 마감된 옛 공고입니다.
   --날 을 주면 양쪽 모두 그 날 것만 봅니다. */
/* ★ 새 쪽 기준은 **수집판정** 입니다 — job_posts.source 가 아닙니다.
   2026-10-02 에 겪었습니다. gas 가 10/1 에 읽은 알리오 5건(305539·305571~3·305592)을
   job_posts 로 보면 주인이 옛 AL 이고 담은때가 9/30 입니다. 그래서 「옛 것만 읽음」
   으로 잡혔습니다. 그런데 수집판정 을 보면 **AL2 가 10/1 23:40 에 다 읽고
   「회원목록」으로 판정**했습니다. collect_put 의 「짝 아니면 못 가져감」 규칙 때문에
   주인이 안 바뀐 것뿐입니다 — 읽지 않은 게 아닙니다.
   그래서 소유(job_posts.source)로 세면 거짓이 나옵니다.

   수집판정 은 2026-10-01 밤에 만들었고 지금은 **AL2·CE2 에만** 쌓입니다.
   GJ2·HS3·WN2·ND2 는 판정남기기() 를 아직 안 붙여서 비교할 자료가 없습니다. */
console.log('\n── 새 쪽 읽기 (수집판정) ──');
const 판정날필터 = 날 ? '&판정때=gte.' + 날 + '&판정때=lt.' + 다음날(날) : '';
const 판정들 = await 표읽기('수집판정', '번호,source,판정,판정때' + 판정날필터, '번호');
console.log('  수집판정 ' + 판정들.length + '줄' + (날 ? ' (' + 날 + ' 것만)' : ' (전부)'));

const 새읽은것 = new Map();
for (const x of 판정들) {
  const s = String(x.source || '').trim();
  if (!s) continue;
  if (!새읽은것.has(s)) 새읽은것.set(s, new Set());
  새읽은것.get(s).add(String(x.번호));
}
console.log('  출처별 — ' + [...새읽은것].map(([s, v]) => s + ' ' + v.size + '건').join(' · '));

/* ③ 짝마다 견주기 */
console.log('\n══ 짝 대조 ══');
for (const [옛, 새, 이름] of 짝들) {
  const a = 옛읽은것.get(옛) || new Set();
  const b = 새읽은것.get(새) || new Set();
  console.log('\n  ' + 이름 + '  (' + 옛 + ' → ' + 새 + ')');
  if (!a.size) {
    console.log('    ★ 비교 불가 — gas 시트에 ' + 옛 + ' 줄이 하나도 없습니다');
    continue;
  }
  if (!b.size) {
    console.log('    ★ 비교 불가 — 새 수집기 ' + 새 + ' 가 읽은 공고가 하나도 없습니다');
    continue;
  }
  /* ID 꼴이 두 쪽에서 다릅니다 (2026-10-02 확인) —
       gas 시트   CE80111 · GJ304751 · HS478038811   (출처 앞머리 + 번호)
       수집판정    80111   · 304751   · 478038811     (번호만)
     그래서 **앞머리를 떼고** 견줍니다. 알리오만 두 쪽이 다 번호뿐입니다 */
  const 맨번호 = (x) => String(x).replace(/^[A-Z]+/, '');
  const A = new Map([...a].map((x) => [맨번호(x), x]));
  const B = new Set([...b].map(맨번호));
  const 둘다 = [...A.keys()].filter((x) => B.has(x));
  const 옛만 = [...A.keys()].filter((x) => !B.has(x)).map((x) => A.get(x));
  const 새만 = [...B].filter((x) => !A.has(x));
  console.log('    둘 다 읽음      ' + 둘다.length + '건');
  console.log('    새 것만 읽음    ' + 새만.length + '건');
  console.log('    ★ 옛 것만 읽음  ' + 옛만.length + '건' + (옛만.length ? '  ← 이게 0 이어야 끌 수 있습니다' : '  ← 통과'));
  if (옛만.length) {
    const 보기 = 옛만.slice(0, 10).map((id) => {
      const r = 줄들.find((x) => 칸(x, ID칸).trim() === id);
      const 기관 = r ? (칸(r, '기관') || 칸(r, '기관명')) : '';
      const 제목 = r ? (칸(r, '제목') || 칸(r, '공고명')) : '';
      return '      ' + id + '  ' + 기관 + ' · ' + 제목.slice(0, 44);
    });
    console.log(보기.join('\n'));
    if (옛만.length > 10) console.log('      … 그 밖에 ' + (옛만.length - 10) + '건');
  }
}
console.log('\n끝. 아무것도 담거나 고치지 않았습니다.');
