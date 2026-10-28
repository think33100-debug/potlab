/* 홈의 배너·카테고리가 갈 수 있는 곳입니다.

   왜 DB 가 아니라 코드에 두는가 — 주소를 바꾸면 그 화면도 만들어야 합니다.
   DB 에 아무 주소나 넣을 수 있게 하면 없는 화면으로 보내 404 가 납니다.
   그래서 관리자 화면은 여기 있는 것 중에서만 고르게 합니다.

   화면이 생기면 soon 을 실제 주소로 바꾸면 됩니다 — 그 한 줄만요. */

export const ROUTES: { href: string; label: string; soon?: string }[] = [
  { href: '/',                   label: '홈' },
  { href: '/jobs',               label: '채용공고' },
  { href: '/jobs?sort=deadline', label: '채용공고 · 마감 임박' },
  { href: '/community',          label: '커뮤니티' },
  { href: '/pay',                label: '월급 확인' },
  { href: '/spec',               label: '스펙쌓기' },
  { href: '/orgs',               label: '병원정보 찾기' },
  { href: '/volunteer',          label: '봉사활동 찾기' },
  { href: '/edu',                label: '교육·학술' },
  { href: '/edu/org',            label: '교육기관' },
  { href: '/youth',              label: '청년정책 찾기' },
  /* 경쟁률 찾아보기 (2026-10-05). 목록은 누구나, 숫자는 회원만입니다 */
  { href: '/compete',            label: '경쟁률 찾아보기' },
  { href: '/tools',              label: '계산기' },
];

const BY_HREF = Object.fromEntries(ROUTES.map((r) => [r.href, r]));

/* 아직 화면이 없는 곳은 「곧 찾아올게요」로 돌립니다 */
export function safeHref(href: string | null | undefined): string {
  if (!href) return '/';
  const r = BY_HREF[href];
  if (!r) return '/';              // 목록에 없는 주소는 홈으로
  return r.soon ? `/soon?what=${r.soon}` : r.href;
}

/* ── 「딱 넘어가게」 미리 받을 여섯 (2026-10-29 세중님) ─────────────
 *
 * 세중님 말 — 「회색 뼈대 싫음 · 월급확인처럼 딱 넘어가게」.
 * `/pay`·`/spec` 은 **정적**이라 Next 가 쪽을 통째로(데이터까지) 미리 받습니다.
 * 아래 여섯은 `dynamic = 'force-dynamic'` 이라 기본값(`auto`)으로는
 * **`loading.js` 까지만** 받습니다 — 그게 어제의 회색 뼈대입니다.
 *
 * 공식 문서 (node_modules/next/dist/docs · Next 16.3.5) —
 *   `<Link prefetch>` 의 **`true`** — "The full route is prefetched for both
 *   **static and dynamic** routes."
 *   기본값 `auto` — "For dynamic routes, the partial route down to the nearest
 *   segment with a `loading.js` boundary will be prefetched."
 *
 * ★ 왜 여섯만인가 — 미리 받기는 **서버를 한 번 더 돌립니다**. 문서 그대로 —
 *   "If a page accesses non-static data like cookies or headers, it's prefetched
 *    at runtime with a fresh server render, which costs server CPU per page view."
 *   그래서 **세중님이 꼽은 여섯**에만 걸고, 나머지는 기본값으로 둡니다.
 * ★ 쓰는 시간은 `next.config` 의 `experimental.staleTimes.static` 입니다
 *   (prefetch={true} 는 **static 쪽** 값을 씁니다 · 기본 5분 → 우리는 **30초**).
 */
export const 미리받을곳 = [
  '/jobs',       /* 채용공고 */
  '/community',  /* 커뮤니티 */
  '/orgs',       /* 병원정보 찾기 */
  '/edu',        /* 교육·학술 */
  '/youth',      /* 청년정책 */
  '/compete',    /* 경쟁률 */
];

/** 이 주소를 **데이터까지** 미리 받을까 — `<Link prefetch={…}>` 에 넣는 값 */
export function 미리받기(href: string | null | undefined): true | undefined {
  if (!href) return undefined;
  /* `safeHref` 를 거친 뒤의 주소로 견줍니다 (「곧 찾아올게요」로 돌려진 것은 안 받습니다) */
  return 미리받을곳.includes(safeHref(href)) ? true : undefined;
}
