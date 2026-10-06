import type { Metadata } from 'next';
import Link from 'next/link';

import { ListFilters } from '@/components/list-filters';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 경쟁률 찾아보기 (2026-10-05 · 꼴은 2026-10-07 에 다시 짰습니다).

   ── 왜 있나 ──────────────────────────────────────────────────
   공공기관이 알리오에 **지난 채용의 선발·응시 인원을 공개**합니다.
   「○○병원 작업치료사 경쟁률」로 찾는 사람이 적지 않은데 그 자리에
   우리 화면이 없었습니다. 설계는 `경쟁률_찾아보기_설계.md` 에 있습니다.

   ── 자료가 어디서 오나 ────────────────────────────────────────
   `~/경쟁률크론.sh` 가 주 1회(수요일 03:15) 네 도구를 돌려 담고,
   이 화면은 담긴 것만 읽습니다. 긁거나 지어내지 않습니다.

   ── 왜 222묶음뿐인가 ─────────────────────────────────────────
   회원에게는 **확실한 것만** 보냅니다. 우리 직군 묶음 269개 중
     − 짝 확인 필요 39   같은 자리인지 사람이 봐야 하는 것
     − 고용형태 모름 2   짐작해 붙이지 않은 것
     − 경쟁률 낼 값 없음  뽑은 사람이 0명인 것
   을 빼고 **222묶음**입니다. 거르는 자리는 DB 함수 안입니다.

   ── 가운데 길 (2026-10-05 세중님 결정) ────────────────────────
   목록은 **누구나** 봅니다. 묶음 222개는 개인정보가 없는 공개 자료입니다.
   **경쟁률 숫자는 로그인한 회원만** 봅니다.
   ★ 화면에서 가리지 않습니다 — 목록 함수(`경쟁률찾기목록`)가 평균·
     가장높음·가장낮음을 **아예 안 내보냅니다.** 화면에서 가리면
     개발자 도구 네트워크 응답에 값이 그대로 보입니다.
   숫자는 `경쟁률한묶음()` 이 첫 줄에서 `auth.uid()` 를 보고 줍니다.

   ── 꼴은 공고 목록과 같은 결입니다 (2026-10-07 세중님 지시) ────
   teamsparta.md 토큰만 씁니다. 화면마다 색을 새로 박지 않습니다.
     · 목록    테두리 없는 줄 + divide-y · 기관 작게 → 제목 크게 → 꼬리표
     · 꼬리표  badge-blue-bg + interaction-blue  (공고 목록 분류 꼬리표와 같은 것)
     · CTA     brand-red · rounded-md · active:scale-[0.98]
     · 숫자    tabular-nums (스파르타 Typography 절)

   ── 로그인 없이 봅니다 (목록만) ───────────────────────────────
   /edu · /volunteer · /orgs 와 같은 결입니다. */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '경쟁률 찾아보기 · POTJOB',
  description: '공공기관이 공개한 지난 채용의 경쟁률을 자리별로 모았습니다. 알리오 공개 자료 기준',
};

type SP = { job?: string; sido?: string; org?: string; q?: string; p?: string; g?: string };

type 묶음 = {
  묶음키: string; 기관: string; 직군: string; 지역: string;
  고용형태: string | null; 자리: string | null;
  회차: number; 첫해: number; 끝해: number; 기본값단계: boolean;
};

type 목록 = {
  전체: number; 쪽: number; 쪽당: number;
  직군들: string[]; 지역들: string[]; 기관들: string[]; 묶음: 묶음[];
};

type 단계 = { 이름: string | null; 선발: number | null; 응시: number | null; 확정일: string | null };
type 회차 = {
  sn: number; 마감: string | null; 해: number | null; 공고제목: string | null;
  자리이름: string | null; 경쟁률: string | null; 경쟁률상태: string | null;
  첫응시: number | null; 끝선발: number | null; 단계들: 단계[] | null;
};
type 한묶음 = {
  머리: 묶음 & {
    값있음: number; 평균: string | null;
    가장낮음: string | null; 가장높음: string | null; 계산불가: number;
  };
  회차들: 회차[];
};

/* 문장 꼴은 **이것 하나로 고정**입니다 (경쟁률_화면_설계.md 2절).
   한 번뿐이면 「평균」을 안 씁니다 — 한 번으로 낸 값과 마흔 번으로 낸
   평균이 같은 얼굴로 보이면 안 됩니다 */
function 요약문(h: 한묶음['머리']) {
  const 년 = Math.max(1, 2026 - h.첫해);
  if (!h.평균) return '경쟁률을 낼 값이 없어요';
  return h.회차 === 1
    ? `최근 ${년}년 이내 1번 채용 · 경쟁률 ${h.평균} 대 1`
    : `최근 ${년}년 이내 ${h.회차}번 채용 · 평균 경쟁률 ${h.평균} 대 1`;
}

