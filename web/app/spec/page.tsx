'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PayNote } from '@/components/pay-note';
import { useAuth } from '../auth';
import { browserSupabase } from '@/lib/supabase-browser';
import { man10 } from '@/lib/pay';
import { NEXT_WHY, PART_LABEL, PART_ORDER, cheerOf, nextUp, tierOf, type PartKey } from '@/lib/spec';
import { RapoPageFrame, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton } from '@/components/rapo/rapo-ui';

/* 스펙쌓기. 옛 앱의 학생 결과 화면(getStudentResult)을 옮긴 것입니다.

   **배점은 화면에 한 자도 안 내보냅니다** (2026-09-23).
   우리가 직접 만든 기준이라 밖으로 나가면 안 됩니다. 그래서 여기서 뺀 것들 —
     · 항목별 「12 / 15점」 표기
     · 항목별 막대 (길이가 곧 비율이라 배점이 역산됩니다)
     · 「꽉 채우면 N점 올라가요」
     · 맨 아래 배점표
   남긴 것은 총점 하나와 학생이 넣은 값 그대로입니다.
   다음에 챙길 것은 배점을 안 보고 고릅니다 (lib/spec.ts 의 nextUp).

   점수 계산은 DB 의 spec_parts() 한 곳에만 있습니다. 여기서 다시 계산하지 않습니다.

   「합격한 사람들과 비교」는 기관유형마다 「나보다 낮은 현직이 몇 %」입니다.
   현직 스펙이 20명은 쌓여야 내보냅니다 — 적으면 숫자가 춤춥니다. */

