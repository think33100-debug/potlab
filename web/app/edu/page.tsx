import type { Metadata } from 'next';
import Link from 'next/link';

import { ListFilters } from '@/components/list-filters';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 교육·학술 (2026-10-03).

   ── 왜 있나 ──────────────────────────────────────────────────
   스펙쌓기의 「이수 교육」 칸은 학회와 과정을 **고를 수만** 있었습니다.
   언제 어디서 열리는지가 앱 어디에도 없어서, 회원은 학회 홈페이지를
   하나씩 돌아야 했습니다. 그걸 한자리에 모읍니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `tools/collect-edu.mjs` 가 학회 게시판을 긁어 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`교육목록()` · `교육셈()`).

   ── 긁는 곳을 왜 이 넷뿐인가 (robots.txt) ─────────────────────
   `robots.txt` 로 막힌 곳은 긁지 않는다는 규칙이 있습니다.
     ○ dysphagia.co.kr · ksdr.or.kr   robots.txt 없음
     ○ kdys.or.kr                     「allow: /」
     △ cogsociety.org                 교육·공지 길이 다 막혀 있어
       **허락된 첫 화면에 실린 제목·날짜만** 담습니다
     ✗ kaot.org (작업치료사협회)       「Disallow: /」 전면 → 안 긁습니다
   이 넷은 전부 COURSES_OT(작업치료) 쪽 학회입니다.
   **물리치료 쪽 학회는 아직 하나도 안 붙였습니다** — 화면에 그렇게 적습니다.

   ── 탭을 왜 학회로 묶었나 ─────────────────────────────────────
   「이수 교육」 칸이 학회 단위로 되어 있어서입니다
   (web/lib/signup-fields.ts 의 COURSES_OT). 그래서 `출처` 는 그 목록의
   학회 이름과 **글자 그대로 같습니다.** 함부로 고치면 이어지지 않습니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   학회가 공개한 교육 안내이고 개인정보가 한 칸도 없습니다.
   /volunteer · /orgs 와 같은 결입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '교육·학술 · POTJOB',
  description: '학회 교육과정과 학술대회를 한자리에서 봅니다. 신청은 각 학회에서 합니다',
};

/* 학회 이름은 COURSES_OT · COURSES_PT 와 **글자 그대로 같아야** 합니다.
   주소에는 짧은 이름표를 씁니다 — 한글은 주소에서 아홉 배로 부풉니다.

   ★ 보바스는 고르는 목록에서 작업치료 쪽이 「보바스」, 물리치료 쪽이
     「한국보바스협회」인데 **같은 단체**입니다. 그래서 직군을 「공통」으로
     담아 양쪽 탭에 다 나옵니다. */
const TABS = [
  { key: 'all', label: '전체', 출처: null as string | null, 직군: null as string | null },
  { key: 'dys', label: '연하재활', 출처: '대한연하재활학회', 직군: '작업치료사' },
  { key: 'kdys', label: '연하장애', 출처: '대한연하장애학회', 직군: '작업치료사' },
  { key: 'cog', label: '인지재활', 출처: '대한인지재활학회', 직군: '작업치료사' },
  { key: 'drv', label: '운전재활', 출처: '한국운전재활학회', 직군: '작업치료사' },
  { key: 'bob', label: '보바스', 출처: '한국보바스협회', 직군: '공통' },
  { key: 'omt', label: '정형도수', 출처: '대한정형도수물리치료학회', 직군: '물리치료사' },
  { key: 'pnf', label: 'PNF', 출처: '대한고유수용성신경근촉진법학회', 직군: '물리치료사' },
  { key: 'ke', label: '칼텐본', 출처: '칼텐본-에비언스학회', 직군: '물리치료사' },
  { key: 'aqua', label: '수중치료', 출처: '국제수중치료협회', 직군: '물리치료사' },
];

/* 직군 줄 — 세중님 지시 (2026-10-03). 「공통」은 양쪽에 다 보입니다 */
const JOBS = [
  { key: 'all', label: '전체', 직군: null as string | null },
  { key: 'ot', label: '작업치료', 직군: '작업치료사' },
  { key: 'pt', label: '물리치료', 직군: '물리치료사' },
];

/* robots.txt 가 긁기를 막은 곳 — **모으지 않고 링크만 겁니다** (세중님 결정).
   둘 다 교육 안내가 살아 있는 곳이라, 길은 열어 두고 자료는 안 가져옵니다 */
const 링크만 = [
  { 이름: '한국작업치료사협회', 주소: 'http://www.kaot.org/board/index.jsp?code=course_notice', 직군: '작업치료사' },
  { 이름: '국제의과학아카데미 (INDT)', 주소: 'https://www.imsacademy.net/Edu_Notice', 직군: '물리치료사' },
];

type SP = { tab?: string; job?: string; p?: string; past?: string };

type 줄 = {
  번호: string; 출처: string; 직군: string; 갈래: string; 제목: string;
  시작: string | null; 끝: string | null; 장소: string | null;
  모집인원: string | null; 상태: string | null;
  올린날: string | null; 링크: string;
};

