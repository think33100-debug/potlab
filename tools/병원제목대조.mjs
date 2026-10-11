/* 「사이트에 있는데 우리 DB 에 없는 공고」를 **제목으로** 가립니다
 * (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/병원제목대조.mjs                   쓸어 온 곳 전부
 *   node tools/병원제목대조.mjs 청주성모 고신대      그 곳만
 *   node tools/병원제목대조.mjs --전체             빠진 제목을 다 찍습니다
 *
 *   들어오는 것 → docs/시험_playwright_1012/C_목록쓸기.json (병원목록쓸기.mjs 가 만듦)
 *   나가는 것   → docs/시험_playwright_1012/C_제목대조.json
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 어제는 **링크 개수**로 「놓친 공고 N건」 을 셌습니다. 못 믿을 셈입니다 —
 * 메뉴·쪽넘김·바닥글 링크까지 같이 세기 때문입니다 (대자인 37/0 이 그랬습니다).
 * 제목으로 세면 「무엇이」 빠졌는지가 나옵니다.
 *
 * 우리 DB 세 자리를 다 봅니다 — 회원 화면(`job_posts_pub`) 만 보면
 * 보류함·쓰레기통에 **들어와 있는데** 「놓쳤다」고 셀 수 있습니다.
 *   job_posts   hold=false·hidden=false  회원 화면
 *   job_posts   hold=true                보류함 (관리자가 볼 것)
 *   job_posts   hidden=true              감춤 (마감 지남·오래됨)
 *   job_trash   버린 것                   우리 직군이 아니라 **일부러** 버린 것
 *
 * 제목 맞추기는 `견줄이름` 꼴로 — 공백·괄호·대괄호·말머리를 걷고 견줍니다.
 * **판정에는 안 씁니다** (지침 10-3). 후보를 찾는 데만 씁니다.
 *
 * **DB 를 안 건드립니다. 읽기만 합니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

const 인수 = process.argv.slice(2);
const 전체보기 = 인수.includes('--전체');
const 이름걸기 = 인수.filter((a) => !a.startsWith('--'));

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
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* PostgREST 는 limit 을 적어도 **한 쪽에 100줄**만 줍니다 — Range 로 넘깁니다.
 *
 * ⚠ **정렬은 고유한 칸으로** 해야 합니다 (2026-10-12 에 여기서 데었습니다).
 * 처음엔 `order=first_seen.desc` 로 넘겼습니다. 같은 날짜가 수십 건이라
 * 쪽마다 동률의 순서가 흔들려 **줄이 새어 나갔습니다** — 청주성모 「물리치료사 채용」
 * (HS1438877331) 이 DB 에 멀쩡히 있는데 2,317건 안에 안 들어와서,
 * 「사이트에 있는데 우리 DB 에 없는 공고」로 **헛경보**를 냈습니다.
 *
 * 그래서 두 가지를 겁니다 — `order=id.asc` 로만 넘기고,
 * 끝에 `count=exact` 로 **받은 줄 수가 실제와 같은지** 셉니다. */
async function 전부(길) {
  const 모두 = [];
  let 참값 = null;
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items', Prefer: 'count=exact' } });
    if (!r.ok) throw new Error(길.slice(0, 60) + ' HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const cr = r.headers.get('content-range');          /* 「0-99/2317」 */
    if (cr && cr.includes('/')) 참값 = Number(cr.split('/')[1]);
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) break;
  }
  if (!/order=id\.(asc|desc)/.test(길)) {
    throw new Error('쪽을 넘길 때는 **고유한 칸(id)** 으로 정렬해야 합니다: ' + 길.slice(0, 60));
  }
  const 다른id = new Set(모두.map((x) => x.id)).size;
  if (참값 !== null && (모두.length !== 참값 || 다른id !== 참값)) {
    throw new Error('줄 수가 안 맞습니다 — 받은 ' + 모두.length + ' · 서로 다른 id ' + 다른id
      + ' · 실제 ' + 참값 + ' (' + 길.slice(0, 40) + ')');
  }
  return 모두;
}

/* ── 제목 맞추기 ──────────────────────────────────────────────
 * 사이트 목록과 DB 의 제목은 **같은 글이 아닐 때가 많습니다** —
 *   사이트  「[마감] 2026년 물리치료사 채용 공고 (재공고)」
 *   DB     「2026년 물리치료사 채용 공고」
 * 말머리 대괄호·괄호·공백·가운뎃점을 걷고 견줍니다. */
