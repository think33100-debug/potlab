'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 경쟁사 비교 — 관리자만 (2026-09-30).
 *
 * ── 지키는 선 ────────────────────────────────────────────────
 * · **회원 화면에는 절대 안 씁니다.** 이 화면에서만 봅니다
 * · 경쟁사 공고를 우리 공고로 옮겨 싣지 않습니다
 * · 쓰는 것은 「이 기관을 우리도 봐야겠다」 는 신호뿐입니다
 *
 * ── 땡큐오티는 게시 날짜를 안 줍니다 ─────────────────────────
 * 그래서 「우리가 처음 본 시각」 을 씁니다. 켤 때 이미 목록에 있던 것은
 * 언제 올라왔는지 몰라 **기존** 으로 두고 빠름·늦음 셈에서 뺍니다.
 */

type 줄 = {
  경쟁사: string; 글번호: string; 제목: string; 기관분류: string | null;
  기관명: string | null; 지역: string | null; 고용형태: string | null; 링크: string | null;
  처음본때: string; 기존: boolean; 넣은이: string;
  판정: string | null; 차이시간: number | null; 원인: string | null;
  상태: string | null; 메모: string | null;
  우리것: string | null; 우리제목: string | null; 우리경로: string | null;
};
type 후보 = { 기관명: string; 어디서: string | null; 상태: string; 메모: string | null };
type 짐 = {
  요약: Record<string, number>;
  원인별: Record<string, number>;
  줄: 줄[];
  수집후보: 후보[];
};

const 판정색 = (p: string | null) =>
  p === '우리가 빠름' ? 'bg-badge-green-bg text-gray-900'
    : p === '우리가 늦음' ? 'bg-brand-red-soft text-brand-red-dark'
      : p && p.includes('없음') ? 'text-gray-900 ring-1 ring-warning dark:text-gray-100'
        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

const 상태들 = ['미처리', '원인 확인', '수정 완료'];
const 원인들 = ['수집 목록에 없는 기관', '수집 주기 탓', '직군 못 가림', '보류함 대기', '막힌 병원', '모름'];

