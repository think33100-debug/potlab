import type { Metadata } from 'next';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Suspense } from 'react';
import { 색인메타 } from '@/lib/seo';
import { 대표주소 } from '@/lib/site-url';
import { Hit } from '@/components/hit';
import { RapoHomeNotice } from '@/components/rapo/home-notice';
import { HomeU01 } from '@/components/rapo/home-u01';
import { RapoJobList, RapoJobsError, RapoJobsGuest, RapoJobsLoading } from '@/components/rapo/rapo-job-list';
import { getRapoHomeJobs } from '@/lib/rapo-home';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 탭 제목 — 서비스 이름은 RAPO 입니다. 다른 화면의 제목은 app/layout.tsx 가 정합니다 */
/* 검색엔진에 올리는 쪽입니다 (2026-11-13 세중님 「검색 가능하게」 · lib/seo.ts 색인길과 짝) */
export const metadata: Metadata = { title: 'RAPO · 채용공고', robots: 색인메타, alternates: { canonical: '/' } };

/* 홈 — 새 디자인 「U01 · 홈」 (2026-11-11 대표 지시: 실제 앱에 바로 적용).

   화면은 components/rapo/home-u01.tsx, 공고 줄은 lib/rapo-home.ts 가 냅니다.
   로그인 상태(회원·비회원·모름)에 따라 헤더 단추와 배너 글자, 공고 창구가 갈립니다.

   ── 「채용 공고」 칸의 네 상태 (2026-11-11 디자이너 검토) ─────────────
   공고를 받는 동안 화면 전체를 붙잡지 않습니다. 나머지 칸을 먼저 보내고
   공고 칸만 Suspense 로 늦게 채웁니다 —
     받는 중   RapoJobsLoading (원본 「채용 공고 / 로딩」)
     줄 있음   RapoJobList
     0건       RapoJobList 안의 「없음」 안내
     못 받음   RapoJobsError — 「다시 불러오기」가 이 칸만 다시 받습니다

   ── 전 홈에서 빠진 것 ──────────────────────────────────────────
   DB 배너·카테고리·큰배너(home_blocks) · 「더 찾아보기」 · 히어로 · 참여 현황 ·
   급여·취업 이야기 · 익명 · 이용 방법 · 마지막 CTA.
   코드는 지우지 않았습니다 — components/home/* · components/home-banner.tsx ·
   lib/home.ts 그대로이고, 되돌리려면 이 파일만 전 판으로 돌리면 됩니다
   (git log -- web/app/page.tsx). 관리자 화면의 홈 배너·글 고치기는 지금 홈에 안 보입니다.

   ── 아직 견본 글인 칸 ──────────────────────────────────────────
   「익명 질문과 답변」은 디자인 원본의 예시 글입니다(실제 회원 글 아님).
   「급여 공개 공고」·「신입 지원 공고」는 거르기가 아직 없어 공고 목록으로만 갑니다
   — 오픈 뒤에 넣을 기능입니다 (docs/rapo-design-implementation.md). */
const 사이트표 = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'RAPO',
  alternateName: ['라포'],
  url: `${대표주소}/`,
};

export default async function Home() {
  const sb = await serverSupabase();
  const who = await serverWho(sb);

  return (
    <>
      {/* 검색 결과에 사이트 이름을 「RAPO」로 띄워 달라는 표 (2026-11-13 · 구글 「사이트 이름」 안내의 WebSite 구조화 데이터).
          화면에는 안 보입니다. 이름은 RAPO · 한글로 찾는 분을 위해 「라포」를 다른 이름으로 둡니다 */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(사이트표) }} />
      <Hit kind="home" />
      {/* 「순차적으로 오픈 중」 안내 팝업 — 다시 보지 않기는 기기에 기억 (2026-11-12 세중님) */}
      <RapoHomeNotice />
      <HomeU01
        who={who}
        jobs={<Suspense fallback={<RapoJobsLoading />}><HomeJobs sb={sb} /></Suspense>}
      />
    </>
  );
}

async function HomeJobs({ sb }: { sb: SupabaseClient }) {
  const r = await getRapoHomeJobs(sb);
  return r.status === 'ok' ? <RapoJobList lists={r.lists} /> : r.status === 'guest' ? <RapoJobsGuest /> : <RapoJobsError />;
}
