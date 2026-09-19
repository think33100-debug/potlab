/* 로고입니다. 아직 이미지가 없어 글자로 둡니다.

   그림이 나오면 이 파일만 바꾸면 됩니다 — 부르는 쪽은 그대로입니다.
     <Image src="/logo.svg" alt="POT JOB" width={84} height={20} priority />
   alt 는 "POT JOB" 으로 두세요. 읽어주는 기계가 지금과 같은 것을 읽습니다. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={'text-h3 font-bold tracking-tight ' + className}>
      POT&nbsp;JOB
    </span>
  );
}
