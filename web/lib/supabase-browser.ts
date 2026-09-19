'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* 브라우저 쪽 열쇠꾸러미입니다.

   lib/supabase.ts 와 무엇이 다른가 —
     lib/supabase.ts          서버에서 공개 자료만 읽습니다. 세션을 안 들고 있습니다
     lib/supabase-browser.ts  로그인한 사람으로 읽고 씁니다. 세션을 브라우저에 둡니다

   둘을 안 합치는 이유: 글 상세는 서버에서 그려야 카톡 미리보기(OG)가 뜨는데,
   서버에는 그 사람의 세션이 없습니다. 공개 읽기와 본인 쓰기를 갈라두면 둘 다 됩니다.

   detectSessionInUrl — 카카오에서 돌아올 때 주소에 붙어 오는 code 를
   자동으로 세션으로 바꿉니다. 이게 꺼져 있으면 로그인하고도 로그인이 안 됩니다. */

let client: SupabaseClient | null = null;

export function browserSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
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
