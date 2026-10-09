'use client';

import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { 비회원보기중 } from './guest-view';

/* 브라우저 쪽 열쇠꾸러미입니다.

   ── 2026-09-25 에 바뀐 것 ──────────────────────────────────────────
   세션을 **localStorage 에서 쿠키로 옮겼습니다.**

   왜 — localStorage 는 브라우저 안에만 있어서 **서버가 못 봅니다.**
   그래서 서버가 그리는 화면은 「누가 보고 있는지」를 모른 채 익명으로만
   읽었고, 공고 목록이 로그인 없이 통째로 나갔습니다.
   쿠키는 요청에 실려 가므로 서버가 그 사람으로 읽을 수 있습니다.

   화면 코드는 그대로입니다 — createClient 가 createBrowserClient 로 바뀌었을 뿐,
   browserSupabase() 를 쓰는 쪽은 한 줄도 안 고쳤습니다.

   detectSessionInUrl — 카카오에서 돌아올 때 주소에 붙어 오는 code 를
   자동으로 세션으로 바꿉니다. 이게 꺼져 있으면 로그인하고도 로그인이 안 됩니다.
   PKCE 의 code_verifier 도 이제 쿠키에 들어갑니다 (같은 출처라 /auth/callback 에서 읽힙니다).

   서버 쪽은 lib/supabase-server.ts 입니다.
   lib/supabase.ts 는 세션이 아예 없는 「누구나 보는 자료」 전용으로 남습니다. */

let client: SupabaseClient | null = null;
let 손님용: SupabaseClient | null = null;

/* 「비회원 보기」 전용 열쇠꾸러미 (2026-10-09 · lib/guest-view.ts 참고).
   persistSession 을 끄고 storageKey 를 따로 줘서 **세션을 아예 안 집습니다.**
   그래서 요청에 Authorization: Bearer <회원 토큰> 이 안 실리고,
   anon 열쇠로만 나갑니다 — 로그아웃한 사람과 똑같은 요청이 됩니다.
   storageKey 를 안 바꾸면 같은 열쇠를 읽어 세션을 주워 옵니다. */
function 손님클라이언트(): SupabaseClient {
  if (!손님용) {
    손님용 = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'potjob-guest-view-none',
        },
      },
    );
  }
  return 손님용;
}

function 진짜클라이언트(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      },
    );
  }
  return client;
}

/* 평소에는 로그인한 사람으로 읽습니다.
   「비회원 보기」를 켜 두면 **세션 없는 열쇠꾸러미**를 돌려줍니다 —
   화면 코드는 한 줄도 안 고치고 자료까지 비회원이 됩니다.

   진짜: true 는 그 보기를 **무시하고** 늘 로그인한 사람으로 읽습니다.
   페르소나 띠와 로그인 상태를 읽는 자리만 씁니다 — 그 둘은 비회원 보기
   중에도 「내가 마스터인가」를 알아야 하기 때문입니다. */
export function browserSupabase(opts?: { 진짜?: boolean }): SupabaseClient {
  if (!opts?.진짜 && 비회원보기중()) return 손님클라이언트();
  return 진짜클라이언트();
}
