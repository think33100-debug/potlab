/* 앱 시작 화면.

   나타나고 사라지는 것은 전부 CSS 가 합니다 (app/globals.css 의 #splash).
   여기는 글자만 놓습니다 — 치우는 자바스크립트가 없어야 리액트가 붙기 전에
   이미 화면에 떠 있을 수 있습니다.

   <head> 에서 도는 이 짧은 스크립트가 띄울지 말지만 정합니다.
   공유 링크로 들어온 사람이 2초를 기다리면 안 되고, 탭을 옮길 때마다
   다시 뜨면 성가십니다. 그래서 **들어오는 자리**와 **이번 방문 한 번**만 봅니다.

   자리가 둘입니다 (2026-10-04) —
     앱        홈(/) 으로 들어왔을 때
     커뮤니티   /community 로 들어왔을 때
   세는 자리를 따로 둡니다. 홈에서 한 번 보고 커뮤니티로 가면 커뮤니티에서
   한 번 더 봅니다 — 광고를 자리마다 따로 걸기 때문입니다.

   dataset.splashSlot 은 **components/splash-ad.tsx 가 읽습니다.**
   그 겹이 광고 배너를 띄울지 정합니다 (배너가 없으면 짧은 화면만). */
export const SPLASH_SCRIPT =
  `(function(){try{` +
  `var p=location.pathname;` +
  `var s=p==="/"?"앱":(p==="/community"||p.indexOf("/community/")===0)?"커뮤니티":"";` +
  `if(!s)return;` +
  `var k="potjob.splash."+s;` +
  `if(sessionStorage.getItem(k))return;` +
  `sessionStorage.setItem(k,"1");` +
  `var d=document.documentElement.dataset;` +
  `d.splash="on";d.splashSlot=s;` +
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
