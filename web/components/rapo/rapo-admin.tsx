'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RapoMaskIcon } from './rapo-ui';

/* 관리자 화면 틀 — 새 디자인 「16 · 관리자 운영 화면」 (2026-11-12 세중님 「관리자 페이지도 적용 시작」).
   원본: 「RAPO / 운영 / 공통 탐색」 1406:337 (왼쪽 204 · 흰 바탕 · 오른쪽 경계선) + 본문(neutral-50 · 32 여백).

   원본 메뉴는 일곱입니다 — 관리자 홈 · 공고 관리 · 회원 관리 · 통계 · 교육 관리 · 신고 관리 · 개인정보 요청.
   지금 관리자 화면은 그보다 많아서(수집기 상태 · 화면 글 · 쓰레기통 …) 운영이 멈추지 않게
   원본 일곱 아래 「그 밖의 도구」로 남깁니다. 원본에 없는 묶음이라 세중님이 정리하실 자리입니다.
   ⚠ 「개인정보 요청」은 같은 이름의 화면이 없어 가장 가까운 「개인정보 접속기록」(/admin/access)으로 잇습니다.
   ⚠ 원본의 교육·신고·개인정보 아이콘은 홈 아이콘을 자리표시로 쓰고 있어 그대로 따랐습니다.
   색은 원본 파일 변수(coral-50 #fff5f3 · coral-700 #b42a21 · navy #112231 · navy-600 #304f65 · neutral-50 #f6f8f9 · neutral-200 #dde4e6)
   값 그대로입니다 — 현행 토큰에 같은 이름이 없습니다 (커뮤니티 어둠 판과 같은 처리). */

type 메뉴 = { href: string; label: string; 그림?: 'home' | 'jobs' | 'me' | 'stats' };

export const 원본메뉴: 메뉴[] = [
  { href: '/admin', label: '관리자 홈', 그림: 'home' },
  { href: '/admin/jobs', label: '공고 관리', 그림: 'jobs' },
  { href: '/admin/members', label: '회원 관리', 그림: 'me' },
  { href: '/admin/stats', label: '통계', 그림: 'stats' },
  { href: '/admin/edu-orgs', label: '교육 관리', 그림: 'home' },
  { href: '/admin/reports', label: '신고 관리', 그림: 'home' },
  { href: '/admin/access', label: '개인정보 요청', 그림: 'home' },
];

export const 그밖도구: 메뉴[] = [
  { href: '/admin/beat', label: '수집기 상태' },
  { href: '/admin/blanks', label: '빈칸 공고' },
  { href: '/admin/hand', label: '손으로 확인할 곳' },
  { href: '/admin/trash', label: '쓰레기통' },
  { href: '/admin/boost', label: '추천 올린 공고' },
  { href: '/admin/compete', label: '경쟁률' },
  { href: '/admin/posts', label: '커뮤니티 글' },
  { href: '/admin/ops', label: '운영진 글' },
  { href: '/admin/inquiries', label: '문의' },
  { href: '/admin/partners', label: '담당자 승인' },
  { href: '/admin/verify', label: '재직 확인' },
  { href: '/admin/staff', label: '직원과 권한' },
  { href: '/admin/home-blocks', label: '홈 꾸미기' },
  /* 로그인 사진 간격도 여기서 고칩니다 (로그인 칸 · 2026-11-12) */
  { href: '/admin/texts', label: '화면 글' },
  { href: '/admin/icons', label: '아이콘' },
  { href: '/admin/ads', label: '오픈 화면 광고' },
  { href: '/admin/rival', label: '경쟁사 비교' },
  { href: '/admin/reset', label: '내 계정 초기화' },
];

const 아이콘 = {
  home: { src: '/rapo/home/nav-home.svg', w: 18, h: 18 },
  jobs: { src: '/rapo/home/nav-jobs.svg', w: 18, h: 17 },
  me:   { src: '/rapo/home/nav-me.svg',   w: 16, h: 18 },
} as const;

