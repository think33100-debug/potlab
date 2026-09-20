import Link from 'next/link';

/* 아직 안 만든 화면 셋이 같이 쓰는 자리입니다 (월급 확인 · 스펙쌓기 · 병원정보 찾기).
   홈의 카테고리가 여기로 보냅니다 — 없는 주소로 보내 404 를 내지 않으려고요.

   화면이 생기면 lib/routes.ts 의 표에서 그 줄만 지우면 됩니다. */

const WHAT: Record<string, { emoji: string; title: string; line: string }> = {
  pay:  { emoji: '💰', title: '월급 확인', line: '회원들이 올린 초임과 실수령액을 모으고 있어요' },
  spec: { emoji: '📚', title: '스펙쌓기', line: '학점·자격증·실습을 또래와 견줘볼 수 있게 준비하고 있어요' },
  orgs: { emoji: '🏥', title: '병원정보 찾기', line: '병원 62,749곳의 종별·병상·치료사 수를 찾아볼 수 있게 준비하고 있어요' },
};

export default async function Soon({
  searchParams,
}: { searchParams: Promise<{ what?: string }> }) {
  const { what } = await searchParams;
  const w = WHAT[what ?? ''] ?? { emoji: '🌱', title: '준비 중', line: '' };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-8 pb-[88px] text-center md:px-7 md:pb-8">
      <span className="text-[56px]" aria-hidden>{w.emoji}</span>
      <h1 className="mt-5 text-h2 font-bold">{w.title}</h1>
      <p className="mt-2 text-h3 font-bold text-brand-red">곧 찾아올게요</p>
      {w.line && <p className="mt-5 text-lg text-gray-500">{w.line}</p>}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Link
          href="/jobs"
          className="rounded-md bg-brand-red px-7 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]"
        >
          채용공고 보기
        </Link>
        <Link
          href="/community"
          className="rounded-md border border-gray-200 px-7 py-5 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
        >
          커뮤니티 가기
        </Link>
      </div>
    </main>
  );
}
