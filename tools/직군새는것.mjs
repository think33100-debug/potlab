/* 직군이 **옆 글(이전글·다음글)에서 샌** 공고를 찾습니다 — 읽기만 합니다
 *
 *   node tools/직군새는것.mjs              회원 화면 공고 전수
 *   node tools/직군새는것.mjs --전부        숨김·보류까지
 *   node tools/직군새는것.mjs --출처 HS3
 *   node tools/직군새는것.mjs --자기점검     규칙만 (DB 안 두드림)
 *
 * ── 왜 (2026-10-20 세중님 2번) ────────────────────────────────
 * 병원 게시판은 글 끝에 「이전글 / <옆 글 제목> / <날짜>」를 붙입니다.
 * 그 제목이 본문에 섞여 **옆 글의 직군이 이 공고의 직군**이 됐습니다 —
 *   HS2108355665 「계약직 업무지원직(진료지원)」 → 직군 「작업치료사」
 *   (옆 글이 「계약직 보건직(작업치료사) - 휴직대체」 였습니다)
 * 그리고 `상세건너뛸공고()` 가 **같은 id 로 이어받아** 매 바퀴 되살렸습니다.
 *
 * 떼는 규칙은 `공고문읽기.mjs` 의 `이전다음글떼기()` 한 자리입니다 (지침 6절).
 *
 * ★ 아무것도 바꾸지 않습니다. 고치는 것은 보고 뒤입니다.
 */
import fs from 'node:fs';
import { 본문직군, 이전다음글떼기, 옆글머리말 } from './공고문읽기.mjs';
import { matchJob, notOurs } from './gas-rules.mjs';

const argv = process.argv.slice(2);
const 전부 = argv.includes('--전부');
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : null;
const 자기점검만 = argv.includes('--자기점검');

/** 제목에서 우리 직군 — 수집기와 같은 길 (`collect-hosp.mjs:384`) */
export function 제목직군(제목) {
  const t = String(제목 || '');
  return (matchJob(t) && !notOurs(t)) ? matchJob(t) : '';
}

/** 한 공고를 가립니다 — 직군이 어디서 왔나
 *
 * ★ 2026-10-20 — `우리가적은근거` 를 **따로** 받습니다 (`detail.근거`).
 *   그것을 **근거로 쓰지 않습니다** — 「공고문에 물리치료사가 안 적혀
 *   있습니다」가 「적혀 있다」로 읽혔던 자리입니다 (CLAUDE.md 직군의심 절).
 *   다만 「원문에 없음」과 **「첨부 글이 DB 에 없어서 못 가림」**은 다른 일이라
 *   갈래를 나눕니다. GJ2 5건이 그 꼴이었습니다 — 첨부 공고문에 「작업치료사」가
 *   또렷이 있는데(손으로 열어 확인했습니다) 우리는 첨부 **글을 안 남깁니다**.
 */
export function 가리기(제목, 본문, 우리가적은근거) {
  const 제 = 제목직군(제목);
  const 원 = 본문직군(String(본문 || '').replace(옆글머리말, (m) => m));   /* 떼기 전 */
  const 전 = (() => {
    /* 떼기 **전** 판정을 보려고 날글을 그대로 넣습니다 */
    const t = String(본문 || '');
    const ot = /(작업\s*치료\s*(사|직|선생))/.test(t);
    const pt = /((물리|도수)\s*치료\s*(사|직|선생))/.test(t);
    if (ot && pt) return '공통';
    if (ot) return '작업치료사';
    if (pt) return '물리치료사';
    return '';
  })();
  const 뒤 = 본문직군(본문);          /* 떼고 난 뒤 (본문직군 이 안에서 뗍니다) */
  if (제) return { 갈래: '제목', 직군: 제, 떼기전: 전, 떼기후: 뒤 };
  if (뒤) return { 갈래: '본문', 직군: 뒤, 떼기전: 전, 떼기후: 뒤 };
  if (전) return { 갈래: '옆글에서 샘', 직군: '', 떼기전: 전, 떼기후: 뒤 };
  if (/첨부/.test(String(우리가적은근거 || ''))) {
    return { 갈래: '첨부라는데 글이 없음', 직군: '', 떼기전: 전, 떼기후: 뒤,
      적은근거: String(우리가적은근거) };
  }
  return { 갈래: '근거 없음', 직군: '', 떼기전: 전, 떼기후: 뒤, 원 };
}

/* ── 자기점검 ─────────────────────────────────────────── */
function 자기점검() {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 보훈본문 = '2. 모집분야 : 진료지원\n\n주소 복사\n\n이전글\n\n'
    + '[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용\n\n2026.10.16';
  const a = 가리기('[광주보훈병원] 계약직 업무지원직(진료지원) 직원 채용', 보훈본문);
  보('광주보훈 — 옆글에서 샌 것으로 가립니다', a.갈래 === '옆글에서 샘');
  보('광주보훈 — 떼기 전에는 작업치료사였습니다', a.떼기전 === '작업치료사');
  보('광주보훈 — 떼고 나면 빈 말입니다', a.떼기후 === '');
  const b = 가리기('[광주보훈병원] 계약직 보건직(작업치료사) - 휴직대체 직원 채용', 보훈본문);
  보('짝 공고는 제목에서 옵니다', b.갈래 === '제목' && b.직군 === '작업치료사');
  const c = 가리기('직원 채용 공고', '모집직종 : 물리치료사 1명\n\n이전글\n\n작업치료사 채용\n\n2026.10.16');
  보('내 본문에 직군이 있으면 본문입니다', c.갈래 === '본문' && c.직군 === '물리치료사');
  const d = 가리기('방사선사 채용', '모집분야 : 방사선사 1명');
  보('아무 데도 없으면 근거 없음', d.갈래 === '근거 없음');
  보('떼기가 본문을 안 버립니다', 이전다음글떼기(보훈본문).includes('2. 모집분야 : 진료지원'));
  const 탈 = 잼.filter((y) => !y[1]);
  for (const y of 잼) if (!y[1]) console.log('  ✗ ' + y[0]);
  console.log((탈.length ? '✗ 자기점검 ' + 탈.length + '가지 탈'
    : '○ 직군새는것 자기점검 통과 — ' + 잼.length + '가지') + ' (DB 를 두드리지 않았습니다)');
  return !탈.length;
}
if (!자기점검()) process.exit(1);
if (자기점검만) process.exit(0);

