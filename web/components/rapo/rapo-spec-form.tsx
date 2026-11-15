'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { RapoAppBar } from './rapo-me';
import { toDraft, type Draft } from '@/lib/signup-fields';
import { browserSupabase } from '@/lib/supabase-browser';

/* 내 정보의 입력 화면들이 같이 쓰는 부품 (2026-11-15 · 피그마 「12 · 내 정보」 06 경험별 스펙 수정 · 경력 수정 · 희망 취업 조건).
   쓰는 곳: 임상가 전환(app/me/convert) · 스펙 확인·수정(app/me/spec) · 경력 수정(app/me/career) · 희망 취업 조건(app/me/pref).
   가입 화면(app/welcome)은 같은 꼴을 아직 제 안에 따로 둡니다. */

export const 만점 = 4.5;
export const 희망유형들 = ['대학병원', '종합병원', '재활병원'] as const;
export const 희망지역들 = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;

/** 앱 바 + 본문 + 아래 고정 단추 자리 */
export function RapoFormFrame({ title, back, onBack, 아래, children }: {
  title: string; back?: string; onBack?: () => void; 아래?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div data-rapo className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-(--rapo-color-bg-layer-default)">
      {onBack ? (
        <header className="sticky top-0 z-20 flex h-[56px] shrink-0 items-center gap-(--rapo-dimension-x2) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2)">
          <button type="button" onClick={onBack} aria-label="뒤로"
            className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-(--rapo-color-bg-transparent-pressed)">
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/detail/arrow-left-20.svg" alt="" width={20} height={20} />
          </button>
          <h1 className="rapo-type-t5-bold min-w-0 flex-1 text-center text-(color:--rapo-color-fg-neutral)">{title}</h1>
          <span aria-hidden className="size-(--rapo-touch-min) shrink-0" />
        </header>
      ) : <RapoAppBar title={title} back={back} />}
      <main className="flex-1 px-(--rapo-dimension-x5) pb-(--rapo-dimension-x6)">{children}</main>
      {아래 && (
        <div className="sticky bottom-0 bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x5) pt-(--rapo-dimension-x2) pb-[calc(var(--rapo-dimension-x4)+env(safe-area-inset-bottom))]">
          {아래}
        </div>
      )}
    </div>
  );
}

/** 화면 큰 제목 + 설명 */
export function RapoFormTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <>
      <h2 className="rapo-type-t11-bold mt-(--rapo-dimension-x6) break-keep text-(color:--rapo-color-fg-neutral)">{children}</h2>
      {sub && <p className="rapo-type-t4-regular mt-(--rapo-dimension-x2) break-keep text-(color:--rapo-color-fg-neutral-muted)">{sub}</p>}
    </>
  );
}

export const 칸 = 'rapo-type-t5-regular h-(--rapo-dimension-x13) w-full min-w-0 rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) '
  + 'border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) '
  + 'placeholder:text-(color:--rapo-color-fg-placeholder)';

