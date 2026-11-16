'use client';

import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { channelName } from '@/lib/channels';
import type { PostRow } from '@/lib/supabase';
import { shownName } from '@/lib/who';
import { 어둠 } from '@/components/rapo/rapo-community';

export function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  if (s < 604800) return Math.floor(s / 86400) + '일 전';
  return iso.slice(0, 10);
}

/* 글 한 줄. 목록 어디서나 같은 모양으로 씁니다.
   보이는 사람 정보는 닉네임과 아바타뿐입니다.

   2026-11-16 — 쓰는 곳이 커뮤니티 방(/community/<방>) 하나뿐이고, 그 화면을 커뮤니티 피드와 같은 어두운 판으로
   옮기면서 색을 「어둠」(components/rapo/rapo-community.tsx 원본 값 한 자리)으로 바꿨습니다. 보이는 칸은 그대로입니다 */
export function PostItem({ p, showChannel = false }: { p: PostRow; showChannel?: boolean }) {
  /* ★ 2026-10-07 — 저장소 공개 주소를 쓰지 않습니다 (세중님 결정 ㉯).
     그 경로가 「회원번호/글번호/0-t.webp」 라 회원번호가 화면에 나갔습니다.
     우리 주소로 받습니다 — app/api/post-image/[post]/[idx]/route.ts */
  const thumbUrl = (p.사진수 ?? 0) > 0 ? `/api/post-image/${p.id}/0?t=1` : null;

  return (
    <li className="relative">
      <Link
        href={`/post/${p.id}`}
        className="flex gap-(--rapo-dimension-x4) px-[22px] py-(--rapo-dimension-x5) active:bg-white/5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-(--rapo-dimension-x1)">
          <div className="flex items-center gap-(--rapo-dimension-x2) text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>
            {showChannel && (
              <span className="shrink-0 rounded-(--rapo-radius-r1) px-(--rapo-dimension-x2) font-medium" style={{ background: 어둠.면, color: 어둠.글 }}>
                {channelName(p.channel)}
              </span>
            )}
            <Avatar value={p.profiles?.avatar} size="sm" />
            <span className="truncate text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>{shownName(p.profiles)}</span>
            <span className="shrink-0 whitespace-nowrap">{ago(p.created_at)}</span>
          </div>

          {p.title && <p className="truncate text-[18px] font-bold leading-[26px]" style={{ color: 어둠.글 }}>{p.title}</p>}
          {/* ★ 2026-10-11 — 중고거래 값·상태 (세중님 결정).
              전에는 본문에 「가격 0원」처럼 적어 찾기도 거르기도 안 됐습니다.
              **결제는 없습니다** — 값은 적어 두는 글자일 뿐입니다 */}
          {(p.값 != null || p.거래상태) && (
            <p className="flex items-center gap-(--rapo-dimension-x2) text-[15px] leading-[22px]" style={{ color: 어둠.글 }}>
              {p.값 != null && (
                <b className="num whitespace-nowrap tabular-nums">{p.값.toLocaleString('ko-KR')}원</b>
              )}
              {p.값 == null && <span style={{ color: 어둠.흐린글 }}>값 안 적음</span>}
              {p.거래상태 && (
                <span className="whitespace-nowrap rounded-(--rapo-radius-full) px-(--rapo-dimension-x2) text-[12px] leading-[20px]"
                  style={p.거래상태 === '판매중' ? { background: 어둠.밑줄, color: '#112332' }
                    : p.거래상태 === '예약중' ? { background: 어둠.쓰기, color: 어둠.글 }
                    : { background: 어둠.면, color: 어둠.흐린글 }}>
                  {p.거래상태}
                </span>
              )}
            </p>
          )}
          <p className="line-clamp-2 break-keep text-[15px] leading-[24px] [overflow-wrap:anywhere]" style={{ color: 어둠.흐린글 }}>{p.body}</p>

          <div className="flex gap-(--rapo-dimension-x3) text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>
            <span className="whitespace-nowrap">조회 {p.view_count}</span>
            <span className="whitespace-nowrap">댓글 {p.comment_count}</span>
            <span className="whitespace-nowrap">좋아요 {p.like_count}</span>
          </div>
        </div>

        {thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
          <img src={thumbUrl} alt="" width={72} height={72}
            className="size-[72px] shrink-0 rounded-(--rapo-radius-r2) object-cover" />
        )}
      </Link>
      <span aria-hidden className="absolute inset-x-[22px] bottom-0 h-px" style={{ background: 어둠.선 }} />
    </li>
  );
}
