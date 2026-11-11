'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { OrgRegion } from '@/components/org-region';
import { browserSupabase } from '@/lib/supabase-browser';
import {
  TILES, TILE_NAME, place, shortKinds,
  type OrgFacets, type OrgListRow,
} from '@/lib/org';

/* 병원정보 찾기 — 목록.

   로그인 없이 누구나 봅니다. 대신 한 번에 20곳까지만 받습니다 —
   끊는 자리는 화면이 아니라 DB 함수(org_search)입니다.

   인력 정보가 없는 기관을 감추지 않습니다. 빈칸으로 두면 고장 난 것처럼
   보이고, 감추면 「여기 오면 다 있다」가 무너집니다. 왜 없는지 적어 줍니다.

   ── 새 디자인 (2026-11-12 · 세중님 「공시 병원 급여는 병원 정보 화면」) ──
   「08 · C / 05 병원 탐색 / 병원 찾기」 1328:2689 — 커뮤니티와 같은 어두운 판.
   하는 일(이름 찾기 · 지역 · 종별 · 정렬 · 20곳씩 더 보기)은 그대로이고 모양만 바꿨습니다.
     종별 타일 줄 → 원본의 「기관 유형 전체」 조건 칩(펼치면 같은 여덟 갈래)
     결과 줄 셋째 줄 — 원본은 별점·후기 수인데 **근무 후기가 아직 없어** 그 자리에
       공고 있음 · 치료사 수(작업·물리·재활의학과)를 적습니다. 별점은 지어내지 않습니다
     원본에 없는 「바쁜 곳/보통/여유로운 곳」 띠와 병상·정원 수는 잠시 뺐습니다 (세중님 규칙: 피그마 우선)
   색은 원본 값 그대로(#112332 바탕 · #203747 칸 · #f4f6f8 글씨 · #bacad4 흐린 글씨 · #ffa691 강조) —
   커뮤니티 어둠 판(components/rapo/rapo-community.tsx)과 같은 처리입니다. */

const PAGE = 20;

const SORTS = [
  { key: 'staff', label: '치료사 많은 순' },
  { key: 'jobs',  label: '공고 있는 곳 먼저' },
  { key: 'name',  label: '이름순' },
] as const;


