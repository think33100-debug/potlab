/* 탐색(메뉴) 데이터 — 한 자리 (2026-11-11).

   전에는 같은 네 길이 components/tab-bar.tsx 와 components/rapo/rapo-bottom-nav.tsx 에
   따로 적혀 있었습니다. 이제 둘 다 여기서 가져갑니다 — 길을 더하거나 바꾸면 한 번만 고칩니다.
   그리는 모양(옛 탭바 · 새 하단 탐색)은 각 컴포넌트가 정하고, **무슨 길이 있는지**만 여기 둡니다.

   앱의 뼈대라 DB 가 아니라 코드에 둡니다 — 여기를 바꾸면 라우팅도 같이 바뀝니다.
   icon 은 옛 탭바가 쓰는 Lucide 이름입니다 (components/icon.tsx).
   새 하단 탐색은 href 로 Figma 원본 아이콘을 고르고, 원본이 없는 길(담당자 메뉴)만 icon 을 씁니다. */
export type NavItem = { href: string; label: string; icon: string };

export const NAV_TABS: NavItem[] = [
  { href: '/',          label: '홈',       icon: 'house' },
  { href: '/jobs',      label: '공고',     icon: 'briefcase' },
  { href: '/community', label: '커뮤니티', icon: 'message-circle' },
  { href: '/me',        label: '내 정보',  icon: 'user-round' },
];

/* 「채용 관리」·「교육 관리」 는 **승인된 담당자와 마스터에게만** 붙습니다
   (2026-10-09). 값은 내관리메뉴() 창구가 줍니다 — 화면이 짐작하지 않습니다.
   링크를 숨기는 것은 길 안내일 뿐이고, 막는 자리는 DB 입니다. */
export function 관리길(관리: { 채용관리: boolean; 교육관리: boolean }): NavItem[] {
  const xs: NavItem[] = [];
  if (관리.채용관리) xs.push({ href: '/biz', label: '채용 관리', icon: 'building-2' });
  if (관리.교육관리) xs.push({ href: '/edu/manage', label: '교육 관리', icon: 'graduation-cap' });
  return xs;
}

/* 아래 탐색에 놓는 차례 — 담당자 길은 **「내 정보」 앞**에 끼웁니다 (내 정보는 늘 맨 오른쪽) */
export function 아래탐색(관리: { 채용관리: boolean; 교육관리: boolean }): NavItem[] {
  return [...NAV_TABS.slice(0, 3), ...관리길(관리), ...NAV_TABS.slice(3)];
}

export const 켜진길 = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

/* 새 디자인의 헤더·하단 탐색을 **스스로 그리는** 화면인가.
   그런 화면에서는 app/layout.tsx 의 옛 위쪽 줄과 옛 탭바를 그리지 않습니다
   (전에는 그려 놓고 CSS 로 가렸습니다 — components/chrome-switch.tsx).
   새 디자인을 다른 화면에 입히면 여기에 그 길을 더합니다. 한꺼번에 바꾸지 않습니다. */
export function 새틀화면(pathname: string): boolean {
  /* 공고 목록(/jobs)과 상세(/jobs/<번호>)는 2026-11-11 부터 새 틀입니다.
     상세는 원본대로 하단 탐색 없이 고정 행동(저장·지원)만 둡니다 (app/jobs/[id]/page.tsx).
     로그인(/login)도 같은 날부터 새 디자인 한 장(사진 로그인)이라 옛 위쪽 줄·탭바를 그리지 않습니다 */
  return pathname === '/' || pathname === '/jobs' || pathname.startsWith('/jobs/') || pathname === '/login'
    || pathname.startsWith('/design-preview');
}
