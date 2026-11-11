'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { RapoLoginButtons, 넓은단추, 로그인틀, type Method } from '@/components/rapo/rapo-login';
import {
  readLastLogin, subscribeLastLogin, serverLastLogin, type LoginMethod,
} from '@/lib/last-login';
import { setAfterLogin, setLoginTry } from '@/lib/after-login';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../auth';
import { useToast } from '../toast';

/* 로그인 — 새 디자인 「U04-01 / 로그인」 (2026-11-11 대표: 피그마 우선).
   원본: 「RAPO / B / 사진 로그인 / 채택」 1479:4401 (07 · B 가입과 원래 화면 복귀 → 01 공통 가입 1529:17621).

   원본 설명 — 정지 사진 로그인. 최근 로그인 기록이 있으면 로그인 행동의 안내 문구 자리에
   마지막 제공자를 말풍선으로 보인다(「최근에 카카오로 만났어요」).
   원본 컴포넌트에 사진 세 장이 번갈아 나오는 움직임이 있지만 이름이 「정지 사진」이라 첫 장만 둡니다.

   하는 일은 전과 같습니다 — 카카오 · 네이버(custom:naver) · Apple 로 Supabase OAuth,
   마지막 수단은 이 기기에만 기억(lib/last-login.ts), 가입 중간이면 이어서/처음부터, 이미 로그인이면 안내.
   ★ 수단 순서는 원본대로 **고정**입니다(카카오 · 네이버 · Apple). 전에는 마지막 수단을 맨 위로 올렸는데,
     이제 그 단추 바로 위 말풍선이 같은 일을 합니다(다른 수단을 누르면 계정이 갈라짐을 막는 표시).

   카카오·네이버·Apple 색은 각 회사가 정한 값입니다(심사 기준) — 토큰으로 바꾸지 않습니다.
   oauth 이름은 Supabase 에 적힌 그대로여야 합니다 (2026-09-19 두드려 봄: kakao 302 · custom:naver 302 ·
   naver 400 Unsupported provider · apple 은 대시보드에서 켜야 돕니다 — docs/애플로그인_준비.md).

   피그마에 없어 뺀 것 — 「RAPO 는 지금 테스트 중이에요…」 안내 상자(테스터 안내는 /beta 가 맡습니다) ·
   「마지막에 쓴 수단은 이 기기에만 기억해요」 줄 · 숨 쉬는 단추 움직임. */

export default function Login() {
  const toast = useToast();
  const router = useRouter();
  const { loading, session, me } = useAuth();
  const [busy, setBusy] = useState<LoginMethod | null>(null);

  /* 서버에는 localStorage 가 없습니다. 서버 그림은 null 로 두고 브라우저에 붙은 뒤 실제 값으로 바뀝니다 */
  const last = useSyncExternalStore(subscribeLastLogin, readLastLogin, serverLastLogin);

  /* 가려던 주소 — middleware 가 비회원을 여기로 보낼 때 ?next= 로 실어 보냅니다 (2026-11-11 밤).
     로그인 뒤 auth/callback 이 potjob.after-login 을 읽어 그 자리로 보냅니다. 우리 사이트 안 주소만 받습니다 */
  useEffect(() => {
    try {
      const next = new URLSearchParams(location.search).get('next');
      if (next) setAfterLogin(next);   // 탭이 바뀌어도 남게 (lib/after-login.ts)
    } catch { /* 사파리 비공개 */ }
  }, []);

  const start = async (m: Method) => {
    /* 「최근에 ○○로 만났어요」는 로그인이 **끝난 뒤** auth/callback 이 적습니다. 여기서는 누른 수단만 쪽지로 */
    setLoginTry(m.key);
    setBusy(m.key);
    const { error } = await browserSupabase().auth.signInWithOAuth({
      provider: m.oauth,
      options: { redirectTo: `${location.origin}/auth/callback` },
      /* 카카오 profile_image 는 여기서 못 뺍니다 — options.scopes 는 덧붙기만 합니다.
         Supabase 대시보드 → Authentication → Providers → Kakao → Scopes 에서 지웁니다 */
    });
    /* 넘어가지 못하면 진짜 이유를 그대로 보여줍니다 */
    if (error) {
      setBusy(null);
      toast(`${m.이름} 로그인을 시작하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 });
    }
  };

  /* 로그인은 됐는데 가입을 안 마친 상태 — 이어서 할 길과 다른 수단으로 갈 길을 둘 다 둡니다 */
  const halfway = !!session && !me;
  const restart = async () => {
    await browserSupabase().auth.signOut({ scope: 'local' });
    toast('처음부터 다시 해요');
  };

  /* 확인 중에는 단추를 안 그립니다 — 로그인한 분에게 카카오 단추가 떴다가 바뀌면 로그아웃된 줄 압니다 */
  if (loading) {
    return <로그인틀 아래={<p role="status" className="rapo-type-t4-regular text-center">잠시만요…</p>} />;
  }

  /* 가입까지 마친 분이 다시 들어온 경우 */
  if (session && me) {
    return (
      <로그인틀 아래={
        <>
          <p className="rapo-type-t4-regular text-center">이미 로그인되어 있어요 — {me.nickname} 님</p>
          <button type="button" onClick={() => router.push('/jobs')} className={넓은단추 + ' bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral)'}>
            공고 보러 가기
          </button>
          <button type="button" onClick={restart} className="rapo-type-t4-medium w-full text-center">다른 계정으로 로그인</button>
        </>
      } />
    );
  }

  return (
    <로그인틀 아래={
      <>
        {halfway && (
          <div className="flex flex-col gap-(--rapo-dimension-x3)">
            <p className="rapo-type-t4-regular text-center">가입을 하다가 멈추셨어요</p>
            <Link href="/welcome" className={넓은단추 + ' bg-(--rapo-color-bg-deep-coral) text-(color:--rapo-color-fg-on-deep-coral)'}>
              이어서 하기
            </Link>
            <button type="button" onClick={restart} className="rapo-type-t4-medium w-full text-center opacity-80">처음부터 다시 하기</button>
          </div>
        )}
        {/* 안내 문구 — 최근 수단이 있으면 그 단추 위 말풍선이 대신합니다(원본 설명) */}
        {halfway ? (
          <p className="rapo-type-t4-regular text-center">다른 수단으로 로그인하면 새 계정이 돼요</p>
        ) : !last && (
          <p className="rapo-type-t4-regular text-center">처음이라면 같은 방법으로 가입할 수 있어요</p>
        )}
        <RapoLoginButtons last={halfway ? null : last} busy={busy} onStart={start} />
        {/* 지금은 테스터만 볼 수 있어 비회원은 안내 화면(/beta)으로 갑니다 — 원본 글은 그대로 둡니다 */}
        <Link href="/" className="rapo-type-t4-medium w-full text-center">지금은 둘러볼게요</Link>
      </>
    } />
  );
}
