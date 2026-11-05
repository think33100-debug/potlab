import Link from 'next/link';
import { PAY_PREREG } from '@/lib/pay-prereg';

/* 월급 확인. 11월에는 연봉 통계를 공개하지 않아 준비 안내만 둡니다.

   통계를 부르지 않고, 아무것도 입력받거나 저장하지 않습니다.
   계산기는 통계와 상관없이 쓸 수 있어 입구를 남깁니다. */
export default function PayPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">월급 확인</h1>

      <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="break-keep text-h3 font-bold">{PAY_PREREG.title}</h2>
        <p className="mt-2 break-keep text-lg text-mute">{PAY_PREREG.body}</p>
        <p className="mt-2 break-keep text-sm text-mute">{PAY_PREREG.note}</p>
      </section>

      <Link
        href="/tools"
        className="mt-7 flex items-center justify-between gap-3 rounded-sm
                   border border-gray-200 px-6 py-5 hover:bg-gray-50
                   dark:border-gray-700 dark:hover:bg-gray-950"
      >
        <span className="min-w-0">
          <span className="block break-keep text-body-lg font-bold">계산기 보기</span>
          <span className="mt-1 block break-keep text-sm text-mute">
            세전·세후 · 퇴직금 · 연차. 로그인 없이 쓸 수 있어요
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-mute">→</span>
      </Link>
    </main>
  );
}
