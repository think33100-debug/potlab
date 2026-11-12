import { isClosed } from '@/lib/job-state';
import { ogCard, type 그릴것 } from '@/lib/og-card';
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
     상태 넷 — 모집 중(「10.30 접수 마감」) · 모집 마감(「모집이 종료된 공고예요」) · 마감일 없음(「마감일 확인 필요」) ·
     없는 공고(「공고 안내 · 공고를 확인할 수 없어요」).
     그리는 틀은 lib/og-card.tsx 한 벌 — 기본 그림(app/api/og/site)과 같이 씁니다 */

/* edge 여야 합니다 — lib/og-card.tsx 머리 글 */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /* 공고를 못 찾았을 때 — 원본 「공고 안내」 상태 */
  let g: 그릴것 = {
    상태: '공고 안내', 위: '라포', 제목: '공고를 확인할 수 없어요',
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
        위: 기관,
        제목,
        조건: [[j.sido, j.sgg].filter(Boolean).join(' '), j.employ_type, j.headcount ? `${j.headcount}명` : null]
          .filter(Boolean).join('   '),
        아래: closed ? '모집이 종료된 공고예요' : m ? `${m[1]}.${m[2]} 접수 마감` : '마감일 확인 필요',
      };
    }
  } catch { /* 자료를 못 읽어도 그림은 나가야 합니다 */ }

  return ogCard(g);
}
