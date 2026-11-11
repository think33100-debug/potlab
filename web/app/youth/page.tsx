import type { Metadata } from 'next';
import Link from 'next/link';

import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduPastToggle, RapoEduTop, RapoExploreNote, RapoExploreRow } from '@/components/rapo/rapo-edu';
import { RapoPagination } from '@/components/rapo/rapo-ui';
import { 기관그림 } from '@/lib/rapo-home';
import { serverSupabase } from '@/lib/supabase-server';

/* 청년정책 찾기 (2026-10-04).

   ── 왜 있나 ──────────────────────────────────────────────────
   옛 앱에 있던 기능입니다. 취업 지원금·교육비·주거·자격증 응시료 같은
   것이라 치료사 회원에게도 그대로 쓸모가 있습니다.
   옛 앱은 시트에 2,745건을 받아둔 채 멈춰 있었습니다 — 채우는 트리거가
   없었습니다. 지금 창구에는 3,150건이 있습니다.

   ── 치료사용으로 거르지 않습니다 (세중님 결정) ────────────────
   청년 **일반** 정책입니다. 직군으로 거르면 쓸 만한 것이 다 사라집니다.
   대신 화면에 「청년 일반 정책입니다」라고 또렷이 적습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `tools/collect-youth.mjs` 가 온통청년에서 받아 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`청년목록()` · `청년셈()`).
   화면이 온통청년을 직접 부르지 않습니다 — 인증키가 브라우저로 안 나갑니다.

   ── 지역을 짐작하지 않습니다 ──────────────────────────────────
   응답의 `zipCd` 는 **중앙부처 정책이 전부 11110(서울 종로)** 으로 옵니다.
   그대로 쓰면 전국 정책이 죄다 「서울」이 됩니다. 그래서 기관 **이름**으로
   가리고, 모르면 「모름」으로 둡니다 (화면의 시·도 줄에는 안 올립니다).
   시·도를 고르면 **그 지역 + 전국**이 함께 나옵니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   정부가 공개한 정책 안내이고 개인정보가 한 칸도 없습니다.
   /volunteer · /edu · /orgs 와 같은 결입니다.

   ⚷ 담당자 실명은 DB 에 칸 자체가 없습니다. 여기로 올 길이 없습니다.

   ── 새 디자인 (2026-11-12 · 세중님 「봉사활동, 청년정책도 시작」) ──
   피그마에 이 화면 전용 원본이 없어 교육 목록(U12)의 틀을 빌립니다 (components/rapo/rapo-edu.tsx 머리).
   자료를 읽는 길과 거르는 규칙은 그대로이고 모양만 바꿨습니다. 출처 안내는 맨 아래 회색 칸으로 옮겼습니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '청년정책 찾기 · RAPO',
  description: '취업·교육비·주거·금융 지원 등 청년정책을 한자리에서 봅니다. 신청은 각 기관에서 합니다',
};

/* 주소에는 짧은 이름표를 씁니다 — 한글은 주소에서 아홉 배로 부풉니다 */
const TABS = [
  { key: 'all', label: '전체', 갈래: null as string | null },
  { key: 'job', label: '일자리', 갈래: '일자리' },
  { key: 'edu', label: '교육', 갈래: '교육' },
  { key: 'home', label: '주거', 갈래: '주거' },
  { key: 'wel', label: '금융·복지', 갈래: '금융복지' },
  { key: 'part', label: '참여', 갈래: '참여' },
];

type SP = { tab?: string; sido?: string; p?: string; past?: string };

type 줄 = {
  번호: string; 정책명: string; 갈래: string; 중분류: string | null;
  키워드: string | null; 설명: string | null; 지원내용: string | null;
  소관기관: string | null; 시도: string; 상시: boolean;
  신청시작: string | null; 신청끝: string | null;
  나이최소: number | null; 나이최대: number | null; 나이제한없음: boolean | null;
  신청주소: string | null; 참고주소: string | null;
};

type 셈 = {
  전체: number;
  갈래: Record<string, number>;
  시도들: { 시도: string; 수: number }[];
  마지막수집: string | null;
};

const 날 = (s: string) => {
  const [, m, d] = s.split('-');
  return Number(m) + '월 ' + Number(d) + '일';
};

/* 「상시」인지, 기간이 정해진 것인지. 기간이면 **언제까지인지**가 제일 급한 정보라
   끝 날짜를 앞에 둡니다 */
function 기간쓰기(v: 줄) {
  if (v.상시) return { 글: '상시 신청', 급한가: false };
  if (v.신청끝) return { 글: '~ ' + 날(v.신청끝) + '까지', 급한가: true };
  if (v.신청시작) return { 글: 날(v.신청시작) + ' 부터', 급한가: false };
  return null;
}

function 나이쓰기(v: 줄) {
  if (v.나이제한없음) return '나이 제한 없음';
  if (v.나이최소 && v.나이최대) return v.나이최소 + '~' + v.나이최대 + '세';
  if (v.나이최대) return '~' + v.나이최대 + '세';
  if (v.나이최소) return v.나이최소 + '세 이상';
  return null;
}

