import type { Metadata } from 'next';
import Link from 'next/link';

import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduTop, RapoExploreNote } from '@/components/rapo/rapo-edu';
import { RapoButton, RapoPagination } from '@/components/rapo/rapo-ui';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 경쟁률 찾아보기 (2026-10-05 · 꼴은 2026-10-07 에 다시 짰습니다).

   ── 왜 있나 ──────────────────────────────────────────────────
   공공기관이 알리오에 **지난 채용의 선발·응시 인원을 공개**합니다.
   「○○병원 작업치료사 경쟁률」로 찾는 사람이 적지 않은데 그 자리에
   우리 화면이 없었습니다. 설계는 `경쟁률_찾아보기_설계.md` 에 있습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `~/경쟁률크론.sh` 가 주 1회(수요일 03:15) 네 도구를 돌려 담고,
   이 화면은 담긴 것만 읽습니다. 긁거나 지어내지 않습니다.

   ── 왜 222묶음뿐인가 ─────────────────────────────────────────
   회원에게는 **확실한 것만** 보냅니다. 우리 직군 묶음 269개 중
     − 짝 확인 필요 39   같은 자리인지 사람이 봐야 하는 것
     − 고용형태 모름 2   짐작해 붙이지 않은 것
     − 경쟁률 낼 값 없음  뽑은 사람이 0명인 것
   을 빼고 **222묶음**입니다. 거르는 자리는 DB 함수 안입니다.

   ── 가운데 길 (2026-10-05 세중님 결정) ────────────────────────
   목록은 **누구나** 봅니다. 묶음 222개는 개인정보가 없는 공개 자료입니다.
   **경쟁률 숫자는 로그인한 회원만** 봅니다.
   ★ 화면에서 가리지 않습니다 — 목록 함수(`경쟁률찾기목록`)가 평균·
     가장높음·가장낮음을 **아예 안 내보냅니다.** 화면에서 가리면
     개발자 도구 네트워크 응답에 값이 그대로 보입니다.
   숫자는 `경쟁률한묶음()` 이 첫 줄에서 `auth.uid()` 를 보고 줍니다.

   ── 꼴은 공고 목록과 같은 결입니다 (2026-10-07 세중님 지시) ────
   teamsparta.md 토큰만 씁니다. 화면마다 색을 새로 박지 않습니다.
     · 목록    테두리 없는 줄 + divide-y · 기관 작게 → 제목 크게 → 꼬리표
     · 꼬리표  badge-blue-bg + interaction-blue  (공고 목록 분류 꼬리표와 같은 것)
     · CTA     brand-red · rounded-md · active:scale-[0.98]
     · 숫자    tabular-nums (스파르타 Typography 절)

   ── 로그인 없이 봅니다 (목록만) ───────────────────────────────
   /edu · /volunteer · /orgs 와 같은 결입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '경쟁률 찾아보기 · RAPO',
  description: '공공기관이 공개한 지난 채용의 경쟁률을 자리별로 모았습니다. 알리오 공개 자료 기준',
};

type SP = { job?: string; sido?: string; org?: string; q?: string; p?: string; g?: string };

type 묶음 = {
  묶음키: string; 기관: string; 직군: string; 지역: string;
  고용형태: string | null; 자리: string | null;
  회차: number; 첫해: number; 끝해: number; 기본값단계: boolean;
};

type 목록 = {
  전체: number; 쪽: number; 쪽당: number;
  직군들: string[]; 지역들: string[]; 기관들: string[]; 묶음: 묶음[];
};

type 단계 = { 이름: string | null; 선발: number | null; 응시: number | null; 확정일: string | null };
type 회차 = {
  sn: number; 마감: string | null; 해: number | null; 공고제목: string | null;
  자리이름: string | null; 경쟁률: string | null; 경쟁률상태: string | null;
  첫응시: number | null; 끝선발: number | null; 단계들: 단계[] | null;
};
type 한묶음 = {
  머리: 묶음 & {
    값있음: number; 평균: string | null;
    가장낮음: string | null; 가장높음: string | null; 계산불가: number;
  };
  회차들: 회차[];
};

/* 문장 꼴은 **이것 하나로 고정**입니다 (경쟁률_화면_설계.md 2절).
   한 번뿐이면 「평균」을 안 씁니다 — 한 번으로 낸 값과 마흔 번으로 낸
   평균이 같은 얼굴로 보이면 안 됩니다 */
