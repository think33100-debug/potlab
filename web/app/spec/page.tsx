'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { man10 } from '@/lib/pay';
import { PART_LABEL, PART_MAX, cheerOf, gaps, tierOf, type PartKey } from '@/lib/spec';

/* 스펙쌓기. 옛 앱의 학생 결과 화면(getStudentResult)을 옮긴 것입니다.

   배점은 옛 앱 그대로 — 학점 60 · 어학 15 · 자격증 10 · 학력 5 · 이수교육 5 · 실습 5.
   점수 계산은 DB 의 spec_parts() 한 곳에만 있습니다. 여기서 다시 계산하지 않습니다.

   「합격한 사람들과 비교」는 기관유형마다 「나보다 낮은 현직이 몇 %」입니다.
   현직 스펙이 20명은 쌓여야 내보냅니다 — 적으면 숫자가 춤춥니다. */

type Me = {
  job_group: string | null; role: string | null; grade: string | null;
  school_type: string | null; gpa: number | null; gpa_scale: number | null;
  langs: { exam: string; score: number | null; level: string | null; note: string | null }[] | null;
  lang_points: number; n_licenses: number; n_trainings: number;
  rows: { hospital?: string; region?: string; months?: string }[];
  want_type: string | null; want_region: string | null;
  score: number; parts: Record<string, number>;
};
type Reach =
  | { enough: false; have: number; need: number }
  | { enough: true; base: number; types: { type: string; n: number; rate: number }[] };
type Res = {
  min_peer: number; min_pro: number;
  me: Me | null;
  peer?: { n: number; top: number | null };
  reach?: Reach;
};

