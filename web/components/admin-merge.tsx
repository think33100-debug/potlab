'use client';

import { useCallback, useEffect, useState } from 'react';
import { SOURCE_NAME } from '@/lib/supabase';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 묶을 후보 (2026-10-04).

   ── 왜 사람이 가려야 하나 ───────────────────────────────────
   같은 기관·같은 마감·다른 출처인 짝을 모아 옵니다. **제목은 안 봅니다.**
   「작업치료사」와 「물리치료사」로 제목이 달라도 한 공고를 둘로 올린
   경우가 있고, 반대로 제목이 같아도 진짜 다른 자리인 경우가 있습니다.
   글자로는 못 가립니다. 그래서 자동으로 묶지 않습니다.

   직군이 다른 짝은 **아래로** 내립니다. 그쪽이 대개 서로 다른 공고입니다.

   ── 누르면 ─────────────────────────────────────────────────
   묶기        공고연결() — 남길 줄만 남고 다른 줄은 감춰집니다.
               **지우지 않습니다.** 풀면 그대로 돌아옵니다
   묶지 않음    묶지않기() — 그 짝을 기억해 다시 안 올립니다
   풀기        공고연결풀기() — 감췄던 줄이 다시 보입니다

   되돌리기    묶지않음되돌리기() — 잘못 누른 짝을 다시 후보로 올립니다
               (2026-10-05 에 함수가 올라가 단추를 달았습니다) */

type 후보 = {
  왼쪽: string; 오른쪽: string; 기관: string;
  왼쪽출처: string; 왼쪽제목: string; 왼쪽직군: string | null;
  왼쪽링크: string | null; 왼쪽올린날: string | null;
  오른쪽출처: string; 오른쪽제목: string; 오른쪽직군: string | null;
  오른쪽링크: string | null; 오른쪽올린날: string | null;
  마감: string | null; 직군다름: boolean;
};

type 묶은 = {
  연결한줄: string; 연결한출처: string; 연결한제목: string; 연결한직군: string | null;
  남긴줄: string | null; 남긴출처: string | null; 남긴제목: string | null;
  기관: string | null; 왜: string | null; 묶은날: string | null;
};

type 안묶음 = {
  왼쪽: string; 오른쪽: string; 정한때: string;
  왼쪽출처: string | null; 왼쪽제목: string | null;
  오른쪽출처: string | null; 오른쪽제목: string | null; 기관: string | null;
};

const 출처말 = (s: string | null) => (s ? (SOURCE_NAME[s] ?? s) : '모름');

