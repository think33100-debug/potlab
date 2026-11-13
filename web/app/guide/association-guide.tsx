import Link from 'next/link';
import type { ReactNode } from 'react';
import { RapoHeader } from '@/components/rapo/rapo-header';
import { RapoButton } from '@/components/rapo/rapo-ui';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 협회·학회 안내 글의 틀 (2026-11-13 세중님 「협회는 바로가기 만들어서 연관성을」 · 「학회 설명을 간략하게 적고 바로가기로」).
   작업치료 쪽(app/guide/ot-associations)과 물리치료 쪽(app/guide/pt-associations)이 같은 틀에 자료만 달리 넣습니다.

   검색으로 들어오는 분을 위한 글입니다 — 취업 사이트 비교 글(app/guide/job-sites)과 같은 규칙입니다.
   · 앱 메뉴에 걸지 않고 사이트맵에만 올립니다 (lib/seo.ts 안내글길). 주소로 오면 누구나 같은 글을 봅니다.
   · 협회·학회 이야기는 **그 협회 공식 사이트에 공개된 것만** 적습니다. 학회의 「분야」는 학회 이름과 협회의 분류를 풀어 적은 것입니다.
   · 회장 이름·연락처는 적지 않습니다. 로고·글을 가져오지 않습니다. 제휴가 아니라는 것과 고쳐 달라고 할 곳을 밝힙니다.
   · 내용을 고치면 기준일도 같이 고칩니다. 확인 기록: RAPO노트/검색노출/ */

export type 바로가기 = { 이름: string; 주소: string };
export type 학회 = { 이름: string; 분야?: string; 주소?: string };
export type 협회안내자료 = {
  큰제목: string;
  기준일: string;
  소개: string;
  협회: {
    이름: string;
    한줄: string;
    할수있는일: string[];
    알아둘것?: { 머리: string; 글: string };
    바로가기: 바로가기[];
  };
  학회머리: string;
  학회들: 학회[];
  학회출처: ReactNode;
  다른글: 바로가기[];
  제휴아님: string;
};

const 작은제목 = 'rapo-type-t7-bold break-keep text-(color:--rapo-color-fg-neutral)';
const 본문 = 'rapo-type-article-body break-keep text-(color:--rapo-color-fg-neutral)';
const 도움말 = 'rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)';
export const 밑줄 = 'underline underline-offset-2';
/* 「RAPO / Button / Outline」 40 과 같은 모양 — 바깥 사이트로 가는 링크라 RapoButton(Link) 대신 a 로 그립니다 */
const 바깥단추 = 'rapo-type-t4-bold flex h-(--rapo-dimension-x10) items-center justify-center whitespace-nowrap rounded-(--rapo-radius-r2) ' +
  'border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-muted) px-(--rapo-dimension-x4) ' +
  'text-(color:--rapo-color-fg-neutral) active:bg-(--rapo-color-bg-transparent-pressed)';

