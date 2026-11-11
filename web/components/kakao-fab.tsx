'use client';

import { usePathname } from 'next/navigation';
import { KAKAO_CHANNEL } from '@/lib/contact';

/* 카카오톡 문의 단추 — 모든 화면 오른쪽 아래에 떠서 따라다닙니다
   (2026-11-12 세중님 「문의하러 가기 카카오톡 아이콘으로 모든 화면 아래 오른쪽에 따라다니는 느낌」).
   누르면 RAPO 카카오톡 채널이 새 창으로 열립니다(주소는 lib/contact.ts 한 자리).

   자리 — 본문 기둥(max-w-3xl) 오른쪽 끝에 맞춥니다(PC 에서 화면 끝까지 밀려나지 않게).
     기본          하단 탐색(72) 위 16
     공고 상세     고정 행동(저장·지원 112) 위 16
   안 띄우는 곳 — 아래쪽이 큰 단추로 꽉 찬 화면과 운영 화면
     로그인 · 가입 · 로그인 확인 · 커뮤니티 쪽 전부 · 관리자
   모양 — 카카오 노랑(#FEE500) 동그라미 52 + 카카오 말풍선(로그인 단추와 같은 원본 SVG). 피그마에 원본이 없는 단추입니다. */

const 안띄움 = (p: string) =>
  p === '/login' || p === '/welcome' || p.startsWith('/auth')
  /* 커뮤니티 쪽(피드·방·글쓰기·글)은 「내 직군 글쓰기」·댓글 입력과 걸려서 뺍니다 (2026-11-12 세중님 「커뮤니티에서는 빼자」) */
  || p === '/community' || p.startsWith('/community/') || p.startsWith('/post/')
  || p === '/admin' || p.startsWith('/admin/');

function 아래자리(p: string): string {
  if (p.startsWith('/jobs/')) return 'calc(112px + 16px + env(safe-area-inset-bottom))';
  return 'calc(72px + 16px + env(safe-area-inset-bottom))';
}

export function KakaoFab() {
  const p = usePathname() ?? '/';
  if (안띄움(p)) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-full max-w-3xl justify-end px-(--rapo-dimension-x4)"
      style={{ bottom: 아래자리(p) }}>
      <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer" aria-label="카카오톡으로 문의하기 (새 창)"
        className="pointer-events-auto flex size-[52px] items-center justify-center rounded-full bg-[#FEE500]
                   shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-transform duration-[120ms] active:scale-90
                   motion-reduce:transition-none">
        {/* eslint-disable-next-line @next/next/no-img-element -- 카카오 말풍선 원본 SVG (로그인 단추와 같은 것) */}
        <img src="/rapo/login/kakao-20.svg" alt="" width={26} height={26} />
      </a>
    </div>
  );
}