export function AdminMerge() {
  const toast = useToast();
  const [열림, set열림] = useState(false);
  const [후보들, set후보들] = useState<후보[] | null>(null);
  const [묶은것들, set묶은것들] = useState<묶은[] | null>(null);
  const [안묶음들, set안묶음들] = useState<안묶음[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = browserSupabase();
    /* 짝이 100 을 넘으면 쪽을 넘겨 받습니다 — 조용히 잘리는 자리입니다 */
    const 모두: 후보[] = [];
    for (let 쪽 = 0; 쪽 < 20; 쪽++) {
      const { data, error } = await sb.rpc('묶을후보', { p_page: 쪽 });
      if (error) { setErr(error.message); return; }
      const 받은것 = (data ?? []) as 후보[];
      모두.push(...받은것);
      if (받은것.length < 100) break;
    }
    const [묶음, 안묶음] = await Promise.all([
      sb.rpc('묶은것', { p_page: 0 }),
      sb.rpc('묶지않음목록', { p_page: 0 }),
    ]);
    setErr(null);
    set후보들(모두);
    set묶은것들((묶음.data ?? []) as 묶은[]);
    set안묶음들((안묶음.data ?? []) as 안묶음[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const 묶기 = async (c: 후보, 남길: string) => {
    const 연결할 = 남길 === c.왼쪽 ? c.오른쪽 : c.왼쪽;
    if (busy) return;
    setBusy(c.왼쪽);
    const { data, error } = await browserSupabase().rpc('공고연결', {
      p_남길: 남길, p_연결할: 연결할, p_왜: '관리자가 화면에서 묶음',
    });
    setBusy(null);
    if (error) { toast('묶지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    const n = Number((data as Record<string, unknown> | null)?.['연결함'] ?? 0);
    /* ★ 0 이면 **손 잠금(admin_locked)** 때문입니다. 「됐다」고 말하면 안 됩니다 */
    toast(n > 0 ? '묶었어요' : '안 묶였어요 — 손으로 잠긴 공고입니다', n > 0 ? undefined : { tone: 'danger', ms: 4000 });
    load();
  };

  const 묶지않기 = async (c: 후보) => {
    if (busy) return;
    setBusy(c.왼쪽);
    const { error } = await browserSupabase().rpc('묶지않기', {
      p_왼쪽: c.왼쪽, p_오른쪽: c.오른쪽,
    });
    setBusy(null);
    if (error) { toast('저장하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    toast('다른 공고로 기억했어요');
    load();
  };

  /* 「묶지 않음」을 잘못 눌렀을 때. 지우는 것은 그 기억 한 줄뿐이고,
     공고는 손대지 않습니다 — 그 짝이 다시 후보로 올라옵니다 */
  const 되돌리기 = async (x: 안묶음) => {
    if (busy) return;
    setBusy(x.왼쪽);
    const { data, error } = await browserSupabase().rpc('묶지않음되돌리기', {
      p_왼쪽: x.왼쪽, p_오른쪽: x.오른쪽,
    });
    setBusy(null);
    if (error) { toast('되돌리지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    const n = Number((data as Record<string, unknown> | null)?.['되돌린줄'] ?? 0);
    toast(n > 0 ? '다시 후보로 올렸어요' : '이미 없는 짝이에요');
    load();
  };

  const 풀기 = async (m: 묶은) => {
    if (busy) return;
    setBusy(m.연결한줄);
    const { data, error } = await browserSupabase()
      .rpc('공고연결풀기', { p_연결할: m.연결한줄 });
    setBusy(null);
    if (error) { toast('풀지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    const n = Number((data as Record<string, unknown> | null)?.['푼 줄'] ?? 0);
    toast(n > 0 ? '풀었어요 — 다시 보입니다' : '안 풀렸어요 — 손으로 잠긴 공고입니다',
      n > 0 ? undefined : { tone: 'danger', ms: 4000 });
    load();
  };

  if (err) {
    return (
      <section className="mb-8 rounded-sm border border-brand-red/40 bg-brand-red-soft p-6">
        <p className="text-lg text-brand-red-dark">묶을 후보를 불러오지 못했어요 — {err}</p>
        <p className="mt-1 text-sm text-brand-red-dark">
          함수가 아직 없으면 sql/2026-10-04_묶을후보.sql 을 올려 주십시오
        </p>
      </section>
    );
  }

  const 후보수 = 후보들?.length ?? null;

  return (
    <section className="mb-8">
      <button type="button" onClick={() => set열림(!열림)}
        className="flex w-full items-center justify-between rounded-sm border border-gray-200 px-6 py-5 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-950">
        <span className="break-keep text-h3 font-bold">
          묶을 후보
          <span className="ml-3 text-lg font-medium text-mute">
            {후보수 === null ? '세는 중…' : 후보수 + '짝'}
            {묶은것들 && 묶은것들.length > 0 && ' · 묶은 것 ' + 묶은것들.length}
            {안묶음들 && 안묶음들.length > 0 ? ' · 다른 공고로 정한 것 ' + 안묶음들.length : ''}
          </span>
        </span>
        <span className="shrink-0 text-lg text-mute">{열림 ? '접기' : '펼치기'}</span>
      </button>

      {열림 && (
        <>
          <p className="mt-3 break-keep text-sm leading-relaxed text-mute">
            같은 기관 · 같은 마감 · 다른 출처인 짝입니다. <b>제목은 안 봤습니다</b> —
            글자로는 한 공고인지 못 가립니다. <b>직군이 다른 짝은 아래쪽</b>에
            있고, 대개 서로 다른 공고입니다.
            <br />
            묶어도 <b>지우지 않습니다.</b> 남길 쪽만 남고 다른 쪽은 감춰지며,
            풀면 그대로 돌아옵니다.
          </p>

          {후보수 === 0 && (
            <p className="mt-4 rounded-sm border border-gray-100 p-6 text-lg text-mute dark:border-gray-800">
              묶을 후보가 없어요.
            </p>
          )}

          <ul className="mt-4 flex flex-col gap-4">
            {(후보들 ?? []).map((c) => (
              <li key={c.왼쪽 + '|' + c.오른쪽}
                className="rounded-sm border border-gray-200 p-6 dark:border-gray-700">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <b className="text-ink">{c.기관}</b>
                  <span className="text-mute">{c.마감 ? c.마감 + ' 마감' : '마감 모름'}</span>
                  {c.직군다름 && (
                    <span className="rounded-xs bg-brand-red-soft px-3 py-1 text-brand-red-dark">
                      직군이 다릅니다 — 다른 공고일 수 있습니다
                    </span>
                  )}
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([['왼쪽', c.왼쪽, c.왼쪽출처, c.왼쪽제목, c.왼쪽직군, c.왼쪽링크, c.왼쪽올린날],
                     ['오른쪽', c.오른쪽, c.오른쪽출처, c.오른쪽제목, c.오른쪽직군, c.오른쪽링크, c.오른쪽올린날],
                    ] as const).map(([쪽, id, 출처, 제목, 직군, 링크, 올린날]) => (
                    <div key={쪽} className="rounded-xs border border-gray-100 p-5 dark:border-gray-800">
                      <p className="text-sm text-mute">
                        {출처말(출처)} · {직군 ?? '직군 모름'}
                        {올린날 ? ' · ' + 올린날 : ''}
                      </p>
                      <p className="mt-1 break-keep text-lg font-bold">{제목}</p>
                      <p className="mt-1 flex flex-wrap gap-3 text-sm">
                        <a href={`/jobs/${id}`} target="_blank" rel="noopener noreferrer"
                          className="text-mute underline underline-offset-2">우리 화면</a>
                        {링크 && (
                          <a href={링크} target="_blank" rel="noopener noreferrer"
                            className="text-mute underline underline-offset-2">원문</a>
                        )}
                      </p>
                      <button type="button" disabled={busy === c.왼쪽}
                        onClick={() => 묶기(c, id)}
                        className="mt-3 w-full rounded-md bg-brand-red px-5 py-3 text-lg font-bold text-white hover:bg-brand-red-dark disabled:opacity-40">
                        이쪽을 남기고 묶기
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" disabled={busy === c.왼쪽} onClick={() => 묶지않기(c)}
                  className="mt-3 rounded-md border border-gray-200 px-6 py-3 text-lg font-medium text-mute hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-950">
                  묶지 않음 (다른 공고입니다)
                </button>
              </li>
            ))}
          </ul>

          {묶은것들 && 묶은것들.length > 0 && (
            <>
              <h3 className="mt-8 text-h3 font-bold">묶은 것 {묶은것들.length}</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {묶은것들.map((m) => (
                  <li key={m.연결한줄}
                    className="rounded-sm border border-gray-100 p-5 dark:border-gray-800">
                    <p className="text-sm text-mute">
                      {m.기관} · {m.묶은날 ?? '날짜 모름'}
                    </p>
                    <p className="mt-1 break-keep text-lg">
                      <b>{출처말(m.연결한출처)}</b> {m.연결한제목}
                      <span className="text-mute"> → 감춤</span>
                    </p>
                    <p className="mt-1 break-keep text-sm text-mute">
                      남긴 쪽 — {출처말(m.남긴출처)} {m.남긴제목 ?? m.남긴줄 ?? '(남긴 줄을 못 찾음)'}
                    </p>
                    <button type="button" disabled={busy === m.연결한줄} onClick={() => 풀기(m)}
                      className="mt-3 rounded-md border border-gray-200 px-6 py-3 text-lg font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-950">
                      풀기
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {안묶음들 && 안묶음들.length > 0 && (
            <>
              <h3 className="mt-8 text-h3 font-bold text-mute">
                다른 공고로 정한 것 {안묶음들.length}
              </h3>
              <p className="mt-1 break-keep text-sm text-mute">
                후보 목록에 다시 안 올라옵니다. 잘못 눌렀으면 되돌리세요 —
                <b> 공고는 손대지 않습니다.</b>
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {안묶음들.map((x) => (
                  <li key={x.왼쪽 + '|' + x.오른쪽}
                    className="rounded-sm border border-gray-100 p-5 dark:border-gray-800">
                    <p className="text-sm text-mute">
                      {x.기관 ?? '기관 모름'} · {String(x.정한때).slice(0, 10)}
                    </p>
                    <p className="mt-1 break-keep text-lg">
                      {출처말(x.왼쪽출처)} {x.왼쪽제목 ?? x.왼쪽}
                      <span className="text-mute"> ↔ </span>
                      {출처말(x.오른쪽출처)} {x.오른쪽제목 ?? x.오른쪽}
                    </p>
                    <button type="button" disabled={busy === x.왼쪽} onClick={() => 되돌리기(x)}
                      className="mt-3 rounded-md border border-gray-200 px-6 py-3 text-lg font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-950">
                      되돌리기
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
