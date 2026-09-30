/* robots.txt 를 제대로 읽습니다 (2026-09-30).
 *
 *   import { robots읽기, 가도되나 } from './robots.mjs';
 *   const r = robots읽기(글);
 *   가도되나(r, '/portal/bbs/list')   → { 됨: true, 왜: 'Allow: /portal' }
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 지자체 게시판 조사에서 다섯 곳을 「robots 가 전체를 막았습니다」 로 적었는데
 * **넷이 틀렸습니다** (2026-09-30). 제가 두 가지를 빠뜨렸습니다 —
 *
 *   ① 주석(#)을 안 걸렀습니다
 *      고흥군은 규칙이 전부 # 으로 막혀 있어 **규칙이 하나도 없는** 것인데
 *      「전체 금지」 로 읽었습니다
 *   ② Allow 를 안 봤습니다
 *      정선군은  DisAllow: /  ·  Allow: /portal  입니다.
 *      /portal 은 **가도 됩니다**
 *
 * ── 규칙 ─────────────────────────────────────────────────────
 * · `User-agent: *` 묶음만 봅니다. 우리를 가리키는 이름이 없으면 * 를 따릅니다
 * · `*` 묶음이 아예 없으면 **가도 됩니다** (김포시·익산시가 그렇습니다)
 * · Allow 와 Disallow 가 겹치면 **더 긴 쪽이 이깁니다** (표준)
 * · 길이가 같으면 Allow 가 이깁니다
 * · `$` 는 끝맞춤, `*` 는 아무 글자로 봅니다
 */

/** robots.txt 글 → { 있나, 허용:[], 금지:[] } */
export function robots읽기(글) {
  const 줄들 = String(글 || '').split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())      /* ① 주석을 먼저 지웁니다 */
    .filter(Boolean);

  let 안에있나 = false, 별묶음있나 = false;
  const 허용 = [], 금지 = [];
  let 앞줄이이름 = false;

  for (const l of 줄들) {
    const m = l.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const 칸 = m[1].toLowerCase(), 값 = m[2].trim();
    if (칸 === 'user-agent') {
      /* 이름이 잇달아 나오면 한 묶음입니다 */
      if (!앞줄이이름) 안에있나 = false;
      if (값 === '*') { 안에있나 = true; 별묶음있나 = true; }
      앞줄이이름 = true;
      continue;
    }
    앞줄이이름 = false;
    if (!안에있나) continue;
    if (칸 === 'allow' && 값) 허용.push(값);
    if (칸 === 'disallow') { if (값) 금지.push(값); }
  }
  return { 있나: 별묶음있나, 허용, 금지 };
}

const 맞나 = (틀, 길) => {
  const re = new RegExp('^' + 틀.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\\\$$/, '$'));
  return re.test(길);
};

/** 그 길로 가도 되나 */
export function 가도되나(r, 길) {
  const p = String(길 || '/');
  if (!r.있나) return { 됨: true, 왜: 'robots.txt 에 모두를 가리키는 규칙이 없습니다' };
  let 긴허용 = '', 긴금지 = '';
  for (const a of r.허용) if (맞나(a, p) && a.length > 긴허용.length) 긴허용 = a;
  for (const d of r.금지) if (맞나(d, p) && d.length > 긴금지.length) 긴금지 = d;
  if (!긴금지) return { 됨: true, 왜: '막는 규칙이 없습니다' };
  if (긴허용.length >= 긴금지.length) return { 됨: true, 왜: 'Allow: ' + 긴허용 + ' 가 Disallow: ' + 긴금지 + ' 보다 깁니다' };
  return { 됨: false, 왜: 'Disallow: ' + 긴금지 };
}

/* ── 스스로 하는 검사 — 2026-09-30 에 실제로 받은 robots.txt 다섯 개 ── */
if (process.argv[1] && process.argv[1].endsWith('robots.mjs')) {
  const 시험 = [
    ['달서구 (진짜 전체 금지)',
      'User-agent: *\nDisallow: /', '/pages/board/list.do', false],
    ['김포시 (* 묶음이 없음)',
      'User-agent: Googlebot\nUser-agent: Yeti\nUser-agent: Daumoa\n'
      + 'Disallow: /portal/downloadBbsFile\nDisallow: /DATA/', '/portal/selectBbsNttList.do', true],
    ['익산시 (이름별 Allow 만)',
      'User-agent: Googlebot\nAllow: /\n\nUser-agent: Yeti\nAllow: /', '/index.iksan', true],
    ['고흥군 (규칙이 전부 주석)',
      '#User-Agent : *\n#Disallow : /\n#User-Agent : Googlebot\n#Allow : /', '/board/list.goheung', true],
    ['정선군 (Disallow: / 인데 Allow: /portal)',
      'User-agent: *\nDisAllow: /\nAllow: /$\nAllow: /portal\nAllow: /tour\nDisAllow: /search',
      '/portal/bbs/list/B0000030.do', true],
    ['정선군 · 막힌 길',
      'User-agent: *\nDisAllow: /\nAllow: /$\nAllow: /portal\nDisAllow: /search', '/search/x', false],
  ];
  let 틀림 = 0;
  for (const [이름, 글, 길, 바란것] of 시험) {
    const r = robots읽기(글);
    const g = 가도되나(r, 길);
    const ok = g.됨 === 바란것;
    if (!ok) 틀림++;
    console.log((ok ? '○ ' : '★ ') + 이름.padEnd(32)
      + (g.됨 ? '가도 됨' : '막힘  ').padEnd(10) + g.왜);
  }
  console.log(틀림 ? '\n★ ' + 틀림 + '개 틀렸습니다' : '\n○ 다 맞습니다');
  process.exit(틀림 ? 1 : 0);
}
