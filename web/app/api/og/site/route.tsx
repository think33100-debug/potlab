import { ogCard, type 그릴것 } from '@/lib/og-card';

/* 기본 미리보기 그림 — 공고가 아닌 링크(홈 · 가입 링크 · 로그인 · 경쟁률 …)와 사진 없는 커뮤니티 글 (2026-11-12 세중님).
   예전에는 홈 쪽에 그림이 아예 없었고, 커뮤니티 글은 옛 「POT LAB」 그림(public/og.png)을 썼습니다 — 둘 다 걷었습니다.
   피그마에는 공고 그림(596:566)만 있어 같은 틀(lib/og-card.tsx)에 글만 바꿨습니다. 세중님이 시안 보고 「적용」.
     ?k=post  커뮤니티 글 · 그 밖은 기본
   비회원(카톡 미리보기 로봇)도 받아 가야 해서 middleware 가 이 길을 엽니다. 글은 늘 같은 브랜드 글뿐입니다. */
export const runtime = 'edge';

const 그림들: Record<string, 그릴것> = {
  site: {
    상태: '테스트 중', 위: 'RAPO 라포', 제목: '작업치료사·물리치료사 채용공고를 한곳에서',
    조건: '공공기관   종합병원   대학병원', 아래: '연봉까지 투명하게 · rapojob.co.kr',
  },
  post: {
    상태: '커뮤니티', 위: 'RAPO 라포', 제목: '치료사들의 이야기',
    조건: '익명으로 묻고 답해요', 아래: 'rapojob.co.kr',
  },
};

export async function GET(req: Request) {
  const k = new URL(req.url).searchParams.get('k');
  return ogCard(그림들[k === 'post' ? 'post' : 'site']);
}
