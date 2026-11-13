'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { setAfterLogin } from '@/lib/after-login';
import { CompareNotify } from '@/components/compare-notify';
import { 고용형태들, 기관분류들, 기본정렬, 분류쿠키 } from '@/lib/rapo-job-options';
import { JOB_GROUPS, type JobGroup } from '@/lib/who';
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
       고용형태는 job_list 의 p_employ 로 거릅니다 (2026-11-11 DB · RAPO노트/SQL_1113/F_고용형태_조건.sql) · 주소는 type=
     · 상세 — 「기관 분류」 여러 개 고르기 (2026-11-12 밤 세중님) · job_list 의 p_kinds · 주소는 kind= · 고른 값은 쿠키에 남아 다음에도 걸립니다

   비회원은 검색·조건이 열려 있지 않습니다(지금 규칙 그대로 · app/jobs/page.tsx).
   비회원이 검색하거나 조건을 적용하면 그 주소를 기억해 두고 로그인으로 보냅니다 —
   로그인하면 그 주소로 돌아옵니다(lib/after-login.ts setAfterLogin · 2026-11-13 옛 after_login 쪽지는 아무도 안 읽었음). */

export const 직군들 = ['전체', '작업치료사', '물리치료사'] as const;
/* 원본(509:5320) 차례 그대로입니다 — lib/org.ts 의 SIDOS 와 같은 이름 · 다른 차례 */
export const 지역들 = ['전국', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;
/* 고용형태 목록은 서버 화면도 써서 lib/rapo-job-options.ts 에 둡니다 ('use client' 파일에서 내보내면 서버에서 깨집니다) */

type 분류 = '직군' | '지역' | '급여' | '상세';
const 분류들: { key: 분류; icon: string; w: number; h: number; 내림: boolean }[] = [
  { key: '직군', icon: '/rapo/list/briefcase-16.svg', w: 13.5004, h: 12.8334, 내림: true },
  { key: '지역', icon: '/rapo/list/pin-16.svg',       w: 10.8333, h: 13.5,    내림: true },
  { key: '급여', icon: '/rapo/list/wallet-16.svg',    w: 13.5,    h: 12.1667, 내림: true },
  { key: '상세', icon: '/rapo/list/sliders-16.svg',   w: 13.5,    h: 13.5,    내림: false },
];

/* 화면에 적는 분류 이름 — 「상세」는 「필터」로 적습니다 (2026-11-13 세중님) */
const 분류이름: Record<분류, string> = { 직군: '직군', 지역: '지역', 급여: '급여', 상세: '필터' };

export type 조건 = { q: string; job: string | null; sido: string | null; type?: string | null; sort?: string | null; kinds?: string[] };

/* 고른 기관 분류를 이 기기에 1년 기억합니다 — 빈 목록이면 지웁니다 (lib/rapo-job-options.ts 분류쿠키) */
export function 분류기억(kinds: string[]) {
  document.cookie = kinds.length
    ? `${분류쿠키}=${encodeURIComponent(kinds.join(','))}; path=/; max-age=31536000; samesite=lax`
    : `${분류쿠키}=; path=/; max-age=0; samesite=lax`;
}

/* 조건 → 주소. 직군 「전체」는 회원이면 job=전체 로 적습니다 —
   안 적으면 서버가 가입 때 고른 직군을 다시 걸기 때문입니다 (app/jobs/page.tsx) */
export function 목록주소(c: 조건, 회원: boolean): string {
  const p = new URLSearchParams();
  if (c.q) p.set('q', c.q);
  if (c.job && c.job !== '전체') p.set('job', c.job);
  else if (회원) p.set('job', '전체');
  if (c.sido && c.sido !== '전국') p.set('sido', c.sido);
  if (c.type && c.type !== '전체') p.set('type', c.type);
  if (c.sort && c.sort !== 기본정렬) p.set('sort', c.sort);   // 기본(인기순)은 주소에 안 적습니다
  if (c.kinds?.length) p.set('kind', c.kinds.join(','));
  const s = p.toString();
  return s ? `/jobs?${s}` : '/jobs';
}

function 로그인으로(router: ReturnType<typeof useRouter>, 돌아올곳: string) {
  setAfterLogin(돌아올곳);   // 로그인 뒤 이 자리로 (lib/after-login.ts · 2026-11-13 옛 이름 after_login 은 아무도 안 읽어 홈으로 떨어졌음)
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
  const [고용, set고용] = useState<string>(지금.type ?? '전체');
  const [분류, set분류] = useState<string[]>(지금.kinds ?? []);
  /* 급여 「알림 신청」 — 시트를 닫고 연봉 비교 알림 신청 창을 띄웁니다 (시트는 맨 위 층이라 그 위에 창을 못 띄웁니다) */
  const { session, me } = useAuth();
  const [알림창, set알림창] = useState(false);
  const 알림신청 = () => {
    닫기();
    if (!session) return 로그인으로(router, 목록주소(지금, 회원));
    set알림창(true);
  };

  const 켜짐: Record<분류, boolean> = { 직군: !!지금.job, 지역: !!지금.sido, 급여: false, 상세: !!지금.type || !!지금.kinds?.length };
  /* 칩에 적는 글 (2026-11-13 세중님 「물리치료사 선택하면 그 칸에 물리치료사 · 상세보단 필터」).
     직군·지역은 고른 값이 있으면 그 값을 적습니다. 「상세」는 화면 글만 「필터」로 바꿉니다(안쪽 이름은 그대로) */
  const 칩글: Record<분류, string> = { 직군: 지금.job ?? '직군', 지역: 지금.sido ?? '지역', 급여: '급여', 상세: '필터' };
  const 값적힘: Record<분류, boolean> = { 직군: !!지금.job, 지역: !!지금.sido, 급여: false, 상세: false };

  const 열기 = (k: 분류) => {
    set탭(k); set직군(지금.job ?? '전체'); set지역(지금.sido ?? '전국'); set고용(지금.type ?? '전체'); set분류(지금.kinds ?? []);
    창.current?.showModal();
  };
  const 닫기 = () => 창.current?.close();
  const 적용 = () => {
    const 주소 = 목록주소({ q: 지금.q, job: 직군, sido: 지역, type: 고용, sort: 지금.sort, kinds: 분류 }, 회원);
    /* 기억해 둔 분류를 모두 뺐으면 「kind=」을 실어 보냅니다 — 안 실으면 주소가 전과 같아 목록을 다시 안 받을 수 있습니다 */
    const 갈곳 = !분류.length && 지금.kinds?.length ? 주소 + (주소.includes('?') ? '&' : '?') + 'kind=' : 주소;
    닫기();
    분류기억(분류);
    if (!회원) return 로그인으로(router, 갈곳);
    router.push(갈곳);
  };

  return (
    <>
      <div className="flex h-[60px] items-center gap-(--rapo-dimension-x2) px-(--rapo-dimension-x5)">
        {분류들.map((b) => (
          <button key={b.key} type="button" onClick={(e) => { 연단추.current = e.currentTarget; 열기(b.key); }} aria-haspopup="dialog"
            aria-label={켜짐[b.key] ? `${분류이름[b.key]} 조건 바꾸기 (적용됨${값적힘[b.key] ? ` · ${칩글[b.key]}` : ''})` : `${분류이름[b.key]} 조건 고르기`}
            className="group flex h-(--rapo-touch-min) min-w-0 flex-auto items-center justify-center">
            <span className={
              'flex h-(--rapo-dimension-x10) w-full items-center justify-center gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r1_5) ' +
              'px-(--rapo-dimension-x1_5) ' +
              (켜짐[b.key]
                ? 'bg-(--rapo-color-bg-brand-weak) text-(color:--rapo-color-fg-brand-contrast) group-active:bg-(--rapo-color-bg-brand-weak-pressed)'
                : 'bg-(--rapo-color-bg-neutral-weak) text-(color:--rapo-color-fg-neutral-muted) group-active:bg-(--rapo-color-bg-neutral-weak-pressed)')
            }>
              {/* 고른 값을 적은 칩은 아이콘을 뺍니다(「물리치료사」 다섯 자가 들어갈 자리) · 375 보다 좁은 폰은 아이콘을 모두 뺍니다 — 360 폭에서 넘침 0 */}
              {!값적힘[b.key] && (
                <span className="flex size-(--rapo-dimension-x4) items-center justify-center max-[374px]:hidden">
                  <RapoMaskIcon src={b.icon} w={b.w} h={b.h} />
                </span>
              )}
              <span className={'rapo-type-t4-medium whitespace-nowrap ' +
                (켜짐[b.key] ? '' : 'text-(color:--rapo-color-fg-neutral)')}>{칩글[b.key]}</span>
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
            {분류들.map((b) => <RapoChip key={b.key} label={분류이름[b.key]} on={탭 === b.key} onClick={() => set탭(b.key)} className="flex-1" />)}
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
                {고용형태들.map((t) => <RapoChip key={t} label={t} on={고용 === t} onClick={() => set고용(t)} className="flex-1" />)}
              </div>
              {/* 기관 분류 — 여러 개 (2026-11-12 밤 세중님). 아무것도 안 고르면 전체 */}
              <p className="rapo-type-t5-medium text-(color:--rapo-color-fg-neutral)">기관 분류 <span className="rapo-type-t3-regular text-(color:--rapo-color-fg-neutral-muted)">여러 개 고를 수 있어요</span></p>
              <div role="group" aria-label="기관 분류" className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
                {기관분류들.map((k) => (
                  <RapoChip key={k} label={k} on={분류.includes(k)}
                    onClick={() => set분류(분류.includes(k) ? 분류.filter((x) => x !== k) : 기관분류들.filter((x) => x === k || 분류.includes(x)))} />
                ))}
              </div>
            </div>
          )}

          {탭 === '급여' ? <급여오픈전 onApply={알림신청} /> : (
            <div className="flex gap-(--rapo-dimension-x3)">
              <RapoButton tone="outline" onClick={() => { set직군('전체'); set지역('전국'); set고용('전체'); set분류([]); }} className="w-[104px] shrink-0">초기화</RapoButton>
              <RapoButton onClick={적용} className="min-w-0 flex-1">조건 적용</RapoButton>
            </div>
          )}
        </div>
      </dialog>

      {알림창 && session && (
        <CompareNotify
          userId={session.user.id}
          job={(JOB_GROUPS as readonly string[]).includes(me?.job_group ?? '') ? (me!.job_group as JobGroup) : null}
          email={session.user.email ?? null}
          onDone={() => set알림창(false)}
        />
      )}
    </>
  );
}

/* ── 급여 · 오픈 전 안내 (2026-11-11 대표 지시) ────────────────
   원본의 급여 편집(509:5444)은 아직 열지 않습니다. 같은 시트 안에서 무엇이 준비되고 있는지
   알려 주고 오픈 알림 신청으로 이끕니다. 글은 대표가 준 첫 문장에 기능 설명을 붙인 것입니다.

   「알림 신청」 한 번에 **연봉에 관한 신청을 모두** 겁니다 (2026-11-11 대표).
     가입 뒤 뜨는 연봉 비교 알림 신청 창(components/compare-notify.tsx)을 그대로 띄웁니다 — 저장은 「비교알림신청」 표 하나.
     그 창이 알리는 서비스(같은 직군·연차·지역 연봉과 스펙 비교)가 곧 연봉 통계라 표를 따로 만들지 않았습니다.
     이미 신청한 회원은 창이 「이미 신청하셨어요」로 끝납니다(23505). 동의 안내는 창 첫 화면 작은 글 그대로입니다. */
function 급여오픈전({ onApply }: { onApply: () => void }) {
  const 할수있는것 = [
    '급여가 공개된 공고만 모아서 볼 수 있어요',
    '같은 직군·지역 공고의 급여를 한눈에 비교할 수 있어요',
    '직군·연차별 연봉 통계를 가장 먼저 받아볼 수 있어요',
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
      <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">오픈 알림을 받고 싶다면 알림 신청을 눌러주세요.<br />
        연봉 비교 알림과 연봉 통계 소식을 한 번에 보내 드려요.</p>
      <RapoButton onClick={onApply} full>알림 신청</RapoButton>
    </div>
  );
}

/* 주소에 kind= 가 적혀 왔을 때(조건 적용 · 초기화 · 받은 링크) 그 값을 이 기기의 기본으로 남깁니다.
   초기화 링크는 「kind=」(빈 값)를 실어 기억을 지웁니다 — 서버 화면(app/jobs/page.tsx)은 쿠키를 못 쓰기 때문입니다 */
export function RapoKindRemember({ kinds }: { kinds: string[] }) {
  const 글 = kinds.join(',');
  useEffect(() => { 분류기억(글 ? 글.split(',') : []); }, [글]);
  return null;
}
