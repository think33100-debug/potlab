'use client';

import { useEffect, useState } from 'react';
import { useLinkStatus } from 'next/link';

/* 링크를 눌러 **가고 있는 동안**만 맨 위에 얇은 막대 (2026-10-29 세중님)
 *
 * ── 세중님 말 ───────────────────────────────────────────────
 * 「회색이 떴다 사라지는 깜빡임이 번잡함 → **거의 안 보이게**.
 *  처음 500ms 는 아무것도 안 그림(**이전 화면 그대로**가 1순위) →
 *  500ms 넘으면 그때만 맨 위 2px 막대. 회색 칸·글자 없음」
 *
 * ── 그래서 `loading.tsx` 를 **지웠습니다** ──────────────────
 * `loading.tsx` 가 있으면 Next 는 누르는 순간 **이전 화면을 치우고** 그 화면을 그립니다 —
 * 그것이 깜빡임의 원인입니다. 지우면 **이전 화면이 그대로 남고**, 새 화면이 준비되면
 * 한 번에 바뀝니다 (세중님 1순위).
 * 그 대신 「가고 있다」를 알릴 자가 필요해서 이것을 씁니다.
 *
 * ── 공식 문서 (web/node_modules/next/dist/docs · useLinkStatus) ──
 *   "`useLinkStatus` is useful when … The destination route is **dynamic and doesn't
 *    include a `loading.js`** file that would allow an instant navigation."
 *   "**If the linked route has been prefetched, the pending state will be skipped**"
 *      ← 여섯 메뉴는 `prefetch={true}` 라 **아예 안 뜹니다** (그게 맞습니다)
 *   "`useLinkStatus` must be used within a descendant component of a `Link` component"
 *   "Prefer a **fixed-size, always-rendered** hint element … or use an animation"
 *      ← `fixed` 로 띄워 **흐름 밖**에 둡니다. 그래서 글이 밀리지 않습니다
 *
 * ── 500ms 를 어떻게 세나 ────────────────────────────────────
 * `pending` 이 참이 된 뒤 **500ms 가 지나야** 그립니다. 그 전에 끝나면 **한 번도 안 그립니다** —
 * 500ms 안에 끝나는 길에서는 화면이 **하나도 안 움직입니다**.
 */
export function 가는중() {
  const { pending } = useLinkStatus();
  const [보일까, set보일까] = useState(false);

  useEffect(() => {
    if (!pending) { set보일까(false); return; }
    /* 500ms 넘게 걸릴 때만 — 그 전에 끝나면 치웁니다 (아무것도 안 그린 셈) */
    const t = setTimeout(() => set보일까(true), 500);
    return () => clearTimeout(t);
  }, [pending]);

  if (!보일까) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] block h-[2px] overflow-hidden"
    >
      <span className="animate-진행 block h-full w-1/3 bg-ink/70" />
    </span>
  );
}
