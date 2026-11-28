'use client';

import { useState } from 'react';

/* 기관 사진 띠 · 맨 아래 출처 한 줄 (2026-11-23 세중님 「출처는 제일 아래 작게」).
   값은 lib/org-photo.ts 한 자리에서 옵니다. 그림을 못 불러오면 띠를 통째로 안 그립니다 — 깨진 그림을 회원에게 보이지 않게.
   띠 비율은 피그마 「병원 화면 위 사진 띠」 414×130 에 가깝게 두되, 넓은 화면에서 너무 길어지지 않게 높이를 묶습니다. */

export function RapoOrgPhoto({ src, alt }: { src: string; alt: string }) {
  const [깨짐, 깨짐두기] = useState(false);
  if (깨짐) return null;
  return (
    <figure className="relative m-0 aspect-[414/150] max-h-[240px] w-full overflow-hidden bg-(--rapo-color-bg-neutral-weak)">
      {/* eslint-disable-next-line @next/next/no-img-element -- 바깥 주소(Storage) 사진 · 크기 고정 띠 */}
      <img src={src} alt={alt} loading="eager" decoding="async" onError={() => 깨짐두기(true)}
        className="size-full object-cover object-center" />
    </figure>
  );
}

/** 맨 아래 작은 출처 — 「사진 출처 · 아주대학교병원 병원 누리집 보도자료」 한 줄씩 (출처 쪽으로 링크) */
export function RapoPhotoCredit({ 줄, 어두움 = false }: { 줄: { 말: string; 글: string; 주소: string }[]; 어두움?: boolean }) {
  return (
    <div className={'rapo-type-t2-regular flex flex-col gap-(--rapo-dimension-x1) break-keep px-(--rapo-dimension-x5) py-(--rapo-dimension-x3) ' +
      (어두움 ? 'text-[#8fa3b0]' : 'text-(color:--rapo-color-fg-neutral-subtle)')}>
      {줄.map((c) => (
        <p key={c.말}>
          {c.말} 출처 ·{' '}
          <a href={c.주소} target="_blank" rel="noopener noreferrer"
            className="underline decoration-current/40 underline-offset-2">{c.글}</a>
        </p>
      ))}
    </div>
  );
}
