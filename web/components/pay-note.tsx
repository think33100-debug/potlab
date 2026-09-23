/* 연봉·급여 숫자 옆에 붙는 한 줄.

   어느 화면에서든 같은 말이 나가야 합니다 — 한쪽만 고치면 화면마다
   기준이 달라 보입니다. 그래서 문구를 여기 한 곳에만 둡니다.

   왜 필요한가 — 중위값 하나만 크게 보이면 「이게 내가 받을 돈」으로 읽힙니다.
   실제로는 연차·고용형태에 따라 몇 백만 원이 갈립니다
   (CLAUDE.md 10번 — 출처와 한계를 화면에 밝힐 것).

   색과 여백은 부르는 쪽이 정합니다. 밝은 구역은 text-mute,
   어두운 구역은 text-gray-400 입니다 — 한쪽 값을 여기 박아두면
   반대쪽 화면에서 글자가 사라집니다. */
export function PayNote({
  /* 어디 기준인지. 기본은 회원이 직접 올린 급여입니다 */
  source = '회원이 직접 올린 급여',
  className = 'mt-5 text-mute',
}: { source?: string; className?: string }) {
  return (
    <p className={`break-keep text-sm leading-relaxed ${className}`}>
      {source}입니다. 연차와 고용형태에 따라 다를 수 있어요
    </p>
  );
}
