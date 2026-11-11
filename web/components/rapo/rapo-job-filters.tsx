'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { RapoButton, RapoChip, RapoMaskIcon } from './rapo-ui';

/* 공고 목록의 검색칸 · 조건 칩 줄 · 조건 시트 (2026-11-11).

   Figma
     검색칸      「RAPO / Search Field」 221:407 (U02 「RAPO / List / 제목과 검색」 1210:1178 안)
     칩 줄       「RAPO / List / 조건 필터 행」 506:96 · 칩 「RAPO / Home / 필터 칩」 353:644
     조건 시트    「RAPO / List / Filter / 상세」 508:424 와 형제들 (U02 · 필터 편집 509:5246~5539)
                 시트 안 칩 「RAPO / Chip / Selection」 172:86 · 버튼 Outline 172:67 + Filled 172:50

   원본 설명대로 — 시트 안 분류를 바꿔도 고르던 값은 남고, 닫기는 편집 취소, 초기화는 편집값만
   처음으로, 「조건 적용」은 첫 쪽부터 다시 받습니다.

   2026-11-11 대표 결정
     · 급여 — 아직 오픈 전 기능. 칩은 그대로 두고, 누르면 「오픈 전」 안내와 알림 신청 단추가 뜹니다
     · 상세 — 「고용형태」만 남기고 「지원 경력」·「근무일」은 뺍니다
       ⚠ 고용형태로 거르려면 DB 함수(job_list)에 칸이 하나 더 있어야 해서, 그 전까지는 고를 수 없게
         잠가 둡니다 (docs/rapo-design-implementation.md 「막힌 것」)

   비회원은 검색·조건이 열려 있지 않습니다(지금 규칙 그대로 · app/jobs/page.tsx).
   비회원이 검색하거나 조건을 적용하면 그 주소를 기억해 두고 로그인으로 보냅니다 —
   로그인하면 그 주소로 돌아옵니다(after_login · components/job-save.tsx 와 같은 길). */

