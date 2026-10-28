/* 화면이 뜨기 직전 — **비상용**입니다 (2026-10-29 세중님 2번).
   여섯 메뉴는 <Link prefetch={true}> 로 **데이터까지** 미리 받으므로
   (web/lib/routes.ts · staleTimes 30초) 이 화면은 **거의 안 보입니다**.
   보이는 때는 미리 받기가 안 끝났거나 30초가 지났을 때입니다 */
import { 목록뼈대 } from '@/components/목록뼈대';

export default function Loading() {
  return <목록뼈대 폭="max-w-3xl" />;
}
