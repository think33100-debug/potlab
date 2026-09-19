'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { PayRank, type Me, type Stats } from '@/components/pay-rank';
import { EMPLOYMENTS, HOSPITAL_TYPES, REGIONS, shortType } from '@/lib/signup-fields';
import { BANDS, grow, man10 } from '@/lib/pay';
import { browserSupabase } from '@/lib/supabase-browser';
import { JOB_GROUPS } from '@/lib/who';

/* 월급 확인. 옛 앱의 「조회」 화면(pane-view)을 옮긴 것입니다.

   지켜야 하는 것 둘 —
   ① 표본 3명 미만이면 숫자를 안 보여줍니다. 막는 자리는 화면이 아니라
      pay_stats 함수 안입니다. 회원은 salary_records 를 아예 못 읽습니다.
   ② 숫자의 근거를 같이 적습니다. 「같은 조건 N명 중」·「연 환산 = 월급×12 + 상여」.
      근거 없는 숫자는 안 냅니다 — CLAUDE.md 10번 */

type Res = { job: string | null; total: number; min_n: number; stats: Stats; me: Me | null };

export default function PayPage() {
  const { me: profile } = useAuth();

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
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">월급 확인</h1>
      <p className="mt-2 text-lg text-gray-500">
        치료사들이 직접 올린 급여예요. 같은 조건끼리만 비교해요
      </p>

      {/* ── 조건 ── */}
      <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
        <Sel label="직군" v={job} on={setJob} opts={JOB_GROUPS} all="내 직군" />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Sel label="지역" v={region} on={setRegion} opts={REGIONS} all="전체" />
          <Sel label="기관 유형" v={type} on={setType} opts={HOSPITAL_TYPES} all="전체" />
          <Sel label="연차" v={band} on={setBand} opts={BANDS} all="전체" />
          <Sel label="고용형태" v={employ} on={setEmploy} opts={EMPLOYMENTS} all="전체" />
        </div>
      </section>

      {err && <p className="mt-6 text-lg text-brand-red">{err}</p>}
      {busy && !res && <p className="mt-7 text-lg text-gray-500">세는 중이에요…</p>}

      {res && s && (
        <>
          {/* ── 내 위치 ── */}
          {me ? (
            <PayRank me={me} s={s} minN={res.min_n} />
          ) : (
            <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
              <h2 className="text-h3 font-bold">내 위치도 보고 싶으세요?</h2>
              <p className="mt-2 text-lg text-gray-500">
                {profile ? '급여를 등록하면' : '가입하고 급여를 등록하면'} 같은 조건에서 내가 몇 등인지 나와요
              </p>
              <Link href={profile ? '/me' : '/login'}
                className="mt-5 inline-block rounded-md bg-brand-red px-7 py-4 text-lg font-bold text-white hover:bg-brand-red-dark">
                {profile ? '내 정보에서 등록하기' : '시작하기'}
              </Link>
            </section>
          )}

          {/* ── 통계 ── */}
          {s.n < res.min_n ? (
            <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
              <h2 className="text-h3 font-bold">아직 숫자를 못 보여드려요</h2>
              <p className="mt-2 text-lg text-gray-500">
                이 조건에 {s.n}명뿐이에요. {res.min_n}명이 안 되면 누가 적었는지 짐작될 수 있어서
                숫자를 안 내보내요. 조건을 넓혀 보세요
              </p>
            </section>
          ) : (
            <>
              <Card title="고정 월 실수령"
                sub={`${res.job ?? '전체'} · ${s.n}명 기준 (이 직군 전체 ${res.total}명)`}>
                <Row k="중위값" v={`${s.monthly!.median}만원`} big />
                <Row k="상위 25%" v={`${s.monthly!.q3}만원`} />
                <Row k="하위 25%" v={`${s.monthly!.q1}만원`} />
                <Row k="범위" v={`${s.monthly!.min} ~ ${s.monthly!.max}만원`} />
                <Row k="월 당직" v={`${s.duty_avg}회`} />
                <Row k="월 주말근무" v={`${s.weekend_avg}회`} />
              </Card>

              {s.annual && (
                <Card title="연 환산" sub="고정급 12개월 + 연간 상여">
                  <Row k="중위값" v={man10(s.annual.median)} big />
                  <Row k="상위 25%" v={man10(s.annual.q3)} />
                  <Row k="하위 25%" v={man10(s.annual.q1)} />
                </Card>
              )}

              {s.emp_dist && (
                <Card title="고용형태"
                  sub="모든 고용형태가 들어간 숫자예요. 위에서 하나만 골라 볼 수도 있어요">
                  {Object.entries(s.emp_dist)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <div key={k} className="mt-2 first:mt-0">
                        <div className="flex justify-between text-lg">
                          <span>{k}</span>
                          <span className="text-gray-500">{v}명</span>
                        </div>
                        <div className="mt-1 h-1 rounded-md bg-gray-100 dark:bg-gray-800">
                          <div className="h-1 rounded-md bg-teal-strong"
                            style={{ width: `${Math.round((v / s.n) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                </Card>
              )}
            </>
          )}

          {/* ── 표본이 늘수록 ── */}
          <section className="mt-7 rounded-sm bg-gray-50 p-6 dark:bg-gray-950">
            <p className="text-lg font-bold">지금 {s.n}명</p>
            <div className="mt-2 h-1 rounded-md bg-gray-200 dark:bg-gray-800">
              <div className="h-1 rounded-md bg-teal-strong" style={{ width: `${grow(s.n).pct}%` }} />
            </div>
            <p className="mt-2 text-sm text-gray-500">{grow(s.n).msg}</p>
          </section>

          <p className="mt-6 text-sm text-gray-400">
            치료사들이 직접 올린 자료예요. 병원 이름은 받지 않아요
          </p>
        </>
      )}
    </main>
  );
}

function Sel({
  label, v, on, opts, all,
}: { label: string; v: string; on: (v: string) => void; opts: readonly string[]; all: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-gray-500">{label}</span>
      <select value={v} onChange={(e) => on(e.target.value)}
        className="mt-1 block w-full rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950">
        <option value="">{all}</option>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <h2 className="text-h3 font-bold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-50 py-4 last:border-0 dark:border-gray-800">
      <span className="text-lg text-gray-500">{k}</span>
      <span className={big ? 'text-h3 font-bold' : 'text-lg font-medium'}>{v}</span>
    </div>
  );
}
