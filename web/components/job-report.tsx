'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/auth';
import { setAfterLogin } from '@/lib/after-login';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 공고 신고 (2026-10-07 · 새 디자인 2026-11-15 세중님 「피그마댓글 대로」).

   피그마 「06 · A」 — 신고 단추는 본문 가운데 칸 제목 오른쪽 「공고 신고하기」(RAPO / Detail / Qualifications 517:510).
   누르면 창 셋: ① 사유 고르기(1785:54992) → ② 「선택한 사유로 신고할까요?」(1785:55011) → ③ 접수 완료(1785:54993) → 보던 공고 그대로.
   ★ 피그마는 「업무·지원 자격」 제목 옆인데 그 칸은 11/12 세중님 결정으로 빠졌습니다 — 그 자리를 이어받은 「근무 조건」 제목 옆에 둡니다.
   ★ 접수 완료 글의 「신고 센터에서 결과를 알려드려요」는 신고 센터 화면이 아직 없어 「운영자가 확인할게요」로 둡니다.

   남기는 것 — 공고 id · 회원 번호 · 사유 · 보낸 때 (DB 공고오류신고 · 관리자 화면에는 회원 번호 앞 8자만).
   로그인 전에 누르면 로그인으로 보내고, 로그인하면 이 공고로 돌아옵니다. */

const 사유들 = ['잘못된 채용 정보', '개인정보 노출', '그 밖의 운영 정책 위반'] as const;

export function JobReport({ id }: { id: string }) {
  const { loading, session } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [창, set창] = useState<null | '사유' | '확인' | '끝'>(null);
  const [사유, set사유] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!창) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') set창(null); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [창]);

  function 열기() {
    if (loading) return;
    if (!session) { setAfterLogin(`/jobs/${id}`); router.push('/login'); return; }
    set창('사유');
  }

  async function 보내기() {
    setBusy(true);
    const { error } = await browserSupabase().rpc('공고오류신고', { p_job: id, p_reason: 사유 });
    setBusy(false);
    if (error) { toast(`신고하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    set창('끝');
  }

  const 줄 = 'rapo-type-t5-medium flex w-full items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-left text-(color:--rapo-color-fg-neutral) active:bg-(--rapo-color-bg-neutral-weak-pressed)';

  return (
    <>
      <button type="button" onClick={열기}
        className="rapo-type-t3-bold shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral) active:opacity-60">
        공고 신고하기
      </button>

      {창 && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true"
          aria-label={창 === '끝' ? '공고 신고를 접수했어요' : '공고 신고'}>
          <button type="button" aria-label="닫기" onClick={() => set창(null)} className="absolute inset-0 cursor-default bg-black/50" />
          <div className="relative w-full max-w-[420px] rounded-t-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x6)
                          pb-[calc(var(--rapo-dimension-x5)+env(safe-area-inset-bottom))] sm:rounded-(--rapo-radius-r4)">
            {창 === '사유' && (
              <>
                <p className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">이 공고를 신고할까요?</p>
                <p className="rapo-type-t4-medium mt-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">사유를 선택한 뒤 신고해 주세요.</p>
                <ul className="mt-(--rapo-dimension-x4) flex flex-col gap-(--rapo-dimension-x2)">
                  {사유들.map((x) => (
                    <li key={x}>
                      <button type="button" className={줄} onClick={() => { set사유(x); set창('확인'); }}>
                        <span className="min-w-0 flex-1">{x}</span><span aria-hidden>›</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => set창(null)}
                  className="rapo-type-t6-bold mt-(--rapo-dimension-x4) h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)">
                  취소
                </button>
              </>
            )}
            {창 === '확인' && (
              <>
                <p className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">선택한 사유로 신고할까요?</p>
                <p className="rapo-type-t4-medium mt-(--rapo-dimension-x2) text-(color:--rapo-brand-color-navy)">신고 사유 · {사유}</p>
                <button type="button" onClick={보내기} disabled={busy}
                  className="rapo-type-t6-bold mt-(--rapo-dimension-x6) h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid) disabled:opacity-50">
                  {busy ? '신고하는 중…' : '신고하기'}
                </button>
                <button type="button" onClick={() => set창('사유')} className="rapo-type-t5-medium mt-(--rapo-dimension-x2) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral)">취소</button>
              </>
            )}
            {창 === '끝' && (
              <>
                <p className="rapo-type-t8-bold text-(color:--rapo-brand-color-navy)">공고 신고를 접수했어요</p>
                <p className="rapo-type-t4-medium mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-brand-color-navy)">운영자가 확인할게요. 알려 주셔서 고마워요.</p>
                <button type="button" onClick={() => set창(null)}
                  className="rapo-type-t6-bold mt-(--rapo-dimension-x6) h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)">
                  확인
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