/** 고르는 칸 — 피그마의 「⌄」 드롭다운 */
export function 골라({ label, v, opts, ph, on, 붙임 = '' }: { label: string; v: string; opts: readonly string[]; ph: string; on: (v: string) => void; 붙임?: string }) {
  return (
    <label className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{label}</span>
      <span className="relative block">
        <select value={v} onChange={(e) => on(e.target.value)}
          className={칸 + ' appearance-none pr-(--rapo-dimension-x10) ' + (v ? '' : 'text-(color:--rapo-color-fg-placeholder)')}>
          <option value="" disabled>{ph}</option>
          {opts.map((o) => <option key={o} value={o}>{o}{붙임}</option>)}
        </select>
        <svg aria-hidden className="pointer-events-none absolute right-(--rapo-dimension-x4) top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

/** 학점 칸 — 4.5 만점 · 선택 (2026-11-15 세중님) */
export function 학점칸({ label, v, on, 틀림, 도움 }: { label: string; v: string; on: (v: string) => void; 틀림: boolean; 도움: string }) {
  return (
    <label className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">
        {label} <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">(선택)</span>
      </span>
      <span className={'flex items-center rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) ' + (틀림 ? 'border-(color:--rapo-color-stroke-critical-solid)' : 'border-(color:--rapo-color-stroke-neutral-weak)')}>
        <input value={v} onChange={(e) => on(e.target.value)} inputMode="decimal" placeholder="예) 3.8"
          className="rapo-type-t5-regular h-(--rapo-dimension-x13) min-w-0 flex-1 rounded-(--rapo-radius-r3) bg-transparent px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral) outline-none placeholder:text-(color:--rapo-color-fg-placeholder)" />
        <span className="rapo-type-t5-regular shrink-0 pr-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">/ 4.5</span>
      </span>
      <span className={'rapo-type-t3-regular break-keep ' + (틀림 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
        {틀림 ? '학점은 0부터 4.5까지 입력해 주세요.' : 도움}
      </span>
    </label>
  );
}

export const 학점틀렸나 = (v: string) => { const n = Number(v); return !!v.trim() && (!Number.isFinite(n) || n < 0 || n > 만점); };

export type 내스펙 = {
  spec: (Record<string, unknown> & {
    school_type?: string | null; want_type?: string | null; want_region?: string | null; 근무경험?: boolean | null;
    근무병원?: string | null; 입사연도?: number | null; 학교?: string | null;
  }) | null;
  draft: Draft;
  /** 올해 남은 고치기 횟수 (save_my_survey 와 같은 셈 · 1년에 2번) */
  남은: number;
};

/** 미리보기(/design-preview/me-forms · 개발 서버만)가 견본 스펙을 끼워 넣는 자리 — 운영 화면에서는 늘 비어 있습니다 */
export const 내스펙미리 = createContext<내스펙 | null>(null);

/** 내 스펙·어학·남은 고치기 횟수를 읽습니다 (회원은 자기 줄만 읽힘) */
export function use내스펙() {
  const 미리 = useContext(내스펙미리);
  const [v, setV] = useState<내스펙 | null | undefined>(미리 ?? undefined);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const sb = browserSupabase();
    const [spec, langs, prof] = await Promise.all([
      sb.from('student_specs').select('*').maybeSingle(),
      sb.from('spec_langs').select('exam,score,level'),
      sb.rpc('내프로필').maybeSingle(),
    ]);
    const bad = spec.error ?? langs.error ?? prof.error;
    if (bad) { setErr(`불러오지 못했어요 — ${bad.message}`); setV(null); return; }
    const p = prof.data as { survey_at: string | null; survey_edits: number | null; survey_edits_since: string | null } | null;
    const since = p?.survey_edits_since ? new Date(p.survey_edits_since) : null;
    const fresh = !since || Date.now() - since.getTime() >= 365 * 24 * 3600_000;
    const s = (spec.data as 내스펙['spec']) ?? null;
    setV({ spec: s, draft: toDraft(null, s, (langs.data ?? []) as Record<string, unknown>[]), 남은: !p?.survey_at ? 2 : 2 - (fresh ? 0 : (p?.survey_edits ?? 0)) });
  }, []);
  useEffect(() => { if (!미리) load().catch((e) => setErr(String(e))); }, [load, 미리]);
  return { v, err, reload: load };
}

/** save_my_survey 가 덮어쓰는 기본 칸 — 바꾸지 않는 칸은 옛 값을 그대로 실어 보냅니다 (안 보내면 비워짐) */
export function 기본칸(s: 내스펙['spec']) {
  const x = s ?? {};
  return {
    school_type: x.school_type ?? null, grade: (x.grade as string | null) ?? null, gpa: (x.gpa as number | null) ?? null, gpa_scale: (x.gpa_scale as number | null) ?? null,
    licenses: x.licenses ?? [], trainings: x.trainings ?? [], practice: x.practice ?? [], practice_months: x.practice_months ?? null,
    career: x.career ?? null, career_months: x.career_months ?? null, want_type: x.want_type ?? null, want_region: x.want_region ?? null,
  } as Record<string, unknown>;
}

/** 병원 칸 — 이름으로 찾기(org_search · 회원 권한) 또는 직접 입력 · 이름만 담습니다 */
export function 병원찾기칸({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  const [직접, set직접] = useState(false);
  const [후보, set후보] = useState<{ name: string; 곳: string }[]>([]);
  const [고름, set고름] = useState(false);
  useEffect(() => {
    const q = v.trim();
    if (직접 || 고름 || q.length < 2) { set후보([]); return; }
    const t = setTimeout(async () => {
      const { data } = await browserSupabase().rpc('org_search', { p_q: q, p_tile: null, p_sido: null, p_sgg: null, p_sort: null, p_limit: 5, p_offset: 0 });
      const rs = (data ?? []) as { name: string; sido_std: string | null; sgg_std: string | null }[];
      set후보(rs.filter((r) => r.name !== q).map((r) => ({ name: r.name, 곳: [r.sido_std, r.sgg_std].filter(Boolean).join(' ') })));
    }, 250);
    return () => clearTimeout(t);
  }, [v, 직접, 고름]);
  return (
    <div className="flex flex-col gap-(--rapo-dimension-x2)">
      <span className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{label}</span>
      <input value={v} onChange={(e) => { set고름(false); on(e.target.value); }} placeholder={직접 ? '병원 이름을 적어 주세요' : '병원 이름으로 찾기'} aria-label={label} className={칸} />
      {후보.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak)">
          {후보.map((h) => (
            <li key={h.name + h.곳}>
              <button type="button" onClick={() => { set고름(true); on(h.name); set후보([]); }}
                className="flex w-full items-baseline gap-(--rapo-dimension-x2) px-(--rapo-dimension-x4) py-(--rapo-dimension-x3) text-left active:bg-(--rapo-color-bg-transparent-pressed)">
                <span className="rapo-type-t5-medium min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{h.name}</span>
                <span className="rapo-type-t3-regular shrink-0 whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{h.곳}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!직접 && (
        <button type="button" onClick={() => { set직접(true); set후보([]); }}
          className="rapo-type-t4-bold self-start text-(color:--rapo-color-fg-neutral)">검색되지 않나요? 직접 입력 ›</button>
      )}
    </div>
  );
}

/** 「1년에 2번」 안내 한 줄 */
export function 남은횟수({ n }: { n: number }) {
  return (
    <p className={'rapo-type-t3-regular break-keep ' + (n <= 0 ? 'text-(color:--rapo-color-fg-critical)' : 'text-(color:--rapo-color-fg-neutral-muted)')}>
      {n <= 0 ? '올해 고칠 수 있는 2번을 다 쓰셨어요.' : `경력·스펙은 1년에 2번 고칠 수 있어요. ${n}번 남았어요.`}
    </p>
  );
}

/** 입사연도 고르기 목록 — 올해부터 40년 전까지 */
export const 연도들 = (n = 41) => Array.from({ length: n }, (_, i) => String(new Date().getFullYear() - i));
