'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatar';
import { PhotoCropper } from '@/components/photo-cropper';
import { PhotoPicker } from '@/components/photo-picker';
import { AVATAR_COLORS, AVATAR_EMOJIS, withColor, withEmoji, withPhoto } from '@/lib/avatar';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 아바타 고르는 한 덩어리 — 가입 ④ 와 마이페이지가 같이 씁니다.

   사진을 고르면 바로 올리지 않고 조절 화면을 한 번 거칩니다.
   자르고 나온 것은 이미 400x400 WebP 라 더 줄이지 않습니다. */
export function AvatarPicker({
  userId, value, onChange,
}: {
  userId: string;
  value: string | null;
  /* 저장까지 마친 새 값. 부르는 쪽이 화면을 새로고침합니다 */
  onChange: (next: string) => void | Promise<void>;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (next: string) => {
    const { error } = await browserSupabase()
      .from('profiles').update({ avatar: next }).eq('id', userId);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    await onChange(next);
  };

  const upload = async (blob: Blob) => {
    setBusy(true);
    try {
      const path = `${userId}/${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('avatars')
        .upload(path, blob, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      await save(withPhoto(value, path));
      toast('프로필 사진이 바뀌었어요!');
    } catch (e) {
      toast(`사진을 올리지 못했어요 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
    setPicked(null);
    setBusy(false);
  };

  if (picked) {
    return <PhotoCropper file={picked} onDone={upload} onCancel={() => setPicked(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-6">
        <Avatar value={value} size="lg" />
        <PhotoPicker label="이미지 직접 가져오기" onPick={setPicked} disabled={busy} />
      </div>

      <p className="mt-6 text-sm text-gray-400">이모지와 색을 골라도 돼요</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AVATAR_EMOJIS.map((em) => (
          <button key={em} type="button" aria-label={em} disabled={busy}
            onClick={() => save(withEmoji(value, em))}
            className="rounded-md border border-gray-200 px-4 py-1 text-body-lg disabled:opacity-40 dark:border-gray-700">
            {em}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {AVATAR_COLORS.map((c) => (
          <button key={c} type="button" aria-label={'바탕색 ' + c} disabled={busy}
            onClick={() => save(withColor(value, c))}
            className="size-[28px] rounded-md border border-gray-200 disabled:opacity-40 dark:border-gray-700"
            style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}
