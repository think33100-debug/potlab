import Link from 'next/link';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoButton } from '@/components/rapo/rapo-ui';
import {
  물리치료학교들, 작업치료목록갱신, 작업치료학교들, 학교확인일,
  type 물리치료학교, type 작업치료학교,
} from '@/lib/guide-schools';
import { serverSupabase, serverWho } from '@/lib/supabase-server';
import { GuideRow, OtherGuides, 단추폭, 도움말, 밑줄, 본문, 작은제목, 점붙임 } from './guide-parts';

/* 학교 안내 글의 틀 (2026-11-13 세중님 「전국 작업치료사 물리치료사 학교 있는 곳도 찾아서 정리 ·
   우송대학교 작업치료학과 이렇게 검색할 때 우리도 나올 수 있게」).

   목록 쪽(SchoolList)과 학교 한 곳 쪽(SchoolDetail) 둘입니다. 작업치료·물리치료가 같은 틀에 자료만 달리 넣습니다.
   다른 안내 글과 같은 규칙입니다 —
   · 앱 메뉴에 걸지 않고 사이트맵에 올립니다. 주소로 오면 누구나 같은 글을 봅니다.
   · **협회 공식 사이트의 목록에 있는 것만** 적습니다 (lib/guide-schools.ts). 지역·정원·입학 성적처럼 목록에 없는 것은 적지 않습니다.
   · 학과 누리집은 그날 열어 본 주소만 겁니다. 전화번호는 옮기지 않습니다.
   · 「되려면」 칸의 말(졸업 → 국가시험 → 면허)은 모든 학교에 같은 일반 설명입니다 — 특정 학교의 사실로 적지 않습니다. */

export type 직군 = 'ot' | 'pt';
type 학교 = 작업치료학교 | 물리치료학교;

const 말 = {
  ot: { 치료: '작업치료', 사: '작업치료사', 학과기본: '작업치료(학)과', 길: '/guide/ot-schools', 협회글: '/guide/ot-associations',
    협회: '대한작업치료사협회', 출처이름: '개설학교 현황', 출처주소: 'https://www.kaot.org/pds/school.jsp?type=01' },
  pt: { 치료: '물리치료', 사: '물리치료사', 학과기본: '물리치료(학)과', 길: '/guide/pt-schools', 협회글: '/guide/pt-associations',
    협회: '대한물리치료사협회', 출처이름: '대학안내', 출처주소: 'https://www.kpta.co.kr/center/kpta/school' },
} as const;

const 목록 = (직: 직군): readonly 학교[] => (직 === 'ot' ? 작업치료학교들 : 물리치료학교들);
export const 학교찾기 = (직: 직군, slug: string) => 목록(직).find((x) => x.슬러그 === slug) ?? null;
/** 「우송대학교 작업치료학과」 — 학과 이름을 못 읽은 곳은 「작업치료(학)과」 */
export const 학과이름 = (직: 직군, s: 학교) => `${s.학교} ${s.학과 ?? 말[직].학과기본}`;
const 작업인가 = (s: 학교): s is 작업치료학교 => '학제' in s;

/** 목록 쪽을 가르는 묶음 — 작업치료는 학제, 물리치료는 협회의 구분 그대로 */
export function 학교묶음(직: 직군): [string, readonly 학교[]][] {
  return 직 === 'ot'
    ? [['4년제 대학', 작업치료학교들.filter((x) => x.학제 === '4년제')], ['3년제 대학', 작업치료학교들.filter((x) => x.학제 === '3년제')]]
    : [['대학교', 물리치료학교들.filter((x) => x.구분 === '대학교')], ['전문대', 물리치료학교들.filter((x) => x.구분 === '전문대')]];
}

/** 작업치료 학교의 덧붙임 한 줄 — 「2001년 개설 · WFOT 인증」 */
const 덧글 = (s: 학교) => (작업인가(s)
  ? [s.개설연도 ? `${s.개설연도}년 개설` : null, s.WFOT ? 'WFOT 인증' : null, s.교육인증 ? '교육 인증' : null].filter(Boolean).join(' · ')
  : '');

