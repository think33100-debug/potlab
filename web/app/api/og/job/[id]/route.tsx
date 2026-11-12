import { ImageResponse } from 'next/og';
import { isClosed } from '@/lib/job-state';
import { siteUrl } from '@/lib/site-url';
import { supabase } from '@/lib/supabase';

/* 카톡·문자에 뜨는 미리보기 그림. 공고마다 다르게 그립니다.

   파일을 미리 만들어두지 않습니다. 454장을 만들어두면 공고가 늘 때마다
   다시 만들어야 하고, 마감 여부가 바뀌면 또 만들어야 합니다.
   요청이 올 때 그 자리에서 글자를 얹어 그립니다 — 공고가 늘어도 할 일이 없습니다.

   ※ 카톡은 미리보기를 한 번 만들어두고 계속 씁니다.
     보낼 당시 마감 전이었으면 나중에도 마감 전 그림이 뜹니다.
     이건 우리가 못 막습니다 — 진짜는 화면 안의 띠입니다.

   ★ 2026-11-12 새 디자인 — 피그마 「RAPO / OG / 공개 공고」 596:566 · 「O04 · 공고 상태별 OG 이미지」 596:12114
     (세중님 「카톡 미리보기 이미지도 적용해야 해 · 지금은 옛날 거」).
     남색 바탕 · 위 RAPO 로고와 모집 상태 · 가운데 흰 판(빨간 열린 테두리 · 안으로 향하는 화살표)에 기관 · 제목 · 조건 · 아래 마감.
     상태 넷 — 모집 중(「10.30 접수 마감」) · 모집 마감(「모집이 종료된 공고예요」) · 마감일 없음(「마감일 확인 필요」) ·
     없는 공고(「공고 안내 · 공고를 확인할 수 없어요」).
     원본의 오른쪽 기관 로고 칸은 비웁니다 — 병원 로고 자료가 아직 없습니다(원본에 로고 없는 모양도 있음).
     글꼴은 Pretendard Bold 하나뿐이라 원본의 Medium(조건 줄)도 Bold 로 그립니다 */

/* edge 여야 합니다. nodejs 에서는 fetch 가 file:// 를 못 열어서
   글꼴을 못 읽고 500 이 납니다 (실제로 그렇게 났습니다) */
export const runtime = 'edge';

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
export const dynamic = 'force-dynamic';

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

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

type 그릴것 = { 상태: string; 기관: string; 제목: string; 조건: string; 아래: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const font = await loadFont();
  const [로고, 글자로고, 테두리, 화살표] = await Promise.all(
    ['symbol.svg', 'wordmark.svg', 'frame.svg', 'arrow.svg'].map(svgData));

  /* 공고를 못 찾았을 때 — 원본 「공고 안내」 상태 */
  let g: 그릴것 = {
    상태: '공고 안내', 기관: '라포', 제목: '공고를 확인할 수 없어요',
    조건: '공개 가능한 다른 공고를 둘러보세요', 아래: '라포에서 채용 공고 찾기',
  };

  /* 없는 번호를 넣어도 터지지 않고 기본 그림이 나가야 합니다 */
  try {
    /* 미리보기 그림에는 세션이 없습니다 — job_one 은 비회원에게도 열려 있습니다(금고 SQL_1113/M · N) */
    const { data } = await supabase.rpc('job_one', { p_id: id }).maybeSingle();
    const j = data as {
      org_name: string | null; title: string | null; job_group: string | null;
      employ_type: string | null; sido: string | null; sgg: string | null; headcount: number | null;
      apply_to: string | null; apply_to_time?: string | null;
    } | null;
    if (j) {
      const 기관 = (j.org_name || '').trim() || '라포';
      /* 제목 앞머리가 기관 이름이면 떼어 냅니다 — 위 줄에 기관이 이미 있습니다 */
      const 원제목 = (j.title || `${j.job_group ?? '치료사'} 채용`).trim();
      const 제목 = 원제목.startsWith(기관) ? 원제목.slice(기관.length).trim() || 원제목 : 원제목;
      const closed = isClosed(j.apply_to, undefined, j.apply_to_time);
      const m = String(j.apply_to || '').match(/^\d{4}-(\d{2})-(\d{2})/);
      g = {
        상태: closed ? '모집 마감' : '모집 중',
        기관,
        제목,
        조건: [[j.sido, j.sgg].filter(Boolean).join(' '), j.employ_type, j.headcount ? `${j.headcount}명` : null]
          .filter(Boolean).join('   '),
        아래: closed ? '모집이 종료된 공고예요' : m ? `${m[1]}.${m[2]} 접수 마감` : '마감일 확인 필요',
      };
    }
  } catch { /* 자료를 못 읽어도 그림은 나가야 합니다 */ }

  const 짧은제목 = g.제목.length <= 16;

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        backgroundColor: 남색, padding: 48, fontFamily: 'Pretendard', color: '#FFFFFF',
      }}>
        {/* 브랜드와 모집 상태 */}
        <div style={{ display: 'flex', height: 64, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', width: 216, height: 57, position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
            <img src={로고} width={58} height={57} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element -- satori 는 img 만 받습니다 */}
            <img src={글자로고} width={142} height={29} alt="" style={{ marginLeft: 16 }} />
          </div>
          <div style={{ display: 'flex', fontSize: 36, lineHeight: '45px' }}>{g.상태}</div>
        </div>

        {/* 공고 정보 — 흰 판 + 빨간 열린 테두리 + 안으로 향하는 화살표 */}
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
            <div style={{ display: 'flex', fontSize: 40, lineHeight: '50px' }}>{cut(g.기관, 24)}</div>
            <div style={{
              display: 'flex', fontSize: 짧은제목 ? 64 : 52, lineHeight: 짧은제목 ? '80px' : '64px',
              maxHeight: 짧은제목 ? 80 : 128, overflow: 'hidden', wordBreak: 'keep-all', letterSpacing: -1,
            }}>
              {cut(g.제목, 40)}
            </div>
            <div style={{ display: 'flex', fontSize: 36, lineHeight: '45px', whiteSpace: 'pre' }}>{cut(g.조건, 36)}</div>
          </div>
        </div>

        {/* 마감과 서비스 */}
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
