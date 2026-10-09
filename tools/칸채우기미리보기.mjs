/* 칸채우기미리보기 — 공고 상세 **일곱 칸**을 지금 자료로 채워 보면
 * 어디까지 차는지 **미리 봅니다. DB 는 한 줄도 안 바꿉니다** (select 만).
 *
 *   node tools/칸채우기미리보기.mjs [--몇개 20]
 *
 * 내는 것 — docs/칸채우기_미리보기_1010.md
 *
 * ── 채우는 순서 (세중님 확정) ───────────────────────────────
 *   ① 제목  ② 상세 API 가 준 detail  ③ 첨부 공고문
 * ③ 의 재료는 지금 **job_body**(수집기가 읽어 둔 공고문 글자 329줄)입니다.
 * job_attachments 는 0줄이라 주소로 다시 받을 것이 없습니다 (2026-10-10 확인).
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · 숫자를 **만들지 않습니다.** 칸마다 **원문 한 줄**을 근거로 붙입니다
 *   · 못 찾으면 「공고에 없음」을 쓰지 않고 **빈 칸**으로 둡니다
 *   · 모집인원은 **우리 직군 인원만**. 통합 공고의 전체 인원을 쓰지 않습니다
 *   · 「내규에 따름」·「협의」는 공고 말 그대로
 *   · admin_locked · edited_fields 가 걸린 칸은 **안 봅니다**
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.join(여기, '..');

function env() {
  const out = {};
  for (const f of [path.join(뿌리, '.env'), path.join(뿌리, '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  return out;
}
const cfg = env();
const URL_ = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const KEY = cfg.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다.'); process.exit(2); }
const 몇개 = (() => { const i = process.argv.indexOf('--몇개'); return i >= 0 ? Number(process.argv[i + 1]) : 20; })();

async function 한쪽(길, 부터, 까지) {
  const r = await fetch(URL_ + '/rest/v1/' + 길,
    { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${부터}-${까지}` } });
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
/* PostgREST 100줄 상한 — 쪽을 넘겨 다 받습니다 (작업지침 6절) */
async function 읽기(길, 한쪽수 = 100, 최대 = 20000) {
  const out = [];
  for (let 부터 = 0; 부터 < 최대; 부터 += 한쪽수) {
    const 묶음 = await 한쪽(길, 부터, 부터 + 한쪽수 - 1);
    if (!묶음.length) break;
    out.push(...묶음);
    if (묶음.length < 한쪽수) break;
  }
  return out;
}

/* ── 뽑는 규칙 ───────────────────────────────────────────────
   정규식 하나하나에 **그 값을 어디서 봤는지**를 함께 돌려줍니다.
   근거 없는 값은 안 씁니다 (지침 2절 — 원문을 찍습니다) */
const 직군말 = { 작업치료사: /작업\s*치료\s*사/, 물리치료사: /물리\s*치료\s*사/ };

function 줄들(글) { return String(글 || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean); }

/* 모집인원 — **우리 직군이 적힌 줄**에서만 셉니다 */
function 모집인원뽑기(글, 직군) {
  const 재기 = 직군 && 직군 !== '공통' ? 직군말[직군] : null;
  for (const 줄 of 줄들(글)) {
    if (재기 && !재기.test(줄)) continue;
    if (!재기 && !/작업\s*치료|물리\s*치료/.test(줄)) continue;
    const m = 줄.match(/(\d{1,3})\s*명/);
    if (m) return { 값: m[1] + '명', 근거: 줄.slice(0, 120) };
    if (/내규|협의|０?명\s*내외|약간\s*명/.test(줄)) {
      const w = 줄.match(/(내규에?\s*따름|협의|약간\s*명)/);
      if (w) return { 값: w[1], 근거: 줄.slice(0, 120) };
    }
  }
  return null;
}

function 연봉뽑기(글) {
  for (const 줄 of 줄들(글)) {
    if (!/보수|급여|연봉|월급|임금|수당/.test(줄)) continue;
    /* 「내규에 따름」·「협의」는 **말 그대로** 씁니다. 숫자를 만들지 않습니다 */
    const w = 줄.match(/(내규에?\s*따름|회사\s*내규|협의|공고문\s*참조)/);
    if (w) return { 값: w[1], 근거: 줄.slice(0, 120) };
    const m = 줄.match(/([0-9][0-9,]{2,})\s*(원|천원|만원)/);
    if (m) return { 값: m[1] + m[2], 근거: 줄.slice(0, 120) };
  }
  return null;
}