export function 목록제목(직: 직군) {
  const n = 목록(직).length;
  return 직 === 'ot'
    ? { 제목: `전국 작업치료학과 대학 ${n}곳 | 4년제·3년제 · WFOT 인증 여부`, 큰제목: `전국 작업치료(학)과 대학 ${n}곳`,
        설명: `작업치료(학)과가 있는 전국 대학 ${n}곳을 4년제와 3년제로 나눠 정리했어요. 세계작업치료사연맹(WFOT) 인증 여부와 개설연도, 학과 누리집을 함께 볼 수 있어요. 대한작업치료사협회 개설학교 현황 기준이에요.` }
    : { 제목: `전국 물리치료학과 대학 ${n}곳 | 대학교·전문대 목록`, 큰제목: `전국 물리치료(학)과 대학 ${n}곳`,
        설명: `물리치료(학)과가 있는 전국 대학 ${n}곳을 대학교와 전문대로 나눠 정리했어요. 대한물리치료사협회 대학안내 기준이에요.` };
}

export function 학교제목(직: 직군, s: 학교) {
  const 이름 = 학과이름(직, s);
  if (작업인가(s)) {
    const 붙임 = [s.학제, s.개설연도 ? `${s.개설연도}년 개설` : null, s.WFOT ? '세계작업치료사연맹(WFOT) 인증' : null, s.교육인증 ? '한국작업치료교육 인증' : null].filter(Boolean).join(', ');
    return { 제목: `${이름} | ${s.학제} · 인증 · 학과 누리집 안내`, 설명: `${이름} 안내예요. ${붙임}. 대한작업치료사협회 개설학교 현황 기준이에요.` };
  }
  return { 제목: `${이름} | ${s.구분} · 학교 누리집 안내`, 설명: `${이름} 안내예요. ${s.구분} 과정이고, 대한물리치료사협회 대학안내 기준이에요.` };
}

function SourceNote({ 직 }: { 직: 직군 }) {
  const m = 말[직];
  return (
    <>
      목록은 {m.협회} 사이트의{' '}
      <a href={m.출처주소} target="_blank" rel="noopener noreferrer" className={밑줄}>{m.출처이름}</a>
      에 실린 것이에요({학교확인일} 확인{직 === 'ot' ? ` · 협회 목록 ${작업치료목록갱신} 판` : ''}).
    </>
  );
}

