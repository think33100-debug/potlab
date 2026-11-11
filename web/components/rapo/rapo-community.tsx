import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/avatar';
import { shownName } from '@/lib/who';
import { RapoMaskIcon } from './rapo-ui';

/* 커뮤니티 — 새 디자인 「U06-01 · 커뮤니티 피드」 조각 (2026-11-11 밤 · 대표: 피그마 우선).
   원본: 08 · C 커뮤니티와 병원 탐색 → 「커뮤니티 피드」 1328:2659 (공개 피드 상단 1299:878 ·
   공개 글 · 읽기 목록 1266:1947 · 댓글 미리보기 1266:1942 · 글쓰기 1266:1960 · 하단 탐색 · 커뮤니티 1264:61).

   ★ 색 — 커뮤니티는 어두운 화면이고 원본이 토큰이 아닌 색값을 씁니다(현행 토큰에 같은 값이 없음).
     그래서 아래 「어둠」 한 자리에 원본 값 그대로 모읍니다. 토큰이 생기면 여기만 바꿉니다.
   ★ 이 파일은 'use client' 가 없습니다 — 서버 화면이 그대로 씁니다(지난때 등). */

export const 어둠 = {
  바탕: '#112332',        // U06-01 바탕
  면: '#1d3445',          // 공지 · 댓글 미리보기
  선: '#365063',          // RAPO / Divider / 다크 / 선
  글: '#f6f8fa',          // 제목 · 이름
  흐린글: '#afbfca',      // 본문 · 직군과 시간
  밑줄: '#ffa691',        // 고른 탭 · 공지 아이콘
  아래탐색: '#0d1d29',    // 하단 탐색 · 커뮤니티
  아래글: '#b7c6d1',      // 꺼진 탭 이름
  쓰기: '#d8372b',        // 글쓰기 단추 (= bg/deep-coral)
} as const;

/* 「3분 전」 — 원본 「작업치료사 · 3분 전」 꼴 */
export function 지난때(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 604800) return Math.floor(s / 86400) + '일 전';
  return iso.slice(0, 10).replaceAll('-', '.');
}

export const 직군탭 = ['전체', '작업치료사', '물리치료사'] as const;
export type 직군탭값 = (typeof 직군탭)[number];

/* 상단 — 「커뮤니티」 제목 · 직군 탭 · 이용 안내 · 「○○ 게시글」과 정렬.
   「병원 찾기」는 지금 있는 기관 찾기(/orgs)로 잇습니다 */
export function RapoCommunityTop({ 탭, 정렬, 주소 }: {
  탭: 직군탭값; 정렬: 'new' | 'hot'; 주소: (탭: 직군탭값, 정렬: 'new' | 'hot') => string;
}) {
  return (
    <header className="flex flex-col">
      <div className="flex h-[56px] items-center px-[22px]">
        <h1 className="min-w-0 flex-1 text-[21px] font-bold leading-[30px]" style={{ color: 어둠.글 }}>커뮤니티</h1>
        {/* 병원 찾기 (원본 1266:1973) — 지금 있는 기관 찾기(/orgs)로 갑니다. 그 화면 안쪽은 아직 전 모양 (2026-11-12 밤 근무) */}
        <Link href="/orgs" className="flex h-[34px] items-center gap-[7px] rounded-[17px] px-[12px] text-[14px] font-bold leading-[20px]" style={{ background: 어둠.면, color: 어둠.글 }}>
          <RapoMaskIcon src="/rapo/list/search-20.svg" w={16} h={16} />
          병원 찾기
        </Link>
      </div>
      <nav aria-label="직군" className="mx-[22px] mt-[16px] flex h-[44px]">
        {직군탭.map((t) => (
          <Link key={t} href={주소(t, 정렬)} aria-current={t === 탭 ? 'page' : undefined}
            className="relative flex min-w-0 flex-1 items-center justify-center text-[14px] font-bold leading-[20px]"
            style={{ color: 어둠.글 }}>
            {t}
            {t === 탭 && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 어둠.밑줄 }} />}
          </Link>
        ))}
      </nav>
      {/* RAPO / Callout / 공지 · 다크 — 커뮤니티 이용 규칙(/terms/community)으로 갑니다 */}
      <Link href="/terms/community" className="mx-[22px] mt-[12px] flex h-[40px] items-center gap-[12px] rounded-[8px] px-[13px]"
        style={{ background: 어둠.면 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/community/notice-18.svg" alt="" width={18} height={18} />
        <span className="min-w-0 flex-1 text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>커뮤니티 이용 안내</span>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/community/next-14.svg" alt="" width={14} height={14} />
      </Link>
      <div className="mx-[22px] mt-[24px] flex h-[32px] items-center">
        <h2 className="min-w-0 flex-1 text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>
          {탭 === '전체' ? '전체 게시글' : `${탭} 게시글`}
        </h2>
        {/* 정렬 — 누르면 최신순 ↔ 인기순(최근 7일 조회 많은 순) */}
        <Link href={주소(탭, 정렬 === 'new' ? 'hot' : 'new')}
          className="flex h-[44px] items-center gap-[4px] text-[14px] leading-[20px]" style={{ color: 어둠.흐린글 }}
          aria-label={`정렬 바꾸기 · 지금 ${정렬 === 'new' ? '최신순' : '인기순'}`}>
          {정렬 === 'new' ? '최신순' : '인기순'}
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/community/down-13.svg" alt="" width={13} height={13} />
        </Link>
      </div>
    </header>
  );
}

