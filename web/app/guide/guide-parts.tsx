import Link from 'next/link';
import type { ReactNode } from 'react';
import { 안내글들 } from '@/lib/seo';

/* 안내 글(app/guide/*)이 함께 쓰는 조각 — 한 자리 (2026-11-13).
   피그마에 안내 글 화면은 없어 글 화면 틀(app/terms/[doc] · 화면 제목 26/35 · 본문 16/24)의 크기를 빌렸습니다 */

export const 작은제목 = 'rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)';
export const 본문 = 'rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)';
export const 도움말 = 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)';
export const 밑줄 = 'underline underline-offset-2';

/** 「A · B」의 가운뎃점이 줄 머리로 넘어가지 않게, 점 앞의 빈칸을 안 끊기는 빈칸으로 바꿉니다.
    (375 폭에서 「· 취업 후기」로 시작하는 줄이 나왔습니다 — RAPO노트/화면표시_규칙_1113.md 1번) */
export const 점붙임 = (s: string) => s.split(' · ').join('\u00a0· ');

/** 큰 화면(768 이상)에서 단추가 글 기둥 끝까지 늘어나지 않게 하는 폭 — RapoButton 의 full 과 함께 씁니다 (2026-11-13 세중님 「피씨 모드는 어색」) */
export const 단추폭 = 'md:max-w-[360px]';

/** 이름-값 줄 — 공고 상세의 RapoGuideRow 와 같은 모양(이름 72px)입니다.
    큰 화면에서 칸을 옆으로 나란히 놓으면 값 자리가 좁아지므로, 그때는 이름을 값 위에 둡니다 */
export function GuideRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-(--rapo-dimension-x4) md:flex-col md:gap-(--rapo-dimension-x1)">
      <p className="rapo-type-t4-medium w-[72px] shrink-0 pt-[2px] text-(color:--rapo-color-fg-neutral-muted) md:w-auto md:pt-0">{label}</p>
      <div className="rapo-type-article-body min-w-0 flex-1 break-keep text-(color:--rapo-color-fg-neutral)">{children}</div>
    </div>
  );
}

/** 「다른 안내 글」 — 지금 글을 뺀 나머지로 가는 링크. 목록은 lib/seo.ts 안내글들 한 자리(사이트맵과 같은 목록)입니다.
    안내 글은 앱 메뉴에 걸려 있지 않아서, 글끼리 이어 주는 링크가 이것뿐입니다 */
export function OtherGuides({ 지금 }: { 지금: string }) {
  const 나머지 = 안내글들.filter((g) => g.주소 !== 지금);
  if (나머지.length === 0) return null;
  return (
    <section aria-labelledby="안내-다른글" className="flex flex-col gap-(--rapo-dimension-x3)">
      <h2 id="안내-다른글" className={작은제목}>다른 안내 글</h2>
      <ul className="flex flex-col gap-(--rapo-dimension-x2)">
        {나머지.map((g) => (
          <li key={g.주소} className={본문}><Link href={g.주소} className={밑줄}>{점붙임(g.이름)}</Link></li>
        ))}
      </ul>
    </section>
  );
}
