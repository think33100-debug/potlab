/* **낡은 지원자격·모집인원만 좁게 덮습니다** (2026-10-24 세중님 2번 ㄱㄱ)
 *
 *   node tools/낡은칸덮기.mjs            덮일 것만 (기본 · 마른 · 전후 값 원문)
 *   node tools/낡은칸덮기.mjs --진짜      덮습니다 (칸기록에 옛값이 남습니다)
 *   node tools/낡은칸덮기.mjs --전부      회원 화면 밖까지
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 능력표의 「틀림」은 **규칙 탓이 아니라 낡은 값**입니다. 같은 원문에 지금 규칙을
 * 다시 걸면 지원자격 틀림 13→3 · 모집인원 2→0 입니다 (`--다시뽑음` · 2026-10-24).
 * 고친 규칙이 **이미 담긴 공고에 안 닿은 것**입니다 (지침 9절).
 *
 * `tools/본문칸_다시뽑기.mjs` 는 **빈 칸만** 채워서 이것을 못 고칩니다.
 *
 * ── 덮는 조건 (세중님 2번 그대로) ───────────────────────────
 *   ㉠ 지금 값이 **버릴 말 꼴**이다 —
 *      `자격버릴말`(배점·제출서류·결격사유·근무조건·급여…) · `자격머리말`(빈 머리말)
 *      · `자격이름표만`(「응시자격」만) · `쓸만한자격글`이 아님
 *   ㉡ **새 규칙이 값을 낸다** (안 내면 **안 건드립니다** — 비우지 않습니다)
 *   칸은 **지원자격·모집인원 둘뿐**입니다. 예상연봉·근무지는 **손대지 않습니다**
 *   (CE79376 의 회원 화면 금액이 정답과 같아서, 덮으면 더 나빠집니다)
 *
 * ── 담는 길 ─────────────────────────────────────────────────
 * `칸되메우기` 창구뿐입니다. 그 창구는 `뽑은값` 을 **합치며 새 값이 이깁니다**
 * (`coalesce(j.뽑은값,'{}') || r->'뽑은값'`) — 그래서 지원자격을 덮을 수 있습니다.
 * `edited_fields`(사람이 고친 칸)·`admin_locked` 는 창구가 건너뛰고,
 * `updated_at` 은 안 바뀌고, `칸기록` 에 **옛값**이 남습니다.
 *
 * ★ `headcount`(숫자 칸)는 그 창구가 **null 일 때만** 채웁니다 — 틀린 숫자는
 *   못 덮습니다. 그래서 모집인원은 **글꼴(뽑은값.모집인원)** 만 손보고, 숫자 칸을
 *   고쳐야 하는 건은 **목록으로만** 올립니다 (따로 물어야 하는 자리입니다).
 */
import fs from 'node:fs';
import { 칸뽑기, 자격버릴말, 자격머리말, 자격이름표만, 쓸만한자격글, 남의직종말 } from './공고문읽기.mjs';
import { 차례붙이기 } from './쪽나눠받기.mjs';

const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 전부다 = argv.includes('--전부');

/** 지금 값이 「버릴 말 꼴」인가 — 덮어도 되는 까닭을 함께 돌려줍니다 */
export function 버릴꼴인가(값) {
  const t = String(값 || '').trim();
  if (!t) return null;
  if (자격버릴말.test(t)) return '버릴 말 (' + (t.match(자격버릴말) || [''])[0].trim() + ')';
  if (자격머리말.test(t)) return '빈 머리말';
  if (자격이름표만.test(t)) return '이름표만';
  if (!쓸만한자격글(t)) return '면허·자격 말이 없음';
  return null;
}

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('배점표는 버릴 꼴', !!버릴꼴인가('및 서류전형 배점 ❍ 응시자격: 지원 분야의 필수 면허·자격 소지자 ❍ 서류 전형 점수표(30점)'));
  보('업무 설명은 버릴 꼴', !!버릴꼴인가('물리리료실 치료사 업무'));
  보('빈 머리말은 버릴 꼴', !!버릴꼴인가('아래의 자격을 모두 충족하는 자'));
  보('이름표만도 버릴 꼴', !!버릴꼴인가('응시자격'));
  보('결격사유 문단도 버릴 꼴', !!버릴꼴인가('○ 성별, 학력 및 응시연령에 제한은 없으나, 본원 인사규정 제52조(정)'));
  보('★ 멀쩡한 자격 글은 **안 건드린다**', 버릴꼴인가('물리치료사 면허증 소지자 (우대 — 소아치료경력자)') === null);
  보('★ 포털 요약도 안 건드린다', 버릴꼴인가('자격 물리치료사 · 학력 학력무관') === null);
  보('빈 값은 대상이 아니다', 버릴꼴인가('') === null && 버릴꼴인가(null) === null);
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

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
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 있어야 합니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json' };

