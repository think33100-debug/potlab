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
/* ★ 2026-10-25 — 쪽을 넘길 때는 **차례(order)를 반드시** 붙입니다. 안 붙이면 줄이
   겹치거나 빠집니다 (지침 8-20 ③ · 10/23 에 292→231, 10/25 에 281→219 로 잘못 셌습니다).
   자는 tools/쪽나눠받기.mjs 의 차례붙이기() 하나입니다 — **직접 offset 을 쓰지 않습니다**. */
import { 차례붙이기 } from './쪽나눠받기.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* ★ 재는 규칙은 **tools/칸대조.mjs 한 자리**입니다 (2026-10-22 밤 · 지침 6절).
   「긁기 출처 맞음률」과 「신뢰 셋 ②」가 **같은 자**로 재야 합니다 — 사본을 두면
   오늘 신뢰 셋에서 겪은 것처럼 두 숫자가 갈라집니다. */
import { 묶음이름, 칸들, 눕, 글자만, 규칙말, 날짜꼴들, 시각꼴들,
  표식뗀값, 조각내기, 고용형태말, 원문쓸만한가, 칸판정 } from './칸대조.mjs';

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
/* ★ --뽑은것만 — **우리가 공고문을 읽어 담은 칸**이 있는 공고만. 알리오·나라일터는
   포털 API 가 칸을 거의 다 줘서, 그냥 표본을 뽑으면 전부 「포털칸」 이 나옵니다 —
   그러면 읽기 실력을 못 잽니다 (2026-10-22 밤) */
const 뽑은것만 = argv.includes('--뽑은것만');
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
    const u = 바탕 + '/rest/v1/' + 차례붙이기(길) + '&limit=1000&offset=' + off;
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


/** 날짜·시각은 **여러 꼴**로 찾습니다 — 원문은 「2026. 10. 28.」 처럼 적습니다 */
/* ★ 2026-10-22 밤 — **우리가 앞에 붙인 표식 낱말**을 떼고 봅니다.
   `칸뽑기()` 는 예상연봉을 「표식 + 값」으로 담습니다(공고문읽기.mjs) —
     우리 값   「보수 월 2,323천원(세전) 수준」
     공고문    「보수**수준** : 월 2,323천원(세전) 수준」
   공고문의 표식은 「보수수준」인데 우리는 「보수」만 떼어 붙였으니, 첫 조각
   「보수 월 2」 가 공고문에 없는 글자가 되어 **멀쩡한 값이 틀림으로** 셌습니다
   (근로복지공단 305475 · 한림대동탄 3건). 표식은 우리가 붙인 말이라 **원문에
   댈 것이 아닙니다** — 떼고 **값만** 댑니다.
   ※ 「표식을 아예 안 붙이는 쪽이 낫지 않나」는 화면 문구 문제라 세중님께 묻습니다. */

const 공고 = await 다받기('job_posts?select=id,source,org_name,title,job_group,headcount,'
  + 'apply_to,apply_to_time,work_place,employ_type,detail,' + encodeURIComponent('뽑은값'));
const 보임 = new Set((await 다받기('job_posts_pub?select=id')).map((x) => x.id));

/* ★ 2026-10-22 밤 — **칸의 출처는 칸기록이 압니다.**
   「첨부 되메우기」 는 공고문을 읽어 headcount·apply_to_time·work_place·employ_type
   같은 **표의 칸**을 채웁니다. 그것을 「포털칸」으로 세면 읽기 실력이 분모에서
   빠집니다 (알리오 표본에서 칸 70개 중 8개만 분모에 들어왔습니다).
   그래서 칸기록에 「되메우기」가 적힌 (공고, 칸) 은 **공고문**으로 셉니다. */
const 칸이름 = { headcount: '모집인원', apply_to: '접수마감', apply_to_time: '마감시각',
  work_place: '근무지', employ_type: '고용형태',
  'detail.지원자격': '지원자격', 'detail.예상연봉': '예상연봉' };
