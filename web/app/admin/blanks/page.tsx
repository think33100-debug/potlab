'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 빈칸 공고 — 상세 일곱 칸 중 **비어 있는 칸이 있는 공고** (2026-10-09).
 *
 * ── 왜 이 화면이 있나 ───────────────────────────────────────
 * 못 찾은 칸은 회원 화면에 **안 그립니다.** 「공고에 없음」이라고 적으면
 * 회원이 공고문을 안 찾아보게 됩니다 (15절과 같은 까닭).
 * 대신 여기로 모아서 사람이 채웁니다.
 *
 * ── 채우면 잠깁니다 ─────────────────────────────────────────
 * 빈칸채우기() 가 edited_fields 에 그 칸을 넣습니다. 다음 수집에서
 * collect_put 이 그 칸을 안 덮습니다 (2026-10-08 에 그렇게 고쳤습니다).
 * updated_at 은 **안 바꿉니다** — 알림과 다리가 그 값을 봅니다 (9절).
 */

type 줄 = {
  id: string; org_name: string; title: string; job_group: string | null;
  apply_to: string | null; source: string | null;
  빈칸: string[]; 뽑은때: string | null; 잠긴칸: string[] | null;
};

const 칸설명: Record<string, string> = {
  모집인원: '우리 직군 인원만 (통합 공고의 전체 인원 금지)',
  접수마감: '공고문 날짜. API 날짜를 믿지 마세요',
  근무지: '공고문 우선, 없으면 기관표 주소',
  지원자격: '공고 말 그대로',
  예상연봉: '「내규에 따름」·「협의」도 그대로. 숫자를 만들지 마세요',
};

export default function Blanks() {
  const { loading, isAdmin } = useAuth();
  const [줄들, set줄들] = useState<줄[] | null>(null);
  const [직군, set직군] = useState<string | null>(null);
  const [쪽, set쪽] = useState(0);
  const [탈, set탈] = useState<string | null>(null);
  const [다시, set다시] = useState(0);
  const [고치는것, set고치는것] = useState<{ id: string; 칸: string } | null>(null);
  const [값, set값] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    let 살아있나 = true;
    browserSupabase().rpc('빈칸공고', { p_직군: 직군, p_page: 쪽 })
      .then(({ data, error }) => {
        if (!살아있나) return;
        if (error) { set탈(error.message); set줄들([]); return; }
        set줄들((data ?? []) as 줄[]);
      });
    return () => { 살아있나 = false; };
  }, [isAdmin, 직군, 쪽, 다시]);

  const 채우기 = useCallback(async () => {
    if (!고치는것 || !값.trim()) return;
    const { error } = await browserSupabase().rpc('빈칸채우기', {
      p_공고: 고치는것.id, p_칸: 고치는것.칸, p_값: 값.trim(),
    });
    if (error) { set탈(error.message); return; }
    set고치는것(null); set값(''); set다시((n) => n + 1);
  }, [고치는것, 값]);

  if (loading) return <p className="text-lg text-mute">잠시만요…</p>;
  if (!isAdmin) return <p className="text-lg text-mute">관리자만 볼 수 있어요.</p>;

  return (
    <div>
      <h1 className="break-keep text-h2 font-bold">빈칸 공고</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        상세 일곱 칸 중 비어 있는 칸이 있는 공고예요. 채우면 그 칸이 잠겨서
        다음 수집 때 안 덮입니다.
      </p>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {[null, '작업치료사', '물리치료사'].map((g) => (
          <button key={g ?? '전체'} type="button" onClick={() => { set직군(g); set쪽(0); }}
            className={'rounded-full px-4 py-2 text-sm ' +
              (직군 === g ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
            {g ?? '전체'}
          </button>
        ))}
      </div>

      {줄들 === null ? <p className="mt-6 text-lg text-mute">잠시만요…</p>
        : 줄들.length === 0
          ? <p className="mt-6 break-keep text-lg text-mute">빈칸 있는 공고가 없어요.</p>
          : (
            <ul className="mt-6 space-y-3">
              {줄들.map((r) => (
                <li key={r.id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="break-keep text-lg">{r.title}</b>
                    <span className="text-sm text-mute">{r.org_name}</span>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">
                      {r.source}
                    </span>
                  </p>
                  <p className="mt-2 flex flex-wrap gap-2">
                    {r.빈칸.map((k) => (
                      <button key={k} type="button"
                        onClick={() => { set고치는것({ id: r.id, 칸: k }); set값(''); }}
                        className="rounded-full border border-brand-red px-3 py-1 text-[13px] text-brand-red-dark hover:bg-gray-50">
                        {k} 채우기
                      </button>
                    ))}
                    {(r.잠긴칸 ?? []).length > 0 && (
                      <span className="text-sm text-mute">
                        잠김 — {(r.잠긴칸 ?? []).join(' · ')}
                      </span>
                    )}
                  </p>

                  {고치는것?.id === r.id && (
                    <div className="mt-3 rounded-sm bg-gray-50 p-4 dark:bg-gray-900">
                      <p className="text-sm font-bold text-mute">
                        {고치는것.칸} — {칸설명[고치는것.칸] ?? ''}
                      </p>
                      <input value={값} onChange={(e) => set값(e.target.value)}
                        className="mt-2 w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={채우기}
                          className="rounded-md bg-brand-red px-5 py-2 text-lg font-bold text-white hover:bg-brand-red-dark">
                          저장
                        </button>
                        <button type="button" onClick={() => set고치는것(null)}
                          className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                          그만두기
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="mt-3">
                    <Link href={`/jobs/${r.id}`} className="text-lg text-interaction-blue hover:underline">
                      공고 보기 →
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}

      <div className="mt-6 flex gap-2">
        <button type="button" disabled={쪽 === 0} onClick={() => set쪽((p) => Math.max(0, p - 1))}
          className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 disabled:opacity-50">
          이전
        </button>
        <button type="button" disabled={(줄들?.length ?? 0) < 50} onClick={() => set쪽((p) => p + 1)}
          className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 disabled:opacity-50">
          다음
        </button>
      </div>
    </div>
  );
}
