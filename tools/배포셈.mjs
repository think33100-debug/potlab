/* 하루 배포 수를 셉니다 — 한도 100 에 얼마나 썼나 (2026-10-28 세중님 1번)
 *
 *   node tools/배포셈.mjs            어제·오늘 한 줄
 *   node tools/배포셈.mjs --어제      아침 메일이 쓰는 그 한 줄만
 *
 * ── 왜 ──────────────────────────────────────────────────────
 * 2026-10-28 에 **하루 한도 100 을 넘겨** 배포가 24시간 막혔습니다 (지침 8-25).
 * 막히면 **고친 화면이 회원에게 안 갑니다** — 그런데 아무도 안 알려 줍니다.
 * 그래서 보이는 자리에 숫자를 둡니다.
 *
 * ── ★ 이 숫자는 **Vercel 이 준 것이 아닙니다** ───────────────
 * Vercel 수를 읽으려면 열쇠가 필요해서, 여기서는 **밀기를 커밋 수로 어림**합니다 —
 * Vercel 은 **밀 때마다** 배포를 하나 만들고(무엇이 바뀌었든), 우리는 지금까지
 * **커밋마다 밀었기** 때문에 커밋 수 ≈ 배포 수입니다.
 * 묶어 밀기(지침 8-25)를 지키면 **커밋 수 > 배포 수**가 되어 이 어림이 **넉넉한 쪽**으로
 * 틀립니다 — 경보가 늦게 울리지 않고 **일찍** 울립니다. 그 방향이 맞습니다.
 *
 * ── 막혔나는 **참 값**으로 봅니다 ───────────────────────────
 * GitHub 커밋 상태에 Vercel 이 적습니다. 열쇠 없이 읽힙니다 —
 *   https://api.github.com/repos/<주인>/<저장소>/commits/<가지>/status
 * 거기 「Deployment rate limited」가 있으면 **지금 막혀 있는 것**입니다.
 */
import { spawnSync } from 'node:child_process';

const 한도 = 100;        /* Hobby — vercel.com/docs/limits (2026-09-16 판) */
const 어제만 = process.argv.includes('--어제');

function git(...인수) {
  const r = spawnSync('git', 인수, { encoding: 'utf8', maxBuffer: 1 << 24 });
  return (r.stdout || '').trim();
}

/** KST 로 N일 전 0시 ~ 24시 */
function 날범위(며칠전) {
  const 이제 = new Date(Date.now() + 9 * 3600e3);
  const 날 = new Date(이제.getTime() - 며칠전 * 86400e3);
  const d = 날.toISOString().slice(0, 10);
  return { 날: d, 부터: d + ' 00:00:00 +0900', 까지: d + ' 23:59:59 +0900' };
}

function 가지들() {
  return git('for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin')
    .split('\n').map((s) => s.replace(/^origin\//, '')).filter((s) => s && s !== 'HEAD');
}

export function 배포셈(며칠전 = 1) {
  const r = 날범위(며칠전);
  const 센다 = (가지) => {
    const n = git('rev-list', '--count', `--since=${r.부터}`, `--until=${r.까지}`,
      `origin/${가지}`);
    return Number(n) || 0;
  };
  const 모든가지 = 가지들();
  const 운영 = 센다('main');
  const 미리 = 모든가지.filter((b) => b !== 'main')
    .reduce((합, b) => {
      /* 가지는 main 을 품습니다 — **main 에 없는 커밋만** 셉니다 (안 그러면 부풀어 있습니다) */
      const n = git('rev-list', '--count', `--since=${r.부터}`, `--until=${r.까지}`,
        `origin/${b}`, '^origin/main');
      return 합 + (Number(n) || 0);
    }, 0);
  return { 날: r.날, 운영, 미리, 합: 운영 + 미리, 한도 };
}

/** GitHub 커밋 상태로 **지금 막혀 있나** — 열쇠 없이 (참 값) */
export async function 막혔나() {
  const 주소 = git('remote', 'get-url', 'origin')
    .replace(/^git@github\.com:/, '').replace(/^https:\/\/github\.com\//, '')
    .replace(/\.git$/, '');
  if (!주소.includes('/')) return { 됨: false, 왜: 'origin 주소를 못 읽었습니다' };
  try {
    const res = await fetch(`https://api.github.com/repos/${주소}/commits/main/status`,
      { signal: AbortSignal.timeout(15000),
        headers: { 'user-agent': 'potjob-check', accept: 'application/vnd.github+json' } });
    if (!res.ok) return { 됨: false, 왜: 'GitHub ' + res.status };
    const j = await res.json();
    const 벌 = (j.statuses || []).filter((x) => /vercel/i.test(x.context || ''));
    const 한도말 = 벌.find((x) => /rate limited/i.test(x.description || ''));
    return { 됨: true, 막힘: !!한도말, 글: 한도말 ? 한도말.description : (벌[0]?.description || ''),
      state: j.state, 때: 한도말?.created_at || 벌[0]?.created_at || '' };
  } catch (e) { return { 됨: false, 왜: String(e.message || e).slice(0, 60) }; }
}

export function 한줄(어제, 막힘) {
  const 쓴것 = 어제.합;
  const 표 = 쓴것 + '/' + 어제.한도;
  const 꼴 = 쓴것 >= 한도 ? '  ← **한도를 넘겼습니다**'
    : 쓴것 >= 한도 * 0.7 ? '  ← 한도에 가깝습니다' : '  ✓';
  return '어제 배포(밀기로 어림) ' + 표 + 꼴
    + '   (운영 ' + 어제.운영 + ' · 미리보기 ' + 어제.미리 + ' — 아직 안 합친 가지만)'
    + (막힘 ? '   ★ **지금 막혀 있습니다** — ' + 막힘 : '');
}

if (!process.argv.includes('--들여오기만')) {
  const 어제 = 배포셈(1);
  const 오늘 = 배포셈(0);
  const m = await 막혔나();
  const 막힘 = m.됨 && m.막힘 ? m.글 + (m.때 ? ' (' + m.때 + ')' : '') : null;
  if (어제만) { console.log(한줄(어제, 막힘)); process.exit(0); }
  console.log('한도 — Hobby 하루 ' + 한도 + '번 (vercel.com/docs/limits)');
  console.log('어제 ' + 어제.날 + ' — 합 ' + 어제.합 + '/' + 한도
    + ' (운영 ' + 어제.운영 + ' · 미리보기 ' + 어제.미리 + ')');
  console.log('오늘 ' + 오늘.날 + ' — 합 ' + 오늘.합 + '/' + 한도
    + ' (운영 ' + 오늘.운영 + ' · 미리보기 ' + 오늘.미리 + ')');
  console.log('지금 막혀 있나 — ' + (m.됨 ? (m.막힘 ? '★ 막혀 있습니다 — ' + m.글
    + (m.때 ? ' (' + m.때 + ')' : '') : '아니요 (Vercel 상태 ' + (m.state || '?') + ')')
    : '못 봤습니다 — ' + m.왜));
  console.log('\n── 아침 메일에 들어갈 줄 ──\n  ' + 한줄(어제, 막힘));
}
