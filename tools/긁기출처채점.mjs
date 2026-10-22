/* **긁기 출처**(워크넷 밖)의 일곱 칸을 **담긴 공고문 글**에 대고 채점합니다
 *
 *   node tools/긁기출처채점.mjs                 회원 화면만 (기본)
 *   node tools/긁기출처채점.mjs --전부          숨김·보류까지
 *   node tools/긁기출처채점.mjs --흠 30
 *
 * ── 왜 따로 만드나 ──────────────────────────────────────────────
 * 워크넷은 상세 API 가 우리 값을 **그대로 주는 자리**라서, 거기 대고 잰 100% 는
 * 「받은 값을 안 망가뜨린다」는 뜻입니다 (docs/수집기_능력표_1020.md).
 * **읽기 실력은 긁기 출처에서만** 드러납니다 — 알리오·클린아이·나라일터·병원자체.
 *
 * ── 이 도구가 지키는 셋 (첫 판에서 틀리게 셌던 것들입니다) ────────
 * ① **공고문 글이 담긴 공고만** 채점합니다 (`job_body.kind = '첨부'`).
 *    상세 본문(포털이 준 짧은 글)만 있는 공고는 「원문없음」으로 빼둡니다 —
 *    거기 없는 날짜를 「우리가 지어냈다」고 세면 안 됩니다.
 * ② 값이 **어디서 왔나**로 갈라 셉니다. `뽑은값`(= 공고문을 읽어 담은 것)만
 *    원문에 댑니다. `headcount`·`apply_to`·`work_place` 같은 **포털 칸**은
 *    공고문에 없을 수 있으니 따로 셉니다 — 그 수가 「읽기 실력」이 아닙니다.
 * ③ 「내규에 따름」·「협의」는 **우리가 고른 말**입니다 (2026-10-14 세중님 —
 *    금액이 없으면 그렇게 적습니다). 원문에서 찾을 글자가 아니라서 뺍니다.
 *
 * ── 채점 ─────────────────────────────────────────────────────────
 *   맞음   우리 값의 **조각이 모두** 원문에 있음      틀림  원문에 없는 조각이 있음
 *   빈칸   우리가 빔                                  원문없음 · 포털칸 · 규칙말  → 분모 밖
 * ★ 읽기만 합니다. DB·화면을 안 건드립니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => {
  const i = argv.indexOf(이름);
  return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본;
};
const 전부 = argv.includes('--전부');
const 흠몇 = Number(값('--흠', 14));
/* ★ 2026-10-22 밤 — 표본을 **건마다** 찍습니다 (세중님 4번).
   묶음 하나만 보고(--묶음 알리오), 공고문 글이 담긴 것 가운데 N건을 고릅니다.
   고르는 자는 **id 를 글자순으로** — 돌릴 때마다 같은 표본이 나와야 견줄 수 있습니다.
   --표본 0 (기본) 이면 전처럼 묶음 표만 찍습니다 */
const 묶음고르기 = 값('--묶음', '');
const 표본 = Number(값('--표본', 0));
const 건마다 = argv.includes('--건마다') || 표본 > 0;

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const 바탕 = cfg.SUPABASE_URL || cfg.NEXT_PUBLIC_SUPABASE_URL;
const 열쇠 = cfg.SUPABASE_SERVICE_KEY;
if (!바탕 || !열쇠) { console.error('SUPABASE_URL·열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const 머리 = { apikey: 열쇠, Authorization: 'Bearer ' + 열쇠 };

/** ★ 이 서버는 **100줄에서 끊습니다** — 받은 줄 수만큼 넘기고 0줄일 때 멈춥니다 */
async function 다받기(길) {
  const 모은것 = [];
  for (let off = 0; ;) {
    const u = 바탕 + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?') + 'limit=1000&offset=' + off;
    const r = await fetch(u, { headers: 머리 });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const 줄 = await r.json();
    모은것.push(...줄);
    if (!줄.length) break;
    off += 줄.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
  return 모은것;
}

const 묶음이름 = { WN: '워크넷', WN2: '워크넷', WNX: '워크넷', AL: '알리오', AL2: '알리오',
  AL2C: '알리오', CE: '클린아이', CE2: '클린아이', GJ: '나라일터', GJ2: '나라일터',
  HS: '병원자체', HS2: '병원자체', HS3: '병원자체', JF: '고용24', ND: '치매센터', ND2: '치매센터' };

const 눕 = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const 글자만 = (s) => String(s == null ? '' : s).replace(/[^0-9A-Za-z가-힣]/g, '');
const 규칙말 = /^(?:내규|보수\s*규정|규정)에?\s*따름$|^협의$|^추후\s*협의$/;
/** 날짜·시각은 **여러 꼴**로 찾습니다 — 원문은 「2026. 10. 28.」 처럼 적습니다 */
const 날짜꼴들 = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(눕(v));
  if (!m) return null;
  const [, y, mo, d] = m;
  return [`${y}${mo}${d}`, `${y}${String(Number(mo))}${String(Number(d))}`,
    `${mo}${d}`, `${String(Number(mo))}${String(Number(d))}`];
};
const 시각꼴들 = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(눕(v));
  if (!m) return null;
  const [, h, mi] = m;
  return [`${h}${mi}`, `${String(Number(h))}${mi}`,
    `${String(Number(h))}시${Number(mi) ? mi + '분' : ''}`];
};
const 조각내기 = (s) => 눕(s).split(/[,，、·/|]|\s-\s/)
  .map((x) => x.replace(/^(?:자격|학력|면허|경력|근무지|지역)\s*[:：]?\s*/, '').trim())
  .filter((x) => 글자만(x).length >= 2);

const 칸들 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];