function 요약문(h: 한묶음['머리']) {
  const 년 = Math.max(1, 2026 - h.첫해);
  if (!h.평균) return '경쟁률을 낼 값이 없어요';
  return h.회차 === 1
    ? `최근 ${년}년 이내 1번 채용 · 경쟁률 ${h.평균} 대 1`
    : `최근 ${년}년 이내 ${h.회차}번 채용 · 평균 경쟁률 ${h.평균} 대 1`;
}

/* 한 회차의 경쟁률 칸 (2026-10-07 세중님 결정).

   전에는 셋을 뭉뚱그려 「경쟁률 낼 값 없음」이라고만 적었습니다.
   뜻이 다 다릅니다 —

     ① 지원자 0명              32회차 → 「0 : 1」
     ② 지원자는 있는데 선발 0명  32회차 → 「지원 ○명 · 선발 0명」
          ★ 「0 대 1」로 적지 않습니다. 뜻이 **반대**가 됩니다 —
            아무도 안 왔다가 아니라 왔는데 안 뽑은 것입니다
     ③ 기관이 숫자를 안 적음     7회차 → 「기관이 숫자를 안 적었어요」
          ★ 0 이 아니라 **모르는 것**입니다. 숫자를 지어내지 않습니다

   셋 다 평균·가장 낮음·가장 높음 계산에는 안 들어갑니다 —
   alio_group_sum.평균 은 값있음 줄로만 냅니다 (자료로 확인했습니다). */
function 률칸(r: 회차) {
  if (r.경쟁률상태 === '있음' && r.경쟁률) {
    return { 큰글: `${r.경쟁률} : 1`, 작은글: null as string | null, 흐림: false };
  }
  if (r.첫응시 == null || r.끝선발 == null) {
    return { 큰글: null, 작은글: '기관이 숫자를 안 적었어요', 흐림: true };
  }
  if (r.끝선발 === 0 && r.첫응시 > 0) {
    return { 큰글: null, 작은글: `지원 ${r.첫응시}명 · 선발 0명`, 흐림: false };
  }
  if (r.첫응시 === 0) {
    return { 큰글: '0 : 1', 작은글: '지원한 사람이 없었어요', 흐림: false };
  }
  return { 큰글: null, 작은글: '경쟁률을 낼 값이 없어요', 흐림: true };
}

/* 출처와 한계 — 화면 아래 **늘** 붙습니다 (경쟁률_화면_설계.md 4절) */
function 밝힘({ 기본값단계 }: { 기본값단계?: boolean }) {
  return (
    <RapoExploreNote>
      <p>알리오(공공기관 경영정보 공개시스템)에 기관이 올린 자료 기준이에요. <b>공공기관만 해당돼요</b> — 민간 병원은 이 자료에 없어요.</p>
      <p>경쟁률은 <b>첫 단계 응시자 ÷ 최종 선발 인원</b>이에요. 뽑은 사람이 0명이면 비율 대신 <b>지원·선발 인원</b>을 그대로 적고, 기관이 인원을 안 적은 회차는 <b>「안 적었어요」</b>로 둬요 — 0으로 적지 않아요.</p>
      {기본값단계 && <p>단계가 서류인지 면접인지 공고 설명에 없으면 <b>일반적인 전형 순서 기준</b>으로 적어요.</p>}
    </RapoExploreNote>
  );
}

/* ── 새 디자인 (2026-11-12 세중님 「회차별로 보기가 옛날 거 · 피그마에 없으니 우리 형식 살려서」) ──
   피그마에 이 화면이 없어 우리 새 디자인 조각으로 짰습니다 —
     머리      RapoEduTop(뒤로 · 「경쟁률」 · 그림 대신 없음) — 교육·봉사·청년정책과 같은 목록 상단
     한 묶음   공고 상세 「지난 채용 경쟁률」 카드(brand-weak · 평균 t12)와 같은 카드 → 회차 줄(아래 선 #dde4e6)
     목록      조건 칩(RapoEduFilter: 직군 · 지역 · 기관) · 찾기 칸 · RapoExploreRow · 쪽 넘기기
     밝힘      RapoExploreNote(맨 아래 회색 칸)
   자료를 읽는 길(경쟁률찾기목록 · 경쟁률한묶음)과 회차 칸 규칙(률칸)·요약 문장(요약문)은 그대로입니다. */

