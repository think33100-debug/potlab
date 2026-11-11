import type { Metadata } from 'next';
import { 코드꺼내기 } from '@/lib/beta';
import { JoinKeep } from './keep';

/* 공용 초대 링크가 닿는 자리 — /join?c=<코드> (2026-11-11 세중님 결정 · 줄 A).

   링크를 가진 사람은 누구나 가입할 수 있고, 남에게 전달해도 됩니다.
   여기서는 코드를 **담아 두기만** 하고 로그인으로 보냅니다.
   코드가 맞는지는 **DB 가 정합니다** — 가입 화면 첫 단계에서 `테스터초대` 표에
   넣을 때 RLS 가 코드의 해시를 대 보고, 틀리면 넣지 못합니다.
   그래서 이 화면은 맞는 코드인지 모릅니다 (비회원에게 코드를 대 보는 창구를
   새로 열지 않으려고 일부러 그렇게 했습니다). */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RAPO 클로즈드 베타 · 초대',
  robots: { index: false, follow: false },
};

export default async function Join({
  searchParams,
}: { searchParams: Promise<{ c?: string | string[] }> }) {
  const { c } = await searchParams;
  const 코드 = 코드꺼내기(Array.isArray(c) ? c[0] : c);
  return <JoinKeep code={코드} />;
}
