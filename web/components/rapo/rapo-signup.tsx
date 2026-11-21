'use client';

import { useEffect, useState } from 'react';
import { RapoButton } from './rapo-ui';
import {
  EXAMS, HOSPITALS, LANG_MAX, MAX_ROWS, NONE, OPIC_LEVELS, REGIONS, emptyLang, langError, rowFull, rowsReady,
  type ChipGroup, type LangRow, type WorkRow,
} from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';

/* 회원가입에서만 쓰는 부품 (2026-11-16 · 피그마 「07 · B 가입과 원래 화면 복귀」 1204:24432 화면을 하나씩 맞춤).
   피그마 원본 — 가입 전용 UI 1211:25717 · 1245:955 · 1297:1247
     진행 표시 「RAPO / B / 단계」 · 고르는 칸 「RAPO / Select Field」 227:387 · 체크 「RAPO / Checkbox」 205:46 ·
     선택 결과 칩 1559:6427 · 실습 요약 카드 1540:6229 · 아래에서 올라오는 선택창(자격증 1299:4699 · 교육 1299:4876/4951/4994 · 실습 1562:5693)
   내 정보의 스펙 고치기(app/me/spec · me/convert)는 components/signup-survey 의 Chips·Rows·Langs 를 그대로 씁니다 — 거기는 피그마 12 쪽 꼴이라 건드리지 않았습니다.
   담는 값은 그쪽과 같습니다 (자격·교육 '묶음 - 항목' · 실습 WorkRow · 어학 LangRow · 없음은 NONE) */

/* ── 진행 표시 — 피그마 1487:4579 (글 14 · 막대 4px · 칸 사이 4 · 막대 위 10) ── */
export function 가입진행({ 이름, n, 모두 }: { 이름: string; n: number; 모두: number }) {
  return (
    <div role="group" aria-label={`가입 순서 ${n} / ${모두} · ${이름}`}>
      <div className="flex items-center gap-(--rapo-dimension-x2)">
        <p className="rapo-type-t4-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral-muted)">{이름}</p>
        <p className="rapo-type-t4-bold shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral)">{n} / {모두}</p>
      </div>
      <div aria-hidden className="mt-(--rapo-dimension-x2_5) flex gap-(--rapo-dimension-x1)">
        {Array.from({ length: 모두 }, (_, i) => (
          <span key={i} className={'h-[4px] flex-1 ' + (i < n ? 'bg-(--rapo-color-bg-brand-solid)' : 'bg-(--rapo-color-bg-neutral-weak)')} />
        ))}
      </div>
    </div>
  );
}

/* ── 아래 꺾쇠 (피그마 「RAPO / Icon / Chevron down」 20) ── */
export function 꺾쇠({ 흐림 = false }: { 흐림?: boolean }) {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none"
      className={'shrink-0 ' + (흐림 ? 'text-(color:--rapo-color-fg-disabled)' : 'text-(color:--rapo-color-fg-neutral)')}>
      <path d="M4 7.5l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── 누르면 선택창이 열리는 칸 — 「RAPO / Select Field」 Trigger (높이 52 · 둥글기 12 · 오류면 빨간 테) ── */
export function 여는칸({ 글, 빈글, on, 막힘 = false, 틀림 = false, aria }: {
  글?: string; 빈글: string; on: () => void; 막힘?: boolean; 틀림?: boolean; aria?: string;
}) {
  return (
    <button type="button" onClick={on} disabled={막힘} aria-label={aria}
      className={'flex h-(--rapo-dimension-x13) w-full min-w-0 items-center gap-(--rapo-dimension-x2_5) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) px-(--rapo-dimension-x4) text-left '
        + (틀림 ? 'border-(color:--rapo-color-stroke-critical-solid) ' : 'border-(color:--rapo-color-stroke-neutral-weak) ')
        + 'bg-(--rapo-color-bg-layer-default) active:bg-(--rapo-color-bg-transparent-pressed) disabled:active:bg-transparent'}>
      <span className={'rapo-type-t5-regular min-w-0 flex-1 truncate '
        + (막힘 ? 'text-(color:--rapo-color-fg-disabled)' : 글 ? 'text-(color:--rapo-color-fg-neutral)' : 'text-(color:--rapo-color-fg-placeholder)')}>
        {글 || 빈글}
      </span>
      <꺾쇠 흐림={막힘} />
    </button>
  );
}

/* ── 체크 — 「RAPO / Checkbox」 (마크 20 · 글 14 · 누르는 높이 44) ── */
export function 체크마크({ on, 반 = false }: { on: boolean; 반?: boolean }) {
  return (
    <span aria-hidden
      className={'flex size-[20px] shrink-0 items-center justify-center rounded-(--rapo-radius-r1) border-(length:--rapo-border-default) '
        + (on || 반 ? 'border-(color:--rapo-color-bg-navy-solid) bg-(--rapo-color-bg-navy-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default)')}>
      {on ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="var(--rapo-color-fg-on-navy-solid)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : 반 ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 6h6" stroke="var(--rapo-color-fg-on-navy-solid)" strokeWidth="1.6" strokeLinecap="round" /></svg>
      ) : null}
    </span>
  );
}
export function 체크({ on, set, children, 막힘 = false }: { on: boolean; set: (v: boolean) => void; children: React.ReactNode; 막힘?: boolean }) {
  return (
    <label className={'flex min-h-[44px] cursor-pointer items-center gap-(--rapo-dimension-x2) ' + (막힘 ? 'opacity-40' : '')}>
      <input type="checkbox" className="sr-only" checked={on} disabled={막힘} onChange={(e) => set(e.target.checked)} />
      <체크마크 on={on} />
      <span className="rapo-type-t4-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral)">{children}</span>
    </label>
  );
}

