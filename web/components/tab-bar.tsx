'use client';

import { 가는중 } from '@/components/가는중';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { isDark } from '@/app/surface';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { NAV_TABS, 관리길, 새틀화면 } from '@/lib/nav';

/* 아래 탭바.

   휴대폰에서만 보입니다. 데스크톱은 위쪽 줄로 충분하고,
   넓은 화면 아래에 띠가 붙어 있으면 어색합니다.

   ★ 2026-11-11 — 무슨 길이 있는지(네 탭 · 담당자 길 · 차례)는 lib/nav.ts 한 자리로 옮겼습니다.
     새 디자인의 하단 탐색(components/rapo/rapo-bottom-nav.tsx)도 같은 것을 씁니다.
     새 디자인 화면(홈)에서는 이 탭바를 그리지 않습니다 — 그 화면이 자기 탐색을 그립니다 */
const TABS = NAV_TABS;

export function TabBar() {
  const pathname = usePathname();

  if (새틀화면(pathname)) return null;

  /* ★ 2026-11-12 밤 근무 — 아직 옛 모양인 화면들도 **아래 탐색만은 새 디자인**(RapoBottomNav)으로 그립니다.
     화면마다 탭 모양이 달라 보이지 않게 하려는 것입니다. 휴대폰에서만(전과 같음) · 어두운 화면(커뮤니티 방 등)은 어두운 판.
     길(탭 · 담당자 메뉴 · 차례)은 전과 같이 lib/nav.ts 한 자리입니다 */
  return (
    <div className="md:hidden">
      <RapoBottomNav dark={isDark(pathname)} />
    </div>
  );
}

/* 데스크톱 위쪽 줄에 놓는 같은 길들 */
export function TopNav() {
  const pathname = usePathname();
  const { 관리 } = useAuth();
  const on = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="hidden items-center gap-6 md:flex" aria-label="위쪽 길">
      {[...TABS.slice(1, 3), ...관리길(관리)].map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={on(t.href) ? 'page' : undefined}
          className={
            'text-lg font-medium ' +
            (on(t.href)
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white')
          }
        >
          {t.label}
          <가는중 />
        </Link>
      ))}
    </nav>
  );
}
