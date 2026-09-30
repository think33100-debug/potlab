'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 손으로 확인할 곳 — 기계가 못 가는 병원 (2026-09-30).
 *
 * 「빠지지 않는 것이 자동화보다 중요합니다.」
 * 아마존 대역에서 막는 병원이 넷 있습니다. 서버를 서울로 옮겨도 안 풀립니다
 * (Lightsail 도 AWS 입니다). 그래서 버리지 않고 여기 남기고 사람이 봅니다.
 *
 * 하루 한 번 서버가 두드려 보고 결과를 남깁니다 — 병원이 막기를 그만두면
 * 「열림」 으로 바뀌어 바로 압니다.
 *
 * 자세한 것은 저장소의 `손으로_확인할곳.md`.
 */

type 줄 = {
  이름: string; 결과: string | null; 공고줄: number | null; 까닭: string | null;
  어디서: string | null; 마지막확인: string | null; 마지막열린날: string | null;
  사람이본날: string | null; 메모: string | null;
  확인한지며칠: number | null; 사람이본지며칠: number | null;
};

type 영자줄 = {
  때: string; 경로: string; 공고: string | null; 파일: string | null;
  바이트: number | null; 앞5: string | null; ctype: string | null;
  두번째도0: boolean; 원문: string | null;
};
type 영자 = { 오늘: number; 줄: 영자줄[] };

const 날 = (s: string | null) => (s ? String(s).slice(0, 10) : '—');

