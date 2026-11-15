'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { useToast } from '@/app/toast';
import { 어둠 } from '@/components/rapo/rapo-community';
import { browserSupabase } from '@/lib/supabase-browser';

/* 근무 후기 쓰기·고치기 — 피그마 「근무 후기 · 작성」 1447:7164 · 「수정」 1312:8051 · 「작성 자격 안내」 1447:7292 (2026-11-15).
   그 병원 재직 인증(확인)을 마친 회원만 씁니다 — 막는 자리는 DB 규칙(근무후기_인증한_병원만_쓰기 · 금고 SQL_1113/ZN).
   인증이 없으면 「이 병원에서 일해 보셨나요?」 안내 → 재직 인증(/verify). 한 병원에 한 사람 한 후기(고치기는 같은 자리). */

const 교육들 = ['충분해요', '보통이에요', '부족해요'] as const;
const 일정들 = ['예측 가능해요', '자주 바뀌어요'] as const;
const 휴게들 = ['확보돼요', '보통이에요', '어려워요'] as const;
const 최대 = 5000;

function Body() {
  const q = useSearchParams();
  const org = q.get('org') ?? '';
  const sido = q.get('sido') ?? '';
  const router = useRouter();
  const toast = useToast();
  const { loading, session } = useAuth();
  const [인증됨, set인증됨] = useState<boolean | null>(null);
  const [내것, set내것] = useState<number | null>(null);
  const [별점, set별점] = useState(0);
  const [교육, set교육] = useState('');
  const [일정, set일정] = useState('');
  const [휴게, set휴게] = useState('');
  const [글, set글] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session || !org) return;
    (async () => {
      const sb = browserSupabase();
      const [w, h] = await Promise.all([
        sb.from('재직인증').select('병원이름').eq('상태', '확인'),
        sb.from('근무후기').select('id,별점,교육,일정,휴게,글').eq('기관', org).maybeSingle(),
      ]);
      set인증됨(((w.data ?? []) as unknown as { 병원이름: string | null }[]).some((x) => x.병원이름 === org));
      const 옛 = h.data as { id: number; 별점: number; 교육: string; 일정: string; 휴게: string; 글: string | null } | null;
      if (옛) { set내것(옛.id); set별점(옛.별점); set교육(옛.교육); set일정(옛.일정); set휴게(옛.휴게); set글(옛.글 ?? ''); }
    })();
  }, [loading, session, org]);

  const 됨 = 별점 > 0 && !!교육 && !!일정 && !!휴게;
  const 게시판 = `/orgs?org=${encodeURIComponent(org)}&sido=${encodeURIComponent(sido)}&tab=review`;

  const 보내기 = async () => {
    if (!됨 || busy) return;
    setBusy(true);
    const sb = browserSupabase();
    const 값 = { 별점, 교육, 일정, 휴게, 글: 글.trim() || null };
    const { error } = 내것
      ? await sb.from('근무후기').update({ ...값, 고친때: new Date().toISOString() }).eq('id', 내것)
      : await sb.from('근무후기').insert({ 기관: org, ...값 });
    setBusy(false);
    if (error) { toast(`등록하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast(내것 ? '후기를 고쳤어요' : '후기를 등록했어요');
    router.replace(게시판);
  };

  const 고르기 = (제목: string, 값들: readonly string[], 지금: string, 바꿈: (v: string) => void) => (
    <fieldset className="flex flex-col gap-[10px]">
      <legend className="mb-[10px] text-[14px] leading-[20px]" style={{ color: 어둠.흐린글 }}>{제목}</legend>
      <div className="grid grid-cols-3 gap-[8px]">
        {값들.map((v) => (
          <button key={v} type="button" aria-pressed={지금 === v} onClick={() => 바꿈(v)}
            className="min-h-[42px] break-keep rounded-[8px] px-[6px] py-[8px] text-[14px] font-medium leading-[19px]"
            style={지금 === v ? { background: '#ffa691', color: '#112332' } : { background: 어둠.면, color: 어둠.글 }}>
            {v}
          </button>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col" style={{ background: 어둠.바탕 }}>
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-[4px] px-[8px]" style={{ background: 어둠.아래탐색 }}>
        <button type="button" onClick={() => history.back()} aria-label="뒤로" className="flex size-[44px] items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4l-6 6 6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <p className="text-[18px] font-bold leading-[26px]" style={{ color: 어둠.글 }}>{인증됨 === false ? '근무 경험 확인' : 내것 ? '근무 후기 고치기' : '근무 후기 쓰기'}</p>
      </header>

      {인증됨 === null ? (
        <p role="status" className="px-[22px] pt-[28px] text-[15px]" style={{ color: 어둠.흐린글 }}>잠시만요…</p>
      ) : !인증됨 ? (
        /* 작성 자격 안내 1447:7292 */
        <main className="flex flex-1 flex-col gap-[16px] px-[22px] pb-[24px] pt-[112px]">
          <span aria-hidden className="flex size-[48px] items-center justify-center rounded-[12px] text-[26px]" style={{ background: '#ddecf2' }}>🏥</span>
          <h1 className="text-[24px] font-bold leading-[34px]" style={{ color: 어둠.글 }}>이 병원에서 일해 보셨나요?</h1>
          <p className="break-keep text-[15px] leading-[23px]" style={{ color: 어둠.흐린글 }}>
            {org} 근무 인증을 완료한 회원만 작성할 수 있어요. 이미 인증한 병원은 다시 인증하지 않아요.
          </p>
          <Link href="/verify" className="mt-[72px] flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold" style={{ background: 어둠.쓰기, color: '#fff' }}>근무 인증하기</Link>
          <Link href={`/orgs?org=${encodeURIComponent(org)}&sido=${encodeURIComponent(sido)}&tab=talk`} className="mt-[12px] text-[15px] font-bold" style={{ color: '#ffa691' }}>자유토론에 글 쓰기 ›</Link>
          <p className="mt-[40px] break-keep text-[13px] leading-[19px]" style={{ color: 어둠.흐린글 }}>목록에 없는 병원은 증빙 제출 후 운영자 확인을 받아요.</p>
        </main>
      ) : (
        /* 작성 1447:7164 */
        <main className="flex flex-1 flex-col gap-[24px] px-[22px] pb-[24px] pt-[28px]">
          <div>
            <h1 className="break-keep text-[24px] font-bold leading-[34px]" style={{ color: 어둠.글 }}>{org}</h1>
            <p className="mt-[10px] break-keep text-[14px] leading-[21px]" style={{ color: 어둠.흐린글 }}>
              <span className="block">근무 인증된 {org}에 작성해요.</span>
              <span className="block">별점·객관식은 필수, 글은 선택이에요.</span>
            </p>
          </div>
          <section className="flex flex-col gap-[16px]">
            <h2 className="text-[17px] font-bold leading-[24px]" style={{ color: 어둠.글 }}>종합 별점</h2>
            <div className="flex gap-[12px]" role="radiogroup" aria-label="종합 별점">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={별점 === n} aria-label={`${n}점`} onClick={() => set별점(n)}
                  className="flex size-[36px] items-center justify-center text-[30px] leading-none" style={{ color: '#ffa691' }}>
                  {n <= 별점 ? '★' : '☆'}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-[19px]" style={{ color: 어둠.흐린글 }}>{별점 ? `${별점}점` : '별점을 선택해 주세요.'}</p>
            {고르기('교육·인수인계', 교육들, 교육, set교육)}
            {고르기('근무 일정', 일정들, 일정, set일정)}
            {고르기('휴게 시간', 휴게들, 휴게, set휴게)}
          </section>
          <section className="flex flex-col gap-[10px]">
            <h2 className="text-[17px] font-bold leading-[24px]" style={{ color: 어둠.글 }}>자유 후기 (선택)</h2>
            <textarea value={글} onChange={(e) => set글(e.target.value.slice(0, 최대))} rows={6} aria-label="자유 후기"
              placeholder="함께 일할 동료에게 들려주고 싶은 경험을 적어 주세요."
              className="w-full rounded-[12px] p-[16px] text-[15px] leading-[23px] outline-none placeholder:text-[#8ea3b1]"
              style={{ background: 어둠.면, color: 어둠.글 }} />
            <p className="text-[13px]" style={{ color: 어둠.흐린글 }}>{글.length.toLocaleString('ko-KR')} / {최대.toLocaleString('ko-KR')}</p>
          </section>
          <div className="flex-1" />
          <button type="button" onClick={보내기} disabled={!됨 || busy}
            className="flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold disabled:opacity-40"
            style={{ background: 어둠.쓰기, color: '#fff' }}>
            {busy ? '등록하는 중…' : 내것 ? '고친 내용 저장' : '후기 등록'}
          </button>
          {내것 && <button type="button" onClick={() => history.back()} className="text-[15px]" style={{ color: 어둠.흐린글 }}>취소</button>}
        </main>
      )}
    </div>
  );
}

export default function ReviewWrite() {
  return <Suspense><Body /></Suspense>;
}
