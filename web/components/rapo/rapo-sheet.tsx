'use client';

import { useEffect } from 'react';

/* 아래에서 올라오는 행동 메뉴 — 피그마 「RAPO / Sheet / 행동 메뉴 · 다크」 1308:8978 (U08-03 · 내 게시글 메뉴 1308:9012).
   바탕 #203747 · 위 모서리 18 · 제목 20 Bold · 항목 17 · 지우기 같은 항목은 산호색 · 오른쪽 위 「닫기」 14.
   뒤는 어둡게 덮고(공통 표면 / Overlay) 바깥을 누르면 닫힙니다. 글 메뉴와 댓글 메뉴가 같이 씁니다 (2026-11-12 세중님 「커뮤니티 피그마대로」) */
export type 메뉴항목 = { 글: string; 할일: () => void; 붉게?: boolean };

export function RapoSheet({ 제목, 항목, 닫기 }: { 제목: string; 항목: 메뉴항목[]; 닫기: () => void }) {
  /* Esc 로도 닫힙니다 */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') 닫기(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [닫기]);

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={제목}>
      <button type="button" aria-label="메뉴 닫기" onClick={닫기} className="absolute inset-0 cursor-default bg-black/60" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl rounded-t-[18px] px-[22px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[19px]"
        style={{ background: '#203747' }}>
        <div className="flex items-start justify-between">
          <p className="text-[20px] font-bold leading-[30px] text-[#f4f7fa]">{제목}</p>
          <button type="button" onClick={닫기} className="-mr-[9px] px-[9px] py-[4px] text-[14px] leading-[21px] text-[#b4c4cd]">닫기</button>
        </div>
        <ul className="mt-[12px] flex flex-col">
          {항목.map((h) => (
            <li key={h.글}>
              <button type="button" onClick={() => { 닫기(); h.할일(); }}
                className="block w-full py-[14px] text-left text-[17px] leading-[25px]"
                style={{ color: h.붉게 ? '#ffa691' : '#f4f7fa' }}>
                {h.글}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
