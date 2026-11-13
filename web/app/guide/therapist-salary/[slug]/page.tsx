import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { 가운데, 공시해, 공시확인일, 만, 병원정보, 알리미, 알리오, 차례 } from '@/lib/guide-pay';
import { 색인메타 } from '@/lib/seo';
import { 그림판 } from '@/lib/site-url';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { OtherGuides, 단추폭, 도움말, 밑줄, 본문, 작은제목, 점붙임 } from '../../guide-parts';

/* 병원 한 곳의 연봉 쪽 (2026-11-13 세중님 「거창적십자병원 연봉 이런 식으로 넣으면 키워드 노출에 좋을 것 같은데」).

   표에 「연봉」 글자만 붙이는 대신 **병원마다 한 쪽**을 둡니다 — 「○○병원 연봉」으로 찾는 분이 바로 그 병원 숫자를 보게.
   숫자·말·규칙은 전체 표(../page.tsx)와 같습니다 (lib/guide-pay.ts · 공시된 값만 · 치료사만의 연봉이 아님을 맨 위에).
   이 쪽에만 있는 것 — 같은 묶음 안에서 몇 번째인지 · 같은 시도의 다른 공공병원 (둘 다 표의 숫자로 여기서 셉니다).
   주소의 [slug] 는 공시 번호입니다 (lib/guide-pay.ts 병원정보). 목록에 없는 주소는 404 입니다. */

type 병원 = { 이름: string; 슬러그: string; 시도?: string } & (
  | { 갈래: '알리미'; 보건직: number; 신입: number | null }
  | { 갈래: '알리오'; 초임: number }
);

const 모두: 병원[] = [
  ...알리미.map(([이름, 보건직, 신입]) => ({ 이름, ...병원정보[이름], 갈래: '알리미' as const, 보건직, 신입 })),
  ...알리오.map(([이름, 초임]) => ({ 이름, ...병원정보[이름], 갈래: '알리오' as const, 초임 })),
];
const 찾기 = (slug: string) => 모두.find((x) => x.슬러그 === slug) ?? null;
/** 견줄 때 쓰는 값 — 알리미는 보건직 평균, 알리오는 신입 초임 */
const 값 = (x: 병원) => (x.갈래 === '알리미' ? x.보건직 : x.초임);
const 값이름 = (x: 병원) => (x.갈래 === '알리미' ? '보건직 평균' : '신입 초임');

/* 병원별이 아니라 기관 전체로 공시되는 곳 (금고 SQL_1113/P — 본부 단위) */
const 기관전체 = new Set(['근로복지공단', '한국보훈복지의료공단', '대한적십자사']);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = 찾기(slug);
  if (!h) return { title: '없는 쪽입니다 · RAPO' };
  const 제목 = h.갈래 === '알리미'
    ? `${h.이름} 연봉 | ${공시해}년 보건직 평균·신입 평균 (공시)`
    : `${h.이름} 연봉 | ${공시해}년 신입 초임 (공시)`;
  const 설명 = h.갈래 === '알리미'
    ? `${h.이름}의 ${공시해}년 공시 보수예요. 보건직 평균 ${만(h.보건직)}만 원${h.신입 != null ? `, 신입 평균 ${만(h.신입)}만 원` : ''}. 치료사만의 연봉이 아니라 의료기사 직종 전체의 평균이에요.`
    : `${h.이름}의 ${공시해}년 결산 공시 기준 신입 초임은 ${만(h.초임)}만 원이에요. 대졸 신입 기준이고 직군을 나누지 않은 값이에요.`;
  return {
    title: 제목,
    description: 설명,
    robots: 색인메타,
    alternates: { canonical: `/guide/therapist-salary/${h.슬러그}` },
    openGraph: { type: 'article', siteName: 'RAPO', title: 제목, description: 설명, images: [`/api/og/site?v=${그림판}`] },
  };
}

function AmountCard({ 이름, 원 }: { 이름: string; 원: number }) {
  return (
    <li className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-neutral-muted)">{이름}</p>
      <p className="rapo-type-t8-bold whitespace-nowrap tabular-nums text-(color:--rapo-color-fg-neutral)">{만(원)}만 원</p>
    </li>
  );
}

