import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { TabBar, TopNav } from "@/components/tab-bar";
import { TopbarUser } from "@/components/topbar-user";
import { siteUrl } from "@/lib/site-url";
import { AuthProvider } from "./auth";
import { BackGuard } from "./back-guard";
import { SignupGuard } from "./signup-guard";
import { ToastProvider } from "./toast";
import "./globals.css";

export const metadata: Metadata = {
  /* 공유한 링크의 미리보기 그림 주소를 절대 주소로 만들어 줍니다.
     이게 없으면 /og.png 가 상대 주소로 나가 카톡이 그림을 못 찾습니다.
     배포 주소는 Vercel 이 알아서 알려줍니다 — lib/site-url.ts 참고 */
  metadataBase: new URL(siteUrl()),
  title: "POT JOB · 채용공고",
  description: "작업치료사·물리치료사 채용공고를 한곳에서",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    /* 글꼴은 globals.css 의 --font-sans (Pretendard) 가 정합니다.
       next/font 의 Geist 는 뺐습니다 — teamsparta.md 의 글꼴이 아닙니다 */
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-white">
        <ToastProvider>
        <AuthProvider>
          <BackGuard />
          <SignupGuard />

          {/* 탑바 56px · 그림자 없이 아래 보더만 — teamsparta.md */}
          <header className="sticky top-0 z-40 h-[56px] shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-6 md:px-7">
              <div className="flex items-center gap-6">
                <Link href="/" aria-label="POT JOB 홈">
                  <Logo />
                </Link>
                <TopNav />
              </div>
              <TopbarUser />
            </div>
          </header>

          {children}

          {/* 휴대폰에서만 보이는 아래 탭바 */}
          <TabBar />
        </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