/* ── 아래에서 올라오는 선택창 — 피그마 1299:4699 (흰 바탕 · 위 모서리 24 · 제목 22 Bold · 오른쪽 위 × · 아래 고정 단추) ── */
export function SelectSheet({ 제목, 설명, 닫기, 단추, children, 낮게 = false }: {
  제목: string; 설명?: string; 닫기: () => void; 단추: React.ReactNode; children: React.ReactNode; 낮게?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') 닫기(); };
    addEventListener('keydown', k);
    const 전 = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', k); document.body.style.overflow = 전; };
  }, [닫기]);
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={제목}>
      <button type="button" aria-label="닫기" onClick={닫기} className="absolute inset-0 cursor-default bg-(--rapo-color-bg-overlay)" />
      <div className={"absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-48px)] max-w-3xl  flex-col rounded-t-[24px] bg-(--rapo-color-bg-layer-default) " + (낮게 ? "" : "h-[min(776px,calc(100dvh-48px))]")}>
        <div className="flex items-start gap-(--rapo-dimension-x2) px-(--rapo-dimension-x6) pt-(--rapo-dimension-x6)">
          <div className="min-w-0 flex-1">
            <p className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">{제목}</p>
            {설명 && <p className="rapo-type-t3-regular mt-(--rapo-dimension-x1) break-keep text-(color:--rapo-color-fg-neutral-muted)">{설명}</p>}
          </div>
          <button type="button" onClick={닫기} aria-label="닫기"
            className="-mr-(--rapo-dimension-x3) -mt-(--rapo-dimension-x2) flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
            <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15 5L5 15M5 5l10 10" stroke="var(--rapo-color-fg-neutral)" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-(--rapo-dimension-x6) pt-(--rapo-dimension-x4) pb-(--rapo-dimension-x4)">{children}</div>
        <div className="px-(--rapo-dimension-x6) pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x6)+env(safe-area-inset-bottom))]">{단추}</div>
      </div>
    </div>
  );
}

const 입력칸 = 'rapo-type-t5-regular h-[56px] w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
  + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-placeholder)';

/* ── 선택 결과 칩 — 1559:6427 (회색 바탕 · 글 13 Medium · 오른쪽 × 36) ── */
function 결과칩({ 글, 빼기 }: { 글: string; 빼기: () => void }) {
  return (
    <span className="flex max-w-full flex-auto items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) py-(--rapo-dimension-x1) pr-(--rapo-dimension-x1) pl-(--rapo-dimension-x3)">
      <span className="rapo-type-t3-medium min-w-0 flex-auto break-keep text-(color:--rapo-color-fg-neutral)">{글}</span>
      <button type="button" onClick={빼기} aria-label={`${글} 빼기`}
        className="flex size-[36px] shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
        <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5l-7 7M3.5 3.5l7 7" stroke="var(--rapo-color-fg-neutral)" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </span>
  );
}

/** 담긴 값 '묶음 - 항목' → 화면 글 「묶음 — 항목」 (피그마 칩 글 그대로) */
const 칩글 = (v: string) => v.replace(' - ', ' — ');

/* ── 칸 머리 — 제목 + 개수 · 오른쪽 「없음」 체크 (피그마 「제목·없음」 1559:6450) ── */
function 칸머리({ 제목, 수, 없음글, 없음, set없음 }: { 제목: string; 수?: string; 없음글: string; 없음: boolean; set없음: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-(--rapo-dimension-x2)">
      <p className="rapo-type-t5-bold min-w-0 break-keep text-(color:--rapo-color-fg-neutral)">
        {제목}{수 && <span className="ml-(--rapo-dimension-x2) whitespace-nowrap">{수}</span>}
      </p>
      <체크 on={없음} set={set없음}>{없음글}</체크>
    </div>
  );
}

