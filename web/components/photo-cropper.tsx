'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* 올린 사진을 원 안에 맞춰 자릅니다. 카카오톡 프사 고치는 것과 같은 방식이에요.

   ponytail: 자르기 라이브러리를 안 답니다.
   사진 한 장을 translate·scale 로 밀고 키우는 것뿐이라 CSS transform 한 줄이면 됩니다.
   손가락 두 개(핀치)도 pointer 이벤트 두 개의 거리를 재면 끝입니다.

   나가는 것은 400x400 WebP 입니다 — 아바타는 그보다 크게 안 씁니다. */

const BOX = 280;          // 고르는 칸 (화면에 맞춰 줄어듭니다)
const OUT = 400;          // 내보내는 크기
const MAX_SCALE = 4;

type Pt = { x: number; y: number };

export function PhotoCropper({
  file, onDone, onCancel,
}: {
  file: File;
  onDone: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState<Pt>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  /* 지금 눌려 있는 손가락들. 하나면 밀기, 둘이면 핀치 */
  const pts = useRef(new Map<number, Pt>());
  const start = useRef<{ off: Pt; scale: number; dist: number; mid: Pt } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setErr('사진을 못 읽었어요. 다른 파일로 해보세요');
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* 원을 항상 덮는 최소 배율. 이보다 작아지면 빈자리가 생깁니다 */
  const base = img ? Math.max(BOX / img.naturalWidth, BOX / img.naturalHeight) : 1;

  /* 사진이 원 밖으로 빠지지 않게 밀 수 있는 범위를 잡아 줍니다 */
  const clamp = useCallback((o: Pt, s: number): Pt => {
    if (!img) return o;
    const k = base * s;
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    const mx = Math.max(0, (w - BOX) / 2), my = Math.max(0, (h - BOX) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, o.x)),
      y: Math.min(my, Math.max(-my, o.y)),
    };
  }, [img, base]);

  const setBoth = (o: Pt, s: number) => {
    const ns = Math.min(MAX_SCALE, Math.max(1, s));
    setScale(ns);
    setOff(clamp(o, ns));
  };

  /* ── 손가락·마우스 ── */
  const down = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snap();
  };

  const snap = () => {
    const list = [...pts.current.values()];
    const mid = list.length === 2
      ? { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 }
      : list[0] ?? { x: 0, y: 0 };
    const dist = list.length === 2 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 0;
    start.current = { off, scale, dist, mid };
  };

  const move = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId) || !start.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const list = [...pts.current.values()];
    const s0 = start.current;

    if (list.length === 2) {
      /* 핀치 — 두 손가락 사이가 벌어진 만큼 키웁니다 */
      const dist = Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y);
      if (s0.dist > 0) setBoth(s0.off, s0.scale * (dist / s0.dist));
    } else {
      /* 밀기 */
      setBoth({ x: s0.off.x + (list[0].x - s0.mid.x), y: s0.off.y + (list[0].y - s0.mid.y) }, s0.scale);
    }
  };

  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size > 0) snap(); else start.current = null;
  };

  /* 데스크톱에서는 휠로도 키웁니다 */
  const wheel = (e: React.WheelEvent) => setBoth(off, scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));

  /* ── 자르기 ── */
  const crop = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const k = base * scale;
      /* 칸의 왼쪽 위가 원본 사진의 어디인지 */
      const dx = BOX / 2 + off.x - (img.naturalWidth * k) / 2;
      const dy = BOX / 2 + off.y - (img.naturalHeight * k) / 2;

      const c = document.createElement('canvas');
      c.width = OUT; c.height = OUT;
      const g = c.getContext('2d');
      if (!g) throw new Error('이 브라우저에서 못 잘랐어요');
      g.drawImage(img, -dx / k, -dy / k, BOX / k, BOX / k, 0, 0, OUT, OUT);

      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.85));
      if (!blob) throw new Error('WebP 로 못 바꿨어요');
      onDone(blob);
    } catch (e) {
      setBusy(false);
      setErr((e as Error).message);
    }
  };

  if (err) {
    return (
      <div className="rounded-sm bg-brand-red-soft p-6">
        <p className="text-lg text-brand-red-dark">{err}</p>
        <button type="button" onClick={onCancel}
          className="mt-5 rounded-md border border-brand-red px-6 py-4 text-lg font-medium text-brand-red-dark">
          닫기
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <p className="text-lg font-bold">사진 맞추기</p>
      <p className="mt-1 text-sm text-gray-500">
        끌어서 옮기고, 두 손가락으로 벌려서 키워요
      </p>

      <div className="mt-5 flex justify-center">
        <div
          ref={boxRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={wheel}
          /* touch-none 이 없으면 브라우저가 먼저 화면을 밀어버립니다 */
          className="relative touch-none overflow-hidden rounded-md bg-gray-100 select-none dark:bg-gray-800"
          style={{ width: BOX, height: BOX, maxWidth: '80vw', maxHeight: '80vw', cursor: 'grab' }}
        >
          {img && (
            /* eslint-disable-next-line @next/next/no-img-element -- 브라우저 안에서 만든 주소입니다 */
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none origin-center"
              style={{
                width: img.naturalWidth * base,
                height: img.naturalHeight * base,
                transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) scale(${scale})`,
              }}
            />
          )}
          {/* 원 밖을 어둡게 — 어디가 남는지 눈으로 보이게.
              inset 을 붙이면 안쪽이 어두워집니다. 바깥을 덮어야 하므로 바깥 그림자입니다 */}
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full"
               style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
        </div>
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-bold text-gray-500">크기</span>
        <input
          type="range" min={1} max={MAX_SCALE} step={0.01} value={scale}
          onChange={(e) => setBoth(off, Number(e.target.value))}
          className="mt-2 w-full"
          aria-label="사진 크기"
        />
      </label>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onCancel} disabled={busy}
          className="flex-1 rounded-md border border-gray-200 px-6 py-5 text-lg font-medium disabled:opacity-40 dark:border-gray-700">
          그만두기
        </button>
        <button type="button" onClick={crop} disabled={busy || !img}
          className="flex-1 rounded-md bg-brand-red px-6 py-5 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40">
          {busy ? '자르는 중…' : '이걸로 할래요'}
        </button>
      </div>
    </div>
  );
}
