'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '@/app/toast';

/* 제목 때문에 사람이 봐야 하는 것 (2026-10-05).

   「보여 줄 제목」을 이어 붙일 때 **자동으로 못 정한 것**을 네 갈래로
   모읍니다. 지어내지 않고 자리를 비워 둔 것들입니다.

     지역 모름          시·도를 어디서도 못 찾았습니다
     지역 여럿          근무지가 세 곳 이상이라 자리를 뺐습니다
     직군 모름          작업·물리 어느 쪽인지 못 가렸습니다
     기관 이름 줄임 확인  「○○재단」까지 뗄지 — **사람이 승인해야** 씁니다

   앞 셋은 보여만 줍니다. 자료를 고치는 자리는 공고 화면입니다.
   넷째만 여기서 누릅니다 — 기관마다 한 번만 물으면 끝입니다. */

type 보기 = { id?: string; 기관?: string; 원문?: string; 근무지?: string;
  원래이름?: string; 줄인이름?: string; 승인했나?: boolean;
  출처?: string; 공고수?: number; 보기id?: string };

/* 시·도 짧은 이름 열일곱. 「전국」은 쓰지 않습니다 (2026-10-05 세중님 지시) */
const 시도들 = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
type 갈래 = { 수: number; 보기: 보기[] };
type 묶음 = {
  지역모름: 갈래; 지역여럿: 갈래; 직군모름: 갈래; 기관이름줄임확인: 갈래;
};