const 공고 = await 다받기('job_posts?select=id,source,org_name,title,job_group,headcount,'
  + 'apply_to,apply_to_time,work_place,employ_type,detail,' + encodeURIComponent('뽑은값'));
const 보임 = new Set((await 다받기('job_posts_pub?select=id')).map((x) => x.id));
/** 원문으로 쓸 글을 모읍니다 (①)
 *
 * ★ 2026-10-22 밤 — 처음에는 `kind='첨부'` 만 봤습니다. 그래서 **잴 수 있는 회원
 *   공고가 3건**뿐이었고 「공고문이 안 담겼다」고 보고했습니다. 틀렸습니다 —
 *   **병원자체(HS3)의 원문은 첨부가 아니라 공고 쪽 본문**입니다. 회원 공고 16건이
 *   `kind='상세'` 로 평균 2,580자씩 **이미 담겨 있었습니다.**
 *   첨부 줄을 만들어 보니(병원첨부채우기 --회원만) 13건 다 **첨부가 아예 없는**
 *   공고였습니다 — 쪽 본문이 공고문입니다.
 *
 *   첨부   기관이 올린 공고문 파일          → 원문 ○
 *   상세   병원 **자체 사이트**의 공고 본문  → 원문 ○ (그 기관이 쓴 글입니다)
 *   상세 본문  포털이 준 **줄인 글**(평균 470자) → 원문 ✗ (거기 없는 값을 틀림으로
 *              세면 안 됩니다. 나라일터·클린아이 목록 API 가 주는 요약입니다)
 */
const 원문갈래 = new Map();
const 공고문글 = new Map();
for (const b of await 다받기('job_body?select=job_id,kind,body')) {
  const k = String(b.kind || '');
  if (k !== '첨부' && k !== '상세') continue;
  공고문글.set(b.job_id, (공고문글.get(b.job_id) || '') + '\n' + String(b.body || ''));
  /* 첨부가 있으면 첨부라고 적습니다 — 더 센 근거입니다 */
  if (k === '첨부' || !원문갈래.has(b.job_id)) 원문갈래.set(b.job_id, k);
}

let 볼것 = 공고
  .filter((j) => (묶음이름[j.source] || j.source) !== '워크넷')
  .filter((j) => 전부 || 보임.has(j.id))
  .filter((j) => !묶음고르기 || (묶음이름[j.source] || j.source) === 묶음고르기);
if (표본 > 0) {
  /* 공고문 글이 **담긴** 것만 — 원문이 없으면 댈 것이 없습니다 */
  볼것 = 볼것.filter((j) => 글자만(공고문글.get(j.id) || '').length > 200)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, 표본);
}

