/* 나라일터(GJ2) 모집인원을 `getItemPosition` 으로 되메웁니다 (2026-10-19 세중님 3번)
 *
 *   node tools/나라일터_인원되메우기.mjs --칸마른        무엇이 채워질지만 (기본)
 *   node tools/나라일터_인원되메우기.mjs --진짜          담습니다
 *   node tools/나라일터_인원되메우기.mjs --자기점검      규칙만 (API·DB 안 두드림)
 *   node tools/나라일터_인원되메우기.mjs --몇개 40
 *
 * ── 세중님이 좁혀 주신 규칙 ───────────────────────────────────────
 *   **「줄 하나 AND 제목 직군 하나」일 때만** 담습니다.
 *     ㉠ getItemPosition 의 `item` 이 **딱 한 줄**        — cnt 가 누구 것인지 분명합니다
 *     ㉡ 공고 **제목**에 우리 직군이 **하나만** 적혀 있다 — 물리치료 또는 작업치료 하나
 *   둘 중 하나라도 안 맞으면 **비웁니다.** 통합 공고의 전체 인원을 우리 직군
 *   인원으로 적으면 안 됩니다 (CLAUDE.md 15절 · 알리오에서 같은 자리를 겪었습니다 —
 *   `recrutNope` 가 계약직의사 21명을 그대로 주려 했습니다).
 *
 * ★ `cnt` 가 0 인 것은 **안 담습니다.** 「0명」 규칙(CLAUDE.md)은 **공고문에 사람이
 *   적어 둔 글자**를 그대로 보여 주는 것이고, API 의 0 은 「안 준 것」일 수 있어
 *   가릴 수가 없습니다. 틀린 숫자가 빈 칸보다 나쁩니다.
 * ★ 담는 길은 창구 `칸되메우기` 하나뿐입니다 (표를 직접 안 고칩니다).
 *   `edited_fields`·`admin_locked` 는 창구가 건너뜁니다.
 * ★ 되돌리는 법 — `칸기록` 에 옛 값이 남습니다 (아래 끝에 한 줄로 찍습니다).
 */
import fs from 'node:fs';
import { 인원칸 } from './워크넷상세칸.mjs';        /* 인원 꼴 가리기는 한 자리 */
import { 차례붙이기 } from './쪽나눠받기.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 자기점검만 = argv.includes('--자기점검');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 400) || 400;

/* ── 규칙 두 자리 ──────────────────────────────────────────────── */
/** 제목에 우리 직군이 **하나만** 있나 → 그 직군 이름 · 아니면 null */
export function 제목직군하나(제목) {
  const t = String(제목 || '');
  const 물 = /물리\s*치료/.test(t);
  const 작 = /작업\s*치료/.test(t);
  if (물 && 작) return null;            /* 둘 다면 통합 공고입니다 */
  if (!물 && !작) return null;          /* 제목에 직군이 없으면 모릅니다 */
  /* 「물리(작업)치료사」 꼴은 둘 다로 봅니다 — 묶은 꼴입니다 */
  if (/(물리|작업)\s*[(（]\s*(물리|작업)\s*[)）]?\s*치료/.test(t)) return null;
  return 물 ? '물리치료사' : '작업치료사';
}

/** getItemPosition 줄들 → 담을 인원 · 안 담으면 까닭 */
export function 담을인원(줄들, 제목) {
  const 직군 = 제목직군하나(제목);
  if (!직군) return { 값: null, 왜: '제목에 직군이 하나가 아닙니다' };
  if (!Array.isArray(줄들) || 줄들.length === 0) return { 값: null, 왜: 'item 0줄' };
  if (줄들.length > 1) return { 값: null, 왜: 'item ' + 줄들.length + '줄 (통합 공고일 수 있습니다)' };
  const cnt = String(줄들[0].cnt ?? '').trim();
  if (cnt === '') return { 값: null, 왜: 'cnt 가 빈칸' };
  if (Number(cnt) === 0) return { 값: null, 왜: 'cnt 가 0 (API 의 0 은 「안 준 것」일 수 있습니다)' };
  const n = 인원칸(cnt);
  if (!n) return { 값: null, 왜: 'cnt 꼴이 인원이 아닙니다 — 「' + cnt.slice(0, 20) + '」' };
  return { 값: n, 왜: null, 직군, 직급: String(줄들[0].name || '').trim() };
}

