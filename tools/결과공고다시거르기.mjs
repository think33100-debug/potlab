/* 회원 화면 공고의 **지금 제목**을 거르기 규칙에 다시 대 봅니다 (2026-10-23)
 *
 *   node tools/결과공고다시거르기.mjs            목록만 (읽기만 · 아무것도 안 바꿉니다)
 *   node tools/결과공고다시거르기.mjs --자기점검   규칙만
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 2026-10-23 에 「… 작업치료사(비정규직) **면접일정 안내**」가 회원 화면에
 * 있었습니다 (HS102260084 · 경기도의료원 수원병원).
 *
 * **낱말이 빠진 것이 아닙니다.** `HS_SKIP_RE` 에 `면접\s*일정` 이 이미 있고,
 * 온전한 제목을 대면 **쓰레기통**으로 갑니다. 대 봤습니다 —
 *
 *   온전한 제목        → 쓰레기통 · 「면접일정」에 걸림
 *   앞 60자로 자른 것   → **회원목록** · 걸리는 말이 뒤에 있어 안 보임
 *
 * 목록 API·게시판 목록이 제목을 자르기 때문입니다 — `collect-worknet.mjs:679`
 * 에 그 까닭이 이미 적혀 있습니다(「목록 API 가 30자로 자르니 … 뒤에 있는 결과
 * 발표 글귀를 못 보고 회원 화면에 올릴 수 있습니다」).
 *
 * 거르기는 **담을 때 한 번**만 돕니다. 나중에 상세를 읽어 제목이 온전해져도
 * **다시 거르지 않습니다.** 그 틈을 메우려고 이 도구가 **지금 제목**으로 다시 댑니다.
 *
 * ★ **아무것도 안 바꿉니다.** 숨기는 것은 승인 자리입니다 (CLAUDE.md 0-0).
 *   목록을 보고 세중님이 관리자 화면에서 「숨기기」를 누르시면 됩니다.
 */
import fs from 'node:fs';
/* 같은 폴더라 **상대 들여오기**로 충분합니다 — 경로를 손으로 만들면
   한글 폴더 이름이 두 번 인코딩돼서 못 찾습니다 (2026-10-23 에 겪었습니다) */
import { HS_SKIP_RE } from './gas-rules.mjs';
import { sortJob } from './sort-rule.mjs';
/* ★ 차례(order)를 안 붙이고 offset 으로 쪽을 넘기면 줄이 겹치거나 빠집니다.
   2026-10-23 에 회원 화면 292건을 231건으로 셌습니다 — 저장소에 이미 막는
   자리가 있습니다 (지침 6절 — 이미 있는 것을 먼저 찾기) */
import { 차례붙이기 } from './쪽나눠받기.mjs';

/* ── 자기점검 ─────────────────────────────────────────── */
if (process.argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 긴제목 = '경기도의료원 수원병원 마취통증의학과 전문의(비정규직), 우리회사건강주치의사업 '
    + '직업환경의학과 전문의(비정규직), 간호사(비정규직-육아휴직대체), 장애인 의료기관 '
    + '이용편의지원사업 작업치료사(비정규직) 면접일정 안내';

  보('온전한 제목은 걸린다 (면접일정)', HS_SKIP_RE.test(긴제목));
  보('온전한 제목은 쓰레기통', sortJob(긴제목, '작업치료사', null).갈래 === '쓰레기통');
  보('★ 60자로 자르면 안 걸린다 (이것이 뿌리입니다)', !HS_SKIP_RE.test(긴제목.slice(0, 60)));
  보('60자로 자르면 회원목록이 된다',
    sortJob(긴제목.slice(0, 60), '작업치료사', null).갈래 === '회원목록');
  보('합격자 발표도 걸린다', HS_SKIP_RE.test('… 채용 서류전형 합격자 발표'));
  보('응시자 안내도 걸린다', HS_SKIP_RE.test('2026년 제3회 응시자 안내'));
  보('멀쩡한 공고는 안 걸린다',
    !HS_SKIP_RE.test('은평성모병원 재활의학팀 물리치료직(휴직대체 계약직) 모집'));
  보('멀쩡한 공고에 「접수마감일」이 있어도 안 걸린다 — 「접수 마감」은 걸립니다',
    HS_SKIP_RE.test('물리치료사 채용 접수 마감'));

  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

/* ── DB 읽기 ─────────────────────────────────────────── */
const cfg = {};
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !cfg[m[1]]) cfg[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const U = cfg.SUPABASE_URL;
const K = cfg.SUPABASE_SERVICE_KEY;
if (!U || !K) { console.error('✗ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
const H = { apikey: K, Authorization: 'Bearer ' + K };

async function 전부(길) {
  const out = [];
  for (let off = 0; ; off += 100) {
    const 길2 = 차례붙이기(길);
    const 이음 = 길2.includes('?') ? '&' : '?';
    const r = await fetch(U + '/rest/v1/' + 길2 + 이음 + 'limit=100&offset=' + off, { headers: H });
    if (!r.ok) throw new Error(길.slice(0, 40) + ' ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const a = await r.json();
    out.push(...a);
    if (a.length < 100) break;
    if (off > 40000) break;
  }
  return out;
}

/* ★ 「원문제목」은 job_posts_pub 쪽 칸입니다 — job_posts 에는 「보여줄제목」 입니다.
   둘 다 받아 **가장 긴 것**으로 댑니다. 잘린 제목으로 대면 이 도구가 하려는 일을
   그대로 놓칩니다 (뿌리가 「잘린 제목」이니까요) */
const 원문 = new Map((await 전부('job_posts_pub?select=id,' + encodeURIComponent('원문제목')))
  .map((x) => [x.id, x['원문제목'] || '']));
const 보임 = new Set(원문.keys());
const 다 = await 전부('job_posts?select=id,source,org_name,title,job_group,apply_to,hidden,hold,'
  + 'admin_locked,' + encodeURIComponent('보여줄제목'));

const 볼것 = 다.filter((x) => 보임.has(x.id));
const 걸린것 = [];
for (const x of 볼것) {
  const 셋 = [원문.get(x.id) || '', x['보여줄제목'] || '', x.title || ''].map(String);
  const 제목 = 셋.sort((a, b) => b.length - a.length)[0];
  const m = 제목.match(HS_SKIP_RE);
  if (m) 걸린것.push({ ...x, 제목, 걸린말: m[0] });
}

console.log('회원 화면 ' + 볼것.length + '건 · **지금 제목**을 HS_SKIP_RE 에 다시 대 보니 '
  + 걸린것.length + '건이 걸립니다\n');
if (!걸린것.length) {
  console.log('○ 걸리는 것이 없습니다 — 회원 화면에 결과·안내 공고가 0건입니다');
  process.exit(0);
}
for (const x of 걸린것) {
  console.log('  ' + x.id.padEnd(16) + ' [' + String(x.source).padEnd(4) + '] '
    + String(x.org_name || '').slice(0, 14).padEnd(15)
    + ' 걸린말 「' + x.걸린말 + '」'
    + (x.admin_locked ? ' · **관리자 잠금**' : ''));
  console.log('      ' + x.제목.slice(0, 92));
  console.log('      직군 ' + (x.job_group || '(빈칸)') + ' · 마감 ' + (x.apply_to || '(비었음)'));
}
console.log('\n★ 아무것도 안 바꿨습니다. 숨기는 것은 승인 자리입니다 —');
console.log('  관리자 화면 → 공고 → 그 공고 → 「숨기기」');
