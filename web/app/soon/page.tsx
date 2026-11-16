import type { Metadata } from 'next';
import { Icon } from '@/components/icon';
import { RapoPageFrame, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';

/* 아직 안 만든 화면 셋이 같이 쓰는 자리입니다 (월급 확인 · 스펙쌓기 · 병원정보 찾기).
   홈의 카테고리가 여기로 보냅니다 — 없는 주소로 보내 404 를 내지 않으려고요.

   화면이 생기면 lib/routes.ts 의 표에서 그 줄만 지우면 됩니다.

   2026-11-16 — 새 화면에서는 안 오지만 주소로는 열려서, 옛 위쪽 줄(POTJOB 로고) 대신 새 틀로 옮겼습니다 */

export const metadata: Metadata = { title: '준비 중 · RAPO' };

const WHAT: Record<string, { icon: string; title: string; line: string }> = {
  pay:  { icon: 'wallet', title: '월급 확인', line: '회원들이 올린 초임과 실수령액을 모으고 있어요' },
  spec: { icon: 'book-open', title: '스펙쌓기', line: '학점·자격증·실습을 또래와 견줘볼 수 있게 준비하고 있어요' },
  orgs: { icon: 'hospital', title: '병원정보 찾기', line: '병원 62,749곳의 종별·병상·치료사 수를 찾아볼 수 있게 준비하고 있어요' },
};

export default async function Soon({
  searchParams,
}: { searchParams: Promise<{ what?: string }> }) {
  const { what } = await searchParams;
  const w = WHAT[what ?? ''] ?? { icon: 'clock', title: '준비 중', line: '' };

  return (
    <RapoPageFrame title={w.title} back="/toolkit" nav="/toolkit">
      <section className="flex flex-col items-center gap-(--rapo-dimension-x3) pt-(--rapo-dimension-x8) text-center">
        <Icon name={w.icon} size={48} className="text-(color:--rapo-brand-color-navy)" />
        <p className="rapo-type-t7-bold text-(color:--rapo-color-fg-brand-contrast)">곧 찾아올게요</p>
        {w.line && <p className={틀.흐린글}>{w.line}</p>}
      </section>

      <div className="flex flex-col gap-(--rapo-dimension-x2) md:mx-auto md:w-[360px]">
        <RapoButton href="/jobs" tone="navy" full>채용공고 보기</RapoButton>
        <RapoButton href="/community" tone="outline" full>커뮤니티 가기</RapoButton>
      </div>
    </RapoPageFrame>
  );
}