type 사람 = { nickname: string; avatar: string | null; erased_at: string | null };
export type 커뮤니티글 = {
  id: number; title: string | null; body: string; created_at: string; comment_count: number;
  글쓴이: 사람 | null; job_group: string | null;
  댓글: { 글쓴이: 사람 | null; body: string } | null;
};

/* 공개 글 · 읽기 목록 (1266:1947) — 아바타 32 · 이름 · 「직군 · 시간」 · 제목 21/30 · 본문 15/27 · 댓글 미리보기 · 아래 선 */
export function RapoCommunityPost({ p }: { p: 커뮤니티글 }) {
  const 이름 = shownName(p.글쓴이);
  return (
    <article className="relative flex flex-col gap-[8px] px-[22px] pb-[24px] pt-[26px]">
      <Link href={`/post/${p.id}`} className="flex flex-col gap-[8px]">
        <div className="mb-[10px] flex items-center gap-[8px]">
          <Avatar value={p.글쓴이?.avatar} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>{이름}</p>
            <p className="text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>
              {[p.job_group, 지난때(p.created_at)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {p.title && <h3 className="break-keep text-[21px] font-bold leading-[30px] [overflow-wrap:anywhere]" style={{ color: 어둠.글 }}>{p.title}</h3>}
        <p className="line-clamp-3 break-keep text-[15px] leading-[27px] [overflow-wrap:anywhere]" style={{ color: 어둠.흐린글 }}>{p.body}</p>
      </Link>
      {p.comment_count > 0 && (
        <Link href={`/post/${p.id}#comments`} className="relative flex min-h-[56px] items-start gap-[8px] rounded-[12px] py-[8px] pl-[12px] pr-[12px]"
          style={{ background: 어둠.면 }}>
          {p.댓글 && <Avatar value={p.댓글.글쓴이?.avatar} size="sm" />}
          <div className="min-w-0 flex-1">
            {p.댓글 && (
              <>
                <p className="truncate text-[13px] font-bold leading-[17px]" style={{ color: 어둠.글 }}>{shownName(p.댓글.글쓴이)}</p>
                <p className="truncate text-[14px] leading-[20px]" style={{ color: 어둠.글 }}>{p.댓글.body}</p>
              </>
            )}
          </div>
          <span className="shrink-0 text-[12px] font-medium" style={{ color: '#b0bfcc' }}>댓글 {p.comment_count}  ›</span>
        </Link>
      )}
      <span aria-hidden className="absolute inset-x-[22px] bottom-0 h-px" style={{ background: 어둠.선 }} />
    </article>
  );
}

/* 글쓰기 (1266:1960) — 128×44 · 둥근 22 · 아래 탐색 위에 떠 있음 */
export function RapoCommunityWrite({ href }: { href: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+12px+env(safe-area-inset-bottom))] z-30 mx-auto flex w-full max-w-3xl justify-end px-[22px]">
      <Link href={href} className="pointer-events-auto flex h-[44px] items-center gap-[7px] rounded-[22px] pl-[12px] pr-[16px] text-[14px] font-bold leading-[20px] shadow-(--rapo-shadow-s2)"
        style={{ background: 어둠.쓰기, color: 어둠.글 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/community/pen-17.svg" alt="" width={17} height={17} />
        내 직군 글쓰기
      </Link>
    </div>
  );
}

/* 글이 없을 때 — 원본 「U07-EMPTY」 문구 */
export function RapoCommunityEmpty({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px] px-[22px] py-[48px]">
      <p className="text-[24px] font-bold leading-[35px]" style={{ color: 어둠.글 }}>아직 이야기가 없어요</p>
      <p className="text-[15px] leading-[23px]" style={{ color: 어둠.흐린글 }}>궁금한 점이나 나누고 싶은 경험을 첫 글로 남겨 보세요.</p>
      {children}
    </div>
  );
}
