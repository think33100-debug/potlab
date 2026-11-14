import Link from 'next/link';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { 공시해, 공시확인일, 만, 병원정보, 셈, 알리미, 알리오 } from '@/lib/guide-pay';
import { 색인메타 } from '@/lib/seo';
import { 그림판 } from '@/lib/site-url';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { OtherGuides, 단추폭, 도움말, 밑줄, 본문, 작은제목, 점붙임 } from '../guide-parts';

/* 연봉 안내 글 (2026-11-13 세중님 키워드 「물리치료사연봉 · 작업치료사연봉」 · 「공시 급여로 만들어」).

   검색으로 들어오는 분을 위한 글입니다 — 다른 안내 글과 같이 앱 메뉴에 걸지 않고 사이트맵에만 올립니다 (lib/seo.ts 안내글들).

   ── 무엇을 싣나 ────────────────────────────────────────────
   공공병원이 스스로 공시한 숫자만 싣습니다 (lib/guide-pay.ts · 운영 DB 「병원보수」 표에서 뽑은 그대로).
   공고 상세 「이 병원 연봉」(components/rapo/rapo-job-detail.tsx 연봉칸)과 같은 자료 · 같은 말입니다 —
     알리미  「보건직 평균」(치료사·방사선사 같은 의료기사 직종의 평균) · 「신입 평균」(모든 직종 신입의 평균)
     알리오  「신입 초임」(대졸 신입 기준)
   의사가 든 전체 평균과 국민연금 추정값은 싣지 않습니다 (세중님 11/12 「높은 평균들 빼고 보건직·신입만」).

   ── 적는 규칙 ──────────────────────────────────────────────
   · **치료사만의 연봉이 아니라는 것**을 맨 위에 밝힙니다. 숫자를 「물리치료사 평균 연봉」처럼 부르지 않습니다.
   · 범위·가운데 값은 이 표의 숫자로 여기서 셉니다 (적어 두지 않습니다 — 표가 바뀌면 같이 바뀌게).
   · 숫자와 단위는 한 줄에 둡니다 (RAPO노트/화면표시_규칙_1113.md 1번). 표는 360·375 폭에서 넘치지 않게 재고 올립니다.
   · 표의 병원 이름을 누르면 그 병원 쪽([slug]/page.tsx)으로 갑니다 (2026-11-13 세중님 「거창적십자병원 연봉 이런 식으로」). */

const 제목 = `물리치료사·작업치료사 연봉, 공공병원 공시로 보기 | ${공시해}년 보건직 평균·신입 초임`;
const 설명 = `물리치료사·작업치료사 연봉이 궁금할 때 볼 공공병원 공시 자료예요. 지방의료원·적십자병원 ${알리미.length}곳의 보건직 평균 연봉과 국립대병원 등 ${알리오.length}곳의 신입 초임(${공시해}년)을 병원별로 정리했어요.`;

export const metadata = {
  title: 제목,
  description: 설명,
  robots: 색인메타,
  alternates: { canonical: '/guide/therapist-salary' },
  openGraph: { type: 'article', siteName: 'RAPO', title: 제목, description: 설명, images: [`/api/og/site?v=${그림판}`] },
};

const 보건직셈 = 셈(알리미.map((r) => r[1]));
const 초임셈 = 셈(알리오.map((r) => r[1]));

const 한눈에 = [
  { 머리: `지방의료원·적십자병원 ${알리미.length}곳`, 무엇: '보건직 평균', 셈: 보건직셈 },
  { 머리: `국립대병원·공공기관 ${알리오.length}곳`, 무엇: '신입 초임', 셈: 초임셈 },
];

const 주의 = [
  '평균에는 경력이 많은 직원도 들어 있어요. 새로 들어가는 사람의 연봉은 이보다 낮을 수 있어요.',
  '치료사만의 값이 아니에요. 같은 직종으로 묶인 다른 직군과 섞여 있어요.',
  '실제 보수는 병원·경력·수당에 따라 달라요. 지원할 때는 채용 공고문의 보수 안내를 꼭 확인하세요.',
];

