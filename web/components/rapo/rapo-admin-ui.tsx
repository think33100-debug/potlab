import type { ReactNode } from 'react';

/* 'use client' 를 달지 않습니다 — 서버 화면(app/admin/icons 등)도 `관` 글자 묶음을 그대로 쓸 수 있게.
   단추·탭처럼 손을 받는 부품은 클라이언트 화면 안에서만 씁니다 */

/* 관리자 화면 공용 부품 — 새 디자인 「16 · 관리자 운영 화면」 (Figma 1377:299 · 2026-11-19
   「관리자 모드 디자인이 다 옛날 웹 컨셉이야. 지금 디자인 살려서 다시 바꾸자」).

   원본 화면: 공고 관리 1406:492 · 공고 상세 1406:581 · 회원 관리 1406:640 · 통계 1406:720 ·
   보류함 1406:823 · 신고 관리 1513:1013. 값은 원본 파일 변수 그대로입니다 —
     navy #112231 · navy-600 #304f65 · navy-50 #f1f5f8 · neutral-50 #f6f8f9 · neutral-200 #dde4e6
     fg-muted #555d6d · coral-50 #fff5f3 · coral-500 #ff4f40 · coral-700 #b42a21
     warning-50 #fff8ec · warning-800 #6f3807 · success-50 #ebfdf2 · success-800 #065a2e · error-700 #b20723
     radius r2 8 · r3 12 · 글자 t3 13/18 · t4 14/19 · t5 16/22 · t7 20/27 · t12 32/42

   기능·데이터는 건드리지 않고 겉모양만 바꾸려고, 화면마다 같은 꼴을 **이 한 자리**에서 가져다 씁니다.
   옛 토큰(text-mute · rounded-md …)이 남은 자리는 rapo-admin.css 가 관리자 틀 안에서만 새 값으로 바꿉니다. */

const 합 = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* 글자·색 — 화면에서 className 으로 바로 씁니다 */
export const 관 = {
  /* 섹션 제목(원본 「주요 지표」 t8 24/30 Bold) · 카드 제목(t5 Bold) · 작은 설명(t3) */
  h2: 'rapo-type-t8-bold text-[#112231]',
  h3: 'text-[16px] font-bold leading-[22px] text-[#112231]',
  sub: 'text-[13px] leading-[18px] text-[#555d6d]',
  body: 'text-[14px] leading-[19px] text-[#112231]',
  muted: 'text-[14px] leading-[19px] text-[#555d6d]',
  label: 'text-[13px] font-bold leading-[18px] text-[#304f65]',
  link: 'font-bold text-[#112231] underline-offset-2 hover:underline',

  /* 흰 카드 — 원본 「모집 정보」 등: 흰 바탕 · neutral-200 테두리 · radius 12 · 안쪽 24 */
  card: 'rounded-[12px] border border-[#dde4e6] bg-white p-[20px] md:p-[24px]',
  cardTight: 'rounded-[12px] border border-[#dde4e6] bg-white',

  /* 표 — 원본 「공고 표」: 머리 navy-50 · 42 높이 · 13 Bold navy-600 / 줄 57 · 위 테두리 */
  /* relative — 안쪽 sr-only(absolute) 글자가 스크롤 상자 밖으로 새어 폰 화면을 넓히지 않게 (2026-11-19 회원 관리 320폭에서 찾음) */
  tableWrap: 'relative overflow-x-auto rounded-[12px] border border-[#dde4e6] bg-white',
  table: 'w-full text-left',
  thead: 'bg-[#f1f5f8] text-[13px] font-bold text-[#304f65]',
  th: 'h-[42px] whitespace-nowrap px-[16px] font-bold first:pl-[18px]',
  tr: 'border-t border-[#dde4e6]',
  td: 'h-[57px] px-[16px] py-[10px] text-[14px] text-[#304f65] first:pl-[18px]',
  tdMain: 'h-[57px] px-[16px] py-[10px] text-[16px] font-bold text-[#112231] first:pl-[18px]',

  /* 목록(표가 아닌 줄) — 흰 카드 안 줄마다 위 테두리 */
  list: 'divide-y divide-[#dde4e6] overflow-hidden rounded-[12px] border border-[#dde4e6] bg-white',
  row: 'px-[18px] py-[16px]',

  /* 단추 — 원본 「RAPO / Button / Filled」 navy 40 높이 radius 8 · 글자 t4 Bold */
  btn: 'inline-flex h-[40px] shrink-0 items-center justify-center gap-[6px] rounded-[8px] bg-[#112231] px-[18px] text-[14px] font-bold text-white hover:bg-[#223d51] disabled:opacity-40',
  btnLine: 'inline-flex h-[40px] shrink-0 items-center justify-center gap-[6px] rounded-[8px] border border-[#dde4e6] bg-white px-[16px] text-[14px] font-bold text-[#112231] hover:bg-[#f6f8f9] disabled:opacity-40',
  btnDanger: 'inline-flex h-[40px] shrink-0 items-center justify-center gap-[6px] rounded-[8px] border border-[#ffd4cf] bg-[#fff5f3] px-[16px] text-[14px] font-bold text-[#b42a21] hover:bg-[#ffe9e6] disabled:opacity-40',
  btnText: 'inline-flex min-h-[32px] shrink-0 items-center gap-[4px] text-[14px] font-bold text-[#112231] hover:underline disabled:opacity-40',
  btnTextDanger: 'inline-flex min-h-[32px] shrink-0 items-center gap-[4px] text-[14px] font-bold text-[#b42a21] hover:underline disabled:opacity-40',
  btnSm: 'inline-flex h-[32px] shrink-0 items-center justify-center rounded-[8px] border border-[#dde4e6] bg-white px-[12px] text-[13px] font-bold text-[#112231] hover:bg-[#f6f8f9] disabled:opacity-40',

  /* 입력 — 원본 「RAPO / Text Field」 44 높이 · 흰 바탕 · neutral-200 테두리 · radius 8 */
  input: 'h-[44px] w-full min-w-0 rounded-[8px] border border-[#dde4e6] bg-white px-[14px] text-[16px] text-[#112231] placeholder:text-[#868b94] focus:border-[#304f65] focus:outline-none',
  textarea: 'w-full min-w-0 rounded-[8px] border border-[#dde4e6] bg-white px-[14px] py-[12px] text-[16px] leading-[22px] text-[#112231] placeholder:text-[#868b94] focus:border-[#304f65] focus:outline-none',
  select: 'h-[44px] min-w-0 appearance-none rounded-[8px] border border-[#dde4e6] bg-white pl-[14px] pr-[36px] text-[16px] text-[#112231] focus:border-[#304f65] focus:outline-none',
  fieldLabel: 'mb-[6px] block text-[14px] font-bold leading-[19px] text-[#304f65]',

  /* 알림 띠 */
  error: 'rounded-[8px] bg-[#fff5f3] px-[16px] py-[12px] text-[14px] text-[#b42a21]',
  info: 'rounded-[8px] bg-[#f1f5f8] px-[16px] py-[12px] text-[14px] text-[#304f65]',
  warn: 'rounded-[8px] bg-[#fff8ec] px-[16px] py-[12px] text-[14px] text-[#6f3807]',
  ok: 'rounded-[8px] bg-[#ebfdf2] px-[16px] py-[12px] text-[14px] text-[#065a2e]',
  empty: 'px-[18px] py-[32px] text-center text-[14px] text-[#555d6d]',
} as const;

