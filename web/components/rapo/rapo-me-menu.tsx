'use client';

import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { RapoInstallCard } from './rapo-install';
import { RapoMeRow, RapoMeSection } from './rapo-me';

/* 내 정보 첫 화면의 몸통 — app/me/page.tsx 와 견본(app/design-preview/me)이 같이 씁니다.
   피그마 「U14-01 / 내 정보」 1375:160 의 메뉴를 **전부** 둡니다 (2026-11-11 밤 대표 「부실한데」).
   아직 기능이 없는 메뉴는 「준비 중」 화면(/me/soon?k=…)으로 갑니다 — 급여·스펙 비교는 거기서 알림 신청으로 이어집니다.
   내 급여 카드도 같은 자리에 둡니다(값 대신 「오픈 전」). 경력·근무 병원 요약은 담긴 값이 없어 그리지 않습니다.
   로그아웃은 원본에 없지만 찾기 쉬운 맨 아래에 둡니다(대표). */
export function RapoMeMenu({ me, 관리, 운영진, onSignOut }: {
  me: { avatar: string | null; nickname: string; job_group: string | null; role: string | null };
  관리: { 채용관리: boolean; 교육관리: boolean };
  운영진: boolean;
  onSignOut?: () => void;
}) {
  const 준비 = (k: string) => `/me/soon?k=${k}`;
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x2)">
      {/* 프로필 요약 (1376:37165) — 아바타 56 · 닉네임 28 · 직군 · 프로필 편집 */}
      <div className="flex items-center gap-(--rapo-dimension-x3_5) py-(--rapo-dimension-x2_5)">
        <Avatar value={me.avatar} size="profile" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[28px] font-bold leading-[34px] text-(color:--rapo-color-fg-neutral)">{me.nickname}</p>
          <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">
            {/* 점 뒤에서만 줄이 바뀌게 — 「· 현직」이 줄 머리에 오지 않게 (2026-11-14 · 320 폭) */}
            {[me.job_group, me.role].filter(Boolean).map((t, i) => <span key={i} className="whitespace-nowrap">{i > 0 ? ' · ' : ''}{t}</span>)}
          </p>
        </div>
        <Link href="/me/profile"
          className="rapo-type-t4-bold flex h-(--rapo-dimension-x10) shrink-0 items-center rounded-(--rapo-radius-r2) border-(length:--rapo-border-default)
                     border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          프로필 편집
        </Link>
      </div>

      {/* 설치 유도 — 아직 홈 화면에 안 둔 분에게만 (2026-11-14 세중님) */}
      <RapoInstallCard />

      {/* 내 급여 요약 (1441:1459) — 급여는 아직 오픈 전이라 금액 대신 안내 · 누르면 알림 신청으로 */}
      <Link href={준비('pay')} className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)">
        <div className="min-w-0 flex-1">
          <p className="rapo-type-t7-bold text-(color:--rapo-color-fg-neutral)">내 급여</p>
          <p className="rapo-type-t5-bold mt-(--rapo-dimension-x1) text-(color:--rapo-color-fg-brand-contrast)">아직 오픈 전이에요</p>
          <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">열리면 알려 드릴게요 · 알림 신청</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/graphic-pay-48.svg" alt="" width={48} height={48} className="shrink-0" />
      </Link>

      {/* 2026-11-14 세중님 「토큰 중복되는 것들도 바꿔줘」 — 줄마다 다른 아이콘. 피그마에 없는 일곱은 같은 선 규칙(24 · 1.6 · 둥근 끝 · #465568)으로 그렸습니다 */}
      <RapoMeSection title="경력과 스펙" first>
        <RapoMeRow icon="/rapo/me/spec-24.svg" href="/me/spec">스펙 확인·수정</RapoMeRow>
        <RapoMeRow icon="/rapo/me/compare-24.svg" href={준비('spec')}>입사 스펙 비교</RapoMeRow>
        <RapoMeRow icon="/rapo/me/pay-24.svg" href={준비('paycmp')}>내 급여 비교</RapoMeRow>
      </RapoMeSection>

      <RapoMeSection title="내 활동과 희망 조건">
        <RapoMeRow icon="/rapo/me/save-24.svg" href="/me/saved">저장한 공고</RapoMeRow>
        <RapoMeRow icon="/rapo/me/hide-24.svg" href="/me/hidden">숨긴 공고</RapoMeRow>
        <RapoMeRow icon="/rapo/me/hospital-24.svg" href="/me/hospitals">관심 병원</RapoMeRow>
        <RapoMeRow icon="/rapo/me/pref-24.svg" href={준비('pref')}>희망 취업 조건</RapoMeRow>
        <RapoMeRow icon="/rapo/me/edu-24.svg" href={준비('edu')}>내 교육 관리</RapoMeRow>
        {/* 원본에는 없는 줄 — 내가 쓴 글·댓글을 볼 길이 없어지지 않게 둡니다 (2026-11-12 밤 근무 · 아침에 정할 것) */}
        <RapoMeRow icon="/rapo/me/write-24.svg" href="/me/activity">내가 쓴 글 · 댓글</RapoMeRow>
      </RapoMeSection>

      {/* 담당자로 승인된 분과 마스터에게만 (내관리메뉴 창구 · 아래 탐색과 같은 값) — 원본 「U14 / 관리 메뉴」 1508:2398 */}
      {(관리.채용관리 || 관리.교육관리 || 운영진) && (
        <RapoMeSection title="담당자 메뉴">
          {관리.채용관리 && <RapoMeRow icon="/rapo/me/work-24.svg" href="/biz">채용 관리</RapoMeRow>}
          {관리.교육관리 && <RapoMeRow icon="/rapo/me/class-24.svg" href="/edu/manage">교육 관리</RapoMeRow>}
          {운영진 && <RapoMeRow icon="/rapo/me/apply-24.svg" href="/partner">담당자 신청</RapoMeRow>}
          {운영진 && <RapoMeRow icon="/rapo/me/verify-24.svg" href="/verify">재직 인증</RapoMeRow>}
        </RapoMeSection>
      )}

      <RapoMeSection title="설정">
        <RapoMeRow icon="/rapo/me/install-24.svg" href="/me/install">핸드폰에 설치하기</RapoMeRow>
        <RapoMeRow icon="/rapo/me/bell-24.svg" href="/me/notify">알림 설정</RapoMeRow>
        <RapoMeRow icon="/rapo/me/school-24.svg" href={준비('status')}>이용 상태 · 학적 정보</RapoMeRow>
        <RapoMeRow icon="/rapo/me/contact-24.svg" href="/contact">문의하기</RapoMeRow>
        <RapoMeRow icon="/rapo/me/report-24.svg" href={준비('report')}>신고 센터</RapoMeRow>
        <RapoMeRow icon="/rapo/me/lock-24.svg" href="/me/account">개인정보·탈퇴</RapoMeRow>
      </RapoMeSection>

      {onSignOut && (
        <button type="button" onClick={onSignOut}
          className="rapo-type-t5-bold mt-(--rapo-dimension-x2) flex h-(--rapo-dimension-x13) w-full items-center justify-center rounded-(--rapo-radius-r3)
                     border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          로그아웃
        </button>
      )}
    </div>
  );
}
