'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 대화 한 방 (2026-10-09).
 *
 * ── 사진은 한 번 보면 사라집니다 ─────────────────────────────
 * 열면 바로 대화읽음() 을 불러 「봤다」고 적습니다. 그다음부터 그 사진의
 * 경로는 창구가 안 줍니다 — 화면에 「사진이 사라졌어요」만 남습니다.
 * 보낸 사람은 자기 사진을 계속 봅니다 (자기가 뭘 보냈는지는 알아야 합니다).
 *
 * ── 신고 ─────────────────────────────────────────────────────
 * 신고하면 reports 에 target_type='chat' 으로 들어갑니다. 신고된 방은
 * 밤정리가 안 지웁니다 (그 SQL 은 승인 대기).
 */

type 줄 = {
  id: number; 나인가: boolean; 글: string | null;
  사진: string | null; 사진사라짐: boolean; 쓴때: string;
};

const 때 = (s: string) => new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });

export default function TalkRoom() {
  const { room } = useParams<{ room: string }>();
  const 방 = Number(room);
  const { loading, session } = useAuth();
  const [줄들, set줄들] = useState<줄[]>([]);
  const [글, set글] = useState('');
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    if (!session || !Number.isFinite(방)) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    sb.rpc('대화읽기', { p_방: 방, p_몇줄: 100 }).then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      set탈(null);
      set줄들((data ?? []) as 줄[]);
      sb.rpc('대화읽음', { p_방: 방 });
    });
    return () => { 살아있나 = false; };
  }, [session, 방, 다시]);

  if (loading) return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;

  const 보내기 = async () => {
    const t = 글.trim();
    if (!t) return;
    const { error } = await browserSupabase()
      .rpc('대화보내기', { p_방: 방, p_글: t, p_사진: null });
    if (error) { set탈(error.message); return; }
    set글('');
    set다시((n) => n + 1);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[140px] md:px-7">
      <Link href="/talk" className="text-lg text-interaction-blue hover:underline">← 대화 목록</Link>

      {탈 && <p className="mt-5 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      <ul className="mt-6 space-y-3">
        {줄들.map((m) => (
          <li key={m.id} className={m.나인가 ? 'text-right' : ''}>
            <div className={'inline-block max-w-[80%] rounded-sm px-5 py-3 text-left ' +
              (m.나인가 ? 'bg-brand-red-soft' : 'bg-gray-100 dark:bg-gray-800')}>
              {m.글 && <p className="break-keep text-lg">{m.글}</p>}
              {m.사진사라짐 && (
                <p className="break-keep text-lg text-mute">사진이 사라졌어요</p>
              )}
              {m.사진 && !m.사진사라짐 && (
                <p className="break-keep text-lg text-mute">사진 1장</p>
              )}
              <p className="mt-1 text-sm text-mute">{때(m.쓴때)}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-[62px] border-t border-gray-200 bg-white/95 px-6 py-3
                      backdrop-blur md:bottom-0 md:px-7 dark:bg-gray-900/95">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <input
            value={글} onChange={(e) => set글(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') 보내기(); }}
            placeholder="할 말을 적어 주세요"
            className="min-w-0 flex-1 rounded-sm border border-gray-200 px-5 py-3 text-lg" />
          <button type="button" onClick={보내기}
            className="shrink-0 rounded-md bg-brand-red px-6 py-3 text-lg font-bold text-white
                       hover:bg-brand-red-dark">
            보내기
          </button>
        </div>
      </div>
    </main>
  );
}
