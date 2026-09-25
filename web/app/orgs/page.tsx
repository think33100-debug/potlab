import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Hit } from '@/components/hit';
import { OrgDetail } from '@/components/org-detail';
import { OrgSearch } from '@/components/org-search';
import { iconMap } from '@/lib/icons';
import { MembersOnly } from '@/components/members-only';
import { orgPublic, ourNumbers, place, TILE_NAME, type OrgFacets } from '@/lib/org';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 병원정보 찾기.

   목록과 상세를 한 주소에서 다룹니다 — 기관 이름에 빗금·물음표가 들어간 곳이
   있고(10곳), 같은 이름이 자료 두 곳에 있는 경우도 있어서
   주소 조각(/orgs/이름)으로는 가리키기가 어렵습니다. */

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
      title: '병원정보 찾기 · POTJOB',
      description: '치료사가 일하는 곳을 이름·종별·지역으로 찾아봐요',
    };
  }
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;
  /* 회원이 공유한 링크면 제목이 제대로 붙고, 아니면 이름만 붙습니다 —
     기관 자료는 회원만 읽을 수 있습니다 */
  const o = await orgPublic(await serverSupabase(), org, sido);
  if (!o) return { title: `${org} · POTJOB` };

  const desc = [TILE_NAME[o.tile] ?? '기관', place(o.sido_std, o.sgg_std)]
    .filter(Boolean).join(' · ');
  return {
    title: `${o.name} · POTJOB`,
    description: desc,
    openGraph: { title: o.name, description: desc, type: 'article' },
  };
}

export default async function OrgsPage({ searchParams }: PageProps<'/orgs'>) {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;

  if (org) {
    return (
      <div className="bg-[#F4F4F1]">
        {/* 하단 고정 줄(50px) + 탭바(62px) 위로 올라오게 아래를 비웁니다 */}
        <main className="mx-auto w-full max-w-2xl px-6 pt-4 pb-[152px] md:px-7 md:pb-[96px]">
          <Hit kind="org" target={org} />
          <Suspense fallback={<p className="text-[15px] text-[#5F666C]">불러오는 중이에요…</p>}>
            <OrgDetail name={org} sido={sido} />
          </Suspense>
        </main>
      </div>
    );
  }

  const sb = await serverSupabase();
  /* 세 값입니다 — 회원 · 비회원 · 모름.
     「모름」(물어봤는데 답을 못 받음)일 때 가입 권유를 그리면,
     회원에게 「가입하고 전부 보기」 가 뜹니다 (2026-09-25에 실제로 났습니다) */
  const who = await serverWho(sb);

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

  const [f, icons] = await Promise.all([facets(sb), iconMap('병원정보 · 종별')]);

  return (
    <div className="bg-[#F4F4F1]">
      <main className="mx-auto w-full max-w-2xl px-6 pt-6 pb-[88px] md:px-7">
        <Hit kind="orgs" />
        <OrgSearch facets={f} icons={icons} />
      </main>
    </div>
  );
}
