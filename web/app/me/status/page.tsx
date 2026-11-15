'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { browserSupabase } from '@/lib/supabase-browser';
import { todayKst } from '@/lib/job-state';
import { 날말, 무료끝날, 연월말, 연월읽기, 졸업연월 } from '@/lib/school-period';

/* 이용 상태 · 학적 정보 — 내 정보 (2026-11-15 · 피그마 12 「03 이용 상태와 학적」).
   가입 때 적은 학력·학적·입학 연월로 졸업 시점과 무료 열람 끝날을 보여 줍니다(lib/school-period.ts · 가입 화면과 같은 셈).
   학적·입학 연월은 회원이 직접 못 바꿉니다 — 피그마 「변경은 운영자 문의」 → 문의하기.
   ★ 무료 기간이 끝나도 지금은 막는 장치가 없습니다(보여 주기만). */

type 스펙 = { school_type: string | null; 학적: string | null; 입학연월: string | null; 근무경험: boolean | null; 근무병원: string | null; 입사연도: number | null };

export default function MyStatus() {
  return <RapoMeFrame title="이용 상태 · 학적 정보">{(me) => <Body role={me.role} />}</RapoMeFrame>;
}

function Body({ role }: { role: string | null }) {
  const [s, setS] = useState<스펙 | null | undefined>(undefined);
  useEffect(() => {
    browserSupabase().from('student_specs').select('school_type,학적,입학연월,근무경험,근무병원,입사연도').maybeSingle()
      .then(({ data }) => setS((data as unknown as 스펙 | null) ?? null));
  }, []);

  if (s === undefined) return <p className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>;

  const 현직 = role === '현직' || s?.근무경험 === true;
  const 졸업 = s?.school_type ? 졸업연월(s.school_type, 연월읽기(s.입학연월)) : null;
  const 끝날 = 무료끝날(졸업);
  const 끝남 = !!끝날 && 끝날 < todayKst();

  const 줄 = (k: string, v: string) => (
    <div className="flex gap-(--rapo-dimension-x4)">
      <dt className="rapo-type-t4-regular w-[96px] shrink-0 text-(color:--rapo-color-fg-neutral-muted)">{k}</dt>
      <dd className="rapo-type-t5-bold min-w-0 break-keep text-(color:--rapo-color-fg-neutral)">{v}</dd>
    </div>
  );

  return (
    <section className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x4)">
      <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-positive-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">이용 상태</p>
        <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-positive)">
          {현직 ? '임상가 회원' : 끝날 && !끝남 ? `${날말(끝날)}까지 무료 이용` : 끝남 ? '무료 열람 기간 종료' : '학생·취준생 회원'}
        </p>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
          {현직 ? '근무 정보를 등록해 비교 정보와 커뮤니티를 이용할 수 있어요.'
            : 끝날 ? '선택한 학력과 입학 연월로 계산한 졸업 시점을 기준으로 해요.' : '학적 정보가 없으면 졸업 기준 무료 열람 기간이 적용되지 않아요.'}
        </p>
      </div>

      <dl className="flex flex-col gap-(--rapo-dimension-x4) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
        {줄('학력', s?.school_type ?? '입력 정보 없음')}
        {!현직 && 줄('학적', s?.학적 === '재학' ? '재학 중' : s?.학적 === '졸업' ? '졸업' : '입력 정보 없음')}
        {!현직 && 줄('입학 연월', 연월읽기(s?.입학연월) ? 연월말(연월읽기(s!.입학연월)!) : '입력 정보 없음')}
        {!현직 && 졸업 && 줄(s?.학적 === '졸업' ? '졸업 연월' : '졸업 예정', 연월말(졸업))}
        {현직 && 줄('근무 병원', s?.근무병원 ?? '입력 정보 없음')}
        {현직 && 줄('입사연도', s?.입사연도 ? `${s.입사연도}년` : '입력 정보 없음')}
      </dl>

      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        학적과 입학 연월은 직접 바꿀 수 없어요. 휴학 등으로 달라졌다면 운영자에게 알려 주세요.
      </p>
      <Link href="/contact" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-brand-contrast)">문의하기 ›</Link>
      {!현직 && <Link href="/me/spec" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">근무 경험이 생겼다면 정보 등록 ›</Link>}
    </section>
  );
}
