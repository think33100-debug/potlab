'use client';

import { RapoInstallBody } from '@/components/rapo/rapo-install';
import { RapoMeFrame } from '@/components/rapo/rapo-me';

/* 핸드폰에 설치하기 — 내 정보 (2026-11-14). 화면 몸은 components/rapo/rapo-install.tsx */
export default function MyInstall() {
  return <RapoMeFrame title="핸드폰에 설치하기">{() => <RapoInstallBody />}</RapoMeFrame>;
}
