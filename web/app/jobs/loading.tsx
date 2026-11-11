import { 받는중 } from '@/components/rapo/rapo-job-results';
import { RapoShell } from '@/components/rapo/rapo-shell';

/* 공고 목록으로 넘어가는 동안 — 하단 탐색을 누르면 서버가 DB 를 읽는 동안 화면이 멈춘 것처럼 보였습니다
   (2026-11-11 밤 대표 「너무 오래 걸려」). 이 뼈대가 먼저 떠서 바로 넘어간 것처럼 보입니다 (Next loading.js) */
export default function JobsLoading() {
  return (
    <RapoShell who="모름" current="/jobs">
      <section className="flex flex-col gap-(--rapo-dimension-x4) p-(--rapo-dimension-x5)">
        <h1 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">채용 공고</h1>
        <div aria-hidden className="h-(--rapo-dimension-x13) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak)" />
      </section>
      <받는중 />
    </RapoShell>
  );
}
