/* 사진을 올리기 전에 브라우저에서 줄입니다.

   왜 브라우저에서 — 원본을 그대로 올리면 요즘 휴대폰 사진이 한 장에 4~8MB 입니다.
   저장소 통도 2MB 로 잡혀 있어서 그냥 올리면 튕깁니다. 줄여서 보내면
   올리는 시간도 저장 용량도 같이 줄어듭니다.

   WebP 로 바꾸는 이유는 같은 눈높이에서 JPEG 보다 30% 쯤 작아서입니다.

   ponytail: canvas 한 장으로 끝냅니다. 방향(EXIF orientation)은
   createImageBitmap 이 맞춰 줍니다 — 따로 라이브러리를 달지 않았습니다 */

export async function shrinkToWebp(
  file: File,
  maxPx: number,
  quality = 0.82,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 사진을 줄이지 못했습니다');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/webp', quality),
  );
  if (!blob) throw new Error('WebP 로 바꾸지 못했습니다');
  return blob;
}

/** 글 사진 한 장 → 본문용 1600px 과 목록용 400px 썸네일 */
export async function postImagePair(file: File) {
  const [full, thumb] = await Promise.all([
    shrinkToWebp(file, 1600),
    shrinkToWebp(file, 400, 0.75),
  ]);
  return { full, thumb };
}

export const MAX_POST_IMAGES = 5;
