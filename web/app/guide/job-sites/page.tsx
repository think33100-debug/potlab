import Link from 'next/link';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoGuideRow } from '@/components/rapo/rapo-job-detail';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { 색인메타 } from '@/lib/seo';
import { 그림판 } from '@/lib/site-url';
import { supabase } from '@/lib/supabase';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 채용 사이트 비교 글 (2026-11-13 세중님 「땡큐오티와 굿잡피티 그리고 우리를 비교하는 글을 적어서 넣자」).

   검색으로 들어오는 분을 위한 글입니다 — 앱 메뉴 어디에도 걸지 않고 사이트맵에만 올립니다 (lib/seo.ts 안내글길).
   숨긴 글이 아닙니다: 주소로 오면 누구나 같은 글을 봅니다 (lib/beta.ts 비회원길 · 검색 로봇도 같은 글).

   ── 적는 규칙 ──────────────────────────────────────────────
   · 다른 사이트 이야기는 **그 사이트가 첫 화면에 공개한 소개 글**에 있는 것만 적습니다. 평가·순위는 매기지 않습니다.
   · 우리 이야기도 확인한 것만 적고, 숫자에는 날짜를 붙입니다.
   · 남의 로고·글을 가져오지 않습니다. 제휴가 아니라는 것과 고쳐 달라고 할 곳(문의하기)을 밝힙니다.
   · 내용을 고치면 기준일도 같이 고칩니다.

   피그마에 이 화면은 없습니다 — 글 화면 틀(app/terms/[doc] · 화면 제목 26/35 · 본문 16/24)과
   홈의 위쪽 줄(RapoHeader) · 공고 상세의 이름-값 줄(RapoGuideRow)을 빌렸습니다. */

const 기준일 = '2026년 11월 13일';
const 제목 = '땡큐오티·굿잡피티·RAPO 비교 | 물리치료사·작업치료사 취업 사이트';
const 설명 = '물리치료사·작업치료사 취업 사이트 세 곳(땡큐오티·굿잡피티·RAPO)을 대상과 다루는 내용으로 나란히 정리했어요. 각 사이트가 공개한 소개 글 기준이에요.';

export const metadata = {
  title: 제목,
  description: 설명,
  robots: 색인메타,
  alternates: { canonical: '/guide/job-sites' },
  openGraph: { type: 'article', siteName: 'RAPO', title: 제목, description: 설명, images: [`/api/og/site?v=${그림판}`] },
};

/* 「대상」·「다루는 것」 — 땡큐오티·굿잡피티는 각 사이트 첫 화면의 소개 글(2026-11-13 확인)을 풀어 적은 것입니다 */
const 사이트들 = [
  { 이름: '땡큐오티', 대상: '작업치료사 · 작업치료 학생', 다루는것: '취업 정보 · 교육 · 커뮤니티',
    주소: 'https://www.thankyouot.com/', 보임: 'thankyouot.com' },
  { 이름: '굿잡피티', 대상: '물리치료사 · 물리치료 학생', 다루는것: '채용 정보 · 교육 정보 · 병원 리뷰 · 취업 후기 · 커뮤니티',
    주소: 'https://www.goodjobpt.com/', 보임: 'goodjobpt.com' },
  { 이름: 'RAPO(라포)', 대상: '물리치료사 · 작업치료사', 다루는것: '공공기관·대학병원·종합병원 채용 공고 · 병원 정보 · 커뮤니티',
    주소: '/', 보임: 'rapojob.co.kr' },
];

const 다른점: [string, string][] = [
  ['물리치료사와 작업치료사 공고를 한곳에서',
    '두 직군의 채용 공고를 함께 모아요. 직군과 지역으로 골라 볼 수 있어요.'],
  ['공공기관·대학병원·종합병원 공고를 빠짐없이',
    '기관 홈페이지와 공공 채용 포털(고용24·알리오·나라일터 등)에 올라온 공고를 모아, 마감일·지역·고용형태를 한눈에 정리해요. 빠짐없이 모으는 것이 목표예요.'],
  ['공고 옆에 병원 정보',
    '병상 수, 재활의학과 전문의 수, 치료사 인원처럼 건강보험심사평가원이 공개한 자료를 공고와 함께 보여 드려요.'],
];

/* 지금 마감 전 공고 수 — 사이트맵과 같은 창구(sitemap_jobs · 비회원 열쇠)로 셉니다. 줄은 안 받고 수만 받습니다.
   적어 둔 숫자는 하루에도 바뀌어 틀린 값이 되므로 열 때마다 셉니다. 못 세면 그 줄을 뺍니다 */
async function 공고수(): Promise<number | null> {
  const { count, error } = await supabase.rpc('sitemap_jobs', undefined, { head: true, count: 'exact' });
  return error || count == null ? null : count;
}

