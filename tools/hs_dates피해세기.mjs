/* hs_dates 버그 ①(합격자 발표일을 마감으로)의 **피해를 셉니다** (2026-10-11).
 *
 *   node tools/hs_dates피해세기.mjs
 *
 * **읽기만 합니다. 아무것도 고치지 않습니다** (세중님 지시).
 *
 * ── 무엇을 보나 ─────────────────────────────────────────────
 *   ① 회원에게 보이는 공고 중 마감일이 있고 본문이 쌓인 것
 *   ② 지금 hs_dates(고친 것)를 다시 돌려 **저장된 값과 다른** 것
 *   ③ 「연도 있는 날짜 → ~ M. D → 뒤에 또 연도 있는 날짜」 꼴이라
 *      **틀렸을 수 있는** 것 (버그 ①의 모양)
 *   ④ 마감이 실제보다 **늦게** 잡혀 「이미 마감인데 접수중으로 보이는」 것
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { hsDetailDates } = require_('./hosp/hs_dates.js');

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
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!cfg[k]) { console.error(k + ' 가 없습니다'); process.exit(1); }
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

/* ── 버그 ①의 모양 — 본문에 그 꼴이 있나 ────────────────────
   「접수 앵커 … 2026. 10. 19.(월) ~ 10. 23.(금) … 2026. 11. 3.」
   앞 날짜에는 연도가 있고, 이어지는 날짜에는 연도가 **없고**,
   그 창 안에 **또 연도 있는 날짜**가 있으면 옛 규칙이 뒤 날짜를 집었습니다 */
const 앵커 = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자|기일)|모집\s*기간|채용\s*기간|지원\s*기간|응시원서\s*접수|마감\s*일시|마감일|공고\s*기간/g;
const 연도있는날 = /(20\d{2})\s*[.년\-/]\s*(\d{1,2})\s*[.월\-/]\s*(\d{1,2})\s*일?/g;

function 위험한꼴(글) {
  const s = String(글 || '');
  앵커.lastIndex = 0;
  let a;
  while ((a = 앵커.exec(s))) {
    const 창 = s.slice(a.index, a.index + 140);
    연도있는날.lastIndex = 0;
    const ds = [];
    let m;
    while ((m = 연도있는날.exec(창))) ds.push({ i: m.index, e: m.index + m[0].length });
    if (ds.length < 2) continue;
    /* 첫 날짜 바로 뒤에 「~ M. D」(연도 없음)가 붙어 있고, 창 안에 연도 있는 날짜가 둘 이상 */
    const 뒤 = 창.slice(ds[0].e, ds[0].e + 40);
    if (/^[^~\-–\d]{0,12}[~\-–]\s*(?:\([^)]*\)\s*)?\d{1,2}\s*[.월]\s*\d{1,2}/.test(뒤)) {
      return { 창, 앵커말: a[0] };
    }
  }
  return null;
}

const 오늘 = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });

/* ── 회원에게 보이는 공고 (job_posts_pub 과 같은 조건) ────── */
const 공고들 = await 전부('job_posts?select=id,source,org_name,title,apply_to,apply_to_time,hidden,hold,'
  + encodeURIComponent('시험자료') + ',evidence'
  + '&hidden=is.false&hold=is.false&' + encodeURIComponent('시험자료') + '=is.false'
  + '&source=in.(HS3,HS,ND2,ND)&order=source.asc');
console.log('회원에게 보이는 HS3·HS·ND2·ND 공고 ' + 공고들.length + '건');
const 마감있는것 = 공고들.filter((j) => j.apply_to);
console.log('   그중 마감일이 있는 것 ' + 마감있는것.length + '건\n');

/* 본문 */
const 번호 = 공고들.map((j) => j.id);
const 몸들 = [];
for (let i = 0; i < 번호.length; i += 60) {
  const 조각 = 번호.slice(i, i + 60).map(encodeURIComponent).join(',');
  몸들.push(...await 전부('job_body?select=job_id,body&kind=eq.' + encodeURIComponent('상세')
    + '&job_id=in.(' + 조각 + ')'));
}
const 몸맵 = new Map(몸들.map((b) => [b.job_id, b.body]));
console.log('본문이 쌓인 것 ' + 몸맵.size + '건\n');

const 셈 = { 본것: 0, 같음: 0, 다름: 0, 지금은없음: 0, 위험꼴: 0, 늦게잡힘: 0, 이미마감인데보임: 0 };
const 다른것 = []; const 위험것 = [];

for (const j of 공고들) {
  const 글 = 몸맵.get(j.id);
  if (!글) continue;
  셈.본것++;

  const d = hsDetailDates(글);
  const 지금 = d && d.to ? String(d.to).replace(/\./g, '-') : null;

  if (j.apply_to && 지금 && 지금 !== j.apply_to) {
    셈.다름++;
    /* 저장된 값이 **더 늦으면** 옛 버그의 모양입니다 (발표일을 집어 미뤄졌음) */
    if (j.apply_to > 지금) {
      셈.늦게잡힘++;
      if (지금 < 오늘) 셈.이미마감인데보임++;
    }
    if (다른것.length < 6) 다른것.push({ j, 지금, 원문: (위험한꼴(글)?.창 || '').slice(0, 170) });
  } else if (j.apply_to && 지금) 셈.같음++;
  else if (j.apply_to && !지금) 셈.지금은없음++;

  const w = 위험한꼴(글);
  if (w) { 셈.위험꼴++; if (위험것.length < 6) 위험것.push({ j, 지금, w }); }
}

console.log('── 센 것 ───────────────────────────────────────────');
console.log('  본문으로 다시 돌려 본 것          ' + 셈.본것);
console.log('  저장된 마감과 **같음**            ' + 셈.같음);
console.log('  저장된 마감과 **다름**            ' + 셈.다름);
console.log('    그중 저장된 값이 **더 늦음**     ' + 셈.늦게잡힘 + '   ← 버그 ①의 모양');
console.log('      그중 **이미 마감인데 보이는** 것 ' + 셈.이미마감인데보임);
console.log('  지금 규칙으로는 마감을 못 뽑는 것  ' + 셈.지금은없음);
console.log('  「연도 없는 둘째 날짜 + 뒤에 연도 있는 날짜」 꼴  ' + 셈.위험꼴 + '건');

console.log('\n── 다른 것 견본 (원문 ↔ 지금 값) ──────────────────');
for (const s of 다른것) {
  console.log('\n  ' + s.j.id + '  ' + String(s.j.org_name).slice(0, 24));
  console.log('    제목      ' + String(s.j.title).slice(0, 56));
  console.log('    저장된 값  ' + s.j.apply_to + (s.j.apply_to_time ? ' ' + s.j.apply_to_time : ''));
  console.log('    다시 뽑음  ' + s.지금 + (s.j.apply_to > s.지금 ? '   ← 저장된 쪽이 늦습니다' : ''));
  if (s.원문) console.log('    원문      …' + s.원문.replace(/\s+/g, ' '));
}

console.log('\n── 위험한 꼴 견본 ─────────────────────────────────');
for (const s of 위험것.slice(0, 3)) {
  console.log('\n  ' + s.j.id + '  ' + String(s.j.org_name).slice(0, 24)
    + '   저장 ' + s.j.apply_to + ' · 다시 ' + (s.지금 ?? '(없음)'));
  console.log('    앵커 「' + s.w.앵커말 + '」');
  console.log('    원문 …' + s.w.창.replace(/\s+/g, ' ').slice(0, 170));
}

console.log('\n아무것도 고치지 않았습니다.');