async function 전부(길) {
  const out = [];
  const 길2 = 차례붙이기(길);
  for (let off = 0; ; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길2 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 50) + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 40000) break;
  }
  return out;
}

const 보임 = new Set((await 전부('job_posts_pub?select=id')).map((x) => x.id));
const 다 = await 전부('job_posts?select=id,source,org_name,title,headcount,detail,'
  + encodeURIComponent('뽑은값') + ',edited_fields,admin_locked');
const 볼것 = 다.filter((x) => 전부다 || 보임.has(x.id));
console.log('공고 ' + 다.length + '건 중 볼 것 ' + 볼것.length + '건'
  + (전부다 ? ' (--전부)' : ' (회원 화면만)'));

const 글표 = new Map();
for (let i = 0; i < 볼것.length; i += 40) {
  const 조각 = 볼것.slice(i, i + 40).map((x) => encodeURIComponent(x.id)).join(',');
  for (const b of await 전부('job_body?select=job_id,kind,body&job_id=in.(' + 조각 + ')')) {
    글표.set(b.job_id, (글표.get(b.job_id) || '') + '\n' + String(b.body || ''));
  }
}
console.log('본문이 있는 공고 ' + 글표.size + '건\n');

const 자격것 = []; const 인원글것 = []; const 못덮는인원 = []; const 숫자안맞음 = [];
for (const x of 볼것) {
  const 글 = 글표.get(x.id);
  if (!글 || 글.trim().length < 50) continue;
  const 잠긴칸 = new Set(x.edited_fields || []);
  if (x.admin_locked) continue;
  let r;
  try { r = 칸뽑기(글, 글); } catch { continue; }

  /* ── 지원자격 ── */
  const 지금자격 = (x['뽑은값'] && x['뽑은값'].지원자격)
    || (x.detail && (x.detail['뽑은값']?.지원자격 || x.detail.지원자격)) || '';
  const 까닭 = 버릴꼴인가(지금자격);
  if (까닭 && r.지원자격 && String(r.지원자격).trim() !== String(지금자격).trim()) {
    자격것.push({ x, 전: 지금자격, 후: r.지원자격, 까닭, 근거: r.근거?.지원자격 || '' });
  }

  /* ── 모집인원 ── */
  const 인원칸들 = Object.values(r.모집인원 || {}).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  const 새합 = 인원칸들.length ? 인원칸들.reduce((a, b) => a + b, 0) : null;
  const 통합꼴 = 남의직종말.test(글);
  if (x.headcount != null && 새합 != null && 새합 !== x.headcount && 통합꼴) {
    /* 창구가 headcount 를 못 덮습니다 — 목록으로만 올립니다 */
    못덮는인원.push({ x, 전: x.headcount, 후: 새합, 근거: Object.entries(r.근거 || {})
      .filter(([k]) => k.startsWith('모집인원')).map(([, v]) => v).join(' / ').slice(0, 160) });
  }
  const 지금인원글 = (x['뽑은값'] && x['뽑은값'].모집인원) || '';
  if (지금인원글 && r.모집인원글 && 통합꼴) {
    const 새글 = Object.values(r.모집인원글)[0];
    if (새글 && String(새글) !== String(지금인원글)) {
      인원글것.push({ x, 전: 지금인원글, 후: 새글 });
    }
  }
  if (x.headcount != null && 새합 != null && 새합 !== x.headcount && !통합꼴) {
    숫자안맞음.push({ x, 전: x.headcount, 후: 새합 });
  }
  if (잠긴칸.size) { /* 창구가 건너뜁니다 — 셈에만 씁니다 */ }
}

