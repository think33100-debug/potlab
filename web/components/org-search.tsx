'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { OrgRegion } from '@/components/org-region';
import { browserSupabase } from '@/lib/supabase-browser';
import { BUSY_COLOR } from '@/lib/brand';
import {
  TILES, TILE_NAME, place, shortKinds,
  type OrgFacets, type OrgListRow,
} from '@/lib/org';

/* 병원정보 찾기 — 목록.

   로그인 없이 누구나 봅니다. 대신 한 번에 20곳까지만 받습니다 —
   끊는 자리는 화면이 아니라 DB 함수(org_search)입니다.

   인력 정보가 없는 기관을 감추지 않습니다. 빈칸으로 두면 고장 난 것처럼
   보이고, 감추면 「여기 오면 다 있다」가 무너집니다. 왜 없는지 적어 줍니다. */

const PAGE = 20;

const SORTS = [
  { key: 'staff', label: '치료사 많은 순' },
  { key: 'jobs',  label: '공고 있는 곳 먼저' },
  { key: 'name',  label: '이름순' },
] as const;

const BAND_WORD: Record<string, string> = { busy: '바쁜 곳', mid: '보통', easy: '여유로운 곳' };

export function OrgSearch({
  facets, icons,
}: { facets: OrgFacets; icons: Record<string, string> }) {
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [tile, setTile] = useState('all');
  const [sido, setSido] = useState('');
  const [sgg, setSgg] = useState('');
  const [sort, setSort] = useState<string>('staff');
  const [sheet, setSheet] = useState(false);

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
      {/* ① 머리 ───────────────────────────────── */}
      <header>
        <p className="text-[12px] font-bold tracking-[0.08em] text-[#5F666C]">
          <span className="mr-2 inline-block h-[2px] w-4 -translate-y-[3px] bg-[#FF3B30]" />
          병원정보 찾기
        </p>
        <h1 className="mt-3 break-keep text-[30px] font-black leading-[1.3] text-[#14181C]">
          어디서 일하게<br />될지 먼저 봐요
        </h1>
        <p className="mt-3 break-keep text-[14px] leading-[1.7] text-[#4A5056]">
          치료사가 일하는 <span className="num font-black text-[#FF3B30]">
            {facets.total.toLocaleString('ko-KR')}
          </span>곳을 모았어요. 공고가 없어도 미리 찾아볼 수 있습니다.
        </p>
      </header>

      {/* ② 이름 찾기 ──────────────────────────── */}
      <form
        className="mt-6"
        onSubmit={(e) => { e.preventDefault(); setQ(typed.trim()); }}
      >
        <label htmlFor="org-q" className="sr-only">기관 이름</label>
        <div className="flex h-[52px] items-center gap-3 rounded-[12px] border border-[#E3E3DE]
                        bg-white px-5">
          <Icon name="search" size={18} className="shrink-0 text-[#8A9299]" />
          <input
            id="org-q"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="기관 이름으로 찾기"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[#14181C]
                       outline-none placeholder:text-[#8A9299]"
          />
          {typed && (
            <button
              type="button"
              onClick={() => { setTyped(''); setQ(''); }}
              className="shrink-0 text-[#8A9299]"
            >
              <Icon name="x" size={16} />
              <span className="sr-only">지우기</span>
            </button>
          )}
        </div>
      </form>

      {/* ③ 지역 — 버튼 한 줄 ──────────────────── */}
      <button
        type="button"
        onClick={() => setSheet(true)}
        className="mt-3 flex h-[52px] w-full items-center gap-3 rounded-[12px] bg-[#14181C] px-5
                   text-left transition-transform duration-[120ms] active:scale-[0.99]
                   motion-reduce:transition-none"
      >
        <Icon name="map-pin" size={18} className="shrink-0 text-white" />
        <span className="min-w-0 flex-1 break-keep text-[15px] font-bold text-white">{where}</span>
        <span className="flex shrink-0 items-center gap-1 text-[13px] text-[#8A9299]">
          바꾸기
          <Icon name="chevron-down" size={14} />
        </span>
      </button>

      {/* ④ 종별 — 누르는 아이콘 타일 ──────────── */}
      <div className="-mx-6 mt-4 overflow-x-auto px-6 md:-mx-7 md:px-7"
           style={{ scrollbarWidth: 'none' }}>
        <ul className="flex w-max gap-3 pb-1">
          {TILES.map((t) => {
            const on = tile === t.key;
            return (
              <li key={t.key}>
                <Tile
                  on={on}
                  icon={icons[t.slot]}
                  label={t.label}
                  onClick={() => setTile(t.key)}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ⑤ 결과 머리 ──────────────────────────── */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="min-w-0 break-keep text-[14px] font-bold text-[#14181C]">
          {where} · <span className="num font-black text-[#FF3B30]">
            {total.toLocaleString('ko-KR')}
          </span>곳
        </p>
        <label className="flex shrink-0 items-center gap-1 text-[13px] text-[#5F666C]">
          <span className="sr-only">정렬</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-transparent text-[13px] text-[#5F666C] outline-none"
          >
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {err && <p className="mt-5 break-keep text-[14px] text-[#FF3B30]">{err}</p>}

      {/* ⑥ 기관 카드 ──────────────────────────── */}
      {rows === null ? (
        <p className="mt-6 text-[15px] text-[#5F666C]">불러오는 중이에요…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 break-keep text-[15px] text-[#5F666C]">
          찾은 곳이 없어요. 이름을 줄이거나 지역을 넓혀 보세요
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {rows.map((r) => <li key={`${r.name}/${r.sido_std}`}><Card r={r} /></li>)}
        </ul>
      )}

      {/* ⑦ 더 보기 — 한 번에 20곳씩 ───────────── */}
      {rows && rows.length < total && (
        <button
          type="button"
          disabled={busy}
          onClick={() => { const p = page + 1; setPage(p); load(p, true); }}
          className="mt-4 h-[50px] w-full rounded-[12px] border border-[#E3E3DE] bg-white
                     text-[15px] font-bold text-[#4A5056] disabled:opacity-50
                     transition-transform duration-[120ms] active:scale-[0.99]
                     motion-reduce:transition-none"
        >
          {busy ? '불러오는 중이에요…' : `더 보기 (${(total - rows.length).toLocaleString('ko-KR')}곳 남음)`}
        </button>
      )}

      <p className="mt-7 break-keep text-[12px] leading-relaxed text-[#5F666C]">
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

/* 62px 둥근 네모. 누르면 0.9배로 쏙 들어갔다 나옵니다 */
function Tile({
  on, icon, label, onClick,
}: { on: boolean; icon: string; label: string; onClick: () => void }) {
  const [hit, setHit] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setHit(true);
        if (t.current) clearTimeout(t.current);
        t.current = setTimeout(() => setHit(false), 120);
        onClick();
      }}
      className="flex w-[62px] flex-col items-center gap-2"
    >
      <span
        className={'flex h-[62px] w-[62px] items-center justify-center rounded-[20px] '
          + (on ? 'text-white' : 'border border-[#E3E3DE] bg-white text-[#14181C]')}
        style={{
          backgroundColor: on ? '#FF3B30' : undefined,
          transform: hit ? 'scale(0.9)' : 'none',
          transition: 'transform 120ms ease-out',
        }}
      >
        <Icon name={icon} size={28} />
      </span>
      <span className={'break-keep text-[13px] leading-none '
        + (on ? 'font-black text-[#14181C]' : 'text-[#5F666C]')}>
        {label}
      </span>
    </button>
  );
}

function Card({ r }: { r: OrgListRow }) {
  const kind = TILE_NAME[r.tile] ?? '기관';
  const size = r.bed != null ? `병상 ${r.bed.toLocaleString('ko-KR')}개`
    : r.capacity != null ? `정원 ${r.capacity.toLocaleString('ko-KR')}명`
    : null;

  return (
    <Link
      href={`/orgs?org=${encodeURIComponent(r.name)}&sido=${encodeURIComponent(r.sido_std ?? '')}`}
      className="block rounded-[18px] border border-[#E3E3DE] bg-white p-5
                 transition-transform duration-[120ms] active:scale-[0.99]
                 motion-reduce:transition-none"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#ECECE8] px-3 py-1 text-[12px] font-bold text-[#4A5056]">
          {kind}
        </span>
        {r.band && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-bold text-white"
            style={{ backgroundColor: BUSY_COLOR[r.band] }}
          >
            {BAND_WORD[r.band]}
          </span>
        )}
        {r.n_jobs > 0 && (
          <span className="ml-auto rounded-full bg-[#FFECEB] px-3 py-1 text-[12px] font-bold text-[#FF3B30]">
            공고 있음
          </span>
        )}
      </div>

      <p className="mt-3 break-keep text-[17px] font-extrabold leading-[1.4] text-[#14181C]"
         style={{ overflowWrap: 'break-word' }}>
        {r.name}
      </p>

      {/* 종별은 위 배지가 이미 말합니다. 배지와 같은 말이면 두 번 안 적습니다 */}
      <p className="mt-1 break-keep text-[13px] text-[#5F666C]">
        {[place(r.sido_std, r.sgg_std), size,
          shortKinds(r.kinds) === kind ? '' : shortKinds(r.kinds)]
          .filter(Boolean).join(' · ')}
      </p>

      {r.staffed ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip label="작업" n={r.ot} />
          <Chip label="물리" n={r.pt} />
          <Chip label="재활의학과" n={r.rehab} />
        </div>
      ) : (
        /* 감추지 않습니다. 빈칸이면 고장 난 것처럼 보입니다 */
        <p className="mt-4 break-keep rounded-[10px] bg-[#F4F4F1] px-4 py-3 text-[12px]
                      leading-relaxed text-[#5F666C]">
          인력 정보가 없는 곳이에요. 심평원 자료에 안 잡히는 기관입니다.
        </p>
      )}
    </Link>
  );
}

function Chip({ label, n }: { label: string; n: number | null }) {
  if (n == null) return null;
  return (
    <span className="flex items-baseline gap-1.5 rounded-[9px] bg-[#F4F4F1] px-3 py-1.5">
      <span className="text-[12px] text-[#5F666C]">{label}</span>
      <span className="num text-[14px] font-black text-[#14181C]">{n}</span>
    </span>
  );
}
