'use client';

import { useRef } from 'react';

/* 사진 고르기 단추.

   예전에는 <label> 이 숨긴 <input type=file> 을 감싸고, 라벨을 누르면
   브라우저가 알아서 input 을 눌러주는 방식이었습니다.
   그게 안 열린다는 이야기가 있었는데 저는 재현을 못 했습니다 —
   그래서 간접으로 기대는 부분을 아예 없앴습니다.

   지금은 진짜 <button> 이 input.click() 을 직접 부릅니다.
   읽어주는 기계에도 「단추」로 들리고, 라벨 연결이 어긋날 자리가 없습니다.

   input 을 sr-only 대신 hidden 으로 둡니다 — 어차피 눌리는 건 단추입니다. */
export function PhotoPicker({
  label, onPick, disabled,
}: {
  label: string;
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-950"
      >
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          /* 같은 파일을 다시 골라도 onChange 가 오게 비웁니다 */
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </>
  );
}
