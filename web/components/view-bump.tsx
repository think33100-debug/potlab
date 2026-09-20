'use client';

import { useEffect } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 조회수를 한 번 올립니다.

   posts UPDATE 규칙이 「내 글만」이라 읽는 사람은 직접 못 올립니다.
   그래서 view_count 만 건드리는 함수 하나를 열어 두고 그걸 부릅니다.

   같은 탭에서 새로고침할 때마다 오르는 것을 막으려고
   sessionStorage 에 본 글을 적어 둡니다. 완벽하게 막지는 못합니다 —
   ponytail: 조회수는 인기 글을 고르는 눈금이라 이 정도면 됩니다.
   광고 단가의 근거로 쓸 때가 오면 그때 서버에서 제대로 셉니다. */
export function ViewBump({ id }: { id: number }) {
  useEffect(() => {
    const key = `potjob.seen.${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* 시크릿 창에서는 그냥 셉니다 */
    }
    /* .then() 을 붙여야 실제로 나갑니다.
       supabase-js 의 요청은 thenable 이라 부르기만 하면 아무 일도 안 일어납니다 —
       처음에 이걸 빠뜨려 조회수가 0 에 머물렀습니다 */
    browserSupabase().rpc('bump_post_view', { p_id: id }).then(({ error }) => {
      if (error) console.warn('[POTJOB] 조회수 못 올림:', error.message);
    });
  }, [id]);

  return null;
}