/* 한 회차의 경쟁률 칸 (2026-10-07 세중님 결정).

   전에는 셋을 뭉뚱그려 「경쟁률 낼 값 없음」이라고만 적었습니다.
   뜻이 다 다릅니다 —

     ① 지원자 0명              32회차 → 「0 : 1」
     ② 지원자는 있는데 선발 0명  32회차 → 「지원 ○명 · 선발 0명」
          ★ 「0 대 1」로 적지 않습니다. 뜻이 **반대**가 됩니다 —
            아무도 안 왔다가 아니라 왔는데 안 뽑은 것입니다
     ③ 기관이 숫자를 안 적음     7회차 → 「기관이 숫자를 안 적었어요」
          ★ 0 이 아니라 **모르는 것**입니다. 숫자를 지어내지 않습니다

   셋 다 평균·가장 낮음·가장 높음 계산에는 안 들어갑니다 —
   alio_group_sum.평균 은 값있음 줄로만 냅니다 (자료로 확인했습니다). */
function 률칸(r: 회차) {
  if (r.경쟁률상태 === '있음' && r.경쟁률) {
    return { 큰글: `${r.경쟁률} : 1`, 작은글: null as string | null, 흐림: false };
  }
  if (r.첫응시 == null || r.끝선발 == null) {
    return { 큰글: null, 작은글: '기관이 숫자를 안 적었어요', 흐림: true };
  }
  if (r.끝선발 === 0 && r.첫응시 > 0) {
    return { 큰글: null, 작은글: `지원 ${r.첫응시}명 · 선발 0명`, 흐림: false };
  }
  if (r.첫응시 === 0) {
    return { 큰글: '0 : 1', 작은글: '지원한 사람이 없었어요', 흐림: false };
  }
  return { 큰글: null, 작은글: '경쟁률을 낼 값이 없어요', 흐림: true };
}

/* 출처와 한계 — 화면 아래 **늘** 붙습니다 (경쟁률_화면_설계.md 4절) */
function 밝힘({ 기본값단계 }: { 기본값단계?: boolean }) {
  const 굵게 = 'font-medium text-gray-700 dark:text-gray-300';
  return (
    <p className="mt-8 break-keep border-t border-gray-100 pt-5 text-sm leading-relaxed text-mute dark:border-gray-800">
      알리오(공공기관 경영정보 공개시스템)에 기관이 올린 자료 기준이에요.
      <b className={굵게}> 공공기관만 해당돼요</b> — 민간 병원은 이 자료에 없어요.
      경쟁률은 <b className={굵게}>첫 단계 응시자 ÷ 최종 선발 인원</b>이에요.
      뽑은 사람이 0명이면 비율 대신 <b className={굵게}>지원·선발 인원</b>을 그대로 적고,
      기관이 인원을 안 적은 회차는 <b className={굵게}>「안 적었어요」</b>로 둬요 — 0으로 적지 않아요.
      {기본값단계 && (
        <> 단계가 서류인지 면접인지 공고 설명에 없으면 <b className={굵게}>일반적인 전형 순서 기준</b>으로 적어요.</>
      )}
    </p>
  );
}

/* 공고 목록의 분류 꼬리표와 **같은 것**을 씁니다 (web/app/jobs/page.tsx:328) */
const 꼬리표 = 'rounded-md bg-badge-blue-bg px-3 font-medium text-interaction-blue';

