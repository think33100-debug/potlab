'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';

/* 알림함 (2026-10-09 · 뼈대 8절).
 *
 * 푸시(알림기기)는 **기기에 띄우는 것**이고, 이것은 **앱 안에 쌓이는 것**입니다.
 * 푸시를 꺼 둔 분도 여기서는 다 봅니다. 푸시를 못 받는 기기도 마찬가지입니다.
 *
 * 넣는 것은 DB 창구(알림넣기)뿐입니다 — 회원은 남에게 못 보냅니다.
 */

type 알림 = {
  id: number; 갈래: string; 제목: string; 본문: string | null;
  링크: string | null; 읽은때: string | null; 만든때: string;
};

const 날 = (s: string) => new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Alarm() {
  const { loading, session } = useAuth();
  const [줄들, set줄들] = useState<알림[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    sb.rpc('내알림', { p_몇줄: 50 }).then(({ data }) => {
      if (!살아있나) return;
      set줄들((data ?? []) as 알림[]);
      /* 열었으면 읽은 것으로 둡니다 */
      sb.rpc('알림읽음', { p_id: null });
    });
    return () => { 살아있나 = false; };
  }, [session]);

  /* 2026-11-16 — 옛 위쪽 줄(POTJOB 로고)의 종에서만 오던 화면이라 새 화면에서는 안 오지만, 주소로 열려서 새 틀로 옮겼습니다.
     읽는 길(내알림 · 알림읽음)은 그대로입니다 */
  if (loading) {
    return <RapoPageFrame title="알림" back="/me"><RapoWait /></RapoPageFrame>;
  }

  if (!session) {
    return (
      <RapoPageFrame title="알림" back="/">
        <p className={틀.흐린글 + ' pt-(--rapo-dimension-x6)'}>로그인하시면 알림을 모아 보여드려요.</p>
        <RapoButton href="/login" tone="navy" full>로그인</RapoButton>
      </RapoPageFrame>
    );
  }

  /* ★ 2026-10-11 — 회원 모두에게 열었습니다 (세중님 결정).
     막는 자리는 창구입니다 — 내알림()·알림읽음() 이 auth.uid() 로 자기 것만 줍니다 */

  return (
    <RapoPageFrame title="알림" back="/me" nav="/me">
      {줄들 === null ? <RapoWait />
        : 줄들.length === 0
          ? <p className={틀.흐린글 + ' pt-(--rapo-dimension-x6)'}>아직 알림이 없어요.</p>
          : (
            <ul className="flex flex-col gap-(--rapo-dimension-x2)">
              {줄들.map((n) => {
                const 속 = (
                  <>
                    <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                      {!n.읽은때 && <span aria-label="안 읽음" className="size-2 shrink-0 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-deep-coral)" />}
                      <b className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{n.제목}</b>
                      <span className="rapo-type-t3-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{날(n.만든때)}</span>
                    </p>
                    {n.본문 && <p className={틀.흐린글 + ' mt-(--rapo-dimension-x1)'}>{n.본문}</p>}
                  </>
                );
                return (
                  <li key={n.id} className={틀.카드}>
                    {n.링크 ? <Link href={n.링크} className="block">{속}</Link> : 속}
                  </li>
                );
              })}
            </ul>
          )}
    </RapoPageFrame>
  );
}
