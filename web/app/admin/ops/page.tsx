'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 운영진 글 모아보기 — 권한 「운영진글」 이 있어야 봅니다 (2026-10-09).
 *
 * ── 어디서 오나 ──────────────────────────────────────────────
 * 마스터 계정이 페르소나를 쓰고 글·댓글을 넣으면, DB 트리거가 **따로 둔 표**
 * (운영진글)에 한 줄 적습니다. posts·comments 에는 아무 표시도 안 남습니다 —
 * 거기 칸을 두면 회원이 REST 로 select 해서 다 알아볼 수 있습니다.
 *
 * ── 지우지 않고 감춥니다 ─────────────────────────────────────
 * 2026-09-23 에 「글은 지우지 않고 감춥니다」로 정했습니다. 여기서도 같습니다.
 * 감추면 회원 화면에서 사라지고, 누가 언제 감췄는지 남습니다.
 */

type 줄 = {
  갈래: string; id: number; 쓴역할: string; 제목: string | null;
  미리: string | null; 방: string | null; 쓴때: string; 감춤: boolean;
};

const 날 = (s: string) => new Date(s).toLocaleString('ko-KR',
  { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AdminOps() {
  const [줄들, set줄들] = useState<줄[] | null>(null);
  const [탈, set탈] = useState<string | null>(null);
  const [고른것, set고른것] = useState<Set<string>>(new Set());
  const [역할, set역할] = useState<string>('');
  const [도는중, set도는중] = useState(false);

  const 읽기 = useCallback(async () => {
    const { data, error } = await browserSupabase()
      .rpc('admin_운영진글목록', { p_역할: 역할 || null, p_몇줄: 200 });
    if (error) { set탈(error.message); return; }
    set탈(null);
    set줄들((data ?? []) as 줄[]);
    set고른것(new Set());
  }, [역할]);

  useEffect(() => { 읽기(); }, [읽기]);

  const 열쇠 = (x: 줄) => x.갈래 + ':' + x.id;

  const 토글 = (x: 줄) => set고른것((p) => {
    const n = new Set(p);
    const k = 열쇠(x);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const 감추기 = async () => {
    const 글 = [...고른것].filter((k) => k.startsWith('글:')).map((k) => Number(k.slice(2)));
    const 댓 = [...고른것].filter((k) => k.startsWith('댓글:')).map((k) => Number(k.slice(3)));
    if (!글.length && !댓.length) return;
    if (!confirm(`고른 ${글.length + 댓.length}개를 감춥니다. 지우는 것은 아니에요.`)) return;
    set도는중(true);
    const { error } = await browserSupabase()
      .rpc('admin_운영진글감추기', { p_글: 글, p_댓글: 댓 });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    await 읽기();
  };

  const 역할들 = [...new Set((줄들 ?? []).map((x) => x.쓴역할))].sort();

  return (
    <div className="mt-6">
      <h1 className="text-h2 font-bold text-[#14181C]">운영진 글</h1>
      <p className="mt-2 text-lg text-mute">
        마스터 계정이 페르소나로 쓴 글과 댓글입니다. 회원 화면에는 <b>그 역할의 글로 그대로</b> 보입니다
        — 「운영진 작성」 표시는 여기서만 보입니다.
      </p>

      {탈 && (
        <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button" onClick={() => set역할('')}
          className={'rounded-full px-4 py-2 text-sm ' +
            (역할 === '' ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
          모두
        </button>
        {역할들.map((r) => (
          <button
            key={r} type="button" onClick={() => set역할(r)}
            className={'rounded-full px-4 py-2 text-sm ' +
              (역할 === r ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
            {r}
          </button>
        ))}
        <button
          type="button" onClick={감추기} disabled={도는중 || 고른것.size === 0}
          className="ml-auto rounded-md bg-brand-red px-6 py-2 text-lg font-bold text-white
                     hover:bg-brand-red-dark disabled:opacity-40">
          고른 {고른것.size}개 감추기
        </button>
      </div>

      {줄들 === null ? <p className="mt-6 text-lg text-mute">잠시만요…</p>
        : 줄들.length === 0 ? <p className="mt-6 text-lg text-mute">아직 없어요.</p>
          : (
            <ul className="mt-5 space-y-2">
              {줄들.map((x) => (
                <li key={열쇠(x)}
                  className={'rounded-sm border border-gray-200 p-4 ' + (x.감춤 ? 'opacity-55' : '')}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox" checked={고른것.has(열쇠(x))}
                      onChange={() => 토글(x)} disabled={x.감춤}
                      className="mt-1 h-5 w-5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="rounded-full bg-badge-teal-bg px-3 py-1 text-[13px] text-teal-strong">
                          {x.쓴역할}
                        </b>
                        <span className="text-sm text-mute">{x.갈래} · {x.방 ?? '방 모름'} · {날(x.쓴때)}</span>
                        {x.감춤 && <span className="text-sm text-brand-red-dark">감춰짐</span>}
                      </span>
                      <span className="mt-1 block break-keep text-lg">
                        {x.제목 ? <b>{x.제목}</b> : null}
                        {x.제목 && x.미리 ? ' — ' : ''}
                        <span className="text-gray-600 dark:text-gray-400">{x.미리}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
}
