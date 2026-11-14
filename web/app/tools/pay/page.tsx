'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Icon } from '@/components/icon';
import { RapoToolPage } from '@/components/rapo/rapo-tool';
import { Basis, BigNum, Card, Line, NumField, PickTwo, ResultHint, man, num, won } from '@/components/tool-parts';
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

type Mode = 'year' | 'gross' | 'net';

/* 주 40시간 · 월 209시간 (주휴 포함). 고용노동부 통상임금 산정 기준시간 */
const MONTH_HOURS = 209;

export default function PayTool() {
  return <Suspense><PayToolBody /></Suspense>;
}

/* 주소에 ?y=연봉(원) 또는 ?m=월급(원)이 있으면 미리 채웁니다 — 공고 상세 「연봉이 얼마인지 궁금하세요?」에서 옵니다 (2026-11-14) */
function PayToolBody() {
  const sp = useSearchParams();
  const 처음 = (() => {
    const y = Number(sp.get('y')), m = Number(sp.get('m'));
    if (y > 0) return { mode: 'year' as Mode, amount: String(Math.round(y / 10_000)) };
    if (m > 0) return { mode: 'gross' as Mode, amount: String(Math.round(m / 10_000)) };
    return { mode: 'year' as Mode, amount: '3600' };
  })();
  const [mode, setMode] = useState<Mode>(처음.mode);
  const [amount, setAmount] = useState(처음.amount);
  const [dep, setDep] = useState('1');

  const 만 = num(amount);
  const 부양 = Math.max(1, Math.round(num(dep)) || 1);

  /* 세후를 넣었으면 세전을 먼저 찾아옵니다 (이분법 — lib/tax.ts) */
  const grossMonth = 만 <= 0 ? 0
    : mode === 'year' ? 만 * 10_000 / 12
    : mode === 'gross' ? 만 * 10_000 : grossFromNet(만 * 10_000, 부양);
  const b = netFromGross(grossMonth, 부양);
  const has = 만 > 0;

  return (
    <RapoToolPage 지금="/tools/pay" hit="tools/pay" 제목="실수령액 계산" 설명="월급과 조건을 입력해 예상 금액을 확인하세요. 넣은 값은 저장하지 않아요.">

      {/* ── 넣는 칸 ── */}
      <Card title="급여 조건">
        <div className="flex flex-col gap-(--rapo-dimension-x4)">
          <PickTwo<Mode> label="무엇을 넣을지" value={mode} onChange={setMode} options={[['year', '세전 연봉'], ['gross', '세전 월급'], ['net', '세후 월급']]} />
          <NumField
            label={mode === 'year' ? '세전 연봉' : mode === 'gross' ? '세전 월급' : '세후 월급 (실수령)'}
            value={amount}
            onChange={setAmount}
            unit="만원"
            hint={mode === 'year' ? '연봉을 12로 나눠 월급으로 셉니다' : undefined}
            placeholder={mode === 'year' ? '3600' : '300'}
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
          <div>
            <BigNum
              label="세후 월급 (실수령)"
              value={Math.round(b.net / 10_000)}
              unit="만원"
              sub={`세전 월 ${man(b.gross)} · 세전 연봉 ${man(b.gross * 12)}`}
            />
          </div>

          <Card title="내 금액">
            <Line k="세전 연봉" v={man(b.gross * 12)} />
            <Line k="세전 월급" v={man(b.gross)} />
            <Line k="세후 월급 (실수령)" v={man(b.net)} strong />
            <Line k="세후 연 총소득" v={man(b.net * 12)} />
            <Line k="시급으로 치면" v={won(Math.round(b.gross / MONTH_HOURS))} />
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

          <Link href="/me/soon?k=paycmp"
            className="flex items-center justify-between gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x5) active:bg-(--rapo-color-bg-transparent-pressed)">
            <span className="min-w-0">
              <span className="rapo-type-t5-bold block break-keep text-(color:--rapo-brand-color-navy)">또래 중에 내가 어디쯤인지 보기</span>
              <span className="rapo-type-t3-regular mt-(--rapo-dimension-x1) block break-keep text-(color:--rapo-color-fg-neutral-muted)">같은 직군 · 연차 · 지역끼리 견줍니다. 회원만 볼 수 있어요</span>
            </span>
            <Icon name="chevron-left" size={16} className="shrink-0 rotate-180 text-(color:--rapo-color-fg-neutral-muted)" />
          </Link>
        </>
      )}
      {!has && <ResultHint>월급을 넣으면 세후 월급과 공제 내역을 바로 보여 드려요.</ResultHint>}

      <Basis>
        {RATE_YEAR}년 요율 기준입니다. 실제와 다를 수 있어요.
        월급명세서의 소득세는 「근로소득 간이세액표」로 떼고 연말정산으로 맞추는데,
        여기서는 한 해 결정세액을 12로 나눠 어림합니다.
        비과세(식대 등)는 회사마다 달라서 안 넣었어요.
        시급은 월 {MONTH_HOURS}시간(주 40시간 · 주휴 포함) 기준입니다.
      </Basis>
    </RapoToolPage>
  );
}
