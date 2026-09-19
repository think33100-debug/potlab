import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { BackGuard } from "./back-guard";
import { ToastProvider } from "./toast";
import "./globals.css";

export const metadata: Metadata = {
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
          <BackGuard />

          {/* 탑바 56px · 그림자 없이 아래 보더만 — teamsparta.md */}
          <header className="sticky top-0 z-40 h-[56px] shrink-0 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-6 md:px-7">
              <Link href="/" aria-label="POT JOB 홈">
                <Logo />
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-gray-200 px-4 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950"
              >
                로그인
              </Link>
            </div>
          </header>

          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
