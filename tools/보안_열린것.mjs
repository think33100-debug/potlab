/* 「허용 목록 밖에 열린 것이 있나」 — **비로그인(anon)과 로그인(authenticated) 둘 다**
 * (2026-10-12 · 세중님 지시).
 *
 *   import { 열린것견주기, 허용목록읽기 } from './보안_열린것.mjs';
 *   const r = await 열린것견주기(cfg);
 *   // → { 비로그인: {열림:{함수,표}, 밖:[], 닫힘:[]}, 로그인: {…}, 못봄: [] }
 *
 * ── 왜 둘로 나누나 ───────────────────────────────────────────
 * 지금까지 점검은 **비로그인만** 물었습니다. 파일 머리글에도 그렇게 적혀 있습니다 —
 * 「비로그인(anon)에게 열어 두기로 **정한** 창구만 적습니다」.
 * 그래서 **로그인 회원이 무엇을 부를 수 있는지는 아무도 안 봤습니다.**
 *
 * 2026-10-12 에 그 구멍으로 넷이 드러났습니다 — `job_posts` 를 대량으로 고치는데
 * 열쇠도 `is_admin()` 도 없이 `authenticated` 에게 열려 있던 창구들입니다.
 *   fill_deadline_from_title · hide_closed_by_title · hide_backfill_nodate · 시험자료치우기
 * 비로그인 점검은 이것들을 **한 번도 보지 않았습니다** (anon 에는 안 열려 있었으니까요).
 *
 * ── 쓰는 곳 둘 ───────────────────────────────────────────────
 *   tools/보안_비로그인점검.mjs   GitHub 워크플로 anon-check.yml — 밖이 있으면 exit 1
 *   tools/hold-digest.mjs        서버 크론 08:00·15:00 — 밖이 있으면 **메일에 한 줄**
 * 셈은 여기 한 곳입니다 (지침 6절 — 기준은 한 자리).
 *
 * ── DB 쪽 ────────────────────────────────────────────────────
 * `열린창구_역할(p_역할 text)` 창구를 부릅니다. 아직 안 올라가 있으면
 * **조용히 「못 봄」으로** 돌려줍니다 — 점검이 그걸로 실패하지는 않게.
 * 옛 `열린창구()` 는 건드리지 않습니다 (인수가 다르면 새 함수이고 권한이
 * 기본값으로 돌아갑니다 · 지침 6-2).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
export const 목록파일 = path.join(여기, '공개허용목록.json');

/* 갈래마다 「왜 열어 두는지」 — `--처음` 일 때 파일에 들어갑니다.
   새로 열린 것은 갈래를 모르니 사람이 손으로 적어야 통과합니다 */
export const 왜 = {
  비회원화면: '비회원 화면이 씁니다 — 홈 · 공고 맛보기 · 교육 · 봉사 · 청년 · 커뮤니티 공개 보기',
  수집기창구: '수집기가 anon 열쇠 + p_secret 으로 돕니다 (tools/collect-*.mjs · 밤정리 · 재판정). '
            + '여기서 anon 을 걷으면 수집이 멈춥니다. 막는 자리는 p_secret 입니다',
  관리자창구: '관리자 화면이 로그인 상태로 부릅니다. 안에서 is_admin() 을 봅니다',
  회원창구:   '회원이 자기 것을 손보는 자리입니다. 안에서 auth.uid() 를 봅니다',
  순수계산:   '순수 계산 — 인수만 가공하고 표를 안 읽습니다',
  트리거:     '트리거 함수 — 직접 못 부릅니다 (PostgreSQL 이 막습니다)',
  검토:       '★ 닫아야 할 후보. 관리자·회원 자리인데 아무 검사 없이 열려 있습니다. '
            + '닫을 때 이 줄을 지웁니다',
};

export function 허용목록읽기() {
  if (!fs.existsSync(목록파일)) return null;
  const j = JSON.parse(fs.readFileSync(목록파일, 'utf8'));
  /* 옛 꼴(맨 위에 함수·표)은 **비로그인**으로 읽습니다 — 파일을 깨지 않게 */
  if (j['함수'] || j['표']) {
    return { ...j, 비로그인: { 함수: j['함수'] || [], 표: j['표'] || [] }, 로그인: j['로그인'] || null };
  }
  return j;
}

