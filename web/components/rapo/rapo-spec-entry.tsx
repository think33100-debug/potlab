'use client';

import { useAuth } from '@/app/auth';

/* 스펙 비교 메뉴의 이름·그림 — 보는 사람에 따라 (2026-11-17 세중님 「툴킷에 입사스펙비교가 있는데 이건 임상가 용이라
   학생용으로 취업 스펙 비교 · 토큰도 취업 스펙 비교에 맞게」).

     학생·취준생   「취업 스펙 비교」 — 학생끼리 스펙 점수를 견줍니다 (app/spec/compare)
     그 밖(임상가 · 비회원)  「입사 스펙 비교」 — 준비 중 화면

   가는 곳은 하나(/spec/compare)이고 그 화면이 임상가를 준비 중 화면으로 넘깁니다 — 메뉴마다 주소를 가르지 않습니다.
   홈 · 툴킷은 서버가 그리는 화면이라, 이름과 그림만 이 작은 조각으로 갈아 끼웁니다(로그인 정보를 읽은 뒤 바뀝니다). */
export const 스펙비교길 = '/spec/compare';

const use학생 = () => useAuth().me?.role === '학생';

export function SpecEntryLabel({ 뒤 = '' }: { 뒤?: string }) {
  return <>{use학생() ? '취업 스펙 비교' : '입사 스펙 비교'}{뒤}</>;
}

export function SpecEntryDesc() {
  return <>{use학생()
    ? '내 취업 스펙 점수를 보고, 취업을 준비하는 사람들과 견줘 봐요'
    : '관심 병원 입사자와 내 스펙을 견주는 기능이에요. 준비 중이라 오픈 알림을 받을 수 있어요'}</>;
}

/** 28 그림 — 홈 「라포 더 둘러보기」 칸 · 툴킷 목록 */
export function SpecEntryArt({ size = 28, 기본 = '/rapo/home/graphic-cert-28.svg', className, style }: { size?: number; 기본?: string; className?: string; style?: React.CSSProperties }) {
  const 학생 = use학생();
  /* eslint-disable-next-line @next/next/no-img-element -- 피그마 그림과 같은 규칙의 SVG */
  return <img src={학생 ? '/rapo/home/graphic-jobspec-28.svg' : 기본} alt="" width={size} height={size} className={className} style={style} />;
}