export function OrgSearch({
  facets,
}: { facets: OrgFacets }) {
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [tile, setTile] = useState('all');
  const [sido, setSido] = useState('');
  const [sgg, setSgg] = useState('');
  const [sort, setSort] = useState<string>('staff');
  const [sheet, setSheet] = useState(false);
  const [종별창, set종별창] = useState(false);

  const [rows, setRows] = useState<OrgListRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* 조건이 바뀌면 처음부터 다시. 더 보기는 뒤에 이어 붙입니다 */
  const load = useCallback(async (p: number, append: boolean) => {
    setBusy(true);
    const { data, error } = await browserSupabase().rpc('org_search', {
      p_q: q || null,
      p_tile: tile === 'all' ? null : tile,
      p_sido: sido || null,
      p_sgg: sgg || null,
      p_sort: sort,
      p_limit: PAGE,
      p_offset: p * PAGE,
    });
    setBusy(false);
    if (error) { setErr(`못 불러왔어요 — ${error.message}`); return; }
    setErr(null);
    const got = (data ?? []) as OrgListRow[];
    setTotal(got[0]?.total ?? (append ? total : 0));
    setRows((old) => (append ? [...(old ?? []), ...got] : got));
  }, [q, tile, sido, sgg, sort, total]);

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => { setPage(0); load(0, false); }, [q, tile, sido, sgg, sort]);

  const where = sido ? place(sido, sgg || null) : '전국';

  return (
    <>
      {/* ① 병원 검색과 조건 — 원본 1312:7463 */}
      <h1 className="break-keep text-[25px] font-bold leading-[36px] text-[#f4f6f8]">어떤 병원이 궁금하세요?</h1>
      <p className="mt-(--rapo-dimension-x1) break-keep text-[14px] leading-[20px] text-[#bacad4]">
        치료사가 일하는 {facets.total.toLocaleString('ko-KR')}곳을 모았어요
      </p>

      <form className="mt-(--rapo-dimension-x4)" onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); }}>
        <label htmlFor="org-q" className="sr-only">병원 이름</label>
        <div className="flex h-[48px] items-center gap-(--rapo-dimension-x2) rounded-[12px] bg-[#203747] pl-[14px] pr-(--rapo-dimension-x1)">
          <input id="org-q" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="병원명으로 검색" enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-[16px] leading-[23px] text-[#f4f6f8] outline-none placeholder:text-[#bacad4]" />
          {typed && (
            <button type="button" onClick={() => { setTyped(''); setQ(''); }}
              className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center text-[18px] leading-none text-[#bacad4]">
              ×<span className="sr-only">지우기</span>
            </button>
          )}
          <button type="submit" className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/orgs/search-16.svg" alt="" width={16} height={16} />
            <span className="sr-only">찾기</span>
          </button>
        </div>
      </form>

      {/* 조건 — 원본 「RAPO / Filter / 조건 선택 트리거」 1412:60025 (38 높이 · 둥근 19 · #203747) */}
      <div className="mt-(--rapo-dimension-x3) flex flex-wrap gap-[10px]">
        <OrgFilterChip label={where === '전국' ? '지역 전체' : where} on={!!sido} onClick={() => setSheet(true)} />
        <div className="relative">
          <OrgFilterChip label={tile === 'all' ? '기관 유형 전체' : (TILE_NAME[tile] ?? '기관 유형')} on={tile !== 'all'}
            onClick={() => set종별창((v) => !v)} 펼침={종별창} />
          {종별창 && (
            <ul className="absolute left-0 top-[46px] z-30 flex min-w-[180px] flex-col rounded-[12px] bg-[#1f3645] py-(--rapo-dimension-x1) shadow-(--rapo-shadow-s2)">
              {TILES.map((t) => (
                <li key={t.key}>
                  <button type="button" aria-pressed={tile === t.key}
                    onClick={() => { setTile(t.key); set종별창(false); }}
                    className={'flex h-(--rapo-touch-min) w-full items-center px-(--rapo-dimension-x4) text-left text-[14px] active:bg-white/10 '
                      + (tile === t.key ? 'font-bold text-[#ffa691]' : 'text-[#f4f6f8]')}>
                    {t.key === 'all' ? '기관 유형 전체' : t.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ② 결과 머리 — 「전체 병원」 + 정렬 */}
      <div className="mt-[26px] flex items-center justify-between gap-(--rapo-dimension-x3)">
        <h2 className="min-w-0 break-keep text-[20px] font-bold leading-[29px] text-[#f4f6f8]">
          {q || sido || tile !== 'all' ? '찾은 병원' : '전체 병원'}
          <span className="ml-(--rapo-dimension-x2) text-[14px] font-normal text-[#bacad4]">{total.toLocaleString('ko-KR')}곳</span>
        </h2>
        <label className="flex shrink-0 items-center">
          <span className="sr-only">정렬</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="h-(--rapo-touch-min) bg-transparent text-[14px] text-[#bacad4] outline-none [&>option]:bg-[#112332]">
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {err && <p role="alert" className="mt-(--rapo-dimension-x4) break-keep text-[14px] text-[#ffa691]">{err}</p>}

      {/* ③ 병원 검색 결과 — 원본 1312:7473 */}
      {rows === null ? (err ? null : 
        <p className="mt-(--rapo-dimension-x6) text-[15px] text-[#bacad4]">불러오는 중이에요…</p>
      ) : rows.length === 0 ? (
        <p className="mt-(--rapo-dimension-x6) break-keep text-[15px] text-[#bacad4]">찾은 병원이 없어요. 이름을 줄이거나 지역을 넓혀 보세요</p>
      ) : (
        <ul className="mt-(--rapo-dimension-x3)">
          {rows.map((r) => <li key={`${r.name}/${r.sido_std}`}><Card r={r} /></li>)}
        </ul>
      )}

      {/* ④ 병원 더 보기 — 원본 1312:9943 (40 높이 · #1f3645) · 한 번에 20곳씩 */}
      {rows && rows.length < total && (
        <button type="button" disabled={busy}
          onClick={() => { const p = page + 1; setPage(p); load(p, true); }}
          className="mt-(--rapo-dimension-x2) flex h-(--rapo-touch-min) w-full items-center justify-center rounded-[10px] bg-[#1f3645]
                     text-[14px] font-bold text-[#e5f0f7] active:bg-[#274457] disabled:opacity-50">
          {busy ? '불러오는 중이에요…' : '병원 더 보기'}
        </button>
      )}

      <p className="mt-(--rapo-dimension-x6) break-keep text-[12px] leading-relaxed text-[#bacad4]">
        건강보험심사평가원 병원 자료와 장기요양·복지·보건 공공자료를 모은 것이에요.
        한 기관이 자료 여러 곳에 있으면 한 줄로 묶어서 보여드려요
      </p>

      {sheet && (
        <OrgRegion
          facets={facets}
          sido={sido}
          sgg={sgg}
          count={total}
          onPick={(sd, sg) => { setSido(sd); setSgg(sg); setSheet(false); }}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}

/* 조건 선택 트리거 — 둥근 19 · 글 14 Bold · 내림 16. 고르면 #ffa691 바탕 */
function OrgFilterChip({ label, on, onClick, 펼침 }: { label: string; on: boolean; onClick: () => void; 펼침?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={펼침}
      className="flex h-(--rapo-touch-min) items-center">
      <span className={'flex h-[38px] items-center gap-(--rapo-dimension-x2) rounded-[19px] px-[12px] text-[14px] font-bold leading-[20px] '
        + (on ? 'bg-[#ffa691] text-[#112332]' : 'bg-[#203747] text-[#f4f6f8]')}>
        {label}
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/orgs/chevron-down-16.svg" alt="" width={16} height={16} className={on ? 'brightness-0' : ''} />
      </span>
    </button>
  );
}

/* 병원 검색 결과 줄 — 원본 1312:7473 (그림 48 · 이름 18 Bold · 위치·종별 14 · 셋째 줄 13 #ffa691 · 아래 선 #344957) */
function Card({ r }: { r: OrgListRow }) {
  const kind = TILE_NAME[r.tile] ?? (shortKinds(r.kinds) || '기관');
  const 인력 = r.staffed
    ? [r.ot != null && `작업 ${r.ot}`, r.pt != null && `물리 ${r.pt}`, r.rehab != null && `재활의학과 ${r.rehab}`].filter(Boolean).join(' · ')
    : '인력 정보 없음';
  return (
    <Link href={`/orgs?org=${encodeURIComponent(r.name)}&sido=${encodeURIComponent(r.sido_std ?? '')}`}
      className="flex items-center gap-[14px] border-b border-[#344957] py-[13px] active:bg-white/5">
      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-[12px] bg-[#ddecf2]">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 「병원 기본 이미지」 */}
        <img src="/rapo/orgs/hospital-40.webp" alt="" width={40} height={40} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="break-keep text-[18px] font-bold leading-[26px] text-[#f4f6f8]" style={{ overflowWrap: 'break-word' }}>{r.name}</span>
        <span className="break-keep text-[14px] leading-[20px] text-[#bacad4]">{[place(r.sido_std, r.sgg_std), kind].filter(Boolean).join(' · ')}</span>
        <span className="break-keep text-[13px] leading-[19px] text-[#ffa691]">
          {r.n_jobs > 0 && <b>공고 있음&nbsp;&nbsp;·&nbsp;&nbsp;</b>}{인력}
        </span>
      </span>
    </Link>
  );
}
