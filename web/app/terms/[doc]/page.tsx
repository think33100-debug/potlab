import Link from 'next/link';
import { notFound } from 'next/navigation';
import { 색인메타 } from '@/lib/seo';
import { TERMS, TERMS_VERSION, 초안띠보이나, type TermKey } from '@/lib/terms';

export function generateStaticParams() {
  return Object.keys(TERMS).map((doc) => ({ doc }));
}

/* ★ 2026-11-02 — 「초안입니다」 띠가 **시행일 00:00(KST)에 저절로 사라지게** 하려면
   이 쪽이 그 시각 뒤에 한 번은 다시 그려져야 합니다. 그대로 두면 **빌드 때 값이
   굳어** 11/10 이 지나도 띠가 남습니다 (배포를 다시 할 때까지).
   그래서 30분마다 다시 그리게 합니다 — 늦어도 00:30 에는 사라집니다.
   쪽은 글만 있는 정적 쪽이라 30분 간격이 부담이 되지 않습니다 */
export const revalidate = 1800;

/* 검색엔진에 올리는 쪽입니다 (2026-11-13 세중님 「검색 가능하게」 · lib/seo.ts 색인길과 짝) */
export const metadata = { robots: 색인메타 };

export default async function TermsPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const t = TERMS[doc as TermKey];
  if (!t) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Link href="/welcome" className="text-lg text-interaction-blue hover:underline">← 돌아가기</Link>

      <h1 className="mt-6 text-h2 font-bold">{t.title}</h1>
      <p className="mt-1 text-sm text-mute">{TERMS_VERSION} 판</p>

      {t.draft && 초안띠보이나() && (
        <p className="mt-6 rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          초안입니다. 법률 검토를 받기 전이라 문구가 바뀔 수 있습니다
        </p>
      )}

      <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-gray-700 dark:text-gray-300">
        {t.body}
      </p>
    </main>
  );
}
