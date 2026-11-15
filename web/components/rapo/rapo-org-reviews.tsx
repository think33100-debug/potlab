import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { 후기질문, type 후기답 } from '@/lib/work-review';
import { 어둠 } from './rapo-community';

/* 병원 근무 후기 — 피그마 「08 · C / 06 근무 후기」 병원별 목록 1328:2701 · 「작성자 3명 미만」 1496:4472 (2026-11-15 세중님 「피그마댓글 대로」).
   자료는 app/orgs/page.tsx 가 공개근무후기 보기에서 받아 넘깁니다(금고 SQL_1113/ZN).

   ★ 쓴 사람 — 닉네임 + 「재직 인증」 딱지 (2026-11-15 세중님 「닉네임+재직인증 딱지를 붙여서」). 탈퇴한 분은 「찾을 수 없는 회원」.
     딱지는 그 병원 재직 인증(확인)을 받은 후기에만 — 임상가 전환(/me/convert)으로 쓴 후기는 인증 없이 들어옵니다
     (세중님 「재직 인증 없이 하고 추후에 한 번에 쭉 인증」 · 보기의 「재직인증」 칸 · 금고 SQL_1113/ZT).
     목록은 글을 앞 120자만 받습니다(공개근무후기 보기) — 전문은 상세에서 근무후기보기() 로 (학생 하루 3개 · 금고 SQL_1113/ZO).
   ★ 평균 별점은 작성자 3명부터 (피그마 「3명부터 평균 평점 공개」).
   ★ 객관식은 일곱 (2026-11-15 세중님 · lib/work-review.ts 한 자리) · 별은 모서리가 둥근 꼴(세중님 「좀 더 동글동글한 느낌」). */

export type 근무후기 = 후기답 & {
  id: number; 기관: string; 별점: number;
  글: string | null; 쓴때: string; 내것: boolean;
  닉네임?: string | null; 그림?: string | null; 더있음?: boolean | null; 재직인증?: boolean | null;
};

/* 쓴 사람 줄 — 그림 32 · 닉네임 · 재직 인증 딱지 · 날 (목록·상세가 같이 씁니다) */
export function 후기쓴이({ h }: { h: 근무후기 }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-[10px]">
      <Avatar value={h.그림 ?? null} size="c32" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-[6px]">
          <span className="truncate text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>{h.닉네임 ?? '찾을 수 없는 회원'}</span>
          {h.재직인증 && <span className="shrink-0 whitespace-nowrap rounded-[4px] px-[6px] py-[1px] text-[11px] font-bold leading-[16px]" style={{ background: '#264e58', color: '#def9f2' }}>재직 인증</span>}
        </span>
        <span className="block text-[12px] leading-[17px]" style={{ color: 어둠.흐린글 }}>{후기날(h.쓴때)}{h.내것 ? ' · 내 후기' : ''}</span>
      </span>
    </div>
  );
}

export const 후기날 = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
};

