import { NothingHere } from '@/components/nothing-here';

/* 없는 주소로 들어왔을 때.

   공유 링크가 여기로 떨어집니다 — 관리자가 내린 공고, 없는 기관, 오타.
   커뮤니티 글은 여기까지 안 옵니다. 「없는 글」과 「지워진 글」을 갈라
   말해야 해서 app/post/[id]/page.tsx 가 직접 그립니다.

   이 파일이 없으면 Next 가 제 기본 화면을 내보냅니다 —
   흰 바탕에 「404 | This page could not be found」 영어 한 줄뿐입니다.
   받은 분에게는 그냥 빈 화면이고 왜 안 열리는지 알 길이 없습니다. */
export default function NotFound() {
  return (
    <NothingHere
      title="이 자리에 아무것도 없어요"
      body="기관이 내린 공고이거나, 주소를 잘못 누르셨을 수 있어요."
    />
  );
}
