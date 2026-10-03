import type { Metadata } from 'next';
import Link from 'next/link';

import { EduOrgCard, type 기관 } from '@/components/edu-org-card';
import { ListFilters } from '@/components/list-filters';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 교육기관 보기 (2026-10-04).

   병원 정보 찾기(/orgs)처럼 **기관을 한 장씩** 보여줍니다.
   교육 목록(/edu)이 「무슨 교육이 열렸나」라면, 여기는 「어디서 배우나」입니다.

   ⚷ 남의 누리집 로고를 가져오지 않습니다 — 대표 그림은 관리자가 올린
     것만 쓰고, 없으면 이름 글자로 된 기본 카드가 나갑니다.

   로그인 없이 봅니다. 알림 종만 로그인이 필요합니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '교육기관 · POTJOB',
  description: '학회·협회가 어떤 교육을 여는지 한자리에서 봅니다',
};

type SP = { job?: string };

export default async function EduOrgs({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sb = await serverSupabase();

  /* 직군 기본값 = 가입 때 고른 직군. profiles 를 직접 읽지 않습니다 */
  let 내직군: string | null = null;
  let 내역할: string | null = null;
  const 회원인가 = await serverWho(sb) === '회원';
  if (회원인가) {
    const { data } = await sb.rpc('내프로필');
    const 나 = ((data ?? []) as { job_group?: string | null; role?: string | null }[])[0];
    내직군 = 나?.job_group ?? null;
    내역할 = 나?.role ?? null;
  }
  const 고른직군 = sp.job === '전체' ? null : (sp.job ?? 내직군);

  const [목록, 내알림] = await Promise.all([
    sb.rpc('교육기관목록', { p_직군: 고른직군 }),
    회원인가 ? sb.rpc('내교육기관알림') : Promise.resolve({ data: [] }),
  ]);

  const rows = (목록.data ?? []) as unknown as 기관[];
  const 켠것 = new Set(((내알림.data ?? []) as { 기관: string }[]).map((x) => x.기관));

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">교육기관</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        학회·협회가 어떤 교육을 여는지 봅니다. <b>신청은 각 기관에서</b> 합니다
      </p>

      <div className="mt-6">
        <ListFilters
          기준={{ job: sp.job ?? 내직군 ?? undefined }}
          지역숨김
          마감숨김
          기본직군={내직군}
          역할={내역할}
          뿌리="/edu/org"
        />
      </div>

      <p className="mt-2 text-lg text-mute">
        <b className="text-ink">{rows.length}곳</b>
        {' · '}
        <Link href="/edu" className="underline underline-offset-4">교육 목록으로 보기</Link>
      </p>

      {목록.error && (
        <p className="mt-6 rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          불러오지 못했어요 — {목록.error.message}
          <span className="mt-1 block text-sm">app/edu/org/page.tsx · 교육기관목록()</span>
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((o) => (
          <li key={o.이름}>
            <EduOrgCard o={o} 켜짐={켠것.has(o.이름)} 로그인했나={회원인가} />
          </li>
        ))}
      </ul>

      <p className="mt-6 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
        기관 소개와 대표 그림은 <b>관리자가 넣은 것</b>입니다.
        남의 누리집 로고를 가져오지 않습니다.
        <br />
        <b>한국작업치료사협회</b>와 <b>국제의과학아카데미</b>는 홈페이지가 자동
        수집을 막아 두어 교육을 모으지 않습니다 — 누르면 그 기관 화면으로 갑니다.
      </p>
    </main>
  );
}