type Me = {
  job_group: string | null; role: string | null; grade: string | null;
  school_type: string | null; gpa: number | null; gpa_scale: number | null;
  langs: { exam: string; score: number | null; level: string | null }[] | null;
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
  const { loading, session, me: profile } = useAuth();
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    browserSupabase().rpc('spec_stats').then(({ data, error }) => {
      if (error) setErr(`불러오지 못했어요 — ${error.message}`);
      else setRes(data as Res);
    });
  }, []);

  const me = res?.me ?? null;

  /* 2026-11-16 — 새 화면에서는 안 오지만 주소로 열려서 옛 위쪽 줄(POTJOB 로고) 대신 새 틀로 옮겼습니다.
     spec_stats·rookie_salary 를 읽는 길과 「배점을 안 내보낸다」 규칙은 그대로입니다 */
  const 막대 = 'h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-neutral-weak)';
  const 채움 = 'h-1 rounded-(--rapo-radius-full) bg-(--rapo-color-bg-navy-solid)';

  return (
    <RapoPageFrame title="스펙쌓기" back="/toolkit" nav="/toolkit">
      {/* 옛 이름(피오티잡)이 글에 남아 있어 RAPO 로 고쳤습니다 (2026-11-11 세중님 「서비스 이름은 RAPO」) */}
      <p className={틀.흐린글}>
        RAPO 에서 실제로 취업을 준비하는 학생들을 조사해
        자체적으로 만든 스펙 점수입니다
      </p>

      {err && <p role="alert" className={틀.오류}>{err}</p>}
      {!res && !err && <p role="status" className={틀.흐린글}>세는 중이에요…</p>}

      {res && !me && (
        <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
          <h2 className={틀.소제목}>스펙을 아직 안 적으셨어요</h2>
          {/* 글귀와 단추가 **같은 규칙**을 씁니다 (2026-09-25).
              전에는 글귀만 loading 을 보고 바로 아래 단추는 안 봤습니다 —
              글귀는 비어 있는데 단추만 「시작하기 → /login」 으로 뗴습니다 */}
          <p className={틀.흐린글}>
            {loading ? ''
              : profile ? '내 정보에서 스펙을 채우면 점수가 나와요'
              : session ? '가입을 마저 하고 스펙을 채우면 점수가 나와요'
              : '가입하면서 스펙을 채우면 점수가 나와요'}
          </p>
          {!loading && (
            <div className="pt-(--rapo-dimension-x2)">
              <RapoButton href={profile ? '/me' : session ? '/welcome' : '/login'} tone="navy" size={40}>
                {profile ? '내 정보로 가기' : session ? '가입 마저 하기' : '시작하기'}
              </RapoButton>
            </div>
          )}
        </section>
      )}

      {res && me && (
        <>
          {/* ── 내 점수 ── */}
          <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
            <p aria-hidden className="rapo-type-t11-regular">{tierOf(me.score).emoji}</p>
            <p className="rapo-type-t8-bold break-keep text-(color:--rapo-color-fg-neutral)">{tierOf(me.score).headline}</p>
            <p className={틀.흐린글}>{tierOf(me.score).comment}</p>
            <p className={틀.흐린글}>{tierOf(me.score).place}</p>

            <p className="rapo-type-t11-bold whitespace-nowrap pt-(--rapo-dimension-x4) text-(color:--rapo-brand-color-navy)">
              {me.score}
              <span className="rapo-type-t6-medium ml-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral-muted)">/ 100점</span>
            </p>
            <div className={막대}>
              <div className={채움} style={{ width: `${me.score}%` }} />
            </div>

            {res.peer?.top != null ? (
              <p className={틀.글 + ' pt-(--rapo-dimension-x3)'}>
                {me.role === '학생' ? `같은 ${me.grade ?? ''} ` : '같은 직군 현직 '}
                {res.peer.n}명 중 <b className="whitespace-nowrap">상위 {res.peer.top}%</b>
              </p>
            ) : (
              <p className={틀.흐린글 + ' pt-(--rapo-dimension-x3)'}>
                같은 조건에 {res.min_peer}명이 모이면 또래 중 내 위치가 나와요.
                지금은 {res.peer?.n ?? 0}명이에요
              </p>
            )}

            <p className={틀.회색칸 + ' ' + 틀.글 + ' mt-(--rapo-dimension-x3)'}>
              {cheerOf(me.score, me.parts)}
            </p>
          </section>

          {/* ── 내가 넣은 것 ──
              점수도 막대도 안 붙입니다. 길이 하나만 있어도 배점이 역산됩니다 */}
          <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x3)'}>
            <h2 className={틀.소제목}>내가 넣은 것</h2>
            <dl>
              {PART_ORDER.map((k) => (
                <div key={k}
                  className="flex items-baseline justify-between gap-(--rapo-dimension-x4) border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x4) last:border-0">
                  <dt className="rapo-type-t4-bold break-keep text-(color:--rapo-color-fg-neutral)">{PART_LABEL[k]}</dt>
                  <dd className="rapo-type-t4-regular shrink-0 break-keep text-right text-(color:--rapo-color-fg-neutral-muted)">
                    {rawOf(k, me)}
                  </dd>
                </div>
              ))}
            </dl>

            {/* 어학은 우리 기준이라 밝혀 둡니다. 구간 값은 안 적습니다 */}
            <p className={틀.작은글}>
              어학은 시험끼리 환산한 게 아니라 각 시험이 발표한 등급을 그대로 따랐어요.
              여러 개 넣으면 제일 높은 것 하나만 써요
            </p>
          </section>

          {/* ── 합격한 사람들과 비교 ── */}
          <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
            <h2 className={틀.소제목}>합격한 사람들과 비교</h2>
            {res.reach?.enough ? (
              <>
                <p className={틀.작은글}>
                  그 기관에서 일하는 {res.reach.base}명 중 내 점수보다 낮은 사람이 몇 %인지 보여드려요.
                  높을수록 내 스펙이 그 자리에 가까워요
                </p>
                <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x3)">
                  {res.reach.types.map((t) => (
                    <div key={t.type} className={t.type === me.want_type ? 'rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x4)' : ''}>
                      <div className="flex items-baseline justify-between gap-(--rapo-dimension-x3)">
                        <span className="rapo-type-t4-medium text-(color:--rapo-color-fg-neutral)">
                          {t.type}
                          {t.type === me.want_type && (
                            <span className="rapo-type-t3-bold ml-(--rapo-dimension-x2) text-(color:--rapo-color-fg-brand-contrast)">희망</span>
                          )}
                        </span>
                        <span className="rapo-type-t4-regular whitespace-nowrap text-(color:--rapo-color-fg-neutral)"><b>{t.rate}%</b>
                          <span className="rapo-type-t3-regular ml-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral-muted)">{t.n}명 기준</span></span>
                      </div>
                      <div className={막대 + ' mt-(--rapo-dimension-x2)'}>
                        <div className={채움} style={{ width: `${t.rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className={틀.작은글 + ' pt-(--rapo-dimension-x3)'}>
                  위 등급 문구는 점수만 보고 적은 것이고, 실제 근거는 이 비율이에요
                </p>
              </>
            ) : (
              <p className={틀.흐린글}>
                현직 선배들 스펙이 {res.reach && !res.reach.enough ? res.reach.need : res.min_pro}명은
                모여야 보여드릴 수 있어요. 지금은
                {' '}{res.reach && !res.reach.enough ? res.reach.have : 0}명이에요.
                적은 표본으로 「갈 수 있다」고 말하면 틀린 말이 돼요
              </p>
            )}
          </section>

          <NextUp parts={me.parts} />
          <Rookie job={me.job_group} />

          {/* 「계산기 보기」 카드를 **여기서 뺐습니다** (2026-10-02 세중님 결정).
              계산기는 월급확인(/pay)에서 나와야 합니다. 그리고 거기에
              app/pay/page.tsx 로 **똑같은 카드가 이미 있습니다** —
              이건 같은 것을 한 번 더 둔 것이었습니다.
              게다가 이 자리는 {res && me} 안이라 스펙을 적은 회원만 보는데,
              카드 설명은 「로그인 없이 쓸 수 있어요」였습니다. /pay 쪽은
              누구나 보므로 그쪽만 남깁니다. */}
        </>
      )}

      {/* 봉사활동 — **{res && me} 바깥**입니다 (세중님 확정 2026-10-02).

          안에 두면 스펙을 적은 회원에게만 보입니다. 그런데 봉사활동을 제일
          찾을 사람은 **아직 스펙을 안 적은 학생**입니다. 실적이 필요해서
          찾는 것이니까요. /volunteer 자체도 로그인 없이 열리게 만들었으니
          입구만 로그인 뒤에 두면 앞뒤가 안 맞습니다.

          건수는 일부러 안 적습니다 — 날마다 바뀌어서 박아두면 낡습니다. */}
      <Link
        href="/volunteer"
        className={틀.카드 + ' flex items-center justify-between gap-(--rapo-dimension-x3) active:bg-(--rapo-color-bg-layer-default-pressed)'}
      >
        <span className="flex min-w-0 flex-col gap-(--rapo-dimension-x1)">
          <span className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">봉사활동 찾기</span>
          <span className={틀.작은글}>지역으로 좁혀 볼 수 있어요. 신청은 VMS 에서 해요</span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/home/chevron.svg" alt="" width={12} height={12} className="shrink-0" />
      </Link>
    </RapoPageFrame>
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
    <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
      <h2 className={틀.소제목}>여기 가면 얼마 받나요</h2>
      <p className={틀.작은글}>
        {d.job ?? '치료사'} 중 <b>연차 2년 이하</b>가 적어준 연 총소득이에요
      </p>

      {d.types.length === 0 ? (
        <p className={틀.흐린글 + ' pt-(--rapo-dimension-x2)'}>
          신입 급여가 아직 {d.min_n}명은 모이지 않았어요. 지금은 {d.base}명이에요
        </p>
      ) : (
        <>
          <div>
            {d.types.map((t) => (
              <div key={t.type}
                className="flex items-baseline justify-between gap-(--rapo-dimension-x3) border-b-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) py-(--rapo-dimension-x4) last:border-0">
                <span className="rapo-type-t4-medium min-w-0 text-(color:--rapo-color-fg-neutral)">
                  {t.type}
                  <span className="rapo-type-t3-regular ml-(--rapo-dimension-x2) whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">{t.n}명</span>
                </span>
                <span className="shrink-0 text-right">
                  <b className="rapo-type-t6-bold whitespace-nowrap text-(color:--rapo-color-fg-neutral)">{man10(t.median_year)}</b>
                  <span className="rapo-type-t3-regular block whitespace-nowrap text-(color:--rapo-color-fg-neutral-muted)">
                    고정 월급 {t.median_base}만원
                  </span>
                </span>
              </div>
            ))}
          </div>
          <PayNote className="text-(color:--rapo-color-fg-neutral-muted)"
                   source="연차 2년 이하 회원이 직접 올린 급여" />
          <p className={틀.작은글}>
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
        ? `${trim(me.gpa)} / ${trim(me.gpa_scale)}` : '없음';
    case 'lang': {
      /* 넣은 것을 그대로 보여줍니다 — 「토익 850점 · 오픽 IH」.
         점수만 보여주면 왜 그 점수인지 모릅니다 */
      const xs = me.langs ?? [];
      if (xs.length === 0) return '없음';
      return xs.map((l) =>
        l.level ? `${l.exam} ${l.level}` : `${l.exam} ${l.score}점`).join(' · ');
    }
    case 'school':
      return me.school_type ?? '없음';
    case 'certs':
      return me.n_licenses ? `${me.n_licenses}개` : '없음';
    case 'courses':
      return me.n_trainings ? `${me.n_trainings}개` : '없음';
    case 'practice': {
      const big = (me.rows ?? []).filter((r) =>
        /대학병원|상급종합|종합병원|공공기관\(병원\)|의료원/.test(r.hospital ?? '')).length;
      if (!me.rows?.length) return '없음';
      return big ? `큰 병원 ${big}곳` : `요양·센터 ${me.rows.length}곳`;
    }
  }
}

/* 다음에 챙기면 좋을 것 한 줄.

   배점을 안 봅니다 — 「지금 시작할 수 있는 것부터」라는 손으로 정한 차례를
   씁니다 (lib/spec.ts 의 NEXT_ORDER). 그 차례는 배점 순서와 일부러 다릅니다. */
function NextUp({ parts }: { parts: Record<string, number> }) {
  const k = nextUp(parts);
  if (!k) return null;

  return (
    <section className="rounded-(--rapo-radius-r3) bg-(--rapo-brand-color-blush) p-(--rapo-dimension-x5)">
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral)">
        다음엔 <b>{PART_LABEL[k]}</b>을 챙겨보세요. {NEXT_WHY[k]}
      </p>
    </section>
  );
}