const 날 = (s: string) => {
  const [, m, d] = s.split('-');
  return Number(m) + '월 ' + Number(d) + '일';
};

/* 「2026-10-17 ~ 2026-10-18」 을 「10월 17일~18일」 로.
   날짜가 없으면 올린 날을 「올린 날」 로 밝혀 보여줍니다 —
   교육 날짜인 척 보여주면 회원이 날짜를 잘못 적습니다 */
function 날쓰기(v: 줄) {
  if (!v.시작) return v.올린날 ? { 글: 날(v.올린날), 꼬리: '올림' } : null;
  if (!v.끝 || v.끝 === v.시작) return { 글: 날(v.시작), 꼬리: '' };
  const [, m1] = v.시작.split('-');
  const [, m2, d2] = v.끝.split('-');
  return {
    글: 날(v.시작) + '~' + (m1 === m2 ? Number(d2) + '일' : 날(v.끝)),
    꼬리: '',
  };
}

const 갈래색: Record<string, string> = {
  교육: 'bg-badge-teal-bg text-gray-700 dark:text-gray-200',
  학술대회: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  공지: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default async function Edu({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const 지난것 = sp.past === '1';

  const sb = await serverSupabase();

  /* 직군 기본값 = 회원이 가입 때 고른 직군 (세중님 결정 2026-10-04).
     주소의 job 이 먼저이고, '전체' 는 또렷하게 「전부 보기」입니다 */
  /* ★ profiles 를 직접 읽으면 안 됩니다 — authenticated 에게 SELECT 권한이
     없어서 늘 빈 값이 옵니다. 정식 통로는 내프로필() 입니다 (2026-10-04) */
  let 내직군: string | null = null;
  let 내역할: string | null = null;
  if (await serverWho(sb) === '회원') {
    const { data } = await sb.rpc('내프로필');
    const 나 = ((data ?? []) as { job_group?: string | null; role?: string | null }[])[0];
    내직군 = 나?.job_group ?? null;
    내역할 = 나?.role ?? null;
  }
  const 고른직군 = sp.job === '전체' ? null : (sp.job ?? 내직군);

  /* 직군을 고르면 그 직군 학회만 탭에 둡니다. 「공통」(보바스)은 양쪽에 */
  const 보일탭 = TABS.filter((t) => !고른직군 || t.직군 === null
    || t.직군 === 고른직군 || t.직군 === '공통');
  /* 직군을 바꾸면 안 보이는 학회가 골라져 있을 수 있습니다 — 그러면 전체로 */
  const tab = 보일탭.find((t) => t.key === sp.tab) ?? 보일탭[0];

  /* 탭마다 건수를 보여줍니다. 교육셈() 이 int 하나만 주므로 탭 수만큼 부릅니다 —
     표가 작아서(백여 건) 이게 뷰를 새로 만드는 것보다 쌉니다 */
  const [목록, ...셈들] = await Promise.all([
    sb.rpc('교육목록', { p_직군: 고른직군, p_출처: tab.출처, p_지난것: 지난것, p_page: page }),
    ...보일탭.map((t) => sb.rpc('교육셈', { p_직군: 고른직군, p_출처: t.출처, p_지난것: 지난것 })),
  ]);

  const rows = (목록.data ?? []) as unknown as 줄[];
  const 셈 = Object.fromEntries(보일탭.map((t, i) => [t.key, (셈들[i]?.data as number | null) ?? 0]));

  const 링크칸 = 링크만.filter((x) => !고른직군 || x.직군 === 고른직군);

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const j = next.job ?? sp.job;
    const pa = next.past ?? sp.past;
    if (j && j !== 'all') q.set('job', j);
    if (t && t !== 'all') q.set('tab', t);
    if (pa === '1') q.set('past', '1');
    if (next.p && next.p !== '0') q.set('p', next.p);
    const s = q.toString();
    return '/edu' + (s ? '?' + s : '');
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">교육·학술</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        학회 교육과정과 학술대회입니다. <b>신청은 각 학회에서</b> 합니다
      </p>
      <p className="mt-2">
        <Link href="/edu/org"
          className="text-lg font-bold text-brand-red underline underline-offset-4">
          교육기관으로 보기 ›
        </Link>
      </p>

      {/* 직군 줄 */}
      {/* 거르기 줄 — 채용공고와 같은 부품입니다 (2026-10-04 세중님 결정).
          교육은 **지역 칸을 숨깁니다** — 자료에 시·도 칸이 없고 장소가
          자유 글이라 거르는 칸으로 못 씁니다 */}
      <div className="mt-6">
        <ListFilters
          기준={{ job: sp.job ?? 내직군 ?? undefined, past: 지난것 }}
          지역숨김
          기본직군={내직군}
          역할={내역할}
          마감말="끝난 것도"
          뿌리="/edu"
          /* 학회 고르기 — 전에는 탭 10개가 늘어서서 휴대폰에서 두 줄을
             먹었습니다. 건수는 선택지 안에 「(14)」로 넣어 안 잃습니다 */
          고름={{
            이름: 'tab',
            전체말: '학회 전체',
            고른값: tab.key === 'all' ? undefined : tab.key,
            선택지: 보일탭.filter((t) => t.key !== 'all')
              .map((t) => ({ 값: t.key, 글: t.label, 수: 셈[t.key] })),
          }}
        />
      </div>

      {/* 학회 탭 — 스펙쌓기 「이수 교육」 의 학회 이름과 같습니다 */}
      <p className="mt-5 text-lg text-mute">
        <b className="text-ink">{셈[tab.key]}건</b>
        {지난것 ? ' (끝난 것까지)' : ' · 아직 안 끝난 것'}
      </p>

      {/* 출처와 한계를 화면에 밝힙니다 */}
      <p className="mt-4 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
        학회 홈페이지에 공개된 안내를 모은 것입니다. <b>신청·문의는 학회에서</b> 하세요.
        <br />
        날짜가 없는 줄은 <b>올린 날</b>을 적었습니다 — 교육 날짜가 아닙니다.
        <br />
        <b>대한인지재활학회</b>는 홈페이지가 긁기를 막아 두어, 첫 화면에 실린
        제목과 날짜만 가져옵니다. 자세한 것은 학회 화면에서 보세요.
      </p>

      {/* robots.txt 가 막은 곳 — 자료는 안 가져오고 길만 열어 둡니다 */}
      {링크칸.length > 0 && (
        <div className="mt-3 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
          아래 두 곳은 홈페이지가 <b>자동 수집을 막아 두어</b> 공고를 모으지 않습니다.
          직접 들어가서 보세요.
          <ul className="mt-2 flex flex-col gap-1">
            {링크칸.map((x) => (
              <li key={x.주소}>
                <a href={x.주소} target="_blank" rel="noopener noreferrer"
                  className="font-bold text-brand-red underline underline-offset-4">
                  {x.이름} ›
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {목록.error && (
        <p className="mt-6 rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          불러오지 못했어요 — {목록.error.message}
          <span className="mt-1 block text-sm">app/edu/page.tsx · 교육목록()</span>
        </p>
      )}

      {!목록.error && rows.length === 0 && (
        <p className="mt-6 break-keep rounded-sm border border-line bg-card p-7 text-lg text-mute">
          {지난것 ? '모아둔 것이 없어요.' : '지금 열려 있는 것이 없어요.'}
          {!지난것 && (
            <>
              {' '}
              <Link href={길({ past: '1', p: '0' })} className="underline underline-offset-4">
                끝난 것까지 보기
              </Link>
            </>
          )}
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((v) => {
          const d = 날쓰기(v);
          return (
            <li key={v.번호}>
              <a
                href={v.링크}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-sm border border-line bg-card p-6 hover:bg-paper"
              >
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={'rounded-xs px-3 py-1 ' + (갈래색[v.갈래] ?? 갈래색.공지)}>
                    {v.갈래}
                  </span>
                  <span className="text-mute">{v.출처}</span>
                  {v.상태 && v.상태 !== '모름' && (
                    <span className={'font-bold ' + (v.상태 === '접수마감' ? 'text-mute' : 'text-brand-red')}>
                      {v.상태}
                    </span>
                  )}
                </p>

                <p className="mt-2 break-keep text-body-lg font-bold text-ink">{v.제목}</p>

                {d && (
                  <p className="mt-2 text-lg text-mute">
                    {d.글}
                    {d.꼬리 && <span className="ml-1 text-sm">{d.꼬리}</span>}
                    {v.장소 && <> · {v.장소}</>}
                  </p>
                )}
                {!d && v.장소 && <p className="mt-2 text-lg text-mute">{v.장소}</p>}

                {/* 「100명 (선착순)」 은 「모집 …」 으로, 「접수 8월 24일 ~ …」 은
                    그대로 찍습니다. 보바스는 교육 날짜 없이 **접수 기간**만
                    내놓는데 「모집 접수 …」 로 찍으면 말이 안 됩니다 */}
                {v.모집인원 && (
                  <p className="mt-1 text-sm text-mute">
                    {/^\d/.test(v.모집인원) ? '모집 ' + v.모집인원 : v.모집인원}
                  </p>
                )}

                <p className="mt-3 text-lg font-bold text-brand-red">학회 화면에서 보기 ›</p>
              </a>
            </li>
          );
        })}
      </ul>

      {/* 쪽 넘기기 — 한 쪽 20건입니다 (교육목록() 과 같아야 합니다) */}
      {(page > 0 || rows.length === 20) && (
        <nav aria-label="쪽 넘기기" className="mt-7 flex items-center justify-between">
          {page > 0 ? (
            <Link href={길({ p: String(page - 1) })}
              className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">
              ‹ 앞으로
            </Link>
          ) : <span />}
          <span className="text-sm text-mute">{page + 1}쪽</span>
          {rows.length === 20 ? (
            <Link href={길({ p: String(page + 1) })}
              className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">
              다음 ›
            </Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
