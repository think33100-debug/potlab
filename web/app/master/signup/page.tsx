import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SignupPreview } from '@/components/signup-preview';
import { serverSupabase } from '@/lib/supabase-server';

/* 관리자 가입 미리보기 — 「회원가입을 막 시작한 사람」의 화면 (2026-11-17 세중님).

   ── 누가 들어오나 — **여기(서버)에서** 막습니다 ───────────────
   마스터 계정(내페르소나().마스터)이거나 관리자(is_admin())일 때만 화면을 내보냅니다.
   둘 다 DB 가 로그인 쿠키를 보고 답하는 값이라 브라우저에서 고칠 수 없습니다.
   아니면 「없는 화면」(404)입니다 — 이런 길이 있다는 것도 안 알립니다.
     · 마스터는 **지금 역할이 무엇이든**(학생·치료사로 바꿔 둔 때도) 들어옵니다 — 마스터인가() 는 역할을 안 봅니다
     · 「비회원 보기」 중에는 서버가 로그인 쿠키를 안 읽어서(lib/supabase-server.ts) 문 앞에서 로그인 화면으로 갑니다
     · 로그인 안 한 사람은 middleware 가 먼저 로그인 화면으로 보냅니다

   ── 여기서 지키는 것은 「들어오는 길」입니다 ─────────────────
   이 화면은 가입 화면(/welcome)과 같은 화면을 **저장 없이** 돌릴 뿐이라, 회원 자료는 하나도 안 실려 나갑니다.
   저장을 막는 자리는 lib/signup-dryrun.ts 입니다.

   새 DB 함수·표는 만들지 않았습니다 — 이미 있는 창구 둘(내페르소나 · is_admin)만 읽습니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '가입 화면 미리보기 · RAPO',
  robots: { index: false, follow: false },
};

export default async function MasterSignup() {
  const sb = await serverSupabase();
  const [마스터, 관리자] = await Promise.all([sb.rpc('내페르소나'), sb.rpc('is_admin')]);
  const 마스터인가 = !마스터.error && (마스터.data as { 마스터?: boolean } | null)?.마스터 === true;
  const 관리자인가 = !관리자.error && 관리자.data === true;
  if (!마스터인가 && !관리자인가) notFound();

  return <SignupPreview />;
}
