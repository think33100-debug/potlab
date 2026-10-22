/* **긁기 출처**(워크넷 밖)의 일곱 칸을 담긴 원문 글에 대고 채점합니다
 *
 *   node tools/긁기출처채점.mjs                 회원 화면만 (기본)
 *   node tools/긁기출처채점.mjs --전부          숨김·보류까지
 *   node tools/긁기출처채점.mjs --흠 30         흠을 더 길게
 *
 * ── 왜 따로 만드나 ──────────────────────────────────────────────
 * 워크넷은 상세 API 가 우리 값을 **그대로 주는 자리**라서, 거기에 대고 채점한
 * 100% 는 「받은 값을 안 망가뜨린다」는 뜻입니다 (docs/수집기_능력표_1020.md).
 * **읽기 실력은 긁기 출처에서만** 드러납니다 — 알리오·클린아이·나라일터·병원자체.
 * 그 출처는 값이 **공고문(첨부)** 안에 있고, 우리는 그 글을 `job_body` 에 담아
 * 두었습니다. 그래서 **담긴 글이 원문**입니다 (쪽을 다시 긁지 않습니다 · 부하 0).
 *
 * ── 채점 (2026-10-22 세중님 3번 — 조각 채점) ─────────────────────
 *   맞음      우리 값의 **조각이 모두** 원문에 있음
 *   틀림      **원문에 없는 조각**이 우리 값에 있음
 *   빈칸      우리가 빔 (원문에 있는지는 사람이 봅니다 — 여기서는 안 셉니다)
 *   원문없음  그 공고의 글이 아직 안 담겼습니다 → **분모에서 뺍니다**
 * ★ 읽기만 합니다. DB·화면을 안 건드립니다.
 * ★ 날짜·시각은 꼴을 맞춰 댑니다 (2026-10-28 ↔ 2026. 10. 28. · 17:30:00 ↔ 17:30).
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
/** 날짜·시각은 **여러 꼴**로 찾아 봅니다 — 원문은 「2026. 10. 28.」 처럼 적습니다 */
const 날짜꼴들 = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(눕(v));
  if (!m) return null;
  const [, y, mo, d] = m;
  const mo1 = String(Number(mo)); const d1 = String(Number(d));
  return [`${y}${mo}${d}`, `${y}${mo1}${d1}`, `${mo}${d}`, `${mo1}${d1}`];
};
const 시각꼴들 = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(눕(v));
  if (!m) return null;
  const [, h, mi] = m;
  const h1 = String(Number(h));
  return [`${h}${mi}`, `${h1}${mi}`, `${h1}시${Number(mi) ? mi + '분' : ''}`];
};
/** 우리 값을 조각으로 — 쉼표·가운뎃점·슬래시로 끊고 라벨을 뗍니다 */
const 조각내기 = (s) => 눕(s).split(/[,，、·/|]|\s-\s/)
  .map((x) => x.replace(/^(?:자격|학력|면허|경력|근무지|지역)\s*[:：]?\s*/, '').trim())
  .filter((x) => 글자만(x).length >= 2);

const 칸들 = ['모집인원', '접수마감', '마감시각', '근무지', '지원자격', '예상연봉', '고용형태'];

const 공고 = await 다받기('job_posts?select=id,source,org_name,title,job_group,headcount,'
  + 'apply_to,apply_to_time,work_place,employ_type,detail,' + encodeURIComponent('뽑은값'));
const 보임 = new Set((await 다받기('job_posts_pub?select=id')).map((x) => x.id));
const 글들 = new Map();
for (const b of await 다받기('job_body?select=job_id,kind,body')) {
  글들.set(b.job_id, (글들.get(b.job_id) || '') + '\n' + String(b.body || ''));
}

const 볼것 = 공고
  .filter((j) => (묶음이름[j.source] || j.source) !== '워크넷')
  .filter((j) => 전부 || 보임.has(j.id));

const 뽑 = (j, k) => ((j['뽑은값'] || {})[k] ?? null);
const 디 = (j, k) => ((j.detail || {})[k] ?? null);
const 우리값 = (j) => ({
  모집인원: j.headcount != null ? String(j.headcount) : (뽑(j, '모집인원') || 디(j, '모집인원')),
  접수마감: 뽑(j, '접수마감글') || j.apply_to || null,
  마감시각: j.apply_to_time || null,
  근무지: j.work_place || 뽑(j, '근무지') || null,
  지원자격: 뽑(j, '지원자격') || 디(j, '지원자격') || null,
  예상연봉: 뽑(j, '예상연봉') || 디(j, '연봉') || 디(j, '예상연봉') || null,
  고용형태: j.employ_type || null,
});

