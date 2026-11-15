'use client';

import { useEffect, useState } from 'react';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { browserSupabase } from '@/lib/supabase-browser';

/* 신고 센터 — 내 신고 처리 현황 (2026-11-15 세중님 「피그마댓글 대로」 · 피그마 12 「신고 센터」 1508:2469).
   글·댓글 신고(reports)와 공고 신고(공고신고)를 한 목록에. 둘 다 DB 규칙이 「내 신고만」 줍니다(금고 SQL_1113/ZR).
   처리되면 운영자가 정한 결과와 안내 글이 보입니다 — 운영자 메모(handled_note)는 읽지 않습니다. */

type 줄 = { 키: string; 무엇: string; 사유: string; 때: string; 처리: string | null; 결정: string | null; 안내: string | null };

const 무엇말: Record<string, string> = { post: '게시글', comment: '댓글', chat_room: '대화방', chat: '대화', 공고: '공고' };
const 날 = (s: string) => { const d = new Date(new Date(s).getTime() + 9 * 3600_000); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };

export default function MyReports() {
  return <RapoMeFrame title="신고 센터">{() => <List />}</RapoMeFrame>;
}

function List() {
  const [rows, setRows] = useState<줄[] | null | 'error'>(null);
  useEffect(() => {
    const sb = browserSupabase();
    Promise.all([
      sb.from('reports').select('id,target_type,reason,created_at,handled_at,결정,안내').order('created_at', { ascending: false }).limit(50),
      sb.from('공고신고').select('id,reason,created_at,handled_at,결정,안내').order('created_at', { ascending: false }).limit(50),
    ]).then(([a, b]) => {
      if (a.error && b.error) { setRows('error'); return; }
      const 글 = ((a.data ?? []) as unknown as { id: number; target_type: string; reason: string; created_at: string; handled_at: string | null; 결정: string | null; 안내: string | null }[])
        .map((r) => ({ 키: 'r' + r.id, 무엇: 무엇말[r.target_type] ?? '내용', 사유: r.reason, 때: r.created_at, 처리: r.handled_at, 결정: r.결정, 안내: r.안내 }));
      const 공고 = ((b.data ?? []) as unknown as { id: number; reason: string; created_at: string; handled_at: string | null; 결정: string | null; 안내: string | null }[])
        .map((r) => ({ 키: 'j' + r.id, 무엇: '공고', 사유: r.reason, 때: r.created_at, 처리: r.handled_at, 결정: r.결정, 안내: r.안내 }));
      setRows([...글, ...공고].sort((x, y) => y.때.localeCompare(x.때)));
    });
  }, []);

  if (rows === null) return <p className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>;
  if (rows === 'error') return <p role="alert" className="rapo-type-t4-regular pt-(--rapo-dimension-x6) text-(color:--rapo-color-fg-critical)">불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>;

  return (
    <section className="flex flex-col pt-(--rapo-dimension-x4)">
      <h1 className="rapo-type-t11-bold text-(color:--rapo-brand-color-navy)">내 신고 처리 현황</h1>
      <p className="rapo-type-t4-bold mt-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">{rows.length ? `최근 신고 ${rows.length}건` : '아직 신고한 내용이 없어요'}</p>
      {rows.length === 0 && (
        <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">
          게시글·댓글의 「…」 메뉴나 공고의 「공고 신고하기」로 신고하면 여기에서 처리 결과를 볼 수 있어요.
        </p>
      )}
      <ul className="flex flex-col">
        {rows.map((r) => {
          const 표 = !r.처리 ? { 글: '접수', 색: 'bg-(--rapo-color-bg-informative-weak) text-(color:--rapo-color-fg-informative)' }
            : { 글: '처리 완료', 색: 'bg-(--rapo-color-bg-positive-weak) text-(color:--rapo-color-fg-positive)' };
          const 설명 = !r.처리 ? '신고가 정상 접수됐어요. 운영자가 확인할게요.'
            : r.안내 ?? (r.결정 === '숨김' ? `운영 정책에 따라 ${r.무엇}을(를) 숨겼어요.` : '확인했지만 운영 정책에 어긋나지 않아 그대로 두었어요.');
          return (
            <li key={r.키} className="flex flex-col gap-(--rapo-dimension-x2) border-b border-(--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x5)">
              <div className="flex items-center gap-(--rapo-dimension-x3)">
                <p className="rapo-type-t7-bold min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">신고한 {r.무엇}</p>
                <span className={'rapo-type-t3-bold shrink-0 whitespace-nowrap rounded-(--rapo-radius-full) px-(--rapo-dimension-x4) py-(--rapo-dimension-x1) ' + 표.색}>{표.글}</span>
              </div>
              <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">{설명}</p>
              <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">{날(r.때)} · 사유 {r.사유}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