/** 주소에서 보여 줄 글 — 「http://www.kasiorg.org/」 → 「kasiorg.org」 */
const 주소글 = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export async function AssociationGuide({ 자료 }: { 자료: 협회안내자료 }) {
  const who = await serverWho(await serverSupabase());
  const { 협회 } = 자료;

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-(--rapo-color-bg-layer-default)">
      <RapoHeader who={who} />

      <main className="flex flex-col gap-(--rapo-dimension-x8) p-(--rapo-dimension-x5) pb-(--rapo-dimension-x10)">
        <section className="flex flex-col gap-(--rapo-dimension-x3)">
          <h1 className="rapo-type-screen-title break-keep text-(color:--rapo-color-fg-neutral)">{자료.큰제목}</h1>
          <p className="rapo-type-t3-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">
            하는 일 · 공식 사이트 바로가기 · {자료.기준일} 기준
          </p>
          <p className={본문}>{자료.소개}</p>
        </section>

        <section aria-labelledby="안내-협회" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="안내-협회" className={작은제목}>{협회.이름}</h2>
          <p className={본문}>{협회.한줄}</p>
          <div className="flex flex-col gap-(--rapo-dimension-x3) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) p-(--rapo-dimension-x5)">
            <h3 className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">협회 사이트에서 할 수 있는 일</h3>
            <ul className="flex flex-col gap-(--rapo-dimension-x2)">
              {협회.할수있는일.map((x) => (
                <li key={x} className="rapo-type-article-body flex gap-(--rapo-dimension-x2) text-(color:--rapo-color-fg-neutral)">
                  <span aria-hidden className="shrink-0 text-(color:--rapo-color-fg-neutral-muted)">·</span>
                  <span className="min-w-0 flex-1 break-keep">{x}</span>
                </li>
              ))}
            </ul>
          </div>
          {협회.알아둘것 && (
            <div className="flex flex-col gap-(--rapo-dimension-x1)">
              <h3 className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral)">{협회.알아둘것.머리}</h3>
              <p className={본문}>{협회.알아둘것.글}</p>
            </div>
          )}
          <ul className="flex flex-wrap gap-(--rapo-dimension-x2)">
            {협회.바로가기.map((b) => (
              <li key={b.주소}>
                <a href={b.주소} target="_blank" rel="noopener noreferrer" className={바깥단추}>{b.이름}</a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="안내-학회란" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="안내-학회란" className={작은제목}>학회는 어떤 곳인가요</h2>
          <p className={본문}>
            학회는 같은 분야를 공부하는 치료사와 연구자가 모인 단체예요. 보통 학술대회와 교육을 열고, 연구한 내용을 서로 나눠요.
          </p>
          <p className={본문}>
            관심 있는 분야의 학회를 알아 두면 그 분야의 교육 일정과 새 소식을 따라가기 좋아요.
            가입 조건과 교육 내용은 학회마다 달라서, 각 학회 사이트에서 확인해 주세요.
          </p>
        </section>

        <section aria-labelledby="안내-학회들" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="안내-학회들" className={작은제목}>{자료.학회머리}</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x2)">
            {자료.학회들.map((h) => (
              <li key={h.이름}
                className="flex flex-col gap-(--rapo-dimension-x1) rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-neutral-weak) px-(--rapo-dimension-x5) py-(--rapo-dimension-x4)">
                <h3 className="rapo-type-t5-bold break-keep text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere]">{h.이름}</h3>
                {h.분야 && <p className={도움말}>{h.분야}</p>}
                {h.주소 && (
                  <a href={h.주소} target="_blank" rel="noopener noreferrer" aria-label={`${h.이름} 공식 사이트 (새 창)`}
                    className={`rapo-type-t4-medium self-start text-(color:--rapo-color-fg-neutral) [overflow-wrap:anywhere] ${밑줄}`}>
                    {주소글(h.주소)}
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className={도움말}>{자료.학회출처}</p>
        </section>

        <section aria-labelledby="안내-라포" className="flex flex-col gap-(--rapo-dimension-x4)">
          <h2 id="안내-라포" className={작은제목}>채용 공고는 RAPO에서</h2>
          <p className={본문}>
            RAPO(라포)는 물리치료사·작업치료사 채용 공고를 모아 보여 주는 사이트예요. 공공기관·대학병원·종합병원 공고를 중심으로 모아요.
          </p>
          <RapoButton href="/jobs" full>RAPO 채용 공고 보기</RapoButton>
        </section>

        <section aria-labelledby="안내-다른글" className="flex flex-col gap-(--rapo-dimension-x3)">
          <h2 id="안내-다른글" className={작은제목}>다른 안내 글</h2>
          <ul className="flex flex-col gap-(--rapo-dimension-x2)">
            {자료.다른글.map((b) => (
              <li key={b.주소} className={본문}><Link href={b.주소} className={밑줄}>{b.이름}</Link></li>
            ))}
          </ul>
        </section>

        <div aria-hidden className="h-px bg-(--rapo-color-stroke-neutral-muted)" />

        <p className={도움말}>
          {자료.제휴아님} 내용이 실제와 다르면 <Link href="/contact" className={밑줄}>문의하기</Link>로 알려 주세요. 확인하고 바로 고칠게요.
        </p>
      </main>
    </div>
  );
}
