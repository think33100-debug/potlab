'use client';

import { useState } from 'react';
import { BigNum, Card, Line, NumField, PickTwo, ResultHint, Warn, num, won } from '@/components/tool-parts';
import { 실업급여셈, 삼개월일수, type 실업급여설정 } from '@/lib/unemployment';

/* 실업급여 입력과 결과.

   ★ 화면에 보이는 과정 숫자는 **손으로 적지 않습니다.**
   전부 실업급여셈() 이 돌려주는 중간값입니다 —
   임금일액 · 셈한일액 · 어디에걸렸나 · 일수 · 삼개월일수.
   손으로 적으면 규칙이 바뀔 때 화면만 틀린 숫자를 보여줍니다
   (2026-10-03 에 제가 보고에 틀린 예시를 적어 세중님이 잡으셨습니다). */
export function UnemploymentForm({ 설정 }: { 설정: 실업급여설정 }) {
  const [월급, set월급] = useState('');
  const [오십이상, set오십이상] = useState(false);
  const [가입기간, set가입기간] = useState(설정.소정급여일수[1]?.가입기간 ?? 설정.소정급여일수[0].가입기간);

  const 월 = num(월급) * 10_000;
  const 셀수있나 = 월 > 0;
  const r = 셀수있나
    ? 실업급여셈({ 월급: 월, 가입기간, 오십이상, 설정 })
    : null;
  const d3 = 삼개월일수();

  return (
    <>
      <Card title="퇴직 조건">
        <div className="flex flex-col gap-(--rapo-dimension-x4)">
          <NumField
            label="퇴직 전 3개월 평균 월급"
            value={월급}
            onChange={set월급}
            unit="만원"
            placeholder="280"
            hint="세전 월급입니다. 상여와 연차수당은 넣지 않습니다"
          />

          <div>
            <span className="rapo-type-t4-medium block break-keep">나이</span>
            <div className="mt-(--rapo-dimension-x2)">
              <PickTwo<'under' | 'over'> label="나이" value={오십이상 ? 'over' : 'under'} onChange={(v) => set오십이상(v === 'over')}
                options={[['under', '50세 미만'], ['over', '50세 이상 또는 장애인']]} />
            </div>
            <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">
              이직한 날의 나이입니다. 받는 날수가 달라집니다
            </span>
          </div>

          <label className="block">
            <span className="rapo-type-t4-medium block break-keep">고용보험 가입기간</span>
            <select
              value={가입기간}
              onChange={(e) => set가입기간(e.target.value)}
              className="rapo-type-t5-regular mt-(--rapo-dimension-x2) h-(--rapo-dimension-x13) w-full rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral)"
            >
              {설정.소정급여일수.map((x) => (
                <option key={x.가입기간} value={x.가입기간}>{x.가입기간}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {!셀수있나 && (
        <ResultHint>월급을 넣으면 하루 받는 돈과 받는 날수를 바로 보여 드려요.</ResultHint>
      )}

      {r && (
        <>
          <div>
            <BigNum
              label="하루 받는 돈"
              value={r.일액}
              unit="원"
              sub={r.일수 + '일 동안 · 모두 ' + won(r.모두)}
            />
          </div>

          {r.어디에걸렸나 !== '그대로' && (
            <Warn>
              셈한 금액이 {r.어디에걸렸나}액에 걸렸습니다.
              {r.어디에걸렸나 === '하한'
                ? ' 셈한 ' + won(r.셈한일액) + ' 보다 하한액이 높아서 하한액을 받습니다.'
                : ' 셈한 ' + won(r.셈한일액) + ' 보다 상한액이 낮아서 상한액까지만 받습니다.'}
            </Warn>
          )}

          <Card title="어떻게 나온 숫자인가">
            <Line k={'3개월 임금 총액 (월급 × 3)'} v={won(r.삼개월임금)} />
            <Line k={'3개월 일수 (오늘 기준)'} v={r.삼개월일수 + '일'} />
            <Line k="임금일액 — 버림" v={won(r.임금일액)} />
            <Line k={'× 지급률 ' + Math.round(r.지급률 * 100) + '% — 반올림'} v={won(r.셈한일액)} />
            <Line k={'상한 ' + won(r.상한) + ' · 하한 ' + won(r.하한)}
              v={r.어디에걸렸나 === '그대로' ? '그대로 씁니다' : r.어디에걸렸나 + '액을 씁니다'} />
            <Line k="하루 받는 돈" v={won(r.일액)} strong />
            <Line k={'소정급여일수 (' + r.나이칸 + ' · ' + r.가입기간 + ')'} v={r.일수 + '일'} />
            <Line k="모두 받는 돈" v={won(r.모두)} strong />
          </Card>
        </>
      )}

      <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
        3개월 일수는 오늘({new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })})
        기준 {d3}일로 셉니다. 퇴직일에 따라 89~92일로 달라집니다
      </p>
    </>
  );
}
