'use client';

import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { RapoMeRow, RapoMeSection } from './rapo-me';

/* 내 정보 첫 화면의 몸통 — app/me/page.tsx 와 견본(app/design-preview/me)이 같이 씁니다 (2026-11-11 밤) */
export function RapoMeMenu({ me, 관리, 운영진 }: {
  me: { avatar: string | null; nickname: string; job_group: string | null; role: string | null };
  관리: { 채용관리: boolean; 교육관리: boolean };
  운영진: boolean;
}) {
  return (
      <div className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x2)">
        {/* 프로필 요약 (1376:37165) — 아바타 56 · 닉네임 28 · 직군 · 프로필 편집 */}
        <div className="flex items-center gap-(--rapo-dimension-x3_5) py-(--rapo-dimension-x2_5)">
          <Avatar value={me.avatar} size="profile" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[28px] font-bold leading-[34px] text-(color:--rapo-color-fg-neutral)">{me.nickname}</p>
            <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">
              {[me.job_group, me.role].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Link href="/me/profile"
            className="rapo-type-t4-bold flex h-(--rapo-dimension-x10) shrink-0 items-center rounded-(--rapo-radius-r2) border-(length:--rapo-border-default)
                       border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)
                       active:bg-(--rapo-color-bg-transparent-pressed)">
            프로필 편집
          </Link>
        </div>

        <RapoMeSection title="경력과 스펙" first>
          <RapoMeRow icon="/rapo/me/spec-24.svg" href="/me/spec">스펙 확인·수정</RapoMeRow>
        </RapoMeSection>

        <RapoMeSection title="내 활동">
          <RapoMeRow icon="/rapo/me/save-24.svg" href="/me/activity">저장한 공고 · 내 글</RapoMeRow>
        </RapoMeSection>

        {/* 담당자로 승인된 분과 마스터에게만 (내관리메뉴 창구 · 아래 탐색과 같은 값) */}
        {(관리.채용관리 || 관리.교육관리 || 운영진) && (
          <RapoMeSection title="담당자 메뉴">
            {관리.채용관리 && <RapoMeRow icon="/rapo/me/hospital-24.svg" href="/biz">채용 관리</RapoMeRow>}
            {관리.교육관리 && <RapoMeRow icon="/rapo/me/save-24.svg" href="/edu/manage">교육 관리</RapoMeRow>}
            {운영진 && <RapoMeRow icon="/rapo/me/save-24.svg" href="/partner">담당자 신청</RapoMeRow>}
            {운영진 && <RapoMeRow icon="/rapo/me/save-24.svg" href="/verify">재직 인증</RapoMeRow>}
          </RapoMeSection>
        )}

        <RapoMeSection title="설정">
          <RapoMeRow icon="/rapo/me/bell-24.svg" href="/me/notify">공고 알림 설정</RapoMeRow>
          <RapoMeRow icon="/rapo/me/contact-24.svg" href="/contact">문의하기</RapoMeRow>
          <RapoMeRow icon="/rapo/me/save-24.svg" href="/me/account">개인정보·탈퇴</RapoMeRow>
        </RapoMeSection>
      </div>
  );
}