async function rpc(cfg, 이름, 몸) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(이름), {
    method: 'POST',
    headers: { apikey: cfg.SUPABASE_SERVICE_KEY,
      Authorization: 'Bearer ' + cfg.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json',
      /* ⚠ 헤더 값은 **latin-1** 입니다 — 한글을 넣으면 Node 의 fetch 가
         「Cannot convert argument to a ByteString」 로 죽습니다 (지침 12절·6-2b).
         2026-10-12 에 여기에 한글 파일 이름을 넣어 바로 밟았습니다 */
      'x-who': 'security-check tools/boan-yeollingeot' },
    body: JSON.stringify(몸 || {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + t.slice(0, 200));
  return t ? JSON.parse(t) : null;
}

/** 한 역할에 열린 것 */
export async function 역할로열린것(cfg, 역할) {
  try {
    return { 값: await rpc(cfg, '열린창구_역할', { p_역할: 역할 }) };
  } catch (e) {
    /* 창구가 아직 없으면 옛 창구로 — 그건 anon 만 봅니다 */
    if (역할 === 'anon') {
      try { return { 값: await rpc(cfg, '열린창구', {}), 옛창구: true }; } catch { /* 떨어집니다 */ }
    }
    return { 못봄: String(e.message || e).slice(0, 140) };
  }
}

const 이름들 = (x) => (x || []).map((y) => y['이름']);

/** 두 역할을 한 번에 견줍니다 */
export async function 열린것견주기(cfg) {
  const 허용 = 허용목록읽기();
  const 답 = { 못봄: [] };
  for (const [칸, 역할] of [['비로그인', 'anon'], ['로그인', 'authenticated']]) {
    const r = await 역할로열린것(cfg, 역할);
    if (r.못봄) { 답.못봄.push(칸 + ' — ' + r.못봄); 답[칸] = null; continue; }
    const 열림 = r.값 || {};
    const 지금함수 = 이름들(열림['함수']);
    const 지금표 = 이름들(열림['표']);
    const 칸허용 = (허용 && 허용[칸]) || null;
    답[칸] = {
      옛창구: !!r.옛창구,
      열림: { 함수: 지금함수.length, 표: 지금표.length },
      목록있나: !!칸허용,
      밖: 칸허용
        ? 지금함수.filter((n) => !이름들(칸허용['함수']).includes(n))
          .concat(지금표.filter((n) => !이름들(칸허용['표']).includes(n)))
        : [],
      닫힘: 칸허용
        ? 이름들(칸허용['함수']).filter((n) => !지금함수.includes(n))
          .concat(이름들(칸허용['표']).filter((n) => !지금표.includes(n)))
        : [],
      원본: 열림,
    };
  }
  답.밖합 = ['비로그인', '로그인'].reduce((a, k) => a + ((답[k] && 답[k].밖.length) || 0), 0);
  return 답;
}

/* ── 자기 점검 ─────────────────────────────────────────────── */
if (process.argv[1] && process.argv[1].endsWith('보안_열린것.mjs')) {
  const 어겼나 = [];
  const 봐 = (이름, 참) => { if (!참) 어겼나.push(이름); };
  const j = 허용목록읽기();
  봐('허용 목록 파일을 읽었습니다', !!j);
  if (j) {
    봐('비로그인 칸이 있습니다', Array.isArray(j.비로그인 && j.비로그인.함수));
    console.log('   비로그인 — 함수 ' + (j.비로그인.함수 || []).length
      + ' · 표 ' + (j.비로그인.표 || []).length);
    console.log('   로그인  — ' + (j.로그인 ? ('함수 ' + (j.로그인.함수 || []).length
      + ' · 표 ' + (j.로그인.표 || []).length) : '**아직 없습니다** (열린창구_역할 올린 뒤 --처음 으로 만듭니다)'));
  }
  봐('왜 에 관리자창구·회원창구 갈래가 있습니다', !!(왜.관리자창구 && 왜.회원창구));
  if (어겼나.length) { console.error('✗ ' + 어겼나.join(' · ')); process.exit(1); }
  console.log('○ 자기 점검 통과');
}
