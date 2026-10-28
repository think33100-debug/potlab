/* 누르는 순간 뜨는 뼈대입니다 (2026-10-28 세중님 ⓐ · docs/속도진단_1028.md).
   이 쪽은 force-dynamic 이라 loading.tsx 가 없으면 **미리 받아 둘 것이 없습니다** —
   그러면 누른 뒤 서버 왕복이 끝날 때까지 화면이 안 바뀝니다 */
import { 목록뼈대 } from '@/components/목록뼈대';

export default function Loading() {
  return <목록뼈대 줄={6} 폭="max-w-3xl" />;
}
