/* 검색엔진(구글·네이버)에 올리는 쪽 (2026-11-13 세중님 「검색 가능하게」).

   테스트 동안에는 **비회원도 이미 보는 쪽만** 올립니다 — 홈 · 공고 목록 · 공고 한 건 · 문의 · 약관 · 안내 글.
   나머지(로그인 · /beta · 회원 화면)는 전처럼 noindex 입니다.
   검색 로봇은 비회원이라 회원 화면은 어차피 로그인으로 돌려보내집니다.

   한 자리입니다 — middleware.ts(X-Robots-Tag) · app/sitemap.ts 가 이 목록을 봅니다.
   각 쪽의 robots 메타(index: true)도 이 목록과 짝을 맞춥니다.
   ★ 여기에 쪽을 더하면 검색에 그 쪽이 뜹니다 — 더하기 전에 세중님께 */

/** 딱 그 주소만 올리는 쪽 (/jobs?직군=… 같은 걸러 보기는 주소 뒤 ?만 다르므로 같은 쪽입니다) */
/* ★ 2026-11-13 세중님 — 커뮤니티 · 교육·학술 · 병원 찾기 첫 화면도 올립니다(비회원·로봇에게는 맛보기 화면).
   네이버 검색 결과의 메뉴 줄(사이트링크)에 붙을 수 있게 — 로봇이 못 여는 화면은 붙지 않습니다 */
export const 색인길 = ['/', '/jobs', '/contact', '/community', '/edu', '/orgs'] as const;

/** 아래 길까지 올리는 쪽 — 약관 세 장 (/terms/service · privacy · community) · 안내 글 (/guide/…) */
export const 색인아래길 = ['/terms/', '/guide/'] as const;

/** 안내 글 (/guide/…) — 검색으로 들어오는 분을 위한 글입니다 (2026-11-13 세중님). 앱 메뉴에는 걸지 않고 사이트맵에만 올립니다.
    글을 더하면 여기에 주소를 더합니다 — app/sitemap.ts 가 이 목록을 싣습니다 */
export const 안내글길 = ['/guide/job-sites', '/guide/ot-associations', '/guide/pt-associations'] as const;

/** 공고 한 건 (/jobs/<번호>) — 2026-11-13 세중님 「공고 글도 검색되게 · 열자」.
    비회원에게 이미 열린 쪽(공유 링크)이라 새로 드러나는 값은 없습니다 — 로봇도 비회원 화면만 봅니다.
    마감된 공고도 쪽이 있는 동안은 그대로 둡니다(세중님 「결국 유입이니깐」). 사이트맵에는 마감 전 공고만 넣습니다 */
export const 공고한건길 = /^\/jobs\/[^/]+$/;

/** 대표 주소에서만 올립니다. Vercel 옛 주소(potjob-web.vercel.app)·미리보기 주소는 늘 noindex —
    같은 쪽이 두 주소로 검색에 뜨지 않게 합니다 */
export const 색인호스트 = 'www.rapojob.co.kr';

export function 색인되나(host: string, path: string): boolean {
  if (host !== 색인호스트) return false;
  return (색인길 as readonly string[]).includes(path) || 색인아래길.some((p) => path.startsWith(p))
    || 공고한건길.test(path);
}

/** 올리는 쪽의 robots 메타 — 레이아웃의 기본값(noindex)을 덮습니다 */
export const 색인메타 = { index: true, follow: true } as const;