const 맞는곳: [string, string][] = [
  ['작업치료 분야의 교육·커뮤니티 정보를 함께 찾는다면', '땡큐오티'],
  ['물리치료 분야의 병원 리뷰·취업 후기를 함께 보고 싶다면', '굿잡피티'],
  ['공공기관·대학병원·종합병원 공고를 놓치고 싶지 않다면', 'RAPO'],
];

const 묻는말: [string, string][] = [
  ['땡큐오티나 굿잡피티 같은 사이트가 또 있나요?',
    '네, RAPO(라포)가 있어요. 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트로, 공공기관·대학병원·종합병원 공고를 중심으로 모아요.'],
  ['RAPO는 어떻게 이용하나요?',
    '지금은 테스트 기간이에요. 카카오·네이버·애플 계정으로 가입하면 공고를 모두 볼 수 있어요.'],
];

const 작은제목 = 'rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)';
const 본문 = 'rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)';
const 도움말 = 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)';
const 밑줄 = 'underline underline-offset-2';

export default async function JobSitesGuide() {
  const [who, 공고] = await Promise.all([serverWho(await serverSupabase()), 공고수()]);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">
            땡큐오티 · 굿잡피티 · RAPO, 무엇이 다를까요?
          </h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            취업 사이트 비교 · {기준일} 기준
          </p>
          <p className={본문}>
            물리치료사·작업치료사가 채용 공고를 찾을 때 쓰는 사이트 세 곳을 나란히 정리했어요.
            땡큐오티와 굿잡피티의 내용은 각 사이트가 공개한 소개 글을 바탕으로 적었고, 평가나 순위는 매기지 않았어요.
          </p>
        </section>

        <section aria-labelledby="비교-한눈" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="비교-한눈" className={작은제목}>한눈에 보기</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x3)">
            {사이트들.map((s) => (
              <li key={s.이름}
                className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
                <h3 className="rapo-type-t6-bold text-(color:--rapo-color-fg-neutral)">{s.이름}</h3>
                <RapoGuideRow label="대상">{s.대상}</RapoGuideRow>
                <RapoGuideRow label="다루는 것">{s.다루는것}</RapoGuideRow>
                <RapoGuideRow label="주소">
                  {s.주소.startsWith('/')
                    ? <Link href={s.주소} className={밑줄}>{s.보임}</Link>
                    : <a href={s.주소} target="_blank" rel="nofollow noopener noreferrer" className={밑줄}>{s.보임}</a>}
                </RapoGuideRow>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="비교-다른점" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="비교-다른점" className={작은제목}>RAPO는 이런 점이 달라요</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x4)">
            {다른점.map(([머리, 글]) => (
              <li key={머리} className="flex flex-col gap-(--rapo-dimension-x1)">
                <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{머리}</p>
                <p className={본문}>{글}</p>
              </li>
            ))}
            {공고 != null && 공고 > 0 && (
              <li className="flex flex-col gap-(--rapo-dimension-x1)">
                <p className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">지금 볼 수 있는 공고</p>
                <p className={본문}>
                  지금 마감 전 공고가 <span className="tabular-nums">{공고.toLocaleString('ko-KR')}</span>건 있어요.
                </p>
              </li>
            )}
          </ul>
          <RapoButton href="/jobs" full>RAPO 채용 공고 보기</RapoButton>
        </section>

        <section aria-labelledby="비교-맞는곳" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="비교-맞는곳" className={작은제목}>어떤 분께 어디가 맞을까요</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x3)">
            {맞는곳.map(([언제, 어디]) => (
              <li key={어디} className={본문}>
                {언제} <strong className="rapo-type-t5-bold">{어디}</strong>
              </li>
            ))}
          </ul>
          <p className={도움말}>여러 곳을 함께 쓰는 것도 좋은 방법이에요.</p>
        </section>

        <section aria-labelledby="비교-묻는말" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="비교-묻는말" className={작은제목}>자주 묻는 질문</h2>
          <dl className="flex flex-col gap-(--rapo-dimension-x4)">
            {묻는말.map(([묻, 답]) => (
              <div key={묻} className="flex flex-col gap-(--rapo-dimension-x1)">
                <dt className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{묻}</dt>
                <dd className={본문}>{답}</dd>
              </div>
            ))}
            <div className="flex flex-col gap-(--rapo-dimension-x1)">
              <dt className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">이 글의 내용이 실제와 다르면 어떻게 하나요?</dt>
              <dd className={본문}>
                <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
              </dd>
            </div>
          </dl>
        </section>

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          이 글은 각 사이트가 공개한 소개 글을 바탕으로 RAPO가 정리했어요. RAPO는 땡큐오티·굿잡피티와 제휴 관계가 아니에요.
        </p>
      </main>
    </div>
  );
}
