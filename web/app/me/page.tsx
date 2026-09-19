'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { MyLists } from '@/components/my-lists';
import { AVATAR_COLORS, AVATAR_EMOJIS, emojiAvatar, photoAvatar } from '@/lib/avatar';
import { shrinkToWebp } from '@/lib/image';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS, ROLES, ROLE_DESC } from '@/lib/who';
import { useAuth } from '../auth';
import { useToast } from '../toast';

const FREE_CHANGES = 5;

export default function MyPage() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload, signOut } = useAuth();

  /* 안 건드렸으면 지금 닉네임을 보여줍니다. 상태로 미리 채우지 않습니다 —
     effect 안 setState 는 그릴 때마다 한 번 더 그립니다 */
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nick = typed ?? me?.nickname ?? '';
  const setNick = setTyped;

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (!me) router.replace('/welcome');
  }, [loading, session, me, router]);

  if (loading || !me) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7"><p className="text-lg text-gray-500">잠시만요…</p></main>;
  }

  const used = me.nickname_changes;
  const left = Math.max(0, FREE_CHANGES - used);
  const locked = left === 0;

  const saveNick = async () => {
    const name = nick.trim();
    if (name === me.nickname) { setErr('지금 쓰는 닉네임과 같습니다'); return; }
    if (name.length < 2 || name.length > 12) { setErr('2자에서 12자까지 쓸 수 있습니다'); return; }

    setBusy(true); setErr(null);
    const { error } = await browserSupabase()
      .from('profiles').update({ nickname: name }).eq('id', me.id);
    setBusy(false);

    if (error) {
      /* 5번을 넘기면 DB 트리거가 막습니다. 화면에서만 막으면
         요청을 손으로 만들어 넘길 수 있어서 막는 자리를 DB 에 뒀습니다 */
      setErr(
        error.code === '23505'
          ? '이미 쓰고 있는 닉네임입니다'
          : error.message.includes('5번')
            ? '더 바꾸려면 결제가 필요합니다'
            : `바꾸지 못했습니다 — ${error.message}`,
      );
      return;
    }
    await reload();
    toast(`닉네임을 바꿨습니다 · ${left - 1}번 남음`);
  };

  const pickPhoto = async (file: File) => {
    setBusy(true);
    try {
      const webp = await shrinkToWebp(file, 400);
      const path = `${me.id}/${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('avatars')
        .upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      await sb.from('profiles').update({ avatar: photoAvatar(path) }).eq('id', me.id);
      await reload();
      toast('사진을 바꿨습니다');
    } catch (e) {
      toast(`사진을 올리지 못했습니다 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
    setBusy(false);
  };

  const setAvatar = async (v: string) => {
    await browserSupabase().from('profiles').update({ avatar: v }).eq('id', me.id);
    await reload();
  };

  /* 직군·역할 바꾸기. 닉네임과 달리 횟수 제한이 없습니다 —
     졸업하면 학생에서 현직으로 옮겨야 하기 때문입니다 */
  const setWho = async (patch: { job_group?: string; role?: string }) => {
    const { error } = await browserSupabase().from('profiles').update(patch).eq('id', me.id);
    if (error) { toast(`바꾸지 못했습니다 — ${error.message}`, { tone: 'danger' }); return; }
    await reload();
    toast(patch.role ? `${patch.role}으로 바꿨습니다` : `${patch.job_group}로 바꿨습니다`);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 md:px-7">
      <h1 className="text-h1 font-bold">내 정보</h1>

      <section className="mt-7">
        <h2 className="text-h3 font-bold">프로필 사진</h2>
        <div className="mt-5 flex items-center gap-6">
          <Avatar value={me.avatar} size="lg" />
          <label className="cursor-pointer rounded-md border border-gray-200 px-6 py-4 text-lg font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-950">
            사진 바꾸기
            <input type="file" accept="image/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }} />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {AVATAR_EMOJIS.map((em) => (
            <button key={em} type="button" aria-label={em}
              onClick={() => setAvatar(emojiAvatar(em, (me.avatar ?? '').split('|')[1] || AVATAR_COLORS[0]))}
              className="rounded-md border border-gray-200 px-4 py-1 text-body-lg dark:border-gray-700">
              {em}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button key={c} type="button" aria-label={'바탕색 ' + c}
              onClick={() => setAvatar(emojiAvatar((me.avatar ?? '').split('|')[0] || AVATAR_EMOJIS[0], c))}
              className="size-[28px] rounded-md border border-gray-200 dark:border-gray-700"
              style={{ background: c }} />
          ))}
        </div>
      </section>

      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <h2 className="text-h3 font-bold">닉네임</h2>
        <p className="mt-1 text-lg text-gray-500">
          {locked
            ? '무료로 바꿀 수 있는 5번을 다 쓰셨습니다'
            : `${FREE_CHANGES}번 중 ${left}번 남았습니다`}
        </p>

        {/* 남은 횟수를 눈금으로도 보여줍니다 */}
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: FREE_CHANGES }, (_, i) => (
            <span key={i}
              className={'h-1 w-[28px] rounded-md ' + (i < used ? 'bg-gray-200 dark:bg-gray-700' : 'bg-teal-strong')} />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <input
            value={nick}
            onChange={(e) => { setNick(e.target.value); setErr(null); }}
            disabled={locked}
            maxLength={12}
            aria-label="닉네임"
            className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg disabled:opacity-40 dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            onClick={saveNick}
            disabled={busy || locked}
            className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            바꾸기
          </button>
        </div>

        {err && <p className="mt-2 text-lg text-brand-red">{err}</p>}

        {locked && (
          <p className="mt-5 rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
            더 바꾸려면 결제가 필요합니다.
            <span className="mt-1 block text-sm">결제는 아직 붙이지 않았습니다</span>
          </p>
        )}
      </section>

      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <h2 className="text-h3 font-bold">직군 · 역할</h2>
        <p className="mt-1 text-lg text-gray-500">
          커뮤니티에서 보이는 방이 역할로 갈립니다. 졸업하시면 현직으로 바꿔 주세요
        </p>

        <h3 className="mt-6 text-sm font-bold text-gray-500">직군</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {JOB_GROUPS.map((g) => (
            <Pick key={g} on={me.job_group === g} go={() => setWho({ job_group: g })}>{g}</Pick>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-bold text-gray-500">역할</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Pick key={r} on={me.role === r} go={() => setWho({ role: r })}>
              {r}
              <span className={'ml-2 text-sm font-medium ' + (me.role === r ? 'text-white/70' : 'text-gray-400')}>
                {ROLE_DESC[r]}
              </span>
            </Pick>
          ))}
        </div>
      </section>

      <MyLists profileId={me.id} />

      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <button type="button" onClick={signOut}
          className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950">
          로그아웃
        </button>
      </section>
    </main>
  );
}

function Pick({ on, go, children }: { on: boolean; go: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={go} aria-pressed={on}
      className={
        'rounded-md border px-6 py-4 text-lg font-medium transition-colors ' +
        (on ? 'border-teal-strong bg-teal-strong text-white'
            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950')
      }>
      {children}
    </button>
  );
}