const 셈 = new Map();           /* 묶음 → 칸 → {맞음,틀림,빈칸,원문없음} */
const 칸칸 = () => Object.fromEntries(칸들.map((k) => [k, { 맞음: 0, 틀림: 0, 빈칸: 0, 원문없음: 0 }]));
const 흠 = [];
let 글있는것 = 0;

for (const j of 볼것) {
  const 묶 = 묶음이름[j.source] || j.source;
  if (!셈.has(묶)) 셈.set(묶, { 건수: 0, 칸: 칸칸() });
  const s = 셈.get(묶);
  s.건수++;
  const 원문 = 글들.get(j.id) || '';
  const 원문글자 = 글자만(원문);
  if (원문글자.length > 200) 글있는것++;
  const 값 = 우리값(j);
  for (const k of 칸들) {
    const v = 눕(값[k]);
    const 칸 = s.칸[k];
    if (!v) { 칸.빈칸++; continue; }
    if (원문글자.length <= 200) { 칸.원문없음++; continue; }
    /* 날짜·시각은 꼴을 바꿔 찾습니다 */
    const 꼴 = k === '접수마감' ? 날짜꼴들(v) : k === '마감시각' ? 시각꼴들(v) : null;
    if (꼴) {
      if (꼴.some((x) => 원문글자.includes(글자만(x)))) 칸.맞음++;
      else { 칸.틀림++; 흠.push([묶, k, j.id, j.org_name, v, '원문에 그 날짜·시각이 없음']); }
      continue;
    }
    /* 고용형태는 **낱말 판정**이라 글자 찾기로 못 봅니다 — 따로 셉니다 */
    if (k === '고용형태') {
      const 말 = { 정규직: /정규직|기간의?\s*정함이?\s*없|공무직|무기계약/, 계약직: /계약직|기간제|임기제|한시|대체|임시직|인턴|촉탁/,
        무기계약직: /무기계약|공무직|기간의?\s*정함이?\s*없/ }[v];
      if (말 && 말.test(원문)) 칸.맞음++;
      else { 칸.틀림++; 흠.push([묶, k, j.id, j.org_name, v, '원문에 그 고용형태 말이 없음']); }
      continue;
    }
    const 조각 = 조각내기(v);
    const 남는것 = 조각.filter((x) => !원문글자.includes(글자만(x)));
    if (!조각.length || !남는것.length) 칸.맞음++;
    else {
      칸.틀림++;
      흠.push([묶, k, j.id, j.org_name, v.slice(0, 40), '원문에 없는 조각 「' + 남는것[0].slice(0, 22) + '」']);
    }
  }
}

console.log('긁기 출처 ' + 볼것.length + '건' + (전부 ? ' (숨김·보류까지)' : ' (회원 화면만)')
  + ' · 담긴 원문 글이 있는 것 ' + 글있는것 + '건\n');
console.log('묶음      건수  칸        채움률   맞음률(원문이 있는 채운 칸 중)');
for (const [묶, s] of [...셈].sort((a, b) => b[1].건수 - a[1].건수)) {
  for (const k of 칸들) {
    const c = s.칸[k];
    const 찬것 = c.맞음 + c.틀림 + c.원문없음;
    const 댄것 = c.맞음 + c.틀림;
    console.log((k === 칸들[0] ? 묶.padEnd(9) + String(s.건수).padStart(4) + '  ' : ' '.repeat(15))
      + k.padEnd(9) + String(Math.round(찬것 / s.건수 * 100)).padStart(4) + '%   '
      + (댄것 ? String(Math.round(c.맞음 / 댄것 * 100)).padStart(4) + '%  (' + c.맞음 + '/' + 댄것 + ')' : '  —')
      + (c.원문없음 ? '   · 원문 못 댄 것 ' + c.원문없음 : ''));
  }
  console.log('');
}
console.log('── 흠 (앞 ' + Math.min(흠몇, 흠.length) + '건) ──');
for (const [묶, k, id, 기관, 우리, 왜] of 흠.slice(0, 흠몇)) {
  console.log('  ' + 묶.padEnd(9) + k.padEnd(6) + String(id).padEnd(13)
    + String(기관 || '').slice(0, 12).padEnd(14) + '우리 「' + 우리 + '」  ← ' + 왜);
}
if (흠.length > 흠몇) console.log('  … 그밖 ' + (흠.length - 흠몇) + '건');
