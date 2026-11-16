'use client';

import Link from 'next/link';
import { useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 교육기관 카드 한 장 (2026-10-04).

   병원 정보 찾기(/orgs)처럼 카드뉴스 꼴로 한 장씩 보여줍니다.

   ⚷ **남의 누리집 로고를 가져오지 않습니다.**
     대표 그림은 관리자가 올린 것만 씁니다. 없으면 이름 글자로 된
     기본 카드로 보입니다 — 남의 상표를 함부로 쓰면 안 됩니다.

   알림 종은 로그인한 회원만 켤 수 있습니다. 비로그인이 누르면
   로그인 안내로 보냅니다. */

export type 기관 = {
  이름: string; 직군: string; 소개: string | null; 그림: string | null;
  누리집: string | null; 모음: boolean; 링크주소: string | null;
  열린교육: number; 최근: string | null;
};

/* 2026-11-16 — 교육기관 화면(/edu/org)을 새 틀로 옮기며 카드도 RAPO 토큰으로 바꿨습니다(옛 teal·gray 를 남기지 않음 · 화면표시 규칙 6).
   알림 종 동작·링크 갈래는 그대로입니다 */
const 직군색: Record<string, string> = {
  작업치료사: 'bg-(--rapo-brand-color-blush) text-(color:--rapo-color-fg-neutral)',
  물리치료사: 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)',
  공통: 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)',
};

/* 그림이 없을 때 쓰는 기본 카드 — 이름 첫 두 글자를 크게.
   「대한연하재활학회」면 「연하」처럼, 알아보기 쉬운 쪽을 고릅니다 */
function 글자카드({ 이름 }: { 이름: string }) {
  const 글 = 이름.replace(/^(대한|한국|국제)/, '').slice(0, 2) || 이름.slice(0, 2);
  return (
    <div className="rapo-type-t5-bold flex size-14 shrink-0 items-center justify-center whitespace-nowrap rounded-(--rapo-radius-r2)
                    bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-brand-color-navy)">
      {글}
    </div>
  );
}

const 카드 = 'block rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) '
  + 'bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5) active:bg-(--rapo-color-bg-layer-default-pressed)';

export function EduOrgCard({ o, 켜짐, 로그인했나, 오늘 }: {
  o: 기관; 켜짐: boolean; 로그인했나: boolean;
  /* 서버에서 잰 한국 날짜 (YYYY-MM-DD). 여기서 재면 서버와 어긋납니다 */
  오늘: string;
}) {
  const [on, setOn] = useState(켜짐);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const 종누름 = async (e: React.MouseEvent) => {
    e.preventDefault();          // 카드 링크를 따라가지 않게
    e.stopPropagation();
    if (!로그인했나) { toast('로그인하면 새 교육이 올라올 때 알려드려요'); return; }
    if (busy) return;
    setBusy(true);
    const 다음 = !on;
    const { error } = await browserSupabase()
      .rpc('교육기관알림켜기', { p_기관: o.이름, p_켤까: 다음 });
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    setOn(다음);
    toast(다음 ? `${o.이름} 새 교육을 알려드릴게요` : '알림을 껐어요');
  };

  const 속 = (
    <>
      <div className="flex items-start gap-(--rapo-dimension-x3)">
        {o.그림
          ? <img src={o.그림} alt="" className="size-14 shrink-0 rounded-(--rapo-radius-r2) object-cover" />
          : <글자카드 이름={o.이름} />}

        <div className="min-w-0 flex-1">
          <p className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{o.이름}</p>
          <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) flex flex-wrap items-center gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">
            <span className={'rapo-type-t2-medium whitespace-nowrap rounded-(--rapo-radius-r1) px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) ' + (직군색[o.직군] ?? 직군색.공통)}>
              {o.직군 === '공통' ? '작업·물리치료' : o.직군.replace(/사$/, '')}
            </span>
            {o.모음
              ? <span className="whitespace-nowrap">열린 교육 <b className="text-(color:--rapo-color-fg-neutral)">{o.열린교육}</b></span>
              : <span className="whitespace-nowrap">링크만 겁니다</span>}
          </p>
          {/* 최근 = 그 기관 교육의 가장 늦은 「시작일(없으면 올린날)」입니다.
              앞으로 열릴 교육이면 그 날이 **오늘보다 뒤**라서,
              「최근 10월 19일」이라고 쓰면 거짓말이 됩니다 (2026-10-04 고침) */}
          {o.최근 && (
            <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">
              {o.최근 > 오늘 ? '다음 일정' : '최근'}{' '}
              {Number(o.최근.slice(5, 7))}월 {Number(o.최근.slice(8, 10))}일
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={종누름}
          aria-pressed={on}
          aria-label={on ? '알림 끄기' : '새 교육 알림 켜기'}
          className={'rapo-type-t3-medium flex h-(--rapo-dimension-x8) shrink-0 items-center whitespace-nowrap rounded-(--rapo-radius-full) border-(length:--rapo-border-default) px-(--rapo-dimension-x3) '
            + (on
              ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)'
              : 'border-(color:--rapo-color-stroke-neutral-muted) text-(color:--rapo-color-fg-neutral-muted) active:bg-(--rapo-color-bg-transparent-pressed)')}
        >
          {on ? '알림 켜짐' : '알림'}
        </button>
      </div>

      {o.소개 && (
        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x3) line-clamp-2 break-keep text-(color:--rapo-color-fg-neutral-muted)">{o.소개}</p>
      )}
    </>
  );

  /* 모으는 기관은 우리 상세로, 링크만 거는 곳은 그 기관 화면으로 */
  return o.모음 ? (
    <Link href={`/edu/org/${encodeURIComponent(o.이름)}`} className={카드}>
      {속}
    </Link>
  ) : (
    <a href={o.링크주소 ?? o.누리집 ?? '#'} target="_blank" rel="noopener noreferrer" className={카드}>
      {속}
      <p className="rapo-type-t4-bold mt-(--rapo-dimension-x3) text-(color:--rapo-color-fg-brand-contrast)">기관 화면에서 보기 ›</p>
    </a>
  );
}
