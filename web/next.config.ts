import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ★ 2026-10-29 세중님 — 미리 받은 것을 **얼마나 오래 쓰나** (초)
   *
   * 「딱 넘어가게」 하려고 여섯 메뉴 링크에 `prefetch={true}` 를 걸었습니다
   * (web/lib/routes.ts 의 `미리받을곳`). 공식 문서 (node_modules/next/dist/docs ·
   * Next 16.3.5 · experimental/staleTimes) —
   *   "The `static` property is used for statically generated pages, **or when the
   *    `prefetch` prop on `Link` is set to `true`** … Default: 5 minutes"
   *   "The `dynamic` property is used when the page is neither statically generated
   *    nor fully prefetched … Default: 0 seconds"
   *
   * ★ **기본 5분은 우리에게 너무 깁니다.** 그 사이 `정리매시`(매시 5분)가 마감 지난
   *   공고를 내려도, 미리 받아 둔 목록에는 **5분 동안 그대로 남습니다** —
   *   신뢰 셋 ①(마감 지난 공고가 회원 화면에 보임)이 깨지는 자리입니다.
   *   세중님이 「30초 안쪽」이라 하셨고, 그래서 **30** 으로 둡니다.
   * ★ `dynamic` 도 30 으로 둡니다 — 미리 받기가 안 걸린 쪽(기본값 auto)도
   *   한 번 받은 것을 30초는 씁니다. 마감 내림 주기(한 시간)보다 훨씬 짧습니다.
   * 되돌림 — 이 `experimental` 묶음을 지우면 Next 기본값(static 5분 · dynamic 0초)입니다
   */
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },
};

export default nextConfig;
