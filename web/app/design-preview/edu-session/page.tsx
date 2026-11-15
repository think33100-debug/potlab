'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EduSessionView, type 회차 } from '@/components/rapo/rapo-edu-session';

/* 교육 회차 미리보기 (2026-11-15 · 피그마 U13) — 개발 서버에서만. 견본 회차(실제 아님).
     ?m=없음(기본 · 신청 전) · 입금대기 · 신청함 · 참여확정 · 수강완료 · 미선정   ?free=1 무료 회차 */
function Body() {
  const q = useSearchParams();
  const m = q.get('m');
  const 무료 = q.get('free') === '1';
  const s: 회차 = {
    회차id: 1, 과정id: 1, 제목: '신경계 재활 실무', 소개: '신경계 환자를 만나는 물리·작업치료사를 위한 실습입니다. 사례별 평가 결과를 읽고 중재 계획을 세워 봅니다.',
    주최: '견본 교육센터', 직군: '공통', 회차순번: 1, 시작: '2026-11-28', 끝: null, 장소: '서울 · 교육센터 실습실',
    정원: 20, 확정수: 4, 접수시작: '2026-11-10', 접수끝: '2026-11-21', 수강료: 무료 ? 0 : 60000, 상태: '모집중',
    환불규정: '교육 시작 7일 전까지 전액 환불', 결제링크: null,
    내상태: m && m !== '없음' ? m : null, 리뷰가능: m === '수강완료',
    계좌: m && m !== '없음' ? { 은행: '견본은행', 계좌번호: '000-0000-0000', 예금주: '견본', 입금기한: '2026-11-21', 입금자명규칙: '이름+전화 끝 4자리' } : null,
  };
  return <EduSessionView 견본={{ s, 리뷰들: m === '수강완료' ? [{ 리뷰id: 1, 닉네임: '차분한 수달', 별점: 5, 글: '실습 뒤에 동작을 바로 교정받을 수 있었어요.', 쓴때: '', 고친때: null, 답글: '실습에 참여해 주셔서 감사합니다.' }] : [] }} />;
}

export default function DesignPreviewEduSession() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Suspense><Body /></Suspense>;
}
