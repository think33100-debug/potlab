/* **신뢰 셋 ② — 주 1회 표본 40건을 원문에 대고 잽니다** (2026-10-22 밤 세중님 8번)
 *
 *   node tools/신뢰셋표본.mjs                 마른 — 고른 표본과 셈만 (쪽은 받습니다)
 *   node tools/신뢰셋표본.mjs --진짜          결과를 log/신뢰셋_틀림.json 과 DB 에 적습니다
 *   node tools/신뢰셋표본.mjs --몇개 40       표본 수 (기본 40 = 워크넷 20 + 긁기 20)
 *   node tools/신뢰셋표본.mjs --건마다        건마다 칸별 판정
 *
 * ── 세중님이 정한 표본 ─────────────────────────────────────────
 * 「주 1회 새 표본 40 = **워크넷 20 + 긁기 출처 20(출처 고르게)**」
 *
 * 왜 반반인가 — 워크넷만 재면 **읽기 실력이 안 드러납니다.** 워크넷 값은 상세 API 가
 * 그대로 주는 것이라, 그 API 에 대고 재면 「받은 값을 안 망가뜨렸다」는 뜻뿐입니다
 * (docs/수집기_능력표_1020.md). 그래서 워크넷은 **공고 쪽(사람이 보는 그 화면)** 을
 * 받아서 댑니다. 긁기 출처는 **담긴 공고문**에 댑니다.
 *
 * ── 한 번 쓴 공고는 다시 안 씁니다 ──────────────────────────────
 * `log/신뢰셋_표본기록.json` 에 쓴 공고 번호를 쌓습니다. 「새 표본」이라야
 * 고친 자리만 다시 재는 일이 없습니다 (세중님 조건).
 *
 * ── 울타리 ─────────────────────────────────────────────────────
 * 워크넷 쪽은 **한 건마다 3.5초** 띄웁니다. 20건이면 한 번에 70초입니다.
 * 긁기 출처는 **담긴 글**을 쓰므로 사이트를 안 두드립니다.
 *
 * ★ 재는 자는 `tools/칸대조.mjs` 하나입니다 (지침 6절).
 * ★ DB 는 `site_settings['신뢰셋_틀림']` 한 줄만 고칩니다 (--진짜 일 때).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 묶음이름, 칸들, 칸판정, 원문쓸만한가 } from './칸대조.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = argv.indexOf(이름); return i > -1 && argv[i + 1] != null ? argv[i + 1] : 기본; };
const 진짜 = argv.includes('--진짜');
const 건마다 = argv.includes('--건마다');
const 몇개 = Number(값('--몇개', 40)) || 40;
const 반 = Math.floor(몇개 / 2);
const 틈ms = Number(process.env.POTJOB_WN_GAP_MS) || 3500;

const cfg = {};
for (const f of [path.join(여기, '..', '.env'), path.join(여기, '..', '.env.local')]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('SUPABASE_URL·열쇠가 없습니다 (서버에서 돌리십시오)'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };
const 자고 = (ms) => new Promise((r) => setTimeout(r, ms));

async function 다받기(길) {
  const 모 = [];
  for (let off = 0; ;) {
    const r = await fetch(U + '/rest/v1/' + 길 + (길.includes('?') ? '&' : '?') + 'limit=1000&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 160));
    const a = await r.json();
    모.push(...a);
    if (!a.length) return 모;
    off += a.length;
    if (off > 200000) throw new Error('너무 많습니다');
  }
}

/* ── 쓴 공고 기록 ──────────────────────────────────────────────── */
const 기록터 = [path.join(여기, '..', 'log', '신뢰셋_표본기록.json'),
  path.join(process.env.HOME || '', 'log', '신뢰셋_표본기록.json')];
let 쓴것 = { 쓴공고: [] };
for (const t of 기록터) { try { 쓴것 = JSON.parse(fs.readFileSync(t, 'utf8')); break; } catch { /* 다음 자리 */ } }
const 이미썼나 = new Set(쓴것.쓴공고 || []);

/* ── 공고·글 받기 ──────────────────────────────────────────────── */
/* `지역보임` 도 받습니다 — 화면이 근무지 자리에 **그 칸을 먼저** 그립니다
   (web/app/jobs/[id]/page.tsx:383 `j.지역보임 || j.work_place`) */
const 보임줄 = await 다받기('job_posts_pub?select=id,' + encodeURIComponent('지역보임'));
const 보임 = new Set(보임줄.map((x) => x.id));
const 지역보임 = new Map(보임줄.map((x) => [x.id, x['지역보임'] || '']));
const 공고 = (await 다받기('job_posts?select=id,source,org_name,title,url,headcount,'
  + 'apply_to,apply_to_time,work_place,employ_type,detail,' + encodeURIComponent('뽑은값')))
  .filter((j) => 보임.has(j.id));

