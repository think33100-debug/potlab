'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* 아래 탭바. 앱의 뼈대라 DB 가 아니라 코드에 둡니다 —
   여기를 바꾸면 라우팅도 같이 바뀝니다.

   휴대폰에서만 보입니다. 데스크톱은 위쪽 줄로 충분하고,
   넓은 화면 아래에 띠가 붙어 있으면 어색합니다. */
const TABS = [
  { href: '/',          label: '홈',       emoji: '🏠' },
  { href: '/jobs',      label: '공고',     emoji: '📋' },
  { href: '/community', label: '커뮤니티', emoji: '💬' },
  { href: '/me',        label: '내 정보',  emoji: '🙂' },
];

/* 가입을 마치기 전에는 다른 화면으로 못 갑니다 (SignupGuard).
   그런데 탭은 그대로 보여서, 누르면 넘어갔다가 곧바로 가입 화면으로 튕겨
   돌아옵니다 — 버벅거리는 것처럼 보이고, 채우던 자리도 잃습니다.
   갈 수 없는 길은 아예 안 보여줍니다. */
const HIDE_NAV = ['/welcome'];
const hideNav = (path: string) => HIDE_NAV.includes(path);

export function TabBar() {
  const pathname = usePathname();

  const on = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (hideNav(pathname)) return null;

  return (
    <nav
      aria-label="아래 탭"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white md:hidden dark:border-gray-800 dark:bg-gray-900"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              aria-current={on(t.href) ? 'page' : undefined}
              className={
                'flex flex-col items-center gap-1 py-4 ' +
                (on(t.href) ? 'text-teal-strong' : 'text-gray-400')
              }
            >
              <span className="text-body-lg leading-none" aria-hidden>{t.emoji}</span>
              {/* text-xs 는 10px 오버라인 라벨용이라 탭 이름에는 너무 작습니다.
                  글자를 키우는 설정을 쓰는 분이 있어 줄바꿈과 자간도 막아둡니다 */}
              <span className="text-sm leading-normal font-medium tracking-normal whitespace-nowrap">
                {t.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* 데스크톱 위쪽 줄에 놓는 같은 길들 */
export function TopNav() {
  const pathname = usePathname();
  const on = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  if (hideNav(pathname)) return null;

  return (
    <nav className="hidden items-center gap-6 md:flex" aria-label="위쪽 길">
      {TABS.slice(1, 3).map((t) => (
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
        </Link>
      ))}
    </nav>
  );
}