/* ── 열쇠 ──────────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_ROLE_KEY || cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL · SERVICE KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 다받기(길) {
  const 모두 = [];
  for (let off = 0; off < 5000; off += 100) {
    const r = await fetch(U + '/rest/v1/' + 길 + '&limit=100&offset=' + off, { headers: H });
    if (!r.ok) { console.error('✗ ' + r.status + ' · ' + (await r.text()).slice(0, 200)); process.exit(1); }
    const j = await r.json();
    모두.push(...j);
    if (j.length < 100) break;
  }
  return 모두;
}

const 보임 = new Set((await 다받기('job_posts_pub?select=id&order=id.asc')).map((x) => x.id));
const 조건 = ['job_group=not.is.null', 'job_group=neq.'].join('&')
  + (출처 ? '&source=eq.' + 출처 : '');
const 공고 = await 다받기('job_posts?select=id,source,org_name,title,job_group,hold,hidden,evidence,detail'
  + '&' + 조건 + '&order=db_insert_at.desc');
const 볼것 = 전부 ? 공고 : 공고.filter((x) => 보임.has(x.id));
console.log('\n직군이 붙은 공고 ' + 볼것.length + '건을 봅니다'
  + (전부 ? ' (숨김·보류 포함)' : ' (회원 화면만)') + (출처 ? ' · 출처 ' + 출처 : ''));

/* 본문 — 한 공고에 여러 줄이면 **이어 붙여** 봅니다 */
const 본문 = new Map();
for (let i = 0; i < 볼것.length; i += 40) {
  const ids = 볼것.slice(i, i + 40).map((x) => x.id);
  const j = await 다받기('job_body?select=job_id,kind,ord,body&job_id=in.(' + ids.join(',') + ')'
    + '&order=job_id.asc,ord.asc');
  for (const b of j) 본문.set(b.job_id, (본문.get(b.job_id) || '') + '\n' + String(b.body || ''));
}

const 셈 = { 제목: 0, 본문: 0, '옆글에서 샘': 0, '첨부라는데 글이 없음': 0, '근거 없음': 0, 본문없음: 0 };
const 샌것 = []; const 근거없음 = [];
for (const x of 볼것) {
  const g = 본문.get(x.id);
  if (!g || !g.trim()) { 셈.본문없음++; continue; }
  const r = 가리기(x.title, g, (x.detail && x.detail['근거']) || '');
  셈[r.갈래] = (셈[r.갈래] || 0) + 1;
  if (r.갈래 === '옆글에서 샘') 샌것.push({ ...x, ...r });
  if (r.갈래 === '근거 없음') 근거없음.push({ ...x, ...r });
}

console.log('\n── 직군이 어디서 왔나 ──');
for (const k of ['제목', '본문', '옆글에서 샘', '첨부라는데 글이 없음', '근거 없음', '본문없음']) {
  console.log('  ' + String(셈[k] || 0).padStart(4) + '건  ' + k);
}

const 꼬리표든것 = [...본문.values()].filter((g) => g.split('\n').some((l) => 옆글머리말.test(l))).length;
console.log('\n  본문에 이전글·다음글 꼬리표가 섞인 공고 ' + 꼬리표든것 + '건 / ' + 본문.size + '건');

if (샌것.length) {
  console.log('\n★ 옆 글에서 샌 것 — ' + 샌것.length + '건 (직군을 바로잡아야 합니다)');
  for (const x of 샌것) {
    console.log('  ' + x.id.padEnd(14) + (x.source || '').padEnd(4)
      + (보임.has(x.id) ? '회원화면 ' : '        ')
      + '지금 직군 ' + String(x.job_group).padEnd(7) + ' ← 옆 글 ' + x.떼기전);
    console.log('      ' + String(x.org_name || '').slice(0, 18) + ' · ' + String(x.title || '').slice(0, 56));
  }
}
if (셈['첨부라는데 글이 없음']) {
  console.log('\n  ※ 「첨부라는데 글이 없음」 ' + 셈['첨부라는데 글이 없음']
    + '건 — 우리가 적은 근거는 「첨부 공고문」인데');
  console.log('     **첨부 글을 DB 에 안 남겨서** 제 도구가 못 가립니다. 손으로 열어 보면 있습니다');
  console.log('     (GJ2 5건을 2026-10-20 에 열어 확인했습니다 — tools/나라일터_직군근거.mjs)');
}
if (근거없음.length) {
  console.log('\n★ 원문 어디에도 우리 직군 말이 없는 것 — ' + 근거없음.length + '건');
  for (const x of 근거없음.slice(0, 30)) {
    console.log('  ' + x.id.padEnd(14) + (x.source || '').padEnd(4)
      + (보임.has(x.id) ? '회원화면 ' : '        ')
      + '지금 직군 ' + String(x.job_group).padEnd(7)
      + String(x.org_name || '').slice(0, 16) + ' · ' + String(x.title || '').slice(0, 44));
  }
  if (근거없음.length > 30) console.log('  … 그밖 ' + (근거없음.length - 30) + '건');
}
console.log('\n※ 아무것도 바꾸지 않았습니다.');
