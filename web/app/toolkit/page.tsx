import type { Metadata } from 'next';
import { RapoToolkit } from '@/components/rapo/rapo-toolkit';

/* 라포 올인원 툴킷 — 화면 몸은 components/rapo/rapo-toolkit.tsx (미리보기 /design-preview/toolkit 과 같이 씁니다) */
export const metadata: Metadata = {
  title: '라포 올인원 툴킷 · RAPO',
  description: '세후 월급·퇴직금 계산부터 병원 연봉, 교육·봉사·청년정책, 알림까지 한곳에서',
};

export default function Toolkit() {
  return <RapoToolkit />;
}
