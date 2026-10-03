import type { Metadata } from 'next';
import Link from 'next/link';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 봉사활동 찾기 (2026-10-02).

   치료사는 봉사 실적이 필요할 때가 있습니다 — 취업·승진 서류에 넣거나,
   학생은 학점 때문에 찾습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   VMS(한국사회복지협의회)를 **Lightsail 수집기**가 받아 Supabase 에 담고,
   이 화면은 담긴 것만 읽습니다 (`봉사목록()` · `봉사셈()`).
   화면이 VMS 를 직접 부르지 않습니다 — 인증키가 브라우저로 나가지 않고,
   분야·시군구를 잇는 일을 사람마다 되풀이하지 않습니다.

   ── 로그인 없이 봅니다 ────────────────────────────────────────
   공공데이터이고 개인정보가 한 칸도 없습니다. /orgs 와 같은 결입니다.
   옛 앱은 로그인을 요구했는데, 가릴 까닭이 없는 자료였습니다.

   ── 분야 탭 (세중님 확정 2026-10-02) ──────────────────────────
   전체(기본) / 복지·보건 / 기타.
   **분야를 모르는 것은 「전체」에만 나옵니다.** 지금은 적십자 혈액원
   한 곳(헌혈의집 안내)이고, 그 기관이 VMS 봉사활동처 표에 없습니다.
   모르는 것을 「기타」에 넣으면 기타가 무슨 뜻인지 흐려집니다.

   ── 시·군·구는 적기만 합니다 ──────────────────────────────────
   거르는 칸으로 안 씁니다. 그 값은 **기관이 있는 곳**이고 봉사하는 곳이
   아니며, 1,099건 중 1,019건(93%)만 압니다. 거르는 칸으로 쓰면 나머지
   7%가 소리 없이 사라집니다.

   ⚷ 담당자·시설장 실명은 DB 에 칸 자체가 없습니다. 여기로 올 길이 없습니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '봉사활동 찾기 · POTJOB',
  description: '지역과 분야로 봉사할 곳을 찾습니다. 신청은 VMS 에서 합니다',
};

/* 주소에 한글을 넣으면 인코딩되어 길어집니다. 짧은 이름표를 씁니다 */
const TABS = [
  { key: 'all', label: '전체', 갈래: null as string | null },
  { key: 'care', label: '복지·보건', 갈래: '복지·보건' },
  { key: 'etc', label: '기타', 갈래: '기타' },
];

/* 회원 지역을 첫 시·도로 쓰려면 두 가지가 걸립니다.

   ① 회원 지역은 「경기·인천」처럼 **묶음**입니다 (lib/signup-fields.ts REGIONS).
      VMS 는 시·도 하나하나라 1:1 이 안 됩니다. 여덟 묶음 중 **셋만** 맞습니다.
      나머지는 **전국**으로 둡니다 — 「경기·인천」인 분을 경기로 짐작해
      보내지 않습니다 (지역을 짐작해 붙이지 않는다는 규칙).

   ② 지역은 `profiles` 에 **없습니다.** 현직은 `salary_records.region`,
      학생은 `student_specs.want_region` 입니다.
      (처음에 `profiles.region` 을 읽게 썼다가 42703 「칸이 없다」로 잡았습니다) */
const 지역기본: Record<string, string> = {
  서울: '서울', 강원: '강원', 제주: '제주',
};

type SP = { tab?: string; sido?: string; p?: string };

type 줄 = {
  번호: number; 제목: string; 기관: string | null;
  시도: string | null; 시군구: string | null; 장소: string | null;
  분야: string | null; 갈래: string; 활동종류: string | null;
  기간: string | null; 상태: string | null;
  모집인원: number | null; 신청인원: number | null;
  청소년: boolean; 올린날: string | null; 주소: string | null;
};

type 셈 = {
  전체: number; '복지·보건': number; 기타: number; 모름: number;
  시도들: { 시도: string; 수: number }[];
  마지막수집: string | null;
};