/* ── 자격증·교육 칸 — 「선택 추가·변경」을 누르면 선택창 · 고른 것은 아래 칩 ── */
export function PickGroupField({ 종류, 제목, 없음글, groups, picked, on, 직군 }: {
  종류: '자격증' | '교육'; 제목: string; 없음글: string; groups: ChipGroup[]; picked: string[]; on: (v: string[]) => void; 직군?: string;
}) {
  const [열림, set열림] = useState(false);
  const [다보기, set다보기] = useState(false);
  const 없음 = picked.includes(NONE);
  const 고른것 = picked.filter((x) => x !== NONE);
  /* 교육은 두 개까지 보이고 「선택한 N개 더 보기」 (피그마 1297:1306) · 자격증은 짧아서 모두 */
  const 보일것 = 종류 === '교육' && !다보기 ? 고른것.slice(0, 2) : 고른것;
  const 남은수 = 고른것.length - 보일것.length;
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2) pb-(--rapo-dimension-x2)">
      <칸머리 제목={제목} 수={고른것.length ? String(고른것.length) : undefined} 없음글={없음글} 없음={없음} set없음={(v) => on(v ? [NONE] : [])} />
      <여는칸 글={없음 ? undefined : '선택 추가·변경'} 빈글={없음 ? '선택하려면 없음 해제' : '선택 추가·변경'} 막힘={없음} on={() => set열림(true)} aria={`${제목} 선택 추가·변경`} />
      {보일것.length > 0 && (
        <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
          {보일것.map((x) => <결과칩 key={x} 글={칩글(x)} 빼기={() => on(picked.filter((y) => y !== x))} />)}
        </div>
      )}
      {남은수 > 0 && (
        <button type="button" onClick={() => set다보기(true)} className="rapo-type-t3-medium self-start py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">
          선택한 {남은수}개 더 보기
        </button>
      )}
      {열림 && (종류 === '자격증'
        ? <CertSheet groups={groups} picked={고른것} on={on} 닫기={() => set열림(false)} />
        : <CourseSheet groups={groups} picked={고른것} on={on} 닫기={() => set열림(false)} 직군={직군} />)}
    </div>
  );
}

const 완료글 = (n: number) => (n > 0 ? `${n}개 선택 완료` : '선택 없이 돌아가기');

/* 자격증 선택 — 1299:4699 · 급수가 있는 자격증은 이름 아래 급수 체크, 없는 것은 이름 체크 · 맨 아래 직접 추가 */
function CertSheet({ groups, picked, on, 닫기 }: { groups: ChipGroup[]; picked: string[]; on: (v: string[]) => void; 닫기: () => void }) {
  const [글, set글] = useState('');
  const 토글 = (v: string, 켬: boolean) => on(켬 ? [...picked, v] : picked.filter((x) => x !== v));
  const 더하기 = () => { const t = 글.trim().slice(0, 40); set글(''); if (t && !picked.includes(t)) on([...picked, t]); };
  const known = new Set(groups.flatMap((g) => (g.s.length ? g.s.map((s) => `${g.n} - ${s}`) : [g.n])));
  const 직접 = picked.filter((p) => !known.has(p));
  return (
    <SelectSheet 제목="자격증 선택" 설명="보유한 자격증과 급수를 모두 골라주세요." 닫기={닫기}
      단추={<RapoButton full onClick={닫기}>{완료글(picked.length)}</RapoButton>}>
      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        {groups.map((g) => g.s.length ? (
          <div key={g.n} className="flex flex-col">
            <p className="rapo-type-t4-bold pt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">{g.n}</p>
            <div className="flex flex-wrap gap-x-(--rapo-dimension-x4)">
              {g.s.map((s) => { const v = `${g.n} - ${s}`; return <체크 key={s} on={picked.includes(v)} set={(b) => 토글(v, b)}>{s}</체크>; })}
            </div>
          </div>
        ) : <체크 key={g.n} on={picked.includes(g.n)} set={(b) => 토글(g.n, b)}>{g.n}</체크>)}
        {직접.map((x) => <체크 key={x} on set={(b) => 토글(x, b)}>{x}</체크>)}
        <p className="rapo-type-t4-medium mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">목록에 없나요? 직접 추가</p>
        <input value={글} onChange={(e) => set글(e.target.value)} placeholder="자격증명·급수 입력" aria-label="직접 추가할 자격증" className={입력칸}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); 더하기(); } }} />
        <button type="button" onClick={더하기} disabled={!글.trim()}
          className="rapo-type-t4-medium self-start py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral) disabled:text-(color:--rapo-color-fg-disabled)">
          ＋ 직접 입력한 자격증 추가
        </button>
      </div>
    </SelectSheet>
  );
}

