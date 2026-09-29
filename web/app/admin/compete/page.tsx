'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase-browser';

/* 알리오 경쟁률 — **묶음 중심** 보기 (2026-09-29 · 세중님 결정).
 *
 * ⚠ **회원 화면에는 아직 안 붙입니다.** 설계는 `경쟁률_화면_설계.md` 에 있습니다.
 *
 * ── 묶음 ──────────────────────────────────────────────────
 * 같은 기관 + 같은 직군 + 같은 지역이면 연도가 달라도 한 묶음입니다.
 * 그 묶음의 지난 공고를 **회차순(마감일 순)** 으로 늘어놓고,
 * 맨 위에 **평균 경쟁률과 몇 회 평균인지** 적습니다.
 * **기관 전체 경쟁률은 앞에 내세우지 않습니다** — 자리마다 너무 다릅니다.
 *
 * 이름이 해마다 다른 것(「공무직(물리치료사)」 vs 「기간제(물리치료사)」)은
 * 같은 자리인지 알 수 없어 **「짝 확인 필요」** 로 표시합니다. 짐작해 붙이지 않습니다.
 *
 * ── 숫자는 알리오 **웹** 에서 읽습니다 (API 가 아닙니다) ──
 * 공공데이터 API `/detail` 의 `steps` 가 뒤쪽 단계를 비워 보냅니다.
 *   sn 296899  API 6단계 전부 null / 웹 1차 20·135 · 최종 4·19 · 33.75
 */

type 칸 = Record<string, unknown>;
type 묶음 = 칸;
type 알림 = { 읽은공고: number; 못읽음: number; 아직: number; 마지막읽은때: string | null; 웹값: number; API값: number };
type 목록답 = { 묶음: 묶음[]; 고를것: { 기관: string[]; 직군: string[]; 지역: string[]; 연도: number[] }; 알림: 알림 };
type 하나답 = { 머리: 칸; 회차: 칸[] };

const n = (v: unknown) => (v === null || v === undefined ? '—' : String(v));
const 쉼표 = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : n(v));

/** 경쟁률 한 칸. **계산이 안 되는 것은 숫자로 안 적습니다** */
function 률(상태: unknown, 값: unknown) {
  if (상태 === '있음') return <b className="text-gray-900">{String(값)} : 1</b>;
  if (상태 === '못냄') return <span className="text-gray-500">계산 불가<span className="ml-1 text-xs">(뽑은 사람 0명)</span></span>;
  if (상태 === '진짜0') return <span className="text-gray-600">0 : 1 <span className="text-xs">(아무도 안 옴)</span></span>;
  return <span className="text-gray-400">미등록</span>;
}

/* ── 무엇으로 밝혀 두는가 (화면 아래 늘 붙습니다) ── */
function 밝힘({ 기본값단계 }: { 기본값단계?: boolean }) {
  return (
    <p className="mt-4 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500">
      <b>알리오 기준</b>입니다 (공공기관 채용정보시스템에 기관이 올린 값).
      경쟁률은 <b>첫 단계 응시자 ÷ 최종 선발 인원</b>으로, 알리오가 「최종 경쟁률」로
      적어 둔 값을 그대로 씁니다.
      뽑은 사람이 0명이면 나눌 수가 없어 <b>「계산 불가」</b>로 둡니다 — 0 으로 적지 않습니다.
      여러 직군이 한 칸에 묶인 공고는 <b>직군 구분 없는 전체 경쟁률</b>입니다.
      {기본값단계 && <> 단계가 서류인지 면접인지 공고 설명에 없으면 <b>일반적인 전형 순서 기준</b>으로 적습니다.</>}
    </p>
  );
}