const 뽑 = (j, k) => {
  const v = (j['뽑은값'] || {})[k];
  return v == null || v === '' ? null : v;
};
const 디 = (j, k) => {
  const v = (j.detail || {})[k];
  return v == null || v === '' ? null : v;
};
/** 칸마다 {값, 어디서} — 어디서 = '공고문'(뽑은값) · '포털칸' */
const 우리값 = (j) => ({
  모집인원: 뽑(j, '모집인원') ? { 값: 뽑(j, '모집인원'), 어디서: '공고문' }
    : j.headcount != null ? { 값: String(j.headcount), 어디서: '포털칸' }
      : 디(j, '모집인원') ? { 값: 디(j, '모집인원'), 어디서: '포털칸' } : null,
  접수마감: 뽑(j, '접수마감글') ? { 값: 뽑(j, '접수마감글'), 어디서: '포털칸' }
    : j.apply_to ? { 값: j.apply_to, 어디서: '포털칸' } : null,
  마감시각: j.apply_to_time
    ? { 값: j.apply_to_time, 어디서: 뽑(j, '접수시각') ? '공고문' : '포털칸' } : null,
  근무지: 뽑(j, '근무지') ? { 값: 뽑(j, '근무지'), 어디서: '공고문' }
    : j.work_place ? { 값: j.work_place, 어디서: '포털칸' } : null,
  지원자격: 뽑(j, '지원자격') ? { 값: 뽑(j, '지원자격'), 어디서: '공고문' }
    : 디(j, '지원자격') ? { 값: 디(j, '지원자격'), 어디서: '포털칸' } : null,
  예상연봉: 뽑(j, '예상연봉') ? { 값: 뽑(j, '예상연봉'), 어디서: '공고문' }
    : (디(j, '연봉') || 디(j, '예상연봉'))
      ? { 값: 디(j, '연봉') || 디(j, '예상연봉'), 어디서: '포털칸' } : null,
  고용형태: j.employ_type
    ? { 값: j.employ_type, 어디서: 뽑(j, '고용형태근거') ? '공고문' : '포털칸' } : null,
});

const 고용형태말 = { 정규직: /정규직|기간의?\s*정함이?\s*없|공무직|무기계약/,
  계약직: /계약직|기간제|임기제|한시|대체|임시직|인턴|촉탁|단기/,
  무기계약직: /무기계약|공무직|기간의?\s*정함이?\s*없/ };

const 칸칸 = () => Object.fromEntries(칸들.map((k) =>
  [k, { 맞음: 0, 틀림: 0, 빈칸: 0, 원문없음: 0, 포털칸: 0, 규칙말: 0 }]));
const 셈 = new Map();
const 흠 = [];
const 건별 = [];            /* --건마다 용 — [{id, 기관, 칸마다}] */
let 공고문있는것 = 0;

for (const j of 볼것) {
  const 묶 = 묶음이름[j.source] || j.source;
  if (!셈.has(묶)) 셈.set(묶, { 건수: 0, 공고문: 0, 칸: 칸칸() });
  const s = 셈.get(묶);
  s.건수++;
  const 원문 = 공고문글.get(j.id) || '';
  const 원문글자 = 글자만(원문);
  const 원문있나 = 원문글자.length > 200;
  if (원문있나) { s.공고문++; 공고문있는것++; }
  const 값 = 우리값(j);
  const 이건 = { id: j.id, 출처: j.source, 기관: j.org_name, 제목: j.title,
    원문갈래: 원문갈래.get(j.id) || '없음', 원문글자수: 원문글자.length, 칸마다: [] };
  const 적기 = (칸이름, 판정, 우리것, 까닭) =>
    이건.칸마다.push({ 칸: 칸이름, 판정, 값: 우리것, 까닭 });
  for (const k of 칸들) {
    const 칸 = s.칸[k];
    const u = 값[k];
    if (!u) { 칸.빈칸++; 적기(k, '빈칸', null, ''); continue; }
    const v = 눕(u.값);
    if (!v) { 칸.빈칸++; 적기(k, '빈칸', null, ''); continue; }
    if (규칙말.test(v)) { 칸.규칙말++; 적기(k, '규칙말', v, '우리가 고른 말 — 분모 밖'); continue; }  /* ③ */
    if (u.어디서 === '포털칸') { 칸.포털칸++; 적기(k, '포털칸', v, '포털이 준 값 — 분모 밖'); continue; }  /* ② */
    if (!원문있나) { 칸.원문없음++; 적기(k, '원문없음', v, '공고문 글이 안 담겼습니다'); continue; }  /* ① */
    const 꼴 = k === '접수마감' ? 날짜꼴들(v) : k === '마감시각' ? 시각꼴들(v) : null;
    if (꼴) {
      if (꼴.some((x) => 원문글자.includes(글자만(x)))) { 칸.맞음++; 적기(k, '맞음', v, '공고문에 그 날짜·시각이 있음'); }
      else { 칸.틀림++; 적기(k, '틀림', v, '공고문에 그 날짜·시각이 없음');
             흠.push([묶, k, j.id, j.org_name, v, '공고문에 그 날짜·시각이 없음']); }
      continue;
    }
    if (k === '고용형태') {
      const 말 = 고용형태말[v];
      if (말 && 말.test(원문)) { 칸.맞음++; 적기(k, '맞음', v, '공고문에 그 말이 있음'); }
      else { 칸.틀림++; 적기(k, '틀림', v, '공고문에 그 고용형태 말이 없음');
             흠.push([묶, k, j.id, j.org_name, v, '공고문에 그 고용형태 말이 없음']); }
      continue;
    }
    const 조각 = 조각내기(v);
    const 남는것 = 조각.filter((x) => !원문글자.includes(글자만(x)));
    if (!조각.length || !남는것.length) { 칸.맞음++; 적기(k, '맞음', v, '조각 ' + 조각.length + '개가 다 공고문에 있음'); }
    else {
      칸.틀림++;
      적기(k, '틀림', v, '공고문에 없는 조각 「' + 남는것[0].slice(0, 22) + '」');
      흠.push([묶, k, j.id, j.org_name, v.slice(0, 40), '공고문에 없는 조각 「' + 남는것[0].slice(0, 22) + '」']);
    }
  }
  건별.push(이건);
}

