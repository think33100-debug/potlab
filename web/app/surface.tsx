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
export const LIGHT_PATHS = ['/'];

export const isDark = (path: string) =>
  DARK_PATHS.some((p) => path === p || path.startsWith(p + '/'));

export const isLight = (path: string) => LIGHT_PATHS.includes(path);

/* 그리기 전에 한 번 칠합니다.
   effect 로만 두면 링크를 눌러 바로 들어온 사람이 흰 화면을 한 번 봅니다 */
export const SURFACE_SCRIPT =
  `(function(){try{var p=location.pathname;var d=${JSON.stringify(DARK_PATHS)}` +
  `.some(function(x){return p===x||p.indexOf(x+"/")===0});` +
  `if(d){document.documentElement.dataset.surface="dark";}` +
  `else if(${JSON.stringify(LIGHT_PATHS)}.indexOf(p)>=0)` +
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
