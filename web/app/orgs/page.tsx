import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OrgSearch } from '@/components/org-search';
import { OrgDetail } from '@/components/org-detail';

export const metadata: Metadata = {
  title: '병원정보 찾기 · POT JOB',
  description: '전국 기관을 이름·종별·지역으로 찾아보세요',
};

/* 병원정보 찾기.
   목록과 상세를 한 주소에서 다룹니다 — 기관 이름에 빗금·물음표가 들어간 곳이
   있고(10곳), 같은 이름이 자료 두 곳에 있는 경우도 있어서
   주소 조각(/orgs/이름)으로는 가리키기가 어렵습니다. */
export default async function OrgsPage({ searchParams }: PageProps<'/orgs'>) {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;

  if (org) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
        {/* 상세는 서버에서 그립니다 — 링크로 바로 열어도 내용이 담겨 나갑니다 */}
        <Suspense fallback={<p className="text-lg text-gray-500">불러오는 중이에요…</p>}>
          <OrgDetail name={org} sido={sido} />
        </Suspense>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">병원정보 찾기</h1>
      <Suspense fallback={<p className="mt-7 text-lg text-gray-500">불러오는 중이에요…</p>}>
        <OrgSearch />
      </Suspense>
    </main>
  );
}
