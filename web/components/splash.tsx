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

/* 2026-11-11 밤 대표 — 피그마 「APP-START / 스플래시」 1226:342 로 바꿨습니다 (옛 이름 「피오티잡」 글자를 걷음).
   흰 바탕 · 「RAPO / 최종 로고 캡처 / 1.65초」 그림(414×310.5) · 그 바로 아래 「동료의 이야기를 더 가까이」 18/24 Medium.
   그림은 리액트 없이도 바로 뜨도록 그냥 img 입니다 (lazy 아님). 나타나고 사라지는 것은 그대로 CSS 가 합니다. */
export function Splash() {
  return (
    <div id="splash" aria-hidden>
      {/* ★ 2026-11-11 밤 대표 「앱 · 이어지게」 — 휴대폰(안드로이드 홈 화면 앱)이 먼저 띄우는 시작 화면은
          흰 바탕 가운데 R 아이콘입니다(site.webmanifest 의 아이콘·바탕색). 우리 첫 장면을 **그것과 같게** 시작해서
          그 R 이 로고 속 R 자리로 올라가 RAPO 로고로 이어집니다 (자리·크기는 2026-11-12 화면 녹화로 잰 값 · globals.css) */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 리액트가 붙기 전에도 떠야 합니다 */}
      <img src="/rapo/home/logo-symbol.svg" alt="" width={130} height={127} className="splash-mark" />
      {/* eslint-disable-next-line @next/next/no-img-element -- 리액트가 붙기 전에도 떠야 해서 next/image 를 안 씁니다 */}
      <img src="/rapo/home/splash-logo.webp" alt="" width={414} height={311} className="splash-name block h-auto w-full max-w-[414px]" />
      <p className="splash-line rapo-type-t6-medium break-keep text-(color:--rapo-color-fg-neutral)">
        동료의 이야기를 더 가까이
      </p>
    </div>
  );
}
