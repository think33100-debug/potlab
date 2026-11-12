import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/* 기관 로고를 우리 주소로 내보냅니다 (2026-11-13 세중님 「로고는 공통부터 · 데이터베이스는 슈퍼베이스」).
 *
 * 그림 바이트는 Supabase 「기관로고」 표의 내용64(base64)에 있습니다 (RAPO노트/SQL_1113/X).
 * 저장소(Storage)에 올리려면 열쇠가 필요해 표에 담았습니다 — 그림이 1~3KB 라 표로 충분합니다.
 * 표는 「보임」인 줄만 누구에게나 읽힙니다(RLS). 로고는 감출 값이 아니라 비회원·공유 미리보기에도 줍니다.
 * 화면 주소는 lib/org-logo.ts 의 기관로고() 한 자리에서 만듭니다 (?v= 로 판을 올립니다).
 */

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^[a-z0-9_-]{1,40}$/.test(key)) return new NextResponse('잘못된 주소', { status: 400 });

  const { data, error } = await supabase.from('기관로고').select('형식, 내용64').eq('열쇠', key).maybeSingle();
  if (error) return new NextResponse('로고를 못 읽었어요', { status: 502 });
  if (!data) return new NextResponse('없는 로고', { status: 404 });

  const 줄 = data as unknown as { 형식: string; 내용64: string };
  return new NextResponse(new Uint8Array(Buffer.from(줄.내용64, 'base64')), {
    status: 200,
    headers: {
      'Content-Type': 줄.형식,
      /* 그림을 바꾸면 lib/org-logo.ts 의 판을 올려 주소가 바뀝니다 — 오래 붙들어도 됩니다 */
      'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
    },
  });
}
