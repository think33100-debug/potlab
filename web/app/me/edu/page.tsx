'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { browserSupabase } from '@/lib/supabase-browser';

/* 내 교육 관리 — 내 정보 (2026-11-15 세중님 「피그마댓글 대로」 · 피그마 「내 교육 관리에서 신청한 회차의 현재 상태와 후기 작성 가능 여부를 다시 확인」).
   DB 내교육신청() 한 줄 = 내가 신청한 회차 하나. 누르면 그 회차 화면(/edu/session/…) — 거기서 입금 안내·후기 쓰기.
   상태 이름은 회차 화면의 「내 신청」 상자와 같습니다 */

type 줄 = { 회차id: number; 제목: string; 주최: string | null; 시작: string; 상태: string; 입금기한: string | null; 리뷰썼나: boolean };

const 상태말: Record<string, { 글: string; 색: string }> = {
  입금대기: { 글: '입금 확인 중', 색: 'bg-(--rapo-color-bg-informative-weak) text-(color:--rapo-color-fg-informative)' },
  신청함: { 글: '신청 접수', 색: 'bg-(--rapo-color-bg-informative-weak) text-(color:--rapo-color-fg-informative)' },
  참여확정: { 글: '참여 확정', 색: 'bg-(--rapo-color-bg-positive-weak) text-(color:--rapo-color-fg-positive)' },
  수강완료: { 글: '수강 완료', 색: 'bg-(--rapo-color-bg-positive-weak) text-(color:--rapo-color-fg-positive)' },
  미선정: { 글: '미선정', 색: 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral-muted)' },
};
const 날 = (s: string) => { const [y, m, d] = s.split('-'); return `${y}.${m}.${d}`; };

export default function MyEdu() {
  return <RapoMeFrame title="내 교육 관리">{() => <List />}</RapoMeFrame>;
}

function List() {
  const [rows, setRows] = useState<줄[] | null | 'error'>(null);
  useEffect(() => {
    browserSupabase().rpc('내교육신청').then(({ data, error }) => setRows(error ? 'error' : ((data ?? []) as 줄[])));
  }, []);

  if (rows === null) return <p className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>;
  if (rows === 'error') return <p role="alert" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-critical)">불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>;
  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x10)">
        <p className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">아직 신청한 교육이 없어요</p>
        <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">교육 목록에서 신청하면 여기에서 상태를 확인할 수 있어요.</p>
        <Link href="/edu" className="rapo-type-t4-bold text-(color:--rapo-color-fg-brand-contrast)">교육 둘러보기 ›</Link>
      </section>
    );
  }
  /* 피그마 「내 교육 관리」 1508:2453 — 「신청한 교육 n건」 · 줄마다 상태 딱지(위) · 제목 · 주최 · 날짜 · 오른쪽 「후기 쓰기」 · 아래 「교육 둘러보기」 */
  return (
    <>
    <h1 className="rapo-type-t9-bold flex items-baseline gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x4) text-(color:--rapo-brand-color-navy)">
      신청한 교육<span className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral-muted)">{rows.length}건</span>
    </h1>
    <ul className="flex flex-col pt-(--rapo-dimension-x2)">
      {rows.map((r) => {
        const 말 = 상태말[r.상태] ?? { 글: r.상태, 색: 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)' };
        const 후기 = r.상태 === '수강완료';
        return (
          <li key={r.회차id} className="border-b border-(--rapo-color-stroke-neutral-weak)">
            <Link href={`/edu/session/${r.회차id}`} className="flex flex-col gap-(--rapo-dimension-x2) py-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-transparent-pressed)">
              <span className={'rapo-type-t3-bold self-start whitespace-nowrap rounded-(--rapo-radius-r1) px-(--rapo-dimension-x2) py-[2px] ' + 말.색}>{말.글}</span>
              <span className="flex items-start gap-(--rapo-dimension-x3)">
                <span className="rapo-type-t7-bold min-w-0 flex-1 break-keep text-(color:--rapo-brand-color-navy)">{r.제목}</span>
                <span aria-hidden className="rapo-type-t6-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
              </span>
              <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">{r.주최 ?? '교육 기관'}</span>
              <span className="flex items-center gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
                <span className="rapo-type-t4-regular min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">
                  {날(r.시작)}{r.상태 === '입금대기' && r.입금기한 ? ` · 입금 기한 ${날(r.입금기한)}` : ''}
                </span>
                {후기 && <span className={'rapo-type-t4-bold shrink-0 whitespace-nowrap ' + (r.리뷰썼나 ? 'text-(color:--rapo-color-fg-neutral-muted)' : 'text-(color:--rapo-color-fg-brand-contrast)')}>{r.리뷰썼나 ? '후기 등록 완료' : '후기 쓰기'}</span>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    <div className="pt-(--rapo-dimension-x8)">
      <Link href="/edu" className="rapo-type-t6-bold flex h-(--rapo-dimension-x13) items-center justify-center rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-navy-solid) text-(color:--rapo-color-fg-on-navy-solid)">교육 둘러보기</Link>
    </div>
    </>
  );
}