export default function AdminRival() {
  const [d, setD] = useState<짐 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [손, set손] = useState({ 기관명: '', 제목: '', 링크: '', 본날짜: '' });

  const 읽기 = useCallback(() => {
    browserSupabase().rpc('admin_rival').then(({ data, error }) => {
      if (error) setErr(error.message); else setD(data as 짐);
    });
  }, []);
  useEffect(읽기, [읽기]);

  const 바꾸기 = async (x: 줄, 상태?: string, 메모?: string, 원인?: string) => {
    const { error } = await browserSupabase().rpc('admin_rival_set', {
      p_경쟁사: x.경쟁사, p_글번호: x.글번호,
      p_상태: 상태 ?? x.상태, p_메모: 메모 ?? x.메모, p_원인: 원인 ?? null,
    });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  const 후보로 = async (x: 줄) => {
    const 이름 = x.기관명 || prompt('기관 이름을 적어주세요', x.제목.slice(0, 20)) || '';
    if (!이름) return;
    const { error } = await browserSupabase().rpc('admin_rival_org_todo', {
      p_기관명: 이름, p_어디서: x.경쟁사 + ' ' + x.글번호 + ' · ' + x.제목.slice(0, 60),
    });
    if (error) { setErr(error.message); return; }
    읽기();
  };

  const 손넣기 = async () => {
    if (!손.제목.trim()) { alert('제목을 적어주세요'); return; }
    const { error } = await browserSupabase().rpc('admin_rival_add', {
      p_경쟁사: '굿잡피티', p_기관명: 손.기관명 || null, p_제목: 손.제목,
      p_본날짜: 손.본날짜 ? new Date(손.본날짜).toISOString() : new Date().toISOString(),
      p_링크: 손.링크 || null, p_기관분류: null,
    });
    if (error) { setErr(error.message); return; }
    set손({ 기관명: '', 제목: '', 링크: '', 본날짜: '' });
    읽기();
  };

  if (err) return <p className="text-lg text-brand-red">{err}</p>;
  if (!d) return <p className="text-lg text-gray-500">잠시만요…</p>;

  const s = d.요약 || {};

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">경쟁사 비교</h1>
        <p className="mt-1 text-sm text-gray-500">
          <b>관리자만 봅니다. 회원 화면에는 쓰지 않습니다.</b> 경쟁사 공고를 우리 공고로
          옮겨 싣지 않습니다 — 쓰는 것은 「이 기관을 우리도 봐야겠다」는 신호뿐입니다.
          공고는 그 기관에서 직접 긁습니다.
        </p>
      </header>

      {/* ── 요약 ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ['이번 주 비교', s['이번 주 비교'], 'bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100'],
          ['우리가 빠름', s['우리가 빠름'], 'bg-badge-green-bg text-gray-900'],
          ['우리가 늦음', s['우리가 늦음'], 'bg-brand-red-soft text-brand-red-dark'],
          ['우리에게 없음', s['우리에게 없음'], 'bg-gray-50 text-gray-900 ring-1 ring-warning dark:bg-gray-950 dark:text-gray-100'],
          ['평균 늦은 시간', s['평균 늦은 시간'], 'bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100'],
          ['미처리', s['미처리'], 'bg-badge-blue-bg text-gray-900'],
        ].map(([라벨, 값, 색]) => (
          <div key={String(라벨)} className={'rounded-xl p-3 ' + 색}>
            <div className="text-xs font-bold">{라벨}</div>
            <div className="text-2xl font-bold">
              {값 ?? 0}{라벨 === '평균 늦은 시간' ? <span className="text-sm font-normal"> 시간</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 p-3 text-sm">
        <b>원인별</b>{' '}
        {Object.entries(d.원인별 || {}).length === 0
          ? <span className="text-gray-500">아직 없습니다</span>
          : Object.entries(d.원인별).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <span key={k} className="mr-2 inline-block rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-800">{k} {v}</span>
          ))}
        <span className="ml-2 text-xs text-gray-500">
          · 「기존」 {s['기존 (셈에서 뺌)'] ?? 0}건은 켤 때 이미 목록에 있어 빠름·늦음 셈에서 뺐습니다
        </span>
      </div>

      {/* ── 손으로 넣기 (굿잡피티) ── */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950 p-4">
        <h2 className="font-bold">굿잡피티 — 손으로 넣기</h2>
        <p className="mt-1 text-xs text-gray-500">
          굿잡피티는 이용약관에 「회사의 사전 승락없이 복제 또는 유통시키거나 상업적으로
          이용하는 경우」가 이용제한 사유로 적혀 있어 <b>자동으로 보지 않습니다.</b>
          세중님이 눈으로 보신 것만 여기 적습니다.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-5">
          <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="기관명"
            value={손.기관명} onChange={(e) => set손({ ...손, 기관명: e.target.value })} />
          <input className="rounded-lg border px-2 py-1.5 text-sm md:col-span-2" placeholder="제목"
            value={손.제목} onChange={(e) => set손({ ...손, 제목: e.target.value })} />
          <input className="rounded-lg border px-2 py-1.5 text-sm" type="datetime-local"
            value={손.본날짜} onChange={(e) => set손({ ...손, 본날짜: e.target.value })} />
          <input className="rounded-lg border px-2 py-1.5 text-sm" placeholder="링크"
            value={손.링크} onChange={(e) => set손({ ...손, 링크: e.target.value })} />
        </div>
        <button onClick={손넣기}
          className="mt-2 rounded-lg bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700">
          넣기
        </button>
      </section>

      {/* ── 줄 ── */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <tr>
              <th className="px-3 py-2">경쟁사 공고</th>
              <th className="px-3 py-2">우리 것</th>
              <th className="px-3 py-2">판정</th>
              <th className="px-3 py-2">원인</th>
              <th className="px-3 py-2">상태 · 메모</th>
            </tr>
          </thead>
          <tbody>
            {d.줄.map((x) => (
              <tr key={x.경쟁사 + x.글번호} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="rounded bg-gray-100 px-1.5 text-xs dark:bg-gray-800">{x.경쟁사}</span>
                    {x.기관분류 && <span className="rounded bg-badge-teal-bg px-1.5 text-xs text-gray-900">{x.기관분류}</span>}
                    {x.기존 && <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">기존</span>}
                    {x.넣은이 === '손' && <span className="rounded bg-badge-blue-bg px-1.5 text-xs text-gray-900">손 입력</span>}
                  </div>
                  <div className="mt-1 max-w-md">
                    {x.링크
                      ? <a href={x.링크} target="_blank" rel="noreferrer"
                        className="text-interaction-blue underline decoration-dotted">{x.제목}</a>
                      : x.제목}
                  </div>
                  <div className="text-xs text-gray-500">
                    {x.기관명 ? x.기관명 + ' (어림)' : ''} {x.지역 ?? ''} {x.고용형태 ?? ''} · 처음 본 때 {x.처음본때}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {x.우리것
                    ? <>
                      <div className="max-w-xs text-xs">{x.우리제목}</div>
                      <div className="text-xs text-gray-500">{x.우리경로} · {x.우리것}</div>
                    </>
                    : <span className="font-bold text-brand-red-dark">없습니다</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={'rounded px-1.5 py-0.5 text-xs ' + 판정색(x.판정)}>{x.판정 ?? '-'}</span>
                  {x.차이시간 != null && (
                    <div className="text-xs text-gray-500">
                      {x.차이시간 >= 0 ? '+' : ''}{x.차이시간} 시간
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select className="rounded-lg border px-1.5 py-1 text-xs"
                    value={x.원인 ?? ''} onChange={(e) => 바꾸기(x, undefined, undefined, e.target.value)}>
                    <option value="">(없음)</option>
                    {원인들.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {x.원인 === '수집 목록에 없는 기관' && (
                    <button onClick={() => 후보로(x)}
                      className="mt-1 block rounded-lg bg-interaction-blue px-2 py-1 text-xs text-white hover:opacity-80">
                      수집 후보로 올리기
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select className="rounded-lg border px-1.5 py-1 text-xs"
                    value={x.상태 ?? '미처리'} onChange={(e) => 바꾸기(x, e.target.value)}>
                    {상태들.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="mt-1 w-44 rounded-lg border px-2 py-1 text-xs" placeholder="메모"
                    defaultValue={x.메모 ?? ''}
                    onBlur={(e) => { if (e.target.value !== (x.메모 ?? '')) 바꾸기(x, undefined, e.target.value); }} />
                </td>
              </tr>
            ))}
            {d.줄.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">아직 없습니다</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 수집 후보 ── */}
      {d.수집후보.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-badge-blue-bg p-4 dark:border-gray-700">
          <h2 className="font-bold text-gray-900">수집 대상 후보 {d.수집후보.length}곳</h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-900">
            {d.수집후보.map((c) => (
              <li key={c.기관명}>
                <b>{c.기관명}</b>
                <span className="ml-2 rounded bg-white px-1.5 text-xs">{c.상태}</span>
                <span className="ml-2 text-xs text-gray-700">{c.어디서}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
