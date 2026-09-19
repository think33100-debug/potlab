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
