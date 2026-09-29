'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { browserSupabase } from '@/lib/supabase-browser';

/* 알리오 경쟁률 — 보기만 하는 화면입니다 (2026-09-29).
 *
 * ⚠ **회원 화면에는 아직 안 붙입니다.** 세중님이 따로 정하기로 했습니다.
 *   여기는 「모인 것이 쓸 만한가」를 보는 자리입니다.
 *
 * ── 숫자는 알리오 **웹** 에서 읽습니다 (API 가 아닙니다) ──
 * 공공데이터 API `/detail` 의 `steps` 가 **뒤쪽 단계를 비워 보냅니다.**
 * 세중님이 근로복지공단 공고 하나로 잡아내셨습니다.
 *   sn 296899   API 6단계 전부 null
 *               웹 1차 20명/135명 · 최종 4명/19명 · 경쟁률 33.75
 * 새로 불러도 null 이라 캐시가 아니었습니다. 2018년부터 줄곧 그랬습니다.
 * 그래서 전형단계 숫자는 job.alio.go.kr 화면에서 읽어 담습니다.
 *
 * ── 경쟁률이 무엇인가 ───────────────────────────────────────
 * **첫 단계 응시 인원 ÷ 마지막 단계 선발 인원** 입니다.
 *   근로복지공단 공무직(물리치료사)  115명 응시 → 5명 선발 = 23 : 1
 * 웹이 「최종 경쟁률 33.75 대 1」 을 직접 적어 주면 그걸 씁니다(출처 「웹」).
 * 안 적혀 있을 때만 우리가 같은 셈으로 냅니다(출처 「우리셈」).
 * 그래서 화면에도 **「몇 명이 지원해 몇 명을 뽑았나」를 같이** 적습니다.
 * 비율만 적으면 1명 뽑는 자리와 30명 뽑는 자리를 못 가립니다.
 *
 * ── 0 을 평균에 안 섞습니다 ─────────────────────────────────
 * 경쟁률 0 은 세 가지가 섞여 있었습니다. 934건을 갈라 보니 이랬습니다.
 *   정규직 물리치료사   첫지원 43 · 끝선발 0 · 알리오 0
 * 43명이 지원했는데 **뽑은 사람이 0명** 입니다. 43 ÷ 0 을 못 내서 0 을 적은 것이고,
 * 「아무도 안 왔다」 가 아닙니다. 934건 중 **933건이 이것**, 진짜 0 은 **1건**.
 *   있음     진짜 숫자                        ← 평균은 이것만
 *   못냄      끝선발이 0 — 나눌 수가 없음 (뽑지 않았거나 취소)
 *   진짜0     첫지원이 0 — 아무도 안 옴
 *   미등록    비었거나, 0 인데 결과 확정일이 없음
 *   해당없음   중간 단계. 경쟁률은 마지막에만 붙습니다
 *
 * ── 「합쳐짐」 ──────────────────────────────────────────────
 * 이름이 「의료기술직(물리치료사)」 면 우리 직군 경쟁률입니다.
 * 「일반직 6급」 처럼 여럿이 묶인 것은 우리 직군 경쟁률이 아닙니다.
 * 섞어 쓰면 안 되니 표에서 갈라 둡니다.
 */

type 칸 = Record<string, unknown>;
type 답 = {
  전체: 칸; 기관: 칸[]; 연도: 칸[]; 줄: 칸[];
  어디까지: { 말: string; 다음쪽: number; 전체쪽: number | null; 다한날: string | null }[];
};

const n = (v: unknown) => (v === null || v === undefined ? '—' : String(v));
const 쉼표 = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : n(v));

/** 평균 경쟁률 한 칸. **몇 건으로 낸 평균인지 반드시 같이 적습니다** —
 *  1건으로 낸 평균과 274건으로 낸 평균을 같은 얼굴로 보이면 안 됩니다. */
function 평균칸(값: unknown, 몇: unknown) {
  const c = Number(몇 || 0);
  if (값 === null || 값 === undefined || !c) {
    return <span className="text-gray-400">모름<span className="ml-1 text-xs">(등록된 값 없음)</span></span>;
  }
  return (
    <span>
      <b className="text-gray-900">{String(값)}</b>
      <span className="ml-1 text-xs text-gray-500">: 1 · {c}건</span>
    </span>
  );
}

