'use client';

import { PayNote } from '@/components/pay-note';
import { man10, rankOf, tierOf, type Rank } from '@/lib/pay';

/* 「내 위치」 카드. 이 화면에서 제일 중요한 자리라 따로 뒀습니다 —
   로그인해야 보이는 곳이어서, 떼어놓아야 실제 값을 넣고 눈으로 볼 수 있습니다.

   숫자를 여기서 만들지 않습니다. 서버가 준 「나보다 적게 받는 사람 수」로만 셉니다. */

export type Me = {
  nickname: string; job_group: string | null; role: string | null;
  band: string | null; region: string; hospital_type: string; employ_type: string;
  base_monthly: number | null; pay_basis: string | null;
  net_monthly: number | null; dependents: number | null;
  extra_pay_monthly: number | null; bonus_yearly: number | null;
  duty_count: number | null; duty_hours: number | null; duty_pay: number | null;
  weekend_count: number | null; weekend_hours: number | null; weekend_pay: number | null;
  hired_year: number; current_hired_year: number | null; birth_year: number | null;
  annual: number;
};
export type Stats = {
  n: number;
  annual: { min: number; q1: number; median: number; q3: number; max: number } | null;
  base: { q1: number; median: number; q3: number } | null;
  duty_avg: number | null;
  weekend_avg: number | null;
  emp_dist: Record<string, number> | null;
  my_below_annual: number;
  my_below_base: number;
  in_filter: boolean;
};

export function PayRank({ me, s, minN }: { me: Me; s: Stats; minN: number }) {
  /* 주 순위는 연 환산입니다 — 상여까지 넣은 실제 총액이라야 비교가 됩니다.
     연 환산이 안 나오면(표본 부족) 고정 월급으로 내려갑니다 (옛 getStats 와 같게) */
  const annRank: Rank | null = rankOf(s.n, s.my_below_annual, me.annual, s.annual?.median ?? null, minN);
  const monRank: Rank | null = rankOf(s.n, s.my_below_base, me.base_monthly, s.base?.median ?? null, minN);
  const rank = annRank ?? monRank;
  const byAnnual = annRank !== null;

  const tags = [
    me.band, me.hospital_type, me.region, me.employ_type,
    me.base_monthly ? `월 ${me.base_monthly}만원(세전)` : null, `연 ${man10(me.annual)}`,
    me.duty_count ? `당직 ${me.duty_count}회` : null,
    me.weekend_count ? `주말 ${me.weekend_count}회` : null,
  ].filter(Boolean) as string[];

  return (
    <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
      <h2 className="text-h3 font-bold">내 위치</h2>

      <div className="mt-2 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className="rounded-md bg-gray-50 px-4 py-1 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            {t}
          </span>
        ))}
      </div>

      {!rank ? (
        <p className="mt-5 text-lg text-gray-500">
          같은 조건에 {minN}명이 모이면 내 위치가 나와요. 지금은 {s.n}명이에요
        </p>
      ) : (
        <div className="mt-6">
          <span className="inline-block rounded-md bg-badge-teal-bg px-4 py-1 text-sm font-bold text-teal-strong dark:border dark:border-teal-strong/40 dark:bg-transparent">
            {tierOf(rank.top).label}
          </span>
          <p className="mt-2 text-sm text-gray-500">
            같은 조건 {rank.n}명 중 · {byAnnual ? '연 총소득' : '고정 월급'} 기준
          </p>
          <p className="mt-1 text-h1 font-bold">상위 {rank.top}%</p>
          <p className="mt-1 text-lg text-gray-500">
            {rank.n}명 중 <b className="text-gray-900 dark:text-white">{rank.rank}등</b>
          </p>
          <p className="mt-1 text-sm text-gray-400">숫자가 작을수록 많이 받는다는 뜻이에요</p>

          {/* 막대 — 오른쪽이 많이 받는 쪽입니다 */}
          <div className="relative mt-6 h-1 rounded-md bg-gray-100 dark:bg-gray-800">
            <span aria-hidden
              className="absolute -top-1 size-[12px] -translate-x-1/2 rounded-md bg-teal-strong"
              style={{ left: `${Math.max(2, Math.min(98, 100 - rank.top))}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-sm text-gray-400">
            <span>하위</span><span>중위</span><span>상위</span>
          </div>

          {byAnnual && (
            <p className="mt-5 rounded-sm bg-gray-50 p-5 text-sm text-gray-500 dark:bg-gray-950">
              연 총소득 = 고정 월급 {me.base_monthly}만원 × 12
              {me.extra_pay_monthly ? ` + 추가수당 ${me.extra_pay_monthly}만원 × 12` : ''}
              {me.bonus_yearly ? ` + 상여 ${me.bonus_yearly}만원` : ''}
              {(me.duty_pay && me.duty_count) ? ` + 당직 ${me.duty_pay}만원 × ${me.duty_count}회 × 12` : ''}
              {(me.weekend_pay && me.weekend_count) ? ` + 주말 ${me.weekend_pay}만원 × ${me.weekend_count}회 × 12` : ''}
              {' = '}<b className="text-gray-900 dark:text-white">{man10(rank.mine)}</b>
            </p>
          )}

          <p className="mt-5 text-lg">
            내 {byAnnual ? '연 총소득' : '월 실수령'}{' '}
            <b>{byAnnual ? man10(rank.mine) : `${rank.mine}만원`}</b>
            {' · '}중위값 <b>{byAnnual ? man10(rank.median) : `${rank.median}만원`}</b>
          </p>
          <p className="mt-1 text-lg text-gray-500">
            {Math.abs(rank.diff) < (byAnnual ? 5 : 0.5)
              ? `중위값과 거의 같아요. ${tierOf(rank.top).note}`
              : `중위값보다 ${byAnnual ? man10(Math.abs(rank.diff)) : `${Math.abs(rank.diff)}만원`}`
                + ` ${rank.diff > 0 ? '많아요' : '적어요'}. ${tierOf(rank.top).note}`}
          </p>

          {byAnnual && monRank && (
            <p className="mt-2 text-sm text-gray-400">
              고정 월급만 놓고 보면 상위 {monRank.top}% (중위 {monRank.median}만원)
            </p>
          )}
          {!s.in_filter && (
            <p className="mt-2 text-sm text-gray-400">지금 걸어둔 조건에는 내 자료가 안 들어가요</p>
          )}

          <PayNote className="mt-5 text-gray-500" />
        </div>
      )}
    </section>
  );
}
