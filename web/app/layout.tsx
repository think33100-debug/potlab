import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { LegacyChrome, RapoChromeGap } from "@/components/chrome-switch";
import { DiagStrip } from "@/components/diag";
import { Logo } from "@/components/logo";
import { SPLASH_SCRIPT, Splash } from "@/components/splash";
import { PersonaBar } from "@/components/persona-bar";
import { SplashAd } from "@/components/splash-ad";
import { KakaoFab } from "@/components/kakao-fab";
import { TabBar, TopNav } from "@/components/tab-bar";
import { TopbarUser } from "@/components/topbar-user";
import { COMPANY, PRIVACY_EMAIL, PRIVACY_OFFICER } from "@/lib/contact";
import { 안내글들 } from "@/lib/seo";
import { siteUrl, 그림판 } from "@/lib/site-url";
import { AuthProvider } from "./auth";
import { BackGuard } from "./back-guard";
import { SURFACE_SCRIPT, Surface } from "./surface";
import { ToastProvider } from "./toast";
import "./globals.css";

export const metadata: Metadata = {
  /* 공유한 링크의 미리보기 그림 주소를 절대 주소로 만들어 줍니다.
     이게 없으면 미리보기 그림(/api/og/site 등)이 상대 주소로 나가 카톡이 그림을 못 찾습니다.
     배포 주소는 Vercel 이 알아서 알려줍니다 — lib/site-url.ts 참고 */
  metadataBase: new URL(siteUrl()),
  title: "RAPO · 채용공고",
  description: "작업치료사·물리치료사 채용공고를 한곳에서",
  /* ★ 2026-11-12 밤 세중님 — 공고가 아닌 링크(홈·가입 링크·로그인 …)의 카톡 미리보기 그림.
     전에는 없어서 카톡이 예전에 받아 둔 옛 그림을 보였습니다. 공고·글은 자기 그림으로 덮어씁니다 */
  openGraph: {
    type: "website",
    siteName: "RAPO",
    title: "RAPO · 채용공고",
    description: "작업치료사·물리치료사 채용공고를 한곳에서",
    images: [`/api/og/site?v=${그림판}`],
  },
  twitter: { card: "summary_large_image", images: [`/api/og/site?v=${그림판}`] },
  /* 브랜드 명세서 7번 — 파비콘·홈 화면 아이콘·PWA */
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: { title: "RAPO" },
  /* ★ 2026-11-11 — 클로즈드 베타 동안 검색엔진에 안 올립니다 (기본값).
     2026-11-13 세중님 「검색 가능하게」 — 비회원도 보는 쪽(홈·공고 목록·문의·약관)만 자기 metadata 로 덮어 엽니다 (lib/seo.ts) */
  robots: { index: false, follow: false },
  /* 검색엔진 주인 확인 (2026-11-13 세중님 등록) — 구글 서치 콘솔 · 네이버 서치어드바이저 「HTML 태그」 값.
     비밀이 아니라 누구나 보는 값입니다. 지우면 두 곳이 주인 확인을 다시 하라고 합니다 */
  verification: {
    google: "Wzvm2N9IyH40A72GmOb4T5B50ixK29Mx0WGfEE3Mdu4",
    other: { "naver-site-verification": "ecb94855f5126c0a737c9c62b1b95ac906ca80b0" },
  },
};

