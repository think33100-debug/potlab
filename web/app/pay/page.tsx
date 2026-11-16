'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { PayNote } from '@/components/pay-note';
import { PayRank, type Me, type Stats } from '@/components/pay-rank';
import { EMPLOYMENTS, HOSPITAL_TYPES, REGIONS, shortType } from '@/lib/signup-fields';
import { BANDS, grow, man10 } from '@/lib/pay';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS } from '@/lib/who';
import { RapoPageFrame, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';

/* 월급 확인. 옛 앱의 「조회」 화면(pane-view)을 옮긴 것입니다.

   지켜야 하는 것 둘 —
   ① 표본 3명 미만이면 숫자를 안 보여줍니다. 막는 자리는 화면이 아니라
      pay_stats 함수 안입니다. 회원은 salary_records 를 아예 못 읽습니다.
   ② 숫자의 근거를 같이 적습니다. 「같은 조건 N명 중」·「연 환산 = 월급×12 + 상여」.
      근거 없는 숫자는 안 냅니다 — CLAUDE.md 10번 */

type Res = { job: string | null; total: number; min_n: number; stats: Stats; me: Me | null };

export default function PayPage() {
  /* loading 을 꼭 받습니다. 안 받으면 확인 중에 회원에게도
     「가입하고 급여를 등록하면」 이 뗴다가 바뀌었습니다 (2026-09-25) */
  const { loading: 확인중, session, me: profile } = useAuth();

  const [job, setJob] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [band, setBand] = useState('');
  const [employ, setEmploy] = useState('');

  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setErr(null);
    const { data, error } = await browserSupabase().rpc('pay_stats', {
      p_job: job || null, p_region: region || null,
      p_type: type ? shortType(type) : null,
      p_band: band || null, p_employ: employ || null,
    });
    setBusy(false);
    if (error) { setErr(`불러오지 못했어요 — ${error.message}`); return; }
    setRes(data as Res);
  }, [job, region, type, band, employ]);

  useEffect(() => { load(); }, [load]);

  const s = res?.stats;
  const me = res?.me ?? null;

  return (
    /* 2026-11-16 — 새 화면에서는 안 오지만 주소로 열려서 옛 위쪽 줄(POTJOB 로고) 대신 새 틀로 옮겼습니다.
       pay_stats 를 읽는 길·3명 미만 숨김·근거 글은 그대로입니다. 내 위치 칸(components/pay-rank.tsx)은 안쪽 모양 그대로입니다 */
    <RapoPageFrame title="월급 확인" back="/toolkit" nav="/toolkit">
      <p className={틀.흐린글}>치료사들이 직접 올린 급여입니다. 같은 조건끼리만 비교해요</p>

      {/* ── 조건 ── */}
      <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x4)'}>
        <Sel label="직군" v={job} on={setJob} opts={JOB_GROUPS} all="내 직군" />
        <div className="grid grid-cols-2 gap-(--rapo-dimension-x2)">
          <Sel label="지역" v={region} on={setRegion} opts={REGIONS} all="전체" />
          <Sel label="기관 유형" v={type} on={setType} opts={HOSPITAL_TYPES} all="전체" />
          <Sel label="연차" v={band} on={setBand} opts={BANDS} all="전체" />
          <Sel label="고용형태" v={employ} on={setEmploy} opts={EMPLOYMENTS} all="전체" />
        </div>
      </section>

      {err && <p role="alert" className={틀.오류}>{err}</p>}
      {busy && !res && <p role="status" className={틀.흐린글}>세는 중이에요…</p>}

      {res && s && (
        <>
          {/* ── 내 위치 ── */}
          {me ? (
            <PayRank me={me} s={s} minN={res.min_n} />
          ) : (
            <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
              <h2 className={틀.소제목}>내 위치도 보고 싶으세요?</h2>
              <p className={틀.흐린글}>
                {확인중 ? ''
                  : profile ? '급여를 등록하면 같은 조건에서 내가 몇 등인지 나와요'
                  : session ? '가입을 마저 하고 급여를 등록하면 같은 조건에서 내가 몇 등인지 나와요'
                  : '가입하고 급여를 등록하면 같은 조건에서 내가 몇 등인지 나와요'}
              </p>
              {/* 확인 중에는 단추도 안 그립니다 — 글귀만 비우고 단추를 남기면
                  「시작하기 → /login」 이 회원에게 그대로 보입니다 */}
              {!확인중 && (
                <div className="pt-(--rapo-dimension-x2)">
                  <RapoButton href={profile ? '/me' : session ? '/welcome' : '/login'} tone="navy" size={40}>
                    {profile ? '내 정보에서 등록하기' : session ? '가입 마저 하기' : '시작하기'}
                  </RapoButton>
                </div>
              )}
            </section>
          )}

          {/* ── 통계 ── */}
          {s.n < res.min_n ? (
            <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
              <h2 className={틀.소제목}>아직 숫자를 못 보여드려요</h2>
              <p className={틀.흐린글}>
                이 조건에 {s.n}명뿐이에요. {res.min_n}명이 안 되면 누가 적었는지 짐작될 수 있어서
                숫자를 안 내보내요. 조건을 넓혀 보세요
              </p>
            </section>
          ) : (
            <>
              {/* 연 총소득이 기준입니다. 월급만 비교하면 상여 있는 곳과
                  없는 곳이 같아 보여서 뜻이 없습니다 */}
              <Card title="연 총소득"
                sub={`${res.job ?? '전체'} · ${s.n}명 기준 (이 직군 전체 ${res.total}명)`
                  + ' · 고정월급 + 추가수당 + 상여 + 당직·주말 수당'}>
                <Row k="중위값" v={man10(s.annual!.median)} big />
                <Row k="상위 25%" v={man10(s.annual!.q3)} />
                <Row k="하위 25%" v={man10(s.annual!.q1)} />
                <Row k="범위" v={`${man10(s.annual!.min)} ~ ${man10(s.annual!.max)}`} />
              </Card>

              {s.base && (
                <Card title="고정 월급" sub="세전 · 수당·상여를 뺀 기본급">
                  <Row k="중위값" v={`${s.base.median}만원`} big />
                  <Row k="상위 25%" v={`${s.base.q3}만원`} />
                  <Row k="하위 25%" v={`${s.base.q1}만원`} />
                  <Row k="월 당직" v={`${s.duty_avg}회`} />
                  <Row k="월 주말근무" v={`${s.weekend_avg}회`} />
                </Card>
              )}

              {s.emp_dist && (
                <Card title="고용형태"
                  sub="모든 고용형태가 들어간 숫자입니다. 위에서 하나만 골라 볼 수도 있어요">
                  {Object.entries(s.emp_dist)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <div key={k} className="mt-(--rapo-dimension-x2) first:mt-0">
                        <div className="rapo-type-t4-regular flex justify-between text-(color:--rapo-color-fg-neutral)">
                          <span>{k}</span>
                          <span className="whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{v}명</span>
                        </div>
                        <div className="mt-(--rapo-dimension-x1) h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-neutral-weak)">
                          <div className="h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-navy-solid)"
                            style={{ width: `${Math.round((v / s.n) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                </Card>
              )}
            </>
          )}

          {/* ── 표본이 늘수록 ── */}
          <section className={틀.회색칸 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
            <p className="rapo-type-t5-bold whitespace-nowrap text-(color:--rapo-color-fg-neutral)">지금 {s.n}명</p>
            <div className="h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-neutral-muted)">
              <div className="h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-navy-solid)" style={{ width: `${grow(s.n).pct}%` }} />
            </div>
            <p className={틀.작은글}>{grow(s.n).msg}</p>
          </section>

          <Link
            href="/tools"
            className={틀.카드 + ' flex items-center justify-between gap-(--rapo-dimension-x3) active:bg-(--rapo-color-bg-layer-default-pressed)'}
          >
            <span className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
              <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">계산기 보기</span>
              <span className={틀.작은글}>세전·세후 · 퇴직금 · 연차. 로그인 없이 쓸 수 있어요</span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
            <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0" />
          </Link>

          <div className="flex flex-col gap-(--rapo-dimension-x1)">
            <PayNote className="text-(color:--rapo-color-fg-neutral-muted)" />
            <p className={틀.작은글}>치료사들이 직접 올린 자료입니다. 병원 이름은 받지 않아요</p>
          </div>
        </>
      )}
    </RapoPageFrame>
  );
}

function Sel({
  label, v, on, opts, all,
}: { label: string; v: string; on: (v: string) => void; opts: readonly string[]; all: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
      <span className="rapo-type-t3-bold text-(color:--rapo-color-fg-neutral-muted)">{label}</span>
      <select value={v} onChange={(e) => on(e.target.value)} className={틀.입력}>
        <option value="">{all}</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x1)'}>
      <h2 className={틀.소제목}>{title}</h2>
      {sub && <p className={틀.작은글}>{sub}</p>}
      <div className="mt-(--rapo-dimension-x3)">{children}</div>
    </section>
  );
}

function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-(--rapo-dimension-x3) border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x3) last:border-0">
      <span className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">{k}</span>
      <span className={'whitespace-nowrap text-(color:--rapo-color-fg-neutral) ' + (big ? 'rapo-type-t7-bold' : 'rapo-type-t4-medium')}>{v}</span>
    </div>
  );
}