/* 교육 선택 — 1299:4876 (묶음 펼침) · 1299:4951 (검색) · 1299:4994 (직접 추가) */
function CourseSheet({ groups, picked, on, 닫기, 직군 }: { groups: ChipGroup[]; picked: string[]; on: (v: string[]) => void; 닫기: () => void; 직군?: string }) {
  const [q, setQ] = useState('');
  const [펼침, set펼침] = useState<string | null>(groups.find((g) => picked.some((p) => p.startsWith(g.n + ' - ')))?.n ?? groups[0]?.n ?? null);
  const [직접, set직접] = useState(false);
  const [기관, set기관] = useState('');
  const [과정, set과정] = useState('');
  const 다듬 = (x: string) => x.replace(/\s+/g, '').toLowerCase();
  const 찾기 = 다듬(q);
  const 토글 = (v: string, 켬: boolean) => on(켬 ? [...picked, v] : picked.filter((x) => x !== v));
  const 보일묶음 = groups
    .map((g) => ({ n: g.n, s: !찾기 || 다듬(g.n).includes(찾기) ? g.s : g.s.filter((s) => 다듬(s).includes(찾기)) }))
    .filter((g) => g.s.length > 0);
  const known = new Set(groups.flatMap((g) => g.s.map((s) => `${g.n} - ${s}`)));
  const 손으로 = picked.filter((p) => !known.has(p));

  if (직접) {
    const 새값 = `${기관.trim()} - ${과정.trim()}`;
    const 됨 = !!기관.trim() && !!과정.trim();
    return (
      <SelectSheet 제목="교육 직접 추가" 설명="목록에 없는 과정은 기관과 과정명을 함께 적어주세요." 닫기={() => set직접(false)}
        단추={<RapoButton full disabled={!됨} onClick={() => { if (!picked.includes(새값)) on([...picked, 새값]); 닫기(); }}>추가하고 선택 완료</RapoButton>}>
        <div className="flex flex-col gap-(--rapo-dimension-x2)">
          <label className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)" htmlFor="교육기관">교육기관</label>
          <input id="교육기관" value={기관} maxLength={30} onChange={(e) => set기관(e.target.value)} placeholder="교육기관 입력" className={입력칸} />
          <label className="rapo-type-t4-medium mt-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)" htmlFor="과정명">과정명</label>
          <input id="과정명" value={과정} maxLength={40} onChange={(e) => set과정(e.target.value)} placeholder="이수한 과정명 입력" className={입력칸} />
          <p className="rapo-type-t3-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">이미 선택한 과정은 중복으로 추가되지 않아요.</p>
        </div>
      </SelectSheet>
    );
  }

  return (
    <SelectSheet 제목={찾기 ? '교육 검색' : '교육 이수 선택'}
      설명={`${직군 ? 직군 + ' · ' : ''}${찾기 ? '검색해도 기존 선택은 유지돼요.' : '이수한 과정을 모두 골라주세요.'}`} 닫기={닫기}
      단추={<RapoButton full onClick={닫기}>{완료글(picked.length)}</RapoButton>}>
      <div className="flex flex-col">
        <label htmlFor="교육검색" className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">교육 검색</label>
        <input id="교육검색" value={q} onChange={(e) => setQ(e.target.value)} placeholder="기관 또는 과정 검색" autoComplete="off"
          className={입력칸 + ' mt-(--rapo-dimension-x2)'} />
        <ul className="mt-(--rapo-dimension-x2) flex flex-col">
          {보일묶음.map((g) => {
            const 열림 = !!찾기 || 펼침 === g.n;
            const 수 = picked.filter((p) => p.startsWith(g.n + ' - ')).length;
            return (
              <li key={g.n}>
                <button type="button" onClick={() => set펼침(열림 && !찾기 ? null : g.n)} aria-expanded={열림}
                  className="flex min-h-[60px] w-full items-center gap-(--rapo-dimension-x2) text-left">
                  <span className="rapo-type-t4-bold min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">
                    {g.n}{수 > 0 && <span className="ml-(--rapo-dimension-x2)">{수}</span>}
                  </span>
                  <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" className={'shrink-0 ' + (열림 ? 'rotate-180' : '')}>
                    <path d="M3.5 6l4.5 4.5L12.5 6" stroke="var(--rapo-color-fg-neutral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {열림 && (
                  <div className="flex flex-col pb-(--rapo-dimension-x2)">
                    {g.s.map((s) => { const v = `${g.n} - ${s}`; return <체크 key={s} on={picked.includes(v)} set={(b) => 토글(v, b)}><span className="whitespace-normal break-keep">{s}</span></체크>; })}
                  </div>
                )}
              </li>
            );
          })}
          {보일묶음.length === 0 && <li className="rapo-type-t4-regular py-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">찾는 과정이 없어요.</li>}
        </ul>
        {손으로.length > 0 && (
          <div className="flex flex-col pb-(--rapo-dimension-x2)">
            <p className="rapo-type-t4-bold py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">직접 추가한 과정</p>
            {손으로.map((x) => <체크 key={x} on set={(b) => 토글(x, b)}><span className="whitespace-normal break-keep">{칩글(x)}</span></체크>)}
          </div>
        )}
        <button type="button" onClick={() => set직접(true)}
          className="rapo-type-t4-medium mt-(--rapo-dimension-x2) self-start py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
          목록에 없나요? 직접 추가 ›
        </button>
      </div>
    </SelectSheet>
  );
}

