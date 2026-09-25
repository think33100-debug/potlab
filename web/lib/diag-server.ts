import { cookies, headers } from 'next/headers';

/* **화면을 그린 그 요청**이 무엇을 들고 왔는지 적어 둡니다 (2026-09-25).

   ── 왜 따로 만드나 ──────────────────────────────────────────
   /api/diag-who 는 브라우저가 따로 쏘는 요청입니다. 그것과 **화면을 그리는
   문서 요청은 다른 요청**입니다. 카카오톡 안에서 문서 요청에만 쿠키가 안
   실리는 경우가 있어서, 둘을 갈라 봐야 합니다.

   그래서 이 함수는 서버가 화면을 그리는 **바로 그 순간** 불립니다.

   ── 값은 안 찍습니다 ────────────────────────────────────────
   쿠키 값도 토큰도 안 찍습니다. 있는지·몇 개인지·몇 바이트인지만입니다. */

/* 로그인 세션 쿠키 — 4KB 를 넘으면 .0 .1 로 쪼개집니다 */
const 세션이름 = /^sb-.*-auth-token(\.\d+)?$/;
/* 로그인하러 갔다 돌아오는 길의 임시 쪽지. 세션이 아닙니다 */
const 쪽지인가 = (n: string) => n.startsWith('sb-') && n.includes('code-verifier');

export type 쿠키요약 = {
  세션조각: number; 쪽지: number; 전부: number; 바이트: number;
};

export function 쿠키세기(list: { name: string; value: string }[]): 쿠키요약 {
  return {
    세션조각: list.filter((c) => 세션이름.test(c.name)).length,
    쪽지: list.filter((c) => 쪽지인가(c.name)).length,
    전부: list.length,
    /* 이름=값; 로 세면 실제 Cookie 머리글 길이와 거의 같습니다 */
    바이트: list.reduce((n, c) => n + c.name.length + c.value.length + 3, 0),
  };
}

export function 한줄로(c: 쿠키요약): string {
  return `${c.세션조각 ? '있음' : '없음'} · 세션조각 ${c.세션조각} · 쪽지 ${c.쪽지}`
       + ` · 전부 ${c.전부}개 ${c.바이트}바이트`;
}

/* 카카오톡·네이버 인앱인지. 브라우저 이름을 통째로 찍으면 길어서 못 읽습니다 */
export function 어느브라우저(ua: string): string {
  if (/KAKAOTALK/i.test(ua)) return '카카오톡 인앱';
  if (/NAVER\(inapp/i.test(ua)) return '네이버 인앱';
  if (/Instagram|FBAN|FBAV|Line\//i.test(ua)) return '다른 인앱';
  if (/CriOS|Chrome/i.test(ua)) return '크롬';
  if (/Safari/i.test(ua)) return '사파리';
  return '그 밖';
}

/* 화면을 그리는 이 요청이 들고 온 것 */
export async function 이요청이들고온것() {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const ua = h.get('user-agent') ?? '';
  return {
    쿠키: 쿠키세기(jar.getAll()),
    브라우저: 어느브라우저(ua),
    /* 문서 요청에 Cookie 머리글 자체가 왔는지. 0 이면 통째로 안 온 것입니다 */
    쿠키머리글: (h.get('cookie') ?? '').length,
  };
}
