'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import { SIDOS, type OrgFacets } from '@/lib/org';

/* 지역을 고르는 아래 창.

   칩을 늘어놓지 않는 이유 — 시군구가 229곳입니다. 칩으로 깔면 화면 두 개를
   넘어가고, 고르는 사람은 자기 동네를 눈으로 찾아야 합니다.
   시도를 먼저 고르면 그 안만 보여주는 두 칸이 훨씬 빠릅니다.

   시군구는 DB 의 org_sgg() 가 갈라 줍니다 — 55,338곳 중 192곳만 못 갈랐습니다
   (대부분 세종입니다. 세종은 시군구가 없습니다). 못 가른 곳은 「OO 전체」로 들어옵니다. */
export function OrgRegion({
  facets, sido, sgg, count, onPick, onClose,
}: {
  facets: OrgFacets;
  sido: string;
  sgg: string;
  count: number;
  onPick: (sido: string, sgg: string) => void;
  onClose: () => void;
}) {
  /* 창 안에서 고르는 동안의 값. 「N곳 보기」를 눌러야 바깥에 옮깁니다 */
  const [pick, setPick] = useState(sido || '서울');
  const [sel, setSel] = useState({ sido, sgg });

  /* 뒤로가기·ESC 로 닫힙니다. 창이 열린 동안 뒤가 안 밀리게 몸통을 잠급니다 */
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const list = facets.sggs[pick] ?? [];
  const sidoN = (k: string) => facets.sidos.find((s) => s.key === k)?.n ?? 0;

  /* 고르는 대로 숫자가 바뀝니다. 아직 안 받아온 조합은 facets 로 셉니다 */
  const shown = sel.sido === ''
    ? facets.total
    : sel.sgg === ''
      ? sidoN(sel.sido)
      : (facets.sggs[sel.sido] ?? []).find((x) => x.key === sel.sgg)?.n ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <div className="relative flex max-h-[86vh] flex-col rounded-t-[22px] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[#DDDDD7]" />

        <div className="flex shrink-0 items-center justify-between px-6 pb-4 pt-4">
          <h2 className="break-keep text-[22px] font-black text-[#14181C]">어디서 찾을까요</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-[#5F666C]
                       transition-transform duration-[120ms] active:scale-[0.88]
                       motion-reduce:transition-none"
          >
            <Icon name="x" size={20} />
            <span className="sr-only">닫기</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 border-t border-[#E3E3DE]">
          {/* 왼쪽 — 시도 17개 */}
          <ul className="w-[104px] shrink-0 overflow-y-auto bg-[#F4F4F1]">
            {SIDOS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => setPick(s)}
                  className={'block w-full px-4 py-4 text-left text-[15px] break-keep '
                    + (pick === s
                      ? 'bg-white font-black text-[#14181C]'
                      : 'text-[#5F666C]')}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>

          {/* 오른쪽 — 그 시도의 시군구 */}
          <ul className="min-w-0 flex-1 overflow-y-auto">
            <Row
              label={`${pick} 전체`}
              n={sidoN(pick)}
              on={sel.sido === pick && sel.sgg === ''}
              onClick={() => setSel({ sido: pick, sgg: '' })}
            />
            {list.map((x) => (
              <Row
                key={x.key}
                label={x.key}
                n={x.n}
                on={sel.sido === pick && sel.sgg === x.key}
                onClick={() => setSel({ sido: pick, sgg: x.key })}
              />
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 items-center gap-3 border-t border-[#E3E3DE] px-6 py-4">
          <button
            type="button"
            onClick={() => { setSel({ sido: '', sgg: '' }); onPick('', ''); }}
            className="h-[50px] shrink-0 rounded-[12px] border border-[#E3E3DE] bg-white px-6
                       text-[15px] font-bold text-[#4A5056]
                       transition-transform duration-[120ms] active:scale-[0.98]
                       motion-reduce:transition-none"
          >
            전국
          </button>
          <button
            type="button"
            onClick={() => onPick(sel.sido, sel.sgg)}
            className="h-[50px] flex-1 rounded-[12px] bg-[#FF3B30] text-[16px] font-bold text-white
                       transition-transform duration-[120ms] active:translate-y-[2px]
                       active:scale-[0.99] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                       motion-reduce:transition-none"
          >
            <span className="num font-black">{shown.toLocaleString('ko-KR')}</span>곳 보기
          </button>
        </div>
      </div>

      {/* 아직 못 받아온 숫자가 아니라는 표시. 지금 화면의 수와 다르면 바로 보입니다 */}
      <span className="sr-only">지금 목록은 {count.toLocaleString('ko-KR')}곳입니다</span>
    </div>
  );
}

function Row({
  label, n, on, onClick,
}: { label: string; n: number; on: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        className={'flex w-full items-center justify-between gap-3 px-6 py-4 text-left '
          + (on ? 'bg-[#FFECEB]' : '')}
      >
        <span className={'min-w-0 break-keep text-[15px] '
          + (on ? 'font-bold text-[#FF3B30]' : 'text-[#4A5056]')}>
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="num text-[13px] text-[#8A9299]">{n.toLocaleString('ko-KR')}</span>
          {on && <Icon name="check" size={16} className="text-[#FF3B30]" />}
        </span>
      </button>
    </li>
  );
}