export async function SchoolList({ 직 }: { 직: 직군 }) {
  const who = await serverWho(await serverSupabase());
  const m = 말[직];
  const 묶음 = 학교묶음(직);
  const { 큰제목 } = 목록제목(직);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">{큰제목}</h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {점붙임(`${묶음.map(([이름, xs]) => `${이름} ${xs.length}곳`).join(' · ')} · ${학교확인일} 확인`)}
          </p>
          <p className={본문}>
            {m.치료}(학)과를 졸업하고 국가시험에 합격하면 {m.사} 면허를 받아요.
            전국에서 {m.치료}(학)과를 운영하는 대학을 {m.협회}의 목록을 바탕으로 정리했어요.
          </p>
        </section>

        {묶음.map(([이름, xs]) => (
          <section key={이름} aria-labelledby={`학교-${이름}`} className="flex flex-col gap-(--rapo-dimension-x4)">
            <h2 id={`학교-${이름}`} className={작은제목}>{이름} {xs.length}곳</h2>
            <ul className="grid gap-(--rapo-dimension-x2) md:grid-cols-2">
              {xs.map((s) => (
                <li key={s.슬러그}
                  className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)">
                  <Link href={`${m.길}/${s.슬러그}`}
                    className={`rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere] ${밑줄}`}>
                    {학과이름(직, s)}
                  </Link>
                  {덧글(s) && <p className={도움말}>{점붙임(덧글(s))}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="flex flex-col gap-(--rapo-dimension-x2)">
          <p className={도움말}>
            <SourceNote 직={직} />
            {직 === 'ot'
              ? ' 「WFOT 인증」·「교육 인증」은 협회 목록에 「세계작업치료사연맹(WFOT) 인증」·「한국작업치료교육 인증」으로 표시된 학과예요.'
              : ' 협회 목록에 폐교·폐과로 적힌 곳은 뺐어요.'}
          </p>
          <p className={도움말}>
            입학 정보는 대입정보포털{' '}
            <a href="https://www.adiga.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>어디가</a>에서 확인할 수 있어요.
          </p>
        </section>

        <section aria-labelledby="학교-라포" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="학교-라포" className={작은제목}>졸업 뒤 일자리는 RAPO에서</h2>
          <p className={본문}>
            RAPO(라포)는 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트예요. 공공기관·대학병원·종합병원 공고를 중심으로 모아요.
          </p>
          <RapoButton href="/jobs" full className={단추폭}>RAPO 채용 공고 보기</RapoButton>
        </section>

        <OtherGuides 지금={m.길} />

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          RAPO는 {m.협회}·각 대학과 제휴 관계가 아니에요. 내용이 실제와 다르면{' '}
          <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
        </p>
      </main>
    </div>
  );
}

export async function SchoolDetail({ 직, s }: { 직: 직군; s: 학교 }) {
  const who = await serverWho(await serverSupabase());
  const m = 말[직];
  const 이름 = 학과이름(직, s);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">{이름}</h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            {점붙임(`${학교확인일} 확인 · 협회 목록 기준`)}
          </p>
        </section>

        <section aria-labelledby="학교-정보" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="학교-정보" className={작은제목}>학과 정보</h2>
          <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
            {작업인가(s) ? (
              <>
                <GuideRow label="학제">{s.학제}</GuideRow>
                {s.개설연도 && <GuideRow label="개설">{s.개설연도}년</GuideRow>}
                <GuideRow label="WFOT">{s.WFOT ? '인증' : '표시 없음'}</GuideRow>
                <GuideRow label="교육 인증">{s.교육인증 ? '인증' : '표시 없음'}</GuideRow>
              </>
            ) : (
              <>
                <GuideRow label="구분">{s.구분}</GuideRow>
                <GuideRow label="학과">{s.학과}</GuideRow>
              </>
            )}
            <GuideRow label="누리집">
              {s.누리집
                ? <a href={s.누리집} target="_blank" rel="noopener noreferrer" className={`[overflow-wrap:anywhere] ${밑줄}`}>{작업인가(s) ? '학과 누리집 열기' : '학교 누리집 열기'}</a>
                : '확인한 날 열리지 않아 링크를 걸지 않았어요'}
            </GuideRow>
          </div>
          <p className={도움말}>
            <SourceNote 직={직} />
            {작업인가(s) && ' 「WFOT」·「교육 인증」은 협회 목록에 「세계작업치료사연맹(WFOT) 인증」·「한국작업치료교육 인증」으로 표시됐는지예요.'}
          </p>
        </section>

        <section aria-labelledby="학교-되려면" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="학교-되려면" className={작은제목}>{m.사}가 되려면</h2>
          <p className={본문}>
            {m.치료}(학)과를 졸업하고 국가시험에 합격하면 {m.사} 면허를 받아요. 국가시험은{' '}
            <a href="https://www.kuksiwon.or.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>한국보건의료인국가시험원</a>이 맡아요.
          </p>
          <p className={본문}>
            입학 정보는 대입정보포털{' '}
            <a href="https://www.adiga.kr/" target="_blank" rel="noopener noreferrer" className={밑줄}>어디가</a>에서 확인할 수 있어요.
            면허를 받은 뒤 챙길 일은 <Link href={m.협회글} className={밑줄}>{m.사}협회와 학회 안내</Link>에 정리했어요.
          </p>
        </section>

        <section aria-labelledby="학교-라포" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="학교-라포" className={작은제목}>졸업 뒤 일자리는 RAPO에서</h2>
          <p className={본문}>
            RAPO(라포)는 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트예요.
            공공병원이 공시한 보수는 <Link href="/guide/therapist-salary" className={밑줄}>연봉 안내</Link>에서 볼 수 있어요.
          </p>
          <RapoButton href="/jobs" full className={단추폭}>RAPO 채용 공고 보기</RapoButton>
        </section>

        <section aria-labelledby="학교-다른곳" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="학교-다른곳" className={작은제목}>다른 학교</h2>
          <p className={본문}>
            <Link href={m.길} className={밑줄}>전국 {m.학과기본} 대학 {목록(직).length}곳 보기</Link>
          </p>
        </section>

        <OtherGuides 지금={`${m.길}/${s.슬러그}`} />

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          RAPO는 이 대학·학과와 제휴 관계가 아니에요. 내용이 실제와 다르면{' '}
          <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
        </p>
      </main>
    </div>
  );
}