export default function SpecPage() {
  const { loading, me: profile } = useAuth();
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    browserSupabase().rpc('spec_stats').then(({ data, error }) => {
      if (error) setErr(`불러오지 못했어요 — ${error.message}`);
      else setRes(data as Res);
    });
  }, []);

  const me = res?.me ?? null;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">스펙쌓기</h1>
      <p className="mt-2 text-lg text-gray-500">
        내 스펙이 몇 점인지, 어디를 채우면 오르는지 보여드려요
      </p>

      {err && <p className="mt-6 text-lg text-brand-red">{err}</p>}
      {!res && !err && <p className="mt-7 text-lg text-gray-500">세는 중이에요…</p>}

      {res && !me && (
        <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-h3 font-bold">스펙을 아직 안 적으셨어요</h2>
          <p className="mt-2 text-lg text-gray-500">
            {loading ? '' : profile
              ? '내 정보에서 스펙을 채우면 점수가 나와요'
              : '가입하면서 스펙을 채우면 점수가 나와요'}
          </p>
          <Link href={profile ? '/me' : '/login'}
            className="mt-5 inline-block rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark">
            {profile ? '내 정보로 가기' : '시작하기'}
          </Link>
          <Score100 />
        </section>
      )}

      {res && me && (
        <>
          {/* ── 내 점수 ── */}
          <section className="mt-7 rounded-sm border border-gray-200 p-6 dark:border-gray-700">
            <p aria-hidden className="text-h1">{tierOf(me.score).emoji}</p>
            <p className="mt-2 text-h2 font-bold">{tierOf(me.score).headline}</p>
            <p className="mt-1 text-lg text-gray-500">{tierOf(me.score).comment}</p>
            <p className="mt-1 text-lg text-gray-500">{tierOf(me.score).place}</p>

            <p className="mt-6 text-h1 font-bold">
              {me.score}
              <span className="ml-1 text-h3 font-medium text-gray-400">/ 100점</span>
            </p>
            <div className="mt-2 h-1 rounded-md bg-gray-100 dark:bg-gray-800">
              <div className="h-1 rounded-md bg-teal-strong" style={{ width: `${me.score}%` }} />
            </div>

            {res.peer?.top != null ? (
              <p className="mt-5 text-lg">
                {me.role === '학생' ? `같은 ${me.grade ?? ''} ` : '같은 직군 현직 '}
                {res.peer.n}명 중 <b>상위 {res.peer.top}%</b>
              </p>
            ) : (
              <p className="mt-5 text-lg text-gray-500">
                같은 조건에 {res.min_peer}명이 모이면 또래 중 내 위치가 나와요.
                지금은 {res.peer?.n ?? 0}명이에요
              </p>
            )}

            <p className="mt-5 rounded-sm bg-gray-50 p-5 text-lg text-gray-600 dark:bg-gray-950 dark:text-gray-400">
              {cheerOf(me.score, me.parts)}
            </p>
          </section>

          {/* ── 항목별 ── */}
          <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
            <h2 className="text-h3 font-bold">항목별 점수</h2>
            <p className="mt-1 text-sm text-gray-500">
              내가 넣은 값과 그 값이 몇 점인지 보여드려요
            </p>
            <div className="mt-5">
              {(Object.keys(PART_MAX) as PartKey[]).map((k) => (
                <div key={k} className="mt-6 first:mt-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold">{PART_LABEL[k]}</span>
                    <span className="text-lg">
                      <b>{me.parts[k] ?? 0}</b>
                      <span className="text-gray-400"> / {PART_MAX[k]}점</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{rawOf(k, me)}</p>
                  {/* 어학은 기준이 POTJOB 자체 기준이라 밝혀 둡니다.
                      시험끼리 환산한 게 아니라는 것도 같이 */}
                  {k === 'lang' && (
                    <p className="mt-1 text-sm text-gray-400">
                      점수 기준은 POTJOB 자체 기준이에요.
                      시험끼리 환산한 게 아니라 각 시험이 발표한 등급을 그대로 따랐어요.
                      여러 개 넣으면 제일 높은 것 하나만 써요
                    </p>
                  )}
                  <div className="mt-2 h-1 rounded-md bg-gray-100 dark:bg-gray-800">
                    <div className="h-1 rounded-md bg-teal-strong"
                      style={{ width: `${Math.round(((me.parts[k] ?? 0) / PART_MAX[k]) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {gaps(me.parts).length > 0 && (
              <p className="mt-7 rounded-sm bg-badge-teal-bg p-6 text-lg text-teal-strong dark:border dark:border-teal-strong/40 dark:bg-transparent">
                지금 제일 많이 오를 수 있는 건 <b>{PART_LABEL[gaps(me.parts)[0].key]}</b>이에요.
                꽉 채우면 {gaps(me.parts)[0].left}점이 올라가요
              </p>
            )}
          </section>

          {/* ── 합격한 사람들과 비교 ── */}
          <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
            <h2 className="text-h3 font-bold">합격한 사람들과 비교</h2>
            {res.reach?.enough ? (
              <>
                <p className="mt-1 text-sm text-gray-500">
                  그 기관에서 일하는 {res.reach.base}명 중 내 점수보다 낮은 사람이 몇 %인지예요.
                  높을수록 내 스펙이 그 자리에 가까워요
                </p>
                <div className="mt-5">
                  {res.reach.types.map((t) => (
                    <div key={t.type} className={'mt-5 first:mt-0 '
                      + (t.type === me.want_type ? 'rounded-sm bg-badge-teal-bg p-5 dark:bg-transparent dark:border dark:border-teal-strong/40' : '')}>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-medium">
                          {t.type}
                          {t.type === me.want_type && (
                            <span className="ml-2 text-sm text-teal-strong">희망</span>
                          )}
                        </span>
                        <span className="text-lg"><b>{t.rate}%</b>
                          <span className="ml-2 text-sm text-gray-400">{t.n}명 기준</span></span>
                      </div>
                      <div className="mt-2 h-1 rounded-md bg-gray-100 dark:bg-gray-800">
                        <div className="h-1 rounded-md bg-teal-strong" style={{ width: `${t.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm text-gray-400">
                  위 등급 문구는 점수만 보고 적은 것이고, 실제 근거는 이 비율이에요
                </p>
              </>
            ) : (
              <p className="mt-2 text-lg text-gray-500">
                현직 선배들 스펙이 {res.reach && !res.reach.enough ? res.reach.need : res.min_pro}명은
                모여야 보여드릴 수 있어요. 지금은
                {' '}{res.reach && !res.reach.enough ? res.reach.have : 0}명이에요.
                적은 표본으로 「갈 수 있다」고 말하면 틀린 말이 돼요
              </p>
            )}
          </section>

          <Rookie job={me.job_group} />
          <Score100 />
        </>
      )}
    </main>
  );
}

/* 유형별 신입 급여 — 학생이 제일 궁금해하는 숫자입니다.
   옛 앱 rookieSalary 와 같게 연차 2년 이하 · 3명 미만인 유형은 안 보여줍니다 */
function Rookie({ job }: { job: string | null }) {
  const [d, setD] = useState<{
    job: string | null; min_n: number; base: number;
    types: { type: string; n: number; median_year: number; median_base: number }[];
  } | null>(null);

  useEffect(() => {
    browserSupabase().rpc('rookie_salary', { p_job: job })
      .then(({ data }) => setD(data ?? null));
  }, [job]);

  if (!d) return null;

  return (
    <section className="mt-7 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
      <h2 className="text-h3 font-bold">여기 가면 얼마 받나요</h2>
      <p className="mt-1 text-sm text-gray-500">
        {d.job ?? '치료사'} 중 <b>연차 2년 이하</b>가 적어준 연 총소득이에요
      </p>

      {d.types.length === 0 ? (
        <p className="mt-5 text-lg text-gray-500">
          신입 급여가 아직 {d.min_n}명은 모이지 않았어요. 지금은 {d.base}명이에요
        </p>
      ) : (
        <>
          <div className="mt-5">
            {d.types.map((t) => (
              <div key={t.type}
                className="flex items-baseline justify-between border-b border-gray-50 py-5 last:border-0 dark:border-gray-800">
                <span className="min-w-0 text-lg font-medium">
                  {t.type}
                  <span className="ml-2 text-sm text-gray-400">{t.n}명</span>
                </span>
                <span className="shrink-0 text-right">
                  <b className="text-h3">{man10(t.median_year)}</b>
                  <span className="block text-sm text-gray-400">
                    고정 월급 {t.median_base}만원
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-gray-400">
            가운데 값(중위값)이에요. {d.min_n}명이 안 되는 유형은 안 보여드려요
          </p>
        </>
      )}
    </section>
  );
}

/* 4.5 는 4.5 로, 3 은 3.0 으로 */
const trim = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));

/* 내가 넣은 값 그대로 (옛 raw). 환산 점수만 보여주면 왜 그 점수인지 모릅니다 */
function rawOf(k: PartKey, me: Me): string {
  switch (k) {
    case 'gpa':
      /* 3.00 이 숫자로 오면 3 이 됩니다. 학점은 소수점이 보여야 학점처럼 읽힙니다 */
      return me.gpa && me.gpa_scale
        ? `${trim(me.gpa)} / ${trim(me.gpa_scale)}` : '안 적음';
    case 'lang': {
      /* 넣은 것을 그대로 보여줍니다 — 「토익 850점 · 오픽 IH」.
         점수만 보여주면 왜 그 점수인지 모릅니다 */
      const xs = me.langs ?? [];
      if (xs.length === 0) return '안 적음';
      return xs.map((l) =>
        l.level ? `${l.exam} ${l.level}`
        : l.score != null ? `${l.exam} ${l.score}점`
        : l.note ?? l.exam).join(' · ');
    }
    case 'school':
      return me.school_type ?? '안 적음';
    case 'certs':
      return `${me.n_licenses}개`;
    case 'courses':
      return `${me.n_trainings}개`;
    case 'practice': {
      const big = (me.rows ?? []).filter((r) =>
        /대학병원|상급종합|종합병원|공공기관\(병원\)|의료원/.test(r.hospital ?? '')).length;
      if (!me.rows?.length) return '안 적음';
      return big ? `큰 병원 ${big}곳` : `요양·센터 ${me.rows.length}곳`;
    }
  }
}

function Score100() {
  return (
    <section className="mt-7 rounded-sm bg-gray-50 p-6 dark:bg-gray-950">
      <h2 className="text-lg font-bold">배점</h2>
      <p className="mt-1 text-sm text-gray-500">100점 만점이에요</p>
      <ul className="mt-5 space-y-1">
        {(Object.keys(PART_MAX) as PartKey[]).map((k) => (
          <li key={k} className="flex justify-between text-lg">
            <span className="text-gray-600 dark:text-gray-400">{PART_LABEL[k]}</span>
            <span className="font-medium">{PART_MAX[k]}점</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
