'use client';

import { notFound } from 'next/navigation';
import { SignupPreview } from '@/components/signup-preview';

/* 관리자 가입 미리보기(/master/signup)를 **서버 문 없이** 그려 보는 자리 (2026-11-17) — 개발 서버에서만(배포 404).
   개발 서버는 DB 가 없어 진짜 주소(/master/signup)는 문 앞에서 막힙니다. 폭 재기·흐름 확인은 여기서 합니다 */
export default function DesignPreviewMasterSignup() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SignupPreview />;
}
