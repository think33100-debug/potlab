'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AvatarPicker } from '@/components/avatar-picker';
import { MyLists } from '@/components/my-lists';
import { SurveyEdit } from '@/components/survey-edit';

import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS, ROLES, ROLE_DESC, type Role } from '@/lib/who';
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

  /* 이 칸에서 바뀐 게 있는지. 없으면 단추를 잠급니다 —
     「지금 쓰는 닉네임과 같아요」를 오류로 띄우면, 사진만 바꾸러 온 분이
     저장이 통째로 막힌 줄로 압니다. 이 화면은 칸마다 따로 저장됩니다 */
  const nickChanged = nick.trim() !== me.nickname;

  const saveNick = async () => {
    const name = nick.trim();
    if (!nickChanged) return;
    if (name.length < 2 || name.length > 12) { setErr('2자에서 12자까지 쓸 수 있어요'); return; }

    setBusy(true); setErr(null);
    const { error } = await browserSupabase()
      .from('profiles').update({ nickname: name }).eq('id', me.id);
    setBusy(false);

    if (error) {
      /* 5번을 넘기면 DB 트리거가 막습니다. 화면에서만 막으면
         요청을 손으로 만들어 넘길 수 있어서 막는 자리를 DB 에 뒀습니다 */
      setErr(
        error.code === '23505'
          ? '이미 쓰고 있는 닉네임이에요'
          : error.message.includes('5번')
            ? '더 바꾸려면 결제가 필요해요'
            : `바꾸지 못했어요 — ${error.message}`,
      );
      return;
    }
    await reload();
    toast(`닉네임이 바뀌었어요! ${left - 1}번 더 바꿀 수 있어요`);
  };

  /* 직군·역할 바꾸기. 닉네임과 달리 횟수 제한이 없습니다 —
     졸업하면 학생에서 현직으로 옮겨야 하기 때문입니다 */
  const setWho = async (patch: { job_group?: string; role?: string }) => {
    const { error } = await browserSupabase().from('profiles').update(patch).eq('id', me.id);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    await reload();
    toast(patch.role ? `${patch.role}으로 바꿨어요` : `${patch.job_group}로 바꿨어요`);
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">내 정보</h1>
      <p className="mt-2 text-lg text-gray-500">칸마다 따로 저장돼요. 하나만 바꿔도 돼요</p>

      <section className="mt-7">
        <h2 className="text-h3 font-bold">프로필 사진</h2>
        <p className="mt-1 text-sm text-gray-400">고르면 바로 저장돼요</p>
        <div className="mt-5">
          <AvatarPicker userId={me.id} value={me.avatar} onChange={reload} />
        </div>
      </section>

      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <h2 className="text-h3 font-bold">닉네임</h2>
        <p className="mt-1 text-lg text-gray-500">
          {locked
            ? '무료로 바꿀 수 있는 5번을 다 쓰셨어요'
            : `${FREE_CHANGES}번 중 ${left}번 남았어요`}
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
            disabled={busy || locked || !nickChanged}
            className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            바꾸기
          </button>
        </div>

        {err && <p className="mt-2 text-lg text-brand-red">{err}</p>}

        {locked && (
          <p className="mt-5 rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
            더 바꾸려면 결제가 필요해요.
            <span className="mt-1 block text-sm">결제는 아직 준비 중이에요</span>
          </p>
        )}
      </section>

      <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
        <h2 className="text-h3 font-bold">직군 · 역할</h2>
        <p className="mt-1 text-lg text-gray-500">
          커뮤니티에서 보이는 방이 역할로 갈려요. 졸업하시면 현직으로 바꿔 주세요
        </p>
        <p className="mt-1 text-sm text-gray-400">누르면 바로 저장돼요</p>

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

      <SurveyEdit profileId={me.id} role={(me.role ?? '현직') as Role} job={me.job_group ?? '작업치료사'} />

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
