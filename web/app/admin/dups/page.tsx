'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminMerge } from '@/components/admin-merge';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { SOURCE_NAME } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 중복 공고 모아 보기 (2026-11-12 세중님 「관리자 페이지에 중복 공고를 모아두자 · 내가 확인하기 쉽게」).

   ── 위: 숨긴 중복 ────────────────────────────────────────────
   같은 공고가 두 출처로 들어와 **한쪽을 숨긴 것**을 짝으로 보여 줍니다 (최근 30일).
     자동   출처다른중복() — 매시 tools/중복숨기기.mjs 가 부릅니다 (칸이 더 찬 쪽을 남김)
     손     공고연결() — 아래 「묶을 후보」에서 사람이 묶은 것
   읽는 창구는 DB 의 중복모아보기() 한 자리입니다(관리자만).

   「다른 공고예요」를 누르면
     묶지않기(남긴, 숨긴)  — 그 짝을 기억해 자동 규칙이 다시 숨기지 않게 하고
     공고연결풀기(숨긴)     — 숨긴 줄을 다시 회원 화면에 올립니다
   남긴 줄을 모르는 옛 줄(11/12 전 자동 숨김)은 단추가 없습니다 — 공고 관리에서 그 줄을 직접 봅니다.

   ── 아래: 묶을 후보 ───────────────────────────────────────────
   자동 규칙이 못 잡은 짝(같은 기관 · 같은 마감 · 다른 출처)입니다. 공고 관리 화면에 있던 것을 그대로 씁니다. */

type 줄 = {
  id: string; 출처: string | null; 기관: string | null; 제목: string | null;
  주소: string | null; 게시: string | null; 마감: string | null; 보임?: boolean;
};
type 짝 = { 숨긴: 줄; 남긴: 줄 | null; 왜: string | null; 숨긴날: string | null; 자동: boolean };

const 출처말 = (s: string | null) => (s ? (SOURCE_NAME[s] ?? s) : '모름');
const 날 = (s: string | null) => (s ? s.slice(0, 10).replaceAll('-', '.') : '—');

function 공고칸({ x, 쪽 }: { x: 줄; 쪽: '남긴' | '숨긴' }) {
  const 남김 = 쪽 === '남긴';
  return (
    <div className={'min-w-0 flex-1 rounded-(--rapo-radius-r2) border p-(--rapo-dimension-x4) '
      + (남김 ? 'border-[#9fd4b8] bg-[#f2fbf6]' : 'border-[#dde4e6] bg-[#f6f8f9] text-[#5c6b77]')}>
      <p className="text-[12px] font-bold">
        {남김 ? '회원에게 보이는 쪽' : '숨긴 쪽'} · {출처말(x.출처)}
        {남김 && x.보임 === false && <span className="ml-1 text-[#b42a21]">(지금은 이쪽도 안 보여요 — 마감·보류)</span>}
      </p>
      <p className="mt-1 break-keep text-[15px] font-bold">{x.제목 ?? '(제목 없음)'}</p>
      <p className="mt-1 text-[13px]">{x.기관 ?? '—'} · 게시 {날(x.게시)} · 마감 {날(x.마감)}</p>
      <p className="mt-2 flex flex-wrap gap-3 text-[13px]">
        {x.주소 && (
          <a href={x.주소} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">원문 열기 ↗</a>
        )}
        <Link href={`/admin/jobs/${encodeURIComponent(x.id)}`} className="underline underline-offset-2">공고 관리 ({x.id})</Link>
      </p>
    </div>
  );
}