/* 칩(필터·고르기) — 켜지면 navy 바탕. 원본 「조회 기간」의 켜진 칸(#dde7ee)보다 또렷하게 씁니다 */
export function 칩꼴(켜짐: boolean) {
  return 합('inline-flex h-[36px] shrink-0 items-center gap-[6px] rounded-full border px-[14px] text-[14px] font-bold',
    켜짐 ? 'border-[#112231] bg-[#112231] text-white' : 'border-[#dde4e6] bg-white text-[#304f65] hover:bg-[#f6f8f9]');
}

/* 배지 — 원본 「RAPO / Badge」: 26 높이 · 알약 · 글자 t3 Bold */
export type 배지색 = 'warn' | 'ok' | 'neutral' | 'coral' | 'error' | 'info';
const 배지바탕: Record<배지색, string> = {
  warn: 'bg-[#fff8ec] text-[#6f3807]',
  ok: 'bg-[#ebfdf2] text-[#065a2e]',
  neutral: 'bg-[#f1f5f8] text-[#304f65]',
  coral: 'bg-[#fff5f3] text-[#b42a21]',
  error: 'bg-[#fff0f0] text-[#b20723]',
  info: 'bg-[#eff6ff] text-[#135fcd]',
};
export function 배지꼴(색: 배지색 = 'neutral') {
  return 합('inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full px-[10px] text-[13px] font-bold', 배지바탕[색]);
}
export function AdminBadge({ tone = 'neutral', children }: { tone?: 배지색; children: ReactNode }) {
  return <span className={배지꼴(tone)}>{children}</span>;
}

