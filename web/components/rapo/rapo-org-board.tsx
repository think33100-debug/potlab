import Link from 'next/link';
import { OrgSave } from '@/components/org-save';
import { 어둠 } from './rapo-community';

/* 병원 게시판 — 새 디자인 「08 · C / 05 병원 탐색」 (2026-11-12 세중님 「다 피그마 기준으로」).
   원본: 「자유토론 · 병원 탐색에서 진입」 1328:2695 · 「병원 프로필 · 탐색」 1312:7741 ·
         「자유토론 · 글 없음」 1312:7867 · 「근무 후기 · 후기 없음」 1312:8087.

   ★ 병원별 자유토론과 근무 후기는 **아직 없는 기능**입니다. 그래서 두 탭 모두 원본의 「없음」 화면을 그대로 보입니다 —
     지어낸 글·별점은 넣지 않습니다. 「첫 근무 후기 쓰기」는 쓸 곳이 없어 「준비 중」으로 잠가 둡니다.
   ★ 전에 이 자리에 있던 기관 정보(치료사 인원 · 병상 · 바쁜 정도 · 이 기관 공고 · 가까운 곳 · 「공고 뜨면 알려주기」)는
     원본에 없어 잠시 빠집니다 (세중님 규칙: 피그마 우선 · 옛 기능은 잠시 빠짐). 그 화면은 components/org-detail.tsx 에 그대로 있습니다.
   ★ 오른쪽 위 책갈피는 원래 있던 「관심 병원 저장」(org_stars) 그대로입니다 — 내 정보 → 관심 병원에 모입니다. */

export type 병원탭 = 'talk' | 'review';

export function RapoOrgBoard({ name, sido, 탭, 있나 }: { name: string; sido: string | null; 탭: 병원탭; 있나: boolean }) {
  const 주소 = (t: 병원탭) => `/orgs?org=${encodeURIComponent(name)}&sido=${encodeURIComponent(sido ?? '')}${t === 'review' ? '&tab=review' : ''}`;
  return (
    <>
      {/* RAPO / App Bar — 어두운 판 · 「병원 게시판」 */}
      <header className="sticky top-0 z-20 flex h-[56px] items-center gap-(--rapo-dimension-x1) bg-[#0d1d29] px-(--rapo-dimension-x2)">
        <Link href="/orgs" aria-label="뒤로"
          className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
          <img src="/rapo/orgs/back-20.svg" alt="" width={20} height={20} />
        </Link>
        <p className="min-w-0 flex-1 text-[18px] font-bold leading-[26px] text-[#f6f8fa]">병원 게시판</p>
      </header>

      {/* 병원 프로필 · 탐색 (1312:7741) — 124 높이 · 그림 64 · 이름 24 Bold · 「병원 게시판」 · 책갈피 48 */}
      <section className="flex min-h-[124px] items-center gap-[20px] bg-[#1b3344] px-[22px] py-[20px]">
        <span className="flex size-[64px] shrink-0 items-center justify-center rounded-[14px] bg-[#ddecf2]">
          {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 「병원 기본 이미지」 */}
          <img src="/rapo/orgs/hospital-40.webp" alt="" width={52} height={52} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="break-keep text-[24px] font-bold leading-[32px] text-[#f4f6f8] [overflow-wrap:anywhere]">{name}</h1>
          <p className="mt-[4px] text-[14px] leading-[20px] text-[#bacad4]">병원 게시판</p>
        </div>
        {있나 && <OrgSave name={name} sido={sido} look="round" />}
      </section>

      {/* 자유토론 · 근무 후기 탭 */}
      <nav aria-label="병원 게시판" className="flex h-[56px] border-b" style={{ borderColor: 어둠.선 }}>
        {([['talk', '자유토론'], ['review', '근무 후기']] as const).map(([k, 글]) => (
          <Link key={k} href={주소(k)} aria-current={탭 === k ? 'page' : undefined} replace
            className="relative flex flex-1 items-center justify-center text-[17px] leading-[24px]"
            style={{ color: 탭 === k ? 어둠.글 : 어둠.흐린글, fontWeight: 탭 === k ? 700 : 400 }}>
            {글}
            {탭 === k && <span aria-hidden className="absolute inset-x-0 bottom-[-1px] h-[3px]" style={{ background: 어둠.밑줄 }} />}
          </Link>
        ))}
      </nav>

      {!있나 && (
        <p className="px-[22px] pt-[24px] text-[14px] leading-[20px]" style={{ color: 어둠.흐린글 }}>
          이 병원을 자료에서 찾지 못했어요. 이름이 바뀌었거나 문을 닫았을 수 있어요.
        </p>
      )}

      {탭 === 'talk' ? (
        /* 자유토론 · 글 없음 (1312:7867) */
        <section className="flex flex-col gap-[16px] px-[22px] pt-[112px]">
          <h2 className="text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>아직 토론 글이 없어요</h2>
          <p className="break-keep text-[15px] leading-[22px]" style={{ color: 어둠.흐린글 }}>교육이나 업무량 등 궁금한 점을 먼저 물어보세요.</p>
          <p className="text-[13px] leading-[19px]" style={{ color: 어둠.흐린글 }}>병원별 토론은 준비 중이에요. 지금은 커뮤니티에 글을 남겨 주세요.</p>
          <Link href="/community" className="flex h-[48px] items-center justify-center rounded-[12px] text-[15px] font-bold"
            style={{ background: 어둠.면, color: 어둠.글 }}>
            커뮤니티로 가기
          </Link>
        </section>
      ) : (
        /* 근무 후기 · 후기 없음 (1312:8087) — 「첫 근무 후기 쓰기」는 쓸 곳이 없어 잠가 둡니다 */
        <section className="flex flex-col gap-[16px] px-[22px] pt-[112px]">
          <h2 className="text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>아직 등록된 후기가 없어요</h2>
          <p className="break-keep text-[15px] leading-[22px]" style={{ color: 어둠.흐린글 }}>이 병원에서 일해 보셨나요? 첫 근무 경험을 들려주세요.</p>
          <button type="button" disabled aria-describedby="review-soon"
            className="mt-[56px] flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold opacity-50"
            style={{ background: 어둠.쓰기, color: '#fff' }}>
            첫 근무 후기 쓰기
          </button>
          <p id="review-soon" className="text-center text-[13px] leading-[19px]" style={{ color: 어둠.흐린글 }}>근무 후기는 준비 중이에요</p>
        </section>
      )}
    </>
  );
}