export default async function Compete({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const 쪽 = Math.max(1, Number(sp.p ?? 1) || 1);
  /* ★ sp.g 는 Next 가 이미 한 번 풀어 줍니다. 여기서 또 풀거나
     href 에서 미리 encodeURIComponent 하면 **두 번 인코딩**되어
     주소가 쓸데없이 길어집니다 (한글은 주소에서 아홉 배로 부풉니다) */
  const 고른묶음 = sp.g || null;

  const sb = await serverSupabase();
  const 누구 = await serverWho(sb);
  const 회원인가 = 누구 === '회원';

  const { data, error } = await sb.rpc('경쟁률찾기목록', {
    p_직군: sp.job && sp.job !== '전체' ? sp.job : null,
    p_지역: sp.sido || null,
    p_기관: sp.org || null,
    p_찾기: sp.q || null,
    p_쪽: 쪽,
  });

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-7 md:px-7">
        <h1 className="text-h1 font-bold">경쟁률 찾아보기</h1>
        <p className="mt-4 text-lg text-brand-red-dark">
          목록을 못 읽었어요 — {error.message}
        </p>
      </main>
    );
  }

  const d = data as 목록;
  const 끝쪽 = Math.max(1, Math.ceil(d.전체 / d.쪽당));

  /* ── 한 묶음 보기 ─────────────────────────────────────────── */
  let 한것: 한묶음 | null = null;
  let 숫자탈: string | null = null;
  if (고른묶음) {
    const r = await sb.rpc('경쟁률한묶음', { p_묶음키: 고른묶음 });
    if (r.error) 숫자탈 = r.error.message;
    else 한것 = r.data as 한묶음;
  }
  const 로그인하라 = !!숫자탈 && 숫자탈.includes('로그인');

  const 주소 = (바꿀: Partial<SP>) => {
    const q = new URLSearchParams();
    const 다음 = { ...sp, ...바꿀 };
    for (const k of ['job', 'sido', 'org', 'q', 'p', 'g'] as const) {
      const v = 다음[k];
      if (v) q.set(k, String(v));
    }
    const s = q.toString();
    return s ? '/compete?' + s : '/compete';
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-7 pb-[88px] md:px-7 md:pb-7">
      <header>
        <h1 className="break-keep text-h1 font-bold">경쟁률 찾아보기</h1>
        <p className="mt-2 break-keep text-lg text-mute">
          공공기관이 공개한 지난 채용의 경쟁률이에요. 자리{' '}
          <b className="num font-bold tabular-nums text-ink">{d.전체}곳</b>
          {!회원인가 && (
            <> · 숫자는 <b className="font-bold text-ink">로그인하면</b> 보여요</>
          )}
        </p>
      </header>

      {/* ── 고른 묶음 ───────────────────────────────────────── */}
      {고른묶음 && (
        <section className="mt-7">
          <Link href={주소({ g: undefined })}
            className="text-sm font-medium text-interaction-blue hover:underline">
            ← 목록으로
          </Link>

          {숫자탈 ? (
            /* 로그인 유도 — 카드 하나로 또렷하게 */
            <div className="mt-4 rounded-sm border border-gray-200 bg-gray-50 p-7 dark:border-gray-700 dark:bg-gray-950">
              <p className="break-keep text-h3 font-bold text-ink">
                {로그인하라 ? '로그인하면 경쟁률을 볼 수 있어요' : '못 읽었어요'}
              </p>
              <p className="mt-2 break-keep text-lg leading-relaxed text-mute">
                {로그인하라
                  ? '어느 자리에 몇 번 채용했는지는 로그인 없이 보여요. 경쟁률 숫자만 회원에게 보여드려요.'
                  : 숫자탈}
              </p>
              {로그인하라 && (
                <Link href={'/login?next=' + encodeURIComponent(주소({}))}
                  className="mt-6 inline-block rounded-md bg-brand-red px-7 py-4 text-btn font-bold
                             text-white transition-colors hover:bg-brand-red-dark active:scale-[0.98]">
                  로그인하기
                </Link>
              )}
            </div>
          ) : 한것 ? (
            <div className="mt-4">
              {/* 머리 — 기관은 작게, 요약 문장이 가장 큽니다 */}
              <p className="break-keep text-sm text-mute">
                {한것.머리.기관} · {한것.머리.지역}
                {한것.머리.고용형태 ? ' · ' + 한것.머리.고용형태 : ''}
              </p>
              <h2 className="mt-1 break-keep text-h2 font-bold">{한것.머리.직군}</h2>
              <p className="mt-3 break-keep text-body-lg font-bold text-ink">{요약문(한것.머리)}</p>
              {한것.머리.평균 && 한것.머리.가장낮음 && (
                <p className="mt-1 text-lg text-mute">
                  가장 낮았을 때 <span className="num tabular-nums">{한것.머리.가장낮음}</span> 대 1 ·
                  가장 높았을 때 <span className="num tabular-nums">{한것.머리.가장높음}</span> 대 1
                </p>
              )}
              {한것.머리.자리 && (
                <p className="mt-2 break-keep text-sm text-mute">{한것.머리.자리}</p>
              )}

              {/* 회차 — 공고 목록과 같은 divide-y 리듬 */}
              <ul className="mt-6 divide-y divide-gray-100 dark:divide-gray-800">
                {한것.회차들.map((r) => {
                  const v = 률칸(r);
                  return (
                    <li key={r.sn} className="py-6">
                      <div className="flex items-baseline justify-between gap-5">
                        <span className="text-sm text-mute">
                          {r.해}년{r.마감 ? ` · 마감 ${r.마감}` : ''}
                        </span>
                        <span className={'shrink-0 text-right ' + (v.흐림 ? 'text-mute' : '')}>
                          {v.큰글 && (
                            <b className="num block text-h3 font-bold tabular-nums text-ink">{v.큰글}</b>
                          )}
                          {v.작은글 && (
                            <span className={'block text-sm '
                              + (v.큰글 ? 'text-mute' : 'font-medium text-gray-700 dark:text-gray-300')}>
                              {v.작은글}
                            </span>
                          )}
                        </span>
                      </div>
                      {r.공고제목 && (
                        <p className="mt-1 break-keep text-body-lg font-medium">{r.공고제목}</p>
                      )}
                      {r.자리이름 && <p className="mt-0.5 break-keep text-sm text-mute">{r.자리이름}</p>}

                      {r.단계들 && r.단계들.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-1">
                          {r.단계들.map((t, i) => (
                            <li key={i} className="flex flex-wrap gap-x-3 text-sm text-mute">
                              <b className="min-w-[3.5rem] font-medium text-gray-700 dark:text-gray-300">
                                {t.이름 ?? (i + 1) + '차'}
                              </b>
                              {t.선발 != null && <span className="num tabular-nums">{t.선발}명 뽑음</span>}
                              {t.응시 != null && <span className="num tabular-nums">{t.응시}명 지원</span>}
                              {t.확정일 && <span>결과 {t.확정일}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.첫응시 != null && r.끝선발 ? (
                        <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {r.첫응시}명이 지원해 {r.끝선발}명을 뽑았어요
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <밝힘 기본값단계={한것.머리.기본값단계} />
            </div>
          ) : null}
        </section>
      )}

      {/* ── 목록 ────────────────────────────────────────────── */}
      {!고른묶음 && (
        <>
          <div className="mt-6">
            <ListFilters
              기준={{ job: sp.job, sido: sp.sido }}
              시도들={d.지역들}
              마감숨김
              고름={{
                이름: 'org',
                전체말: '기관 전체',
                선택지: d.기관들.map((x) => ({ 값: x, 글: x })),
                고른값: sp.org,
              }}
              뿌리="/compete"
              남길값={sp.q ? { q: sp.q } : {}}
            />

            {/* 자리 이름으로 찾기 — 공고 목록의 찾기 줄과 같은 꼴입니다 */}
            <form action="/compete" method="get" className="mb-2 flex gap-2">
              {sp.job && <input type="hidden" name="job" value={sp.job} />}
              {sp.sido && <input type="hidden" name="sido" value={sp.sido} />}
              {sp.org && <input type="hidden" name="org" value={sp.org} />}
              <input name="q" defaultValue={sp.q ?? ''} placeholder="기관·자리 이름으로 찾기"
                aria-label="기관이나 자리 이름으로 찾기"
                className="min-w-0 flex-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg
                           placeholder:text-mute dark:border-gray-700 dark:bg-gray-950" />
              <button type="submit"
                className="shrink-0 rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white
                           transition-colors hover:bg-brand-red-dark active:scale-[0.98]">
                찾기
              </button>
            </form>
          </div>

          {d.묶음.length === 0 ? (
            <p className="mt-7 text-lg text-mute">고른 조건에 맞는 자리가 없어요.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.묶음.map((g) => (
                <li key={g.묶음키}>
                  <Link href={주소({ g: g.묶음키, p: undefined })}
                    className="-mx-4 block rounded-sm px-4 py-6 hover:bg-gray-50 dark:hover:bg-gray-950">
                    {/* 공고 목록과 같은 차례 — 기관 작게, 제목 크게, 꼬리표 아래 */}
                    <div className="flex items-baseline justify-between gap-5">
                      <span className="break-keep text-sm text-mute">
                        {g.기관} · {g.지역}
                      </span>
                      <span className="num shrink-0 text-sm font-bold tabular-nums text-gray-600 dark:text-gray-400">
                        {g.회차}번 채용
                      </span>
                    </div>
                    <p className="mt-1 break-keep text-body-lg font-medium">
                      {g.직군}
                      {g.고용형태 ? ' · ' + g.고용형태 : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
                      <span className={꼬리표}>{g.첫해}~{g.끝해}년</span>
                      {g.기본값단계 && <span>단계 이름 기본값</span>}
                      {g.자리 && <span className="break-keep">{g.자리}</span>}
                      <span className="font-medium text-interaction-blue">
                        {회원인가 ? '경쟁률 보기' : '로그인하면 경쟁률을 볼 수 있어요'}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {끝쪽 > 1 && (
            <nav aria-label="쪽" className="mt-7 flex items-center justify-between">
              {쪽 > 1
                ? <Link href={주소({ p: String(쪽 - 1) })}
                    className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium
                               text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">
                    이전
                  </Link>
                : <span />}
              <span className="num text-lg tabular-nums text-mute">{쪽} / {끝쪽}</span>
              {쪽 < 끝쪽
                ? <Link href={주소({ p: String(쪽 + 1) })}
                    className="rounded-md border border-gray-200 px-6 py-4 text-lg font-medium
                               text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400">
                    다음
                  </Link>
                : <span />}
            </nav>
          )}

          <밝힘 />
        </>
      )}
    </main>
  );
}
