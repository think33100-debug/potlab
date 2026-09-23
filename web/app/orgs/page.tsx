import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Hit } from '@/components/hit';
import { OrgDetail } from '@/components/org-detail';
import { OrgSearch } from '@/components/org-search';
import { iconMap } from '@/lib/icons';
import { orgPublic, place, TILE_NAME, type OrgFacets } from '@/lib/org';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/* 병원정보 찾기.

   목록과 상세를 한 주소에서 다룹니다 — 기관 이름에 빗금·물음표가 들어간 곳이
   있고(10곳), 같은 이름이 자료 두 곳에 있는 경우도 있어서
   주소 조각(/orgs/이름)으로는 가리키기가 어렵습니다. */

async function facets(): Promise<OrgFacets> {
  const { data } = await supabase.rpc('org_facets');
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
  const o = await orgPublic(org, sido);
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

  const [f, icons] = await Promise.all([facets(), iconMap('병원정보 · 종별')]);

  return (
    <div className="bg-[#F4F4F1]">
      <main className="mx-auto w-full max-w-2xl px-6 pt-6 pb-[88px] md:px-7">
        <Hit kind="orgs" />
        <OrgSearch facets={f} icons={icons} />
      </main>
    </div>
  );
}