const 보이나 = (x) => (보임.has(x.id) ? '회원 화면' : '숨김·보류');
console.log('══ ① 지원자격 — 덮을 것 **' + 자격것.length + '건** ══\n');
for (const r of 자격것) {
  console.log('● ' + r.x.id.padEnd(18) + '[' + String(r.x.source).padEnd(4) + '] '
    + String(r.x.org_name || '').slice(0, 18).padEnd(19) + boi(r.x));
  console.log('   제목  ' + String(r.x.title || '').replace(/\s+/g, ' ').slice(0, 70));
  console.log('   까닭  ' + r.까닭);
  console.log('   전    「' + String(r.전).replace(/\s+/g, ' ').slice(0, 150) + '」');
  console.log('   후    「' + String(r.후).replace(/\s+/g, ' ').slice(0, 150) + '」');
  if (r.근거) console.log('   근거  ' + String(r.근거).replace(/\s+/g, ' ').slice(0, 130));
}
function boi(x) { return 보이나(x); }

console.log('\n══ ② 모집인원(글꼴) — 덮을 것 ' + 인원글것.length + '건 ══');
for (const r of 인원글것) {
  console.log('● ' + r.x.id + ' [' + r.x.source + '] ' + String(r.x.org_name).slice(0, 16)
    + ' · ' + 보이나(r.x) + '\n   전 「' + r.전 + '」 → 후 「' + r.후 + '」');
}

console.log('\n══ ③ 숫자 칸(headcount)이 안 맞는 통합 공고 — **창구가 못 덮습니다** '
  + 못덮는인원.length + '건 ══');
for (const r of 못덮는인원) {
  console.log('● ' + r.x.id + ' [' + r.x.source + '] ' + String(r.x.org_name).slice(0, 16)
    + ' · ' + 보이나(r.x) + '\n   지금 ' + r.전 + '명 → 새 규칙 ' + r.후 + '명'
    + (r.근거 ? '\n   근거 ' + r.근거 : ''));
}
console.log('\n(참고) 통합 공고가 아닌데 숫자가 다른 것 ' + 숫자안맞음.length + '건 — **손대지 않습니다**');
for (const r of 숫자안맞음.slice(0, 10)) {
  console.log('   ' + r.x.id + ' 지금 ' + r.전 + ' → 새 규칙 ' + r.후 + ' · ' + 보이나(r.x));
}

const 칸줄 = [
  ...자격것.map((r) => ({ id: r.x.id, 뽑은값: { 지원자격: r.후, 낡은칸덮은근거: { 지원자격: r.까닭 } } })),
  ...인원글것.map((r) => ({ id: r.x.id, 뽑은값: { 모집인원: String(r.후) } })),
];
if (!칸줄.length) { console.log('\n덮을 것이 없습니다'); process.exit(0); }
if (!진짜) {
  console.log('\n[마른] 아무것도 안 덮었습니다 — 덮으려면 --진짜');
  console.log('  덮을 공고 ' + 칸줄.length + '건 (지원자격 ' + 자격것.length
    + ' · 모집인원 글꼴 ' + 인원글것.length + ')');
  process.exit(0);
}

console.log('\n칸을 덮습니다 — ' + 칸줄.length + '건');
for (let i = 0; i < 칸줄.length; i += 50) {
  const r = await fetch(U + '/rest/v1/rpc/' + encodeURIComponent('칸되메우기'), {
    method: 'POST', headers: H, body: JSON.stringify({ p_rows: 칸줄.slice(i, i + 50) }),
  });
  const t = await r.text();
  if (!r.ok) { console.error('✗ 칸되메우기 ' + r.status + ' · ' + t.slice(0, 250)); process.exit(1); }
  if (i === 0) console.log('  창구가 답한 것 — ' + t.slice(0, 240));
}
console.log('\n되돌리는 법 — 칸기록에서 옛값을 꺼내 같은 창구로 다시 보냅니다:');
console.log("  select job_id, 칸, 옛값 from 칸기록 where 누가='첨부 되메우기' and 바뀐때 > now() - interval '1 hour';");
