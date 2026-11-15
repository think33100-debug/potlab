import Link from 'next/link';
import { Fragment } from 'react';
import { Hit } from '@/components/hit';
import { RapoBottomNav } from './rapo-bottom-nav';
import { RapoCommunityEmpty, RapoCommunityPost, RapoCommunityWrite, 어둠, 직군탭, type 직군탭값, type 커뮤니티글 } from './rapo-community';

/* 학생·취준생 공간 그리기 — 피그마 U07-ST 1649:5467. 자료는 app/community/student/page.tsx 가 고릅니다.
   미리보기(/design-preview/community-student)가 같이 씁니다 */
export function StudentSpaceView({ 탭, 정렬, 주소, 학생, 탈, 보일글, 소개 }: {
  탭: 직군탭값; 정렬: 'new' | 'hot'; 주소: (t: 직군탭값, s: 'new' | 'hot') => string; 학생: boolean; 탈: boolean; 보일글: 커뮤니티글[];
  /* 글 사이 라포 소개 그림 (광고배너 자리 「학생피드」 · 관리자 → 광고에서 바꿈 · 2026-11-15 세중님 「광고 말고 라포 광고 이미지」) */
  소개?: { 그림: string; 링크: string | null } | null;
}) {
  const 머리 = '#264e58';
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: 어둠.바탕 }}>
      <Hit kind="community" target="student" />
      {/* 앱 바 + 공간 소개 (원본 #264e58 · 제목 30/34 Bold · 소개 15/22 #def9f2 · 오른쪽 3D 실습 수첩 116) */}
      <header style={{ background: 머리 }}>
        <div className="flex h-[56px] items-center px-[8px]">
          <Link href="/community" aria-label="커뮤니티로" className="flex size-[44px] items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4l-6 6 6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>
        <div className="flex items-start gap-[8px] px-[22px] pb-[22px] pt-[8px]">
          <div className="min-w-0 flex-1">
            <h1 className="break-keep text-[30px] font-bold leading-[34px] text-white">학생·취준생 공간</h1>
            <p className="mt-[14px] break-keep text-[15px] leading-[22px]" style={{ color: '#def9f2' }}>
              <span className="block">실습부터 첫 면접까지,</span>
              <span className="block">함께 나누는 취업 준비 이야기</span>
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 그림(3D 실습 수첩) */}
          <img src="/rapo/community/student-note.png" alt="" width={116} height={96} className="-mt-[6px] shrink-0" />
        </div>
      </header>

      <nav aria-label="직군" className="mx-[22px] mt-[4px] flex h-[44px]">
        {직군탭.map((t) => (
          <Link key={t} href={주소(t, 정렬)} aria-current={t === 탭 ? 'page' : undefined}
            className="relative flex min-w-0 flex-1 items-center justify-center text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>
            {t}
            {t === 탭 && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: 어둠.밑줄 }} />}
          </Link>
        ))}
      </nav>
      <div className="mx-[22px] mt-[24px] flex h-[32px] items-center">
        <h2 className="min-w-0 flex-1 text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>최근 이야기</h2>
        <Link href={주소(탭, 정렬 === 'new' ? 'hot' : 'new')} className="flex h-[44px] items-center gap-[4px] text-[14px] leading-[20px]"
          style={{ color: 어둠.흐린글 }} aria-label={`정렬 바꾸기 · 지금 ${정렬 === 'new' ? '최신순' : '인기순'}`}>
          {정렬 === 'new' ? '최신순' : '인기순'}
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/community/down-13.svg" alt="" width={13} height={13} />
        </Link>
      </div>

      <main className="mt-[6px]">
        {!학생 ? (
          <RapoCommunityEmpty>
            <p className="break-keep text-[14px]" style={{ color: 어둠.흐린글 }}>학생·취준생 회원만 볼 수 있는 공간이에요.</p>
          </RapoCommunityEmpty>
        ) : 탈 ? (
          <RapoCommunityEmpty>
            <p className="text-[14px]" style={{ color: 어둠.흐린글 }}>글을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
          </RapoCommunityEmpty>
        ) : 보일글.length === 0 ? <RapoCommunityEmpty /> : 보일글.map((p, i) => (
          <Fragment key={p.id}>
            <RapoCommunityPost p={p} />
            {/* 원본 1585:5255 자리 — 첫 글 다음 (글이 하나뿐이어도 그 아래) */}
            {i === 0 && 소개 && <소개칸 그림={소개.그림} 링크={소개.링크} />}
          </Fragment>
        ))}
      </main>
      <div aria-hidden style={{ height: 'calc(72px + 68px + env(safe-area-inset-bottom))' }} />
      {학생 && <RapoCommunityWrite href="/community/write?space=stu" 글="전용 글쓰기" />}
      <RapoBottomNav current="/community" dark />
    </div>
  );
}

function 소개칸({ 그림, 링크 }: { 그림: string; 링크: string | null }) {
  const 몸 = (
    /* eslint-disable-next-line @next/next/no-img-element -- 관리자가 올린 그림(또는 기본 라포 소개 그림) */
    <img src={그림} alt="RAPO 소개" className="block h-auto w-full" />
  );
  return (
    <div className="px-[22px] pb-[26px]">
      <p className="mb-[8px] text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>RAPO 소개</p>
      <div className="overflow-hidden rounded-[12px]">
        {링크 ? <Link href={링크}>{몸}</Link> : 몸}
      </div>
    </div>
  );
}
