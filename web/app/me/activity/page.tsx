'use client';

import { MyLists } from '@/components/my-lists';
import { RapoMeFrame } from '@/components/rapo/rapo-me';

/* 저장한 공고 · 내 글 · 내 댓글 — 내 정보 「내 활동」 (2026-11-11 밤). 전 /me 의 목록(MyLists) 그대로입니다.
   안쪽 꼴은 아직 옛 모양입니다 — 피그마 「U14 · 저장한 공고 목록」 1450:5616 은 다음 차례 */
export default function MyActivity() {
  return <RapoMeFrame title="내가 쓴 글 · 댓글">{(me) => <MyLists profileId={me.id} />}</RapoMeFrame>;
}
