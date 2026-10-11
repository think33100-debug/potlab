import { NextResponse } from 'next/server';

/* 지금 **살아 있는 화면이 어느 커밋인지** 알려 줍니다 (2026-10-11).
 *
 *   GET /api/build → { sha: "a2fa7cf…", 짧게: "a2fa7cf", 갈래: "main" }
 *
 * ── 왜 만드나 ────────────────────────────────────────────────
 * 2026-10-10~11 에 **운영 배포 다섯 번이 줄줄이 ERROR** 였는데 아무도
 * 몰랐습니다. 사이트는 닷새 전 커밋으로 계속 돌고 있었고, 저는 그동안
 * 「배포했습니다」라고 적었습니다.
 *
 * 그물을 치려면 밖에서 **「지금 뜬 것이 내가 민 커밋인가」**를 물을 수
 * 있어야 합니다. Vercel 토큰 없이 물을 수 있게 이 자리를 둡니다 —
 * .github/workflows/deploy-check.yml 이 여기를 두드립니다.
 *
 * 커밋 해시는 비밀이 아닙니다 (저장소를 보면 누구나 압니다).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  return NextResponse.json({
    sha,
    짧게: sha.slice(0, 7),
    갈래: process.env.VERCEL_GIT_COMMIT_REF ?? '',
    자리: process.env.VERCEL_ENV ?? 'local',
  }, { headers: { 'cache-control': 'no-store' } });
}
