'use client';

import { useRouter } from 'next/navigation';

/* 「로그인하고 보기」 — 비회원이 회원 전용 자리를 눌렀을 때 (2026-10-09).
 *
 * ── 왜 부품으로 뺐나 ────────────────────────────────────────
 * 돌아올 자리를 적는 쪽지 이름(`potjob.after-login`)이 이미 다섯 군데에
 * 흩어져 있었습니다. 같은 이름을 여섯 번째로 또 적는 대신 한 자리에 둡니다.
 * 가입을 마치고 돌아오는 길은 /auth/callback 과 /welcome 이 봅니다.
 *
 * ── 막는 자리는 여기가 아닙니다 ─────────────────────────────
 * 이 단추는 **안내**입니다. 비회원에게는 창구가 원문 주소를 아예 안 줍니다
 * (job_one · 공개공고). 그래서 이 단추를 지워도 주소가 새지 않습니다.
 */
export function LoginFirst({
  children, className, 어디로,
}: {
  children: React.ReactNode;
  className?: string;
  /* 로그인 뒤 돌아올 자리. 안 주면 지금 보던 주소 */
  어디로?: string;
}) {
  const router = useRouter();

  const 가기 = () => {
    try {
      sessionStorage.setItem('potjob.after-login',
        어디로 ?? location.pathname + location.search);
    } catch { /* 사생활 보호 창 — 돌아오는 자리만 못 적습니다 */ }
    router.push('/login');
  };

  return (
    <button type="button" onClick={가기} className={className}>
      {children}
    </button>
  );
}