function 지원자격뽑기(글) {
  const xs = 줄들(글);
  for (let i = 0; i < xs.length; i++) {
    if (!/응시\s*자격|지원\s*자격|자격\s*요건|응시자격기준/.test(xs[i])) continue;
    const 덩이 = xs.slice(i, i + 4).join(' ').slice(0, 220);
    return { 값: 덩이, 근거: xs[i].slice(0, 120) };
  }
  for (const 줄 of xs) {
    const m = 줄.match(/.{0,40}(면허|자격증)\s*소지.{0,60}/);
    if (m) return { 값: m[0].trim(), 근거: 줄.slice(0, 120) };
  }
  return null;
}

function 근무지뽑기(글) {
  for (const 줄 of 줄들(글)) {
    if (!/근무\s*지|근무\s*장소|근무\s*부서|소재지/.test(줄)) continue;
    return { 값: 줄.replace(/^[○●□■▶·\-\s]*/, '').slice(0, 120), 근거: 줄.slice(0, 120) };
  }
  return null;
}

function 마감뽑기(글) {
  for (const 줄 of 줄들(글)) {
    if (!/접수\s*기간|원서\s*접수|접수\s*마감|제출\s*기한/.test(줄)) continue;
    return { 값: 줄.replace(/^[○●□■▶·\-\s]*/, '').slice(0, 120), 근거: 줄.slice(0, 120) };
  }
  return null;
}

/* ── 모으기 ───────────────────────────────────────────────── */
const 고를칸 = 'id,source,org_name,title,job_group,headcount,apply_to,work_place,'
  + 'detail,뽑은값,edited_fields,admin_locked,hidden,hold';
const 공고 = await 읽기(`job_posts?select=${encodeURIComponent(고를칸)}`
  + '&hidden=eq.false&hold=eq.false&admin_locked=eq.false&order=id.asc');
const 글자 = await 읽기('job_body?select=job_id,file_name,url,body');
const 글자집 = new Map(글자.map((b) => [b.job_id, b]));

/* 세중님이 콕 집은 둘을 꼭 넣습니다 */
const 꼭 = 공고.filter((j) => /강릉의료원|삼성서울병원/.test(j.org_name || ''));
/* 나머지는 **수집원 골고루** — 출처마다 돌아가며 뽑습니다 */
const 출처별 = new Map();
for (const j of 공고) {
  if (꼭.includes(j)) continue;
  if (!출처별.has(j.source)) 출처별.set(j.source, []);
  출처별.get(j.source).push(j);
}
/* 공고문 글자가 있는 것을 먼저 — ③ 단계를 실제로 보려고 */
for (const xs of 출처별.values()) xs.sort((a, b) => (글자집.has(b.id) ? 1 : 0) - (글자집.has(a.id) ? 1 : 0));
const 고른것 = [...꼭];
for (let 바퀴 = 0; 고른것.length < 몇개; 바퀴++) {
  let 더했나 = false;
  for (const xs of 출처별.values()) {
    if (xs[바퀴] && 고른것.length < 몇개) { 고른것.push(xs[바퀴]); 더했나 = true; }
  }
  if (!더했나) break;
}

const 칸이름 = ['모집인원', '접수마감', '근무지', '지원자격', '예상연봉', '얼마나바쁜곳', '병원뜯어보기'];
const 셈 = Object.fromEntries(칸이름.map((k) => [k, { 참: 0, 빔: 0 }]));
const 출처셈 = { 제목: 0, '상세API': 0, '첨부(job_body)': 0, 기관표: 0, 심평원: 0 };
const 결과 = [];