export const 직군들 = ['전체', '작업치료사', '물리치료사'] as const;
/* 원본(509:5320) 차례 그대로입니다 — lib/org.ts 의 SIDOS 와 같은 이름 · 다른 차례 */
export const 지역들 = ['전국', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;
const 고용형태들 = ['전체', '정규직', '계약직', '시간제'] as const;

type 분류 = '직군' | '지역' | '급여' | '상세';
const 분류들: { key: 분류; icon: string; w: number; h: number; 내림: boolean }[] = [
  { key: '직군', icon: '/rapo/list/briefcase-16.svg', w: 13.5004, h: 12.8334, 내림: true },
  { key: '지역', icon: '/rapo/list/pin-16.svg',       w: 10.8333, h: 13.5,    내림: true },
  { key: '급여', icon: '/rapo/list/wallet-16.svg',    w: 13.5,    h: 12.1667, 내림: true },
  { key: '상세', icon: '/rapo/list/sliders-16.svg',   w: 13.5,    h: 13.5,    내림: false },
];

export type 조건 = { q: string; job: string | null; sido: string | null };

/* 조건 → 주소. 직군 「전체」는 회원이면 job=전체 로 적습니다 —
   안 적으면 서버가 가입 때 고른 직군을 다시 걸기 때문입니다 (app/jobs/page.tsx) */
export function 목록주소(c: 조건, 회원: boolean): string {
  const p = new URLSearchParams();
  if (c.q) p.set('q', c.q);
  if (c.job && c.job !== '전체') p.set('job', c.job);
  else if (회원) p.set('job', '전체');
  if (c.sido && c.sido !== '전국') p.set('sido', c.sido);
  const s = p.toString();
  return s ? `/jobs?${s}` : '/jobs';
}

function 로그인으로(router: ReturnType<typeof useRouter>, 돌아올곳: string) {
  try { sessionStorage.setItem('after_login', 돌아올곳); } catch { /* 사파리 비공개 */ }
  router.push('/login');
}

/* ── 검색칸 ──────────────────────────────────────────────── */
export function RapoJobSearch({ 지금, 회원 }: { 지금: 조건; 회원: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(지금.q);

  const 찾기 = (e: FormEvent) => {
    e.preventDefault();
    const 갈곳 = 목록주소({ ...지금, q: q.trim() }, 회원);
    if (!회원) return 로그인으로(router, 갈곳);
    router.push(갈곳);
  };

  return (
    <form role="search" onSubmit={찾기}
      className="flex h-(--rapo-dimension-x13) items-center gap-(--rapo-dimension-x2_5) overflow-hidden rounded-(--rapo-radius-r3)
                 border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-transparent)
                 pl-(--rapo-dimension-x4)
                 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2
                 has-[input:focus-visible]:outline-(--rapo-color-stroke-focus-ring)">
      {/* 포커스 테두리는 칸 전체에 그립니다 — 입력칸 자체 테두리는 둥근 틀에 잘려서입니다 */}
      <RapoMaskIcon src="/rapo/list/search-20.svg" w={20} h={20} className="text-(color:--rapo-color-fg-neutral-muted)" />
      <input
        type="search"
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="공고 검색"
        aria-label="공고 검색"
        enterKeyHint="search"
        className="rapo-type-t5-regular h-full min-w-0 flex-1 bg-transparent text-(color:--rapo-color-fg-neutral)
                   outline-none placeholder:text-(color:--rapo-color-fg-placeholder) [&::-webkit-search-cancel-button]:hidden"
      />
      {q && (
        /* 원본 설명 「입력값 지우기 버튼을 포함」 — 지우면 검색 없는 목록으로 돌아갑니다 */
        <button type="button" aria-label="검색어 지우기"
          onClick={() => { setQ(''); if (지금.q) router.push(목록주소({ ...지금, q: '' }, 회원)); }}
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center text-(color:--rapo-color-fg-neutral-muted)
                     active:bg-(--rapo-color-bg-transparent-pressed)">
          <RapoMaskIcon src="/rapo/list/close-20.svg" w={20} h={20} />
        </button>
      )}
      {!q && <span className="w-(--rapo-dimension-x4) shrink-0" />}
    </form>
  );
}

/* ── 칩 줄 + 조건 시트 ─────────────────────────────────────── */
export function RapoJobFilters({ 지금, 회원 }: { 지금: 조건; 회원: boolean }) {
  const router = useRouter();
  const 창 = useRef<HTMLDialogElement>(null);
  /* 닫으면(Esc·닫기·바깥 누름·적용) 시트를 연 칩으로 포커스를 돌려줍니다 */
  const 연단추 = useRef<HTMLButtonElement | null>(null);
  const [탭, set탭] = useState<분류>('직군');
  const [직군, set직군] = useState<string>(지금.job ?? '전체');
  const [지역, set지역] = useState<string>(지금.sido ?? '전국');

  const 켜짐: Record<분류, boolean> = { 직군: !!지금.job, 지역: !!지금.sido, 급여: false, 상세: false };

  const 열기 = (k: 분류) => {
    set탭(k); set직군(지금.job ?? '전체'); set지역(지금.sido ?? '전국');
    창.current?.showModal();
  };
  const 닫기 = () => 창.current?.close();
  const 적용 = () => {
    const 갈곳 = 목록주소({ q: 지금.q, job: 직군, sido: 지역 }, 회원);
    닫기();
    if (!회원) return 로그인으로(router, 갈곳);
    router.push(갈곳);
  };

  return (
    <>
      <div className="flex h-[60px] items-center gap-(--rapo-dimension-x2) px-(--rapo-dimension-x5)">
        {분류들.map((b) => (
          <button key={b.key} type="button" onClick={(e) => { 연단추.current = e.currentTarget; 열기(b.key); }} aria-haspopup="dialog"
            aria-label={켜짐[b.key] ? `${b.key} 조건 바꾸기 (적용됨)` : `${b.key} 조건 고르기`}
            className="group flex h-(--rapo-touch-min) min-w-0 flex-1 items-center justify-center">
            <span className={
              'flex h-(--rapo-dimension-x10) w-full items-center justify-center gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1_5) ' +
              'px-(--rapo-dimension-x2) ' +
              (켜짐[b.key]
                ? 'bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-brand-contrast) group-active:bg-(--rapo-color-bg-brand-weak-pressed)'
                : 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral-muted) group-active:bg-(--rapo-color-bg-neutral-weak-pressed)')
            }>
              <span className="flex size-(--rapo-dimension-x4) items-center justify-center">
                <RapoMaskIcon src={b.icon} w={b.w} h={b.h} />
              </span>
              <span className={'rapo-type-t4-medium whitespace-nowrap ' +
                (켜짐[b.key] ? '' : 'text-(color:--rapo-color-fg-neutral)')}>{b.key}</span>
              {b.내림 && (
                <span className="flex size-(--rapo-dimension-x3) items-center justify-center">
                  <RapoMaskIcon src="/rapo/list/down-12.svg" w={7.4} h={4.4} />
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* 시트 — 기본 dialog 라 Esc 로 닫히고, 열린 동안 뒤가 눌리지 않으며, 닫으면 누른 칩으로 포커스가 돌아갑니다 */}
      <dialog
        ref={창}
        aria-labelledby="rapo-filter-title"
        onClick={(e) => { if (e.target === 창.current) 닫기(); }}
        onClose={() => 연단추.current?.focus()}
        className="m-auto mb-0 w-full max-w-3xl rounded-t-(--rapo-radius-r4) bg-(--rapo-color-bg-layer-default) p-0
                   backdrop:bg-(--rapo-color-bg-overlay)"
      >
        <div className="flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x5)"
          style={{ paddingBottom: 'calc(var(--rapo-dimension-x5) + env(safe-area-inset-bottom))' }}>
          <div className="flex h-(--rapo-touch-min) items-center gap-(--rapo-dimension-x2)">
            <h2 id="rapo-filter-title" className="rapo-type-section-title min-w-0 flex-1 text-(color:--rapo-color-fg-neutral)">공고 조건</h2>
            <button type="button" onClick={닫기} aria-label="닫기"
              className="flex size-(--rapo-touch-min) items-center justify-center text-(color:--rapo-color-fg-neutral-muted)
                         active:bg-(--rapo-color-bg-transparent-pressed)">
              <RapoMaskIcon src="/rapo/list/close-20.svg" w={20} h={20} />
            </button>
          </div>

          <div role="group" aria-label="조건 분류" className="flex gap-(--rapo-dimension-x2)">
            {분류들.map((b) => <RapoChip key={b.key} label={b.key} on={탭 === b.key} onClick={() => set탭(b.key)} className="flex-1" />)}
          </div>

          {탭 === '직군' && (
            <div role="group" aria-label="직군" className="flex gap-(--rapo-dimension-x2)">
              {직군들.map((j) => <RapoChip key={j} label={j} on={직군 === j} onClick={() => set직군(j)} className="flex-1" />)}
            </div>
          )}

          {탭 === '지역' && (
            <div role="group" aria-label="지역" className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
              {지역들.map((s) => <RapoChip key={s} label={s} on={지역 === s} onClick={() => set지역(s)} />)}
            </div>
          )}

          {탭 === '상세' && (
            <div className="flex flex-col gap-(--rapo-dimension-x4)">
              <p className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">고용형태</p>
              <div role="group" aria-label="고용형태" className="flex gap-(--rapo-dimension-x2)">
                {고용형태들.map((t) => <RapoChip key={t} label={t} on={t === '전체'} disabled className="flex-1" />)}
              </div>
              <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">
                고용형태로 고르는 기능은 곧 열려요.
              </p>
            </div>
          )}

          {탭 === '급여' ? <급여오픈전 /> : (
            <div className="flex gap-(--rapo-dimension-x3)">
              <RapoButton tone="outline" onClick={() => { set직군('전체'); set지역('전국'); }} className="w-[104px] shrink-0">초기화</RapoButton>
              <RapoButton onClick={적용} className="min-w-0 flex-1">조건 적용</RapoButton>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

/* ── 급여 · 오픈 전 안내 (2026-11-11 대표 지시) ────────────────
   원본의 급여 편집(509:5444)은 아직 열지 않습니다. 같은 시트 안에서 무엇이 준비되고 있는지
   알려 주고 오픈 알림 신청으로 이끕니다. 글은 대표가 준 첫 문장에 기능 설명을 붙인 것입니다.

   ⚠ 「알림 신청」은 사전 등록 창구에 이어야 합니다. 그 창구(가입 뒤 연봉 비교 알림 · PR #36)가
     아직 main 에 없어 단추를 잠가 둡니다 — 이어지면 onClick 만 바꾸면 됩니다 (막힌 것) */
function 급여오픈전() {
  const 할수있는것 = [
    '급여가 공개된 공고만 모아서 볼 수 있어요',
    '원하는 연봉 범위로 공고를 좁힐 수 있어요',
    '같은 직군·지역 공고의 급여를 한눈에 비교할 수 있어요',
  ];
  return (
    /* 시트 바탕(흰색) 위에 그대로 둡니다 — 회색 판 위에서는 잠긴 단추가 바탕과 같은 색이라 안 보였습니다 */
    <div className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x2)">
      <div className="flex flex-col gap-(--rapo-dimension-x1_5)">
        <p className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">아직 오픈 전 기능이에요!</p>
        <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral-muted)">급여 조건으로 공고를 고르는 기능을 준비하고 있어요.</p>
      </div>
      <ul className="flex flex-col gap-(--rapo-dimension-x2)">
        {할수있는것.map((t) => (
          <li key={t} className="rapo-type-t4-regular flex gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
            <span aria-hidden className="mt-[7px] size-(--rapo-dimension-x1_5) shrink-0 rounded-(--rapo-radius-full) bg-(--rapo-color-fg-brand-contrast)" />
            {t}
          </li>
        ))}
      </ul>
      <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">오픈 알림을 받고 싶다면 알림 신청을 눌러주세요.</p>
      <RapoButton onClick={() => {}} disabled full>알림 신청</RapoButton>
      <p className="rapo-type-t3-regular text-center text-(color:--rapo-color-fg-neutral-muted)">알림 신청은 곧 열려요.</p>
    </div>
  );
}
