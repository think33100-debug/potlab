'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ago } from '@/components/post-row';
import { channelName } from '@/lib/channels';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 커뮤니티 글 — 감춘 글까지 봅니다.

   회원 화면에는 감춘 글이 아예 안 내려옵니다 (posts 의 읽기 규칙이
   「안 감춘 것 이거나 관리자」). 여기서만 보입니다.

   줄을 지우는 단추는 안 둡니다. 지우면 그 전에 나간 공유 링크가
   「없는 글」이 되고, 분쟁이 생겼을 때 원본이 없습니다.
   정말 지워야 할 일이 생기면 DB 에서 직접 지웁니다 — 규칙상 관리자만 됩니다. */

type Row = {
  id: number;
  channel: string;
  title: string | null;
  body: string;
  created_at: string;
  hidden: boolean;
  hidden_at: string | null;
  hidden_by: string | null;
  author: { nickname: string } | null;
  hider: { nickname: string } | null;
};

/* profiles 로 가는 길이 둘이라(글쓴이·감춘 사람) 관계 이름을 박아야 합니다.
   그냥 profiles 라고 쓰면 PGRST201 이 납니다 — lib/supabase.ts 의 AUTHOR 와 같은 사정입니다 */
const COLS =
  'id,channel,title,body,created_at,hidden,hidden_at,hidden_by,'
  + 'author:profiles!posts_author_id_fkey(nickname),'
  + 'hider:profiles!posts_hidden_by_fkey(nickname)';

const STATES = [
  { key: 'live', label: '보이는 글' },
  { key: 'hidden', label: '감춘 글' },
  { key: 'all', label: '전체' },
] as const;

type State = (typeof STATES)[number]['key'];

export default function AdminPosts() {
  const toast = useToast();
  const [state, setState] = useState<State>('live');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState({ live: 0, hidden: 0, all: 0 });
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* 받아오는 일과 상태에 넣는 일을 갈라둡니다 —
     effect 안에서 바로 setState 하면 그릴 때마다 한 번 더 그립니다
     (app/admin/page.tsx 와 같은 방식) */
  const fetchAll = useCallback(async (s: State) => {
    const sb = browserSupabase();
    let q = sb.from('posts').select(COLS).order('id', { ascending: false }).limit(200);
    if (s === 'live') q = q.eq('hidden', false);
    if (s === 'hidden') q = q.eq('hidden', true);

    const [list, live, hidden, all] = await Promise.all([
      q,
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('hidden', false),
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('hidden', true),
      sb.from('posts').select('id', { count: 'exact', head: true }),
    ]);

    return {
      rows: (list.data ?? []) as unknown as Row[],
      error: list.error?.message ?? null,
      counts: { live: live.count ?? 0, hidden: hidden.count ?? 0, all: all.count ?? 0 },
    };
  }, []);

  const load = useCallback(async (s: State) => {
    const r = await fetchAll(s);
    setRows(r.rows);
    setCounts(r.counts);
    setErr(r.error);
  }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    fetchAll(state).then((r) => {
      if (!alive) return;
      setRows(r.rows);
      setCounts(r.counts);
      setErr(r.error);
    });
    return () => { alive = false; };
  }, [fetchAll, state]);

  /* 감추기·되살리기는 DB 함수 하나로만 됩니다.
     hidden 칸은 화면에서 못 건드리게 권한을 걷어뒀습니다 —
     그래야 「누가 언제」가 반드시 같이 남습니다 */
  const flip = async (r: Row) => {
    const next = !r.hidden;
    const what = r.title || r.body.slice(0, 20);
    if (next && !confirm(
      '「' + what + '」를 감출까요?\n회원 화면에서 안 보이게 됩니다. 줄은 지우지 않아요',
    )) return;

    setBusy(r.id);
    const { error } = await browserSupabase().rpc('hide_post', { p_id: r.id, p_hide: next });
    setBusy(null);
    if (error) { toast('바꾸지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    await load(state);
    toast(next ? '감췄어요' : '다시 보이게 했어요');
  };

  /* 누가 감췄는지 한 줄로. 글쓴이 본인이면 「지웠어요」, 아니면 관리자가 내린 것입니다 */
  const who = (r: Row) => {
    if (!r.hider?.nickname) return '누가 감췄는지 기록이 없어요 (이 기능을 붙이기 전에 감춘 글)';
    return r.hider.nickname === r.author?.nickname
      ? '글쓴이(' + r.hider.nickname + ')가 지웠어요'
      : '관리자 ' + r.hider.nickname + ' 가 내렸어요';
  };

  return (
    <div>
      <h2 className="text-h3 font-bold">커뮤니티 글</h2>
      <p className="mt-1 break-keep text-sm text-gray-500">
        글은 지우지 않고 감춥니다. 감춘 글도 표에 남아서, 이미 나간 공유 링크가
        「지워진 글이에요」라고 말해줄 수 있어요
      </p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="거르기">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setState(s.key)}
            aria-pressed={state === s.key}
            className={
              'rounded-md border px-6 py-4 text-lg font-medium ' +
              (state === s.key
                ? 'border-teal-strong bg-teal-strong text-white'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400')
            }
          >
            {s.label}
            <span className={'ml-2 text-sm ' + (state === s.key ? 'text-white/70' : 'text-gray-400')}>
              {counts[s.key]}
            </span>
          </button>
        ))}
      </nav>

      {err && (
        <p className="mt-6 break-keep rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          불러오지 못했어요 — {err}
        </p>
      )}

      {rows === null && <p className="mt-6 text-lg text-gray-500">불러오는 중…</p>}

      {rows && rows.length === 0 && !err && (
        <p className="mt-8 text-center text-lg text-gray-500">여기 해당하는 글이 없어요</p>
      )}

      <ul className="mt-6 divide-y divide-gray-100 dark:divide-gray-800">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="py-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="rounded-md bg-badge-blue-bg px-3 font-medium text-interaction-blue">
                {channelName(r.channel)}
              </span>
              <span>{r.author?.nickname ?? '알 수 없음'}</span>
              <span className="text-gray-400">{ago(r.created_at)}</span>
              {r.hidden && (
                <span className="rounded-md bg-gray-100 px-3 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  감춤
                </span>
              )}
            </div>

            <Link href={`/post/${r.id}`} className="mt-2 block hover:underline">
              <p className="break-keep text-body-lg font-medium">
                {r.title || r.body.slice(0, 40)}
              </p>
            </Link>

            {/* 누가 언제 감췄는지 — 분쟁이 생기면 이 한 줄이 근거입니다 */}
            {r.hidden && (
              <p className="mt-2 break-keep text-sm text-gray-500">
                {r.hidden_at ? r.hidden_at.slice(0, 16).replace('T', ' ') : '시각 모름'}
                {' · '}
                {who(r)}
              </p>
            )}

            <button
              type="button"
              onClick={() => flip(r)}
              disabled={busy === r.id}
              className="mt-3 rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400"
            >
              {busy === r.id ? '바꾸는 중…' : r.hidden ? '다시 보이기' : '감추기'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