function 본문() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const year = params.get('year');
  const inst = params.get('inst');
  const 보기 = params.get('보기') === '연도' ? '연도' : '기관';

  const [d, setD] = useState<답 | null>(null);
  const [err, setErr] = useState<string | null>(null);

  /* 주소에 담습니다 — 뒤로 가기를 누르면 보던 자리로 돌아옵니다 (공고 화면과 같은 방식) */
  const 주소로 = useCallback((바꿀것: Record<string, string | number | null>) => {
    const u = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(바꿀것)) {
      if (v === null || v === '') u.delete(k); else u.set(k, String(v));
    }
    router.push(pathname + (u.toString() ? '?' + u.toString() : ''), { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    let 살아있음 = true;
    setD(null); setErr(null);
    browserSupabase()
      .rpc('admin_alio_compete', { p_year: year ? Number(year) : null, p_inst: inst })
      .then(({ data, error }) => {
        if (!살아있음) return;
        if (error) setErr(error.message); else setD(data as 답);
      });
    return () => { 살아있음 = false; };
  }, [year, inst]);

  if (err) return <p className="text-lg text-red-600">{err}</p>;
  if (!d) return <p className="text-lg text-gray-500">잠시만요…</p>;

  const 전 = d.전체;
  const 덜된것 = d.어디까지.filter((x) => !x.다한날);
  const 모듬 = 보기 === '기관' ? d.기관 : d.연도;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-bold">알리오 경쟁률</h1>
        <p className="mt-1 text-sm text-gray-500">
          공공기관 채용 공고의 <b>지원 인원 · 선발 인원 · 경쟁률</b>입니다.
          회원 화면에는 아직 안 붙였습니다 — 쓸 만한지 여기서 먼저 봅니다.
        </p>
      </header>

      {/* ── 얼마나 모였나 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          {[['공고', 쉼표(전['공고'])], ['직군 묶음', 쉼표(전['묶음'])], ['기관', 쉼표(전['기관'])],
            ['모은 해', `${n(전['첫해'])} ~ ${n(전['끝해'])}`]].map(([k, v]) => (
            <div key={k}>
              <div className="text-gray-500">{k}</div>
              <div className="text-xl font-semibold">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-100 pt-3 text-sm">
          <span>경쟁률 값 있음 <b>{쉼표(전['값있음'])}</b></span>
          <span className="text-gray-500">미등록 {쉼표(전['미등록'])}</span>
          <span className="text-gray-500">못 냄 {쉼표(전['못냄'])}</span>
          <span className="text-gray-500">진짜 0 {쉼표(전['진짜0'])}</span>
          <span className="text-gray-500">|</span>
          <span>이름이 우리 직군 <b>{쉼표(전['우리직군'])}</b></span>
          <span className="text-gray-500">여럿 합쳐짐 {쉼표(전['합쳐짐'])}</span>
        </div>
        {(Number(전['아직']) > 0 || Number(전['표없음']) > 0) && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {Number(전['아직']) > 0 && <>아직 안 읽은 공고 <b>{쉼표(전['아직'])}</b>건. </>}
            {Number(전['표없음']) > 0 && <>전형단계 표가 없는 공고 {쉼표(전['표없음'])}건. </>}
            <code>node tools/alio-compete-web.mjs</code> 를 다시 돌리면 이어서 읽습니다.
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-gray-500">
          숫자는 <b>알리오 웹 화면</b>에서 읽습니다. 공공데이터 API 는 뒤쪽 전형단계를
          비워 보내서, 그대로 쓰면 결과가 있는 공고도 「미등록」으로 보입니다.
          경쟁률은 <b>첫 단계 응시 ÷ 마지막 단계 선발 인원</b>입니다.
          한 공고에 직군이 여럿이면 직군마다 따로 나오므로 위 숫자는 <b>직군 묶음</b> 기준입니다
          (단계는 모두 {쉼표(전['단계'])}줄 담았습니다).
          경쟁률 0 은 대개 <b>뽑은 사람이 0명이라 나눌 수가 없었던 것</b>입니다
          (「못 냄」 — 43명이 지원했는데 채용을 안 한 공고도 여기 들어갑니다).
          진짜로 아무도 안 온 것은 「진짜 0」, 결과를 아직 안 올린 것은 「미등록」입니다.
          <b> 평균에는 「값 있음」만 넣습니다.</b> 모르면 모른다고 적습니다.
        </p>
      </section>

      {/* ── 어디까지 모았나 ── */}
      {d.어디까지.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
          <div className="font-medium">
            모으는 중
            {덜된것.length > 0 && <span className="text-amber-700"> — {덜된것.length}개 말이 아직 안 끝났습니다</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {d.어디까지.map((x) => (
              <span key={x.말} className={'rounded-full px-2.5 py-0.5 text-xs '
                + (x.다한날 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                {x.말} {x.다한날 ? '다 함' : `${x.다음쪽}/${x.전체쪽 ?? '?'}쪽`}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            알리오 하루 한도가 있어 나눠서 돌립니다.
            <code className="mx-1">node tools/alio-compete.mjs</code>
            를 다시 돌리면 멈춘 쪽부터 이어서 받습니다.
          </p>
        </section>
      )}

      {/* ── 기관별 / 연도별 ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          {(['기관', '연도'] as const).map((k) => (
            <button key={k} onClick={() => 주소로({ 보기: k === '기관' ? null : k })}
              className={'rounded-lg px-3 py-1.5 text-sm '
                + (보기 === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
              {k}별
            </button>
          ))}
          {(inst || year) && (
            <button onClick={() => 주소로({ inst: null, year: null })}
              className="ml-auto rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200">
              {inst ? `「${inst}」 ` : ''}{year ? `${year}년 ` : ''}거르기 풀기
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-3 py-2">{보기}</th>
                <th className="px-3 py-2 text-right">공고</th>
                <th className="px-3 py-2 text-right">직군 묶음</th>
                <th className="px-3 py-2">평균 경쟁률</th>
                <th className="px-3 py-2">우리 직군만</th>
                <th className="px-3 py-2 text-right">미등록</th>
                <th className="px-3 py-2">해</th>
              </tr>
            </thead>
            <tbody>
              {모듬.map((x) => {
                const 이름 = 보기 === '기관' ? String(x['기관']) : String(x['연도']);
                return (
                  <tr key={이름} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <button className="text-left text-blue-700 hover:underline"
                        onClick={() => 주소로(보기 === '기관' ? { inst: 이름 } : { year: 이름 })}>
                        {이름}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">{쉼표(x['공고'])}</td>
                    <td className="px-3 py-2 text-right">{쉼표(x['묶음'])}</td>
                    <td className="px-3 py-2">{평균칸(x['평균'], x['값있음'])}</td>
                    <td className="px-3 py-2">{평균칸(x['우리직군평균'], x['우리직군값있음'])}</td>
                    <td className="px-3 py-2 text-right text-gray-400">{쉼표(x['미등록'])}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {보기 === '기관' ? `${n(x['첫해'])}~${n(x['끝해'])}` : `기관 ${쉼표(x['기관'])}`}
                    </td>
                  </tr>
                );
              })}
              {모듬.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">아직 없습니다</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 고른 기관·해의 직군 묶음 하나하나 ── */}
      {d.줄.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">
            직군 묶음 {d.줄.length}건
            {d.줄.length >= 500 && <span className="ml-1 text-sm font-normal text-gray-500">(500건까지만 보여 줍니다)</span>}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2">마감</th>
                  <th className="px-3 py-2">직군 · 공고</th>
                  <th className="px-3 py-2 text-right">지원</th>
                  <th className="px-3 py-2 text-right">뽑음</th>
                  <th className="px-3 py-2">경쟁률</th>
                </tr>
              </thead>
              <tbody>
                {d.줄.map((x, i) => (
                  <tr key={i} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">{n(x['마감'])}</td>
                    <td className="px-3 py-2">
                      <div className="text-gray-900">{n(x['직군'])}</div>
                      <div className="text-xs text-gray-500">{n(x['공고'])}</div>
                      <div className="mt-0.5 flex gap-1">
                        {x['우리직군'] ? (
                          <span className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">{String(x['우리직군'])}</span>
                        ) : null}
                        {x['합쳐짐'] ? (
                          <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">여럿 합쳐짐</span>
                        ) : null}
                        {Number(x['단계수']) > 1 ? (
                          <span className="rounded bg-gray-100 px-1.5 text-xs text-gray-600">{String(x['단계수'])}단계</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {x['첫지원'] === null || x['첫지원'] === undefined
                        ? <span className="text-gray-400">모름</span> : String(x['첫지원'])}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {x['끝선발'] === null || x['끝선발'] === undefined
                        ? <span className="text-gray-400">모름</span> : String(x['끝선발'])}
                    </td>
                    <td className="px-3 py-2">
                      {x['경쟁률상태'] === '있음' ? (
                        <>
                          <b>{String(x['경쟁률'])} : 1</b>
                          {x['경쟁률출처'] === '우리셈'
                            && <span className="ml-1 text-xs text-gray-400">우리가 냄</span>}
                        </>
                      )
                        : x['경쟁률상태'] === '진짜0' ? <span className="text-gray-600">0 : 1 <span className="text-xs">(아무도 안 옴)</span></span>
                        : x['경쟁률상태'] === '못냄' ? <span className="text-gray-500">못 냄 <span className="text-xs">(뽑은 사람 0명)</span></span>
                        : <span className="text-gray-400">미등록</span>}
                      {x['확정일'] ? <div className="text-xs text-gray-400">확정 {String(x['확정일'])}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminCompete() {
  return <Suspense fallback={<p className="text-lg text-gray-500">잠시만요…</p>}><본문 /></Suspense>;
}
