'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { RapoButton } from './rapo-ui';

/* 「다시 불러오기」 — 홈의 공고 칸 오류와 공고 목록의 오류·빈 결과가 같이 씁니다 (2026-11-11).
   원본 설명 「해당 영역만 재시도하며 다른 영역은 유지」 — router.refresh() 는 서버 쪽 내용만
   다시 받고 화면의 다른 칸(배너 위치·열어 둔 것)은 그대로 둡니다.
   받는 동안 버튼이 로딩 모양으로 잠겨 두 번 눌리지 않습니다. */
export function RapoRetryButton({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <RapoButton onClick={() => start(() => router.refresh())} loading={busy} full>
      {children}
    </RapoButton>
  );
}