function 본문() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const 기관 = params.get('기관') || '';
  const 직군 = params.get('직군') || '';
  const 지역 = params.get('지역') || '';
  const 연도 = params.get('연도') || '';
  const 찾기 = params.get('q') || '';
  const 고른묶음 = params.get('묶음') || '';

  const [d, setD] = useState<목록답 | null>(null);
  const [one, setOne] = useState<하나답 | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [글, set글] = useState(찾기);

  /* 주소에 담습니다 — 뒤로 가기를 누르면 보던 자리로 돌아옵니다 */
  const 주소로 = useCallback((바꿀것: Record<string, string | number | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(바꿀것)) {
      if (v === null || v === '') u.delete(k); else u.set(k, String(v));
    }
    router.push(pathname + (u.toString() ? '?' + u.toString() : ''), { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => { set글(찾기); }, [찾기]);

  useEffect(() => {
    let 살아있음 = true;
    setD(null); setErr(null);
    browserSupabase().rpc('admin_alio_groups', {
      p_기관: 기관 || null, p_직군: 직군 || null, p_지역: 지역 || null,
      p_연도: 연도 ? Number(연도) : null, p_찾기: 찾기 || null,
    }).then(({ data, error }) => {
      if (!살아있음) return;
      if (error) setErr(error.message); else setD(data as 목록답);
    });
    return () => { 살아있음 = false; };
  }, [기관, 직군, 지역, 연도, 찾기]);

  useEffect(() => {
    let 살아있음 = true;
    if (!고른묶음) { setOne(null); return; }
    setOne(null);
    browserSupabase().rpc('admin_alio_group_one', { p_묶음키: 고른묶음 })
      .then(({ data, error }) => {
        if (!살아있음) return;
        if (error) setErr(error.message); else setOne(data as 하나답);
      });
    return () => { 살아있음 = false; };
  }, [고른묶음]);

  if (err) return <p className="text-lg text-red-600">{err}</p>;
  if (!d) return <p className="text-lg text-gray-500">잠시만요…</p>;

  const a = d.알림;
  const 경보 = a.못읽음 > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">알리오 경쟁률</h1>
        <p className="mt-1 text-sm text-gray-500">
          같은 기관·직군·지역의 지난 공고를 한 묶음으로 이어, 회차순으로 봅니다.
          회원 화면에는 아직 안 붙였습니다.
        </p>
      </header>

      {/* ── 빨간 경보 — 알리오가 화면을 바꾸면 조용히 빈손이 됩니다 ── */}
      {경보 && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <b>알리오 화면을 못 읽은 공고가 {쉼표(a.못읽음)}건입니다.</b>
          <div className="mt-1 text-red-800">
            알리오가 화면을 바꾸면 숫자가 조용히 안 들어옵니다.
            <code className="mx-1">node tools/alio-compete-web.mjs</code>
            를 돌려 보고, 그래도 안 되면 읽는 자리(<code>tools/alio-web-check.mjs</code>)를 고쳐야 합니다.
          </div>
        </div>
      )}
      {a.아직 > 0 && !경보 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          아직 안 읽은 공고 <b>{쉼표(a.아직)}</b>건.
          <code className="mx-1">node tools/alio-compete-web.mjs</code> 를 다시 돌리면 이어서 읽습니다.
        </div>
      )}

      {/* ── 찾기 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          {([['기관', 기관, d.고를것.기관], ['직군', 직군, d.고를것.직군],
             ['지역', 지역, d.고를것.지역]] as const).map(([이름, 값, 것들]) => (
            <label key={이름} className="text-sm">
              <div className="mb-1 text-gray-500">{이름}</div>
              <select value={값} onChange={(e) => 주소로({ [이름]: e.target.value || null, 묶음: null })}
                className="w-44 rounded-lg border border-gray-300 px-2 py-1.5">
                <option value="">전체</option>
                {(것들 || []).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          ))}
          <label className="text-sm">
            <div className="mb-1 text-gray-500">연도</div>
            <select value={연도} onChange={(e) => 주소로({ 연도: e.target.value || null, 묶음: null })}
              className="w-28 rounded-lg border border-gray-300 px-2 py-1.5">
              <option value="">전체</option>
              {(d.고를것.연도 || []).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <form className="text-sm" onSubmit={(e) => { e.preventDefault(); 주소로({ q: 글 || null, 묶음: null }); }}>
            <div className="mb-1 text-gray-500">공고명·묶음이름</div>
            <input value={글} onChange={(e) => set글(e.target.value)}
              placeholder="물리치료사"
              className="w-56 rounded-lg border border-gray-300 px-2 py-1.5" />
          </form>
          {(기관 || 직군 || 지역 || 연도 || 찾기) && (
            <button onClick={() => 주소로({ 기관: null, 직군: null, 지역: null, 연도: null, q: null, 묶음: null })}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
              거르기 풀기
            </button>
          )}
        </div>
      </section>

      {/* ── 고른 묶음의 회차 ── */}
      {고른묶음 && (
        <section className="rounded-xl border-2 border-gray-900 bg-white p-5">
          <button onClick={() => 주소로({ 묶음: null })}
            className="mb-3 text-sm text-blue-700 hover:underline">← 묶음 목록으로</button>
          {!one ? <p className="text-gray-500">잠시만요…</p> : (() => {
            const h = one.머리;
            return (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="text-xl font-bold">{n(h['기관'])}</h2>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-sm text-blue-800">{n(h['직군'])}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700">{n(h['지역'])}</span>
                  {h['짝확인필요'] ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-900">짝 확인 필요</span>
                  ) : null}
                </div>
                {h['자리'] ? <div className="mt-1 text-sm text-gray-500">자리 이름: {String(h['자리'])}</div> : null}

                {/* 평균 — 몇 회 평균인지 반드시 같이 */}
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  {h['평균'] != null && Number(h['값있음']) > 0 ? (
                    <>
                      <div className="text-3xl font-bold">{String(h['평균'])} : 1</div>
                      <div className="mt-1 text-sm text-gray-600">
                        최근 <b>{쉼표(h['값있음'])}회</b> 평균 ({n(h['첫해'])}~{n(h['끝해'])}년)
                        {h['가장낮음'] != null && <> · 가장 낮았을 때 {String(h['가장낮음'])} : 1 · 가장 높았을 때 {String(h['가장높음'])} : 1</>}
                      </div>
                    </>
                  ) : (
                    <div className="text-lg text-gray-500">평균을 낼 값이 없습니다</div>
                  )}
                  <div className="mt-1 text-sm text-gray-500">
                    공고 {쉼표(h['회차'])}회
                    {Number(h['계산불가']) > 0 && <> · 계산 불가 {쉼표(h['계산불가'])}회 (뽑은 사람 0명)</>}
                  </div>
                  {h['짝확인필요'] ? (
                    <div className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      이 묶음은 공고마다 이름이 달라 <b>같은 자리인지 확인이 필요합니다.</b>
                      평균을 그대로 믿지 마십시오. 아래 회차별 이름을 보고 갈라야 할 수 있습니다.
                    </div>
                  ) : null}
                  {h['합쳐짐'] ? (
                    <div className="mt-2 rounded bg-gray-100 px-3 py-2 text-xs text-gray-700">
                      여러 직군이 한 칸에 묶인 공고가 있습니다 — <b>직군 구분 없는 전체 경쟁률</b>입니다.
                    </div>
                  ) : null}
                </div>

                {/* 회차순 */}
                <div className="mt-5 space-y-3">
                  {one.회차.map((r, i) => (
                    <div key={i} className="rounded-xl border border-gray-200 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <span className="font-semibold">{n(r['연도'])}년</span>
                          <span className="ml-2 text-sm text-gray-500">마감 {n(r['마감'])}</span>
                        </div>
                        <div className="text-lg">{률(r['경쟁률상태'], r['경쟁률'])}</div>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">{n(r['공고명'])}</div>
                      <div className="text-xs text-gray-500">{n(r['묶음이름'])}</div>

                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-gray-500">
                            <tr>
                              <th className="py-1 pr-3 font-normal">단계</th>
                              <th className="py-1 pr-3 text-right font-normal">선발</th>
                              <th className="py-1 pr-3 text-right font-normal">응시</th>
                              <th className="py-1 font-normal">결과 확정일</th>
                            </tr>
                          </thead>
                          <tbody>
                            {((r['단계'] as 칸[]) || []).map((s, j) => (
                              <tr key={j} className="border-t border-gray-100">
                                <td className="py-1 pr-3">
                                  <b>{n(s['차'])}</b>
                                  {s['무엇'] && s['무엇'] !== s['차']
                                    ? <span className="ml-1 text-gray-600">{String(s['무엇'])}</span> : null}
                                </td>
                                <td className="py-1 pr-3 text-right">{s['선발'] == null ? '—' : String(s['선발'])}명</td>
                                <td className="py-1 pr-3 text-right">{s['응시'] == null ? '—' : String(s['응시'])}명</td>
                                <td className="py-1 text-gray-500">{n(s['확정일'])}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {r['기본값단계'] ? (
                        <div className="mt-1 text-xs text-gray-400">단계 이름은 일반적인 전형 순서 기준입니다</div>
                      ) : null}
                      {r['경쟁률상태'] === '있음' && (
                        <div className="mt-1 text-xs text-gray-500">
                          {String(r['첫응시'])}명이 지원해 {String(r['끝선발'])}명을 뽑았습니다
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <밝힘 기본값단계={!!h['기본값단계']} />
              </>
            );
          })()}
        </section>
      )}

      {/* ── 묶음 목록 ── */}
      <section>
        <h2 className="mb-2 font-semibold">
          묶음 {쉼표(d.묶음.length)}개
          <span className="ml-2 text-sm font-normal text-gray-500">
            기관 + 직군 + 지역으로 이은 것. 누르면 회차별로 펼쳐집니다
          </span>
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">기관 · 직군 · 지역</th>
                <th className="px-3 py-2 text-right">회차</th>
                <th className="px-3 py-2">평균 경쟁률</th>
                <th className="px-3 py-2">가장 낮음 ~ 높음</th>
                <th className="px-3 py-2">해</th>
              </tr>
            </thead>
            <tbody>
              {d.묶음.map((x) => (
                <tr key={String(x['묶음키'])} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <button className="text-left text-blue-700 hover:underline"
                      onClick={() => 주소로({ 묶음: String(x['묶음키']) })}>
                      {n(x['기관'])}
                    </button>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">{n(x['직군'])}</span>
                      <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{n(x['지역'])}</span>
                      {x['짝확인필요'] ? (
                        <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">짝 확인 필요</span>
                      ) : null}
                      {x['합쳐짐'] ? (
                        <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">직군 구분 없음</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {쉼표(x['회차'])}
                    <div className="text-xs text-gray-400">값 {쉼표(x['값있음'])}</div>
                  </td>
                  <td className="px-3 py-2">
                    {x['평균'] != null && Number(x['값있음']) > 0 ? (
                      <>
                        <b>{String(x['평균'])} : 1</b>
                        <span className="ml-1 text-xs text-gray-500">{String(x['값있음'])}회 평균</span>
                      </>
                    ) : <span className="text-gray-400">평균 낼 값 없음</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {x['가장낮음'] != null ? <>{String(x['가장낮음'])} ~ {String(x['가장높음'])}</> : '—'}
                    {Number(x['계산불가']) > 0 && (
                      <div className="text-xs text-gray-400">계산 불가 {String(x['계산불가'])}회</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{n(x['첫해'])}~{n(x['끝해'])}</td>
                </tr>
              ))}
              {d.묶음.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">고른 조건에 맞는 묶음이 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <밝힘 />
        <p className="mt-2 text-xs text-gray-400">
          숫자는 알리오 웹 화면에서 읽습니다 — 공공데이터 API 는 뒤쪽 전형단계를 비워 보냅니다
          (지금 웹 {쉼표(a.웹값)}건 · API {쉼표(a.API값)}건).
          API 가 고쳐지면 API 로 되돌릴 수 있게 표와 도구를 그대로 두었습니다.
        </p>
      </section>
    </div>
  );
}

export default function AdminCompete() {
  return <Suspense fallback={<p className="text-lg text-gray-500">잠시만요…</p>}><본문 /></Suspense>;
}
