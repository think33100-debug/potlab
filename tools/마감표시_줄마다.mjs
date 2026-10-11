/* 회원에게 보이는 HS 공고가, **그 사이트 목록 줄에서는 「마감」 인가**
 * (2026-10-12 · 조사만 · 읽기만).
 *
 *   node tools/마감표시_줄마다.mjs
 *   → docs/시험_playwright_1012/C_줄마다마감.json
 *
 * ── 왜 줄마다 봐야 하나 ──────────────────────────────────────
 * 쓸기(`병원목록쓸기.mjs`)는 **곳마다** 「상태 표시가 있나」까지만 봤습니다.
 * 그걸로는 「우리가 보여주는 그 공고가 마감인가」를 알 수 없습니다 —
 * 동천동강병원은 한 목록에 「마감」 과 「접수중」 이 섞여 있습니다.
 *
 * 그래서 설정의 `row` 정규식으로 목록을 **줄로 자르고**, 줄 안에서
 *   ① 그 줄의 제목이 우리 공고의 제목인가
 *   ② 그 줄에 상태말이 있나
 * 를 같이 봅니다. `row` 는 `hospParseHtml` 이 쓰는 것과 **같은 정규식**입니다
 * (지침 6절 — 제가 새로 만들지 않습니다).
 *
 * 줄 안의 글자로만 봅니다. 상세를 열지 않습니다. 곳마다 요청 한 번.
 *
 * **DB 를 안 건드립니다.**
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { 글받기 } from './certs/index.mjs';

const require = createRequire(import.meta.url);
const { hospParseHtml, UA } = require('./hosp/hs_test.js');
const 기본머리 = { 'User-Agent': UA, 'Accept-Language': 'ko' };

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 폴더 = path.join(여기, '..', 'docs', '시험_playwright_1012');

function env() {
  const out = {};
  for (const f of ['.env', '.env.local']) {
    const p = path.join(여기, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };
const q = async (p) => {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + p, { headers: { ...H, Range: '0-999', 'Range-Unit': 'items' } });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
};

const G = fs.readFileSync(path.join(여기, '..', 'gas', 'wage.js'), 'utf8');
const i0 = G.indexOf('const HOSP_SITES = [');
let d = 0; let end = -1;
for (let k = G.indexOf('[', i0); k < G.length; k++) {
  if (G[k] === '[') d++; else if (G[k] === ']' && --d === 0) { end = k + 1; break; }
}
const S = new Function('return ' + G.slice(G.indexOf('[', i0), end))();

const 기관키 = (s) => String(s || '')
  .replace(/의료법인|학교법인|재단법인|사회복지법인|특수법인|사단법인|지방의료원|의료재단|복지재단|유지재단|부속/g, '')
  .replace(/[\s()·,)]/g, '').toLowerCase();
/* ⚠ 줄을 **고르는** 자리에서는 괄호 안을 버리면 안 됩니다 (2026-10-12 에 데었습니다).
 *   부산광역시의료원 「직원 모집 공고(물리치료사 - 기간제)」 에서 괄호를 버리니
 *   「직원모집공고」 가 되어 **「직원 모집 공고(기록물관리 전문요원 - 행정직)」 줄**에
 *   붙었습니다. 그 줄이 「완료」 라서 우리 물리치료사 공고를 마감으로 셌습니다 — 헛경보입니다.
 * 그래서 줄 고르기는 **괄호 안을 살린** 꼴로 하고, 말머리 상태 표시만 걷습니다.
 * 「있나 없나」 만 볼 때(병원제목대조.mjs)는 느슨한 쪽이 맞습니다. 쓰임이 다릅니다. */
