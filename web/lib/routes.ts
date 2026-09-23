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