const 견줄 = (s) => String(s || '')
  .replace(/\[[^\]]{0,24}\]/g, ' ')          /* [마감] [채용] 같은 말머리 */
  .replace(/\([^)]{0,24}\)/g, ' ')           /* (재공고) (수정) */
  .replace(/[★☆■□●○◆◇▶▷…·,.'"“”‘’\-–—_/\\|:;!?~]/g, ' ')
  .replace(/\s+/g, '')
  .toLowerCase();
const 기관키 = (s) => String(s || '')
  .replace(/의료법인|학교법인|재단법인|사회복지법인|특수법인|사단법인|지방의료원|의료재단|복지재단|유지재단|부속/g, '')
  .replace(/[\s()·,]/g, '')
  .toLowerCase();

/* ── 쓸어 온 것 ── */
const 쓸기 = JSON.parse(fs.readFileSync(path.join(폴더, 'C_목록쓸기.json'), 'utf8'));
let 곳들 = 쓸기.곳.filter((r) => !r.왜 && (r.제목들 || []).length);
if (이름걸기.length) 곳들 = 곳들.filter((r) => 이름걸기.some((w) => String(r.곳).includes(w)));

/* ── DB 세 자리 ── */
console.log('DB 를 읽습니다 …');
const 공고 = await 전부('job_posts?select=id,org_name,title,source,hold,hidden,job_group,apply_to,first_seen&order=id.asc');
let 쓰레기 = [];
try {
  쓰레기 = await 전부('job_trash?select=id,org_name,title,source,why&order=id.asc');
} catch (e) {
  console.log('  job_trash 를 못 읽었습니다 — ' + String(e.message).slice(0, 80));
}
console.log('  job_posts ' + 공고.length + '건 · job_trash ' + 쓰레기.length + '건');
console.log('');

/* 기관키 → 제목집합 */
const DB맵 = new Map();
const 넣기 = (기관, 제목, 어디, 줄) => {
  const k = 기관키(기관);
  if (!DB맵.has(k)) DB맵.set(k, []);
  DB맵.get(k).push({ 제목: 제목, 견줄: 견줄(제목), 어디, 줄 });
};
for (const v of 공고) {
  넣기(v.org_name, v.title,
    v.hold ? '보류함' : v.hidden ? '감춤' : '회원 화면', v);
}
for (const v of 쓰레기) 넣기(v.org_name, v.title, '쓰레기통', v);

/* ── 곳마다 대조 ── */
const 결과 = [];
for (const r of 곳들) {
  const 있는것 = DB맵.get(기관키(r.곳)) || [];
  const 빠진것 = [];
  const 찾은것 = { '회원 화면': 0, 보류함: 0, 감춤: 0, 쓰레기통: 0 };
  for (const t of r.제목들) {
    const k = 견줄(t);
    if (!k) continue;
    /* 똑같거나, 한쪽이 다른 쪽을 품고 있으면 같은 공고로 봅니다 */
    const 짝 = 있는것.find((x) => x.견줄 === k)
      || 있는것.find((x) => x.견줄.length >= 8 && (x.견줄.includes(k) || k.includes(x.견줄)));
    if (짝) 찾은것[짝.어디] = (찾은것[짝.어디] ?? 0) + 1;
    else 빠진것.push(t);
  }
  결과.push({
    곳: r.곳, 갈래: r.갈래, 주소: r.주소,
    사이트줄: r.제목들.length, DB에있는기관이름: 있는것.length ? undefined : '**DB 에 이 기관 이름으로 된 공고가 하나도 없습니다**',
    찾은것, 빠진수: 빠진것.length, 빠진것,
    상태칸: r.상태칸 || [], 상태읽나: r.상태읽나,
  });
}

fs.writeFileSync(path.join(폴더, 'C_제목대조.json'), JSON.stringify({ 센날: new Date().toISOString(), 곳: 결과 }, null, 1));

/* ── 화면 ── */
const 합 = (f) => 결과.reduce((a, r) => a + f(r), 0);
console.log('── 전체 ──');
console.log('  곳            ' + 결과.length);
console.log('  사이트 줄      ' + 합((r) => r.사이트줄));
console.log('  우리 DB 에 있음  ' + 합((r) => Object.values(r.찾은것).reduce((a, b) => a + b, 0)));
for (const w of ['회원 화면', '보류함', '감춤', '쓰레기통']) {
  console.log('     ' + w.padEnd(7) + String(합((r) => r.찾은것[w] || 0)).padStart(6));
}
console.log('  **어디에도 없음** ' + 합((r) => r.빠진수));
console.log('');

const 여섯 = ['청주성모', '인천적십자', '고신대', '대자인', '강진의료원', '대구가톨릭'];
console.log('── 어제 「놓쳤다」고 센 여섯 곳 — 제목으로 다시 ──');
console.log('');
console.log('| 곳 | 사이트 줄 | 회원 화면 | 보류함 | 감춤 | 쓰레기통 | 어디에도 없음 |');
console.log('|---|---|---|---|---|---|---|');
for (const w of 여섯) {
  for (const r of 결과.filter((x) => String(x.곳).includes(w))) {
    console.log('| ' + r.곳 + ' | ' + r.사이트줄
      + ' | ' + (r.찾은것['회원 화면'] || 0) + ' | ' + (r.찾은것.보류함 || 0)
      + ' | ' + (r.찾은것.감춤 || 0) + ' | ' + (r.찾은것.쓰레기통 || 0)
      + ' | **' + r.빠진수 + '** |');
  }
}
console.log('');
for (const w of 여섯) {
  for (const r of 결과.filter((x) => String(x.곳).includes(w))) {
    if (!r.빠진수) continue;
    console.log('**' + r.곳 + '** — 어디에도 없는 ' + r.빠진수 + '건');
    for (const t of r.빠진것.slice(0, 전체보기 ? 99 : 12)) console.log('   · ' + String(t).slice(0, 72));
    if (!전체보기 && r.빠진수 > 12) console.log('   … 그밖 ' + (r.빠진수 - 12) + '건');
    console.log('');
  }
}

console.log('── 빠진 것이 많은 곳 앞 20 (전체) ──');
for (const r of 결과.slice().sort((a, b) => b.빠진수 - a.빠진수).slice(0, 20)) {
  console.log('   ' + String(r.곳).slice(0, 24).padEnd(26)
    + '사이트 ' + String(r.사이트줄).padStart(3)
    + ' · 빠짐 ' + String(r.빠진수).padStart(3)
    + (r.DB에있는기관이름 ? '  ← DB 에 이 기관 공고가 0건' : ''));
}
console.log('');
console.log('→ docs/시험_playwright_1012/C_제목대조.json');
console.log('DB 를 안 건드렸습니다. 읽기만 했습니다.');
