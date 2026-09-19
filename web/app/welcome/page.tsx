'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar';
import {
  AVATAR_COLORS, AVATAR_EMOJIS, defaultAvatar, emojiAvatar, photoAvatar,
} from '@/lib/avatar';
import { shrinkToWebp } from '@/lib/image';
import { browserSupabase } from '@/lib/supabase-browser';
import { AGREEMENTS, TERMS_VERSION } from '@/lib/terms';
import { useAuth } from '../auth';
import { useToast } from '../toast';

export default function Welcome() {
  const router = useRouter();
  const toast = useToast();
  const { loading, session, me, reload } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [nick, setNick] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nickErr, setNickErr] = useState<string | null>(null);
  /* ② 에서 방금 줄을 만든 경우입니다.
     이걸 안 두면 줄이 생기는 순간 「이미 가입한 분」 으로 몰려
     ③ 사진 칸을 못 보고 홈으로 튕깁니다 */
  const [justMade, setJustMade] = useState(false);

  /* 아무것도 안 고르셨으면 기본 아바타. 상태로 안 두고 계산합니다 —
     effect 안에서 setState 하면 그릴 때마다 한 번 더 그립니다 */
  const avatar = picked ?? (session ? defaultAvatar(session.user.id) : '');
  const setAvatar = setPicked;

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (me && !justMade) router.replace('/');         // 이미 가입을 마친 분
  }, [loading, session, me, router, justMade]);

  if (loading || !session) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7"><p className="text-lg text-gray-500">잠시만요…</p></main>;
  }

  const required = AGREEMENTS.filter((a) => a.required);
  const allRequired = required.every((a) => checked[a.key]);
  const allChecked = AGREEMENTS.every((a) => checked[a.key]);

  const toggleAll = () => {
    const on = !allChecked;
    setChecked(Object.fromEntries(AGREEMENTS.map((a) => [a.key, on])));
  };

  /* ② 닉네임 — profiles 줄을 여기서 만듭니다.
     nickname 이 NOT NULL·unique 라 이 칸을 지나야 줄이 생깁니다 */
  const saveNickname = async () => {
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) {
      setNickErr('2자에서 12자까지 쓸 수 있습니다'); return;
    }
    setBusy(true); setNickErr(null);

    const sb = browserSupabase();
    const { error } = await sb.from('profiles').insert({
      id: session.user.id,
      nickname: name,
      avatar,
      terms_agreed_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      /* 카카오가 준 사진·이메일은 일부러 안 담습니다 — lib/avatar.ts 참고 */
    });

    if (error) {
      setBusy(false);
      setNickErr(
        error.code === '23505'
          ? '이미 쓰고 있는 닉네임입니다. 다른 것으로 해주세요'
          : `저장하지 못했습니다 — ${error.message}`,
      );
      return;
    }

    if (checked.notify) {
      await sb.from('notification_settings').upsert({
        profile_id: session.user.id, agreed: true, agreed_at: new Date().toISOString(),
      });
    }

    setJustMade(true);      // reload 로 me 가 생겨도 ③ 에 머무르게
    await reload();
    setBusy(false);
    setStep(3);
  };

  /* ③ 사진 (선택) */
  const pickPhoto = async (file: File) => {
    setBusy(true);
    try {
      const webp = await shrinkToWebp(file, 400);
      const path = `${session.user.id}/${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('avatars').upload(path, webp, {
        contentType: 'image/webp', upsert: true,
      });
      if (error) throw error;
      await sb.from('profiles').update({ avatar: photoAvatar(path) }).eq('id', session.user.id);
      setAvatar(photoAvatar(path));
      await reload();
      toast('사진을 올렸습니다');
    } catch (e) {
      toast(`사진을 올리지 못했습니다 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
      <div className="mx-auto w-full max-w-[26rem]">
        <ol className="mb-7 flex gap-2 text-sm" aria-label="가입 순서">
          {['약관 동의', '닉네임', '사진'].map((t, i) => (
            <li
              key={t}
              aria-current={step === i + 1 ? 'step' : undefined}
              className={
                'rounded-md px-4 py-1 font-medium ' +
                (step === i + 1
                  ? 'bg-teal-strong text-white'
                  : step > i + 1 ? 'bg-badge-teal-bg text-teal-strong' : 'bg-gray-50 text-gray-400 dark:bg-gray-950')
              }
            >
              {i + 1}. {t}
            </li>
          ))}
        </ol>

        {step === 1 && (
          <section>
            <h1 className="text-h2 font-bold">시작하기 전에</h1>
            <p className="mt-2 text-lg text-gray-500">아래 항목에 동의해 주세요</p>

            <button
              type="button"
              onClick={toggleAll}
              className="mt-6 flex w-full items-center gap-5 rounded-sm border border-gray-200 px-6 py-5 text-left dark:border-gray-700"
            >
              <Box on={allChecked} />
              <span className="text-body-lg font-bold">모두 동의합니다</span>
            </button>

            <ul className="mt-5 space-y-1">
              {AGREEMENTS.map((a) => (
                <li key={a.key} className="flex items-center gap-3">
                  <label className="flex flex-1 cursor-pointer items-center gap-5 py-4">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!!checked[a.key]}
                      onChange={(e) => setChecked({ ...checked, [a.key]: e.target.checked })}
                    />
                    <Box on={!!checked[a.key]} />
                    <span className="text-lg">
                      {a.required
                        ? <span className="text-brand-red">[필수] </span>
                        : <span className="text-gray-400">[선택] </span>}
                      {a.label}
                    </span>
                  </label>
                  {a.doc && (
                    <Link
                      href={`/terms/${a.doc}`}
                      className="shrink-0 rounded-xs border border-gray-200 px-4 py-1 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                    >
                      보기
                    </Link>
                  )}
                </li>
              ))}
            </ul>

            <button
              type="button"
              disabled={!allRequired}
              onClick={() => setStep(2)}
              className="mt-7 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white transition-colors hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allRequired ? '다음' : '필수 항목에 모두 동의해 주세요'}
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="text-h2 font-bold">닉네임을 정해 주세요</h1>
            <p className="mt-2 text-lg text-gray-500">
              커뮤니티에 이 이름으로 보입니다. 나중에 5번까지 바꿀 수 있습니다
            </p>

            <input
              value={nick}
              onChange={(e) => { setNick(e.target.value); setNickErr(null); }}
              maxLength={12}
              placeholder="2~12자"
              aria-label="닉네임"
              className="mt-6 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-body-lg dark:border-gray-700 dark:bg-gray-950"
            />
            {nickErr && <p className="mt-2 text-lg text-brand-red">{nickErr}</p>}

            <button
              type="button"
              disabled={busy || nick.trim().length < 2}
              onClick={saveNickname}
              className="mt-6 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? '저장하는 중…' : '다음'}
            </button>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="text-h2 font-bold">프로필 사진 (선택)</h1>
            <p className="mt-2 text-lg text-gray-500">
              안 올리시면 아래 이모지 아바타로 시작합니다
            </p>

            <div className="mt-6 flex items-center gap-6">
              <Avatar value={avatar} size="lg" />
              <label className="cursor-pointer rounded-md border border-gray-200 px-6 py-4 text-lg font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-950">
                사진 올리기
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhoto(f); }}
                />
              </label>
            </div>

            <p className="mt-6 text-sm text-gray-400">이모지와 색을 고르셔도 됩니다</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  aria-label={em}
                  onClick={() => setAvatar(emojiAvatar(em, avatar.split('|')[1] || AVATAR_COLORS[0]))}
                  className="rounded-md border border-gray-200 px-4 py-1 text-body-lg dark:border-gray-700"
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={'바탕색 ' + c}
                  onClick={() => setAvatar(emojiAvatar(avatar.split('|')[0] || AVATAR_EMOJIS[0], c))}
                  className="size-[28px] rounded-md border border-gray-200 dark:border-gray-700"
                  style={{ background: c }}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!avatar.startsWith('u/')) {
                  await browserSupabase().from('profiles').update({ avatar }).eq('id', session.user.id);
                  await reload();
                }
                toast('가입이 끝났습니다');
                router.push('/');
              }}
              className="mt-7 w-full rounded-md bg-brand-red px-6 py-5 text-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-40"
            >
              시작하기
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

/* 체크박스는 label 과 묶어 라벨 전체가 눌리게 합니다 — teamsparta.md */
function Box({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={
        'flex size-[22px] shrink-0 items-center justify-center rounded-xs border text-white ' +
        (on ? 'border-brand-red bg-brand-red' : 'border-gray-300 dark:border-gray-600')
      }
    >
      {on ? '✓' : ''}
    </span>
  );
}
