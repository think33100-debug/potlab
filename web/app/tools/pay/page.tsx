'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Hit } from '@/components/hit';
import { Icon } from '@/components/icon';
import { Basis, BigNum, Card, Line, NumField, man, num, won } from '@/components/tool-parts';
import { RATE_YEAR } from '@/lib/rates';
import { grossFromNet, netFromGross } from '@/lib/tax';

/* 세전 ↔ 세후 계산기.

   **계산은 새로 안 짰습니다.** lib/tax.ts 를 그대로 씁니다 —
   가입 설문 안에서만 쓰던 것을 독립 화면으로 꺼낸 것뿐입니다.
   두 벌로 두면 다음에 요율을 고칠 때 한쪽만 고치게 됩니다.

   로그인 없이 씁니다. 넣은 값은 어디에도 안 보냅니다 —
   전부 브라우저 안에서 계산합니다.

   또래 비교는 여기 없습니다. /pay 의 「내 위치」가 이미 하고,
   그건 회원 자료를 읽어야 해서 로그인이 필요합니다. 아래 링크로 보냅니다. */

type Mode = 'gross' | 'net';

/* 주 40시간 · 월 209시간 (주휴 포함). 고용노동부 통상임금 산정 기준시간 */
const MONTH_HOURS = 209;

export default function PayTool() {
  const [mode, setMode] = useState<Mode>('gross');
  const [amount, setAmount] = useState('300');
  const [dep, setDep] = useState('1');

  const 만 = num(amount);
  const 부양 = Math.max(1, Math.round(num(dep)) || 1);

  /* 세후를 넣었으면 세전을 먼저 찾아옵니다 (이분법 — lib/tax.ts) */
  const grossMonth = 만 <= 0 ? 0
    : mode === 'gross' ? 만 * 10_000 : grossFromNet(만 * 10_000, 부양);
  const b = netFromGross(grossMonth, 부양);
  const has = 만 > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <Hit kind="other" target="tools/pay" />

      <Link href="/tools"
        className="-ml-5 flex h-[48px] w-[48px] items-center justify-center rounded-full
                   text-[#4A5056] transition-transform duration-[120ms] active:scale-[0.88]
                   motion-reduce:transition-none">
        <Icon name="chevron-left" size={24} />
        <span className="sr-only">계산기 목록으로</span>
      </Link>

      <h1 className="mt-4 break-keep text-h1 font-bold text-[#14181C]">세전 · 세후 계산기</h1>
      <p className="mt-2 break-keep text-lg text-[#5F666C]">
        넣은 값은 저장하지 않아요. 전부 이 화면 안에서 계산합니다
      </p>

      {/* ── 넣는 칸 ── */}
      <Card>
        <div role="group" aria-label="무엇을 넣을지" className="flex gap-2">
          {([['gross', '세전으로 넣기'], ['net', '세후로 넣기']] as [Mode, string][]).map(([k, t]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={
                'flex-1 rounded-[12px] border px-5 py-4 text-[15px] font-bold transition-colors '
                + (mode === k
                  ? 'border-[#14181C] bg-[#14181C] text-white'
                  : 'border-[#E3E3DE] bg-white text-[#5F666C]')
              }
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <NumField
            label={mode === 'gross' ? '세전 월급' : '세후 월급 (실수령)'}
            value={amount}
            onChange={setAmount}
            unit="만원"
            placeholder="300"
          />
          <NumField
            label="부양가족 수"
            value={dep}
            onChange={setDep}
            unit="명"
            hint="본인을 포함합니다. 모르면 1 로 두세요"
            placeholder="1"
          />
        </div>
      </Card>

      {has && (
        <>
          {/* ── 결과 ── */}
          <div className="mt-6">
            <BigNum
              label="세후 월급 (실수령)"
              value={Math.round(b.net / 10_000)}
              unit="만원"
              sub={`세전 월 ${man(b.gross)} · 세전 연봉 ${man(b.gross * 12)}`}
            />
          </div>

          <Card title="한 해로 보면">
            <Line k="세전 연봉" v={man(b.gross * 12)} />
            <Line k="세후 연 총소득" v={man(b.net * 12)} />
            <Line k="월 평균 실수령" v={man(b.net)} strong />
            <Line
              k="시급으로 치면"
              v={won(Math.round(b.gross / MONTH_HOURS))}
            />
          </Card>

          <Card title="떼는 것" note={`${RATE_YEAR}년 요율입니다`}>
            <Line k="국민연금" v={won(b.국민연금)} />
            <Line k="건강보험" v={won(b.건강보험)} />
            <Line k="장기요양" v={won(b.장기요양)} />
            <Line k="고용보험" v={won(b.고용보험)} />
            <Line k="소득세" v={won(b.소득세)} />
            <Line k="지방소득세" v={won(b.지방소득세)} />
            <Line k="공제 합계" v={won(b.공제합계)} strong />
          </Card>

          <Link
            href="/pay"
            className="mt-6 flex items-center justify-between gap-3 rounded-[12px]
                       border border-[#E3E3DE] bg-white px-6 py-5
                       transition-transform duration-[120ms] active:scale-[0.99]
                       motion-reduce:transition-none"
          >
            <span className="min-w-0">
              <span className="block break-keep text-[15px] font-bold text-[#1B2025]">
                또래 중에 내가 어디쯤인지 보기
              </span>
              <span className="mt-1 block break-keep text-[13px] text-[#5F666C]">
                같은 직군 · 연차 · 지역끼리 견줍니다. 회원만 볼 수 있어요
              </span>
            </span>
            <Icon name="chevron-left" size={16}
                  className="shrink-0 rotate-180 text-[#8A9299]" />
          </Link>
        </>
      )}

      <Basis>
        {RATE_YEAR}년 요율 기준입니다. 실제와 다를 수 있어요.
        월급명세서의 소득세는 「근로소득 간이세액표」로 떼고 연말정산으로 맞추는데,
        여기서는 한 해 결정세액을 12로 나눠 어림합니다.
        비과세(식대 등)는 회사마다 달라서 안 넣었어요.
        시급은 월 {MONTH_HOURS}시간(주 40시간 · 주휴 포함) 기준입니다.
      </Basis>
    </main>
  );
}
