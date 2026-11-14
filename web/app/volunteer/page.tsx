import type { Metadata } from 'next';
import Link from 'next/link';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { RapoEduFilter, RapoEduPastToggle, RapoEduTop, RapoExploreNote, RapoExploreRow, RapoNotifyLink } from '@/components/rapo/rapo-edu';
import { RapoPagination } from '@/components/rapo/rapo-ui';
import { 기관그림 } from '@/lib/rapo-home';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 봉사활동 찾기 (2026-10-02).

   치료사는 봉사 실적이 필요할 때가 있습니다 — 취업·승진 서류에 넣거나,
   학생은 학점 때문에 찾습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   VMS(한국사회복지협의회)를 **Lightsail 수집기**가 받아 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`봉사목록()` · `봉사셈()`).
   화면이 VMS 를 직접 부르지 않습니다 — 인증키가 브라우저로 나가지 않고,
   분야·시군구를 잇는 일을 사람마다 되풀이하지 않습니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   공공데이터이고 개인정보가 한 칸도 없습니다. /orgs 와 같은 결입니다.
   옛 앱은 로그인을 요구했는데, 가릴 까닭이 없는 자료였습니다.

   ── 분야 탭 (세중님 확정 2026-10-02) ──────────────────────────
   전체(기본) / 복지·보건 / 기타.
   **분야를 모르는 것은 「전체」에만 나옵니다.** 지금은 적십자 혈액원
   한 곳(헌혈의집 안내)이고, 그 기관이 VMS 봉사활동처 표에 없습니다.
   모르는 것을 「기타」에 넣으면 기타가 무슨 뜻인지 흐려집니다.

   ── 시·군·구는 적기만 합니다 ──────────────────────────────────
   거르는 칸으로 안 씁니다. 그 값은 **기관이 있는 곳**이고 봉사하는 곳이
   아니며, 1,099건 중 1,019건(93%)만 압니다. 거르는 칸으로 쓰면 나머지
   7%가 소리 없이 사라집니다.

   ⚷ 담당자·시설장 실명은 DB 에 칸 자체가 없습니다. 여기로 올 길이 없습니다.

   ── 새 디자인 (2026-11-12 · 세중님 「봉사활동, 청년정책도 시작」) ──
   피그마에 이 화면 전용 원본이 없어 교육 목록(U12)의 틀을 빌립니다 (components/rapo/rapo-edu.tsx 머리).
   자료를 읽는 길과 거르는 규칙은 그대로이고 모양만 바꿨습니다. 출처 안내는 맨 아래 회색 칸으로 옮겼습니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '봉사활동 찾기 · RAPO',
  description: '지역과 분야로 봉사할 곳을 찾습니다. 신청은 VMS 에서 합니다',
};

/* 주소에 한글을 넣으면 인코딩되어 길어집니다. 짧은 이름표를 씁니다 */
const TABS = [
  { key: 'all', label: '전체', 갈래: null as string | null },
  { key: 'care', label: '복지·보건', 갈래: '복지·보건' },
  { key: 'etc', label: '기타', 갈래: '기타' },
];

/* 회원 지역을 첫 시·도로 쓰려면 두 가지가 걸립니다.

   ① 회원 지역은 「경기·인천」처럼 **묶음**입니다 (lib/signup-fields.ts REGIONS).
      VMS 는 시·도 하나하나라 1:1 이 안 됩니다. 여덟 묶음 중 **셋만** 맞습니다.
      나머지는 **전국**으로 둡니다 — 「경기·인천」인 분을 경기로 짐작해
      보내지 않습니다 (지역을 짐작해 붙이지 않는다는 규칙).

   ② 지역은 `profiles` 에 **없습니다.** 현직은 `salary_records.region`,
      학생은 `student_specs.want_region` 입니다.
      (처음에 `profiles.region` 을 읽게 썼다가 42703 「칸이 없다」로 잡았습니다) */
const 지역기본: Record<string, string> = {
  서울: '서울', 강원: '강원', 제주: '제주',
};