export default function AdminHand() {
  const [d, setD] = useState<줄[] | null>(null);
  const [영, set영] = useState<영자 | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const 읽기 = useCallback(() => {
    browserSupabase().rpc('admin_hand_check').then(({ data, error }) => {
      if (error) setErr(error.message); else setD((data as 줄[]) ?? []);
    });
    /* PDF 를 글자로 못 바꾼 건 — 9월 30일에 한 번 나왔고 원인을 못 잡아 덫을 놨습니다 */
    browserSupabase().rpc('admin_ocr_zero').then(({ data }) => {
      if (data) set영(data as 영자);
    });
  }, []);
  useEffect(읽기, [읽기]);

  const 봤다 = async (이름: string) => {
    const 메모 = prompt(
      ['「' + 이름 + '」 를 오늘 눈으로 보셨습니까?', '',
        '치료사 공고가 있었으면 메모에 적어 주세요.',
        '없었으면 그냥 확인만 눌러도 됩니다.'].join('\n'), '');
    if (메모 === null) return;
    const { error } = await browserSupabase()
      .rpc('admin_hand_check_seen', { p_이름: 이름, p_메모: 메모 || null });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  if (err) return <p className="text-lg text-red-600">{err}</p>;
  if (!d) return <p className="text-lg text-gray-500">잠시만요…</p>;

  const 막힌것 = d.filter((x) => x.결과 !== '열림');
  const 오래된것 = d.filter((x) => (x.사람이본지며칠 ?? 999) > 30);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">손으로 확인할 곳</h1>
        <p className="mt-1 text-sm text-gray-500">
          기계가 못 가는 병원입니다. <b>빠지지 않는 것이 자동화보다 중요합니다</b> —
          버리지 않고 여기 두고 사람이 봅니다.
        </p>
      </header>

      {막힌것.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <b>지금 {막힌것.length}곳이 막혀 있습니다.</b>
          <div className="mt-1">
            아마존 대역을 막는 병원이라 <b>서버를 서울로 옮겨도 안 풀립니다</b>
            (Lightsail 도 아마존입니다). 집 인터넷에서는 열립니다.
            하루 한 번 서버가 두드려 보므로, 병원이 막기를 그만두면 바로 「열림」으로 바뀝니다.
          </div>
        </div>
      )}
      {오래된것.length > 0 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <b>사람이 한 달 넘게 안 본 곳이 {오래된것.length}곳입니다.</b>
          <div className="mt-1">{오래된것.map((x) => x.이름).join(' · ')}</div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-3 py-2">병원</th>
              <th className="px-3 py-2">기계가 본 결과</th>
              <th className="px-3 py-2">마지막 확인</th>
              <th className="px-3 py-2">사람이 본 날</th>
              <th className="px-3 py-2">메모</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {d.map((x) => (
              <tr key={x.이름} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2 font-medium">{x.이름}</td>
                <td className="px-3 py-2">
                  <span className={'rounded px-1.5 text-xs ' + (x.결과 === '열림'
                    ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900')}>
                    {x.결과 ?? '—'}
                  </span>
                  {x.공고줄 ? <span className="ml-1 text-xs text-gray-500">공고 {x.공고줄}줄</span> : null}
                  <div className="text-xs text-gray-500">{x.까닭 ?? ''}</div>
                  <div className="text-xs text-gray-400">{x.어디서 ?? ''}</div>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {날(x.마지막확인)}
                  {x.확인한지며칠 != null && x.확인한지며칠 > 2 && (
                    <div className="text-xs text-red-600">{x.확인한지며칠}일 전 — 자동 확인이 멈췄나요</div>
                  )}
                  {x.마지막열린날 && (
                    <div className="text-xs text-emerald-700">열린 적: {x.마지막열린날}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {x.사람이본날 ? (
                    <>
                      {x.사람이본날}
                      <div className={'text-xs ' + ((x.사람이본지며칠 ?? 0) > 30 ? 'text-red-600' : 'text-gray-500')}>
                        {x.사람이본지며칠}일 전
                      </div>
                    </>
                  ) : <span className="text-red-600">아직 없음</span>}
                </td>
                <td className="px-3 py-2 text-gray-600">{x.메모 ?? ''}</td>
                <td className="px-3 py-2">
                  <button onClick={() => 봤다(x.이름)}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-700">
                    오늘 봤음
                  </button>
                </td>
              </tr>
            ))}
            {d.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                손으로 확인할 곳이 없습니다
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {영 && 영.줄.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">
            PDF 0자
            <span className={'ml-2 rounded px-2 py-0.5 text-sm ' + (영.오늘
              ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600')}>
              오늘 {영.오늘}건
            </span>
          </h2>
          <p className="text-sm text-gray-500">
            PDF 는 받았는데 글자가 한 자도 안 나온 건입니다. <b>한 번 더 해 보고</b>,
            두 번째도 0자면 보류함으로 보냅니다. 원인을 잡으려고 받은 크기·앞 5글자·
            content-type·응답 원문을 같이 남깁니다.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">때</th>
                  <th className="px-3 py-2">경로 · 공고</th>
                  <th className="px-3 py-2">파일</th>
                  <th className="px-3 py-2">두 번째도</th>
                  <th className="px-3 py-2">응답 원문</th>
                </tr>
              </thead>
              <tbody>
                {영.줄.map((x, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{x.때}</td>
                    <td className="px-3 py-2">
                      {x.경로}
                      {x.공고 ? <div className="text-xs text-gray-500">{x.공고}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs truncate">{x.파일 ?? '—'}</div>
                      <div className="text-xs text-gray-500">
                        {x.바이트 ?? '?'}바이트 · 앞5 「{x.앞5 ?? ''}」
                      </div>
                      <div className="text-xs text-gray-400">{x.ctype ?? ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      {x.두번째도0
                        ? <span className="rounded bg-red-100 px-1.5 text-xs text-red-800">0자 — 보류함</span>
                        : <span className="rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">두 번째엔 읽음</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-h-24 max-w-md overflow-y-auto whitespace-pre-wrap break-all text-xs text-gray-600">
                        {x.원문 ?? ''}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs leading-relaxed text-gray-500">
        확인하는 법 — 병원 채용 페이지를 열어 물리치료사·작업치료사 공고가 있는지 보고,
        있으면 관리자 → 공고에서 손으로 넣은 뒤 「오늘 봤음」을 누르십시오.
        주소와 자세한 내력은 저장소의 <code>손으로_확인할곳.md</code> 에 있습니다.
      </p>
    </div>
  );
}