for (const j of 고른것) {
  const d = j.detail ?? {}; const p = j.뽑은값 ?? {};
  const 잠김 = new Set(j.edited_fields ?? []);
  const 본문 = 글자집.get(j.id);
  const 공고문 = 본문?.body ?? '';
  const 칸 = {};

  const 넣기 = (이름, 값, 출처, 근거) => {
    칸[이름] = { 값, 출처, 근거: 근거 ?? '' };
    if (출처 in 출처셈) 출처셈[출처]++;
  };

  /* ① 모집인원 */
  if (잠김.has('모집인원')) 넣기('모집인원', null, '관리자 잠금');
  else if (j.headcount != null) 넣기('모집인원', j.headcount + '명', '상세API', `headcount = ${j.headcount}`);
  else if (p.모집인원) 넣기('모집인원', p.모집인원, '상세API', '뽑은값');
  else {
    const r = 공고문 && 모집인원뽑기(공고문, j.job_group);
    if (r) 넣기('모집인원', r.값, '첨부(job_body)', r.근거);
    else 칸.모집인원 = null;
  }

  /* ② 접수마감 */
  if (j.apply_to) 넣기('접수마감', j.apply_to, '상세API', `apply_to = ${j.apply_to}`);
  else {
    const t = String(j.title || '').match(/~\s*(\d{1,2})\s*[./월]\s*(\d{1,2})/);
    if (t) 넣기('접수마감', `${t[1]}.${t[2]}`, '제목', String(j.title).slice(0, 90));
    else {
      const r = 공고문 && 마감뽑기(공고문);
      if (r) 넣기('접수마감', r.값, '첨부(job_body)', r.근거);
      else 칸.접수마감 = null;
    }
  }

  /* ③ 근무지 */
  if (j.work_place) 넣기('근무지', j.work_place, '상세API', `work_place = ${j.work_place}`);
  else if (p.근무지) 넣기('근무지', p.근무지, '상세API', '뽑은값');
  else {
    const r = 공고문 && 근무지뽑기(공고문);
    if (r) 넣기('근무지', r.값, '첨부(job_body)', r.근거);
    else 칸.근무지 = null;
  }

  /* ④ 지원자격 */
  if (d.지원자격) 넣기('지원자격', String(d.지원자격).slice(0, 200), '상세API', 'detail.지원자격');
  else if (p.지원자격) 넣기('지원자격', p.지원자격, '상세API', '뽑은값');
  else {
    const r = 공고문 && 지원자격뽑기(공고문);
    if (r) 넣기('지원자격', r.값, '첨부(job_body)', r.근거);
    else 칸.지원자격 = null;
  }

  /* ⑤ 예상 연봉 */
  if (d.연봉) 넣기('예상연봉', String(d.연봉).slice(0, 120), '상세API', 'detail.연봉');
  else if (p.예상연봉) 넣기('예상연봉', p.예상연봉, '상세API', '뽑은값');
  else {
    const r = 공고문 && 연봉뽑기(공고문);
    if (r) 넣기('예상연봉', r.값, '첨부(job_body)', r.근거);
    else 칸.예상연봉 = null;
  }

  /* ⑥⑦ 심평원·기관표에서 오는 둘 — 공고가 아니라 **기관**에서 옵니다 */
  넣기('얼마나바쁜곳', '(심평원 치료사 수에서 계산)', '심평원', '공고와 무관 · 기관 자료');
  넣기('병원뜯어보기', '(기관표)', '기관표', '공고와 무관 · 기관 자료');

  for (const k of 칸이름) {
    if (칸[k] && 칸[k].값) 셈[k].참++; else 셈[k].빔++;
  }
  결과.push({ j, 칸, 공고문있나: !!공고문, 공고문글자수: 공고문.length });
}

/* ── 글로 ───────────────────────────────────────────────── */
const 안전 = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
let md = `# 공고 칸 채우기 — 미리 돌려 본 것 (2026-10-10)

**DB 를 한 줄도 안 바꿨습니다.** \`select\` 만 했습니다.
\`node tools/칸채우기미리보기.mjs --몇개 ${몇개}\` 로 다시 낼 수 있습니다.

## 어디서 재료가 오나

| 단계 | 재료 | 지금 상태 |
|---|---|---|
| ① 제목 | \`job_posts.title\` | 있음 |
| ② 상세 API | \`job_posts.detail\` · \`headcount\` · \`apply_to\` · \`work_place\` | 있음 |
| ③ 첨부 공고문 | **\`job_body.body\`** — 수집기가 읽어 둔 공고문 글자 | **${글자.length}줄** |
| — | \`job_attachments\` (첨부 주소) | **0줄** |

③ 은 원래 \`job_attachments\` 의 주소로 파일을 다시 받아 읽는 자리였는데,
그 표가 비어 있습니다. 대신 **이미 읽어 둔 글자**(\`job_body\`)를 씁니다 —
다시 받을 필요가 없어 더 쌉니다. 다만 보이는 공고 ${공고.length}건 중
글자가 있는 것은 **${공고.filter((j) => 글자집.has(j.id)).length}건**뿐입니다.

## 칸별 채움 비율 (이 ${결과.length}건 기준)

| 칸 | 참 | 빔 | 참 비율 |
|---|---|---|---|
`;
for (const k of 칸이름) {
  const s = 셈[k];
  md += `| ${k} | ${s.참} | ${s.빔} | ${Math.round(s.참 / 결과.length * 100)}% |\n`;
}
md += `
**얼마나 바쁜 곳 · 병원 뜯어보기 둘은 공고가 아니라 기관 자료에서 옵니다** —
공고를 아무리 읽어도 안 채워지고, 기관표·심평원 자료가 있으면 늘 찹니다.
그래서 「공고에서 채워야 하는 칸」은 **앞 다섯**입니다.

## 값이 어디서 왔나

| 출처 | 칸 수 |
|---|---|
`;
for (const [k, v] of Object.entries(출처셈).sort((a, b) => b[1] - a[1])) md += `| ${k} | ${v} |\n`;

