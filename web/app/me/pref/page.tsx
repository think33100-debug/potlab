'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { RapoFormFrame, RapoFormTitle, 골라, 희망유형들, 희망지역들, use내스펙 } from '@/components/rapo/rapo-spec-form';
import { browserSupabase } from '@/lib/supabase-browser';

/* 희망 취업 조건 — 피그마 「12 · 내 정보」 1442:1436 「희망 기관 유형·지역 수정」 (2026-11-15).
   전에는 「오픈 전」 안내(/me/soon?k=pref)였습니다. 값은 가입 때 이미 받고 있었습니다(student_specs.want_type·want_region).
   저장은 내희망바꾸기() — 「1년에 2번 고치기」를 깎지 않습니다(금고 SQL_1113/ZV). */

export default function MyPref() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session } = useAuth();
  const { v, err } = use내스펙();
  const [유형, set유형] = useState('');
  const [지역, set지역] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !session) router.replace('/login?next=/me/pref'); }, [loading, session, router]);
  useEffect(() => { if (v?.spec) { set유형(v.spec.want_type ?? ''); set지역(v.spec.want_region ?? ''); } }, [v]);

  const 됨 = !!유형 && !!지역;
  const 저장 = async () => {
    if (!됨 || busy) return;
    setBusy(true);
    const { error } = await browserSupabase().rpc('내희망바꾸기', { p_유형: 유형, p_지역: 지역 });
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('희망 취업 조건을 저장했어요');
    router.replace('/me');
  };

  return (
    <RapoFormFrame title="희망 취업 조건" back="/me" 아래={v?.spec ? (
      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        <RapoButton full onClick={저장} disabled={!됨 || busy}>{busy ? '저장하는 중…' : '저장'}</RapoButton>
        <RapoButton full tone="outline" onClick={() => router.push('/me')}>취소</RapoButton>
      </div>
    ) : undefined}>
      {v === undefined ? (
        <p role="status" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">잠시만요…</p>
      ) : !v?.spec ? (
        <section className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
          <p className="rapo-type-t9-bold break-keep text-(color:--rapo-color-fg-neutral)">등록한 스펙이 없어요</p>
          <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{err ?? '가입 때 스펙을 등록하면 희망 조건도 고를 수 있어요.'}</p>
          <Link href="/welcome" className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">스펙 등록하기 ›</Link>
        </section>
      ) : (
        <>
          <RapoFormTitle sub="희망 지역과 기관 유형에 맞는 공고를 먼저 보여드려요.">어디에서 일하고 싶으세요?</RapoFormTitle>
          <section className="mt-(--rapo-dimension-x6) flex flex-col gap-(--rapo-dimension-x5)">
            <골라 label="희망 기관 유형" v={유형} opts={희망유형들} ph="기관 유형 선택" on={set유형} />
            <골라 label="희망 지역" v={지역} opts={희망지역들} ph="지역 선택" on={set지역} />
          </section>
        </>
      )}
    </RapoFormFrame>
  );
}
