/* 이 사이트의 주소.

   공유한 링크의 미리보기 그림(og:image)을 절대 주소로 만들 때 씁니다.
   이게 틀리면 카톡이 그림을 못 찾습니다.

   순서대로 봅니다 —
     1. NEXT_PUBLIC_SITE_URL   직접 정한 주소 (potjob.co.kr 로 옮기면 여기에)
     2. VERCEL_PROJECT_PRODUCTION_URL   Vercel 이 주는 그 프로젝트의 대표 주소
     3. VERCEL_URL             이번 배포의 주소 (미리보기마다 다릅니다)
     4. localhost              내 컴퓨터에서 볼 때

   2·3 은 Vercel 이 알아서 넣어줍니다 — 배포할 때마다 손으로 적을 필요가 없습니다. */
export function siteUrl(): string {
  const set = process.env.NEXT_PUBLIC_SITE_URL;
  if (set) return set;

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;

  const now = process.env.VERCEL_URL;
  if (now) return `https://${now}`;

  return 'http://localhost:3000';
}

/* 남에게 보내는 링크의 주소 — 늘 RAPO 대표 주소입니다 (2026-11-12 세중님 「공유할 때 왜 링크에 potjob 영어가 들어가냐 · 우리 RAPO 잖아」).
   사이트는 Vercel 의 옛 이름 주소(potjob-web.vercel.app)로도 열립니다. 거기서 공유하면 location.origin 이
   그 주소라 링크에 potjob 이 찍혔습니다. 내 컴퓨터(localhost)에서만 지금 주소를 씁니다 — 개발 서버에서 눌러 보게. */
export const 대표주소 = 'https://www.rapojob.co.kr';

export function 공유주소(path: string): string {
  if (typeof location !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(location.hostname)) return location.origin + path;
  return 대표주소 + path;
}

/* 미리보기 그림 주소 끝에 붙이는 판 번호 (2026-11-12 세중님 「?a=1 붙여도 같은디」).
   카카오는 미리보기 **그림을 그림 주소별로** 기억합니다 — 공고 주소를 바꿔 다시 보내도
   그림 주소(/api/og/job/306828)가 같으면 옛 그림을 그대로 씁니다.
   lib/og-card.tsx 의 그림 모양을 바꾸면 **이 번호를 하나 올립니다** — 그래야 카카오가 새로 받아 갑니다 */
export const 그림판 = '2';
