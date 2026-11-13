'use client';

import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoMeMenu } from '@/components/rapo/rapo-me-menu';
import { useAuth } from '../auth';

/* 내 정보 — 새 디자인 「U14-01 / 내 정보」 1375:160 (2026-11-11 밤 · 대표: 피그마 우선).
   조각은 components/rapo/rapo-me.tsx. 원본 ↔ 지금 기능 맞대기: RAPO노트/디자인적용_내정보_1111.md

   전 화면에 한 장으로 있던 칸들을 메뉴 아래 화면으로 나눴습니다 — 하는 일은 그대로입니다.
     프로필 편집        /me/profile   사진 · 닉네임(5번) · 직군 · 역할
     스펙 확인·수정     /me/spec      급여 · 스펙 (SurveyEdit)
     내가 쓴 글 · 댓글   /me/activity  내 글 · 내 댓글 (MyLists)
     공고 알림 설정     /me/notify    알림 켜고 끄기 (NotifyToggle)
     개인정보·탈퇴      /me/account   차단한 분 · 로그아웃 · 개인정보처리방침 · 회원 탈퇴
     문의하기           /contact
   담당자 메뉴(채용 관리 · 교육 관리 · 담당자 신청 · 재직 인증)는 원본 「U14 / 관리 메뉴」 꼴로 그대로 둡니다.

   ── 아직 기능이 없는 메뉴 (2026-11-11 밤 대표 「부실한데」 → 원본 메뉴를 전부 두고 「준비 중」으로) ──
   내 급여 카드 · 입사 스펙 비교 · 내 급여 비교 · 관심 병원 · 희망 취업 조건 · 내 교육 관리 · 이용 상태·학적 · 신고 센터
   → /me/soon?k=… (급여·스펙 비교는 거기서 연봉 비교 알림 신청으로). 경력·근무 병원 요약은 값이 없어 안 그립니다.
   로그아웃은 맨 아래 (대표) */
export default function MyPage() {
  const { isAdmin, 관리, signOut } = useAuth();
  const 운영진 = isAdmin || 관리.페르소나역할 != null;

  return (
    <RapoMeFrame title="내 정보" nav>
      {(me) => (
        <RapoMeMenu me={me} 관리={관리} 운영진={운영진} onSignOut={signOut} />
      )}
    </RapoMeFrame>
  );
}
