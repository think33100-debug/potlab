'use client';

import { MyLists } from '@/components/my-lists';
import { RapoMeFrame } from '@/components/rapo/rapo-me';

/* 내 글 · 내 댓글 — 내 정보 「내 활동」 (2026-11-11 밤 · 2026-11-13 새 토큰으로 · components/my-lists.tsx).
   찜한 공고는 「저장한 공고」(/me/saved) 화면에 있습니다 */
export default function MyActivity() {
  return <RapoMeFrame title="내가 쓴 글 · 댓글">{(me) => <MyLists profileId={me.id} />}</RapoMeFrame>;
}