/* 휴대폰 주소창 색 — 새 디자인 헤더가 흰색이라 흰색 (2026-11-11 · site.webmanifest 의 theme_color 와 한 쌍) */
export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* 글꼴은 globals.css 의 --font-sans (Pretendard) 가 정합니다.
       next/font 의 Geist 는 뺐습니다 — teamsparta.md 의 글꼴이 아닙니다 */
    /* 아래 script 가 그리기 전에 html 에 표시를 답니다.
       서버가 보낸 것과 달라지는 게 정상이라 리액트에게 미리 알려 둡니다 */
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 커뮤니티로 바로 들어온 사람이 흰 화면을 한 번 보지 않게,
            리액트가 그리기 전에 바탕을 정합니다 */}
        <script dangerouslySetInnerHTML={{ __html: SURFACE_SCRIPT }} />
        {/* 앱 시작 화면을 띄울지만 정합니다. 그리는 것은 CSS 입니다 */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        {/* 첫 화면 로고 그림을 먼저 받아 둡니다 — 늦게 오면 로고가 뜨자마자 사라지는 것처럼 보였습니다 (16KB · 2026-11-11) */}
        <link rel="preload" as="image" href="/rapo/home/splash-logo.webp" type="image/webp" />
      </head>
      {/* 밝은 바탕은 potjob_paper 입니다. 흰색은 카드 안쪽에만 씁니다 —
          종이색 위에 흰 카드가 떠야 카드가 카드로 보입니다 */}
      <body className="flex min-h-full flex-col bg-paper text-gray-900 dark:bg-gray-900 dark:text-white">
        <ToastProvider>
        <AuthProvider>
          <BackGuard />
          <Surface />
          <Splash />
          {/* 광고 배너가 걸려 있을 때만 오픈 화면 위에 덮습니다.
              없거나 꺼져 있으면 아무것도 안 그립니다 (2026-10-04) */}
          <SplashAd />

          {/* 탑바 56px · 그림자 없이 아래 보더만 — teamsparta.md.
              새 디자인 화면(홈)은 자기 헤더를 그리므로 거기서는 이 줄을 그리지 않습니다
              (LegacyChrome · lib/nav.ts 의 새틀화면). 줄 안쪽은 그대로입니다 */}
          <LegacyChrome>
          <header className="sticky top-0 z-40 h-[56px] shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-6 md:px-7">
              <div className="flex items-center gap-6">
                <Link href="/" aria-label="RAPO 홈">
                  <Logo />
                </Link>
                <TopNav />
              </div>
              <TopbarUser />
            </div>
          </header>
          </LegacyChrome>

          {children}

          {/* 직업정보제공사업 신고 사항. 모든 화면 맨 아래에 작게 둡니다 —
              신고번호는 화면에 밝혀야 하는 것이라 한 화면만 빠지면 안 됩니다.
              휴대폰에서는 탭바(62px)에 가리지 않게 아래를 더 띄웁니다 */}
          <footer className="mx-auto w-full max-w-3xl px-6 pb-[78px] pt-7 md:px-7 md:pb-7">
            <p className="break-keep text-sm leading-relaxed text-mute dark:text-gray-400">
              {/* 사업자 정보도 lib/contact.ts 한 곳에서 가져옵니다 (2026-10-05).
                  여기 박아 두면 주소를 옮길 때 이 줄만 안 바뀝니다 */}
              직업정보제공사업 신고번호 {COMPANY.신고번호}
              <br />
              {COMPANY.이름} · {COMPANY.주소}
              <br />
              {/* 개인정보 보호책임자는 방침에 밝혀야 하고, 어느 화면에서든
                  찾을 수 있어야 합니다 (2026-10-01).
                  사람 이름 대신 팀 이름을 적습니다 (2026-10-05 세중님 지시) */}
              개인정보 보호책임자 {PRIVACY_OFFICER.이름} ·{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`} className="underline underline-offset-2">
                {PRIVACY_EMAIL}
              </a>
            </p>
            {/* 안내 글 바로가기 (2026-11-13 세중님 「우리 사이트에서 바로가기」) — 검색으로 들어오는 글이지만
                회원도 찾을 수 있게, 모든 화면 맨 아래에 작게 둡니다. 목록은 lib/seo.ts 안내글들(꼬리말 이름이 있는 글만).
                약관 줄 위에 둡니다 — 아래에 두면 약관 줄이 올라가 떠 있는 카카오 단추에 「문의하기」가 더 가립니다 */}
            <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute dark:text-gray-400" aria-label="안내 글">
              {안내글들.filter((g) => g.꼬리말).map((g) => (
                <Link key={g.주소} href={g.주소} className="hover:underline">{g.꼬리말}</Link>
              ))}
            </nav>
            <nav className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute dark:text-gray-400"
              aria-label="약관과 문의">
              <Link href="/terms/service" className="hover:underline">이용약관</Link>
              <Link href="/terms/privacy" className="font-bold hover:underline">개인정보처리방침</Link>
              <Link href="/terms/community" className="hover:underline">커뮤니티 이용규칙</Link>
              <Link href="/contact" className="hover:underline">문의하기</Link>
            </nav>
          </footer>
          {/* 새 디자인 화면의 하단 탐색은 넓은 화면에서도 보여서, 그만큼 밑을 띄웁니다 */}
          <RapoChromeGap />

          {/* 주소 끝에 ?진단=1 을 붙였을 때만 보입니다.
              관리자에게만 보이게 할 수가 없습니다 — 관리자인지 아는 방법이
              바로 지금 고장난 그 판정입니다 (components/diag.tsx) */}
          <DiagStrip />

          {/* 휴대폰에서만 보이는 아래 탭바 */}
          <TabBar />

          {/* 카카오톡 문의 단추 — 모든 화면 오른쪽 아래에 떠 있습니다 (2026-11-12 세중님) */}
          <KakaoFab />

          {/* 마스터 계정에게만 보이는 역할 바꾸기 띠 (2026-10-09).
              탭바(z-40) 위에 얹습니다 — z-[60] */}
          <PersonaBar />
        </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
