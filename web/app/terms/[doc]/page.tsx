import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TERMS, TERMS_VERSION, type TermKey } from '@/lib/terms';

export function generateStaticParams() {
  return Object.keys(TERMS).map((doc) => ({ doc }));
}

export default async function TermsPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const t = TERMS[doc as TermKey];
  if (!t) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 md:px-7">
      <Link href="/welcome" className="text-lg text-interaction-blue hover:underline">← 돌아가기</Link>

      <h1 className="mt-6 text-h2 font-bold">{t.title}</h1>
      <p className="mt-1 text-sm text-gray-400">{TERMS_VERSION} 판</p>

      {t.draft && (
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
