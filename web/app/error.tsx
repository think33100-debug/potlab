'use client';

import { useSyncExternalStore } from 'react';
import { RapoStatePage } from '@/components/rapo/rapo-state';

/* 화면을 그리다 오류가 났을 때 (2026-11-12 · 새 디자인 「14 · 공통 상태」).
   전에는 이 파일이 없어서 Next 기본 화면(영어 「Application error」 한 줄)이 떴습니다.

   인터넷이 끊겼으면 「오프라인」(1383:1438), 아니면 「전체 조회 실패」(1383:1451) 를 보입니다.
   「다시 불러오기」는 Next 가 주는 retry() — 서버 화면까지 다시 받아 옵니다(node_modules/next/dist/docs · error.md).
   ⚠ 오류 내용(error.message)은 화면에 찍지 않습니다 — 회원에게 서버 속사정이 보이지 않게 */

const 연결구독 = (알림: () => void) => {
  window.addEventListener('online', 알림);
  window.addEventListener('offline', 알림);
  return () => { window.removeEventListener('online', 알림); window.removeEventListener('offline', 알림); };
};

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  const 끊김 = useSyncExternalStore(연결구독, () => !navigator.onLine, () => false);
  return 끊김 ? (
    <RapoStatePage
      그림="/rapo/state/offline.svg"
      제목="인터넷 연결을 확인해 주세요"
      설명="다시 연결한 뒤 화면을 불러올 수 있어요."
      단추={{ 글: '다시 시도', onClick: () => retry() }}
    />
  ) : (
    <RapoStatePage
      그림="/rapo/state/error.svg"
      둥글기={25.6}
      제목="화면을 불러오지 못했어요"
      설명="잠시 후 다시 시도해 주세요."
      단추={{ 글: '다시 불러오기', onClick: () => retry() }}
    />
  );
}