/* ── 자기점검 ──────────────────────────────────────────────────── */
function 검사() {
  let n = 0; const 재다 = (조건, 글) => { n++; if (!조건) throw new Error('자기점검 ' + n + ' ' + 글); };
  /* 제목 직군 */
  재다(제목직군하나('2026년 물리치료사 채용 공고') === '물리치료사', '물리치료사를 못 봅니다');
  재다(제목직군하나('작업치료사(기간제) 채용') === '작업치료사', '작업치료사를 못 봅니다');
  재다(제목직군하나('물리치료사·작업치료사 통합 채용') === null, '두 직군을 하나로 봅니다');
  재다(제목직군하나('물리(작업)치료사 채용') === null, '묶은 꼴을 하나로 봅니다');
  재다(제목직군하나('간호직 공무원 채용') === null, '직군 없는 제목을 씁니다');
  재다(제목직군하나('') === null && 제목직군하나(null) === null, '빈 제목에서 값을 냅니다');
  /* 담을인원 */
  재다(담을인원([{ name: '물리치료사', cnt: '2' }], '물리치료사 채용').값 === 2, '한 줄을 안 담습니다');
  재다(담을인원([{ name: '물리치료사', cnt: '2' }, { name: '간호사', cnt: '5' }], '물리치료사 채용').값 === null,
    '두 줄에서 담습니다');
  재다(/2줄/.test(담을인원([{ cnt: '2' }, { cnt: '5' }], '물리치료사 채용').왜), '까닭에 줄 수가 없습니다');
  재다(담을인원([{ cnt: '3' }], '물리치료사·작업치료사 채용').값 === null, '통합 제목에서 담습니다');
  재다(담을인원([{ cnt: '0' }], '물리치료사 채용').값 === null, 'cnt 0 을 담습니다');
  재다(담을인원([{ cnt: '' }], '물리치료사 채용').값 === null, '빈 cnt 를 담습니다');
  재다(담을인원([], '물리치료사 채용').값 === null, '0줄에서 담습니다');
  재다(담을인원([{ cnt: '1000' }], '물리치료사 채용').값 === null, '터무니없는 수를 담습니다');
  재다(담을인원([{ cnt: '3명' }], '물리치료사 채용').값 === 3, '「3명」 꼴을 못 읽습니다');
  console.log('○ 나라일터_인원되메우기 자기점검 통과 — ' + n + '가지 (API·DB 를 두드리지 않았습니다)');
}
검사();
if (자기점검만) process.exit(0);

/* ── 열쇠 ──────────────────────────────────────────────────────── */
const cfg = {};
for (const 이름 of ['../.env', '../.env.local']) {
  const p = new URL(이름, import.meta.url);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL; const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K || !cfg.ALIO_DETAIL_KEY) {
  console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY / ALIO_DETAIL_KEY 가 있어야 합니다');
  process.exit(1);
}
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };
const BASE = 'https://apis.data.go.kr/1760000/PblJobService';
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 전부(길) {
  const out = [];
  const 길2 = 차례붙이기(길);
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길2 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 60) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 20000) break;
  }
  return out;
}

/* 모집인원이 빈 GJ2 공고 — **회원 화면에 보이는 것부터** */
const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,title,headcount,' + encodeURIComponent('뽑은값')
  + '&source=eq.GJ2&headcount=is.null&' + encodeURIComponent('시험자료') + '=eq.false');
const 볼것 = [...다].sort((a, b) => (보임.has(b.id) ? 1 : 0) - (보임.has(a.id) ? 1 : 0)).slice(0, 몇개);
console.log('모집인원이 빈 GJ2 공고 ' + 다.length + '건 (회원 화면 '
  + 다.filter((x) => 보임.has(x.id)).length + '건) → 보는 것 ' + 볼것.length + '건\n');

const 한칸 = (글, 이름) => {
  const m = 글.match(new RegExp('<' + 이름 + '>([\\s\\S]*?)</' + 이름 + '>'));
  return m ? m[1].trim() : '';
};

