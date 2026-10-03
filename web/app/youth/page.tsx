import type { Metadata } from 'next';
import Link from 'next/link';

import { ListFilters } from '@/components/list-filters';
import { serverSupabase } from '@/lib/supabase-server';

/* 청년정책 찾기 (2026-10-04).

   ── 왜 있나 ──────────────────────────────────────────────────
   옛 앱에 있던 기능입니다. 취업 지원금·교육비·주거·자격증 응시료 같은
   것이라 치료사 회원에게도 그대로 쓸모가 있습니다.
   옛 앱은 시트에 2,745건을 받아둔 채 멈춰 있었습니다 — 채우는 트리거가
   없었습니다. 지금 창구에는 3,150건이 있습니다.

   ── 치료사용으로 거르지 않습니다 (세중님 결정) ────────────────
   청년 **일반** 정책입니다. 직군으로 거르면 쓸 만한 것이 다 사라집니다.
   대신 화면에 「청년 일반 정책입니다」라고 또렷이 적습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `tools/collect-youth.mjs` 가 온통청년에서 받아 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`청년목록()` · `청년셈()`).
   화면이 온통청년을 직접 부르지 않습니다 — 인증키가 브라우저로 안 나갑니다.

   ── 지역을 짐작하지 않습니다 ──────────────────────────────────
   응답의 `zipCd` 는 **중앙부처 정책이 전부 11110(서울 종로)** 으로 옵니다.
   그대로 쓰면 전국 정책이 죄다 「서울」이 됩니다. 그래서 기관 **이름**으로
   가리고, 모르면 「모름」으로 둡니다 (화면의 시·도 줄에는 안 올립니다).
   시·도를 고르면 **그 지역 + 전국**이 함께 나옵니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   정부가 공개한 정책 안내이고 개인정보가 한 칸도 없습니다.
   /volunteer · /edu · /orgs 와 같은 결입니다.

   ⚷ 담당자 실명은 DB 에 칸 자체가 없습니다. 여기로 올 길이 없습니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '청년정책 찾기 · POTJOB',
  description: '취업·교육비·주거·금융 지원 등 청년정책을 한자리에서 봅니다. 신청은 각 기관에서 합니다',
};

/* 주소에는 짧은 이름표를 씁니다 — 한글은 주소에서 아홉 배로 부풉니다 */
const TABS = [
  { key: 'all', label: '전체', 갈래: null as string | null },
  { key: 'job', label: '일자리', 갈래: '일자리' },
  { key: 'edu', label: '교육', 갈래: '교육' },
  { key: 'home', label: '주거', 갈래: '주거' },
  { key: 'wel', label: '금융·복지', 갈래: '금융복지' },
  { key: 'part', label: '참여', 갈래: '참여' },
];

type SP = { tab?: string; sido?: string; p?: string; past?: string };

type 줄 = {
  번호: string; 정책명: string; 갈래: string; 중분류: string | null;
  키워드: string | null; 설명: string | null; 지원내용: string | null;
  소관기관: string | null; 시도: string; 상시: boolean;
  신청시작: string | null; 신청끝: string | null;
  나이최소: number | null; 나이최대: number | null; 나이제한없음: boolean | null;
  신청주소: string | null; 참고주소: string | null;
};

type 셈 = {
  전체: number;
  갈래: Record<string, number>;
  시도들: { 시도: string; 수: number }[];
  마지막수집: string | null;
};

const 날 = (s: string) => {
  const [, m, d] = s.split('-');
  return Number(m) + '월 ' + Number(d) + '일';
};

/* 「상시」인지, 기간이 정해진 것인지. 기간이면 **언제까지인지**가 제일 급한 정보라
   끝 날짜를 앞에 둡니다 */
function 기간쓰기(v: 줄) {
  if (v.상시) return { 글: '상시 신청', 급한가: false };
  if (v.신청끝) return { 글: '~ ' + 날(v.신청끝) + '까지', 급한가: true };
  if (v.신청시작) return { 글: 날(v.신청시작) + ' 부터', 급한가: false };
  return null;
}

function 나이쓰기(v: 줄) {
  if (v.나이제한없음) return '나이 제한 없음';
  if (v.나이최소 && v.나이최대) return v.나이최소 + '~' + v.나이최대 + '세';
  if (v.나이최대) return '~' + v.나이최대 + '세';
  if (v.나이최소) return v.나이최소 + '세 이상';
  return null;
}