/* ── 실습 칸 — 1540:6229 (「실습 추가하기 ＋」 → 실습 입력 창 1562:5693 · 요약 카드 · 최대 5개) ── */
export function PracticeField({ 제목, rows, on, 없음, set없음 }: { 제목: string; rows: WorkRow[]; on: (v: WorkRow[]) => void; 없음: boolean; set없음: (v: boolean) => void }) {
  const [고침, set고침] = useState<number | 'new' | null>(null);
  const 꽉참 = rows.length >= MAX_ROWS;
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x3)">
      <칸머리 제목={제목} 수={rows.length ? `${rows.length}/${MAX_ROWS}` : undefined} 없음글="실습 없음" 없음={없음} set없음={set없음} />
      <여는칸 글={없음 || 꽉참 ? undefined : '실습 추가하기  ＋'} 빈글={없음 ? '추가하려면 없음 해제' : '최대 5개까지 넣을 수 있어요'} 막힘={없음 || 꽉참}
        on={() => set고침('new')} aria={`${제목} 추가하기`} />
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) py-(--rapo-dimension-x3) pr-(--rapo-dimension-x2) pl-(--rapo-dimension-x4)">
          <div className="flex items-center gap-(--rapo-dimension-x2)">
            <p className="rapo-type-t4-bold min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{r.hospital || '기관 유형 없음'}</p>
            <button type="button" aria-label={`${i + 1}번째 실습 지우기`} onClick={() => on(rows.filter((_, j) => j !== i))}
              className="-my-(--rapo-dimension-x2) flex size-[36px] shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
              <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5l-7 7M3.5 3.5l7 7" stroke="var(--rapo-color-fg-neutral)" strokeWidth="1.6" strokeLinecap="round" /></svg>
            </button>
          </div>
          <p className="rapo-type-t3-regular flex flex-wrap items-center gap-x-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
            <span className="whitespace-nowrap">{[r.region, r.months && `${r.months}개월`].filter(Boolean).join(' · ')}</span>
            <button type="button" onClick={() => set고침(i)} className="whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">수정 ›</button>
          </p>
        </div>
      ))}
      {고침 !== null && (
        <PracticeSheet 처음={고침 === 'new' ? null : rows[고침]} 닫기={() => set고침(null)}
          on={(r) => { on(고침 === 'new' ? [...rows, r] : rows.map((x, j) => (j === 고침 ? r : x))); set고침(null); }} />
      )}
    </div>
  );
}

