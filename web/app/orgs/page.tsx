import type { Metadata } from 'next';
import Link from 'next/link';
import { Hit } from '@/components/hit';
import { RapoOrgBoard } from '@/components/rapo/rapo-org-board';
import { OrgSearch } from '@/components/org-search';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { MembersOnly } from '@/components/members-only';
import { orgPublic, ourNumbers, place, TILE_NAME, type OrgFacets } from '@/lib/org';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 병원정보 찾기.

   목록과 상세를 한 주소에서 다룹니다 — 기관 이름에 빗금·물음표가 들어간 곳이
   있고(10곳), 같은 이름이 자료 두 곳에 있는 경우도 있어서
   주소 조각(/orgs/이름)으로는 가리키기가 어렵습니다.

   ── 새 디자인 (2026-11-12) ──
   목록은 「병원 찾기」 1328:2689 의 어두운 판(자기 앱 바 · 어두운 하단 탐색) — components/org-search.tsx 머리.
   기관 상세(?org=)는 「병원 게시판」(1328:2695) 어두운 판입니다 — components/rapo/rapo-org-board.tsx 머리 (2026-11-12 세중님 「다 피그마 기준」).
   전의 기관 정보 화면(components/org-detail.tsx)은 쓰지 않지만 지우지 않았습니다. */

/* 원본 「RAPO / App Bar」 어두운 판 — #0d1d29 · 56 높이 · 뒤로 20 · 제목 18 Bold #f6f8fa */
function 어두운앱바() {
  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-center gap-(--rapo-dimension-x1) bg-[#0d1d29] px-(--rapo-dimension-x2)">
      <Link href="/" aria-label="뒤로"
        className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/orgs/back-20.svg" alt="" width={20} height={20} />
      </Link>
      <h1 className="min-w-0 flex-1 text-[18px] font-bold leading-[26px] text-[#f6f8fa]">병원 찾기</h1>
    </header>
  );
}

/* 거르기 목록도 회원만입니다 (2026-09-25 · org_facets 의 실행 권한을 걷었습니다).
   로그인 안 한 분에게는 빈 것이 오고, 아래에서 가입 권유를 그립니다 */
async function facets(sb: Awaited<ReturnType<typeof serverSupabase>>): Promise<OrgFacets> {
  const { data } = await sb.rpc('org_facets');
  return (data as OrgFacets | null)
    ?? { tiles: {}, sidos: [], sggs: {}, total: 0 };
}

export async function generateMetadata({ searchParams }: PageProps<'/orgs'>): Promise<Metadata> {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  if (!org) {
    return {
      title: '병원정보 찾기 · RAPO',
      description: '치료사가 일하는 곳을 이름·종별·지역으로 찾아봐요',
    };
  }
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;
  /* 회원이 공유한 링크면 제목이 제대로 붙고, 아니면 이름만 붙습니다 —
     기관 자료는 회원만 읽을 수 있습니다 */
  const o = await orgPublic(await serverSupabase(), org, sido);
  if (!o) return { title: `${org} · RAPO` };

  const desc = [TILE_NAME[o.tile] ?? '기관', place(o.sido_std, o.sgg_std)]
    .filter(Boolean).join(' · ');
  return {
    title: `${o.name} · RAPO`,
    description: desc,
    openGraph: { title: o.name, description: desc, type: 'article' },
  };
}

export default async function OrgsPage({ searchParams }: PageProps<'/orgs'>) {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;

  if (org) {
    /* 병원 이름이 자료에 있는지만 봅니다(없으면 책갈피를 안 그리고 안내 한 줄). 회원만 읽히는 창구라 비회원은 문지기에서 이미 로그인으로 갑니다 */
    const 있나 = !!(await orgPublic(await serverSupabase(), org, sido));
    const 탭 = sp.tab === 'review' ? 'review' : 'talk';
    return (
      <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: '#112332' }}>
        <Hit kind="org" target={org} />
        <RapoOrgBoard name={org} sido={sido} 탭={탭} 있나={있나} />
        <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
        <RapoBottomNav current="/community" dark />
      </div>
    );
  }

  const sb = await serverSupabase();
  /* 세 값입니다 — 회원 · 비회원 · 모름.
     「모름」(물어봤는데 답을 못 받음)일 때 가입 권유를 그리면,
     회원에게 「가입하고 전부 보기」 가 뜹니다 (2026-09-25에 실제로 났습니다) */
  const who = await serverWho(sb);

  /* 「모름」은 **빈 화면**입니다 — 공고 상세와 같은 방향 (2026-09-25).
     전에는 회원 쪽으로 넘겨 자료가 빈 채로 그려졌습니다. 그러면
     「찾는 결과가 없습니다」처럼 보여, 없는 사실을 지어내는 꼴이 됩니다.
     같은 함수를 쓰는 세 곳이 막힐 때 가는 방향이 달랐습니다. 한쪽으로 맞췥니다 */
  if (who === '모름') return null;

  if (who === '비회원') {
    return (
      <div className="bg-[#F4F4F1]">
        <main className="mx-auto w-full max-w-2xl px-6 pt-6 pb-[88px] md:px-7">
          <Hit kind="orgs" />
          <h1 className="break-keep text-h1 font-bold text-[#14181C]">병원정보 찾기</h1>
          <p className="mt-2 break-keep text-lg text-[#5F666C]">
            치료사가 일하는 곳을 이름 · 종별 · 지역으로 찾아봐요
          </p>
          {/* 곳 수는 지어내지 않고 실제로 셉니다 — org_total 은 줄이 안 나가서
              로그인 없이도 부를 수 있게 열어뒀습니다 */}
          <MembersOnly
            title={<>병원정보는<br />회원만 볼 수 있어요</>}
            body={`치료사가 일하는 곳 ${(await ourNumbers()).orgs.toLocaleString('ko-KR')} 곳. 인원 · 병상 · 얼마나 바쁜 곳인지까지 찾아볼 수 있어요.`}
            진단="app/orgs/page.tsx · 서버(serverWho)"
          />
        </main>
      </div>
    );
  }

  const f = await facets(sb);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-[#112332]">
      <어두운앱바 />
      <main className="px-[22px] pb-(--rapo-dimension-x6) pt-[15px]">
        <Hit kind="orgs" />
        <OrgSearch facets={f} />
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" dark />
    </div>
  );
}
