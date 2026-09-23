/* 앱 시작 화면.

   나타나고 사라지는 것은 전부 CSS 가 합니다 (app/globals.css 의 #splash).
   여기는 글자만 놓습니다 — 치우는 자바스크립트가 없어야 리액트가 붙기 전에
   이미 화면에 떠 있을 수 있습니다.

   <head> 에서 도는 이 짧은 스크립트가 띄울지 말지만 정합니다.
   홈으로 들어온 첫 한 번에만 띄웁니다 — 공유 링크로 들어온 사람이
   2초를 기다리면 안 되고, 탭을 옮길 때마다 다시 뜨면 성가십니다. */
export const SPLASH_SCRIPT =
  `(function(){try{` +
  `if(location.pathname!=="/")return;` +
  `if(sessionStorage.getItem("potjob.splash"))return;` +
  `sessionStorage.setItem("potjob.splash","1");` +
  `document.documentElement.dataset.splash="on";` +
  `}catch(e){}})()`;

export function Splash() {
  return (
    <div id="splash" aria-hidden>
      <p className="splash-name break-keep text-[40px] font-bold leading-none text-[#14181C]">
        피오티잡
      </p>
      <p className="splash-line break-keep text-[15px] leading-[1.7] text-[#4A5056]">
        치료사들이 더 나은 곳으로 갈 수 있게
        <br />
        함께하겠습니다
      </p>
    </div>
  );
}