const 글 = new Map();
for (const b of await 다받기('job_body?select=job_id,kind,body')) {
  const k = String(b.kind || '');
  if (k !== '첨부' && k !== '상세') continue;
  글.set(b.job_id, (글.get(b.job_id) || '') + '\n' + String(b.body || ''));
}

/* 칸의 출처 — 칸기록에 「되메우기」가 적히고 **옛값이 빈** 칸은 우리가 읽은 것입니다 */
const 칸이름 = { headcount: '모집인원', apply_to: '접수마감', apply_to_time: '마감시각',
  work_place: '근무지', employ_type: '고용형태', 'detail.지원자격': '지원자격', 'detail.예상연봉': '예상연봉' };
const 읽어담은칸 = new Set();
for (const r of await 다받기('%EC%B9%B8%EA%B8%B0%EB%A1%9D?select=job_id,'
  + [encodeURIComponent('칸'), encodeURIComponent('누가'), encodeURIComponent('옛값')].join(',')
  + '&order=' + encodeURIComponent('바뀐때') + '.asc')) {
  const k = 칸이름[String(r['칸'] || '')];
  if (!k || !/되메우기/.test(String(r['누가'] || ''))) continue;
  if (String(r['옛값'] ?? '').trim() !== '') continue;
  읽어담은칸.add(r.job_id + '\t' + k);
}

const 뽑 = (j, k) => { const v = (j['뽑은값'] || {})[k]; return v == null || v === '' ? null : v; };
const 디 = (j, k) => { const v = (j.detail || {})[k]; return v == null || v === '' ? null : v; };
/** 화면이 그리는 일곱 칸 — 짝은 web/app/jobs/[id]/page.tsx (지침 6절) */
const 우리값 = (j) => {
  const v = {
    모집인원: 뽑(j, '모집인원') != null ? { 값: 뽑(j, '모집인원'), 어디서: '공고문' }
      : j.headcount != null ? { 값: String(j.headcount), 어디서: '포털칸' } : null,
    접수마감: j.apply_to ? { 값: j.apply_to, 어디서: '포털칸' } : null,
    마감시각: j.apply_to_time ? { 값: String(j.apply_to_time), 어디서: '포털칸' } : null,
    /* ★ 2026-10-23 — **화면과 같은 순서로 고칩니다.** 전에는 `뽑은값.근무지` 를
       먼저 봤는데 **화면은 그 칸을 읽지 않습니다** (`j.지역보임 || j.work_place`).
       그래서 GJ305988 의 `뽑은값.근무지`(「7배수 20배수 초과」)를 「회원 화면에
       틀린 값 1건」으로 셌습니다 — 회원에게는 「충북」으로 보입니다.
       재는 자가 화면과 다르면 신뢰 셋 ② 가 거짓이 됩니다 (지침 10-5) */
    근무지: 지역보임.get(j.id) ? { 값: 지역보임.get(j.id), 어디서: '포털칸' }
      : j.work_place ? { 값: j.work_place, 어디서: '포털칸' } : null,
    지원자격: 뽑(j, '지원자격') != null ? { 값: 뽑(j, '지원자격'), 어디서: '공고문' }
      : 디(j, '지원자격') != null ? { 값: 디(j, '지원자격'), 어디서: '포털칸' } : null,
    예상연봉: 뽑(j, '예상연봉') != null ? { 값: 뽑(j, '예상연봉'), 어디서: '공고문' }
      : 디(j, '연봉') != null ? { 값: 디(j, '연봉'), 어디서: '포털칸' }
        : 디(j, '예상연봉') != null ? { 값: 디(j, '예상연봉'), 어디서: '포털칸' } : null,
    고용형태: j.employ_type ? { 값: j.employ_type, 어디서: '포털칸' } : null,
  };
  for (const k of 칸들) {
    if (v[k] && v[k].어디서 === '포털칸' && 읽어담은칸.has(j.id + '\t' + k)) v[k] = { ...v[k], 어디서: '공고문' };
  }
  return v;
};

/* ── 표본 고르기 ───────────────────────────────────────────────── */
const 워크넷인가 = (j) => (묶음이름[j.source] || j.source) === '워크넷';
const 안쓴것먼저 = (a, b) => (이미썼나.has(a.id) ? 1 : 0) - (이미썼나.has(b.id) ? 1 : 0)
  || String(a.id).localeCompare(String(b.id));

