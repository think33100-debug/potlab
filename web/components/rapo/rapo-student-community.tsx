'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { KAKAO_CHANNEL } from '@/lib/contact';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoButton } from './rapo-ui';

/* 커뮤니티가 잠긴 회원에게 보이는 안내 + 오픈 알림 신청.
     학생·취준생  2026-11-17 세중님 「학생, 취준생 포함 커뮤니티는 막아두자. 추후에 본인인증, 학생인증을 한 사람들만 …」
                  「커뮤니티 누르면 학생인증을 준비하고 있어요! … 알림을 받으시겠어요? 하고 알림받기 크게」
     임상가        같은 날 「임상가도 커뮤니티 막자 일단. 추후에 연봉인증과 병원후기와 같이 열린다고 하자 · 그거 2개 해야지 열리게 할거야」

   막는 자리는 DB 입니다(방볼수있나 · 방에쓸수있나 — 금고 SQL_1113/ZZB · ZZC). 여기는 왜 안 보이는지 알리고 알림 신청을 받습니다.
   신청은 앱 출시 알림과 같은 표(출시알림신청)에 갈래 「학생커뮤니티」·「임상가커뮤니티」 한 줄 — 연락처는 안 받습니다. 다시 누르면 풉니다.
   견본(app/design-preview/student)은 저장 없이 모양만 봅니다. */
type 갈래 = '학생커뮤니티' | '임상가커뮤니티';
const 글: Record<갈래, { 머리: string; 제목: React.ReactNode; 소개: string; 물음: string; 열림: string; 열릴때: string }> = {
  학생커뮤니티: {
    머리: '학생 커뮤니티',
    제목: <>학생인증을<br />준비하고 있어요!</>,
    소개: '익명으로 여러 학교 학생들과 얘기를 나눌 수 있어요.',
    물음: '알림을 받으시겠어요?',
    열림: '학생 커뮤니티가 열리면', 열릴때: '학생 커뮤니티가 열릴 때',
  },
  임상가커뮤니티: {
    머리: '커뮤니티',
    제목: <>연봉 인증과 병원 후기를<br />준비하고 있어요!</>,
    /* 2026-11-17 세중님 문구 그대로 */
    소개: '익명 커뮤니티는 추후에 연봉 인증과 병원 후기 서비스를 제공하면서 같이 오픈 예정입니다.',
    물음: '서비스 시작할 때 바로 알려드릴까요?',
    열림: '커뮤니티가 열리면', 열릴때: '커뮤니티가 열릴 때',
  },
};

export function RapoStudentCommunityNotice({ 견본 = false, 견본갈래 }: { 견본?: boolean; 견본갈래?: 갈래 }) {
  const { session, me } = useAuth();
  const toast = useToast();
  const 내갈래: 갈래 = 견본갈래 ?? (me?.role === '현직' ? '임상가커뮤니티' : '학생커뮤니티');
  const c = 글[내갈래];
  const [on, setOn] = useState<boolean | null>(견본 ? false : null);
  const [바쁨, set바쁨] = useState(false);

  useEffect(() => {
    if (견본 || !session) return;
    browserSupabase().from('출시알림신청').select('켜짐').eq('갈래', 내갈래).maybeSingle()
      .then(({ data }) => setOn(!!(data as { 켜짐?: boolean } | null)?.켜짐));
  }, [session, 견본, 내갈래]);

  const 누름 = async () => {
    if (on === null || 바쁨) return;
    if (견본) { setOn(!on); return; }
    set바쁨(true);
    const 다음 = !on;
    const { error } = await browserSupabase().rpc('출시알림신청하기', { p_갈래: 내갈래, p_켤까: 다음 });
    set바쁨(false);
    if (error) { toast('신청하지 못했어요. 잠시 후 다시 눌러 주세요', { tone: 'danger', ms: 3500 }); return; }
    setOn(다음);
    toast(다음 ? '신청했어요. 열리면 알려 드릴게요' : '알림 신청을 취소했어요', { ms: 3000 });
  };

  return (
    <section className="flex flex-col gap-(--rapo-dimension-x5) p-(--rapo-dimension-x5) pt-(--rapo-dimension-x8)">
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">{c.머리}</p>
        <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">{c.제목}</h1>
        <p className="rapo-type-t6-regular break-keep text-(color:--rapo-color-fg-neutral)">{c.소개}</p>
      </div>

      <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r4) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
        <p className="rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)">
          {on ? '알림을 신청했어요' : c.물음}
        </p>
        <RapoButton tone={on ? 'outline' : 'navy'} size={52} full loading={바쁨} onClick={누름}>
          {on ? '알림 신청됨 · 취소하기' : '알림 받기'}
        </RapoButton>
        <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
          {on ? `${c.열림} RAPO 알림으로 알려 드릴게요.` : `신청하면 ${c.열릴때} RAPO 알림으로 알려 드려요.`}
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
