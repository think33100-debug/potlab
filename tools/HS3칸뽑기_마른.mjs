/* HS3 상세 본문(`job_body`)에서 일곱 칸을 **뽑아 보기만** 합니다 (2026-10-11).
 *
 *   node tools/HS3칸뽑기_마른.mjs            전부
 *   node tools/HS3칸뽑기_마른.mjs --견본 8    견본 수
 *
 * **DB 를 하나도 안 건드립니다.** 칸별 채움률 전후와 견본만 찍습니다.
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * HS3 는 상세 본문을 **264줄(평균 8,826자)** 이나 담아 두고 있는데
 * 일곱 칸 채움이 `모집인원 1% · 접수마감 39% · 지원자격 0% · 예상연봉 0%`
 * 입니다. 재료가 있는데 뽑는 자리가 없습니다.
 *
 * 접수기간 규칙은 `tools/hosp/hs_dates.js` 한 벌이고 **이미 두 수집기가
 * 부릅니다**(2026-10-07). 그래도 39% 라서, 규칙이 약한지 안 불리는지를
 * 여기서 가립니다.
 *
 * ── 지키는 것 ───────────────────────────────────────────────
 *   · 모집인원은 **우리 직군 인원만**. 모르면 **비웁니다** (지침 15절)
 *     「0 명」「O명」 같은 값은 버립니다 — 10-10 에 28건 나왔던 그것입니다
 *   · 「내규에 따름」·「협의」는 공고 말 그대로. 숫자를 만들지 않습니다
 *   · 메뉴 글자를 본문으로 읽지 않습니다 — 앞 900자쯤이 메뉴입니다
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { hsDetailDates } = require_('./hosp/hs_dates.js');

const 견본수 = Number(process.argv[process.argv.indexOf('--견본') + 1]) || 5;

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of Object.keys(process.env)) if (process.env[k]) out[k] = process.env[k];
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}
const cfg = env();
if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1);
}
const H = { apikey: cfg.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY };

/* PostgREST 는 limit 을 줘도 100줄에서 끊습니다 — Range 로 쪽을 넘깁니다 */
async function 전부(길) {
  const 모두 = [];
  for (let 처음 = 0; ; 처음 += 100) {
    const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + 길,
      { headers: { ...H, Range: `${처음}-${처음 + 99}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(길.slice(0, 60) + ' HTTP ' + r.status + ' · ' + (await r.text()).slice(0, 200));
    const 한쪽 = await r.json();
    모두.push(...한쪽);
    if (한쪽.length < 100) return 모두;
  }
}

/* ── 본문 자리 찾기 ───────────────────────────────────────────
   앞부분이 메뉴 글자입니다 (「로그인 회원가입 LANGUAGE …」).
   「조회수 N」 뒤가 본문인 경우가 많아 그 표식을 먼저 봅니다 */
function 본문만(글) {
  const s = String(글 || '');
  const 표식 = [/조회수\s*[\d,]+/, /작성일\s*20\d\d/, /등록일\s*20\d\d/, /▣|◯|■\s*채용/];
  for (const t of 표식) {
    const m = s.match(t);
    if (m && m.index != null && m.index < s.length * 0.7) return s.slice(m.index);
  }
  return s;
}

/* ── 모집인원 — 우리 직군 줄에서만 ───────────────────────────
   지침 15절 — 통합공고의 전체 인원을 우리 직군 인원으로 쓰지 않습니다 */
function 모집인원(글) {
  const s = 본문만(글);
  /* 우리 직군 낱말 주변 90자 안의 「N명」 */
  const 직군 = /(물리\s*치료사|작업\s*치료사)/g;
  let m;
  while ((m = 직군.exec(s))) {
    const 창 = s.slice(Math.max(0, m.index - 40), m.index + 90);
    const n = 창.match(/([0-9]{1,3})\s*명/);
    if (!n) continue;
    const 값 = Number(n[1]);
    /* 「0 명」「00명」 은 기관이 잘못 적은 것입니다 — 버립니다 (10-10 에 28건) */
    if (!값) return { 값: null, 왜: '「' + n[0] + '」 — 0명은 버립니다', 줄: 창.trim().slice(0, 120) };
    if (값 > 50) return { 값: null, 왜: '「' + n[0] + '」 — 50명 넘으면 통합공고 전체일 수 있어 비웁니다', 줄: 창.trim().slice(0, 120) };
    return { 값, 왜: '우리 직군 낱말 주변', 줄: 창.trim().slice(0, 120) };
  }
  return { 값: null, 왜: '우리 직군 주변에 「N명」 이 없습니다', 줄: '' };
}

/* ── 지원자격 ──────────────────────────────────────────────── */
function 지원자격(글) {
  const s = 본문만(글);
  const a = s.match(/(응시\s*자격|지원\s*자격|자격\s*요건|응시요건|자격조건)[^가-힣A-Za-z0-9]{0,6}/);
  if (!a || a.index == null) return { 값: null, 왜: '자격 표식이 없습니다', 줄: '' };
  const 뒤 = s.slice(a.index + a[0].length, a.index + a[0].length + 420).trim();
  /* 「전형방법」 「접수」 같은 다음 꼭지를 만나면 끊습니다 */
  const 끊 = 뒤.search(/전형\s*방법|접수\s*(기간|방법)|제출\s*서류|근무\s*조건|◯|▣|■/);
  const 값 = (끊 > 30 ? 뒤.slice(0, 끊) : 뒤).replace(/\s+/g, ' ').trim();
  if (값.length < 10) return { 값: null, 왜: '표식 뒤가 너무 짧습니다 (' + 값.length + '자)', 줄: 값 };
  return { 값: 값.slice(0, 300), 왜: a[1], 줄: 값.slice(0, 140) };
}

/* ── 예상연봉 — 말 그대로만. 숫자를 만들지 않습니다 ─────────── */
function 예상연봉(글) {
  const s = 본문만(글);
  const a = s.match(/(보수|급여|연봉|임금|처우)[^가-힣A-Za-z0-9]{0,6}/);
  if (!a || a.index == null) return { 값: null, 왜: '급여 표식이 없습니다', 줄: '' };
  const 뒤 = s.slice(a.index, a.index + 200).replace(/\s+/g, ' ').trim();
  /* 「연봉정보」 처럼 메뉴 글자면 버립니다 */
  if (/^(연봉정보|급여정보)/.test(뒤)) return { 값: null, 왜: '메뉴 글자입니다', 줄: 뒤.slice(0, 80) };
  const 끊 = 뒤.search(/◯|▣|■|전형\s*방법|접수\s*기간/);
  const 값 = (끊 > 20 ? 뒤.slice(0, 끊) : 뒤).trim();
  if (값.length < 8) return { 값: null, 왜: '너무 짧습니다', 줄: 값 };
  return { 값: 값.slice(0, 160), 왜: a[1], 줄: 값.slice(0, 140) };
}

/* ── 근무지 ────────────────────────────────────────────────── */
function 근무지(글) {
  const s = 본문만(글);
  const a = s.match(/(근무\s*(지|장소|부서|처)|배치\s*부서|소속)[^가-힣A-Za-z0-9]{0,6}/);
  if (!a || a.index == null) return { 값: null, 왜: '근무지 표식이 없습니다', 줄: '' };
  const 뒤 = s.slice(a.index + a[0].length, a.index + a[0].length + 90).replace(/\s+/g, ' ').trim();
  const 값 = 뒤.split(/[◯▣■·|]|  /)[0].trim();
  if (값.length < 2) return { 값: null, 왜: '너무 짧습니다', 줄: 뒤.slice(0, 60) };
  return { 값: 값.slice(0, 80), 왜: a[1], 줄: 뒤.slice(0, 120) };
}

/* ── 본체 ───────────────────────────────────────────────────── */
const 몸들 = await 전부('job_body?select=job_id,body,kind,source&source=eq.HS3&kind=eq.' + encodeURIComponent('상세'));
console.log('job_body HS3 상세 — ' + 몸들.length + '줄');

const 번호들 = [...new Set(몸들.map((x) => x.job_id))];
const 공고들 = [];
for (let i = 0; i < 번호들.length; i += 80) {
  const 조각 = 번호들.slice(i, i + 80).map(encodeURIComponent).join(',');
  공고들.push(...await 전부('job_posts?select=id,title,org_name,job_group,headcount,apply_to,work_place,detail,'
    + encodeURIComponent('뽑은값') + ',edited_fields,admin_locked,hidden,hold&id=in.(' + 조각 + ')'));
}
const 공고맵 = new Map(공고들.map((j) => [j.id, j]));
console.log('견줄 공고 ' + 공고들.length + '건\n');

const 칸들 = ['접수마감', '모집인원', '지원자격', '예상연봉', '근무지'];
const 전 = {}; const 후 = {}; const 새로 = {}; const 못뽑은까닭 = {};
for (const k of 칸들) { 전[k] = 0; 후[k] = 0; 새로[k] = 0; 못뽑은까닭[k] = new Map(); }
const 견본 = [];
let 잠긴것 = 0;

for (const b of 몸들) {
  const j = 공고맵.get(b.job_id);
  if (!j) continue;
  const 잠김 = new Set([...(j.edited_fields || [])]);
  if (j.admin_locked) { 잠긴것++; continue; }   /* 관리자가 잠근 공고는 건드리지 않습니다 */

  const p = j['뽑은값'] || {};
  const d = j.detail || {};
  const 지금 = {
    접수마감: j.apply_to || null,
    모집인원: j.headcount != null ? String(j.headcount) : (p['모집인원'] || null),
    지원자격: d['지원자격'] || p['지원자격'] || null,
    예상연봉: d['연봉'] || p['예상연봉'] || null,
    근무지: j.work_place || p['근무지'] || null,
  };

  const 날 = hsDetailDates(본문만(b.body));
  const 뽑음 = {
    접수마감: { 값: (날 && 날.to) ? 날.to.replace(/\./g, '-') : null, 왜: (날 && 날.to) ? 'hs_dates' : '접수 표식/날짜 없음', 줄: '' },
    모집인원: 모집인원(b.body),
    지원자격: 지원자격(b.body),
    예상연봉: 예상연봉(b.body),
    근무지: 근무지(b.body),
  };

  const 한건 = { id: j.id, 기관: j.org_name, 제목: String(j.title || '').slice(0, 54), 칸: {} };
  for (const k of 칸들) {
    if (지금[k]) 전[k]++;
    const 쓸까 = !지금[k] && !잠김.has(k) && 뽑음[k].값 != null;
    if (지금[k] || 쓸까) 후[k]++;
    if (쓸까) 새로[k]++;
    if (!지금[k] && 뽑음[k].값 == null) {
      const w = 뽑음[k].왜;
      못뽑은까닭[k].set(w, (못뽑은까닭[k].get(w) ?? 0) + 1);
    }
    한건.칸[k] = { 지금: 지금[k], 뽑음: 뽑음[k].값, 왜: 뽑음[k].왜, 줄: 뽑음[k].줄 };
  }
  if (견본.length < 견본수 && 칸들.some((k) => 한건.칸[k].뽑음 != null && !한건.칸[k].지금)) 견본.push(한건);
}

const 셈 = 몸들.filter((b) => 공고맵.has(b.job_id)).length - 잠긴것;
console.log('── 칸별 채움률 (대상 ' + 셈 + '건 · 관리자 잠금 ' + 잠긴것 + '건 건너뜀) ──');
console.log('  칸          전      →  후       새로 채움');
for (const k of 칸들) {
  const p = (n) => String(Math.round(100 * n / 셈)).padStart(3) + '%';
  console.log('  ' + k.padEnd(10) + p(전[k]) + ' (' + String(전[k]).padStart(3) + ')  →'
    + p(후[k]) + ' (' + String(후[k]).padStart(3) + ')    +' + 새로[k]);
}

console.log('\n── 못 뽑은 까닭 (칸별 위 3개) ──');
for (const k of 칸들) {
  const 목 = [...못뽑은까닭[k]].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (!목.length) continue;
  console.log('  ' + k);
  for (const [w, n] of 목) console.log('     ' + String(n).padStart(3) + '건  ' + w);
}

console.log('\n── 견본 — 원문 해당 줄 ↔ 뽑은 값 ─────────────────');
for (const s of 견본) {
  console.log('\n  ' + s.id + '  ' + s.기관);
  console.log('    제목  ' + s.제목);
  for (const k of 칸들) {
    const c = s.칸[k];
    if (c.뽑음 == null && !c.지금) continue;
    console.log('    ' + k.padEnd(8) + ' 지금 ' + JSON.stringify(c.지금) + '  →  뽑음 ' + JSON.stringify(c.뽑음) + '   (' + c.왜 + ')');
    if (c.줄) console.log('             원문  ' + c.줄);
  }
}
console.log('\nDB 를 하나도 안 건드렸습니다.');