const 워크넷들 = 공고.filter((j) => 워크넷인가(j) && /^https?:\/\//.test(String(j.url || '')))
  .sort(안쓴것먼저).slice(0, 반);

/* 긁기 출처는 **출처를 고르게** — 묶음별로 번갈아 집습니다 (한 출처가 다 먹지 않게) */
const 긁기묶음 = new Map();
for (const j of 공고.filter((x) => !워크넷인가(x) && 원문쓸만한가(글.get(x.id) || ''))) {
  const 묶 = 묶음이름[j.source] || j.source;
  if (!긁기묶음.has(묶)) 긁기묶음.set(묶, []);
  긁기묶음.get(묶).push(j);
}
for (const a of 긁기묶음.values()) a.sort(안쓴것먼저);
const 긁기들 = [];
for (let i = 0; 긁기들.length < 반; i++) {
  let 넣음 = false;
  for (const a of 긁기묶음.values()) {
    if (!a[i]) continue;
    긁기들.push(a[i]); 넣음 = true;
    if (긁기들.length >= 반) break;
  }
  if (!넣음) break;
}

console.log('표본 — 워크넷 ' + 워크넷들.length + '건 (바라던 ' + 반 + ') · 긁기 출처 '
  + 긁기들.length + '건 (바라던 ' + 반 + ')');
if (긁기들.length) {
  const 셈 = {};
  for (const j of 긁기들) { const 묶 = 묶음이름[j.source] || j.source; 셈[묶] = (셈[묶] || 0) + 1; }
  console.log('   긁기 출처 갈래 — ' + Object.entries(셈).map(([k, v]) => k + ' ' + v).join(' · '));
}
console.log('   한 번도 안 쓴 공고 ' + [...워크넷들, ...긁기들].filter((j) => !이미썼나.has(j.id)).length + '건\n');

/* ── 워크넷 쪽 받기 ────────────────────────────────────────────── */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const 쪽글 = new Map();
let 못받음 = 0;
for (const j of 워크넷들) {
  await 자고(틈ms);
  try {
    const r = await fetch(j.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) { 못받음++; continue; }
    const html = await r.text();
    const t = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    쪽글.set(j.id, t);
  } catch { 못받음++; }
}
console.log('워크넷 쪽 — 받음 ' + 쪽글.size + ' · 못 받음 ' + 못받음
  + ' (한 건마다 ' + (틈ms / 1000) + '초 띄웠습니다)\n');

/* ── 재기 ──────────────────────────────────────────────────────── */
const 칸칸 = () => Object.fromEntries(칸들.map((k) => [k, { 맞음: 0, 틀림: 0, 빈칸: 0, 원문없음: 0, 포털칸: 0, 규칙말: 0 }]));
const 셈 = new Map();
const 틀린것 = [];
const 건별 = [];
for (const [갈래, 목록] of [['워크넷', 워크넷들], ['긁기 출처', 긁기들]]) {
  if (!셈.has(갈래)) 셈.set(갈래, { 건수: 0, 원문: 0, 칸: 칸칸() });
  const s = 셈.get(갈래);
  for (const j of 목록) {
    s.건수++;
    const 원문 = 갈래 === '워크넷' ? (쪽글.get(j.id) || '') : (글.get(j.id) || '');
    if (원문쓸만한가(원문)) s.원문++;
    const v = 우리값(j);
    const 이건 = { id: j.id, 갈래, 출처: j.source, 기관: j.org_name, 제목: j.title, 칸마다: [] };
    for (const k of 칸들) {
      const 판 = 칸판정(k, v[k], 원문);
      이건.칸마다.push({ 칸: k, ...판 });
      const 칸 = s.칸[k];
      if (판.판정 === '맞음') 칸.맞음++;
      else if (판.판정 === '틀림') {
        칸.틀림++;
        틀린것.push({ 갈래, 출처: j.source, id: j.id, 기관: j.org_name, 칸: k, 우리값: 판.값, 까닭: 판.까닭 });
      } else if (판.판정 === '규칙말') 칸.규칙말++;
      else if (판.판정 === '포털칸') 칸.포털칸++;
      else if (판.판정 === '원문없음') 칸.원문없음++;
      else 칸.빈칸++;
    }
    건별.push(이건);
  }
}

console.log('갈래        건수(원문)  칸        채움률   원문에 댄 칸의 맞음률    분모 밖');
for (const [갈래, s] of 셈) {
  for (const k of 칸들) {
    const c = s.칸[k];
    const 찬것 = c.맞음 + c.틀림 + c.원문없음 + c.포털칸 + c.규칙말;
    const 댄것 = c.맞음 + c.틀림;
    const 머리 = k === 칸들[0]
      ? (갈래 + '  ').padEnd(12) + String(s.건수 + '(' + s.원문 + ')').padStart(9)
      : ' '.repeat(21);
    console.log(머리 + '  ' + k.padEnd(8)
      + String(s.건수 ? Math.round((100 * 찬것) / s.건수) + '%' : '—').padStart(6)
      + (댄것 ? String(Math.round((100 * c.맞음) / 댄것) + '% (' + c.맞음 + '/' + 댄것 + ')').padStart(18)
        : '—'.padStart(18))
      + '    포털칸 ' + c.포털칸 + ' · 원문없음 ' + c.원문없음 + (c.규칙말 ? ' · 규칙말 ' + c.규칙말 : ''));
  }
  console.log('');
}

const 틀림수 = 틀린것.length;
console.log('── 신뢰 셋 ② — **틀린 값 ' + 틀림수 + '건** (표본 ' + (워크넷들.length + 긁기들.length) + '건) ──');
for (const x of 틀린것.slice(0, 20)) {
  console.log('  ' + x.갈래.padEnd(7) + x.칸.padEnd(6) + String(x.id).padEnd(20)
    + String(x.기관 || '').slice(0, 14).padEnd(16) + '우리 「' + String(x.우리값).slice(0, 40) + '」  ← ' + x.까닭);
}
if (틀림수 > 20) console.log('  … 그밖 ' + (틀림수 - 20) + '건');

if (건마다) {
  console.log('\n── 건마다 ──');
  for (const x of 건별) {
    console.log('■ ' + x.id + ' [' + x.출처 + '] ' + String(x.기관 || '').slice(0, 18)
      + ' — ' + String(x.제목 || '').slice(0, 40));
    for (const c of x.칸마다) {
      if (c.판정 === '빈칸') { console.log('   ' + c.칸.padEnd(6) + '빈칸'); continue; }
      console.log('   ' + c.칸.padEnd(6) + (c.판정 === '틀림' ? '**틀림**' : c.판정.padEnd(6))
        + ' 「' + String(c.값).slice(0, 46) + '」' + (c.까닭 ? '   ← ' + c.까닭 : ''));
    }
  }
}

/* ── 적기 ──────────────────────────────────────────────────────── */
if (!진짜) { console.log('\n[마른] 아무것도 안 적었습니다 — 적으려면 --진짜'); process.exit(0); }

const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const 잰것 = {
  잰날: 오늘,
  표본: '워크넷 ' + 워크넷들.length + ' + 긁기 출처 ' + 긁기들.length + ' (출처 고르게 · 안 쓴 공고 먼저)',
  틀림: 틀림수,
  틀린것: 틀린것.slice(0, 40),
  메모: '워크넷은 **공고 쪽**을 받아 댔습니다 (상세 API 에 대면 우리 값을 그대로 주는 자리라'
    + ' 「안 망가뜨렸다」는 뜻뿐입니다). 긁기 출처는 담긴 공고문에 댔습니다.'
    + ' 재는 자는 tools/칸대조.mjs 하나입니다.',
};
const 적을터 = fs.existsSync(path.join(process.env.HOME || '', 'log'))
  ? path.join(process.env.HOME, 'log') : path.join(여기, '..', 'log');
fs.mkdirSync(적을터, { recursive: true });
fs.writeFileSync(path.join(적을터, '신뢰셋_틀림.json'), JSON.stringify(잰것, null, 2) + '\n');
const 기록 = { 잰날: 오늘,
  쓴공고: [...new Set([...(쓴것.쓴공고 || []), ...워크넷들.map((j) => j.id), ...긁기들.map((j) => j.id)])] };
fs.writeFileSync(path.join(적을터, '신뢰셋_표본기록.json'), JSON.stringify(기록, null, 2) + '\n');
console.log('\n○ ' + path.join(적을터, '신뢰셋_틀림.json') + ' 에 적었습니다 (쓴 공고 '
  + 기록.쓴공고.length + '건 기록)');

const r = await fetch(U + '/rest/v1/site_settings?on_conflict=key', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ key: '신뢰셋_틀림', value: 잰것 }]),
});
if (!r.ok) { console.error('✗ DB 에 못 넣었습니다 — ' + (await r.text()).slice(0, 200)); process.exit(1); }
console.log('○ site_settings[신뢰셋_틀림] 을 고쳤습니다 — 아침 메일 ② 에 바로 뜹니다');
