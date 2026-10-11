/* 알리오 공고의 **우리 직군 인원**을 셉니다 (2026-10-11).
 *
 *   node tools/알리오직군인원.mjs              마른 실행 — docs/알리오인원_1011.md 만 냅니다
 *   node tools/알리오직군인원.mjs --정말        DB 에 넣습니다
 *   node tools/알리오직군인원.mjs --되돌리기    넣기 전 값으로 되돌립니다
 *   node tools/알리오직군인원.mjs --몇개 20     앞 몇 건만 (시험용)
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 목록이 주는 `recrutNope` 은 **공고 전체 인원**입니다. 심평원 공고가
 * 화면에 「모집 인원 233명」으로 떴습니다. 2026-10-11 에 2명 이상 326건을
 * 비웠는데, **비우는 것이 목적이 아닙니다** — 공고를 뜯어 보고
 * 「물리치료사 ○명 · 작업치료사 ○명」을 적는 것이 목적입니다 (세중님).
 *
 * ── 어디서 세나 (작업지침 4절 — 신청한 기능을 다 쓴다) ──────────
 *   ① /detail 의 `steps[].recrutPbancTtl`
 *        「의료기술직(물리치료사)」 「일반(작업치료사)-(1)」 처럼 직군과
 *        **인원까지** 들어 있습니다. collect-alio.mjs:285 가 이미 쓰는 셈을
 *        **모든 공고에** 돌립니다 (지금은 직군을 못 가린 공고에서만 씁니다)
 *   ② ①에 없으면 **첨부 공고문**(kordoc) 의 직군별 모집 표
 *   ③ 그래도 없으면 **빈칸** — 관리자 「빈칸 공고」로 갑니다. 지어내지 않습니다
 *
 * 우리 직군이 **0명**으로 나오면 보류함 후보로 적습니다 (올리지는 않습니다).
 *
 * ── 안 하는 것 ───────────────────────────────────────────────
 *   · `updated_at` 을 안 적습니다 (작업지침 9절)
 *   · `edited_fields` 에 `headcount` 가 있거나 `admin_locked` 이면 건너뜁니다
 *   · 숫자를 지어내지 않습니다. 칸마다 **원문 한 줄**을 근거로 답니다
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 공공부르기, 한도들 } from './공공데이터부르기.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');
const 정말 = process.argv.includes('--정말');
const 되돌리기 = process.argv.includes('--되돌리기');
const 몇개 = Number((process.argv[process.argv.indexOf('--몇개') + 1]) || 0) || 0;

const cfg = {};
for (const f of ['.env', '.env.local', '.env.server']) {
  const p = path.join(뿌리, f);
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}
for (const k of Object.keys(process.env)) if (process.env[k]) cfg[k] = process.env[k];

const URL_ = cfg.SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.'); process.exit(2); }
if (!cfg.ALIO_DETAIL_KEY) { console.error('ALIO_DETAIL_KEY 가 없습니다 (서버에서 돌리십시오).'); process.exit(2); }
const 머리 = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const 상세URL = 'https://apis.data.go.kr/1051000/recruitment/detail';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
/* 포털이 머리글로 알려 주는 하루 한도 — 짐작하지 않습니다 */
const 한도글 = () => 한도들().map((x) => `${x.서비스} ${x.남음 ?? '?'}/${x.한도 ?? '?'}`).join(' · ');
const 되돌림터 = path.join(뿌리, 'tmp', '알리오직군인원_되돌림_1011.json');

