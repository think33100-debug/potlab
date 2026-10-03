'use client';

import { useState } from 'react';
import { BigNum, Card, Line, NumField, Warn, num, won } from '@/components/tool-parts';
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
      <Card>
        <div className="flex flex-col gap-6">
          <NumField
            label="퇴직 전 3개월 평균 월급"
            value={월급}
            onChange={set월급}
            unit="만원"
            placeholder="280"
            hint="세전 월급입니다. 상여와 연차수당은 넣지 않습니다"
          />

          <div>
            <span className="block break-keep text-sm font-bold text-[#5F666C]">나이</span>
            <div className="mt-2 flex gap-2">
              {[['50세 미만', false], ['50세 이상 또는 장애인', true]].map(([이름, 값]) => (
                <button
                  key={String(이름)}
                  type="button"
                  onClick={() => set오십이상(값 as boolean)}
                  aria-pressed={오십이상 === 값}
                  className={'flex-1 break-keep rounded-xs border px-4 py-4 text-[15px] font-medium transition-colors '
                    + (오십이상 === 값
                      ? 'border-teal-strong bg-teal-strong text-white'
                      : 'border-[#E3E3DE] bg-white text-[#5F666C] hover:bg-[#F7F7F4]')}
                >
                  {이름 as string}
                </button>
              ))}
            </div>
            <span className="mt-1 block break-keep text-sm text-[#5F666C]">
              이직한 날의 나이입니다. 받는 날수가 달라집니다
            </span>
          </div>

          <label className="block">
            <span className="block break-keep text-sm font-bold text-[#5F666C]">고용보험 가입기간</span>
            <select
              value={가입기간}
              onChange={(e) => set가입기간(e.target.value)}
              className="mt-2 w-full rounded-xs border border-[#E3E3DE] bg-white px-5 py-4 text-[17px] text-[#14181C]"
            >
              {설정.소정급여일수.map((x) => (
                <option key={x.가입기간} value={x.가입기간}>{x.가입기간}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {!셀수있나 && (
        <p className="mt-6 break-keep text-lg text-gray-500">월급을 넣으면 바로 나옵니다</p>
      )}

      {r && (
        <>
          <div className="mt-6">
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

      <p className="mt-4 break-keep text-sm text-[#5F666C]">
        3개월 일수는 오늘({new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' })})
        기준 {d3}일로 셉니다. 퇴직일에 따라 89~92일로 달라집니다
      </p>
    </>
  );
}