export default async function Youth({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(0, Number(sp.p ?? 0) || 0);
  const 지난것 = sp.past === '1';
  const sido = sp.sido && sp.sido !== 'all' ? sp.sido : null;

  const sb = await serverSupabase();
  const [목록, 셈값] = await Promise.all([
    sb.rpc('청년목록', { p_갈래: tab.갈래, p_시도: sido, p_지난것: 지난것, p_page: page }),
    sb.rpc('청년셈', { p_시도: sido, p_지난것: 지난것 }),
  ]);

  const rows = (목록.data ?? []) as unknown as 줄[];
  const c = (셈값.data ?? null) as 셈 | null;
  const 이탭수 = c ? (tab.갈래 === null ? c.전체 : (c.갈래?.[tab.갈래] ?? 0)) : 0;

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const s = next.sido ?? sp.sido;
    const pa = next.past ?? sp.past;
    if (t && t !== 'all') q.set('tab', t);
    if (s && s !== 'all') q.set('sido', s);
    if (pa === '1') q.set('past', '1');
    if (next.p && next.p !== '0') q.set('p', next.p);
    const str = q.toString();
    return '/youth' + (str ? '?' + str : '');
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">청년정책 찾기</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        취업·교육비·주거·금융 지원입니다. <b>신청은 각 기관에서</b> 합니다
      </p>

      {/* 갈래 탭 */}

      {/* 시·도 — 고르면 그 지역 + 전국이 함께 나옵니다 */}
      {/* 거르기 줄 — 채용공고·교육과 같은 부품입니다 (2026-10-04 세중님 결정).
          청년정책은 **직군 칸을 숨깁니다** — 치료사용으로 고르지 않는 화면이라
          직군 구분이 아예 없습니다 */}
      <div className="mt-3">
        <ListFilters
          기준={{ sido: sido ?? undefined, past: 지난것 }}
          시도들={(c?.시도들 ?? []).map((s) => s.시도)}
          직군숨김
          마감말="신청 끝난 것도"
          뿌리="/youth"
          고름={{
            이름: 'tab',
            전체말: '갈래 전체',
            고른값: tab.key === 'all' ? undefined : tab.key,
            선택지: TABS.filter((t) => t.key !== 'all').map((t) => ({
              값: t.key,
              글: t.label,
              수: c && t.갈래 ? (c.갈래?.[t.갈래] ?? 0) : undefined,
            })),
          }}
        />
      </div>

      <p className="mt-5 text-lg text-mute">
        {sido ? sido + ' + 전국' : '전국'} · <b className="text-ink">{이탭수}건</b>
        {지난것 ? ' (신청 끝난 것까지)' : ' 신청할 수 있는 것'}
        {' · '}
        <Link href={길({ past: 지난것 ? '0' : '1', p: '0' })} className="underline underline-offset-4">
          {지난것 ? '신청 가능한 것만' : '끝난 것까지 보기'}
        </Link>
      </p>

      {/* 세중님이 정하신 안내 줄 — 출처와 한계를 화면에 밝힙니다 */}
      <p className="mt-4 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
        <b>청년 일반 정책입니다. 나이·소득 조건은 각 정책에서 확인하세요.</b>
        <br />
        치료사용으로 고르지 않았습니다 — 청년이면 누구나 보는 정책을 그대로 모았습니다.
        <br />
        자료는 <b>온통청년</b>(한국고용정보원)에서 받아 옵니다.
        <b> 신청·문의는 각 기관에서</b> 하세요.
        <br />
        지역은 <b>맡은 기관 이름</b>으로 가린 것입니다. 중앙부처 정책은 <b>전국</b>으로 두고,
        알 수 없는 것은 시·도 줄에 올리지 않았습니다.
        {c?.마지막수집 && (
          <>
            <br />
            마지막으로 받아온 때 {new Date(c.마지막수집).toLocaleString('ko-KR', {
              timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </>
        )}
      </p>

      {목록.error && (
        <p className="mt-6 rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 text-lg text-brand-red-dark">
          불러오지 못했어요 — {목록.error.message}
          <span className="mt-1 block text-sm">app/youth/page.tsx · 청년목록()</span>
        </p>
      )}

      {!목록.error && rows.length === 0 && (
        <p className="mt-6 break-keep rounded-sm border border-line bg-card p-7 text-lg text-mute">
          {지난것 ? '모아둔 것이 없어요.' : '지금 신청할 수 있는 것이 없어요.'}
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
          const 기간 = 기간쓰기(v);
          const 나이 = 나이쓰기(v);
          const 갈곳 = v.신청주소 || v.참고주소;
          const 속 = (
            <>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-xs bg-badge-teal-bg px-3 py-1 text-gray-700 dark:text-gray-200">
                  {v.갈래}
                </span>
                <span className="text-mute">{v.시도 === '전국' ? '전국' : v.시도}</span>
                {기간 && (
                  <span className={기간.급한가 ? 'font-bold text-brand-red' : 'font-bold text-teal-strong dark:text-white'}>
                    {기간.글}
                  </span>
                )}
              </p>

              <p className="mt-2 break-keep text-body-lg font-bold text-ink">{v.정책명}</p>

              {v.설명 && (
                <p className="mt-2 line-clamp-2 break-keep text-lg text-mute">{v.설명}</p>
              )}

              <p className="mt-2 text-sm text-mute">
                {v.소관기관}
                {나이 && <> · {나이}</>}
                {v.중분류 && <> · {v.중분류}</>}
              </p>

              {갈곳 && <p className="mt-3 text-lg font-bold text-brand-red">신청하러 가기 ›</p>}
            </>
          );
          return (
            <li key={v.번호}>
              {갈곳 ? (
                <a href={갈곳} target="_blank" rel="noopener noreferrer"
                  className="block rounded-sm border border-line bg-card p-6 hover:bg-paper">
                  {속}
                </a>
              ) : (
                <div className="block rounded-sm border border-line bg-card p-6">{속}</div>
              )}
            </li>
          );
        })}
      </ul>

      {/* 쪽 넘기기 — 한 쪽 20건입니다 (청년목록() 과 같아야 합니다) */}
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
