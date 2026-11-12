import { ImageResponse } from 'next/og';
import { siteUrl } from '@/lib/site-url';

/* 카톡·문자에 뜨는 미리보기 그림의 **틀 한 벌** (2026-11-12).
   피그마 「RAPO / OG / 공개 공고」 596:566 · 「O04 · 공고 상태별 OG 이미지」 596:12114.
   남색 바탕 · 위 RAPO 로고와 상태 · 가운데 흰 판(빨간 열린 테두리 · 안으로 향하는 화살표)에 위 · 제목 · 조건 · 아래 한 줄.
   공고 그림(app/api/og/job/[id])과 기본 그림(app/api/og/site — 홈·가입 링크·커뮤니티 글)이 같이 씁니다.
   원본의 오른쪽 기관 로고 칸은 비웁니다 — 병원 로고 자료가 아직 없습니다(원본에 로고 없는 모양도 있음).
   글꼴은 Pretendard Bold 하나뿐이라 원본의 Medium(조건 줄)도 Bold 로 그립니다.

   ※ 이 틀을 쓰는 길은 edge 여야 합니다. nodejs 에서는 fetch 가 file:// 를 못 열어서
     글꼴을 못 읽고 500 이 납니다 (실제로 그렇게 났습니다) */

/* 한글 글꼴을 서버가 들고 있어야 합니다. 없으면 전부 네모로 깨집니다.
   woff2 는 satori 가 못 읽습니다. woff 로 넣었습니다.

   이 파일 옆에 두고 import.meta.url 로 읽었더니 글꼴(1.1MB)이 함수 꾸러미에
   같이 들어가, Edge 함수가 1.96MB 가 되어 **배포가 통째로 실패했습니다**
   (한도 1MB · 2026-09-20). public/ 으로 옮기고 주소로 받아옵니다 —
   정적 파일은 함수 크기에 안 들어갑니다.

   한 번 받아 두고 계속 씁니다. 실패하면 다음 요청이 다시 받습니다. */
let fontCache: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache;
  const res = await fetch(siteUrl() + '/Pretendard-Bold.woff', {
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error('글꼴을 못 받았습니다: ' + res.status);
  fontCache = await res.arrayBuffer();
  return fontCache;
}

/* 그림(svg)도 글꼴처럼 받아 두고 data: 주소로 넣습니다.
   satori 에 주소를 그대로 주면 Next 16 이 자기 주소로 가는 그림을 막습니다(SSRF 보호 · 개발 서버에서 실제로 막힘).
   받아 두면 요청마다 그림을 다시 받지도 않습니다 */
const svgCache = new Map<string, string>();
async function svgData(name: string): Promise<string> {
  const hit = svgCache.get(name);
  if (hit) return hit;
  const res = await fetch(siteUrl() + '/rapo/og/' + name, { cache: 'force-cache' });
  if (!res.ok) throw new Error('그림을 못 받았습니다: ' + name + ' ' + res.status);
  const text = await res.text();
  const uri = 'data:image/svg+xml;base64,' + btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  svgCache.set(name, uri);
  return uri;
}

const W = 1200;
const H = 630;
const 남색 = '#112231';
const 글 = '#1a1c20';

export const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

/* 상태 — 오른쪽 위 · 위 — 흰 판 첫 줄(기관) · 제목 — 흰 판 가운데 · 조건 — 흰 판 아래 · 아래 — 남색 바닥 줄 */
export type 그릴것 = { 상태: string; 위: string; 제목: string; 조건: string; 아래: string };

export async function ogCard(g: 그릴것): Promise<ImageResponse> {
  const font = await loadFont();
  const [로고, 글자로고, 테두리, 화살표] = await Promise.all(
    ['symbol.svg', 'wordmark.svg', 'frame.svg', 'arrow.svg'].map(svgData));

  const 짧은제목 = g.제목.length <= 16;

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        backgroundColor: 남색, padding: 48, fontFamily: 'Pretendard', color: '#FFFFFF',
      }}>
        {/* 브랜드와 상태 */}
        <div style={{ display: 'flex', height: 64, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: 216, height: 57, position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
            <img src={로고} width={58} height={57} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
            <img src={글자로고} width={142} height={29} alt="" style={{ marginLeft: 16 }} />
          </div>
          <div style={{ display: 'flex', fontSize: 36, lineHeight: '45px' }}>{g.상태}</div>
        </div>

        {/* 흰 판 + 빨간 열린 테두리 + 안으로 향하는 화살표 */}
        <div style={{
          display: 'flex', position: 'relative', width: 1104, height: 350, backgroundColor: '#FFFFFF',
          padding: '32px 64px 32px 32px', alignItems: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
          <img src={테두리} width={1104} height={350} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
          {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
          <img src={화살표} width={72} height={72} alt="" style={{ position: 'absolute', left: 1006, top: 18, transform: 'rotate(-90deg)' }} />
          <div style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 900, height: 286, color: 글,
          }}>
            <div style={{ display: 'flex', fontSize: 40, lineHeight: '50px' }}>{cut(g.위, 24)}</div>
            <div style={{
              display: 'flex', fontSize: 짧은제목 ? 64 : 52, lineHeight: 짧은제목 ? '80px' : '64px',
              maxHeight: 짧은제목 ? 80 : 128, overflow: 'hidden', wordBreak: 'keep-all', letterSpacing: -1,
            }}>
              {cut(g.제목, 40)}
            </div>
            <div style={{ display: 'flex', fontSize: 36, lineHeight: '45px', whiteSpace: 'pre' }}>{cut(g.조건, 36)}</div>
          </div>
        </div>

        {/* 바닥 줄 */}
        <div style={{ display: 'flex', height: 48, alignItems: 'center', fontSize: 36, lineHeight: '45px' }}>{g.아래}</div>
      </div>
    ),
    {
      width: W, height: H,
      fonts: [{ name: 'Pretendard', data: font, weight: 700, style: 'normal' }],
      /* 카톡이 한 번 받아가면 계속 씁니다. 그래도 우리 쪽은 하루만 쥐고 있게 */
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    },
  );
}
