'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 내가 차단한 사람 — 풀 수 있어야 합니다 (2026-10-11 · 애플 심사 1.2).
   「차단만 되고 못 푸는」 것은 심사에서 걸립니다.

   차단한 사람이 없으면 **아무것도 안 그립니다** — 빈 칸을 보여 줄 까닭이
   없습니다 (작업지침 15절과 같은 결). */
type 줄 = { 누구: string; 닉네임: string; 때: string };

export function BlockList() {
  const toast = useToast();
  const [줄들, set줄들] = useState<줄[]>([]);
  const [도는중, set도는중] = useState(false);

  const 읽기 = useCallback(async () => {
    const { data, error } = await browserSupabase().rpc('내차단목록');
    if (!error) set줄들((data ?? []) as 줄[]);
  }, []);

  useEffect(() => { void 읽기(); }, [읽기]);

  const 풀기 = async (x: 줄) => {
    if (도는중) return;
    set도는중(true);
    const { error } = await browserSupabase().rpc('차단풀기', { p_누구: x.누구 });
    set도는중(false);
    if (error) { toast(`풀지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast(`${x.닉네임} 님 차단을 풀었어요`);
    await 읽기();
  };

  if (!줄들.length) return null;

  return (
    <section className="mt-8 border-t border-gray-100 pt-7 dark:border-gray-800">
      <h2 className="break-keep text-h3 font-bold">차단한 분</h2>
      <p className="mt-2 break-keep text-lg text-mute">
        이 분들의 글과 댓글은 안 보여요. 풀면 다시 보입니다.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {줄들.map((x) => (
          <li key={x.누구}
            className="flex items-center justify-between rounded-sm border border-gray-200 px-5 py-4 dark:border-gray-700">
            <span className="break-keep text-lg">{x.닉네임}</span>
            <button type="button" onClick={() => 풀기(x)} disabled={도는중}
              className="rounded-md border border-gray-200 px-4 py-2 text-base text-gray-600
                         hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400">
              풀기
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