const 칸줄 = []; const 견본 = []; const 까닭별 = new Map();
let 응답못받음 = 0;
for (const [i, x] of 볼것.entries()) {
  /* ★ GJ2 아이디는 `GJ306101` 꼴입니다 — 앞머리가 **`GJ`** 입니다 (찍어 봤습니다).
     `/^GJ2?/` 로 떼면 번호가 2 로 시작하는 공고에서 숫자를 같이 뗍니다 */
  const idx = String(x.id).replace(/^GJ/, '');
  let t = '';
  try {
    const r = await fetch(BASE + '/getItemPosition?serviceKey=' + cfg.ALIO_DETAIL_KEY
      + '&idx=' + idx + '&numOfRows=50&pageNo=1', { headers: { accept: 'application/xml' } });
    t = await r.text();
  } catch { 응답못받음++; continue; }
  const 줄들 = [...t.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => ({ name: 한칸(m[1], 'name'), cnt: 한칸(m[1], 'cnt'), code: 한칸(m[1], 'code') }));
  const 판 = 담을인원(줄들, x.title);
  if (!판.값) {
    까닭별.set(판.왜, (까닭별.get(판.왜) || 0) + 1);
  } else {
    칸줄.push({ id: x.id, headcount: 판.값 });
    if (견본.length < 12) {
      견본.push({ id: x.id, 보임: 보임.has(x.id), 제목: String(x.title).slice(0, 52),
        값: 판.값, 직급: 판.직급, 직군: 판.직군 });
    }
  }
  process.stderr.write('\r  ' + (i + 1) + '/' + 볼것.length + ' — 담을 것 ' + 칸줄.length + '   ');
  await 자고(200);
}
process.stderr.write('\n');

console.log('── 안 담는 까닭 ──');
for (const [k, n] of [...까닭별].sort((a, b) => b[1] - a[1])) console.log('  ' + String(n).padStart(4) + '건  ' + k);
if (응답못받음) console.log('  ' + String(응답못받음).padStart(4) + '건  응답 못 받음');

console.log('\n── 담을 것 ' + 칸줄.length + '건 (회원 화면 '
  + 칸줄.filter((r) => 보임.has(r.id)).length + '건) ──');
for (const s of 견본) {
  console.log('  ' + s.id + (s.보임 ? ' (회원 화면)' : '') + '  모집인원 → ' + s.값 + '명');
  console.log('     제목  ' + s.제목);
  console.log('     근거  getItemPosition 한 줄 「' + s.직급 + '」 cnt ' + s.값 + ' · 제목 직군 ' + s.직군);
}

if (!진짜) {
  console.log('\n[칸마른] 아무것도 안 담습니다 — 담으려면 --진짜');
  process.exit(0);
}

console.log('\n창구 칸되메우기 로 담습니다 — ' + 칸줄.length + '건');
let 함 = 0;
for (let i = 0; i < 칸줄.length; i += 50) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 칸줄.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  함 += 칸줄.slice(i, i + 50).length;
  if (i === 0) console.log('  창구가 답한 것 — ' + t.slice(0, 260));
}
console.log('  ' + 함 + '/' + 칸줄.length);
/* ★ 되돌리는 법 — `칸기록` 의 칸 이름을 **찍어 보고** 적었습니다
   (job_id · 칸 · 옛값 · 새값 · 누가 · 바뀐때 · 누가 = '첨부 되메우기').
   여기서 담는 것은 **전부 headcount 가 null 이던 공고**라 되돌림은 null 입니다 */
console.log('\n★ 되돌리는 법 — 칸기록에 옛 값이 남습니다 (전부 빈칸이었으니 다시 비웁니다):');
console.log('   update job_posts j set headcount = null'
  + '\n     from "칸기록" k where k.job_id = j.id and k."칸" = \'headcount\''
  + '\n      and k."누가" = \'첨부 되메우기\' and k."옛값" is null'
  + '\n      and k."바뀐때" >= \'' + new Date().toISOString().slice(0, 10) + '\'::date'
  + '\n      and j.source = \'GJ2\';');
