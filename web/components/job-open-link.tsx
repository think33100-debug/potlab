'use client';

import { useAuth } from '@/app/auth';
import { browserSupabase } from '@/lib/supabase-browser';

/* 「원문 공고 열기」. 누른 것을 셉니다.

   이 숫자가 광고 제안에서 제일 쓸모 있습니다 —
   「본 사람」이 아니라 「실제로 지원하러 간 사람」이라서요.

   job_events 에 kind='out' 으로 넣습니다. 그 표는 넣기만 되고
   아무도 못 읽습니다 (관리자 통계 함수로만 봅니다).

   봇을 따로 안 거릅니다 — 사람이 눌러야 생기는 일이라서요. */
export function JobOpenLink({
  id, url, children, className,
}: {
  id: string; url: string; children: React.ReactNode; className?: string;
}) {
  const { me } = useAuth();

  const mark = () => {
    browserSupabase().from('job_events').insert({
      job_id: id,
      profile_id: me?.id ?? null,   // 로그인 안 했으면 비웁니다
      kind: 'out',
    }).then(({ error }) => {
      if (error) console.warn('[POTJOB] 원문 열기 기록 실패:', error.message);
    });
  };

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={mark} className={className}>
      {children}
    </a>
  );
}
