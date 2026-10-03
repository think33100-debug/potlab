import type { Metadata } from 'next';
import Link from 'next/link';
import { Hit } from '@/components/hit';
import { 기본설정, type 실업급여설정 } from '@/lib/unemployment';
import { supabase } from '@/lib/supabase';
import { UnemploymentForm } from './form';

/* 실업급여(구직급여) 계산기 (2026-10-03).

   ── 왜 이제야 만드나 ─────────────────────────────────────────
   계산기 셋을 만들 때 **일부러 빼 뒀습니다** — 상·하한이 해마다 바뀌는데
   그걸 믿고 계산한 사람이 손해를 봅니다 (app/tools/page.tsx · lib/rates.ts).
   이번에는 **값을 코드에 안 박고** 관리자 설정 한 줄로 뺐습니다.
   해가 바뀌면 그 줄만 고칩니다. 그래서 만들 수 있게 됐습니다.

   ── 숫자는 어디서 오나 ───────────────────────────────────────
   site_settings 의 `실업급여_2026` 한 줄입니다. 못 읽으면 화면에
   「기준값을 못 읽었습니다」를 띄우고 코드 기본값으로 셉니다 —
   조용히 틀린 숫자를 보여주지 않습니다.

   ── 화면에 보이는 과정 숫자 ──────────────────────────────────
   손으로 적지 않습니다. 전부 실업급여셈() 이 돌려주는 중간값입니다
   (임금일액 · 셈한일액 · 어디에걸렸나 · 일수). 세중님 지적대로입니다. */

export const metadata: Metadata = {
  title: '실업급여 계산기 · POTJOB',
  description: '하루 얼마씩 며칠 받는지. 2026년 기준 · 출처 고용노동부',
};

export const revalidate = 300;

export default async function Unemployment() {
  const { data } = await supabase
    .from('site_settings').select('value').eq('key', '실업급여_2026').maybeSingle();
  const 설정 = (data?.value as 실업급여설정 | undefined) ?? null;
  const s = 설정 ?? 기본설정;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="other" target="tools-unemployment" />

      <Link href="/tools" className="text-lg text-gray-500 hover:underline">← 계산기</Link>
      <h1 className="mt-3 break-keep text-h1 font-bold">실업급여 계산기</h1>

      {/* ★ 꼭 밝히는 줄 */}
      <p className="mt-2 break-keep text-lg text-gray-500">
        하루 얼마씩 며칠 받는지 봅니다.
        {' '}<b className="text-ink">{s.기준해}년 기준 · 출처 {s.출처}</b>
      </p>

      {!설정 && (
        <p className="mt-5 break-keep rounded-sm border border-brand-red/40 bg-brand-red-soft p-5 text-lg text-brand-red-dark">
          기준값을 못 읽었습니다 — 코드에 적어 둔 {기본설정.기준해}년 값으로 셉니다.
          <span className="mt-1 block text-sm">관리자 설정 「실업급여_{기본설정.기준해}」을 확인해 주세요</span>
        </p>
      )}

      <UnemploymentForm 설정={s} />

      {/* 기준값을 그대로 보여줍니다 — 어디서 온 숫자인지 알 수 있게 */}
      <section className="mt-8 rounded-sm border border-line bg-card p-6">
        <h2 className="text-h3 font-bold">{s.기준해}년 기준값</h2>
        <dl className="mt-4">
          {[
            ['구직급여 상한액', '하루 ' + s.구직급여상한.toLocaleString('ko-KR') + '원',
              '임금일액 상한 ' + s.임금일액상한.toLocaleString('ko-KR') + '원 × ' + Math.round(s.지급률 * 100) + '%'],
            ['구직급여 하한액', '하루 ' + s.구직급여하한.toLocaleString('ko-KR') + '원',
              '최저임금 ' + s.최저임금시간급.toLocaleString('ko-KR') + '원 × '
              + Math.round(s.하한비율 * 100) + '% × ' + s.하루소정근로시간 + '시간'],
            ['지급률', '평균임금의 ' + Math.round(s.지급률 * 100) + '%', '2019년 10월 이후 이직자'],
          ].map(([a, b, c]) => (
            <div key={a} className="flex items-baseline justify-between gap-4 border-b border-gray-50 py-4 last:border-0 dark:border-gray-800">
              <dt className="min-w-0 break-keep text-lg">
                {a}
                <span className="mt-0.5 block text-sm text-gray-400">{c}</span>
              </dt>
              <dd className="shrink-0 break-keep text-lg font-bold">{b}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-6 text-sm font-bold text-gray-500">소정급여일수</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-lg">
            <thead>
              <tr className="border-b border-gray-100 text-sm text-gray-500 dark:border-gray-800">
                <th className="py-2 text-left font-medium">고용보험 가입기간</th>
                <th className="py-2 text-right font-medium">50세 미만</th>
                <th className="py-2 text-right font-medium">50세 이상·장애인</th>
              </tr>
            </thead>
            <tbody>
              {s.소정급여일수.map((r) => (
                <tr key={r.가입기간} className="border-b border-gray-50 last:border-0 dark:border-gray-800">
                  <td className="py-3 break-keep">{r.가입기간}</td>
                  <td className="py-3 text-right">{r.아래}일</td>
                  <td className="py-3 text-right">{r.위}일</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Object.keys(s.출처주소 ?? {}).length > 0 && (
          <p className="mt-5 break-keep text-sm text-gray-400">
            출처 —{' '}
            {Object.entries(s.출처주소).map(([이름, 주소], i) => (
              <span key={이름}>
                {i > 0 && ' · '}
                <a href={주소} target="_blank" rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-gray-600">{이름}</a>
              </span>
            ))}
          </p>
        )}
      </section>

      <p className="mt-6 break-keep rounded-sm bg-gray-50 p-5 text-sm leading-relaxed text-gray-500 dark:bg-gray-950">
        <b>참고용입니다.</b> 실제 금액은 이직 사유·가입 이력·나이에 따라 달라집니다.
        스스로 그만둔 경우에는 받지 못할 수 있습니다.
        <br />
        원 단위는 이렇게 다듬습니다 — 임금일액은 <b>버림</b>,
        구직급여일액은 다듬지 않은 몫에 {Math.round(s.지급률 * 100)}%를 곱해 <b>반올림</b>합니다.
        <br />
        신청은 <a href="https://www.ei.go.kr" target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2">고용보험 누리집(ei.go.kr)</a>에서 합니다.
      </p>
    </main>
  );
}
