import type { SupabaseClient } from '@supabase/supabase-js';
import type { Who } from './supabase-server';

/* 첫 화면 큰 배너(metric='hot')의 이번 주 인기 글 — 회원 세션에서만 읽습니다 (2026-11-05).

   서버가 그리는 첫 화면은 비회원과 같은 응답이라 글 제목을 싣지 않습니다.
   문 규칙은 lib/community-access.ts 와 같습니다 — 내프로필 줄 또는 관리자.
   비회원·확인 중·프로필을 못 읽음이면 조회를 보내지 않습니다. */

export const HOT_DAYS = 7;

export function 인기글열쇠(a: {
  who: Who;
  회원번호: string | null;
  프로필있음: boolean;
  관리자: boolean;
}): string | null {
  if (a.who !== '회원' || !a.회원번호) return null;
  return a.프로필있음 || a.관리자 ? a.회원번호 : null;
}

export async function 회원인기글읽기(sb: SupabaseClient, since: string): Promise<string | null> {
  const { data, error } = await sb.from('공개글').select('id,title,body')
    .gte('created_at', since)
    .order('view_count', { ascending: false }).limit(1);
  if (error) throw error;
  const 줄 = (data ?? [])[0] as { title: string | null; body: string } | undefined;
  return 줄 ? 줄.title || 줄.body.slice(0, 30) : null;
}

export type 인기글값 = { 열쇠: string; 제목: string | null } | null;

/* 열쇠가 바뀌면 들고 있던 값을 비우고, 앞 조회의 늦은 답은 버립니다 */
export function 인기글자리(읽기: () => Promise<string | null>, 적용: (v: 인기글값) => void) {
  let 세대 = 0;
  let 지금: string | null = null;
  return {
    바꿈(열쇠: string | null) {
      if (열쇠 === 지금) return;
      지금 = 열쇠;
      const 내세대 = ++세대;
      적용(null);
      if (!열쇠) return;
      읽기().then(
        (제목) => { if (내세대 === 세대) 적용({ 열쇠, 제목 }); },
        () => { if (내세대 === 세대) 적용(null); },
      );
    },
  };
}

/* 값의 주인이 지금 열쇠와 같을 때만 글 제목을 냅니다 —
   로그아웃 직후 값을 비우기 전의 한 번 그림에도 제목이 안 나갑니다 */
export function 인기글줄(열쇠: string | null, 값: 인기글값, 설명: string | null): string | null {
  if (!열쇠 || 값?.열쇠 !== 열쇠) return 설명;
  return 값.제목 ?? '아직 이번 주 글이 없어요';
}
