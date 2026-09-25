import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { DiagStrip } from "@/components/diag";
import { Logo } from "@/components/logo";
import { SPLASH_SCRIPT, Splash } from "@/components/splash";
import { TabBar, TopNav } from "@/components/tab-bar";
import { TopbarUser } from "@/components/topbar-user";
import { siteUrl } from "@/lib/site-url";
import { AuthProvider } from "./auth";
import { BackGuard } from "./back-guard";
import { SURFACE_SCRIPT, Surface } from "./surface";
import { ToastProvider } from "./toast";
import "./globals.css";

export const metadata: Metadata = {
  /* 공유한 링크의 미리보기 그림 주소를 절대 주소로 만들어 줍니다.
     이게 없으면 /og.png 가 상대 주소로 나가 카톡이 그림을 못 찾습니다.
     배포 주소는 Vercel 이 알아서 알려줍니다 — lib/site-url.ts 참고 */
  metadataBase: new URL(siteUrl()),
  title: "POTJOB · 채용공고",
  description: "작업치료사·물리치료사 채용공고를 한곳에서",
  /* 브랜드 명세서 7번 — 파비콘·홈 화면 아이콘·PWA */
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: { title: "POTJOB" },
};

/* 주소창·작업전환 화면 색. 브랜드 빨강입니다 */
export const viewport: Viewport = { themeColor: "#FF3B30" };

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
      </head>
      {/* 밝은 바탕은 potjob_paper 입니다. 흰색은 카드 안쪽에만 씁니다 —
          종이색 위에 흰 카드가 떠야 카드가 카드로 보입니다 */}
      <body className="flex min-h-full flex-col bg-paper text-gray-900 dark:bg-gray-900 dark:text-white">
        <ToastProvider>
        <AuthProvider>
          <BackGuard />
          <Surface />
          <Splash />

          {/* 탑바 56px · 그림자 없이 아래 보더만 — teamsparta.md */}
          <header className="sticky top-0 z-40 h-[56px] shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-6 md:px-7">
              <div className="flex items-center gap-6">
                <Link href="/" aria-label="POTJOB 홈">
                  <Logo />
                </Link>
                <TopNav />
              </div>
              <TopbarUser />
            </div>
          </header>

          {children}

          {/* 직업정보제공사업 신고 사항. 모든 화면 맨 아래에 작게 둡니다 —
              신고번호는 화면에 밝혀야 하는 것이라 한 화면만 빠지면 안 됩니다.
              휴대폰에서는 탭바(62px)에 가리지 않게 아래를 더 띄웁니다 */}
          <footer className="mx-auto w-full max-w-3xl px-6 pb-[78px] pt-7 md:px-7 md:pb-7">
            <p className="break-keep text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              직업정보제공사업 신고번호 J1401020260007
              <br />
              주식회사 빈틈 · 대구 북구 동북로 291, 901-A156호
            </p>
          </footer>

          {/* 주소 끝에 ?진단=1 을 붙였을 때만 보입니다.
              관리자에게만 보이게 할 수가 없습니다 — 관리자인지 아는 방법이
              바로 지금 고장난 그 판정입니다 (components/diag.tsx) */}
          <DiagStrip />

          {/* 휴대폰에서만 보이는 아래 탭바 */}
          <TabBar />
        </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
