'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { 관, 배지꼴, 칩꼴 } from '@/components/rapo/rapo-admin-ui';

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

  if (loading) return <p className={관.muted}>잠시만요…</p>;
  if (!isAdmin) return <p className={관.muted}>관리자만 볼 수 있어요.</p>;

  return (
    /* 2026-11-19 — 새 관리자 디자인으로 겉모양만 바꿨습니다 (칩 · 흰 카드 목록 · 단추) */
    <div className="max-w-[932px]">
      <RapoAdminHeader title="빈칸 공고" />
      <p className={관.muted + ' -mt-[16px] break-keep'}>
        상세 일곱 칸 중 비어 있는 칸이 있는 공고예요. 채우면 그 칸이 잠겨서
        다음 수집 때 안 덮입니다.
      </p>

      {탈 && <p role="alert" className={관.error + ' mt-[16px]'}>{탈}</p>}

      <div className="mt-[20px] flex flex-wrap gap-[8px]">
        {[null, '작업치료사', '물리치료사'].map((g) => (
          <button key={g ?? '전체'} type="button" onClick={() => { set직군(g); set쪽(0); }}
            aria-pressed={직군 === g} className={칩꼴(직군 === g)}>
            {g ?? '전체'}
          </button>
        ))}
      </div>

      {줄들 === null ? <p className={관.muted + ' mt-[16px]'}>잠시만요…</p>
        : 줄들.length === 0
          ? <div className={관.cardTight + ' mt-[16px]'}><p className={관.empty}>빈칸 있는 공고가 없어요.</p></div>
          : (
            <ul className={관.list + ' mt-[16px]'}>
              {줄들.map((r) => (
                <li key={r.id} className={관.row}>
                  <p className="flex flex-wrap items-center gap-[8px]">
                    <b className="break-keep text-[16px] leading-[22px] text-[#112231]">{r.title}</b>
                    <span className="text-[13px] text-[#555d6d]">{r.org_name}</span>
                    <span className={배지꼴('neutral')}>
                      {r.source}
                    </span>
                  </p>
                  <p className="mt-[10px] flex flex-wrap items-center gap-[8px]">
                    {r.빈칸.map((k) => (
                      <button key={k} type="button"
                        onClick={() => { set고치는것({ id: r.id, 칸: k }); set값(''); }}
                        className="inline-flex h-[30px] items-center rounded-full border border-[#ffb1a5] bg-[#fff5f3] px-[12px] text-[13px] font-bold text-[#b42a21] hover:bg-[#ffe9e6]">
                        {k} 채우기
                      </button>
                    ))}
                    {(r.잠긴칸 ?? []).length > 0 && (
                      <span className="text-[13px] text-[#555d6d]">
                        잠김 — {(r.잠긴칸 ?? []).join(' · ')}
                      </span>
                    )}
                  </p>

                  {고치는것?.id === r.id && (
                    <div className="mt-[12px] rounded-[8px] bg-[#f6f8f9] p-[16px]">
                      <p className={관.label}>
                        {고치는것.칸} — {칸설명[고치는것.칸] ?? ''}
                      </p>
                      <input value={값} onChange={(e) => set값(e.target.value)}
                        className={관.input + ' mt-[8px]'} />
                      <div className="mt-[12px] flex flex-wrap gap-[8px]">
                        <button type="button" onClick={채우기}
                          className={관.btn}>
                          저장
                        </button>
                        <button type="button" onClick={() => set고치는것(null)}
                          className={관.btnLine}>
                          그만두기
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="mt-[10px]">
                    <Link href={`/jobs/${r.id}`} className={관.btnText}>
                      공고 보기 →
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}

      <div className="mt-[16px] flex gap-[8px]">
        <button type="button" disabled={쪽 === 0} onClick={() => set쪽((p) => Math.max(0, p - 1))}
          className={관.btnLine}>
          이전
        </button>
        <button type="button" disabled={(줄들?.length ?? 0) < 50} onClick={() => set쪽((p) => p + 1)}
          className={관.btnLine}>
          다음
        </button>
      </div>
    </div>
  );
}
