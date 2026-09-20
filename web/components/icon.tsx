/* 라인 아이콘. 이모지는 안 씁니다 —
   teamsparta.md 「대시보드 chrome 아이콘으로 이모지를 사용하지 않는다.
   Lucide/Heroicons 계열의 1.5px outline 을 기준으로 하며,
   filled 와 outline 을 같은 표면에서 섞지 않는다」.

   이름은 Lucide 이름을 그대로 씁니다. 자체 이름을 지으면 나중에
   무슨 아이콘인지 못 찾습니다. 관리자가 DB(home_blocks.icon)에 이 이름을 적고
   코드가 이름으로 꺼내 씁니다.

   ponytail: lucide-react(1,500개)를 통째로 들이지 않습니다. 쓰는 게 열 개 남짓이라
   path 만 옮겨 적는 게 가볍습니다. 서른 개를 넘어가면 그때 라이브러리로 갑니다. */

/* 이름 → path. 전부 24×24, stroke 기준입니다 (fill 없음) */
const PATHS: Record<string, string> = {
  /* 카테고리 */
  briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M18 12h.01',
  'message-circle': 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
  'book-open': 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',

  /* 탭바 */
  house: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  'user-round': 'M18 20a6 6 0 0 0-12 0M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',

  /* 그 밖 */
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z',
  check: 'm5 12 5 5L20 7',
  x: 'M18 6 6 18M6 6l12 12',
  flame: 'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7Z',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'trending-up': 'M16 7h6v6M22 7l-8.5 8.5-5-5L2 17',
  'bar-chart': 'M12 20V10M18 20V4M6 20v-4',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  calculator: 'M4 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01',
  share: 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13',
  search: 'm21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z',
  'git-compare': 'M5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 9v6a3 3 0 0 0 3 3h3M19 15V9a3 3 0 0 0-3-3h-3M13 3l-2 3 2 3M11 15l2 3-2 3',
  'map-pin': 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'log-in': 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  'user-plus': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6',
  users: 'M18 21a6 6 0 0 0-12 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21a5 5 0 0 0-4-4.9M17 3.1a5 5 0 0 1 0 9.8',

  /* 바쁨 세 칸 (2026-09-20) — 채워서 쓰므로 닫힌 모양이어야 합니다.
     열린 선으로 만들면 fill 을 줬을 때 엉뚱한 덩어리가 됩니다 */
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z',
  circle: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
  /* 「중간」 — 채웠을 때 = 처럼 보이는 막대 둘. 동그라미는 뜻이 안 읽힙니다 */
  equal: 'M5 9.2h14v2.6H5ZM5 14.2h14v2.6H5Z',
  /* 공고 상세 (2026-09-20) */
  bookmark: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z',
  'bookmark-filled': 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z',
  'chevron-left': 'm15 18-6-6 6-6',
  'arrow-up-right': 'M7 7h10v10M7 17 17 7',
  'bed-double': 'M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 17h20M6 10V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3',
  stethoscope: 'M11 2v2a4 4 0 0 1-8 0V2M7 8v3a6 6 0 0 0 12 0V9M19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM13 17a3 3 0 1 0 6 0v-3',
  paperclip: 'M13.2 6.6 7 12.8a2.8 2.8 0 0 0 4 4l7.5-7.5a5 5 0 0 0-7-7L4 9.8a7 7 0 0 0 10 10L20 14',
  'list-checks': 'm3 5 2 2 3-3M3 13l2 2 3-3M3 21l2 2 3-3M13 6h8M13 14h8M13 22h8',
  info: 'M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  'graduation-cap': 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
  /* 이름이 없을 때 떨어지는 자리. 화면이 안 깨지게 점 하나를 그립니다 */
  dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name, size = 24, className = '', stroke = 1.5, filled = false,
}: {
  name: string | null | undefined; size?: number; className?: string;
  stroke?: number; filled?: boolean;
}) {
  /* 관리자가 오타를 내도 404 가 아니라 기본 아이콘이 나옵니다 */
  const d = (name && PATHS[name]) || PATHS.dot;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/* 관리자 화면에서 고를 수 있게 목록을 내줍니다 */
export const ICON_NAMES = Object.keys(PATHS).filter((n) => n !== 'dot');
