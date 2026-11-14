import { redirect } from 'next/navigation';

/* 계산기 목록은 올인원 툴킷(/toolkit)으로 합쳤습니다 (2026-11-14). 옛 주소로 들어와도 툴킷의 돈 계산 자리로 보냅니다 */
export default function Tools() {
  redirect('/toolkit#pay');
}
