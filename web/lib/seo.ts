/* 검색엔진(구글·네이버)에 올리는 쪽 (2026-11-13 세중님 「검색 가능하게」).

   테스트 동안에는 **비회원도 이미 보는 쪽만** 올립니다 — 홈 · 공고 목록 · 문의 · 약관.
   나머지(공고 상세 · 로그인 · /beta · 회원 화면)는 전처럼 noindex 입니다.
   검색 로봇은 비회원이라 회원 화면은 어차피 로그인으로 돌려보내집니다.

   한 자리입니다 — middleware.ts(X-Robots-Tag) · app/sitemap.ts 가 이 목록을 봅니다.
   각 쪽의 robots 메타(index: true)도 이 목록과 짝을 맞춥니다.
   ★ 여기에 쪽을 더하면 검색에 그 쪽이 뜹니다 — 더하기 전에 세중님께 */

/** 딱 그 주소만 올리는 쪽 (/jobs?직군=… 같은 걸러 보기는 주소 뒤 ?만 다르므로 같은 쪽입니다) */
export const 색인길 = ['/', '/jobs', '/contact'] as const;

/** 아래 길까지 올리는 쪽 — 약관 세 장 (/terms/service · privacy · community) */
export const 색인아래길 = ['/terms/'] as const;

/** 대표 주소에서만 올립니다. Vercel 옛 주소(potjob-web.vercel.app)·미리보기 주소는 늘 noindex —
    같은 쪽이 두 주소로 검색에 뜨지 않게 합니다 */
export const 색인호스트 = 'www.rapojob.co.kr';

export function 색인되나(host: string, path: string): boolean {
  if (host !== 색인호스트) return false;
  return (색인길 as readonly string[]).includes(path) || 색인아래길.some((p) => path.startsWith(p));
}

/** 올리는 쪽의 robots 메타 — 레이아웃의 기본값(noindex)을 덮습니다 */
export const 색인메타 = { index: true, follow: true } as const;
