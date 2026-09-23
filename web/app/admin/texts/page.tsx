'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 홈 랜딩 글 고치기.

   여기서 고친 것이 바로 홈에 나갑니다 — 배포가 필요 없습니다.
   기본값은 코드(lib/home-text.ts)에 남아 있습니다. DB 를 한 번 못 읽어도
   홈이 통째로 비지 않게 하려는 것입니다.

   여기 없는 것 —
     · 가는 곳(href) · 탭 이름 — 엉뚱한 주소가 들어가면 404 가 납니다
     · 아이콘 이름 — 오타가 나면 화면이 점 하나로 떨어집니다
     · DB 가 세어 주는 숫자 — {min} 같은 자리만 비워 두면 화면이 채웁니다

   막는 자리는 DB 입니다. home_texts 의 쓰기 규칙이 is_admin() 이고,
   value 말고 다른 칸은 권한 자체가 없습니다 — key 를 바꿔치기할 수 없습니다. */

type Row = {
  key: string;
  area: string;
  label: string;
  value: string;
  sort: number;
  multiline: boolean;
};

export default function AdminTexts() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const { data, error } = await browserSupabase()
      .from('home_texts').select('key,area,label,value,sort,multiline')
      /* sort 가 같은 줄이 생겨도 차례가 안 흔들리게 key 로 한 번 더 묶습니다 */
      .order('sort').order('key');
    const list = (data ?? []) as Row[];
    const map: Record<string, string> = {};
    list.forEach((r) => { map[r.key] = r.value; });
    return { list, map, err: error?.message ?? null };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setRows(r.list); setSaved(r.map); setErr(r.err);
    });
    return () => { alive = false; };
  }, [fetchAll]);

  const patch = (key: string, value: string) =>
    setRows((all) => (all ?? []).map((r) => (r.key === key ? { ...r, value } : r)));

  const save = async (r: Row) => {
    setBusy(r.key);
    const { error } = await browserSupabase().from('home_texts')
      .update({ value: r.value, updated_at: new Date().toISOString() })
      .eq('key', r.key);
    setBusy(null);
    if (error) { toast('저장하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    setSaved((m) => ({ ...m, [r.key]: r.value }));
    toast('저장했어요');
  };

  if (err) {
    return (
      <p className="break-keep rounded-sm bg-brand-red-soft p-6 text-lg text-brand-red-dark">
        불러오지 못했어요 — {err}
      </p>
    );
  }
  if (!rows) return <p className="text-lg text-gray-500">불러오는 중…</p>;

  /* 구역 순서는 sort 가 정합니다 — 화면에 나오는 차례와 같습니다 */
  const areas: string[] = [];
  rows.forEach((r) => { if (!areas.includes(r.area)) areas.push(r.area); });

  return (
    <div className="space-y-8">
      <p className="break-keep text-sm text-gray-500">
        고치면 바로 홈에 나가요. 가는 곳(링크)과 아이콘 이름은 여기서 안 고칩니다 —
        엉뚱한 값이 들어가면 화면이 깨져요. 「{'{min}'}」 같은 자리는 화면이 숫자로 채웁니다
      </p>

      {areas.map((area) => (
        <section key={area}>
          <h2 className="break-keep text-h3 font-bold">{area}</h2>
          <div className="mt-5 space-y-5">
            {rows.filter((r) => r.area === area).map((r) => {
              const dirty = r.value !== (saved[r.key] ?? '');
              return (
                <div key={r.key}
                  className="rounded-sm border border-gray-100 p-6 dark:border-gray-800">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="break-keep text-sm font-bold text-gray-500">{r.label}</span>
                    <span className="text-sm text-gray-400">{r.key}</span>
                  </div>

                  {r.multiline ? (
                    <textarea
                      value={r.value}
                      onChange={(e) => patch(r.key, e.target.value)}
                      rows={Math.max(2, r.value.split('\n').length + 1)}
                      aria-label={r.label}
                      className="mt-2 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
                    />
                  ) : (
                    <input
                      value={r.value}
                      onChange={(e) => patch(r.key, e.target.value)}
                      aria-label={r.label}
                      className="mt-2 w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => save(r)}
                    disabled={busy === r.key || !dirty}
                    className="mt-3 rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark disabled:opacity-40"
                  >
                    {busy === r.key ? '저장하는 중…' : '저장'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