/* 둥근 별 하나 — 꼭짓점을 둥글게(선 이음 round). 켜면 채움, 끄면 테두리만 */
export function 둥근별({ 켬 = true, 크기 = 16, 색 = '#ffa691' }: { 켬?: boolean; 크기?: number; 색?: string }) {
  return (
    <svg aria-hidden width={크기} height={크기} viewBox="0 0 24 24" className="shrink-0">
      <path d="M12 3.6l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.4l-5 2.65.95-5.6L3.9 9.5l5.6-.8z"
        fill={켬 ? 색 : 'none'} stroke={색} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* 별 다섯 줄 (상세) */
export function 별줄({ n, 크기 = 16 }: { n: number; 크기?: number }) {
  return <span aria-hidden className="inline-flex items-center gap-[2px]">{[1, 2, 3, 4, 5].map((k) => <둥근별 key={k} 켬={k <= n} 크기={크기} />)}</span>;
}

export function RapoOrgReviews({ name, sido, 후기들, 인증됨 }: { name: string; sido: string | null; 후기들: 근무후기[]; 인증됨: boolean }) {
  const 쓰기 = `/orgs/review/write?org=${encodeURIComponent(name)}&sido=${encodeURIComponent(sido ?? '')}`;
  const 내후기 = 후기들.find((h) => h.내것);

  if (후기들.length === 0) {
    return (
      <section className="flex flex-col gap-[16px] px-[22px] pt-[112px]">
        <h2 className="text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>아직 등록된 후기가 없어요</h2>
        <p className="break-keep text-[15px] leading-[22px]" style={{ color: 어둠.흐린글 }}>이 병원에서 일해 보셨나요? 첫 근무 경험을 들려주세요.</p>
        <Link href={쓰기} className="mt-[56px] flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold"
          style={{ background: 어둠.쓰기, color: '#fff' }}>
          첫 근무 후기 쓰기
        </Link>
      </section>
    );
  }

  const 평균 = 후기들.reduce((s, h) => s + h.별점, 0) / 후기들.length;
  return (
    <section className="flex flex-col gap-[16px] px-[22px] pb-[24px] pt-[28px]">
      {후기들.length >= 3 ? (
        <div>
          <p className="flex items-center gap-[8px] text-[32px] font-bold leading-[40px]" style={{ color: '#ffa691' }}>
            <둥근별 크기={30} />{평균.toFixed(1)}
          </p>
          <p className="mt-[6px] text-[14px] leading-[20px]" style={{ color: 어둠.흐린글 }}>근무 후기 {후기들.length}개</p>
        </div>
      ) : (
        <div>
          <p className="text-[22px] font-bold leading-[32px]" style={{ color: 어둠.글 }}>평점 집계 중</p>
          <p className="mt-[6px] text-[14px] leading-[20px]" style={{ color: 어둠.흐린글 }}>작성자 {후기들.length}명 · 3명부터 평균 평점 공개</p>
        </div>
      )}

      <ul className="mt-[8px] flex flex-col gap-[16px]">
        {후기들.map((h) => (
          <li key={h.id}>
            <Link href={`/orgs/review?id=${h.id}`} className="flex flex-col gap-[12px] rounded-[16px] p-[16px] active:opacity-80" style={{ background: 어둠.면 }}>
              <div className="flex items-center gap-[10px]">
                <후기쓴이 h={h} />
                <span className="flex shrink-0 items-center gap-[4px] whitespace-nowrap text-[15px] font-bold" style={{ color: '#ffa691' }}><둥근별 크기={15} />{h.별점}점</span>
              </div>
              {/* 한 줄에 하나 (2026-11-15 세중님 「좌우로 하니깐 글이 짤리고 가독성이 안 좋다」) */}
              <dl className="flex flex-col gap-[8px] rounded-[8px] px-[12px] py-[12px]" style={{ background: '#132636' }}>
                {후기질문.map((q) => (
                  <div key={q.칸} className="flex gap-[12px]">
                    <dt className="w-[84px] shrink-0 break-keep text-[13px] leading-[20px]" style={{ color: 어둠.흐린글 }}>{q.짧게}</dt>
                    <dd className="min-w-0 flex-1 break-keep text-[14px] font-bold leading-[20px]" style={{ color: 어둠.글 }}>{h[q.칸] ?? '—'}</dd>
                  </div>
                ))}
              </dl>
              {h.글 && <p className="line-clamp-2 break-keep text-[15px] leading-[23px]" style={{ color: 어둠.글 }}>{h.글}</p>}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-[16px] text-[13px] leading-[19px]" style={{ color: 어둠.흐린글 }}>근무 인증을 완료한 병원에만 작성할 수 있어요.</p>
      <Link href={쓰기} className="flex h-[48px] items-center justify-center rounded-[12px] text-[16px] font-bold" style={{ background: 어둠.쓰기, color: '#fff' }}>
        {내후기 ? '내 후기 고치기' : 인증됨 ? '근무 후기 쓰기' : '근무 후기 쓰기'}
      </Link>
    </section>
  );
}
