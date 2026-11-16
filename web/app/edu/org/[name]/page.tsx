import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { RapoPageFrame, 틀 } from '@/components/rapo/rapo-frame';
import { serverSupabase } from '@/lib/supabase-server';

/* 교육기관 하나 보기 (2026-10-04).

   그 기관이 여는 교육을 **열린 것 먼저** 늘어놓습니다.
   소개 글이 비어 있으면 그 칸을 **아예 숨깁니다** — 빈 상자를 보여주면
   「아직 안 만든 화면」처럼 보입니다.

   2026-11-16 — 옛 위쪽 줄(POTJOB 로고)이 보여 새 틀로 옮겼습니다(앱 바 뒤로 = 교육기관 목록).
   읽는 길(교육기관하나 · 교육목록)과 열린 것/끝난 것 가르기는 그대로입니다. */

export const dynamic = 'force-dynamic';

type 기관 = {
  이름: string; 직군: string; 소개: string | null; 그림: string | null;
  누리집: string | null; 모음: boolean; 링크주소: string | null; 열린교육: number;
};

type 교육 = {
  번호: string; 갈래: string; 제목: string;
  시작: string | null; 끝: string | null; 장소: string | null;
  모집인원: string | null; 상태: string | null; 올린날: string | null; 링크: string;
};

export async function generateMetadata(
  { params }: { params: Promise<{ name: string }> },
): Promise<Metadata> {
  const { name } = await params;
  return { title: decodeURIComponent(name) + ' · 교육 · RAPO' };
}

const 날 = (s: string) => Number(s.slice(5, 7)) + '월 ' + Number(s.slice(8, 10)) + '일';

export default async function EduOrgOne({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const 이름 = decodeURIComponent(name);
  const sb = await serverSupabase();

  const [한곳, 목록] = await Promise.all([
    sb.rpc('교육기관하나', { p_이름: 이름 }),
    sb.rpc('교육목록', { p_직군: null, p_출처: 이름, p_지난것: true, p_page: 0 }),
  ]);

  const o = ((한곳.data ?? []) as unknown as 기관[])[0];
  if (!o) notFound();

  const 전부 = (목록.data ?? []) as unknown as 교육[];
  const 오늘 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  /* 열린 것 먼저 — 끝난 교육이 위에 있으면 쓸모가 없습니다 */
  const 열린것 = 전부.filter((e) => !e.끝 || e.끝 >= 오늘);
  const 끝난것 = 전부.filter((e) => e.끝 && e.끝 < 오늘);

  return (
    <RapoPageFrame title="교육기관" back="/edu/org" nav="/toolkit">
      <section className="flex items-start gap-(--rapo-dimension-x4)">
        {o.그림 && (
          <img src={o.그림} alt="" className="size-20 shrink-0 rounded-(--rapo-radius-r3) object-cover" />
        )}
        <div className="flex min-w-0 flex-col gap-(--rapo-dimension-x2)">
          <h2 className={틀.큰제목}>{o.이름}</h2>
          <p className={틀.흐린글}>
            {o.직군 === '공통' ? '작업치료 · 물리치료' : o.직군.replace(/사$/, '')}
            {o.모음 && <> · <span className="whitespace-nowrap">열린 교육 <b className="text-(color:--rapo-color-fg-neutral)">{o.열린교육}</b></span></>}
          </p>
        </div>
      </section>

      {/* 소개가 비면 이 칸을 통째로 숨깁니다 */}
      {o.소개 && <p className={틀.회색칸 + ' ' + 틀.글}>{o.소개}</p>}

      {o.누리집 && (
        <p>
          <a href={o.누리집} target="_blank" rel="noopener noreferrer" className={틀.링크}>
            누리집 바로가기 ›
          </a>
        </p>
      )}

      {!o.모음 && (
        <p className={틀.회색칸 + ' ' + 틀.작은글}>
          이곳은 홈페이지가 <b>자동 수집을 막아 두어</b> 교육을 모으지 않습니다.
          누리집에서 직접 보셔야 합니다.
        </p>
      )}

      {o.모음 && (
        <>
          <section className="flex flex-col gap-(--rapo-dimension-x3)">
            <h2 className={틀.소제목}>열린 교육 {열린것.length}건</h2>
            {열린것.length === 0 && <p className={틀.회색칸 + ' ' + 틀.흐린글}>지금 열려 있는 것이 없어요.</p>}
            <ul className="flex flex-col gap-(--rapo-dimension-x3)">
              {열린것.map((e) => <교육줄 key={e.번호} e={e} />)}
            </ul>
          </section>

          {끝난것.length > 0 && (
            <section className="flex flex-col gap-(--rapo-dimension-x3)">
              <h2 className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral-muted)">끝난 것 {끝난것.length}건</h2>
              <ul className="flex flex-col gap-(--rapo-dimension-x3) opacity-70">
                {끝난것.slice(0, 10).map((e) => <교육줄 key={e.번호} e={e} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </RapoPageFrame>
  );
}

function 교육줄({ e }: { e: 교육 }) {
  const 기간 = e.시작
    ? (e.끝 && e.끝 !== e.시작 ? 날(e.시작) + '~' + Number(e.끝.slice(8, 10)) + '일' : 날(e.시작))
    : (e.올린날 ? 날(e.올린날) + ' 올림' : null);
  return (
    <li>
      <a href={e.링크} target="_blank" rel="noopener noreferrer"
        className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2) active:bg-(--rapo-color-bg-layer-default-pressed)'}>
        <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
          <span className={틀.표}>{e.갈래}</span>
          {e.상태 && e.상태 !== '모름' && (
            <span className={'rapo-type-t3-bold whitespace-nowrap ' + (e.상태 === '접수마감' ? 'text-(color:--rapo-color-fg-neutral-muted)' : 'text-(color:--rapo-color-fg-brand-contrast)')}>
              {e.상태}
            </span>
          )}
        </p>
        <p className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{e.제목}</p>
        {(기간 || e.장소) && (
          <p className={틀.흐린글}>
            {기간 && <span className="whitespace-nowrap">{기간}</span>}{기간 && e.장소 ? ' · ' : ''}{e.장소}
          </p>
        )}
        {e.모집인원 && (
          <p className={틀.작은글}>
            {/^\d/.test(e.모집인원) ? '모집 ' + e.모집인원 : e.모집인원}
          </p>
        )}
      </a>
    </li>
  );
}
