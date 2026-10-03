import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { serverSupabase } from '@/lib/supabase-server';

/* 교육기관 하나 보기 (2026-10-04).

   그 기관이 여는 교육을 **열린 것 먼저** 늘어놓습니다.
   소개 글이 비어 있으면 그 칸을 **아예 숨깁니다** — 빈 상자를 보여주면
   「아직 안 만든 화면」처럼 보입니다. */

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
  return { title: decodeURIComponent(name) + ' · 교육 · POTJOB' };
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
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <p className="text-sm text-mute">
        <Link href="/edu/org" className="underline underline-offset-4">교육기관</Link>
      </p>

      <div className="mt-3 flex items-start gap-4">
        {o.그림 && (
          <img src={o.그림} alt="" className="size-20 shrink-0 rounded-sm object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="break-keep text-h1 font-bold">{o.이름}</h1>
          <p className="mt-2 text-lg text-mute">
            {o.직군 === '공통' ? '작업치료 · 물리치료' : o.직군.replace(/사$/, '')}
            {o.모음 && <> · 열린 교육 <b className="text-ink">{o.열린교육}</b></>}
          </p>
        </div>
      </div>

      {/* 소개가 비면 이 칸을 통째로 숨깁니다 */}
      {o.소개 && (
        <p className="mt-5 break-keep rounded-sm border border-line bg-card p-6 text-lg leading-relaxed text-body">
          {o.소개}
        </p>
      )}

      {o.누리집 && (
        <p className="mt-4">
          <a href={o.누리집} target="_blank" rel="noopener noreferrer"
            className="text-lg font-bold text-brand-red underline underline-offset-4">
            누리집 바로가기 ›
          </a>
        </p>
      )}

      {!o.모음 && (
        <p className="mt-5 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
          이곳은 홈페이지가 <b>자동 수집을 막아 두어</b> 교육을 모으지 않습니다.
          누리집에서 직접 보셔야 합니다.
        </p>
      )}

      {o.모음 && (
        <>
          <h2 className="mt-8 text-h2 font-bold">열린 교육 {열린것.length}건</h2>
          {열린것.length === 0 && (
            <p className="mt-3 break-keep rounded-sm border border-line bg-card p-6 text-lg text-mute">
              지금 열려 있는 것이 없어요.
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-3">
            {열린것.map((e) => <교육줄 key={e.번호} e={e} />)}
          </ul>

          {끝난것.length > 0 && (
            <>
              <h2 className="mt-8 text-h2 font-bold text-mute">끝난 것 {끝난것.length}건</h2>
              <ul className="mt-3 flex flex-col gap-3 opacity-70">
                {끝난것.slice(0, 10).map((e) => <교육줄 key={e.번호} e={e} />)}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}

function 교육줄({ e }: { e: 교육 }) {
  const 기간 = e.시작
    ? (e.끝 && e.끝 !== e.시작 ? 날(e.시작) + '~' + Number(e.끝.slice(8, 10)) + '일' : 날(e.시작))
    : (e.올린날 ? 날(e.올린날) + ' 올림' : null);
  return (
    <li>
      <a href={e.링크} target="_blank" rel="noopener noreferrer"
        className="block rounded-sm border border-line bg-card p-6 hover:bg-paper">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-xs bg-badge-teal-bg px-3 py-1 text-gray-700">{e.갈래}</span>
          {e.상태 && e.상태 !== '모름' && (
            <span className={'font-bold ' + (e.상태 === '접수마감' ? 'text-mute' : 'text-brand-red')}>
              {e.상태}
            </span>
          )}
        </p>
        <p className="mt-2 break-keep text-body-lg font-bold text-ink">{e.제목}</p>
        {(기간 || e.장소) && (
          <p className="mt-2 text-lg text-mute">
            {기간}{기간 && e.장소 ? ' · ' : ''}{e.장소}
          </p>
        )}
        {e.모집인원 && (
          <p className="mt-1 text-sm text-mute">
            {/^\d/.test(e.모집인원) ? '모집 ' + e.모집인원 : e.모집인원}
          </p>
        )}
      </a>
    </li>
  );
}