function PracticeSheet({ 처음, on, 닫기 }: { 처음: WorkRow | null; on: (r: WorkRow) => void; 닫기: () => void }) {
  const [r, setR] = useState<WorkRow>(처음 ?? { hospital: '', region: '', months: '' });
  const 기타 = r.hospital.startsWith('기타');
  const 됨 = rowFull(r) && rowsReady([r]);
  const 개월틀림 = !!r.months && !rowsReady([{ ...r, hospital: r.hospital || 'x', region: r.region || 'x' }]);
  return (
    <SelectSheet 제목="실습 입력" 설명="병원명 없이 기관 유형·지역·기간만 입력해 주세요." 닫기={닫기}
      단추={<RapoButton full disabled={!됨} onClick={() => on(r)}>{처음 ? '실습 수정하기' : '실습 추가하기'}</RapoButton>}>
      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        <고름 label="기관 유형" v={기타 ? '기타' : r.hospital} opts={HOSPITALS} ph="기관 유형 선택" on={(v) => setR({ ...r, hospital: v })} />
        {/* 「기타」면 실습지를 직접 적습니다 (2026-11-16 테스터 피드백 「기타에 실습지 적을 수 있게 ex) 치매센터」) — 「기타 · 치매센터」로 담습니다 */}
        {기타 && (
          <input value={r.hospital.replace(/^기타( · )?/, '')} maxLength={30} aria-label="기타 기관 이름" placeholder="어디인지 적어 주세요 (예: 치매센터)"
            onChange={(e) => setR({ ...r, hospital: e.target.value.trim() ? `기타 · ${e.target.value}` : '기타' })} className={입력칸} />
        )}
        <div className="mt-(--rapo-dimension-x2)" />
        <고름 label="지역" v={r.region} opts={REGIONS} ph="지역 선택" on={(v) => setR({ ...r, region: v })} />
        <label htmlFor="실습개월" className="rapo-type-t4-medium mt-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">실습 기간 (개월)</label>
        <input id="실습개월" type="number" inputMode="numeric" value={r.months} placeholder="예: 2" onChange={(e) => setR({ ...r, months: e.target.value })}
          className={입력칸 + (개월틀림 ? ' border-(color:--rapo-color-stroke-critical-solid)' : '')} />
        <p className={'rapo-type-t3-regular mt-(--rapo-dimension-x2) break-keep ' + (개월틀림 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
          {개월틀림 ? '실습 기간을 다시 확인해 주세요.' : '실습은 최대 5개까지 추가할 수 있어요.'}
        </p>
      </div>
    </SelectSheet>
  );
}

/* 선택창 안의 고르는 칸 (기본 고르기 창) */
function 고름({ label, v, opts, ph, on }: { label: string; v: string; opts: readonly string[]; ph: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">{label}</span>
      <span className="relative block">
        <select value={v} onChange={(e) => on(e.target.value)}
          className={입력칸 + ' h-(--rapo-dimension-x13) appearance-none pr-(--rapo-dimension-x10) ' + (v ? '' : 'text-(color:--rapo-color-fg-placeholder)')}>
          <option value="" disabled>{ph}</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="pointer-events-none absolute right-(--rapo-dimension-x4) top-1/2 -translate-y-1/2"><꺾쇠 /></span>
      </span>
    </label>
  );
}

/* ── 어학 (선택) — 「RAPO / List / 선택·이동 행」 (회색 · ›) → 어학 입력 창 ── */
const 어학말 = (r: LangRow) => (r.exam === '오픽' ? `오픽 ${r.level}` : `${r.exam} ${r.score}점`);
export function LangField({ rows, on }: { rows: LangRow[]; on: (v: LangRow[]) => void }) {
  const [열림, set열림] = useState(false);
  const 찬것 = rows.filter((r) => r.exam && !langError(r));
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <p className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">어학 (선택)</p>
      <button type="button" onClick={() => set열림(true)}
        className="flex items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-left active:bg-(--rapo-color-bg-neutral-weak-pressed)">
        <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">
          {찬것.length ? <>{찬것.map(어학말).join(' · ')}<span className="ml-(--rapo-dimension-x4) whitespace-nowrap">수정</span></> : '어학 정보 추가'}
        </span>
        <span aria-hidden className="rapo-type-t7-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
      </button>
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">어학 정보가 없어도 다음으로 넘어갈 수 있어요.</p>
      {열림 && <LangSheet 처음={rows} on={(v) => { on(v); set열림(false); }} 닫기={() => set열림(false)} />}
    </div>
  );
}

function LangSheet({ 처음, on, 닫기 }: { 처음: LangRow[]; on: (v: LangRow[]) => void; 닫기: () => void }) {
  const [rows, setRows] = useState<LangRow[]>(처음.length ? 처음 : [emptyLang()]);
  const edit = (i: number, p: Partial<LangRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const 틀림 = rows.some((r) => r.exam && langError(r));
  return (
    <SelectSheet 제목="어학 입력" 설명="시험과 점수를 골라 주세요. 같은 시험은 한 번만 넣을 수 있어요." 닫기={닫기}
      단추={<RapoButton full disabled={틀림} onClick={() => on(rows.filter((r) => r.exam))}>입력 완료</RapoButton>}>
      <div className="flex flex-col gap-(--rapo-dimension-x5)">
        {rows.map((r, i) => {
          const 쓴시험 = new Set(rows.filter((_, j) => j !== i).map((x) => x.exam));
          const 시험 = EXAMS.find((x) => x.name === r.exam);
          const bad = r.exam ? langError(r) : null;
          return (
            <div key={i} className="flex flex-col gap-(--rapo-dimension-x2)">
              <div className="flex items-center justify-between">
                <p className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">{i + 1}번째 어학</p>
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rapo-type-t3-regular px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">지우기</button>
              </div>
              <div className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
                {EXAMS.map((x) => {
                  const 켬 = r.exam === x.name;
                  return (
                    <button key={x.name} type="button" disabled={쓴시험.has(x.name)} aria-pressed={켬} onClick={() => edit(i, { exam: x.name, score: '', level: '' })}
                      className={'rapo-type-t4-medium h-[46px] rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) disabled:opacity-30 '
                        + (켬 ? 'border-(color:--rapo-color-stroke-brand-solid) bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-neutral)'
                              : 'border-transparent bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral)')}>
                      {x.name}
                    </button>
                  );
                })}
              </div>
              {r.exam === '오픽' ? (
                <고름 label="등급" v={r.level} opts={OPIC_LEVELS} ph="등급 선택" on={(v) => edit(i, { level: v })} />
              ) : r.exam ? (
                <input type="number" inputMode="numeric" value={r.score} min={0} max={시험?.max} placeholder={`점수 (예: ${시험?.ph ?? ''})`}
                  aria-label={`${r.exam} 점수`} onChange={(e) => edit(i, { score: e.target.value })}
                  className={입력칸 + (bad ? ' border-(color:--rapo-color-stroke-critical-solid)' : '')} />
              ) : null}
              {bad && <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-critical)">{bad}</p>}
            </div>
          );
        })}
        {rows.length < LANG_MAX && (
          <button type="button" onClick={() => setRows([...rows, emptyLang()])}
            className="rapo-type-t4-medium self-start py-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">＋ 어학 하나 더</button>
        )}
      </div>
    </SelectSheet>
  );
}

/* ── 입학 연월 선택창 — 1241:2285 (연도 고르기 + 열두 달 · 「선택 완료」) ── */
export function YearMonthSheet({ 년, 월, 연도들, on, 닫기 }: { 년?: string; 월?: string; 연도들: string[]; on: (y: string, m: string) => void; 닫기: () => void }) {
  const [y, setY] = useState(년 || 연도들[0]);
  const [m, setM] = useState(월 ?? '');
  return (
    <SelectSheet 낮게 제목="입학 연월" 닫기={닫기} 단추={<RapoButton full disabled={!m} onClick={() => on(y, m)}>선택 완료</RapoButton>}>
      <label className="relative inline-flex items-center gap-(--rapo-dimension-x1)">
        <select value={y} onChange={(e) => setY(e.target.value)} aria-label="입학 연도"
          className="rapo-type-t3-bold appearance-none bg-transparent py-(--rapo-dimension-x2) pr-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)">
          {연도들.map((x) => <option key={x} value={x}>{x}년</option>)}
        </select>
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" fill="none" className="pointer-events-none absolute right-0"><path d="M2.5 4l2.5 2.5L7.5 4" stroke="var(--rapo-color-fg-neutral)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </label>
      <div className="mt-(--rapo-dimension-x3) grid grid-cols-4 gap-(--rapo-dimension-x4)">
        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((x) => {
          const 켬 = m === x;
          return (
            <button key={x} type="button" aria-pressed={켬} onClick={() => setM(x)}
              className={'rapo-type-t5-regular h-[46px] whitespace-nowrap rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) text-(color:--rapo-color-fg-neutral) '
                + (켬 ? 'border-(color:--rapo-color-stroke-brand-solid) bg-(--rapo-color-bg-brand-weak)' : 'border-transparent bg-(--rapo-color-bg-neutral-weak) active:bg-(--rapo-color-bg-neutral-weak-pressed)')}>
              {Number(x)}월
            </button>
          );
        })}
      </div>
      <p className="rapo-type-t3-regular mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral-muted)">선택한 학력과 입학 연월로 졸업 시점을 계산해요.</p>
    </SelectSheet>
  );
}

/* 병원 후보 — 이름과 시군구가 같은 줄은 하나로 (2026-11-17 세중님 「광주보훈병원이 2개 나오고」).
   까닭 — 2026년 광주·전남 통합으로 심평원 주소가 「전남광주통합특별시 광산구」가 되어, 같은 병원이 심평원 쪽은 「전남」·공공병원 목록 쪽은
   「광주」로 갈려 병원 목록(org_group_mv)에 두 줄로 들어갑니다(광주 쪽 여덟 곳). 가입은 이름만 담으니 여기서 하나로 합칩니다.
   둘 중 하나가 「광주」면 「광주」로 보여 줍니다. 「한국보훈복지의료공단」이 붙고 안 붙고는 심평원에 등록된 이름 그대로입니다 */
export type 병원후보 = { name: string; 곳: string };
export function 병원후보로(rs: { name: string; sido_std: string | null; sgg_std: string | null }[], 몇 = 5): 병원후보[] {
  const 본 = new Map<string, { name: string; sido: string | null; sgg: string | null }>();
  for (const r of rs) {
    const 키 = r.name + '|' + (r.sgg_std ?? '');
    const 있 = 본.get(키);
    if (!있) 본.set(키, { name: r.name, sido: r.sido_std, sgg: r.sgg_std });
    else if (r.sido_std === '광주') 있.sido = '광주';
  }
  return [...본.values()].slice(0, 몇).map((r) => ({ name: r.name, 곳: [r.sido, r.sgg].filter(Boolean).join(' ') }));
}

/* ── 근무한 병원 찾기 — 1245:3594(빈칸) · 3616(결과) · 3641/3665(직접 입력) · org_search(회원 권한) · 이름만 담습니다 ── */
export function HospitalSearch({ 처음, 직접으로, on, 닫기 }: { 처음: string; 직접으로: boolean; on: (이름: string) => void; 닫기: () => void }) {
  const [직접, set직접] = useState(직접으로);
  const [q, setQ] = useState(처음);
  /* 받은 결과는 어떤 말로 찾은 것인지 함께 둡니다 — 지금 칸의 말과 같을 때만 보여 줍니다 (2026-11-21 세중님 「추천이 안 뜨는 느낌」).
     전에는 ① 늦게 온 옛 결과가 새 결과를 덮었고 ② 찾는 중·0곳·못 불러옴이 모두 같은 안내 글로 보여 추천이 안 뜬 것처럼 보였습니다 */
  const [받은, set받은] = useState<{ 말: string; 후보: { name: string; 곳: string }[]; 오류: boolean } | null>(null);
  const 말 = q.trim();
  const 찾을때 = !직접 && 말.length >= 2;
  const 이번 = 찾을때 && 받은?.말 === 말 ? 받은 : null;
  const 후보 = 이번?.후보 ?? [];
  useEffect(() => {
    if (!찾을때) return;
    let 지남 = false;
    const t = setTimeout(async () => {
      const { data, error } = await browserSupabase().rpc('org_search', { p_q: 말, p_tile: null, p_sido: null, p_sgg: null, p_sort: null, p_limit: 8, p_offset: 0 });
      if (지남) return;
      set받은({ 말, 오류: !!error, 후보: error ? [] : 병원후보로((data ?? []) as { name: string; sido_std: string | null; sgg_std: string | null }[]) });
    }, 250);
    return () => { 지남 = true; clearTimeout(t); };
  }, [말, 찾을때]);
  const 안내 = !찾을때 ? '병원명으로 검색한 뒤 지역을 함께 확인해 주세요.'
    : !이번 ? '찾는 중이에요…'
    : 이번.오류 ? '병원 목록을 못 불러왔어요. 잠시 뒤 다시 적어 주세요.'
    : `「${말}」(으)로 찾은 병원이 없어요. 이름을 줄여 적거나 직접 입력해 주세요.`;
  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
        <button type="button" onClick={직접 && !직접으로 ? () => set직접(false) : 닫기} aria-label="이전으로"
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
        </button>
        <p className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">회원가입</p>
        <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
      </header>
      <main className="flex flex-1 flex-col gap-(--rapo-dimension-x5) px-(--rapo-dimension-x6) pt-(--rapo-dimension-x6) pb-(--rapo-dimension-x6)">
        {직접 ? (
          <>
            <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">병원명을 직접 입력해요</h1>
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <label htmlFor="병원직접" className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">병원명</label>
              <input id="병원직접" value={q} maxLength={40} onChange={(e) => setQ(e.target.value)} placeholder="병원명 입력" className={입력칸} />
            </div>
            <p className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
              등록된 병원과 연결되기 전에는 병원별 입사 스펙 통계에 반영되지 않아요.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <h1 className="rapo-type-t11-bold break-keep text-(color:--rapo-color-fg-neutral)">근무한 병원을<br />찾아주세요</h1>
              {후보.length === 0 && <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">현재 또는 가장 최근에 근무한 병원 한 곳을 선택해 주세요.</p>}
            </div>
            <div className="flex flex-col gap-(--rapo-dimension-x2)">
              <label htmlFor="병원찾기" className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">병원명</label>
              <input id="병원찾기" value={q} onChange={(e) => setQ(e.target.value)} placeholder="병원명 입력" autoComplete="off" className={입력칸} />
            </div>
            {후보.length > 0 ? (
              <ul className="flex flex-col gap-(--rapo-dimension-x5)">
                {후보.map((h) => (
                  <li key={h.name + h.곳}>
                    <button type="button" onClick={() => on(h.name)}
                      className="flex w-full items-center gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-left active:bg-(--rapo-color-bg-neutral-weak-pressed)">
                      <span className="min-w-0 flex-1">
                        <span className="rapo-type-t5-medium block break-keep text-(color:--rapo-color-fg-neutral)">{h.name}</span>
                        {h.곳 && <span className="rapo-type-t5-regular block whitespace-nowrap text-(color:--rapo-color-fg-neutral)">{h.곳}</span>}
                      </span>
                      <span aria-hidden className="rapo-type-t7-regular shrink-0 text-(color:--rapo-color-fg-neutral)">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
                {안내}
              </p>
            )}
            <button type="button" onClick={() => set직접(true)} className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">
              {후보.length > 0 ? '목록에 없나요? 직접 입력 ›' : '검색되지 않나요? 직접 입력 ›'}
            </button>
          </>
        )}
      </main>
      {직접 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) py-(--rapo-dimension-x6) pb-[calc(var(--rapo-dimension-x6)+env(safe-area-inset-bottom))]">
          <RapoButton full disabled={!q.trim()} onClick={() => on(q.trim())}>이 이름으로 계속</RapoButton>
        </div>
      )}
    </div>
  );
}

/* ── 알림 동그라미 (저장 실패 · 나가기 · 급여 제출 실패 — 1246:2205 · 2291 · 4272) ── */
export function 느낌표() {
  return (
    <span aria-hidden className="flex size-[72px] items-center justify-center rounded-(--rapo-radius-full) bg-(--rapo-color-bg-neutral-weak)">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
        <circle cx="17" cy="17" r="15" stroke="var(--rapo-color-fg-neutral-muted)" strokeWidth="2" />
        <path d="M17 9.5v9" stroke="var(--rapo-color-fg-neutral-muted)" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="17" cy="23.5" r="1.4" fill="var(--rapo-color-fg-neutral-muted)" />
      </svg>
    </span>
  );
}

/* ── 저장 중 점 셋 — 1246:2267 ── */
export function 저장점() {
  return (
    <span aria-hidden className="flex gap-(--rapo-dimension-x3)">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-[12px] animate-pulse rounded-(--rapo-radius-full) motion-reduce:animate-none"
          style={{ background: i === 0 ? 'var(--rapo-color-bg-brand-solid)' : 'var(--rapo-color-stroke-neutral-weak)', animationDelay: `${i * 200}ms` }} />
      ))}
    </span>
  );
}