/* ── --건마다 — 표본을 건마다 찍습니다 (세중님 4번) ────────────────── */
if (건마다) {
  console.log('표본 ' + 건별.length + '건 · 건마다 칸별 판정'
    + (묶음고르기 ? ' · 묶음 ' + 묶음고르기 : '') + '\n');
  let 맞 = 0, 틀 = 0;
  for (const x of 건별) {
    console.log('■ ' + x.id + ' [' + x.출처 + '] ' + String(x.기관 || '').slice(0, 20)
      + ' — ' + String(x.제목 || '').slice(0, 42));
    console.log('   원문 ' + x.원문갈래 + ' ' + x.원문글자수 + '자');
    for (const c of x.칸마다) {
      if (c.판정 === '빈칸') { console.log('   ' + c.칸.padEnd(6) + '빈칸'); continue; }
      if (c.판정 === '맞음') 맞++;
      if (c.판정 === '틀림') 틀++;
      console.log('   ' + c.칸.padEnd(6) + (c.판정 === '맞음' ? '맞음  ' : c.판정 === '틀림' ? '**틀림**' : c.판정.padEnd(6))
        + ' 「' + String(c.값).slice(0, 52) + '」'
        + (c.까닭 ? '   ← ' + c.까닭 : ''));
    }
    console.log('');
  }
  console.log('표본 셈 — 원문에 댄 칸 ' + (맞 + 틀) + '개 · 맞음 ' + 맞 + ' · **틀림 ' + 틀 + '**'
    + ((맞 + 틀) ? ' · 맞음률 ' + Math.round((100 * 맞) / (맞 + 틀)) + '%' : ''));
  console.log('');
}

console.log('긁기 출처 ' + 볼것.length + '건' + (전부 ? ' (숨김·보류까지)' : ' (회원 화면만)')
  + ' · **공고문 글이 담긴 것 ' + 공고문있는것 + '건**\n');
console.log('묶음      건수(공고문)  칸        채움률  공고문에서 읽은 칸의 맞음률   분모 밖');
for (const [묶, s] of [...셈].sort((a, b) => b[1].건수 - a[1].건수)) {
  for (const k of 칸들) {
    const c = s.칸[k];
    const 찬것 = c.맞음 + c.틀림 + c.원문없음 + c.포털칸 + c.규칙말;
    const 댄것 = c.맞음 + c.틀림;
    const 머리글 = k === 칸들[0]
      ? 묶.padEnd(9) + (String(s.건수) + '(' + s.공고문 + ')').padStart(7) + '   '
      : ' '.repeat(19);
    console.log(머리글 + k.padEnd(9)
      + String(Math.round(찬것 / s.건수 * 100)).padStart(4) + '%  '
      + (댄것 ? (String(Math.round(c.맞음 / 댄것 * 100)) + '% (' + c.맞음 + '/' + 댄것 + ')').padStart(14)
        : '           — ')
      + '   포털칸 ' + c.포털칸 + ' · 원문없음 ' + c.원문없음
      + (c.규칙말 ? ' · 규칙말 ' + c.규칙말 : ''));
  }
  console.log('');
}
console.log('── 흠 (앞 ' + Math.min(흠몇, 흠.length) + '건) ──');
for (const [묶, k, id, 기관, 우리, 왜] of 흠.slice(0, 흠몇)) {
  console.log('  ' + 묶.padEnd(9) + k.padEnd(6) + String(id).padEnd(13)
    + String(기관 || '').slice(0, 12).padEnd(14) + '우리 「' + 우리 + '」  ← ' + 왜);
}
if (흠.length > 흠몇) console.log('  … 그밖 ' + (흠.length - 흠몇) + '건');