export default async function Volunteer({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const page = Math.max(0, Number(sp.p ?? 0) || 0);

  const sb = await serverSupabase();

  /* 주소에 시·도가 있으면 그것, 없으면 회원 지역에서. 회원이 아니면 전국.
     「전국」을 또렷이 고른 것과 「아직 안 골랐다」를 가려야 하므로
     주소에 sido=all 이 있으면 전국으로 못 박습니다 */
  let sido: string | null = null;
  if (sp.sido === 'all') sido = null;
  else if (sp.sido) sido = sp.sido;
  else if (await serverWho(sb) === '회원') {
    /* **회원일 때만** 묻습니다. 비로그인에게는 두 표가 42501 을 내므로,
       안 가리면 모든 손님마다 실패하는 요청이 둘 생깁니다.
       현직 먼저, 없으면 학생의 희망 지역. 둘 다 없으면 전국입니다 */
    const [현직, 학생] = await Promise.all([
      sb.from('salary_records').select('region').limit(1).maybeSingle(),
      sb.from('student_specs').select('want_region').limit(1).maybeSingle(),
    ]);
    const r = (현직.data as { region?: string | null } | null)?.region
      ?? (학생.data as { want_region?: string | null } | null)?.want_region
      ?? '';
    sido = 지역기본[r] ?? null;
  }

  const [목록, 셈값] = await Promise.all([
    sb.rpc('봉사목록', { p_갈래: tab.갈래, p_시도: sido, p_상태: '모집중', p_page: page }),
    sb.rpc('봉사셈', { p_시도: sido, p_상태: '모집중' }),
  ]);

  const rows = (목록.data ?? []) as unknown as 줄[];
  const c = (셈값.data ?? null) as 셈 | null;
  const 이탭수 = c ? (tab.갈래 === null ? c.전체 : tab.갈래 === '기타' ? c.기타 : c['복지·보건']) : 0;

  const 길 = (next: Partial<SP>) => {
    const q = new URLSearchParams();
    const t = next.tab ?? sp.tab;
    const s = next.sido ?? (sp.sido ?? (sido ? sido : 'all'));
    if (t && t !== 'all') q.set('tab', t);
    if (s) q.set('sido', s);
    if (next.p && next.p !== '0') q.set('p', next.p);
    const str = q.toString();
    return '/volunteer' + (str ? '?' + str : '');
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <h1 className="text-h1 font-bold">봉사활동 찾기</h1>
      <p className="mt-2 break-keep text-lg text-gray-500">
        지역과 분야로 봉사할 곳을 찾습니다. 신청은 <b>VMS</b>에서 합니다
      </p>

      {/* 분야 탭 */}
      <nav aria-label="분야" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = t.key === tab.key;
          const n = c ? (t.갈래 === null ? c.전체 : t.갈래 === '기타' ? c.기타 : c['복지·보건']) : null;
          return (
            <Link
              key={t.key}
              href={길({ tab: t.key, p: '0' })}
              aria-current={on ? 'page' : undefined}
              className={
                'rounded-md border px-6 py-3 text-lg font-medium transition-colors '
                + (on
                  ? 'border-teal-strong bg-teal-strong text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-950')
              }
            >
              {t.label}
              {n !== null && (
                <span className={'ml-2 text-sm ' + (on ? 'text-white/70' : 'text-mute')}>{n}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 시·도 — 거르는 칸은 이것 하나입니다 */}
      <nav aria-label="지역" className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <Link
          href={길({ sido: 'all', p: '0' })}
          aria-current={sido === null ? 'page' : undefined}
          className={'text-lg ' + (sido === null
            ? 'font-bold text-ink underline underline-offset-4'
            : 'text-gray-500 hover:underline')}
        >
          전국
        </Link>
        {(c?.시도들 ?? []).map((s) => (
          <Link
            key={s.시도}
            href={길({ sido: s.시도, p: '0' })}
            aria-current={sido === s.시도 ? 'page' : undefined}
            className={'text-lg ' + (sido === s.시도
              ? 'font-bold text-ink underline underline-offset-4'
              : 'text-gray-500 hover:underline')}
          >
            {s.시도}
            <span className="ml-1 text-sm text-mute">{s.수}</span>
          </Link>
        ))}
      </nav>

      <p className="mt-5 text-lg text-gray-500">
        {sido ?? '전국'} · <b className="text-ink">{이탭수}건</b> 모집 중
        {tab.갈래 === null && c && c.모름 > 0 && (
          <span className="text-sm text-mute">
            {' '}(분야를 알 수 없는 {c.모름}건 포함 — 「전체」에만 나옵니다)
          </span>
        )}
      </p>

      {/* 어디서 온 자료인지 밝힙니다. 출처와 한계를 화면에 적는다는 규칙 */}
      <p className="mt-4 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-gray-500">
        한국사회복지협의회 <b>VMS</b> 자료입니다. 오늘부터 180일 안에 하는 봉사만 모았습니다.
        <br />
        <b>신청은 VMS 에서</b> 합니다 — 회원가입이 필요할 수 있습니다.
        {' '}열리지 않으면 기관에 전화로 물어보세요.
        <br />
        구·군은 <b>기관이 있는 곳</b>이고 봉사하는 곳이 아닙니다. 모르는 곳은 비워 뒀습니다.
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
          <span className="mt-1 block text-sm">app/volunteer/page.tsx · 봉사목록()</span>
        </p>
      )}

      {!목록.error && rows.length === 0 && (
        <p className="mt-6 break-keep rounded-sm border border-line bg-card p-7 text-lg text-gray-500">
          {sido ?? '전국'}에 지금 올라온 것이 없어요.
          {sido && <> <Link href={길({ sido: 'all', p: '0' })} className="underline underline-offset-4">전국으로 보기</Link></>}
        </p>
      )}

      <ul className="mt-5 flex flex-col gap-3">
        {rows.map((v) => {
          const 남은자리 = v.모집인원 && v.신청인원 !== null && v.신청인원 <= v.모집인원
            ? v.모집인원 - v.신청인원 : 0;
          return (
            <li key={v.번호}>
              <a
                href={v.주소 ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-sm border border-line bg-card p-6 hover:bg-paper"
              >
                <p className="break-keep text-body-lg font-bold text-ink">{v.제목}</p>
                <p className="mt-2 break-keep text-lg text-gray-500">
                  {v.기관}
                  {v.장소 && <><br />{v.장소}</>}
                </p>
                <p className="mt-2 text-sm text-mute">
                  {[v.시도, v.시군구].filter(Boolean).join(' ')}
                  {!v.시군구 && v.시도 && ' · 구·군 모름'}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {v.활동종류 && (
                    <span className="rounded-xs bg-badge-teal-bg px-3 py-1 text-gray-700 dark:text-gray-200">
                      {v.활동종류}
                    </span>
                  )}
                  {v.기간 && <span className="rounded-xs bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{v.기간}</span>}
                  {v.청소년 && <span className="rounded-xs bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-400">청소년 가능</span>}
                  {v.분야 && <span className="rounded-xs bg-gray-100 px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{v.분야}</span>}
                  {!!v.모집인원 && (
                    <span className="text-gray-500">
                      {v.신청인원 ?? 0}/{v.모집인원}명
                      {남은자리 > 0 && <> · {남은자리}자리</>}
                    </span>
                  )}
                </p>
                <p className="mt-3 text-lg font-bold text-brand-red">VMS 에서 신청하기 ›</p>
              </a>
            </li>
          );
        })}
      </ul>

      {/* 쪽 넘기기 — 한 쪽 20건입니다 (봉사목록() 과 같아야 합니다) */}
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
