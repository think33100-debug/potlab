'use client';

import type { Factor } from '@supabase/supabase-js';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관리자 2단계 인증(휴대폰 인증 앱의 6자리 코드) — 2026-11-18 초안
   멘토-추가-보안5 ④ · 멘토-2차-05-1 · 멘토-4-03

   ── 네 값 ────────────────────────────────────────────────────
     없음      확인된 수단이 하나도 없습니다 → 막지 않고 「켜 주세요」 띠만 보입니다
     확인필요  수단은 있는데 이번 로그인이 aal1 입니다 → 코드를 묻습니다
     통과      이번 로그인이 aal2 입니다 (코드까지 넣었습니다)
     모름      묻지 못했습니다(연결 끊김 등) → **화면은 막지 않습니다.**
               진짜 벽은 DB 입니다 (sql/초안_1118/관리자_2단계.sql). 여기서 막으면
               지하철에서 잠깐 끊긴 것만으로 관리자 화면이 잠깁니다 (app/auth.tsx 의 같은 결)

   ── 왜 listFactors 인가 ──────────────────────────────────────
   getAuthenticatorAssuranceLevel() 은 **브라우저에 저장된 세션의 factors** 로 nextLevel 을
   셉니다 — 다른 기기에서 막 등록한 수단은 안 보일 수 있습니다. listFactors() 는 getUser() 로
   **서버에 묻습니다.** 지금 aal 은 토큰에 적힌 값이라 저장된 세션으로 읽어도 됩니다.

   ── 진짜 세션으로 읽습니다 ──────────────────────────────────
   「비회원 보기」 중에도 내 수단을 읽어야 합니다 (components/admin-role-gate.tsx 와 같은 까닭) */

export type 이단계상태 = '없음' | '확인필요' | '통과' | '모름';

export const 진짜 = () => browserSupabase({ 진짜: true });

/* 확인된 수단 중 앱 코드(totp)만 — 이 화면은 totp 만 다룹니다 */
export function 확인된앱(all: Factor[]): Factor[] {
  return all.filter((f) => f.factor_type === 'totp' && f.status === 'verified');
}

export async function 이단계상태읽기(): Promise<이단계상태> {
  const sb = 진짜();
  try {
    const { data, error } = await sb.auth.mfa.listFactors();
    if (error || !data) return '모름';
    const 확인된것 = data.all.filter((f) => f.status === 'verified');
    if (확인된것.length === 0) return '없음';
    const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error || !aal.data) return '모름';
    return aal.data.currentLevel === 'aal2' ? '통과' : '확인필요';
  } catch {
    return '모름';
  }
}

/* 6자리만 남깁니다 — 붙여 넣을 때 섞여 오는 빈칸·줄표를 걷습니다 */
export const 여섯자리 = (s: string) => s.replace(/\D/g, '').slice(0, 6);
