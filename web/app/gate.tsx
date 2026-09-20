'use client';

import Link from 'next/link';
import { useAuth } from './auth';

/* 맛보기 규칙이 있는 한 곳.

   가입을 마친 사람(profiles.survey_at)만 전부 봅니다.
   아직 안 한 사람과 가입하다 만 사람은 맛보기 + 「회원가입 하고 전부 보기」.

   ※ 이건 잠금이 아니라 안내입니다. 공유 링크로 들어온 사람에게는 그 화면을
     통째로 보여줘야 해서(3단계) 서버에서 신분으로 막을 수가 없습니다.
     본문이 HTML 에 담겨 나가므로 개발자도구를 열면 다 보입니다.
     공고·글은 원래 누구나 읽는 것이라 그래도 됩니다 —
     정말 막아야 하는 것(급여 개별 금액·남의 스펙)은 DB 에서 막고 있습니다. */

export function useGate() {
  const { loading, session, me } = useAuth();
  return {
    loading,
    full: !!me?.survey_at,
    /* 가입하다 만 사람은 하던 단계로 돌아갑니다 — /welcome 이 어디까지
       했는지 보고 그 자리를 엽니다 (직군·역할까지 했으면 급여·스펙부터) */
    href: session ? '/welcome' : '/login',
    mid: !!session,
  };
}

/* 맛보기에서 잘라 보여주는 칸.

   글자를 잘라내지 않고 높이로 덮습니다. 이유 둘 —
   ① 본문이든 목록이든 같은 방법 하나로 됩니다.
   ② 가입을 마친 사람에게는 원본이 손도 안 댄 채로 갑니다.

   불러오는 중에는 안 자릅니다. 잘랐다가 펴면 화면이 튀는데,
   펴는 쪽(가입을 마친 사람)이 더 자주 옵니다. */
export function Clip({
  children, max = '20rem',
}: { children: React.ReactNode; max?: string }) {
  const { loading, full } = useGate();
  if (loading || full) return <>{children}</>;

  return (
    <div className="relative overflow-hidden" style={{ maxHeight: max }}>
      {children}
      {/* 아래로 갈수록 바탕색으로 사라지게 — 더 있다는 게 보여야 합니다 */}
      <div aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[8rem] bg-gradient-to-b from-transparent to-white dark:to-gray-900" />
    </div>
  );
}

/* 가입을 마친 사람에게만 보여주는 덩어리 (댓글처럼 통째로 가리는 자리) */
export function Members({ children }: { children: React.ReactNode }) {
  const { loading, full } = useGate();
  if (loading || full) return <>{children}</>;
  return null;
}

/* 「공고」 뒤에는 를, 「댓글」 뒤에는 을. 안 맞으면 대충 만든 티가 납니다 */
function eul(w: string) {
  const c = w.charCodeAt(w.length - 1);
  const 받침 = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return w + (받침 ? '을' : '를');
}

/* 화면 제일 아래 단추. 가입을 마친 사람에게는 안 보입니다 */
export function JoinCta({ what }: { what: string }) {
  const { loading, full, href, mid } = useGate();
  if (loading || full) return null;

  return (
    <section className="mt-7 rounded-sm border border-gray-200 p-6 text-center dark:border-gray-700">
      <p className="text-body-lg font-bold">여기까지만 보여요</p>
      <p className="mt-2 text-lg text-gray-500">
        가입하시면 {eul(what)} 전부 보실 수 있어요
      </p>
      <Link href={href}
        className="mt-6 inline-block w-full rounded-md bg-brand-red px-7 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]">
        회원가입 하고 전부 보기
      </Link>
      {mid && (
        <p className="mt-2 text-sm text-gray-400">채우던 곳에서 이어서 하실 수 있어요</p>
      )}
    </section>
  );
}