const 켜졌나 = (path: string, href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/'));

/* 원본 「RAPO / 운영 / 통계 아이콘」 1406:307 — 막대 셋 */
function 통계그림() {
  return (
    <span aria-hidden className="relative block size-[20px] shrink-0">
      <span className="absolute left-[2px] top-[10px] h-[8px] w-[4px] rounded-[1px] bg-current" />
      <span className="absolute left-[8px] top-[3px] h-[15px] w-[4px] rounded-[1px] bg-current" />
      <span className="absolute left-[14px] top-[7px] h-[11px] w-[4px] rounded-[1px] bg-current" />
    </span>
  );
}

/* 원본 「RAPO / 운영 / 메뉴 / …」 172×44 · 왼쪽 14 · 사이 15 · t4 Bold. 켜지면 coral-50 바탕 · coral-700 글씨 */
function 메뉴줄({ m, 켜짐 }: { m: 메뉴; 켜짐: boolean }) {
  return (
    <Link href={m.href} aria-current={켜짐 ? 'page' : undefined}
      className={'rapo-type-t4-bold flex h-[44px] w-full items-center gap-[15px] rounded-(--rapo-radius-r2) pl-[14px] '
        + (켜짐 ? 'bg-[#fff5f3] text-[#b42a21]'
          : 'text-[#112231] hover:bg-[#f6f8f9]')}>
      <span className="flex size-[20px] shrink-0 items-center justify-center">
        {m.그림 === 'stats' ? <통계그림 /> : m.그림 ? <RapoMaskIcon {...아이콘[m.그림]} /> : null}
      </span>
      {m.label}
    </Link>
  );
}

export function RapoAdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div data-rapo className="min-h-dvh bg-[#f6f8f9] text-[#112231] md:flex">
      <aside className="shrink-0 border-b border-[#dde4e6] bg-white md:sticky md:top-0 md:h-dvh md:w-[204px] md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center gap-(--rapo-dimension-x2) px-[20px] pb-[20px] pt-[30px]">
          <Link href="/" aria-label="RAPO 홈" className="flex h-[27.7px] w-[105.6px] shrink-0 items-center gap-[8px]">
            {/* eslint-disable @next/next/no-img-element -- Figma 원본 SVG 그대로 (가로형 105.6 × 27.7) */}
            <img src="/rapo/home/logo-symbol.svg" alt="" className="h-[27.7px] w-[28.4px] shrink-0" />
            <img src="/rapo/home/logo-wordmark.svg" alt="" className="h-[14px] w-auto min-w-0" />
            {/* eslint-enable @next/next/no-img-element */}
          </Link>
          <span className="rapo-type-t4-bold text-[#304f65]">관리자</span>
        </div>
        <div aria-hidden className="mx-[20px] h-px bg-[#dde4e6]" />
        <nav aria-label="관리자 메뉴" className="flex flex-col gap-[6px] px-[16px] py-[24px]">
          {원본메뉴.map((m) => <메뉴줄 key={m.href} m={m} 켜짐={켜졌나(path, m.href)} />)}
          <details className="mt-(--rapo-dimension-x4)" open={그밖도구.some((m) => 켜졌나(path, m.href))}>
            <summary className="rapo-type-t3-bold cursor-pointer list-none px-[14px] py-(--rapo-dimension-x2) text-[#304f65]">
              그 밖의 도구 ▾
            </summary>
            <div className="flex flex-col gap-[2px]">
              {그밖도구.map((m) => <메뉴줄 key={m.href} m={m} 켜짐={켜졌나(path, m.href)} />)}
            </div>
          </details>
        </nav>
      </aside>
      <div className="min-w-0 flex-1 p-(--rapo-dimension-x5) md:p-[32px]">{children}</div>
    </div>
  );
}

/* 화면 머리 — 원본 「화면 헤더」: 제목 t12 Bold + 오른쪽 도구 */
export function RapoAdminHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-[32px] flex flex-wrap items-center justify-between gap-(--rapo-dimension-x4)">
      <h1 className="rapo-type-t12-bold text-[#112231]">{title}</h1>
      {children}
    </div>
  );
}
