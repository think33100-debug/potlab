import type { Metadata } from 'next';
import { RapoToolPage } from '@/components/rapo/rapo-tool';
import { Basis, Warn } from '@/components/tool-parts';
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
  title: '실업급여 계산기 · RAPO',
  description: '하루 얼마씩 며칠 받는지. 2026년 기준 · 출처 고용노동부',
};

export const revalidate = 300;

export default async function Unemployment() {
  const { data } = await supabase
    .from('site_settings').select('value').eq('key', '실업급여_2026').maybeSingle();
  const 설정 = (data?.value as 실업급여설정 | undefined) ?? null;
  const s = 설정 ?? 기본설정;

  return (
    <RapoToolPage 지금="/tools/unemployment" hit="tools-unemployment" 제목="실업급여 계산" 설명={`하루 얼마씩 며칠 받는지 봅니다. ${s.기준해}년 기준 · 출처 ${s.출처}`}>
      {!설정 && (
        <Warn>
          기준값을 못 읽었습니다 — 코드에 적어 둔 {기본설정.기준해}년 값으로 셉니다. 관리자 설정 「실업급여_{기본설정.기준해}」을 확인해 주세요
        </Warn>
      )}

      <UnemploymentForm 설정={s} />

      {/* 기준값을 그대로 보여줍니다 — 어디서 온 숫자인지 알 수 있게 */}
      <section className="rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) p-(--rapo-dimension-x5)">
        <h2 className="rapo-type-t6-bold text-(color:--rapo-brand-color-navy)">{s.기준해}년 기준값</h2>
        <dl className="mt-4">
          {[
            ['구직급여 상한액', '하루 ' + s.구직급여상한.toLocaleString('ko-KR') + '원',
              '임금일액 상한 ' + s.임금일액상한.toLocaleString('ko-KR') + '원 × ' + Math.round(s.지급률 * 100) + '%'],
            ['구직급여 하한액', '하루 ' + s.구직급여하한.toLocaleString('ko-KR') + '원',
              '최저임금 ' + s.최저임금시간급.toLocaleString('ko-KR') + '원 × '
              + Math.round(s.하한비율 * 100) + '% × ' + s.하루소정근로시간 + '시간'],
            ['지급률', '평균임금의 ' + Math.round(s.지급률 * 100) + '%', '2019년 10월 이후 이직자'],
          ].map(([a, b, c]) => (
            <div key={a} className="flex items-baseline justify-between gap-(--rapo-dimension-x4) border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x3) last:border-0">
              <dt className="rapo-type-t4-regular min-w-0 break-keep">
                {a}
                <span className="rapo-type-t3-regular block text-(color:--rapo-color-fg-neutral-muted)">{c}</span>
              </dt>
              <dd className="rapo-type-t4-bold shrink-0 break-keep">{b}</dd>
            </div>
          ))}
        </dl>

        {/* ★ 금액대나 「사이 구간」 예시는 **적지 않습니다** (2026-10-03 세중님).
            경계가 3개월 일수(89~92일)에 따라 달라져서, 숫자를 적으면 틀립니다.
            같은 월 336만원이 92일이면 하한에 걸리고 90일이면 안 걸립니다.
            그래서 틈이 좁다는 사실만 한 줄로 알립니다. */}
        <p className="rapo-type-t3-regular mt-(--rapo-dimension-x4) break-keep rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">
          올해는 상한과 하한 차이가{' '}
          <b>{(s.구직급여상한 - s.구직급여하한).toLocaleString('ko-KR')}원</b>뿐이라,
          대부분 둘 중 하나에 걸립니다.
        </p>

        <h3 className="rapo-type-t4-bold mt-(--rapo-dimension-x5)">소정급여일수</h3>
        <div className="mt-(--rapo-dimension-x2) overflow-x-auto">
          <table className="rapo-type-t4-regular w-full">
            <thead>
              <tr className="rapo-type-t3-regular border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) text-(color:--rapo-color-fg-neutral-muted)">
                <th className="py-2 text-left font-medium">고용보험 가입기간</th>
                <th className="py-2 text-right font-medium">50세 미만</th>
                <th className="py-2 text-right font-medium">50세 이상·장애인</th>
              </tr>
            </thead>
            <tbody>
              {s.소정급여일수.map((r) => (
                <tr key={r.가입기간} className="border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) last:border-0">
                  <td className="py-3 break-keep">{r.가입기간}</td>
                  <td className="py-3 text-right">{r.아래}일</td>
                  <td className="py-3 text-right">{r.위}일</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {Object.keys(s.출처주소 ?? {}).length > 0 && (
          <p className="rapo-type-t3-regular mt-(--rapo-dimension-x4) break-keep text-(color:--rapo-color-fg-neutral-muted)">
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

      <Basis>
        <b>참고용입니다.</b> 실제 금액은 이직 사유·가입 이력·나이에 따라 달라집니다.
        스스로 그만둔 경우에는 받지 못할 수 있습니다.
        <br />
        원 단위는 이렇게 다듬습니다 — 임금일액은 <b>버림</b>,
        구직급여일액은 다듬지 않은 몫에 {Math.round(s.지급률 * 100)}%를 곱해 <b>반올림</b>합니다.
        <br />
        신청은 <a href="https://www.ei.go.kr" target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2">고용보험 누리집(ei.go.kr)</a>에서 합니다.
      </Basis>
    </RapoToolPage>
  );
}
