import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* 커뮤니티 글 사진을 **우리 주소로** 내보냅니다 (2026-10-07 세중님 결정 ㉯).
 *
 * ── 왜 ─────────────────────────────────────────────────────
 * 저장소 경로가 `post-images/<글쓴이 회원번호>/<글번호>/0.webp` 입니다.
 * 공개 주소를 그대로 화면에 박으면 **회원번호가 화면에 나갑니다** —
 * 공개글 보기에서 번호를 뺐는데 사진 주소로 다시 새고 있었습니다
 * (2026-10-07 에 배포된 화면에서 눈으로 확인했습니다).
 *
 * ── 왜 저장소 경로를 안 바꿨나 ──────────────────────────────
 * 경로를 `<글번호>/…` 로 바꾸려면 저장소 규칙 둘(INSERT·DELETE)을 고치고
 * 이미 올라간 파일을 옮기고 post_images 줄도 고쳐야 합니다. 그래도 **옛 글은
 * 주소가 이미 밖에 나가 있습니다.** 여기서 가리면 옛 글까지 한 번에 끝납니다.
 *
 * ponytail: 사진이 1건이라 우리가 바이트를 중계해도 쌉니다. 커뮤니티가 커져
 *   이 중계가 눈에 띄면 그때 경로를 글번호로 바꾸고 저장소 규칙을 고칩니다.
 *
 * ── 감춰진 글은 안 내줍니다 ────────────────────────────────
 * 공개글 보기에 그 글이 있는지 먼저 봅니다. 없으면 404 —
 * 지워진 글의 사진이 주소만 알면 계속 보이면 안 됩니다.
 */
export const dynamic = 'force-dynamic';

const 저장소 = (path: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${path
    .split('/').map(encodeURIComponent).join('/')}`;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ post: string; idx: string }> },
) {
  const { post, idx } = await params;
  const 글번호 = Number(post);
  const 번 = Number(idx);
  if (!Number.isInteger(글번호) || !Number.isInteger(번) || 번 < 0 || 번 > 99) {
    return new NextResponse('잘못된 주소', { status: 400 });
  }

  /* 작은 그림(목록 썸네일)인지 */
  const 작은것 = new URL(req.url).searchParams.get('t') === '1';

  /* 감춰진 글의 사진은 함수가 아예 안 내줍니다 (DB 의 글사진).
     post_images 를 직접 안 읽는 것은, 그 표의 규칙이 posts 를 보는데
     비로그인은 posts 를 못 읽어 규칙이 터지기 때문입니다 (2026-10-07) */
  const { data: 사진들 } = await supabase.rpc('글사진', { p_post: 글번호 });
  const 한장 = ((사진들 ?? []) as { 큰것: string; 작은것: string }[])[번];
  if (!한장) return new NextResponse('없는 사진', { status: 404 });

  const 길 = 작은것 ? 한장.작은것 : 한장.큰것;
  const r = await fetch(저장소(길));
  if (!r.ok || !r.body) return new NextResponse('사진을 못 읽었어요', { status: 502 });

  return new NextResponse(r.body, {
    status: 200,
    headers: {
      'Content-Type': r.headers.get('content-type') ?? 'image/webp',
      /* 사진은 한 번 올리면 안 바뀝니다 — 오래 붙들어 둡니다 */
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
