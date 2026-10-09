'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '@/components/avatar';
import { browserSupabase } from '@/lib/supabase-browser';

/* 1:1 대화 목록 (2026-10-09 · 뼈대 6절).
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 관리자·마스터에게만 보입니다. 세중님이 눌러 보고 괜찮다 하시면 엽니다.
 *
 * ── 상대가 수락해야 시작됩니다 ───────────────────────────────
 * 말을 걸면 「신청」입니다. 받은 사람이 받을지 안 받을지 고릅니다.
 * 안 받으면 그 방은 양쪽 목록에서 사라집니다.
 *
 * ── 사진은 한 번 보면 사라집니다 ─────────────────────────────
 * 상대가 열면 그 순간부터 경로가 안 나갑니다 (대화읽기 창구가 안 줍니다).
 * 서버에서 지우는 것은 밤정리 몫이고, 그 SQL 은 승인 대기입니다.
 */

type 방 = {
  방: number; 상대: string; 상대아바타: string | null; 상태: string;
  건사람인가: boolean; 마지막: string | null; 마지막때: string | null; 안읽음: number;
};

const 날 = (s: string | null) => (!s ? '' : new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));

export default function Talk() {
  const { loading, session, isAdmin } = useAuth();
  const [마스터, set마스터] = useState(false);
  const [방들, set방들] = useState<방[]>([]);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    Promise.all([sb.rpc('내페르소나'), sb.rpc('내대화')]).then(([a, b]) => {
      if (!살아있나) return;
      set마스터(!a.error && (a.data as { 마스터?: boolean } | null)?.마스터 === true);
      if (!b.error) set방들((b.data ?? []) as 방[]);
    });
    return () => { 살아있나 = false; };
  }, [session, 다시]);

  if (loading) return <main className="mx-auto w-full max-w-2xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;

  if (!isAdmin && !마스터) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">아직 준비 중이에요</p>
        <Link href="/" className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                                  text-lg font-medium text-gray-600 hover:bg-gray-50">홈으로</Link>
      </main>
    );
  }

  const 정하기 = async (r: 방, 받나: boolean) => {
    const { error } = await browserSupabase()
      .rpc('대화정하기', { p_방: r.방, p_받나: 받나 });
    if (error) { alert(error.message); return; }
    set다시((n) => n + 1);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 관리자와 마스터에게만 보입니다
      </p>
      <h1 className="mt-5 break-keep text-h1 font-bold">대화</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        말을 걸면 상대가 받을지 고릅니다. 사진은 상대가 한 번 보면 사라져요.
      </p>

      {방들.length === 0
        ? <p className="mt-7 break-keep text-lg text-mute">아직 대화가 없어요.</p>
        : (
          <ul className="mt-7 space-y-2">
            {방들.map((r) => (
              <li key={r.방} className="rounded-sm border border-gray-200 p-5">
                <div className="flex items-center gap-3">
                  <Avatar value={r.상대아바타} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-lg">{r.상대}</b>
                      {r.상태 === '신청' && (
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">
                          {r.건사람인가 ? '기다리는 중' : '받을까요'}
                        </span>
                      )}
                      {r.안읽음 > 0 && (
                        <span className="rounded-full bg-brand-red px-2 text-[13px] font-bold text-white">
                          {r.안읽음}
                        </span>
                      )}
                      <span className="text-sm text-mute">{날(r.마지막때)}</span>
                    </span>
                    {r.마지막 && (
                      <span className="mt-1 block truncate text-lg text-mute">{r.마지막}</span>
                    )}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.상태 === '수락' && (
                    <Link href={`/talk/${r.방}`}
                      className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                      열기
                    </Link>
                  )}
                  {r.상태 === '신청' && !r.건사람인가 && (
                    <>
                      <button type="button" onClick={() => 정하기(r, true)}
                        className="rounded-md bg-brand-red px-5 py-2 text-lg font-bold text-white
                                   hover:bg-brand-red-dark">
                        받기
                      </button>
                      <button type="button" onClick={() => 정하기(r, false)}
                        className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                        안 받기
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </main>
  );
}
