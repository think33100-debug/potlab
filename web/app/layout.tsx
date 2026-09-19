import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}