function 배(v: string | null) {
  if (v == null) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })} : 1` : `${v} : 1`;
}

export default async function Compete({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const 쪽 = Math.max(1, Number(sp.p ?? 1) || 1);
  /* ★ sp.g 는 Next 가 이미 한 번 풀어 줍니다. 여기서 또 풀거나
     href 에서 미리 encodeURIComponent 하면 **두 번 인코딩**되어
     주소가 쓸데없이 길어집니다 (한글은 주소에서 아홉 배로 부풉니다) */
  const 고른묶음 = sp.g || null;

  const sb = await serverSupabase();
  const 누구 = await serverWho(sb);

  const 틀 = (뒤로: string, 속: React.ReactNode) => (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop title="경쟁률" back={뒤로} art="/rapo/home/graphic-cert-28.svg" />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">{속}</main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/jobs" />
    </div>
  );

  /* ★ 2026-10-09 밤 — **비회원에게는 목록도 안 보입니다.** (세중님 지시 · 앞 결정과 나란히)
       2026-10-05  「목록은 누구나 봅니다. 숫자는 회원만」 (가운데 길)
       2026-10-09  「/compete 직접 접속도 서버에서 로그인 안내로」
     「모름」일 때는 막지 않습니다 — 잠깐 끊긴 회원이 쫓겨납니다 (lib/supabase-server.ts 의 세 값 규칙). */
  if (누구 === '비회원') {
    return 틀('/', (
      <section className="flex flex-col gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x8)">
        <h2 className="rapo-type-t10-bold break-keep text-(color:--rapo-brand-color-navy)">지난 채용 경쟁률은<br />회원에게 보여드려요</h2>
        <p className="rapo-type-t5-regular break-keep text-[#3f4c57]">공공기관이 공개한 지난 채용의 지원·선발 인원을 회차별로 모았어요.</p>
        <RapoButton href={'/login?next=' + encodeURIComponent(고른묶음 ? `/compete?g=${고른묶음}` : '/compete')} tone="deep-coral" full>1분 만에 가입하고 보기</RapoButton>
      </section>
    ));
  }

  /* ★ 2026-10-28 세중님 ⓑ — **둘을 함께 띄웁니다** (목록과 한 묶음은 서로를 안 봅니다 · docs/속도진단_1028.md ⓑ) */
  const 목록약속 = sb.rpc('경쟁률찾기목록', {
    p_직군: sp.job && sp.job !== '전체' ? sp.job : null,
    p_지역: sp.sido || null,
    p_기관: sp.org || null,
    p_찾기: sp.q || null,
    p_쪽: 쪽,
  });
  const 한묶음약속 = 고른묶음 ? sb.rpc('경쟁률한묶음', { p_묶음키: 고른묶음 }) : null;

  const 주소 = (바꿀: Partial<SP>) => {
    const q = new URLSearchParams();
    const 다음 = { ...sp, ...바꿀 };
    for (const k of ['job', 'sido', 'org', 'q', 'p', 'g'] as const) {
      const v = 다음[k];
      if (v) q.set(k, String(v));
    }
    const s = q.toString();
    return s ? '/compete?' + s : '/compete';
  };

  /* ── 한 묶음(회차별) 보기 ─────────────────────────────────── */
  if (고른묶음 && 한묶음약속) {
    const r = await 한묶음약속;
    const 한것 = r.error ? null : (r.data as 한묶음 | null);
    return 틀(주소({ g: undefined }), 한것 ? (
      <div className="flex flex-col gap-(--rapo-dimension-x5) pt-(--rapo-dimension-x4)">
        {/* 머리 — 기관 · 지역 · 고용형태 작게, 직군 크게 */}
        <div className="flex flex-col gap-(--rapo-dimension-x1)">
          <p className="rapo-type-t4-medium break-keep text-[#3f4c57]">
            {[한것.머리.기관, 한것.머리.지역, 한것.머리.고용형태].filter(Boolean).join(' · ')}
          </p>
          <h2 className="rapo-type-t9-bold break-keep text-(color:--rapo-brand-color-navy)">{한것.머리.직군} 지난 채용</h2>
          {한것.머리.자리 && <p className="rapo-type-t4-regular break-keep text-[#3f4c57]">{한것.머리.자리}</p>}
        </div>

        {/* 요약 카드 — 공고 상세 「지난 채용 경쟁률」과 같은 꼴 */}
        <div className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x5)">
          <p className="rapo-type-t3-regular text-(color:--rapo-color-fg-brand-contrast)">{한것.머리.회차 === 1 ? '경쟁률' : '평균 경쟁률'}</p>
          <p className="text-(color:--rapo-color-fg-brand)">
            <span className="rapo-type-t12-bold">{한것.머리.평균 == null ? '—' : Number(한것.머리.평균).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}</span>
            {한것.머리.평균 != null && <span className="rapo-type-t6-bold ml-[4px]">: 1</span>}
          </p>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {요약문(한것.머리)}
            {한것.머리.평균 && 한것.머리.가장낮음 && 한것.머리.회차 > 1 ? ` · 가장 낮음 ${배(한것.머리.가장낮음)} · 가장 높음 ${배(한것.머리.가장높음)}` : ''}
          </p>
        </div>

        {/* 회차 — 최근 것부터 */}
        <section aria-labelledby="rounds">
          <h3 id="rounds" className="rapo-type-t7-bold text-(color:--rapo-brand-color-navy)">회차별 경쟁률 {한것.회차들.length}번</h3>
          <ul>
            {한것.회차들.map((c) => {
              const v = 률칸(c);
              return (
                <li key={c.sn} className="flex flex-col gap-(--rapo-dimension-x2) border-b border-[#dde4e6] py-(--rapo-dimension-x4)">
                  <div className="flex items-start justify-between gap-(--rapo-dimension-x3)">
                    <div className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
                      <span className="flex items-center gap-[6px]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
                        <img src="/rapo/edu/calendar-16.svg" alt="" width={16} height={16} className="shrink-0" />
                        <span className="rapo-type-t4-regular text-[#3f4c57]">{c.해}년{c.마감 ? ` · 마감 ${c.마감}` : ''}</span>
                      </span>
                      {c.공고제목 && <p className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy) [overflow-wrap:anywhere]">{c.공고제목}</p>}
                      {c.자리이름 && <p className="rapo-type-t3-regular break-keep text-[#3f4c57]">{c.자리이름}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      {v.큰글 && <p className={'rapo-type-t8-bold tabular-nums ' + (v.흐림 ? 'text-[#3f4c57]' : 'text-(color:--rapo-color-fg-brand)')}>{v.큰글}</p>}
                      {v.작은글 && <p className="rapo-type-t3-regular max-w-[140px] break-keep text-[#3f4c57]">{v.작은글}</p>}
                    </div>
                  </div>
                  {c.단계들 && c.단계들.length > 0 && (
                    <ul className="flex flex-wrap gap-(--rapo-dimension-x1)">
                      {c.단계들.map((t, i) => (
                        <li key={i} className="rapo-type-t2-medium rounded-[4px] bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x2) py-[4px] text-(color:--rapo-color-fg-neutral)">
                          {t.이름 ?? `${i + 1}차`}{t.응시 != null ? ` · ${t.응시}명 지원` : ''}{t.선발 != null ? ` · ${t.선발}명 뽑음` : ''}{t.확정일 ? ` · 결과 ${t.확정일}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.첫응시 != null && c.끝선발 ? (
                    <p className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">{c.첫응시}명이 지원해 {c.끝선발}명을 뽑았어요</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
        <밝힘 기본값단계={한것.머리.기본값단계} />
      </div>
    ) : (
      <p role="alert" className="rapo-type-t4-regular mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r2) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4) text-[#b42a21]">
        경쟁률을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
      </p>
    ));
  }

  /* ── 목록 ────────────────────────────────────────────────── */
  const { data, error } = await 목록약속;
  if (error) {
    return 틀('/', (
      <p role="alert" className="rapo-type-t4-regular mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r2) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4) text-[#b42a21]">
        목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
      </p>
    ));
  }
  const d = data as 목록;
  const 끝쪽 = Math.max(1, Math.ceil(d.전체 / d.쪽당));
  const 직군선택지 = ['전체', ...d.직군들].map((x) => ({ 글: x, 주소: 주소({ job: x === '전체' ? undefined : x, p: undefined }), 켜짐: (sp.job ?? '전체') === x }));
  const 지역선택지 = ['전국', ...d.지역들].map((x) => ({ 글: x, 주소: 주소({ sido: x === '전국' ? undefined : x, p: undefined }), 켜짐: (sp.sido ?? '전국') === x }));
  const 기관선택지 = ['기관 전체', ...d.기관들].map((x) => ({ 글: x, 주소: 주소({ org: x === '기관 전체' ? undefined : x, p: undefined }), 켜짐: (sp.org ?? '기관 전체') === x }));

  return 틀('/', (
    <>
      <p className="rapo-type-t4-regular break-keep pt-(--rapo-dimension-x4) text-[#3f4c57]">공공기관이 공개한 지난 채용의 경쟁률이에요.</p>
      {/* 자리 이름으로 찾기 */}
      <form action="/compete" method="get" className="mt-(--rapo-dimension-x3)">
        {sp.job && <input type="hidden" name="job" value={sp.job} />}
        {sp.sido && <input type="hidden" name="sido" value={sp.sido} />}
        {sp.org && <input type="hidden" name="org" value={sp.org} />}
        <label className="flex h-[52px] items-center gap-(--rapo-dimension-x2_5) rounded-(--rapo-radius-r3) border border-(color:--rapo-color-stroke-neutral-weak) px-(--rapo-dimension-x4)">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/list/search-20.svg" alt="" width={20} height={20} className="shrink-0" />
          <span className="sr-only">기관이나 자리 이름으로 찾기</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="기관·자리 이름으로 찾기" enterKeyHint="search"
            className="rapo-type-t5-regular min-w-0 flex-1 bg-transparent outline-none placeholder:text-(color:--rapo-color-fg-placeholder)" />
        </label>
      </form>
      <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x3)">
        <RapoEduFilter icon="/rapo/list/briefcase-16.svg" label="직군" 고른것={sp.job && sp.job !== '전체' ? sp.job : null} 선택지={직군선택지} />
        <RapoEduFilter icon="/rapo/list/pin-16.svg" label="지역" 고른것={sp.sido || null} 선택지={지역선택지} />
        <RapoEduFilter icon="/rapo/edu/academy-16.svg" label="기관" 고른것={sp.org || null} 선택지={기관선택지} />
      </div>
      <h2 className="pt-(--rapo-dimension-x2) text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">채용 자리 {d.전체}곳</h2>

      {d.묶음.length === 0 ? (
        <p className="rapo-type-t5-regular py-(--rapo-dimension-x8) text-center text-[#3f4c57]">고른 조건에 맞는 자리가 없어요.</p>
      ) : (
        <ul>
          {d.묶음.map((g) => (
            <li key={g.묶음키}>
              <Link href={주소({ g: g.묶음키, p: undefined })}
                className="flex flex-col gap-(--rapo-dimension-x2) border-b border-[#dde4e6] py-(--rapo-dimension-x4) active:bg-(--rapo-color-bg-transparent-pressed)">
                <span className="rapo-type-t4-medium break-keep text-[#3f4c57]">{g.기관} · {g.지역}</span>
                <span className="rapo-type-t7-bold break-keep text-(color:--rapo-brand-color-navy)">{g.직군}{g.고용형태 ? ` · ${g.고용형태}` : ''}</span>
                {g.자리 && <span className="rapo-type-t3-regular break-keep text-[#3f4c57]">{g.자리}</span>}
                <span className="flex flex-wrap items-center gap-(--rapo-dimension-x1)">
                  <span className="rapo-type-t2-medium rounded-[4px] bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x2) py-[4px]">{g.첫해 === g.끝해 ? `${g.첫해}년` : `${g.첫해}~${g.끝해}년`}</span>
                  <span className="rapo-type-t2-medium rounded-[4px] bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x2) py-[4px]">{g.회차}번 채용</span>
                  <span className="rapo-type-t4-bold ml-auto text-[#b42a21]">회차별로 보기 ›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="pt-(--rapo-dimension-x4)">
        <RapoPagination page={쪽 - 1} pages={끝쪽} href={(p) => 주소({ p: String(p + 1) })} />
      </div>
      <밝힘 />
    </>
  ));
}