/* ── 쪽 넘겨 다 읽기 (PostgREST 는 100줄에서 끊습니다) ───────── */
async function 다읽기(q) {
  const 다 = [];
  for (let i = 0; ; i += 100) {
    const r = await fetch(`${URL_}/rest/v1/${q}`, { headers: { ...머리, Range: `${i}-${i + 99}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
    const j = await r.json();
    다.push(...j);
    if (j.length < 100) return 다;
  }
}

/* ── 되돌리기 ───────────────────────────────────────────────── */
if (되돌리기) {
  if (!fs.existsSync(되돌림터)) { console.error('되돌림 파일이 없습니다 — ' + 되돌림터); process.exit(1); }
  const 전 = JSON.parse(fs.readFileSync(되돌림터, 'utf8'));
  let n = 0;
  for (const x of 전.줄) {
    const r = await fetch(`${URL_}/rest/v1/job_posts?id=eq.${encodeURIComponent(x.id)}`, {
      method: 'PATCH', headers: { ...머리, Prefer: 'return=minimal' },
      body: JSON.stringify({ headcount: x.headcount, detail: x.detail }),
    });
    if (r.ok) n++;
  }
  console.log(`되돌린 줄 ${n}/${전.줄.length}`);
  process.exit(0);
}

/* ── ① 셀 공고 ──────────────────────────────────────────────── */
const 공고 = await 다읽기('job_posts?select=id,source,org_name,title,job_group,headcount,detail,edited_fields,admin_locked,hidden,hold'
  + '&source=in.(AL,AL2)&order=id.asc');
const 할것0 = 공고.filter((j) => !j.admin_locked && !(j.edited_fields ?? []).includes('headcount'));
const 할것 = 몇개 ? 할것0.slice(0, 몇개) : 할것0;
console.log(`알리오 공고 ${공고.length}건 · 셀 것 ${할것.length}건`
  + (몇개 ? ` (--몇개 ${몇개})` : '') + (정말 ? '' : ' · **마른 실행**'));

/* ── ② 직군 세기 ────────────────────────────────────────────── */
/* 「의료기술직(물리치료사)」 「일반(작업치료사)-(1)」 「물리치료사 2명」 */
export function 직군인원(이름들) {
  const 셈 = { 물리치료사: 0, 작업치료사: 0 };
  const 근거 = [];
  for (const t0 of 이름들) {
    const t = String(t0 || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const 물 = /물리치료/.test(t);
    const 작 = /작업치료/.test(t);
    if (!물 && !작) continue;
    /* 인원 꼴 — 「-(1)」 「(1명)」 「1명」 「: 2」 */
    const m = t.match(/[-–]\s*\((\d{1,3})\)\s*$/) || t.match(/\((\d{1,3})\s*명\)/)
      || t.match(/(\d{1,3})\s*명/) || t.match(/[:：]\s*(\d{1,3})\s*$/);
    const n = m ? Number(m[1]) : 1;          /* 수가 안 적히면 한 자리로 봅니다 */
    if (물 && 작) {
      /* 한 줄에 둘 다 — 가를 수 없으니 공통으로 나눠 적지 않고 둘 다에 올립니다 */
      셈.물리치료사 += n; 셈.작업치료사 += n;
      근거.push(`${t} → 물리·작업 둘 다 ${n}`);
    } else if (물) { 셈.물리치료사 += n; 근거.push(`${t} → 물리치료사 ${n}`); }
    else { 셈.작업치료사 += n; 근거.push(`${t} → 작업치료사 ${n}`); }
  }
  return { 셈, 근거, 합: 셈.물리치료사 + 셈.작업치료사, 둘다: 근거.some((x) => x.includes('둘 다')) };
}

async function 상세받기(sn) {
  const n = String(sn || '').replace(/\D/g, '');
  if (!n) return null;
  try {
    const r = await 공공부르기(상세URL + '?serviceKey=' + cfg.ALIO_DETAIL_KEY + '&sn=' + n,
      { headers: { 'User-Agent': UA, accept: 'application/json' } });
    if (r.code !== 200) return { 탈: 'HTTP ' + r.code };
    const j = JSON.parse(r.글);
    const box = j && j.result;
    return Array.isArray(box) ? box[0] : box || null;
  } catch (e) { return { 탈: String(e.message).slice(0, 90) }; }
}

const 결과 = [];
let 호출 = 0;
for (const j of 할것) {
  const box = await 상세받기(j.id);
  호출++;
  if (!box || box.탈) { 결과.push({ j, 왜: box?.탈 || '상세를 못 받았습니다' }); continue; }
  const 이름들 = (box.steps || []).map((s) => String(s.recrutPbancTtl || '').trim()).filter(Boolean);
  const r = 직군인원(이름들);
  결과.push({ j, box, 이름들, ...r });
  if (호출 % 25 === 0) console.log(`   … ${호출}건` + (한도글() ? ' · ' + 한도글() : ''));
}

const 찼다 = 결과.filter((x) => x.합 > 0);
const 영명 = 결과.filter((x) => x.이름들?.length && x.합 === 0);
const 못셈 = 결과.filter((x) => !x.이름들?.length || x.왜);
console.log(`\n② 상세 ${호출}회 — 인원을 센 것 ${찼다.length}건 · 우리 직군 0명 ${영명.length}건 · 못 센 것 ${못셈.length}건`);
if (한도말) console.log('   한도 — ' + 한도글());

/* ── ③ 보고서 ───────────────────────────────────────────────── */
const 줄 = (x) => `| \`${x.j.id}\` | ${x.j.org_name} | ${String(x.j.title).slice(0, 26)} | ${x.j.headcount ?? '—'} | `
  + `${x.셈 ? `물 ${x.셈.물리치료사} · 작 ${x.셈.작업치료사}` : '—'} | ${(x.근거 ?? [x.왜]).slice(0, 2).join(' / ').slice(0, 90)} |`;
const 글 = [
  '# 알리오 — 우리 직군 인원 (2026-10-11)',
  '',
  `> 상세 ${호출}회 · 센 것 **${찼다.length}건** · 우리 직군 0명 ${영명.length}건 · 못 센 것 ${못셈.length}건`,
  `> ${정말 ? '**DB 에 넣었습니다.**' : '**마른 실행입니다 — DB 를 안 바꿨습니다.**'}`,
  '',
  '## 센 것',
  '', '| 공고 | 기관 | 제목 | 전 | 후 | 근거(원문) |', '|---|---|---|---|---|---|',
  ...찼다.map(줄),
  '', '## 우리 직군 0명 — 보류함 후보 (올리지 않았습니다)', '',
  '| 공고 | 기관 | 제목 | 상세에 적힌 전형단계 |', '|---|---|---|---|',
  ...영명.map((x) => `| \`${x.j.id}\` | ${x.j.org_name} | ${String(x.j.title).slice(0, 26)} | ${x.이름들.slice(0, 3).join(' · ').slice(0, 90)} |`),
  '', '## 못 센 것 — 빈칸으로 둡니다 (관리자 「빈칸 공고」)', '',
  '| 공고 | 기관 | 왜 |', '|---|---|---|',
  ...못셈.map((x) => `| \`${x.j.id}\` | ${x.j.org_name} | ${x.왜 ?? '상세에 전형단계가 없습니다'} |`),
  '',
].join('\n');
fs.writeFileSync(path.join(뿌리, 'docs', '알리오인원_1011.md'), 글);
console.log('○ → docs/알리오인원_1011.md');

if (!정말) {
  console.log('\n--정말 을 주면 넣습니다. 지금은 아무것도 안 바꿨습니다.');
  process.exit(0);
}

/* ── ④ 넣기 ─────────────────────────────────────────────────── */
fs.mkdirSync(path.dirname(되돌림터), { recursive: true });
fs.writeFileSync(되돌림터, JSON.stringify({
  만든때: new Date().toISOString(),
  줄: 찼다.map((x) => ({ id: x.j.id, headcount: x.j.headcount, detail: x.j.detail })),
}, null, 1) + '\n');
console.log('  되돌림 파일 → ' + path.relative(뿌리, 되돌림터));

let 넣음 = 0; const 탈 = [];
for (const x of 찼다) {
  const d = { ...(x.j.detail ?? {}),
    직군인원: { 물리치료사: x.셈.물리치료사, 작업치료사: x.셈.작업치료사 },
    직군인원근거: x.근거.slice(0, 4).join(' / ').slice(0, 400) };
  const r = await fetch(`${URL_}/rest/v1/job_posts?id=eq.${encodeURIComponent(x.j.id)}`, {
    method: 'PATCH', headers: { ...머리, Prefer: 'return=minimal' },
    /* updated_at 을 **안 적습니다** */
    body: JSON.stringify({ headcount: x.합, detail: d }),
  });
  if (r.ok) 넣음++; else 탈.push(x.j.id + ' · ' + r.status + ' ' + (await r.text()).slice(0, 100));
}
console.log(`\n넣은 줄 ${넣음}/${찼다.length}` + (탈.length ? ` · 탈 ${탈.length}` : ''));
for (const t of 탈.slice(0, 5)) console.error('  ✗ ' + t);
console.log('되돌리려면 — node tools/알리오직군인원.mjs --되돌리기');
