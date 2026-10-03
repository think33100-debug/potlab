'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* 어두운 바탕을 쓰는 화면. 커뮤니티는 글을 읽는 곳이라 눈이 편해야 하고,
   들어왔을 때 「다른 공간」이라는 게 바로 보여야 합니다.
   /post 도 커뮤니티 글이라 같이 넣습니다. */
export const DARK_PATHS = ['/community', '/post'];

/* ★ 2026-10-03 — 규칙을 뒤집었습니다 (세중님 결정)
 *
 *   전   밝게 고정한 곳만 밝고, 나머지는 **기기 설정을 따라갔습니다.**
 *        목록 ['/', '/orgs'] + ['/jobs/'] 셋뿐이었습니다.
 *        그래서 기기가 어두운 모드면 채용공고·월급확인·스펙쌓기가 다 어두웠습니다.
 *
 *   후   **커뮤니티만 어둡게, 그 밖에는 전부 밝게.**
 *        기기가 어두운 모드여도 커뮤니티 밖은 밝게 나옵니다.
 *
 *   이렇게 두면 새로 만드는 화면(/volunteer · /tools · /edu · /youth …)이
 *   **저절로 밝게** 나옵니다. 화면마다 고정 목록에 더할 일이 없습니다.
 *   화면마다 색을 박는 대신 이 한 자리로 정합니다.
 *
 *   밝은 모드 색·글꼴·여백은 teamsparta.md 의 토큰을 씁니다 —
 *   globals.css 가 그 문서에서 옮겨온 값입니다. 값을 화면에 박지 마십시오. */
export const isDark = (path: string) =>
  DARK_PATHS.some((p) => path === p || path.startsWith(p + '/'));

/** 커뮤니티가 아니면 전부 밝습니다 */
export const isLight = (path: string) => !isDark(path);

/* 그리기 전에 한 번 칠합니다.
   effect 로만 두면 링크를 눌러 바로 들어온 사람이 흰 화면을 한 번 봅니다 */
export const SURFACE_SCRIPT =
  `(function(){try{var p=location.pathname;var d=${JSON.stringify(DARK_PATHS)}` +
  `.some(function(x){return p===x||p.indexOf(x+"/")===0});` +
  `document.documentElement.dataset.surface=d?"dark":"light";}catch(e){}})()`;

/* 화면을 옮겨 다닐 때 따라 바꿉니다 */
export function Surface() {
  const path = usePathname();
  useEffect(() => {
    /* 늘 둘 중 하나로 못 박습니다. 지우면 기기 설정을 따라가 버립니다 */
    document.documentElement.dataset.surface = isDark(path) ? 'dark' : 'light';
  }, [path]);
  return null;
}
