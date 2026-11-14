'use client';

import { useState } from 'react';
import { RapoToolPage } from '@/components/rapo/rapo-tool';
import { Basis, BigNum, Card, DateField, Line, ResultHint, Warn } from '@/components/tool-parts';
import { leave, ymd } from '@/lib/labor';

/* 연차 계산기.

   계산은 lib/labor.ts 에 있습니다 (node lib/labor.test.mjs 로 시험합니다).

   기준일을 고를 수 있게 뒀습니다 — 「올해 말이면 며칠이 되나」를
   제일 많이 궁금해합니다. 비워 두면 오늘입니다. */

export default function LeaveTool() {
  const [joined, setJoined] = useState('');
  const [at, setAt] = useState(ymd(new Date()));

  const ok = joined !== '' && at !== '';
  const backwards = ok && new Date(at) < new Date(joined);
  const r = ok && !backwards ? leave(new Date(joined + 'T00:00:00'), new Date(at + 'T00:00:00')) : null;

  return (
    <RapoToolPage 지금="/tools/leave" hit="tools/leave" 제목="연차 계산" 설명="입사일을 넣으면 올해 연차가 며칠인지 알려 드려요. 넣은 값은 저장하지 않아요.">

      <Card title="근로 조건">
        <div className="flex flex-col gap-(--rapo-dimension-x4)">
          <DateField label="입사일" value={joined} onChange={setJoined} />
          <DateField label="언제 기준으로 볼지" value={at} onChange={setAt}
                     hint="오늘로 두면 지금 쓸 수 있는 일수가 나와요" />
        </div>
      </Card>

      {!ok && <ResultHint title="연차를 확인해 보세요">입사일을 넣으면 올해 쓸 수 있는 연차 일수를 바로 보여 드려요.</ResultHint>}

      {backwards && <Warn>기준일이 입사일보다 빨라요. 날짜를 다시 봐 주세요.</Warn>}

      {r && (
        <>
          <div>
            <BigNum
              label="쓸 수 있는 연차"
              value={r.days}
              unit="일"
              sub={`근속 ${r.years}년 ${r.months}개월 기준`}
            />
          </div>

          <Card title="어떻게 나온 숫자인지">
            <p className="break-keep text-[14px] leading-relaxed text-[#4A5056]">
              {r.how}
            </p>
            <div className="mt-5">
              <Line k="근속" v={`${r.years}년 ${r.months}개월`} />
              <Line k="쓸 수 있는 일수" v={`${r.days}일`} strong />
              <Line k="언제까지 쓰나" v={r.useBy} />
            </div>
          </Card>

          {r.next ? (
            <Card title="다음에 늘어나는 때">
              <p className="break-keep text-[14px] leading-relaxed text-[#4A5056]">
                <b>{r.next.when}</b>가 되면 <b>{r.next.days}일</b>로 늘어나요.
              </p>
            </Card>
          ) : (
            <Card title="여기가 끝입니다">
              <p className="break-keep text-[14px] leading-relaxed text-[#4A5056]">
                법이 정한 한도(25일)에 닿았어요. 더 다녀도 법정 연차는 안 늘어납니다.
              </p>
            </Card>
          )}

          <Card title="어떻게 늘어나는지">
            <Line k="1년 미만" v="한 달 개근마다 1일 (최대 11일)" />
            <Line k="1년 ~ 2년" v="15일" />
            <Line k="3년째부터" v="2년마다 +1일" />
            <Line k="한도" v="25일" />
          </Card>
        </>
      )}

      <Basis>
        근로기준법 제60조 기준입니다. 실제와 다를 수 있어요.
        여기서 내는 값은 <b>법이 정한 최소</b>입니다 —
        회사 규정이 법보다 좋으면 그쪽을 따릅니다.
        회계연도(1월 1일)를 기준으로 주는 회사도 많아서, 실제 일수는
        취업규칙을 확인해 주세요. 연차는 생긴 날부터 1년 안에 써야 합니다.
      </Basis>
    </RapoToolPage>
  );
}
