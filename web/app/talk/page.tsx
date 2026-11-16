'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { Avatar } from '@/components/avatar';
import { RapoClosed, RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';
import { 대화닫힘안내, 대화열렸나 } from '@/lib/talk';

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

/* ★ 2026-11-02 세중님 — 오픈 때 1:1 대화는 **닫습니다**.
   아래 대화목록() 은 그대로 두고 **문 앞에서 돌려보냅니다** — 주소를 직접 쳐도
   창구를 안 부르니 아무것도 안 보입니다. 다시 열 때는 lib/talk.ts 의 한 줄입니다.
   (여기서 바로 return 하면 아래 훅들이 조건부가 되어 린트가 막습니다 —
    그래서 **쪽을 감싸는 꼴**로 둡니다) */
export default function Talk() {
  if (!대화열렸나) {
    /* 2026-11-16 — 주소로 열면 옛 위쪽 줄(POTJOB 로고)이 보여 새 틀 안내로 바꿨습니다 */
    return <RapoClosed title={대화닫힘안내.제목} body={대화닫힘안내.본문} />;
  }
  return <TalkList />;
}

function TalkList() {
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

  if (loading) return <RapoPageFrame title="대화" back="/me"><RapoWait /></RapoPageFrame>;

  /* ★ 2026-10-11 — 회원에게 열었습니다 (세중님 결정).
     1:1 대화 — 회원끼리 말합니다.
     막는 자리는 화면이 아니라 창구입니다 (docs/인계/05_부록.md 2절) */

  const 정하기 = async (r: 방, 받나: boolean) => {
    const { error } = await browserSupabase()
      .rpc('대화정하기', { p_방: r.방, p_받나: 받나 });
    if (error) { alert(error.message); return; }
    set다시((n) => n + 1);
  };

  return (
    <RapoPageFrame title="대화" back="/me" nav="/me">
      <p className={틀.흐린글}>
        말을 걸면 상대가 받을지 고릅니다. 사진은 상대가 한 번 보면 사라져요.
      </p>

      {방들.length === 0
        ? <p className={틀.흐린글}>아직 대화가 없어요.</p>
        : (
          <ul className="flex flex-col gap-(--rapo-dimension-x2)">
            {방들.map((r) => (
              <li key={r.방} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x3)'}>
                <div className="flex items-center gap-(--rapo-dimension-x3)">
                  <Avatar value={r.상대아바타} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                      <b className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{r.상대}</b>
                      {r.상태 === '신청' && (
                        <span className={틀.표}>{r.건사람인가 ? '기다리는 중' : '받을까요'}</span>
                      )}
                      {r.안읽음 > 0 && (
                        <span className="rapo-type-t2-bold rounded-(--rapo-radius-full) bg-(--rapo-color-bg-deep-coral) px-(--rapo-dimension-x2) text-(color:--rapo-color-fg-on-deep-coral)">
                          {r.안읽음}
                        </span>
                      )}
                      <span className="rapo-type-t3-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{날(r.마지막때)}</span>
                    </span>
                    {r.마지막 && (
                      <span className="rapo-type-t4-regular mt-(--rapo-dimension-x1) block truncate text-(color:--rapo-color-fg-neutral-muted)">{r.마지막}</span>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
                  {r.상태 === '수락' && (
                    <Link href={`/talk/${r.방}`} className={틀.선단추}>열기</Link>
                  )}
                  {r.상태 === '신청' && !r.건사람인가 && (
                    <>
                      <RapoButton tone="navy" size={40} onClick={() => 정하기(r, true)}>받기</RapoButton>
                      <button type="button" onClick={() => 정하기(r, false)} className={틀.선단추}>안 받기</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </RapoPageFrame>
  );
}
