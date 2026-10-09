'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';

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
  const { loading, session, isAdmin } = useAuth();
  const [줄들, set줄들] = useState<알림[] | null>(null);

  useEffect(() => {
    if (!session || !isAdmin) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    sb.rpc('내알림', { p_몇줄: 50 }).then(({ data }) => {
      if (!살아있나) return;
      set줄들((data ?? []) as 알림[]);
      /* 열었으면 읽은 것으로 둡니다 */
      sb.rpc('알림읽음', { p_id: null });
    });
    return () => { 살아있나 = false; };
  }, [session, isAdmin]);

  if (loading) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  if (!session) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <h1 className="break-keep text-h1 font-bold">알림</h1>
        <p className="mt-3 break-keep text-lg text-mute">로그인하시면 알림을 모아 보여드려요.</p>
        <Link href="/login" className="mt-7 inline-block rounded-md bg-brand-red px-6 py-4
                                       text-btn font-bold text-white hover:bg-brand-red-dark">
          로그인
        </Link>
      </main>
    );
  }

  /* 알림함은 2026-10-09 에 만든 기능입니다. 새 기능은 관리자·마스터에게만
     보이게 숨겨서 배포합니다 — 탑바의 종도 같은 기준으로 가려 뒀습니다 */
  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">아직 준비 중이에요</p>
        <Link href="/" className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                                  text-lg font-medium text-gray-600 hover:bg-gray-50">홈으로</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 관리자와 마스터(관리자 페르소나)에게만 보입니다
      </p>
      <h1 className="mt-5 break-keep text-h1 font-bold">알림</h1>

      {줄들 === null ? <p className="mt-6 text-lg text-mute">잠시만요…</p>
        : 줄들.length === 0
          ? <p className="mt-6 break-keep text-lg text-mute">아직 알림이 없어요.</p>
          : (
            <ul className="mt-6 space-y-2">
              {줄들.map((n) => {
                const 속 = (
                  <>
                    <p className="flex flex-wrap items-center gap-2">
                      {!n.읽은때 && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-red" />}
                      <b className="break-keep text-lg">{n.제목}</b>
                      <span className="text-sm text-mute">{날(n.만든때)}</span>
                    </p>
                    {n.본문 && <p className="mt-1 break-keep text-lg text-mute">{n.본문}</p>}
                  </>
                );
                return (
                  <li key={n.id} className="rounded-sm border border-gray-200 p-5">
                    {n.링크 ? <Link href={n.링크} className="block">{속}</Link> : 속}
                  </li>
                );
              })}
            </ul>
          )}
    </main>
  );
}
