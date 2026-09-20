import { ImageResponse } from 'next/og';
import { isClosed } from '@/lib/job-state';
import { supabase } from '@/lib/supabase';

/* 카톡·문자에 뜨는 미리보기 그림. 공고마다 다르게 그립니다.

   파일을 미리 만들어두지 않습니다. 454장을 만들어두면 공고가 늘 때마다
   다시 만들어야 하고, 마감 여부가 바뀌면 또 만들어야 합니다.
   요청이 올 때 그 자리에서 글자를 얹어 그립니다 — 공고가 늘어도 할 일이 없습니다.

   ※ 카톡은 미리보기를 한 번 만들어두고 계속 씁니다.
     보낼 당시 마감 전이었으면 나중에도 마감 전 그림이 뜹니다.
     이건 우리가 못 막습니다 — 진짜는 화면 안의 띠입니다. */

/* edge 여야 합니다. nodejs 에서는 fetch 가 file:// 를 못 열어서
   글꼴을 못 읽고 500 이 납니다 (실제로 그렇게 났습니다) */
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 630;

/* 직군마다 바탕색.

   teamsparta.md 가 정해 둔 배지 색 네 갈래를 그대로 씁니다
   (pill-teal 정보성 · pill-green 완료 · pill-red 강조 · 중립 회색).
   한 화면에 같이 놓이는 게 아니라 그림 한 장에 하나만 쓰므로,
   red 와 blue 를 primary 로 섞지 말라는 금지에 안 걸립니다.
   interaction-blue 는 안 씁니다 — 링크·포커스 자리라 뜻이 흐려집니다.

   흰 글자가 읽히도록 teal 과 green 은 눈금보다 어둡게 내렸습니다.
   (teamsparta 의 success 는 oklch 0.627 이라 흰 글자가 2.9:1 로 흐립니다) */
const SKIN: Record<string, { bg: string; name: string }> = {
  작업치료사: { bg: '#22505E', name: '작업치료사' },   // teal-strong 계열
  물리치료사: { bg: '#16704A', name: '물리치료사' },   // success 를 어둡게
  공통:       { bg: '#FF3B30', name: '작업 · 물리치료사' }, // potjob_red
};
const FALLBACK = { bg: '#4A4D54', name: '치료사' };    // gray-600 — 아직 못 가린 것

/* 병원 이름은 제일 크게 갑니다. 이게 클릭을 만듭니다.
   길면 글자를 줄여서라도 한 화면에 다 넣습니다 */
function nameSize(s: string): number {
  if (s.length <= 10) return 96;
  if (s.length <= 14) return 80;
  if (s.length <= 20) return 66;
  return 54;
}
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /* 한글 글꼴을 서버가 들고 있어야 합니다. 없으면 전부 네모로 깨집니다.
     import.meta.url 로 읽으면 Next 가 배포 꾸러미에 같이 담아 줍니다 —
     process.cwd() 로 경로를 짜면 Vercel 에서 파일을 못 찾습니다.
     woff2 는 satori 가 못 읽습니다. woff 로 넣었습니다 */
  const font = await fetch(new URL('./Pretendard-Bold.woff', import.meta.url))
    .then((r) => r.arrayBuffer());

  let org = 'POTJOB';
  let skin = FALLBACK;
  /* 공고를 못 찾았을 때 아래에 깔리는 한 줄.
     공고를 찾으면 「직군 · 마감일」로 바뀝니다 */
  let foot = '치료사 채용공고를 한곳에서';
  let closed = false;

  /* 없는 번호를 넣어도 터지지 않고 기본 그림이 나가야 합니다 */
  try {
    const { data } = await supabase
      .from('job_posts_pub').select('org_name,job_group,apply_to').eq('id', id).maybeSingle();
    const j = data as { org_name: string; job_group: string | null; apply_to: string | null } | null;
    if (j) {
      org = j.org_name || 'POTJOB';
      skin = (j.job_group && SKIN[j.job_group]) || FALLBACK;
      closed = isClosed(j.apply_to);
      const when = !j.apply_to ? '마감일 미정'
        : closed ? `${j.apply_to} 마감`
        : `~${j.apply_to} 접수`;
      foot = `${skin.name} · ${when}`;
    }
  } catch { /* 자료를 못 읽어도 그림은 나가야 합니다 */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: W, height: H, display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', backgroundColor: skin.bg,
          padding: 72, fontFamily: 'Pretendard', color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 34, letterSpacing: 4, opacity: 0.85 }}>POTJOB</div>
          {closed && (
            <div style={{
              display: 'flex', fontSize: 28, padding: '10px 26px', borderRadius: 50,
              backgroundColor: 'rgba(0,0,0,0.32)',
            }}>
              마감
            </div>
          )}
        </div>

        {/* 병원 이름 — 낱말 중간에서 안 끊기게 (화면의 word-break: keep-all 과 같은 뜻) */}
        <div style={{
          display: 'flex', fontSize: nameSize(org), lineHeight: 1.2,
          wordBreak: 'keep-all', letterSpacing: -2,
        }}>
          {cut(org, 28)}
        </div>

        <div style={{ display: 'flex', fontSize: 38, opacity: 0.9 }}>
          {foot}
        </div>
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
