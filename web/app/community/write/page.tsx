'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { channelsFor } from '@/lib/channels';
import { MAX_POST_IMAGES, postImagePair } from '@/lib/image';
import { browserSupabase } from '@/lib/supabase-browser';
import { useAuth } from '../../auth';
import { useToast } from '../../toast';

export default function WritePage() {
  return <Suspense fallback={null}><Write /></Suspense>;
}

type Pick = { file: File; preview: string };

function Write() {
  const router = useRouter();
  const toast = useToast();
  const qs = useSearchParams();
  const { loading, session, me } = useAuth();

  const [ch, setCh] = useState(qs.get('ch') ?? 'free');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { sessionStorage.setItem('potjob.after-login', location.pathname + location.search); router.replace('/login'); return; }
    if (!me) router.replace('/welcome');
  }, [loading, session, me, router]);

  /* 미리보기로 만든 주소는 거둬야 합니다 */
  useEffect(() => () => picks.forEach((p) => URL.revokeObjectURL(p.preview)), [picks]);

  if (loading || !me) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7"><p className="text-lg text-gray-500">잠시만요…</p></main>;
  }

  /* 학생에게는 학생 방을, 현직에게는 현직 방을 보여줍니다 (옛 chFor_ 와 같게) */
  const rooms = channelsFor(me.role);

  const addFiles = (files: FileList) => {
    const room = MAX_POST_IMAGES - picks.length;
    if (room <= 0) { toast(`사진은 ${MAX_POST_IMAGES}장까지입니다`, { tone: 'danger' }); return; }
    const take = Array.from(files).slice(0, room);
    if (files.length > room) toast(`${MAX_POST_IMAGES}장까지라 ${take.length}장만 담았습니다`);
    setPicks([...picks, ...take.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))]);
  };

  const submit = async () => {
    if (!body.trim()) { toast('내용을 써주세요', { tone: 'danger' }); return; }
    setBusy(true);
    const sb = browserSupabase();

    try {
      const { data: post, error } = await sb.from('posts').insert({
        channel: ch, author_id: me.id,
        title: title.trim() || null, body: body.trim(),
      }).select('id').single();
      if (error) throw error;

      /* 사진은 글이 생긴 뒤에 올립니다 —
         post_images 규칙이 「내 글의 사진만」이라 글 id 가 있어야 통과합니다 */
      for (let i = 0; i < picks.length; i++) {
        const { full, thumb } = await postImagePair(picks[i].file);
        const base = `${me.id}/${post.id}/${i}`;
        const up = await Promise.all([
          sb.storage.from('post-images').upload(`${base}.webp`, full, { contentType: 'image/webp', upsert: true }),
          sb.storage.from('post-images').upload(`${base}-t.webp`, thumb, { contentType: 'image/webp', upsert: true }),
        ]);
        const bad = up.find((u) => u.error);
        if (bad?.error) throw bad.error;

        const { error: rowErr } = await sb.from('post_images').insert({
          post_id: post.id, path: `${base}.webp`, thumb_path: `${base}-t.webp`, sort: i,
        });
        if (rowErr) throw rowErr;
      }

      toast('글을 올렸습니다');
      router.push(`/post/${post.id}`);
    } catch (e) {
      setBusy(false);
      toast(`올리지 못했습니다 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 md:px-7">
      <h1 className="text-h2 font-bold">글쓰기</h1>

      <label className="mt-6 block text-sm font-bold text-gray-500">방</label>
      <select
        value={ch}
        onChange={(e) => setCh(e.target.value)}
        className="mt-1 w-full appearance-none rounded-xs border border-gray-200 bg-gray-50 py-4 pl-5 pr-[36px] text-lg dark:border-gray-700 dark:bg-gray-950"
      >
        {rooms.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.desc}</option>)}
      </select>

      <label className="mt-6 block text-sm font-bold text-gray-500">제목 (없어도 됩니다)</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={60}
        className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
      />

      <label className="mt-6 block text-sm font-bold text-gray-500">내용</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={10}
        className="mt-1 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
      />

      <div className="mt-6 flex items-center gap-5">
        <label className="cursor-pointer rounded-md border border-gray-200 px-6 py-4 text-lg font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-950">
          사진 넣기
          <input type="file" accept="image/*" multiple className="sr-only"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <span className="text-sm text-gray-400">
          {picks.length}/{MAX_POST_IMAGES}장 · 올릴 때 1600px WebP 로 줄입니다
        </span>
      </div>

      {picks.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {picks.map((p, i) => (
            <li key={p.preview} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저 안 미리보기입니다 */}
              <img src={p.preview} alt="" className="size-[72px] rounded-sm object-cover" />
              <button
                type="button"
                aria-label={`사진 ${i + 1} 빼기`}
                onClick={() => setPicks(picks.filter((_, j) => j !== i))}
                className="absolute -right-1 -top-1 size-[22px] rounded-md bg-gray-900 text-sm text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-7 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40"
      >
        {busy ? '올리는 중…' : '올리기'}
      </button>

      <p className="mt-5 text-sm text-gray-400">
        남 비방·저격·허위사실·광고는 지워집니다 — 커뮤니티 이용규칙
      </p>
    </main>
  );
}
