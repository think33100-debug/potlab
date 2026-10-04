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

const 직군색: Record<string, string> = {
  작업치료사: 'bg-badge-teal-bg text-gray-700',
  물리치료사: 'bg-gray-100 text-gray-600',
  공통: 'bg-gray-100 text-gray-600',
};

/* 그림이 없을 때 쓰는 기본 카드 — 이름 첫 두 글자를 크게.
   「대한연하재활학회」면 「연하」처럼, 알아보기 쉬운 쪽을 고릅니다 */
function 글자카드({ 이름 }: { 이름: string }) {
  const 글 = 이름.replace(/^(대한|한국|국제)/, '').slice(0, 2) || 이름.slice(0, 2);
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-sm
                    bg-badge-teal-bg text-body-lg font-bold text-gray-700">
      {글}
    </div>
  );
}

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
      <div className="flex items-start gap-4">
        {o.그림
          ? <img src={o.그림} alt="" className="size-14 shrink-0 rounded-sm object-cover" />
          : <글자카드 이름={o.이름} />}

        <div className="min-w-0 flex-1">
          <p className="break-keep text-body-lg font-bold text-ink">{o.이름}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className={'rounded-xs px-3 py-1 ' + (직군색[o.직군] ?? 직군색.공통)}>
              {o.직군 === '공통' ? '작업·물리치료' : o.직군.replace(/사$/, '')}
            </span>
            {o.모음
              ? <span className="text-mute">열린 교육 <b className="text-ink">{o.열린교육}</b></span>
              : <span className="text-mute">링크만 겁니다</span>}
          </p>
          {/* 최근 = 그 기관 교육의 가장 늦은 「시작일(없으면 올린날)」입니다.
              앞으로 열릴 교육이면 그 날이 **오늘보다 뒤**라서,
              「최근 10월 19일」이라고 쓰면 거짓말이 됩니다 (2026-10-04 고침) */}
          {o.최근 && (
            <p className="mt-1 text-sm text-mute">
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
          className={'shrink-0 rounded-xs border px-3 py-2 text-sm font-medium '
            + (on
              ? 'border-teal-strong bg-teal-strong text-white'
              : 'border-line text-mute hover:bg-paper')}
        >
          {on ? '알림 켜짐' : '알림'}
        </button>
      </div>

      {o.소개 && (
        <p className="mt-3 line-clamp-2 break-keep text-lg text-mute">{o.소개}</p>
      )}
    </>
  );

  /* 모으는 기관은 우리 상세로, 링크만 거는 곳은 그 기관 화면으로 */
  return o.모음 ? (
    <Link href={`/edu/org/${encodeURIComponent(o.이름)}`}
      className="block rounded-sm border border-line bg-card p-6 hover:bg-paper">
      {속}
    </Link>
  ) : (
    <a href={o.링크주소 ?? o.누리집 ?? '#'} target="_blank" rel="noopener noreferrer"
      className="block rounded-sm border border-line bg-card p-6 hover:bg-paper">
      {속}
      <p className="mt-3 text-lg font-bold text-brand-red">기관 화면에서 보기 ›</p>
    </a>
  );
}