type SP = { tab?: string; sido?: string; p?: string; past?: string };

type 줄 = {
  번호: number; 제목: string; 기관: string | null;
  시도: string | null; 시군구: string | null; 장소: string | null;
  분야: string | null; 갈래: string; 활동종류: string | null;
  기간: string | null; 상태: string | null;
  모집인원: number | null; 신청인원: number | null;
  청소년: boolean; 올린날: string | null; 주소: string | null;
};

type 셈 = {
  전체: number; '복지·보건': number; 기타: number; 모름: number;
  시도들: { 시도: string; 수: number }[];
  마지막수집: string | null;
};

export default async function Volunteer({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(0, Number(sp.p ?? 0) || 0);

  const sb = await serverSupabase();

  /* 「모집 끝난 것도 보기」 — 켜면 상태를 안 거릅니다 (2026-10-04) */
  const 지난것 = sp.past === '1';

  /* 주소에 시·도가 있으면 그것, 없으면 회원 지역에서. 회원이 아니면 전국.
     「전국」을 또렷이 고른 것과 「아직 안 골랐다」를 가려야 하므로
     주소에 sido=all 이 있으면 전국으로 못 박습니다 */
  let sido: string | null = null;
  if (sp.sido === 'all') sido = null;
  else if (sp.sido) sido = sp.sido;
  else if (await serverWho(sb) === '회원') {
    /* **회원일 때만** 묻습니다. 비로그인에게는 두 표가 42501 을 내므로,
       안 가리면 모든 손님마다 실패하는 요청이 둘 생깁니다.
       현직 먼저, 없으면 학생의 희망 지역. 둘 다 없으면 전국입니다 */
    const [현직, 학생] = await Promise.all([
      sb.from('salary_records').select('region').limit(1).maybeSingle(),
      sb.from('student_specs').select('want_region').limit(1).maybeSingle(),
    ]);
    const r = (현직.data as { region?: string | null } | null)?.region
      ?? (학생.data as { want_region?: string | null } | null)?.want_region
      ?? '';
    sido = 지역기본[r] ?? null;
  }

  const [목록, 셈값] = await Promise.all([
    sb.rpc('봉사목록', { p_갈래: tab.갈래, p_시도: sido, p_상태: 지난것 ? null : '모집중', p_page: page }),
    sb.rpc('봉사셈', { p_시도: sido, p_상태: 지난것 ? null : '모집중' }),
  ]);

  const rows = (목록.data ?? []) as unknown as 줄[];
  const c = (셈값.data ?? null) as 셈 | null;
  const 이탭수 = c ? (tab.갈래 === null ? c.전체 : tab.갈래 === '기타' ? c.기타 : c['복지·보건']) : 0;

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const s = next.sido ?? (sp.sido ?? (sido ? sido : 'all'));
    if (t && t !== 'all') q.set('tab', t);
    if (s) q.set('sido', s);
    /* 「모집 끝난 것 포함」을 쪽 넘기기·조건 바꾸기에도 이어 갑니다 (2026-11-12 · 전에는 다음 쪽에서 풀렸습니다) */
    const pa = next.past ?? sp.past;
    if (pa === '1') q.set('past', '1');
    if (next.p && next.p !== '0') q.set('p', next.p);
    const str = q.toString();
    return '/volunteer' + (str ? '?' + str : '');
  };

  /* 조건 칩 — 분야 · 지역(시·도). 고르면 첫 쪽으로 */
  const 분야선택지 = TABS.map((t) => ({
    글: t.key === 'all' ? '분야 전체' : t.label,
    주소: 길({ tab: t.key, p: '0' }),
    켜짐: t.key === tab.key,
    수: c ? (t.갈래 === null ? c.전체 : t.갈래 === '기타' ? c.기타 : c['복지·보건']) : undefined,
  }));
  const 지역선택지 = [
    { 글: '전국', 주소: 길({ sido: 'all', p: '0' }), 켜짐: !sido },
    ...(c?.시도들 ?? []).map((x) => ({ 글: x.시도, 주소: 길({ sido: x.시도, p: '0' }), 켜짐: sido === x.시도, 수: x.수 })),
  ];

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoEduTop title="봉사활동" art="/rapo/home/graphic-volunteer-28.svg" />
      <main className="px-(--rapo-dimension-x5) pb-(--rapo-dimension-x8)">
        <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x4)">
          <RapoEduFilter icon="/rapo/list/sliders-16.svg" label="분야" 고른것={tab.key === 'all' ? null : tab.label} 선택지={분야선택지} />
          <RapoEduFilter icon="/rapo/list/pin-16.svg" label="지역" 고른것={sido} 선택지={지역선택지} />
        </div>
        <RapoNotifyLink href="/me/notify#volunteer">우리 지역 새 봉사활동 알림 받기</RapoNotifyLink>

        <div className="flex items-center justify-between gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x2)">
          <h2 className="text-[20px] font-bold leading-[22px] text-(color:--rapo-brand-color-navy)">봉사활동 {이탭수}건</h2>
          <RapoEduPastToggle on={지난것} label="모집 끝난 것 포함"
            href={길({ past: 지난것 ? '0' : '1', p: '0' })} />
        </div>

        {목록.error && (
          <p role="alert" className="rapo-type-t4-regular mt-(--rapo-dimension-x4) rounded-(--rapo-radius-r2) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4) text-[#b42a21]">
            봉사활동 목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
          </p>
        )}

        {!목록.error && rows.length === 0 && (
          <div className="flex flex-col items-center gap-(--rapo-dimension-x3) py-(--rapo-dimension-x12) text-center">
            <p className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">{sido ?? '전국'}에 지금 올라온 봉사활동이 없어요</p>
            {sido && (
              <Link href={길({ sido: 'all', p: '0' })} className="rapo-type-t4-bold flex h-(--rapo-touch-min) items-center text-[#b42a21] underline underline-offset-4">
                전국으로 보기
              </Link>
            )}
          </div>
        )}

        <ul>
          {rows.map((v) => {
            const 남은자리 = v.모집인원 && v.신청인원 !== null && v.신청인원 <= v.모집인원 ? v.모집인원 - v.신청인원 : 0;
            const 곳 = [v.시도, v.시군구].filter(Boolean).join(' ');
            return (
              <li key={v.번호}>
                <RapoExploreRow href={v.주소} 기관={v.기관} 그림={기관그림(v.기관 || String(v.번호))} 제목={v.제목} 바깥말="VMS 에서 신청"
                  설명={v.장소}
                  태그={[v.활동종류, v.분야, v.청소년 ? '청소년 가능' : null,
                    v.모집인원 ? `${v.신청인원 ?? 0}/${v.모집인원}명${남은자리 > 0 ? ` · ${남은자리}자리` : ''}` : null]
                    .filter((x): x is string => !!x)}
                  날짜={v.기간 || 곳 ? <>{v.기간}{v.기간 && 곳 && <>&nbsp;&nbsp;&nbsp;</>}{곳}</> : null} />
              </li>
            );
          })}
        </ul>

        {/* 쪽 넘기기 — 한 쪽 20건입니다 (봉사목록() 과 같아야 합니다) */}
        <div className="pt-(--rapo-dimension-x4)">
          <RapoPagination page={page} pages={Math.max(1, Math.ceil(이탭수 / 20))} href={(p) => 길({ p: String(p) })} />
        </div>

        <RapoExploreNote>
          <p>한국사회복지협의회 <b>VMS</b> 자료예요. 오늘부터 180일 안에 하는 봉사만 모았어요.</p>
          <p><b>신청은 VMS 에서</b> 해요 — 회원가입이 필요할 수 있어요. 열리지 않으면 기관에 전화로 물어보세요.</p>
          <p>구·군은 <b>기관이 있는 곳</b>이고 봉사하는 곳이 아니에요. 모르는 곳은 비워 뒀어요.</p>
          {tab.갈래 === null && c && c.모름 > 0 && <p>분야를 알 수 없는 {c.모름}건은 「분야 전체」에만 나와요.</p>}
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
