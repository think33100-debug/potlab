'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 채용 담당자 화면 (2026-10-09 · 뼈대 ⑧).
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 승인된 담당자가 없으면 아무것도 안 보입니다. 관리자·마스터는 늘 봅니다.
 *
 * ── 지금 되는 것 ─────────────────────────────────────────────
 *   우리 병원 공고 목록 · 조회수 · 「지원하러 가기」 누른 수
 *   수집 공고에 「우리가 올린 것이 맞습니다」 도장
 *
 * ── 아직 안 되는 것 ──────────────────────────────────────────
 *   공고 등록·수정·조기 마감은 다음 차례입니다. 지금은 **읽기와 도장**뿐입니다.
 *   수집한 공고를 담당자가 고치게 하면, 우리가 긁어 온 값과 어긋났을 때
 *   어느 쪽이 맞는지 가릴 수 없게 됩니다. 그 규칙을 먼저 정해야 합니다.
 */

type 병원 = { 기관번호: string; 이름: string };
type 공고 = {
  id: string; 제목: string; 직군: string | null; 고용형태: string | null;
  apply_from: string | null; apply_to: string | null;
  hidden: boolean; hold: boolean; 조회수: number; 지원누름: number;
  공식확인: boolean; source: string | null;
};

export default function Biz() {
  const { loading, session, isAdmin } = useAuth();
  const [병원들, set병원들] = useState<병원[]>([]);
  const [고른곳, set고른곳] = useState<string | null>(null);
  const [공고들, set공고들] = useState<공고[]>([]);
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    if (!session) return;
    let 살아있나 = true;
    browserSupabase().rpc('내병원').then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      const xs = (data ?? []) as 병원[];
      set병원들(xs);
      set고른곳((p) => p ?? xs[0]?.기관번호 ?? null);
    });
    return () => { 살아있나 = false; };
  }, [session]);

  useEffect(() => {
    if (!고른곳) return;
    let 살아있나 = true;
    browserSupabase().rpc('내병원공고', { p_기관번호: 고른곳 }).then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      set공고들((data ?? []) as 공고[]);
    });
    return () => { 살아있나 = false; };
  }, [고른곳, 다시]);

  const 도장 = useCallback(async (j: 공고) => {
    const { error } = await browserSupabase()
      .rpc('공식확인하기', { p_공고: j.id, p_맞나: !j.공식확인 });
    if (error) { set탈(error.message); return; }
    set다시((n) => n + 1);
  }, []);

  if (loading) return <main className="mx-auto w-full max-w-3xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;

  if (병원들.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-7">
        <h1 className="break-keep text-h1 font-bold">채용 담당자</h1>
        <p className="mt-3 break-keep text-lg text-mute">
          {isAdmin
            ? '승인된 병원이 아직 없어요. 담당자 신청을 승인하면 여기 나옵니다.'
            : '아직 준비 중이에요.'}
        </p>
        <Link href={isAdmin ? '/admin/partners' : '/'}
          className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                     text-lg font-medium text-gray-600 hover:bg-gray-50">
          {isAdmin ? '담당자 승인으로' : '홈으로'}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 승인된 담당자와 관리자에게만 보입니다
      </p>
      <h1 className="mt-5 break-keep text-h1 font-bold">우리 병원 공고</h1>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      {병원들.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {병원들.map((h) => (
            <button key={h.기관번호} type="button" onClick={() => set고른곳(h.기관번호)}
              className={'rounded-full px-4 py-2 text-sm ' +
                (고른곳 === h.기관번호 ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
              {h.이름}
            </button>
          ))}
        </div>
      )}

      {공고들.length === 0
        ? <p className="mt-6 break-keep text-lg text-mute">아직 올라온 공고가 없어요.</p>
        : (
          <ul className="mt-6 space-y-3">
            {공고들.map((j) => (
              <li key={j.id} className="rounded-sm border border-gray-200 p-5">
                <p className="flex flex-wrap items-center gap-2">
                  <b className="break-keep text-lg">{j.제목}</b>
                  {j.공식확인 && (
                    <span className="rounded-full bg-badge-teal-bg px-3 py-1 text-[13px] text-teal-strong">
                      공식 확인
                    </span>
                  )}
                  {(j.hidden || j.hold) && (
                    <span className="text-sm text-mute">{j.hidden ? '내려감' : '확인 중'}</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-mute">
                  {[j.직군, j.고용형태, j.apply_to ? `~${j.apply_to}` : null]
                    .filter(Boolean).join(' · ')}
                </p>
                <p className="mt-2 text-lg">
                  조회 <b className="num">{j.조회수.toLocaleString('ko-KR')}</b>
                  {' · 지원하러 가기 '}
                  <b className="num">{j.지원누름.toLocaleString('ko-KR')}</b>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/jobs/${j.id}`}
                    className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                    공고 보기
                  </Link>
                  <button type="button" onClick={() => 도장(j)}
                    className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                    {j.공식확인 ? '공식 확인 거두기' : '우리가 올린 것이 맞아요'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

      <p className="mt-8 break-keep text-sm text-mute">
        공고를 직접 올리고 고치는 것은 다음 차례예요. 지금은 <b>보기와 「공식 확인」</b>까지만 됩니다 —
        우리가 긁어 온 값과 담당자가 고친 값이 어긋났을 때 어느 쪽이 맞는지 정하는 규칙을 먼저 만들어야 해요.
      </p>
    </main>
  );
}