export default function AdminDups() {
  const toast = useToast();
  const [짝들, set짝들] = useState<짝[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  /* 가져오기와 그리기를 갈라 둡니다 — effect 안에서 바로 setState 하지 않습니다 (trash 화면과 같은 꼴) */
  const 받기 = useCallback(async (): Promise<{ 줄들: 짝[] | null; 오류: string | null }> => {
    const { data, error } = await browserSupabase().rpc('중복모아보기', { p_날수: 30 });
    return error ? { 줄들: null, 오류: error.message } : { 줄들: (data ?? []) as 짝[], 오류: null };
  }, []);
  const 그리기 = (r: { 줄들: 짝[] | null; 오류: string | null }) => { setErr(r.오류); if (r.줄들) set짝들(r.줄들); };
  const load = useCallback(async () => 그리기(await 받기()), [받기]);

  useEffect(() => {
    let 살아있나 = true;
    받기().then((r) => { if (살아있나) 그리기(r); });
    return () => { 살아있나 = false; };
  }, [받기]);

  const 다른공고 = async (p: 짝) => {
    if (!p.남긴) return;
    if (!confirm(`「${p.숨긴.제목 ?? p.숨긴.id}」을(를) 다시 회원 화면에 올릴까요?\n두 공고는 앞으로 묶지 않아요.`)) return;
    setBusy(p.숨긴.id);
    const sb = browserSupabase();
    const a = await sb.rpc('묶지않기', { p_왼쪽: p.남긴.id, p_오른쪽: p.숨긴.id });
    const b = a.error ? a : await sb.rpc('공고연결풀기', { p_연결할: p.숨긴.id });
    setBusy(null);
    if (b.error) { toast(`되살리지 못했어요 — ${b.error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('다시 올렸어요');
    void load();
  };

  return (
    <div className="max-w-[932px]">
      <RapoAdminHeader title="중복 공고" />

      <section aria-labelledby="dups-hidden" className="mb-[32px] flex flex-col gap-(--rapo-dimension-x4)">
        <div>
          <h2 id="dups-hidden" className="rapo-type-t6-bold">숨긴 중복 · 최근 30일 {짝들 ? `${짝들.length}쌍` : ''}</h2>
          <p className="mt-1 text-[14px] text-[#5c6b77]">
            같은 공고가 두 곳에서 들어와 한쪽을 숨겼어요. 초록 칸이 회원에게 보이는 쪽이에요.
            둘이 다른 공고면 「다른 공고예요」를 눌러 주세요.
          </p>
        </div>

        {err && <p role="alert" className="rounded-(--rapo-radius-r2) bg-[#fff5f3] p-(--rapo-dimension-x4) text-[14px] text-[#b42a21]">못 불러왔어요 — {err}</p>}
        {!짝들 && !err && <p className="text-[14px] text-[#5c6b77]">불러오는 중…</p>}
        {짝들 && 짝들.length === 0 && <p className="text-[14px] text-[#5c6b77]">최근 30일에 숨긴 중복이 없어요.</p>}

        {짝들?.map((p) => (
          <article key={p.숨긴.id} className="rounded-(--rapo-radius-r2) border border-[#dde4e6] bg-white p-(--rapo-dimension-x4)">
            <p className="mb-(--rapo-dimension-x2) text-[13px] text-[#304f65]">
              <b>{p.자동 ? '자동으로 숨김' : '손으로 묶음'}</b> · {날(p.숨긴날)} · {p.왜 ?? ''}
            </p>
            <div className="flex flex-col gap-(--rapo-dimension-x2) md:flex-row">
              {p.남긴 ? <공고칸 x={p.남긴} 쪽="남긴" /> : (
                <div className="min-w-0 flex-1 rounded-(--rapo-radius-r2) border border-dashed border-[#dde4e6] p-(--rapo-dimension-x4) text-[13px] text-[#5c6b77]">
                  남긴 쪽 기록이 없어요 (11/12 전에 자동으로 숨긴 줄)
                </div>
              )}
              <공고칸 x={p.숨긴} 쪽="숨긴" />
            </div>
            {p.남긴 && (
              <div className="mt-(--rapo-dimension-x2) flex justify-end">
                <button type="button" disabled={busy !== null} onClick={() => 다른공고(p)}
                  className="rounded-(--rapo-radius-r2) border border-[#dde4e6] px-(--rapo-dimension-x4) py-(--rapo-dimension-x2) text-[14px] font-bold hover:bg-[#f6f8f9] disabled:opacity-50">
                  {busy === p.숨긴.id ? '올리는 중…' : '다른 공고예요 — 다시 올리기'}
                </button>
              </div>
            )}
          </article>
        ))}
      </section>

      <section aria-labelledby="dups-candidates" className="flex flex-col gap-(--rapo-dimension-x2)">
        <h2 id="dups-candidates" className="rapo-type-t6-bold">묶을 후보 — 사람이 볼 짝</h2>
        <p className="text-[14px] text-[#5c6b77]">자동 규칙이 못 잡은 짝이에요. 같은 공고면 「묶기」, 아니면 「묶지 않음」을 눌러 주세요.</p>
        <AdminMerge />
      </section>
    </div>
  );
}