const 견줄 = (s) => String(s || '')
  .replace(/^\s*[[(<【]\s*(마감|종료|완료|모집마감|접수마감|채용마감|채용완료|모집완료)\s*[\])>】]/g, ' ')
  .replace(/[★☆■□●○◆◇▶▷…·,.'"“”‘’\-–—_/\\|:;!?~[\]()<>【】]/g, '')
  .replace(/\s+/g, '').toLowerCase();
const 태그걷기 = (h) => String(h || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const 닫힘말 = /마감|종료|완료|접수\s*끝/;
const 열림말 = /접수\s*중|진행\s*중|채용\s*중|모집\s*중/;

/* ── 회원에게 보이는 HS 공고 ── */
const 보이는것 = (await q('job_posts_pub?select=id,org_name,title,원문제목,apply_to&order=id.asc'))
  .filter((v) => /^HS/.test(v.id));
console.log('회원에게 보이는 HS 공고 ' + 보이는것.length + '건');

/* 기관별로 묶어 곳마다 한 번만 받습니다 */
const 기관별 = new Map();
for (const v of 보이는것) {
  const k = 기관키(v.org_name);
  if (!기관별.has(k)) 기관별.set(k, { 기관: v.org_name, 공고: [] });
  기관별.get(k).공고.push(v);
}
console.log('기관 ' + 기관별.size + '곳에서 받습니다');
console.log('');

const 결과 = [];
let n = 0;
for (const [k, g] of 기관별) {
  n++;
  const s = S.find((x) => 기관키(x.name) === k);
  if (!s) { for (const v of g.공고) 결과.push({ ...v, 판정: '설정에 그 기관이 없음' }); continue; }
  if (s.type !== 'html') {
    /* 넷은 이미 상태를 읽어 마감을 버립니다 — 보이는 것은 「접수중」 인 것뿐입니다 */
    for (const v of g.공고) 결과.push({ ...v, 곳: s.name, 갈래: s.type, 판정: '갈래가 이미 상태를 읽습니다' });
    continue;
  }
  let html = '';
  try {
    const r = await 글받기(s.url, { headers: 기본머리, enc: s.enc });
    if (r.왜 || r.code !== 200) { for (const v of g.공고) 결과.push({ ...v, 곳: s.name, 갈래: s.type, 판정: '못 받음 · ' + (r.왜 || ('HTTP ' + r.code)) }); continue; }
    html = r.html;
  } catch (e) {
    for (const v of g.공고) 결과.push({ ...v, 곳: s.name, 갈래: s.type, 판정: '탈 ' + String(e.message).slice(0, 60) });
    continue;
  }
  /* 설정의 `row` 로 줄을 자릅니다 — hospParseHtml 이 쓰는 것과 같은 정규식 */
  const 줄들 = s.row ? (html.match(new RegExp(s.row, 'g')) || []) : [];
  let rows = [];
  try { rows = hospParseHtml(html, s); } catch (e) { /* 줄만으로도 봅니다 */ }

  for (const v of g.공고) {
    const kk = 견줄(v.원문제목 || v.title);   /* ★ job_posts_pub.title 은 **다듬은 제목**입니다. 사이트와 견줄 것은 원문제목 */
    /* 그 제목이 든 줄을 찾습니다 */
    /* 줄 글에 제목이 **통째로** 들어 있어야 그 줄로 봅니다.
       짧은 제목은 여러 줄에 걸릴 수 있으니, 걸린 줄이 둘 이상이면 못 가린 것으로 둡니다 */
    const 걸린줄 = kk.length >= 6 ? 줄들.filter((c) => 견줄(태그걷기(c)).includes(kk)) : [];
    const 줄 = 걸린줄.length === 1 ? 걸린줄[0] : null;
    const 여러줄 = 걸린줄.length > 1;
    const 목록에있나 = rows.some((r) => {
      const t = 견줄(r.title);
      return t === kk || (t.length >= 8 && (t.includes(kk) || kk.includes(t)));
    });
    if (!줄) {
      결과.push({
        ...v, 곳: s.name, 갈래: s.type, 목록에있나,
        판정: 여러줄 ? '같은 제목의 줄이 ' + 걸린줄.length + '개 — 가릴 수 없음'
          : 목록에있나 ? '줄을 못 찾음(규칙)' : '**사이트 목록에 없음**',
      });
      continue;
    }
    const 글 = 태그걷기(줄);
    const 제목밖 = 글.split(/\s+/).join(' ');
    결과.push({
      ...v, 곳: s.name, 갈래: s.type, 목록에있나,
      줄글: 글.slice(0, 160),
      닫힘: 닫힘말.test(제목밖), 열림: 열림말.test(제목밖),
      판정: 닫힘말.test(제목밖) && !열림말.test(제목밖) ? '**그 줄이 「마감」 입니다**'
        : 열림말.test(제목밖) && !닫힘말.test(제목밖) ? '그 줄이 「접수중」 입니다'
          : 닫힘말.test(제목밖) && 열림말.test(제목밖) ? '둘 다 있음 — 가릴 수 없음'
            : '상태말 없음',
    });
  }
  if (n % 10 === 0) console.log('  … ' + n + '/' + 기관별.size);
  await new Promise((r) => setTimeout(r, 400));
}

fs.writeFileSync(path.join(폴더, 'C_줄마다마감.json'), JSON.stringify({ 센날: new Date().toISOString(), 줄: 결과 }, null, 1));

const 셈 = {};
for (const r of 결과) 셈[r.판정] = (셈[r.판정] ?? 0) + 1;
console.log('');
console.log('── 회원에게 보이는 HS ' + 결과.length + '건을, 그 사이트 목록 줄에서 다시 보면 ──');
for (const [kk, v] of Object.entries(셈).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + String(v).padStart(4) + '건  ' + kk);
}
console.log('');
const 마감인것 = 결과.filter((r) => /「마감」 입니다/.test(r.판정));
console.log('── **사이트에서는 마감인데 회원에게 보이는 공고** ' + 마감인것.length + '건 ──');
for (const r of 마감인것) {
  console.log('   ' + String(r.곳).slice(0, 18).padEnd(20) + String(r.title).slice(0, 40).padEnd(42)
    + (r.apply_to ? '마감일 ' + r.apply_to : '마감일 없음'));
  console.log('        줄 — ' + String(r.줄글).slice(0, 110));
}
console.log('');
const 없는것 = 결과.filter((r) => /목록에 없음/.test(r.판정));
console.log('── 사이트 목록에 아예 없는 것 ' + 없는것.length + '건 ──');
for (const r of 없는것) {
  console.log('   ' + String(r.곳).slice(0, 18).padEnd(20) + String(r.title).slice(0, 44));
}
console.log('');
console.log('→ docs/시험_playwright_1012/C_줄마다마감.json');
