import { redirect } from 'next/navigation';

/* 학생·취준생 공간 — 2026-11-15 같은 날 만들었다가 세중님 「한 곳에서 다 같이 · 학생 임상가 모두 다」로 거뒀습니다.
   주소를 아는 분이 빈 화면을 보지 않게 커뮤니티 피드로 보냅니다 */
export default function StudentSpace() {
  redirect('/community');
}
