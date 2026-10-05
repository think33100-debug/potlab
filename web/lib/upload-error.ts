/* 그림 올리기가 실패했을 때의 말 — 한 곳에서 정합니다 (2026-10-05).

   브라우저와 저장소가 돌려주는 말이 영어입니다. 그대로 띄우면
   관리자가 무엇이 잘못인지 모릅니다. 실제로 본 것만 우리 말로 바꿉니다 —
   지어낸 문구가 없습니다.

     The source image could not be decoded.   ← 그림이 아닌 파일을 넣었을 때
                                                (2026-10-05 에 .txt 로 재현했습니다)
     mime type ... is not supported            ← 통이 안 받는 형식
     exceeded the maximum allowed size         ← 통 크기 한도

   모르는 말은 **그대로 보여줍니다.** 감추면 다음에 또 헤맵니다. */
export function 올리기탈(e: unknown): string {
  const m = String((e as Error)?.message ?? e ?? '');
  if (/could not be decoded|decode/i.test(m)) {
    return '그림 파일이 아니에요 (jpg · png · webp 만 됩니다)';
  }
  if (/mime type|not supported/i.test(m)) {
    return '받지 않는 형식이에요 (jpg · png · webp 만 됩니다)';
  }
  if (/maximum allowed size|too large|413/i.test(m)) {
    return '그림이 너무 커요';
  }
  return m || '까닭을 알 수 없어요';
}
