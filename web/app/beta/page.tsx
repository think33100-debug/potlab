import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { KAKAO_CHANNEL } from '@/lib/contact';

/* 테스트 기간 「회원 전용」 안내 (2026-11-11 세중님 결정 · 줄 A · 같은 날 밤 초대 코드 거둠).

   로그인 안 한 사람은 어느 주소로 오든 여기로 옵니다 (middleware.ts).
   보여 줄 것은 하나뿐입니다 — 로그인·회원가입으로 가는 길.
   가입은 누구나 합니다. 공고·커뮤니티 자료는 한 줄도 안 그립니다.

   ?r=1 — 로그인 여부를 **못 물어본** 때(연결 끊김)입니다. 회원일 수도 있으니
   「가입하세요」가 아니라 「다시 시도」를 보입니다 (web/회원여부_읽는_법.md).
   그때 middleware 는 주소를 안 바꾸고 이 화면을 보여 주므로, 새로고침하면
   원래 가려던 화면으로 다시 갑니다.

   ★ 디자인 시안(줄 B)이 오면 이 화면 꼴을 바꿉니다. 글은 세중님 결정 그대로입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RAPO · 테스트 중',
  robots: { index: false, follow: false },
};

export default async function Beta({
  searchParams,
}: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const 다시 = r === '1';

  /* 이미 회원인 분이 이 주소를 직접 열었으면 첫 화면으로 보냅니다 */
  if (!다시) {
    const who = await serverWho(await serverSupabase());
    if (who === '회원') redirect('/');
  }

  /* 2026-11-16 — 로그인 상태를 못 물어본 때(?r=1) middleware 가 여기로 보냅니다. 아직 살아 있는 화면이라
     옛 위쪽 줄과 옛 POTJOB 워드마크(components/logo.tsx) 대신 홈의 RAPO 위쪽 줄(로고만)과 토큰으로 옮겼습니다. 글은 그대로입니다 */
  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who="모름" />
      <main className="mx-auto flex w-full max-w-[22rem] flex-col gap-(--rapo-dimension-x3) px-(--rapo-dimension-x5) pb-[96px] pt-(--rapo-dimension-x6)">
        <p className="rapo-type-t3-bold self-start rounded-(--rapo-radius-r1) bg-(--rapo-brand-color-blush) px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-brand-contrast)">
          테스트 중
        </p>
        <h1 className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">RAPO 는 지금 테스트 중이에요</h1>

        {다시 ? (
          <>
            <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral)">
              로그인 상태를 확인하지 못했어요. 잠시 뒤 새로고침해 주세요.
            </p>
            <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">연결이 잠깐 끊겼을 수 있어요</p>
          </>
        ) : (
          <>
            <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral)">회원만 볼 수 있어요.</p>
            <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral)">
              처음 오셨다면 <b>가입하고 바로 둘러보세요.</b>
            </p>
          </>
        )}

        <div className="pt-(--rapo-dimension-x4)">
          <RapoButton href="/login" tone="navy" full>로그인 · 회원가입</RapoButton>
        </div>

        <p className="rapo-type-t3-regular break-keep pt-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
          궁금한 점은{' '}
          <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">카카오톡으로 문의하기</a>
          로 남겨 주세요.
        </p>
      </main>
    </div>
  );
}