/* 섹션 — 제목(t8) + 옆 설명 + 오른쪽 도구 · 아래 내용 */
export function AdminSection({ title, sub, right, children, id, className }: {
  title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode; id?: string; className?: string;
}) {
  return (
    <section aria-labelledby={id} className={합('mb-[32px] flex flex-col gap-[16px]', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-[16px] gap-y-[6px]">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-[12px] gap-y-[4px]">
          <h2 id={id} className={관.h2}>{title}</h2>
          {sub && <p className={관.sub}>{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/* 밑줄 탭 — 원본 「상태 탭」: 켜지면 t5 Bold navy + 아래 coral-500 3px · 꺼지면 navy-600 */
export function AdminTabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { key: T; label: ReactNode; count?: number | null }[]; value: T; onChange: (k: T) => void; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-[8px] overflow-x-auto border-b border-[#dde4e6]">
      {tabs.map((t) => {
        const 켜짐 = t.key === value;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={켜짐} onClick={() => onChange(t.key)}
            className={합('relative flex h-[40px] shrink-0 items-center gap-[6px] whitespace-nowrap px-[8px] text-[16px]',
              켜짐 ? 'font-bold text-[#112231]' : 'text-[#304f65] hover:text-[#112231]')}>
            {t.label}
            {t.count != null && <span className={켜짐 ? 'text-[#b42a21]' : ''}>{t.count.toLocaleString('ko-KR')}</span>}
            {켜짐 && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[3px] rounded-full bg-[#ff4f40]" />}
          </button>
        );
      })}
    </div>
  );
}

/* 검색칸 — 원본 「RAPO / Search Field」 536×46 · 돋보기 · radius 8 */
export function AdminSearchField({ value, onChange, onSubmit, placeholder, label, children }: {
  value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string; label: string; children?: ReactNode;
}) {
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      className="flex w-full max-w-[640px] flex-wrap items-center gap-[8px]">
      <label className="relative flex min-w-0 flex-1 basis-[240px] items-center">
        <span className="sr-only">{label}</span>
        <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-[14px] size-[18px] text-[#304f65]">
          <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="h-[46px] w-full rounded-[8px] border border-[#dde4e6] bg-white pl-[42px] pr-[14px] text-[16px] text-[#112231] placeholder:text-[#868b94] focus:border-[#304f65] focus:outline-none" />
      </label>
      {onSubmit && <button type="submit" className={관.btn + ' h-[46px]'}>검색</button>}
      {children}
    </form>
  );
}

/* 지표 카드 — 원본 「RAPO / 운영 / 지표 카드」 1406:386: 흰 바탕 · 테두리 · radius 12 · 높이 114.
   값이 없으면 지어내지 않고 빈말(「불러오는 중…」·「못 셌어요」)을 씁니다. 설명에 분모·날짜를 적습니다 */
export function AdminMetricCard({ 그림, 이름, 값, 단위, 설명, 그래프, 빈말, href }: {
  그림?: string | ReactNode; 이름: string; 값: string | null; 단위?: string; 설명: ReactNode;
  그래프?: ReactNode; 빈말?: string; href?: string;
}) {
  const 안 = (
    <>
      <p className="flex items-center gap-[6px] text-[16px] font-bold text-[#304f65]">
        {typeof 그림 === 'string'
          /* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG */
          ? <img src={그림} alt="" width={19} height={19} />
          : 그림}
        {이름}
      </p>
      <div className="flex items-end justify-between gap-[12px]">
        {값 != null
          ? <p className="flex items-baseline gap-[3px] font-bold text-[#112231]"><span className="text-[32px] leading-none tabular-nums">{값}</span>{단위 && <span className="text-[15px]">{단위}</span>}</p>
          : <p className="text-[16px] font-bold text-[#304f65]">{빈말 ?? '불러오는 중…'}</p>}
        {그래프}
      </div>
      <p className="text-[13px] leading-[18px] text-[#555d6d]">{설명}</p>
    </>
  );
  const 꼴 = 'relative flex min-h-[114px] flex-col justify-between gap-[8px] rounded-[12px] border border-[#dde4e6] bg-white px-[15px] py-[12px]';
  return href
    ? <a href={href} className={꼴 + ' hover:border-[#304f65]'}>{안}</a>
    : <div className={꼴}>{안}</div>;
}

/* 쪽 넘기기 — 이전 · n/m · 다음 */
export function AdminPager({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (p: number) => void }) {
  const 끝 = Math.max(1, Math.ceil(total / size));
  return (
    <div className="mt-[16px] flex items-center justify-between gap-[12px]">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className={관.btnLine}>← 이전</button>
      <span className={관.sub}>{page + 1} / {끝} 쪽 · 모두 {total.toLocaleString('ko-KR')}건</span>
      <button type="button" disabled={(page + 1) * size >= total} onClick={() => onPage(page + 1)} className={관.btnLine}>다음 →</button>
    </div>
  );
}
