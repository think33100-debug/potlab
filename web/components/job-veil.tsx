'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { Icon } from '@/components/icon';

/* 가입 안 한 사람에게는 병원 구역부터 아래를 흐리게 덮습니다.

   ⚠ 이건 **화면에서만** 막는 것입니다.
      요청을 직접 쏘면 자료가 그대로 나갑니다. 진짜로 막는 것은
      로그인 뒤로 옮길 때 DB 규칙으로 합니다 (인수인계 「회원을 받기 전에」).
      통째로 감추지 않는 이유는, 내용이 있다는 게 보여야 가입할 마음이 들어서입니다.

   공유 링크로 들어온 사람에게는 걸지 않습니다.
   회원을 데려오는 통로라 그 한 건은 전부 보여주기로 했습니다.

   어떻게 가르나 — **이번 방문에서 처음 열린 자리**를 기억해 둡니다.
     처음 열린 자리가 이 공고   → 카톡·문자로 받은 링크. 전부 보임
     처음 열린 자리가 딴 곳     → 목록을 보다 들어온 사람. 흐림

   referrer 만 보면 안 됩니다. Next 는 목록에서 공고로 갈 때 문서를 새로
   안 읽어서, referrer 가 「이번 방문의 첫 문서」 값에 그대로 머뭅니다.
   실제로 /jobs 에서 눌러 들어와도 referrer 가 비어 있었습니다 (2026-09-20).

   새로고침해도 처음 자리는 그대로라, 공유 링크를 다시 읽어도 안 흐려집니다.
   서버는 이걸 모릅니다(세션이 브라우저에만 있음). 그래서 브라우저에서 봅니다. */
export function JobVeil({ children }: { children: React.ReactNode }) {
  const { loading, me } = useAuth();
  /* null = 아직 모름. 처음 그릴 때 깜빡이지 않게 흐림을 미룹니다 */
  const [fromShare, setFromShare] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const here = location.pathname;
      /* 적는 것은 app/back-guard.tsx 의 markEntry() 가 합니다 —
         모든 화면에 붙어 있어야 「딴 데서 왔는지」가 갈립니다 */
      const entry = sessionStorage.getItem('entry_path') ?? here;
      const outside = document.referrer
        && new URL(document.referrer).origin !== location.origin;
      setFromShare(entry === here || !!outside);
    } catch {
      setFromShare(true);            // 못 읽으면(사파리 비공개 등) 보여주는 쪽으로
    }
  }, []);

  const full = !!me?.survey_at;
  const veil = !loading && !full && fromShare === false;

  if (!veil) return <>{children}</>;

  return (
    <div className="relative">
      {/* 흐린 곳의 키를 잘라둡니다.
          안 자르면 흐린 화면이 몇 천 픽셀 이어지고, 가입 권유가 그 맨 아래에
          붙어서 아무도 못 봅니다. 맛만 보이고 곧바로 권유가 나오게 합니다 */}
      <div aria-hidden
           className="max-h-[560px] overflow-hidden"
           style={{ filter: 'blur(7px)', opacity: 0.75 }}>
        {children}
      </div>

      {/* 아래로 갈수록 진해지는 안개 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[480px]"
        style={{
          background: 'linear-gradient(to bottom, rgba(244,244,241,0) 0%,'
                      + ' rgba(244,244,241,0.82) 32%, #F4F4F1 62%)',
        }}
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8 text-center">
        <span className="flex h-[46px] w-[46px] items-center justify-center
                         rounded-[14px] bg-[#14181C]">
          <Icon name="lock" size={22} className="text-white" />
        </span>

        <h2 className="mt-4 break-keep text-[24px] font-black leading-[1.35] text-[#14181C]">
          이 병원이 어떤 곳인지<br />회원만 볼 수 있어요
        </h2>
        <p className="mt-3 max-w-[20rem] break-keep text-[14px] leading-[1.7] text-[#4A5056]">
          치료사 인원 · 병상 · 얼마나 바쁜 곳인지까지.
          가입은 3분이면 끝나요.
        </p>

        <Link
          href="/login"
          className="mt-6 flex h-[54px] w-full max-w-[22rem] items-center justify-center
                     rounded-[12px] bg-[#FF3B30] text-[16px] font-bold text-white
                     transition-transform duration-[120ms] active:translate-y-[2px]
                     active:scale-[0.99] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                     motion-reduce:transition-none"
        >
          가입하고 전부 보기
        </Link>
        <p className="mt-3 break-keep text-[12px] text-[#5F666C]">
          카카오 · 네이버로 3초 만에 시작해요
        </p>
      </div>
    </div>
  );
}
