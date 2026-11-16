'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { RapoClosed, RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { browserSupabase } from '@/lib/supabase-browser';
import { 대화닫힘안내, 대화열렸나 } from '@/lib/talk';

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

/* ★ 2026-11-02 세중님 — 오픈 때 1:1 대화는 **닫습니다** (lib/talk.ts).
   방 주소를 직접 쳐도 안내만 보이고 창구(대화읽기)를 안 부릅니다 */
export default function TalkRoom() {
  if (!대화열렸나) {
    /* 2026-11-16 — 주소로 열면 옛 위쪽 줄(POTJOB 로고)이 보여 새 틀 안내로 바꿨습니다 */
    return <RapoClosed title={대화닫힘안내.제목} body={대화닫힘안내.본문} />;
  }
  return <TalkRoomInner />;
}

function TalkRoomInner() {
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

  if (loading) return <RapoPageFrame title="대화" back="/talk"><RapoWait /></RapoPageFrame>;

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
    <RapoPageFrame title="대화" back="/talk">
      {탈 && <p role="alert" className={틀.오류칸}>{탈}</p>}

      <ul className="flex flex-col gap-(--rapo-dimension-x3) pb-[72px]">
        {줄들.map((m) => (
          <li key={m.id} className={m.나인가 ? 'text-right' : ''}>
            <div className={'inline-block max-w-[80%] rounded-(--rapo-radius-r3) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-left ' +
              (m.나인가 ? 'bg-(--rapo-brand-color-blush)' : 'bg-(--rapo-color-bg-neutral-weak)')}>
              {m.글 && <p className={틀.글}>{m.글}</p>}
              {m.사진사라짐 && <p className={틀.흐린글}>사진이 사라졌어요</p>}
              {m.사진 && !m.사진사라짐 && <p className={틀.흐린글}>사진 1장</p>}
              <p className="rapo-type-t2-regular mt-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">{때(m.쓴때)}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* 새 틀에는 옛 탭바(62)가 없어 맨 아래에 붙입니다 (2026-11-16) */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-3xl border-t-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)
                      bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) py-(--rapo-dimension-x3)"
        style={{ paddingBottom: 'calc(var(--rapo-dimension-x3) + env(safe-area-inset-bottom))' }}>
        <div className="flex w-full items-center gap-(--rapo-dimension-x3)">
          <input
            value={글} onChange={(e) => set글(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') 보내기(); }}
            placeholder="할 말을 적어 주세요" aria-label="할 말"
            className={틀.입력 + ' flex-1'} />
          <RapoButton tone="navy" size={52} onClick={보내기}>보내기</RapoButton>
        </div>
      </div>
    </RapoPageFrame>
  );
}
