'use client';

import { useState } from 'react';
import { RapoToolPage } from '@/components/rapo/rapo-tool';
import { Basis, BigNum, Card, DateField, Line, NumField, ResultHint, Warn, man, num, won } from '@/components/tool-parts';
import { severance } from '@/lib/labor';

/* 퇴직금 계산기.

   계산은 lib/labor.ts 에 있습니다 (node lib/labor.test.mjs 로 시험합니다).
   여기서 다시 계산하지 않습니다.

   **결과만 던지지 않습니다.** 1일 평균임금이 어떻게 나왔는지,
   3개월이 며칠인지까지 보여줍니다 — 그래야 본인 명세서와 맞춰볼 수 있습니다. */

export default function SeveranceTool() {
  const [joined, setJoined] = useState('');
  const [left, setLeft] = useState('');
  const [wage, setWage] = useState('300');
  const [bonus, setBonus] = useState('');
  const [leavePay, setLeavePay] = useState('');

  const ok = joined !== '' && left !== '';
  const r = ok
    ? severance({
        joined: new Date(joined + 'T00:00:00'),
        left: new Date(left + 'T00:00:00'),
        monthlyWage: num(wage) * 10_000,
        bonusYear: num(bonus) * 10_000,
        leavePayYear: num(leavePay) * 10_000,
      })
    : null;

  const backwards = ok && new Date(left) <= new Date(joined);

  return (
    <RapoToolPage 지금="/tools/severance" hit="tools/severance" 제목="퇴직금 계산" 설명="입사일과 퇴사일, 최근 급여로 예상 퇴직금을 확인하세요. 넣은 값은 저장하지 않아요.">

      <Card title="퇴직 조건">
        <div className="flex flex-col gap-(--rapo-dimension-x4)">
          <DateField label="입사일" value={joined} onChange={setJoined} />
          <DateField label="퇴사일" value={left} onChange={setLeft}
                     hint="마지막으로 일한 날을 넣어 주세요" />
          <NumField label="최근 3개월 월 평균 급여" value={wage} onChange={setWage}
                    unit="만원" hint="세전입니다. 수당까지 포함한 금액이에요"
                    placeholder="300" />
          <NumField label="1년치 상여금" value={bonus} onChange={setBonus}
                    unit="만원" hint="없으면 비워 두세요" placeholder="0" />
          <NumField label="1년치 연차수당" value={leavePay} onChange={setLeavePay}
                    unit="만원" hint="없으면 비워 두세요" placeholder="0" />
        </div>
      </Card>

      {!ok && <ResultHint>입사일과 퇴사일을 넣으면 예상 퇴직금을 바로 보여 드려요.</ResultHint>}

      {backwards && <Warn>퇴사일이 입사일보다 빨라요. 날짜를 다시 봐 주세요.</Warn>}

      {r && !backwards && !r.eligible && (
        <Warn>
          재직 {r.workedDays.toLocaleString('ko-KR')}일입니다.
          법정 퇴직금은 <b>1년(365일) 이상</b> 일해야 받을 수 있어요.
          {' '}{r.shortDays.toLocaleString('ko-KR')}일이 모자랍니다.
          <br />
          회사 규정이 법보다 좋으면 그쪽을 따르니, 취업규칙을 한 번 확인해 보세요.
        </Warn>
      )}

      {r && !backwards && r.eligible && (
        <>
          <div>
            <BigNum
              label="예상 퇴직금"
              value={Math.round(r.amount / 10_000)}
              unit="만원"
              sub={`${won(r.amount)} · 재직 ${r.years}년 ${r.restDays}일`}
            />
          </div>

          <Card
            title="어떻게 나온 숫자인지"
            note="1일 평균임금 × 30 × 재직일수 ÷ 365 입니다"
          >
            <Line k="재직일수" v={`${r.workedDays.toLocaleString('ko-KR')}일`} />
            <Line k="퇴직 전 3개월" v={`${r.months3Days}일`} />
            <Line k="그 3개월 임금" v={won(r.wage3)} />
            <Line k="1일 평균임금" v={won(r.dailyAvg)} strong />
            <Line k="× 30일" v={won(r.dailyAvg * 30)} />
            <Line k={`× 재직 ${r.workedDays.toLocaleString('ko-KR')}일 ÷ 365`} v={man(r.amount)} strong />
          </Card>

          <Card title="3개월을 90일로 안 셉니다">
            <p className="break-keep text-[14px] leading-relaxed text-[#4A5056]">
              퇴직 전 3개월의 <b>실제 달력 일수</b>로 나눕니다.
              2월이 끼면 89일, 여름이면 92일이에요. 이 차이가 몇 만원씩 납니다.
              이번 계산에서는 {r.months3Days}일이었어요.
            </p>
          </Card>
        </>
      )}

      <Basis>
        근로자퇴직급여보장법 제8조 기준입니다. 실제와 다를 수 있어요.
        상여금과 연차수당은 1년치의 3/12 만 평균임금에 넣습니다.
        여기서 내는 값은 <b>법이 정한 최소</b>입니다 —
        회사 규정이 법보다 좋으면 그쪽을 따릅니다.
        1년 미만이어도 회사 규정에 따라 받을 수 있으니 취업규칙을 확인해 주세요.
      </Basis>
    </RapoToolPage>
  );
}
