import type { SupabaseClient } from '@supabase/supabase-js';
import type { Who } from './supabase-server';

/* 커뮤니티 문 규칙 한 자리 (2026-11-05 · Q51 · 멘토-4.2-2).

   공고는 비회원에게 그대로 열어 두고, 커뮤니티만 가입한 회원에게 엽니다.
   재직 인증은 보지 않습니다 — 내프로필 줄이 있으면 가입한 회원입니다.

   ※ 이 코드는 화면에서 조회를 안 보내는 자리입니다.
     DB 권한은 따로 닫아야 합니다. 화면이 닫혔다고 DB 가 닫힌 것은 아닙니다. */

export type 문상태 = '열림' | '로그인필요' | '가입필요' | '확인중';

export type 문결과 = { 상태: 문상태; 역할: string | null };

/* 서버에서 묻습니다. 비회원·모름이면 DB 를 한 번도 안 부릅니다 */
export async function 커뮤니티문확인(sb: SupabaseClient, who: Who): Promise<문결과> {
  if (who === '비회원') return { 상태: '로그인필요', 역할: null };
  if (who === '모름') return { 상태: '확인중', 역할: null };

  const 프로필 = await sb.rpc('내프로필').maybeSingle();
  /* 못 읽은 것과 줄이 없는 것은 다릅니다 — app/auth.tsx 의 설문상태와 같은 가름 */
  if (프로필.error) return { 상태: '확인중', 역할: null };
  if (프로필.data) {
    return { 상태: '열림', 역할: (프로필.data as { role?: string | null }).role ?? null };
  }

  /* 관리자는 줄이 없어도 봅니다 — app/gate.tsx 의 gateOf 와 같은 규칙 */
  const 관리자 = await sb.rpc('is_admin');
  if (관리자.error) return { 상태: '확인중', 역할: null };
  return { 상태: 관리자.data === true ? '열림' : '가입필요', 역할: null };
}

export type 문표시결과 = {
  표시: '내용' | '로딩' | '잠김';
  가는곳: '/login' | '/welcome';
  새로고침: boolean;
};

/* 서버가 본 상태와 브라우저의 세션을 맞춰 무엇을 그릴지 정합니다.
   브라우저에서 세션이 사라지면 서버가 열어 둔 글도 바로 치웁니다 (로그아웃) */
export function 문표시(서버: 문상태, who: Who): 문표시결과 {
  if (who === '모름') return { 표시: '로딩', 가는곳: '/login', 새로고침: false };
  if (who === '비회원') {
    return { 표시: '잠김', 가는곳: '/login', 새로고침: 서버 === '열림' };
  }
  if (서버 === '열림') return { 표시: '내용', 가는곳: '/login', 새로고침: false };
  if (서버 === '가입필요') return { 표시: '잠김', 가는곳: '/welcome', 새로고침: false };
  if (서버 === '확인중') return { 표시: '로딩', 가는곳: '/login', 새로고침: true };
  /* 화면은 회원인데 서버는 세션을 못 봤습니다 — 한 번 다시 묻습니다 */
  return { 표시: '잠김', 가는곳: '/login', 새로고침: true };
}
