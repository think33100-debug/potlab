import Link from 'next/link';
import { Icon } from '@/components/icon';

/* 「회원만 볼 수 있어요」 카드 한 벌.

   공고 목록 · 병원정보 목록이 같이 씁니다. 두 벌로 두면 다음에 문구를
   고칠 때 한쪽만 고치게 됩니다.

   ※ 이건 **안내**입니다. 막는 자리는 DB 입니다 —
     공고 목록은 job_list() 가, 병원정보는 실행 권한이 막습니다.
     화면만 가리면 요청을 직접 만들어 뚫립니다 (그게 2026-09-25 전 상태였습니다). */
export function MembersOnly({
  title, body, note,
}: { title: React.ReactNode; body: string; note?: string }) {
  return (
    <section className="mt-7 flex flex-col items-center rounded-[14px] border border-[#E3E3DE]
                        bg-white px-6 py-8 text-center">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[#14181C]">
        <Icon name="lock" size={22} className="text-white" />
      </span>

      <h2 className="mt-4 break-keep text-[22px] font-black leading-[1.35] text-[#14181C]">
        {title}
      </h2>

      <p className="mt-3 max-w-[20rem] break-keep text-[14px] leading-[1.7] text-[#4A5056]">
        {body}
      </p>

      {/* 빨강 위 흰 글자는 16px 이상 굵게만 — #FF3B30 위에서 3.55:1 입니다 */}
      <Link
        href="/login"
        className="mt-6 flex h-[54px] w-full max-w-[22rem] items-center justify-center
                   rounded-[12px] bg-[#FF3B30] text-[16px] font-bold text-white
                   transition-transform duration-[120ms] active:translate-y-[2px]
                   active:scale-[0.99] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)]
                   motion-reduce:transition-none"
      >
        가입하고 전부 보기
      </Link>

      <p className="mt-3 break-keep text-[12px] text-[#5F666C]">
        {note ?? '카카오 · 네이버로 3초 만에 시작해요'}
      </p>
    </section>
  );
}
