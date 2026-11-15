'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { RapoFormFrame, RapoFormTitle, 골라, 기본칸, 남은횟수, 병원찾기칸, 연도들, use내스펙 } from '@/components/rapo/rapo-spec-form';
import { browserSupabase } from '@/lib/supabase-browser';

/* 경력 수정 — 피그마 「12 · 내 정보」 1815:3947 「경력 수정 · 근무 병원과 입사 연도」 (2026-11-15 세중님 「경력 수정이랑 스펙 확인 수정이랑 같아」).
   전에는 「경력 수정」·「스펙 확인·수정」이 둘 다 /me/spec(옛 급여·스펙 설문)으로 갔습니다.
   저장은 save_my_survey — 바꾸지 않는 기본 칸은 옛 값 그대로 실어 보냅니다(rapo-spec-form 의 기본칸).
   경력도 「1년에 2번 고치기」에 들어갑니다 — 근무 병원을 자주 바꾸면 여러 병원에 근무 후기를 쓸 수 있게 되기 때문입니다. */

export default function MyCareer() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload } = useAuth();
  const { v, err } = use내스펙();
  const [병원, set병원] = useState('');
  const [연도, set연도] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/me/career'); }, [loading, session, router]);
  useEffect(() => {
    if (!v?.spec) return;
    set병원(v.spec.근무병원 ?? '');
    set연도(v.spec.입사연도 ? String(v.spec.입사연도) : '');
  }, [v]);

  /* 옛 가입(근무경험 칸이 빈 현직)도 여기서 경력을 적습니다 — 전환 화면은 현직을 받지 않아 막다른 길이 됐음 (2026-11-15 운영 점검) */
  const 경력 = !!v?.spec?.근무경험 || me?.role === '현직';
  const 됨 = !!병원.trim() && !!연도 && (v?.남은 ?? 0) > 0;
  const 저장 = async () => {
    if (!됨 || busy || !v) return;
    setBusy(true);
    const spec = { ...기본칸(v.spec), 근무경험: true, 근무병원: 병원.trim(), 입사연도: Number(연도) };
    const { error } = await browserSupabase().rpc('save_my_survey', { p_salary: null, p_spec: spec, p_langs: null });
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    await reload();
    toast('경력을 저장했어요');
    router.replace('/me');
  };

  return (
    <RapoFormFrame title="경력 수정" back="/me"
      아래={v?.spec && 경력 ? <RapoButton full onClick={저장} disabled={!됨 || busy}>{busy ? '저장하는 중…' : '경력 저장하기'}</RapoButton> : undefined}>
      {v === undefined ? (
        <p role="status" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>
      ) : !v?.spec || !경력 ? (
        <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
          <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">등록한 근무 경력이 없어요</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{err ?? '취업했다면 임상가 전환에서 근무 병원과 입사 당시 스펙을 등록해 주세요.'}</p>
          <Link href="/me/convert" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">임상가 전환 ›</Link>
        </section>
      ) : (
        <>
          <RapoFormTitle>근무 경력을 수정해요</RapoFormTitle>
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            <병원찾기칸 label="근무 병원" v={병원} on={set병원} />
            <골라 label="입사 연도" v={연도} ph="입사 연도를 선택해 주세요" 붙임="년" opts={연도들()} on={set연도} />
            <남은횟수 n={v.남은} />
          </section>
        </>
      )}
    </RapoFormFrame>
  );
}