const 읽어담은칸 = new Set();      /* 「job_id\t칸이름」 */
for (const r of await 다받기('%EC%B9%B8%EA%B8%B0%EB%A1%9D?select=job_id,'
  + encodeURIComponent('칸') + ',' + encodeURIComponent('누가') + ',' + encodeURIComponent('옛값')
  + '&order=' + encodeURIComponent('바뀐때') + '.asc')) {
  const k = 칸이름[String(r['칸'] || '')];
  if (!k) continue;
  if (!/되메우기/.test(String(r['누가'] || ''))) continue;
  /* ★ **옛값이 있던 칸은 포털칸입니다.** 되메우기가 employ_type 1,437건을
     「비정규직」→「계약직」처럼 **이름만 바꿔** 적었습니다 — 알리오가 준 값을
     세중님 셋(정규직·계약직·무기계약직)으로 줄인 것이고 공고문을 읽은 것이
     아닙니다. 공고문에 그 말이 없다고 틀림으로 세면 안 됩니다.
     우리가 **빈 칸을 채운 것**만 공고문으로 셉니다 (옛값이 빈 것) */
  if (String(r['옛값'] ?? '').trim() !== '') continue;
  읽어담은칸.add(r.job_id + '\t' + k);
}
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
/* 표본 고르기는 **우리값() 이 생긴 뒤**에 합니다 — 아래 「표본 고르기」 절 */

const 뽑 = (j, k) => {
  const v = (j['뽑은값'] || {})[k];
  return v == null || v === '' ? null : v;
};
const 디 = (j, k) => {
  const v = (j.detail || {})[k];
  return v == null || v === '' ? null : v;
};
/** 칸마다 {값, 어디서} — 어디서 = '공고문'(우리가 읽음) · '포털칸'(포털이 줌)
 *  ★ 표의 칸이라도 **칸기록에 되메우기가 적혀 있으면 공고문**입니다 (위 설명) */
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


const 칸칸 = () => Object.fromEntries(칸들.map((k) =>
  [k, { 맞음: 0, 틀림: 0, 빈칸: 0, 원문없음: 0, 포털칸: 0, 규칙말: 0 }]));
const 셈 = new Map();
/** 우리값() 에 칸기록을 덮어 「어디서」를 바로잡습니다 */
const 출처고친값 = (j) => {
  const v = 우리값(j);
  for (const k of 칸들) {
    if (v[k] && v[k].어디서 === '포털칸' && 읽어담은칸.has(j.id + '\t' + k)) {
      v[k] = { ...v[k], 어디서: '공고문' };
    }
  }
  return v;
};

/* ── 표본 고르기 — **우리값() 이 생긴 뒤**에 합니다 ──────────────────
   --뽑은것만 : 우리가 공고문을 읽어 담은 칸이 하나라도 있는 공고만.
                알리오·나라일터는 포털 API 가 칸을 거의 다 줘서, 그냥 뽑으면
                일곱 칸이 전부 「포털칸」으로 나옵니다 — 읽기 실력을 못 잽니다.
   --표본 N   : 공고문 글이 담긴 것 가운데 **id 글자순 앞 N건**
                (돌릴 때마다 같은 표본이 나와야 다음 주와 견줍니다) */
if (뽑은것만) {
  볼것 = 볼것.filter((j) => 칸들.some((k) => {
    const u = 출처고친값(j)[k];
    return u && u.어디서 === '공고문' && String(u.값 ?? '').trim() !== '';
  }));
}
if (표본 > 0) {
  볼것 = 볼것.filter((j) => 글자만(공고문글.get(j.id) || '').length > 200)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, 표본);
}

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
  const 값 = 출처고친값(j);
  const 이건 = { id: j.id, 출처: j.source, 기관: j.org_name, 제목: j.title,
    원문갈래: 원문갈래.get(j.id) || '없음', 원문글자수: 원문글자.length, 칸마다: [] };
  const 적기 = (칸이름, 판정, 우리것, 까닭) =>
    이건.칸마다.push({ 칸: 칸이름, 판정, 값: 우리것, 까닭 });
  for (const k of 칸들) {
    const 칸 = s.칸[k];
    /* ★ 재는 자는 tools/칸대조.mjs 하나입니다 — 여기서 다시 세지 않습니다 */
    const 판 = 칸판정(k, 값[k], 원문있나 ? 원문 : '');
    적기(k, 판.판정, 판.값, 판.까닭);
    if (판.판정 === '맞음') 칸.맞음++;
    else if (판.판정 === '틀림') {
      칸.틀림++;
      흠.push([묶, k, j.id, j.org_name, String(판.값).slice(0, 40), 판.까닭]);
    } else if (판.판정 === '규칙말') 칸.규칙말++;
    else if (판.판정 === '포털칸') 칸.포털칸++;
    else if (판.판정 === '원문없음') 칸.원문없음++;
    else 칸.빈칸++;
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
