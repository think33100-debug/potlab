'use client';

import { BlockList } from '@/components/block-list';
import { RapoMeFrame, RapoMeRow, RapoMeSection } from '@/components/rapo/rapo-me';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { useAuth } from '../../auth';

/* 개인정보·탈퇴 — 내 정보 「설정」 (2026-11-11 밤). 전 /me 맨 아래 칸들을 모았습니다.
   차단한 분(애플 심사 1.2 — 풀 수 있어야 함) · 로그아웃 · 개인정보처리방침 · 회원 탈퇴(애플 5.1.1(v) — 앱 안에서) */
export default function MyAccount() {
  const { signOut } = useAuth();
  return (
    <RapoMeFrame title="개인정보·탈퇴">
      {() => (
        <div className="flex flex-col gap-(--rapo-dimension-x6) pt-(--rapo-dimension-x4)">
          <RapoMeSection title="개인정보" first>
            <RapoMeRow icon="/rapo/me/save-24.svg" href="/terms/privacy">개인정보처리방침</RapoMeRow>
            <RapoMeRow icon="/rapo/me/save-24.svg" href="/me/leave">회원 탈퇴</RapoMeRow>
          </RapoMeSection>
          {/* 차단한 분 — 없으면 아무것도 안 그립니다 */}
          <BlockList />
          <RapoButton onClick={signOut} tone="outline" full>로그아웃</RapoButton>
        </div>
      )}
    </RapoMeFrame>
  );
}
