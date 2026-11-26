'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoSpecCompareBody, type 스펙비교값 } from '@/components/rapo/rapo-spec-compare';
import { browserSupabase } from '@/lib/supabase-browser';

/* 취업 스펙 비교 — 학생·취준생끼리 (2026-11-17 세중님 「학생용으로 취업 스펙 비교 · 학생들이 넣은 점수들로 서로 비교 ·
   20명 되면 보여주자」). 툴킷 · 홈 · 내 정보 · 가입 끝 화면이 여기로 옵니다(components/rapo/rapo-spec-entry.tsx).

   자료는 DB 창구 「취업스펙비교」 하나 (금고 SQL_1113/ZZB) — 내 총점 · 같은 직군에서 스펙(학점)을 넣은 학생 수 ·
   20명부터 「상위 몇 %」. 남의 점수나 이름은 오지 않습니다.
     스펙을 아직 안 넣음(재학 중 가입은 건너뜁니다)  → 넣으라는 안내와 「취업 스펙 입력하기」(/me/spec)
     넣음 · 20명 미만                              → 내 점수 + 「○명 더 모이면 비교가 열려요」
     넣음 · 20명 이상                              → 내 점수 + 「취업 준비생 ○명 중 상위 ○%」
   임상가는 이 화면 대신 「입사 스펙 비교」(준비 중)로 넘깁니다. */

type 받은것 = 스펙비교값;

export default function SpecCompare() {
  const router = useRouter();
  const { me } = useAuth();
  const [v, setV] = useState<받은것 | null>(null);
  const [못읽음, set못읽음] = useState(false);
  const 임상가 = me?.role === '현직';

  useEffect(() => {
    if (!me) return;
    if (임상가) { router.replace('/me/soon?k=spec'); return; }
    browserSupabase().rpc('취업스펙비교').then(({ data, error }) => {
      const d = data as Partial<받은것> | null;
      if (error || !d || typeof d.있음 !== 'boolean') { set못읽음(true); return; }
      setV({ 있음: d.있음, 점수: d.점수 ?? null, 사람: d.사람 ?? 0, 최소: d.최소 ?? 20, 상위: d.상위 ?? null });
    });
  }, [me, 임상가, router]);

  return (
    <RapoMeFrame title="취업 스펙 비교" back="/toolkit">
      {() => <RapoSpecCompareBody v={v} 못읽음={못읽음} />}
    </RapoMeFrame>
  );
}