export default async function Youth({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const 지난것 = sp.past === '1';
  const sido = sp.sido && sp.sido !== 'all' ? sp.sido : null;

  const sb = await serverSupabase();
  const [목록, 셈값] = await Promise.all([
    sb.rpc('청년목록', { p_갈래: tab.갈래, p_시도: sido, p_지난것: 지난것, p_page: page }),
    sb.rpc('청년셈', { p_시도: sido, p_지난것: 지난것 }),
  ]);

  const rows = (목록.data ?? []) as unknown as 줄[];
  const c = (셈값.data ?? null) as 셈 | null;
  const 이탭수 = c ? (tab.갈래 === null ? c.전체 : (c.갈래?.[tab.갈래] ?? 0)) : 0;

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const s = next.sido ?? sp.sido;
    const pa = next.past ?? sp.past;
    if (t && t !== 'all') q.set('tab', t);
    if (s && s !== 'all') q.set('sido', s);
    if (pa === '1') q.set('past', '1');
    if (next.p && next.p !== '0') q.set('p', next.p);
    const str = q.toString();
    return '/youth' + (str ? '?' + str : '');
  };

  /* 조건 칩 — 갈래 · 지역(시·도 · 고르면 그 지역 + 전국). 고르면 첫 쪽으로 */
  const 갈래선택지 = TABS.map((t) => ({
    글: t.key === 'all' ? '갈래 전체' : t.label,
    주소: 길({ tab: t.key, p: '0' }),
    켜짐: t.key === tab.key,
    수: c ? (t.갈래 === null ? c.전체 : (c.갈래?.[t.갈래] ?? 0)) : undefined,
  }));
  const 지역선택지 = [
    { 글: '전국', 주소: 길({ sido: 'all', p: '0' }), 켜짐: !sido },
    ...(c?.시도들 ?? []).map((x) => ({ 글: x.시도, 주소: 길({ sido: x.시도, p: '0' }), 켜짐: sido === x.시도, 수: x.수 })),
  ];

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop title="청년정책" art="/rapo/home/graphic-youth-28.svg" />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x4)">
          <RapoEduFilter icon="/rapo/list/sliders-16.svg" label="갈래" 고른것={tab.key === 'all' ? null : tab.label} 선택지={갈래선택지} />
          <RapoEduFilter icon="/rapo/list/pin-16.svg" label="지역" 고른것={sido ? `${sido} + 전국` : null} 선택지={지역선택지} />
        </div>

        <div className="flex items-center justify-between gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
          <h2 className="text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">청년정책 {이탭수}건</h2>
          <RapoEduPastToggle on={지난것} label="신청 끝난 것 포함" href={길({ past: 지난것 ? '0' : '1', p: '0' })} />
        </div>

        {목록.error && (
          <p role="alert" className="rapo-type-t4-regular mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r2) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4) text-[#b42a21]">
            청년정책 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
          </p>
        )}

        {!목록.error && rows.length === 0 && (
          <div className="flex flex-col items-center gap-(--rapo-dimension-x3) py-(--rapo-dimension-x12) text-center">
            <p className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">{지난것 ? '모아 둔 정책이 없어요' : '지금 신청할 수 있는 정책이 없어요'}</p>
            {!지난것 && (
              <Link href={길({ past: '1', p: '0' })} className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center text-[#b42a21] underline underline-offset-4">
                신청 끝난 것까지 보기
              </Link>
            )}
          </div>
        )}

        <ul>
          {rows.map((v) => {
            const 기간 = 기간쓰기(v);
            const 나이 = 나이쓰기(v);
            return (
              <li key={v.번호}>
                <RapoExploreRow href={v.신청주소 || v.참고주소} 기관={v.소관기관} 그림={기관그림(v.소관기관 || v.번호)} 제목={v.정책명} 바깥말="신청하러 가기"
                  설명={v.설명}
                  태그={[v.갈래, v.시도 === '전국' ? '전국' : v.시도, 나이, v.중분류].filter((x): x is string => !!x)}
                  날짜={기간?.글 ?? null} 급함={!!기간?.급한가} />
              </li>
            );
          })}
        </ul>

        {/* 쪽 넘기기 — 한 쪽 20건입니다 (청년목록() 과 같아야 합니다) */}
        <div className="pt-(--rapo-dimension-x4)">
          <RapoPagination page={page} pages={Math.max(1, Math.ceil(이탭수 / 20))} href={(p) => 길({ p: String(p) })} />
        </div>

        {/* 세중님이 정하신 안내 줄 — 출처와 한계를 화면에 밝힙니다 */}
        <RapoExploreNote>
          <p><b>청년 일반 정책이에요. 나이·소득 조건은 각 정책에서 확인하세요.</b></p>
          <p>치료사용으로 고르지 않았어요 — 청년이면 누구나 보는 정책을 그대로 모았어요.</p>
          <p>자료는 <b>온통청년</b>(한국고용정보원)에서 받아 와요. <b>신청·문의는 각 기관에서</b> 하세요.</p>
          <p>지역은 <b>맡은 기관 이름</b>으로 가린 것이에요. 중앙부처 정책은 <b>전국</b>으로 두고, 알 수 없는 것은 지역 칸에 올리지 않았어요.</p>
          {c?.마지막수집 && (
            <p>마지막으로 받아온 때 {new Date(c.마지막수집).toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}</p>
          )}
        </RapoExploreNote>
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" />
    </div>
  );
}