const 머리칸 = 'rapo-type-t3-regular py-(--rapo-dimension-x2) font-normal text-(color:--rapo-color-fg-neutral-muted)';
const 이름칸 = 'rapo-type-t4-regular break-keep py-(--rapo-dimension-x3) pr-(--rapo-dimension-x2) text-left font-normal text-(color:--rapo-color-fg-neutral)';
const 숫자칸 = 'whitespace-nowrap py-(--rapo-dimension-x3) pl-(--rapo-dimension-x3) text-right tabular-nums';
const 줄선 = 'border-b border-(color:--rapo-color-stroke-neutral-muted)';

function Amount({ 원, 굵게 = false }: { 원: number | null; 굵게?: boolean }) {
  if (원 == null) return <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)" aria-label="값 없음">–</span>;
  return (
    <span className={굵게 ? 'rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)' : 'rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)'}>
      {만(원)}만 원
    </span>
  );
}

export default async function TherapistSalaryGuide() {
  const who = await serverWho(await serverSupabase());

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">
            물리치료사·작업치료사 연봉, 공공병원 공시로 보기
          </h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {점붙임(`${공시해}년 공시 자료 · ${공시확인일} 확인`)}
          </p>
          <p className={본문}>
            물리치료사·작업치료사 연봉이 궁금할 때 참고할 수 있는 숫자를 모았어요. 공공병원이 스스로 공시한 보수 자료예요.
          </p>
          <p className="rapo-type-t4-medium break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-brand-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-brand-contrast)">
            {/* 낫표로 묶은 말은 조사까지 한 덩이로 — 390 폭에서 「」은」이 줄 머리로 넘어갔습니다 */}
            치료사만 따로 낸 연봉은 아니에요. <span className="whitespace-nowrap">「보건직 평균」은</span> 치료사나 방사선사 같은 의료기사 직종 전체의 평균이고,{' '}
            <span className="whitespace-nowrap">「신입」 값은</span> 직군을 나누지 않은 값이에요.
          </p>
        </section>

        <section aria-labelledby="연봉-한눈" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="연봉-한눈" className={작은제목}>한눈에 보기</h2>
          {/* 큰 화면(768 이상)에서는 두 칸을 나란히 (2026-11-13 세중님 「피씨 모드는 어색」) */}
          <ul className="grid gap-(--rapo-dimension-x3) md:grid-cols-2">
            {한눈에.map((c) => (
              <li key={c.머리}
                className="flex flex-col gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
                <p className="rapo-type-t4-medium break-keep text-(color:--rapo-color-fg-neutral-muted)">{c.머리}{'\u00a0'}· {c.무엇}</p>
                <p className="rapo-type-t8-bold whitespace-nowrap tabular-nums text-(color:--rapo-color-fg-neutral)">
                  {만(c.셈.낮)}만~{만(c.셈.높)}만 원
                </p>
                <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">
                  가운데 값 <span className="whitespace-nowrap tabular-nums">{만(c.셈.가운데)}만 원</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="연봉-의료원" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="연봉-의료원" className={작은제목}>지방의료원·적십자병원 {알리미.length}곳 연봉</h2>
          <p className={본문}>보건직 평균이 높은 차례로 적었어요.</p>
          {/* 큰 화면에서 표가 글 기둥 끝까지 늘어나면 이름과 금액이 너무 멀어집니다 — 560 까지만 */}
          <table className="w-full border-collapse md:max-w-[560px]">
            <caption className="sr-only">지방의료원·적십자병원의 보건직 평균과 신입 평균 ({공시해}년 공시)</caption>
            <thead>
              <tr className={줄선}>
                <th scope="col" className={`${머리칸} text-left`}>병원</th>
                <th scope="col" className={`${머리칸} whitespace-nowrap pl-(--rapo-dimension-x3) text-right`}>보건직 평균</th>
                <th scope="col" className={`${머리칸} whitespace-nowrap pl-(--rapo-dimension-x3) text-right`}>신입 평균</th>
              </tr>
            </thead>
            <tbody>
              {알리미.map(([이름, 보건직, 신입]) => (
                <tr key={이름} className={줄선}>
                  <th scope="row" className={이름칸}><Link href={`/guide/therapist-salary/${병원정보[이름].슬러그}`} className={밑줄}>{이름}</Link></th>
                  <td className={숫자칸}><Amount 원={보건직} 굵게 /></td>
                  <td className={숫자칸}><Amount 원={신입} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={도움말}>
            정부 데이터를 기반으로 한 연봉이에요. 연차에 따라 다를 수 있어요.
            보건직 평균은 치료사나 방사선사 같은 의료기사 직종의 평균이고, 신입 평균은 모든 직종 신입의 평균이에요.
            제주의료원의 신입 평균은 값을 확인하지 못해 비워 두었어요.
          </p>
        </section>

        <section aria-labelledby="연봉-국립대" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="연봉-국립대" className={작은제목}>국립대병원·공공기관 {알리오.length}곳 신입 초임</h2>
          <p className={본문}>신입 초임이 높은 차례로 적었어요.</p>
          {/* 큰 화면에서 표가 글 기둥 끝까지 늘어나면 이름과 금액이 너무 멀어집니다 — 560 까지만 */}
          <table className="w-full border-collapse md:max-w-[560px]">
            <caption className="sr-only">국립대병원·공공기관의 신입 초임 ({공시해}년 결산 공시)</caption>
            <thead>
              <tr className={줄선}>
                <th scope="col" className={`${머리칸} text-left`}>기관</th>
                <th scope="col" className={`${머리칸} whitespace-nowrap pl-(--rapo-dimension-x3) text-right`}>신입 초임</th>
              </tr>
            </thead>
            <tbody>
              {알리오.map(([이름, 초임]) => (
                <tr key={이름} className={줄선}>
                  <th scope="row" className={이름칸}><Link href={`/guide/therapist-salary/${병원정보[이름].슬러그}`} className={밑줄}>{이름}</Link></th>
                  <td className={숫자칸}><Amount 원={초임} 굵게 /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={도움말}>
            정부 데이터를 기반으로 한 연봉이에요. 연차에 따라 다를 수 있어요.
            신입 초임은 대졸 신입 기준이고 직군을 나누지 않은 값이에요.
            근로복지공단·한국보훈복지의료공단·대한적십자사는 병원별이 아니라 기관 전체로 공시돼요.
          </p>
        </section>

        <section aria-labelledby="연봉-주의" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="연봉-주의" className={작은제목}>숫자를 볼 때 알아 둘 것</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x2)">
            {주의.map((x) => (
              <li key={x} className="rapo-type-article-body flex gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
                <span aria-hidden className="shrink-0 text-(color:--rapo-color-fg-neutral-muted)">·</span>
                <span className="min-w-0 flex-1 break-keep">{x}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="연봉-라포" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="연봉-라포" className={작은제목}>공고와 함께 보려면</h2>
          <p className={본문}>
            RAPO(라포)는 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트예요.
            공시 자료가 있는 병원은 공고 화면에서 그 병원의 연봉을 함께 볼 수 있어요.
          </p>
          <RapoButton href="/jobs" full className={단추폭}>RAPO 채용 공고 보기</RapoButton>
          {/* 홈 「공시 병원 급여」가 이 글로 오므로(2026-11-13), 전에 그 칸이 가던 병원 찾기를 여기서 잇습니다 */}
          <RapoButton href="/orgs" tone="outline" full className={단추폭}>병원별로 찾아보기</RapoButton>
        </section>

        <OtherGuides 지금="/guide/therapist-salary" />

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          숫자는{' '}
          <a href="https://rhs.mohw.go.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>지역거점공공병원 알리미</a>와{' '}
          <a href="https://www.alio.go.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>알리오</a>에 공시된 값을 옮긴 것이에요.
          공시와 다른 곳이 있으면 <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
        </p>
      </main>
    </div>
  );
}