export function AdminTitleCheck() {
  const [d, setD] = useState<묶음 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /* ★ 2026-10-05 — **펼친 것이 기본**입니다 (세중님 지시).
     접어 두었더니 세중님 화면에서 19줄이 안 보였습니다. 할 일이 있는
     목록은 눌러야 보이면 안 봅니다. 접고 싶은 것만 접습니다 */
  const [닫힌갈래, set닫힌갈래] = useState<string[]>([]);
  const toast = useToast();

  const 읽기 = useCallback(() => {
    browserSupabase().rpc('admin_제목확인').then(({ data, error }) => {
      if (error) setErr(error.message); else setD(data as 묶음);
    });
  }, []);
  useEffect(읽기, [읽기]);

  /* ★ 기관별 시·도를 정합니다 (2026-10-05).
     job_posts.sido 에 쓰면 **재수집 때 수집기 값으로 덮입니다** —
     collect_put 이 `sido = case when j.source = p_source then excluded.sido …`
     이기 때문입니다. 그래서 기관지역 표에 담고, 제목만들기행() 이 그걸 봅니다.
     한 번 정하면 그 기관의 **다음 공고에도** 쓰입니다 */
  const 지역정하기 = async (기관: string, 시도: string) => {
    if (busy) return;
    setBusy(기관);
    const { data, error } = await browserSupabase()
      .rpc('기관지역정하기', { p_기관: 기관, p_시도: 시도 });
    setBusy(null);
    if (error) { toast('정하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    const n = Number((data as Record<string, unknown> | null)?.['고친 공고'] ?? 0);
    toast(시도 ? `${시도}로 정했어요 — 공고 ${n}건의 제목을 다시 만들었어요`
               : '지역을 비웠어요');
    읽기();
  };

  const 정하기 = async (원래이름: string, 쓸까: boolean) => {
    if (busy) return;
    setBusy(원래이름);
    const { error } = await browserSupabase()
      .rpc('기관이름줄임정하기', { p_원래이름: 원래이름, p_쓸까: 쓸까 });
    setBusy(null);
    if (error) { toast('정하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    toast(쓸까 ? '줄인 이름을 씁니다' : '원래 이름을 그대로 씁니다');
    읽기();
  };

  if (err) {
    return (
      <section className="rounded-sm border border-brand-red/40 bg-brand-red-soft p-6">
        <p className="text-lg text-brand-red-dark">제목 확인 목록을 못 읽었어요 — {err}</p>
      </section>
    );
  }
  if (!d) return null;

  const 칸 = [
    { 열쇠: '지역모름', 이름: '지역 모름', 갈래: d.지역모름,
      설명: '시·도를 어디서도 못 찾았습니다. 기관마다 한 번 고르면 '
        + '그 기관의 다음 공고에도 쓰입니다' },
    { 열쇠: '지역여럿', 이름: '지역 여럿', 갈래: d.지역여럿,
      설명: '근무지가 세 곳 이상이라 지역 자리를 뺐습니다' },
    { 열쇠: '직군모름', 이름: '직군 모름', 갈래: d.직군모름,
      설명: '작업·물리 어느 쪽인지 못 가려 제목을 안 만들었습니다' },
    { 열쇠: '기관이름줄임확인', 이름: '기관 이름 줄임 확인', 갈래: d.기관이름줄임확인,
      설명: '「○○재단」까지 뗄지 — 승인해야 씁니다. 기관마다 한 번만 물어요' },
  ];

  return (
    <section className="rounded-sm border border-line bg-card p-6">
      <h2 className="text-h3 font-bold">제목 — 사람이 봐야 하는 것</h2>
      <p className="mt-1 break-keep text-sm text-mute">
        「보여 줄 제목」을 이어 붙일 때 <b>지어내지 않고 자리를 비운</b> 것들입니다
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {칸.map((c) => {
          const 열림 = !닫힌갈래.includes(c.열쇠);
          return (
            <li key={c.열쇠} className="rounded-xs border border-gray-100 p-5 dark:border-gray-800">
              <button type="button"
                onClick={() => set닫힌갈래((v) =>
                  열림 ? [...v, c.열쇠] : v.filter((k) => k !== c.열쇠))}
                className="flex w-full items-center justify-between gap-3 text-left">
                <span>
                  <b className="text-body-lg text-ink">{c.이름}</b>
                  <span className={'ml-3 text-lg font-bold '
                    + (c.갈래.수 > 0 ? 'text-brand-red' : 'text-mute')}>
                    {c.갈래.수}건
                  </span>
                  <span className="mt-1 block break-keep text-sm text-mute">{c.설명}</span>
                </span>
                <span className="shrink-0 text-sm text-mute">{열림 ? '접기' : '보기'}</span>
              </button>

              {열림 && c.갈래.보기.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {c.갈래.보기.map((x, i) => (
                    <li key={(x.id ?? x.원래이름 ?? '') + i}
                      className="rounded-xs bg-paper p-4 text-sm dark:bg-gray-950">
                      {c.열쇠 === '기관이름줄임확인' ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="break-keep">
                            <b className="text-ink">{x.원래이름}</b>
                            <span className="text-mute"> → </span>
                            <b className="text-brand-red">{x.줄인이름}</b>
                          </span>
                          <span className="flex shrink-0 gap-2">
                            <button type="button" disabled={busy === x.원래이름}
                              onClick={() => 정하기(x.원래이름!, true)}
                              className="rounded-xs bg-brand-red px-4 py-2 font-bold text-white disabled:opacity-40">
                              줄여 쓰기
                            </button>
                            <button type="button" disabled={busy === x.원래이름}
                              onClick={() => 정하기(x.원래이름!, false)}
                              className="rounded-xs border border-line px-4 py-2 text-mute disabled:opacity-40">
                              그대로 두기
                            </button>
                          </span>
                        </div>
                      ) : c.열쇠 === '지역모름' ? (
                        /* ★ 기관 단위로 시·도를 고릅니다. 한 번 정하면
                           그 기관의 다음 공고에도 쓰입니다 */
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="break-keep">
                            <b className="text-ink">{x.기관}</b>
                            <span className="text-mute"> · {x.출처} · 공고 {x.공고수}건</span>
                            {x.보기id && (
                              <a href={`/jobs/${x.보기id}`} target="_blank" rel="noopener noreferrer"
                                className="ml-2 underline underline-offset-2 text-mute">보기</a>
                            )}
                          </span>
                          <select
                            disabled={busy === x.기관}
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) 지역정하기(x.기관!, e.target.value); }}
                            className="shrink-0 rounded-xs border border-line bg-white px-3 py-2 text-sm text-ink disabled:opacity-40"
                          >
                            <option value="">시·도 고르기</option>
                            {시도들.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span className="break-keep text-mute">
                          <b className="text-ink">{x.기관}</b>
                          {x.근무지 ? ` · 근무지 「${x.근무지}」` : ''}
                          {x.원문 ? ` · ${x.원문}` : ''}
                          {x.id && (
                            <a href={`/jobs/${x.id}`} target="_blank" rel="noopener noreferrer"
                              className="ml-2 underline underline-offset-2">보기</a>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                  {c.갈래.수 > c.갈래.보기.length && (
                    <li className="px-4 text-sm text-mute">
                      … 그 밖에 {c.갈래.수 - c.갈래.보기.length}건 (앞 20건만 보여줍니다)
                    </li>
                  )}
                </ul>
              )}
              {열림 && c.갈래.보기.length === 0 && (
                <p className="mt-3 text-sm text-mute">없습니다.</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