md += `
---

## 공고마다

`;
for (const r of 결과) {
  const j = r.j;
  md += `### ${j.id} · ${안전(j.org_name)}\n\n`;
  md += `> ${안전(String(j.title).slice(0, 110))}\n\n`;
  md += `출처 \`${j.source}\` · 직군 ${j.job_group ?? '(없음)'} · `
    + (r.공고문있나 ? `공고문 글자 **${r.공고문글자수}자**` : '**공고문 글자 없음**') + '\n\n';
  md += '| 칸 | 값 | 출처 | 근거 (원문 한 줄) |\n|---|---|---|---|\n';
  for (const k of 칸이름) {
    const c = r.칸[k];
    md += `| ${k} | ${c && c.값 ? '**' + 안전(String(c.값).slice(0, 90)) + '**' : '— _안 그림_'} `
      + `| ${c ? 안전(c.출처) : ''} | ${c && c.근거 ? '`' + 안전(String(c.근거).slice(0, 90)) + '`' : ''} |\n`;
  }
  const 빈것 = 칸이름.filter((k) => !(r.칸[k] && r.칸[k].값));
  md += `\n못 찾은 칸 — ${빈것.length ? '**' + 빈것.join(' · ') + '** (「공고에 없음」이라 안 적고 빈 칸으로 둡니다 → `/admin/blanks`)' : '없음'}\n\n`;
}

/* ── 377건 전체 어림 ───────────────────────────────────── */
const 글자있는공고 = 공고.filter((j) => 글자집.has(j.id)).length;
md += `---

## ${공고.length}건 전체로 보면

| | 수 |
|---|---|
| 보이는 공고 | ${공고.length}건 |
| 공고문 글자가 있는 것 | **${글자있는공고}건** |
| 글자가 없어 ③ 을 못 쓰는 것 | ${공고.length - 글자있는공고}건 |

**Haiku 를 부를 일이 지금은 없습니다.** Haiku 는 공고문이 **그림**일 때 쓰는데,
\`job_attachments\` 가 0줄이라 그림 첨부가 **0장**입니다. \`job_body\` 는 이미
글자라 읽는 데 모델이 필요 없습니다.

| | 값 |
|---|---|
| 이 미리보기에서 부른 Haiku | **0번** · 토큰 0 · **$0.00** |
| ${공고.length}건 전체로 늘려도 | **0번** · **$0.00** (그림 첨부가 0장이라) |

수집기가 첨부를 담기 시작하면 그때 그림 첨부가 생기고, 그제야 Haiku 값이
생깁니다. \`tools/공고칸채우기.mjs --dry\` 가 그 수를 셉니다.

**숫자를 지어내지 않았습니다** — 위 표의 모든 값에 원문 한 줄을 붙였고,
근거를 못 찾은 칸은 비워 두었습니다.
`;

const 낼곳 = path.join(뿌리, 'docs', '칸채우기_미리보기_1010.md');
fs.writeFileSync(낼곳, md);
console.log(`\n○ ${결과.length}건 → docs/칸채우기_미리보기_1010.md`);
for (const k of 칸이름) {
  console.log('  ' + k.padEnd(12) + 셈[k].참 + '/' + 결과.length
    + ' (' + Math.round(셈[k].참 / 결과.length * 100) + '%)');
}
console.log('  공고문 글자가 있는 공고 ' + 글자있는공고 + '/' + 공고.length);
console.log('  Haiku 0번 · $0.00 (그림 첨부 0장)');
