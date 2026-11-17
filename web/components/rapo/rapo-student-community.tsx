'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { KAKAO_CHANNEL } from '@/lib/contact';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoButton } from './rapo-ui';

/* 학생·취준생에게 커뮤니티 대신 보이는 안내 (2026-11-17 세중님 「학생, 취준생 포함 커뮤니티는 막아두자.
   추후에 본인인증, 학생인증을 한 사람들만 들어갈 수 있게」 · 「커뮤니티 누르면 학생인증을 준비하고 있어요! …
   알림을 받으시겠어요? 하고 알림받기 크게」).

   막는 자리는 DB 입니다(방볼수있나 · 방에쓸수있나 — 금고 SQL_1113/ZZB). 여기는 왜 안 보이는지 알리고 알림 신청을 받습니다.
   신청은 앱 출시 알림과 같은 표(출시알림신청)에 갈래 「학생커뮤니티」 한 줄 — 연락처는 안 받습니다. 다시 누르면 풉니다.
   견본(app/design-preview/…)은 저장 없이 모양만 봅니다. */
const 갈래 = '학생커뮤니티';

export function RapoStudentCommunityNotice({ 견본 = false }: { 견본?: boolean }) {
  const { session } = useAuth();
  const toast = useToast();
  const [on, setOn] = useState<boolean | null>(견본 ? false : null);
  const [바쁨, set바쁨] = useState(false);

  useEffect(() => {
    if (견본 || !session) return;
    browserSupabase().from('출시알림신청').select('켜짐').eq('갈래', 갈래).maybeSingle()
      .then(({ data }) => setOn(!!(data as { 켜짐?: boolean } | null)?.켜짐));
  }, [session, 견본]);

  const 누름 = async () => {
    if (on === null || 바쁨) return;
    if (견본) { setOn(!on); return; }
    set바쁨(true);
    const 다음 = !on;
    const { error } = await browserSupabase().rpc('출시알림신청하기', { p_갈래: 갈래, p_켤까: 다음 });
    set바쁨(false);
    if (error) { toast('신청하지 못했어요. 잠시 후 다시 눌러 주세요', { tone: 'danger', ms: 3500 }); return; }
    setOn(다음);
    toast(다음 ? '신청했어요. 열리면 알려 드릴게요' : '알림 신청을 취소했어요', { ms: 3000 });
  };

  return (
    <section className="flex flex-col gap-(--rapo-dimension-x5) p-(--rapo-dimension-x5) pt-(--rapo-dimension-x8)">
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">학생 커뮤니티</p>
        <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">학생인증을<br />준비하고 있어요!</h1>
        <p className="rapo-type-t6-regular break-keep text-(color:--rapo-color-fg-neutral)">익명으로 여러 학교 학생들과 얘기를 나눌 수 있어요.</p>
      </div>

      <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)">
          {on ? '알림을 신청했어요' : '알림을 받으시겠어요?'}
        </p>
        <RapoButton tone={on ? 'outline' : 'navy'} size={52} full loading={바쁨} onClick={누름}>
          {on ? '알림 신청됨 · 취소하기' : '알림 받기'}
        </RapoButton>
        <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {on ? '학생 커뮤니티가 열리면 RAPO 알림으로 알려 드릴게요.' : '신청하면 학생 커뮤니티가 열릴 때 RAPO 알림으로 알려 드려요.'}
        </p>
      </div>

      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        채용공고와 교육 일정, 병원 정보, 툴킷은 지금처럼 이용할 수 있어요.
      </p>
      <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer"
        className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral) underline underline-offset-2">
        궁금한 점은 카카오톡으로 문의하기
      </a>
    </section>
  );
}
