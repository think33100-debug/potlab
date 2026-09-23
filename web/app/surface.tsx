'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/* 어두운 바탕을 쓰는 화면. 커뮤니티는 글을 읽는 곳이라 눈이 편해야 하고,
   들어왔을 때 「다른 공간」이라는 게 바로 보여야 합니다.
   /post 도 커뮤니티 글이라 같이 넣습니다. */
export const DARK_PATHS = ['/community', '/post'];

/* 반대로, 기기가 어두운 모드여도 밝게 고정하는 화면.

   홈은 랜딩이라 「히어로만 어둡고 나머지는 종이색」이 전부입니다.
   기기 설정을 따라가게 두면 탑바·탭바만 어두워지고 본문은 종이색이라
   위아래가 따로 놉니다 (실제로 그렇게 나왔습니다). */
export const LIGHT_PATHS = ['/', '/orgs'];

/* 아래로 딸린 화면까지 통째로 밝게 고정하는 자리.

   공고 상세(/jobs/<id>)는 색을 전부 직접 박아 그립니다 — 바탕 #F4F4F1,
   글자 #14181C. 그런데 고정을 안 해두면, 기기가 어두운 모드일 때
   색을 안 박은 조각만 dark: 쪽으로 넘어갑니다.
   「이 기관은 이런 곳이에요」의 기관 이름이 그랬습니다 —
   body 의 dark:text-white 를 물려받아 종이색 위에서 대비 1.10:1 이 됐습니다.
   탑바·탭바만 검게 뜨던 것도 같이 풀립니다.

   목록(/jobs)은 여기 안 넣습니다. 그 화면은 dark: 짝을 제대로 갖추고 있어
   어두운 모드에서 멀쩡합니다 — 고정하면 오히려 뺏는 것이 됩니다. */
export const LIGHT_TREES = ['/jobs/'];

export const isDark = (path: string) =>
  DARK_PATHS.some((p) => path === p || path.startsWith(p + '/'));

export const isLight = (path: string) =>
  LIGHT_PATHS.includes(path) || LIGHT_TREES.some((p) => path.startsWith(p));

/* 그리기 전에 한 번 칠합니다.
   effect 로만 두면 링크를 눌러 바로 들어온 사람이 흰 화면을 한 번 봅니다 */
export const SURFACE_SCRIPT =
  `(function(){try{var p=location.pathname;var d=${JSON.stringify(DARK_PATHS)}` +
  `.some(function(x){return p===x||p.indexOf(x+"/")===0});` +
  `if(d){document.documentElement.dataset.surface="dark";}` +
  `else if(${JSON.stringify(LIGHT_PATHS)}.indexOf(p)>=0||` +
  `${JSON.stringify(LIGHT_TREES)}.some(function(x){return p.indexOf(x)===0}))` +
  `{document.documentElement.dataset.surface="light";}}catch(e){}})()`;

/* 화면을 옮겨 다닐 때 따라 바꿉니다 */
export function Surface() {
  const path = usePathname();
  useEffect(() => {
    const el = document.documentElement;
    if (isDark(path)) el.dataset.surface = 'dark';
    else if (isLight(path)) el.dataset.surface = 'light';
    else delete el.dataset.surface;
  }, [path]);
  return null;
}