export default async function HospitalSalaryGuide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const h = 찾기(slug);
  if (!h) notFound();
  const who = await serverWho(await serverSupabase());

  const 같은묶음 = 모두.filter((x) => x.갈래 === h.갈래);
  const 값들 = 같은묶음.map(값);
  const 몇번째 = 차례(값들, 값(h));
  const 묶음이름 = h.갈래 === '알리미' ? '지방의료원·적십자병원' : '국립대병원·공공기관';
  const 이웃 = h.시도 ? 모두.filter((x) => x.시도 === h.시도 && x.슬러그 !== h.슬러그) : [];
  const 칸들: [string, number][] = h.갈래 === '알리미'
    ? [['보건직 평균', h.보건직], ...(h.신입 != null ? [['신입 평균', h.신입] as [string, number]] : [])]
    : [['신입 초임', h.초임]];

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">{h.이름} 연봉</h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {점붙임(`${공시해}년 공시 자료 · ${공시확인일} 확인${h.시도 ? ` · ${h.시도}` : ''}`)}
          </p>
          <p className="rapo-type-t4-medium break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-brand-contrast)">
            {h.갈래 === '알리미' ? (
              <>
                치료사만 따로 낸 연봉은 아니에요. <span className="whitespace-nowrap">「보건직 평균」은</span> 치료사나 방사선사 같은 의료기사 직종 전체의 평균이고,{' '}
                <span className="whitespace-nowrap">「신입 평균」은</span> 모든 직종 신입의 평균이에요.
              </>
            ) : (
              <>
                치료사만 따로 낸 연봉은 아니에요. <span className="whitespace-nowrap">「신입 초임」은</span> 대졸 신입 기준이고 직군을 나누지 않은 값이에요.
                {기관전체.has(h.이름) && ' 병원별이 아니라 기관 전체로 공시된 값이에요.'}
              </>
            )}
          </p>
        </section>

        <section aria-labelledby="병원-연봉" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="병원-연봉" className={작은제목}>{공시해}년 공시 보수</h2>
          <ul className={`grid gap-(--rapo-dimension-x3) ${칸들.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {칸들.map(([이름, 원]) => <AmountCard key={이름} 이름={이름} 원={원} />)}
          </ul>
          {h.갈래 === '알리미' && h.신입 == null && (
            <p className={도움말}>신입 평균은 값을 확인하지 못해 비워 두었어요.</p>
          )}
        </section>

        <section aria-labelledby="병원-견줌" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="병원-견줌" className={작은제목}>다른 곳과 견주면</h2>
          <p className={본문}>
            {묶음이름} {같은묶음.length}곳 가운데 {값이름(h)}이{' '}
            <span className="whitespace-nowrap">{몇번째 === 1 ? '가장' : `${몇번째}번째로`}</span> 높아요.{' '}
            {같은묶음.length}곳의 가운데 값은 <span className="whitespace-nowrap tabular-nums">{만(가운데(값들))}만 원</span>이에요.
          </p>
          <p className={본문}>
            <Link href="/guide/therapist-salary" className={밑줄}>공공병원 {모두.length}곳의 표 전체 보기</Link>
          </p>
        </section>

        {이웃.length > 0 && (
          <section aria-labelledby="병원-이웃" className="flex flex-col gap-(--rapo-dimension-x4)">
            <h2 id="병원-이웃" className={작은제목}>{h.시도} 지역의 다른 공공병원</h2>
            <ul className="grid gap-(--rapo-dimension-x2) md:grid-cols-2">
              {이웃.map((x) => (
                <li key={x.슬러그}
                  className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)">
                  <Link href={`/guide/therapist-salary/${x.슬러그}`} className={`rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral) ${밑줄}`}>{x.이름}</Link>
                  <p className={도움말}>{값이름(x)} <span className="whitespace-nowrap tabular-nums">{만(값(x))}만 원</span></p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="병원-주의" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="병원-주의" className={작은제목}>숫자를 볼 때 알아 둘 것</h2>
          <p className={본문}>
            평균에는 경력이 많은 직원도 들어 있어요. 실제 보수는 경력과 수당에 따라 달라서, 지원할 때는 채용 공고문의 보수 안내를 꼭 확인하세요.
          </p>
        </section>

        <section aria-labelledby="병원-라포" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="병원-라포" className={작은제목}>채용 공고는 RAPO에서</h2>
          <p className={본문}>
            RAPO(라포)는 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트예요. 공공기관·대학병원·종합병원 공고를 중심으로 모아요.
          </p>
          <RapoButton href="/jobs" full className={단추폭}>RAPO 채용 공고 보기</RapoButton>
        </section>

        <OtherGuides 지금={`/guide/therapist-salary/${h.슬러그}`} />

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          숫자는{' '}
          {h.갈래 === '알리미'
            ? <a href="https://rhs.mohw.go.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>지역거점공공병원 알리미</a>
            : <a href="https://www.alio.go.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>알리오</a>}
          에 공시된 값을 옮긴 것이에요. RAPO는 이 병원과 제휴 관계가 아니에요.
          공시와 다른 곳이 있으면 <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
        </p>
      </main>
    </div>
  );
}
