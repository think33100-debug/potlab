import Link from 'next/link';
import { 안내글들 } from '@/lib/seo';

/* 안내 글(app/guide/*)이 함께 쓰는 조각 — 한 자리 (2026-11-13).
   피그마에 안내 글 화면은 없어 글 화면 틀(app/terms/[doc] · 화면 제목 26/35 · 본문 16/24)의 크기를 빌렸습니다 */

export const 작은제목 = 'rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)';
export const 본문 = 'rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)';
export const 도움말 = 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)';
export const 밑줄 = 'underline underline-offset-2';

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
          <li key={g.주소} className={본문}><Link href={g.주소} className={밑줄}>{g.이름}</Link></li>
        ))}
      </ul>
    </section>
  );
}
