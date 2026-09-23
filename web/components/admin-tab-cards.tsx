'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhotoPicker } from '@/components/photo-picker';
import { shrinkToWebp } from '@/lib/image';
import { TABS } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 공고 목록 분류 카드의 그림.

   이름과 가는 곳은 코드에 있습니다 (lib/supabase.ts 의 TABS).
   관리자가 바꾸는 것은 그림 하나뿐이라, DB 에도 그림 경로 한 칸만 있습니다
   (job_tab_cards). 주소를 DB 에 넣게 하면 엉뚱한 값이 들어가 404 가 납니다.

   그림은 홈 배너와 같은 저장소(home-images)를 씁니다 —
   버킷 권한이 이미 있어서 새로 만들 이유가 없습니다. */
export function AdminTabCards() {
  const toast = useToast();
  const [paths, setPaths] = useState<Record<string, string | null> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const { data } = await browserSupabase()
      .from('job_tab_cards').select('tab_key,image_path');
    const m: Record<string, string | null> = {};
    ((data ?? []) as { tab_key: string; image_path: string | null }[])
      .forEach((r) => { m[r.tab_key] = r.image_path; });
    return m;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAll().then((m) => { if (alive) setPaths(m); });
    return () => { alive = false; };
  }, [fetchAll]);

  const put = async (key: string, path: string | null) => {
    const { error } = await browserSupabase().from('job_tab_cards')
      .update({ image_path: path, updated_at: new Date().toISOString() })
      .eq('tab_key', key);
    if (error) { toast('저장하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    setPaths((m) => ({ ...(m ?? {}), [key]: path }));
    toast(path ? '그림을 올렸어요' : '그림을 뺐어요');
  };

  const upload = async (key: string, file: File) => {
    setBusy(key);
    try {
      const webp = await shrinkToWebp(file, 1600);
      /* 그릴 때가 아니라 그림을 고른 뒤에 부릅니다. 파일 이름이 겹치지 않게
         시각을 붙이는 자리라 값이 매번 달라야 맞습니다 (app/admin/page.tsx 와 같은 방식) */
      // eslint-disable-next-line react-hooks/purity
      const path = `jobtab/${key}-${Date.now()}.webp`;
      const { error } = await browserSupabase().storage.from('home-images')
        .upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      await put(key, path);
    } catch (e) {
      toast('그림을 올리지 못했어요 — ' + (e as Error).message, { tone: 'danger', ms: 4000 });
    }
    setBusy(null);
  };

  if (!paths) return null;

  return (
    <section className="mb-8">
      <h2 className="break-keep text-h3 font-bold">분류 카드 그림</h2>
      <p className="mt-1 break-keep text-sm text-gray-500">
        공고 목록 맨 위에 옆으로 밀리는 카드입니다. 이름과 가는 곳은 코드에 있어서
        여기서는 그림만 바꿉니다
      </p>

      <div className="mt-5 space-y-5">
        {TABS.map((t) => {
          const path = paths[t.key] ?? null;
          const url = path
            ? browserSupabase().storage.from('home-images').getPublicUrl(path).data.publicUrl
            : null;

          return (
            <div key={t.key}
              className="rounded-sm border border-gray-100 p-6 dark:border-gray-800">
              <p className="break-keep text-lg font-bold">{t.label}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {url && (
                  // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
                  <img src={url} alt="" className="h-[56px] w-[100px] rounded-xs object-cover" />
                )}
                <PhotoPicker
                  label={url ? '그림 바꾸기' : '그림 넣기'}
                  disabled={busy === t.key}
                  onPick={(f) => upload(t.key, f)}
                />
                {url && (
                  <button type="button" onClick={() => put(t.key, null)}
                    className="text-sm text-gray-500 hover:underline">
                    그림 빼기
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
