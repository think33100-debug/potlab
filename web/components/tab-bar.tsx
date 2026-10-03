'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/icon';

/* 아래 탭바. 앱의 뼈대라 DB 가 아니라 코드에 둡니다 —
   여기를 바꾸면 라우팅도 같이 바뀝니다.

   휴대폰에서만 보입니다. 데스크톱은 위쪽 줄로 충분하고,
   넓은 화면 아래에 띠가 붙어 있으면 어색합니다. */
/* 아이콘 이름은 Lucide 이름을 그대로 씁니다 (components/icon.tsx) */
const TABS = [
  { href: '/',          label: '홈',       icon: 'house' },
  { href: '/jobs',      label: '공고',     icon: 'briefcase' },
  { href: '/community', label: '커뮤니티', icon: 'message-circle' },
  { href: '/me',        label: '내 정보',  icon: 'user-round' },
];

export function TabBar() {
  const pathname = usePathname();

  const on = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

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
              /* ★ 2026-10-03 — 어두운 구역에 dark: 짝을 달았습니다.
                 커뮤니티(어두운 바탕)에서 눌린 탭이 teal-strong(oklch 0.378 ·
                 어두운 청록)이라 잉크색 바탕에서 **1.8:1** 로 안 보였습니다.
                 위쪽 길(TopNav)은 처음부터 dark:text-white 짝이 있었는데
                 아래 탭바만 빠져 있었습니다. 같은 방식으로 맞춥니다.
                 안 눌린 탭도 mute(#5F666C)가 어두운 바탕에서 안 보여
                 gray-400 으로 올립니다 — 어두운 구역 전용 값입니다. */
              className={
                'flex flex-col items-center gap-1 py-4 ' +
                (on(t.href)
                  ? 'text-teal-strong dark:text-white'
                  : 'text-mute dark:text-gray-400')
              }
            >
              <Icon name={t.icon} size={20} />
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
