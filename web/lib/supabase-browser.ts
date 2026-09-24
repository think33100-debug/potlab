'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

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

export function browserSupabase(): SupabaseClient {
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
