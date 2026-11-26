'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { 연월읽기, 졸업연월 } from '@/lib/school-period';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoInstallCard } from './rapo-install';
import { RapoMeRow, RapoMeSection } from './rapo-me';
import { 스펙비교길 } from './rapo-spec-entry';

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
  /* 경력 요약 — 가입 때 적은 근무 병원·입사연도 (2026-11-15 새 가입 · student_specs 내 줄). 없으면 줄을 안 그립니다 */
  const [경력, set경력] = useState<{ 병원: string | null; 입사: number | null } | null>(null);
  useEffect(() => {
    if (me.role !== '현직') return;
    browserSupabase().from('student_specs').select('근무병원,입사연도').maybeSingle().then(({ data }) => {
      const d = data as unknown as { 근무병원: string | null; 입사연도: number | null } | null;
      if (d && (d.근무병원 || d.입사연도)) set경력({ 병원: d.근무병원, 입사: d.입사연도 });
    });
  }, [me.role]);
  const 연차 = 경력?.입사 ? new Date().getFullYear() - 경력.입사 + 1 : null;
  /* 학생·취준생 — 졸업하는 해가 됐는데(또는 이미 졸업) 스펙(학점)을 아직 안 넣었으면 「취업 스펙 입력하고 비교하기」를 띄웁니다
     (2026-11-17 세중님 「재학생은 졸업년도가 되면 내정보에 취업 스펙 입력하고 비교하기 떠야해」 · 재학 중 가입은 스펙을 건너뜁니다) */
  const [스펙넣기, set스펙넣기] = useState(false);
  useEffect(() => {
    if (me.role !== '학생') return;
    browserSupabase().from('student_specs').select('학적,입학연월,school_type,gpa').maybeSingle().then(({ data }) => {
      const d = data as unknown as { 학적: string | null; 입학연월: string | null; school_type: string | null; gpa: number | null } | null;
      if (!d || d.gpa != null) return;
      const 졸업 = 졸업연월(d.school_type ?? '', 연월읽기(d.입학연월));
      const 올해 = new Date(Date.now() + 9 * 3600_000).getUTCFullYear();
      set스펙넣기(d.학적 === '졸업' || (!!졸업 && 졸업.y <= 올해));
    });
  }, [me.role]);
  return (
    /* PC(1040↑) — 피그마 「내 정보 · 회원 / PC 1040」(1930:1850): 왼쪽 회색 카드(폭 244 · 프로필 · 급여) + 오른쪽 메뉴 · 사이 32.
       1039 이하는 지금처럼 위에서 아래로 한 줄입니다. 피그마 왼쪽 카드의 「내 급여 3,960만원」은 값이 없어 지금 「오픈 전」 카드 그대로 */
    <div className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x2)
                    min-[1040px]:grid min-[1040px]:grid-cols-[244px_minmax(0,1fr)] min-[1040px]:items-start min-[1040px]:gap-x-(--rapo-dimension-x8)">
      <div className="flex flex-col gap-(--rapo-dimension-x5) min-[1040px]:sticky min-[1040px]:top-(--rapo-dimension-x4) min-[1040px]:gap-(--rapo-dimension-x4)
                      min-[1040px]:rounded-(--rapo-radius-r4) min-[1040px]:bg-(--rapo-color-bg-layer-default-pressed) min-[1040px]:p-(--rapo-dimension-x4)">
      {/* 프로필 요약 (1376:37165) — 아바타 56 · 닉네임 28 · 직군 · 프로필 편집 */}
      <div className="flex items-center gap-(--rapo-dimension-x3_5) py-(--rapo-dimension-x2_5) min-[1040px]:flex-col min-[1040px]:items-start min-[1040px]:gap-(--rapo-dimension-x3)">
        <Avatar value={me.avatar} size="profile" />
        <div className="min-w-0 flex-1 min-[1040px]:w-full">
          <p className="truncate text-[28px] font-bold leading-[34px] text-(color:--rapo-color-fg-neutral)">{me.nickname}</p>
          {/* 피그마 1375:43209 — 직군 딱지 하나 (2026-11-15 · 전에는 「작업치료사 · 현직」 글) */}
          {me.job_group && (
            <span className="rapo-type-t4-regular mt-(--rapo-dimension-x1) inline-block whitespace-nowrap rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x2) py-[2px] text-(color:--rapo-color-fg-neutral-muted)">
              {me.job_group}
            </span>
          )}
        </div>
        <Link href="/me/profile"
          className="rapo-type-t4-bold flex h-(--rapo-dimension-x10) shrink-0 items-center rounded-(--rapo-radius-r2) border-(length:--rapo-border-default)
                     border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          프로필 편집
        </Link>
      </div>

      {/* 설치 유도 — 아직 홈 화면에 안 둔 분에게만 (2026-11-14 세중님) */}
      {/* PC(1040↑)는 왼쪽 칸이 좁아 글이 깨집니다 — 같은 길이 아래 「설정 · 핸드폰에 설치하기」에 있어 PC 에서는 이 카드만 접습니다 */}
      <div className="empty:hidden min-[1040px]:hidden"><RapoInstallCard /></div>

      {스펙넣기 && (
        <Link href="/me/spec" className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)">
          <div className="min-w-0 flex-1">
            <p className="rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)">취업 스펙 입력하고 비교하기</p>
            <p className="rapo-type-t4-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">스펙을 넣으면 내 취업 스펙 점수가 나와요</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/home/graphic-spec-48.svg" alt="" width={48} height={48} className="shrink-0" />
        </Link>
      )}

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
      </div>

      <div className="flex min-w-0 flex-col gap-(--rapo-dimension-x5)">
      <RapoMeSection title="경력과 스펙" first>
        {경력 && (
          <dl className="grid grid-cols-2 gap-(--rapo-dimension-x3) pb-(--rapo-dimension-x2)">
            <div className="min-w-0"><dt className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">경력</dt>
              <dd className="rapo-type-t5-bold mt-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">{연차 ? `${연차}년차` : '입력 정보 없음'}</dd></div>
            <div className="min-w-0"><dt className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">근무 병원</dt>
              <dd className="rapo-type-t5-bold mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral)">{경력.병원 ?? '입력 정보 없음'}{경력.입사 ? <span className="whitespace-nowrap"> · {경력.입사}년 입사</span> : null}</dd></div>
          </dl>
        )}
        {me.role === '현직' && <RapoMeRow icon="/rapo/me/work-24.svg" href="/me/career">경력 수정</RapoMeRow>}
        {/* 학생·취준생 → 임상가 전환 (2026-11-15 세중님 · 근무 병원·입사 당시 스펙·근무 후기) */}
        {me.role === '학생' && <RapoMeRow icon="/rapo/me/work-24.svg" href="/me/convert">취업했어요 · 임상가 전환</RapoMeRow>}
        <RapoMeRow icon="/rapo/me/spec-24.svg" href="/me/spec">스펙 확인·수정</RapoMeRow>
        {/* 학생·취준생은 「취업 스펙 비교」(학생끼리 · app/spec/compare), 임상가는 「입사 스펙 비교」(준비 중) — 2026-11-17 세중님 */}
        {me.role === '학생'
          ? <RapoMeRow icon="/rapo/me/jobspec-24.svg" href={스펙비교길}>취업 스펙 비교</RapoMeRow>
          : <RapoMeRow icon="/rapo/me/compare-24.svg" href={준비('spec')}>입사 스펙 비교</RapoMeRow>}
        <RapoMeRow icon="/rapo/me/pay-24.svg" href={준비('paycmp')}>내 급여 비교</RapoMeRow>
      </RapoMeSection>

      <RapoMeSection title="내 활동과 희망 조건">
        <RapoMeRow icon="/rapo/me/save-24.svg" href="/me/saved">저장한 공고</RapoMeRow>
        <RapoMeRow icon="/rapo/me/hide-24.svg" href="/me/hidden">숨긴 공고</RapoMeRow>
        <RapoMeRow icon="/rapo/me/hospital-24.svg" href="/me/hospitals">관심 병원</RapoMeRow>
        <RapoMeRow icon="/rapo/me/pref-24.svg" href="/me/pref">희망 취업 조건</RapoMeRow>
        <RapoMeRow icon="/rapo/me/edu-24.svg" href="/me/edu">내 교육 관리</RapoMeRow>
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
          {/* 2026-11-19 세중님 「내 정보에서 통계 바로 가는 방법」 — 관리자로 가는 옛 위쪽 줄 「관리자」 단추가
              새 틀 화면(lib/nav.ts 새틀화면)에서는 안 그려져서, 주소를 직접 쳐야만 들어갈 수 있었습니다.
              보이는 것은 운영진뿐이고, 막는 자리는 여기가 아니라 관리자 화면·DB(is_admin) 입니다 */}
          {운영진 && <RapoMeRow icon="/rapo/me/compare-24.svg" href="/admin/stats">통계</RapoMeRow>}
          {운영진 && <RapoMeRow icon="/rapo/me/pref-24.svg" href="/admin">관리자 화면</RapoMeRow>}
        </RapoMeSection>
      )}

      <RapoMeSection title="설정">
        <RapoMeRow icon="/rapo/me/install-24.svg" href="/me/install">핸드폰에 설치하기</RapoMeRow>
        <RapoMeRow icon="/rapo/me/bell-24.svg" href="/me/notify">알림 설정</RapoMeRow>
        <RapoMeRow icon="/rapo/me/school-24.svg" href="/me/status">이용 상태 · 학적 정보</RapoMeRow>
        <RapoMeRow icon="/rapo/me/contact-24.svg" href="/contact">문의하기</RapoMeRow>
        <RapoMeRow icon="/rapo/me/report-24.svg" href="/me/reports">신고 센터</RapoMeRow>
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
    </div>
  );
}
