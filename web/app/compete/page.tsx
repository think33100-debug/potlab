import type { Metadata } from 'next';
import Link from 'next/link';

import { ListFilters } from '@/components/list-filters';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 경쟁률 찾아보기 (2026-10-05).

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

/* 출처와 한계 — 화면 아래 **늘** 붙습니다 (경쟁률_화면_설계.md 4절) */
function 밝힘({ 기본값단계 }: { 기본값단계?: boolean }) {
  return (
    <p className="mt-6 break-keep text-sm leading-relaxed text-mute">
      알리오(공공기관 경영정보 공개시스템)에 기관이 올린 자료 기준이에요.
      <b> 공공기관만 해당돼요</b> — 민간 병원은 이 자료에 없어요.
      경쟁률은 <b>첫 단계 응시자 ÷ 최종 선발 인원</b>이에요.
      뽑은 사람이 0명이면 「경쟁률 낼 값 없음」으로 적고 0으로 적지 않아요.
      {기본값단계 && <> 단계가 서류인지 면접인지 공고 설명에 없으면 <b>일반적인 전형 순서 기준</b>으로 적어요.</>}
    </p>
  );
}

const 칩 = 'rounded-xs bg-badge-teal-bg px-3 py-1 text-sm text-gray-700 dark:text-gray-200';

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
        <h1 className="text-h1 font-bold">경쟁률 찾아보기</h1>
        <p className="mt-2 break-keep text-lg text-mute">
          공공기관이 공개한 지난 채용의 경쟁률이에요. 자리 <b>{d.전체}곳</b>
          {!회원인가 && <> · 숫자는 <b>로그인하면</b> 보여요</>}
        </p>
      </header>

      {/* ── 고른 묶음 ───────────────────────────────────────── */}
      {고른묶음 && (
        <section className="mt-6 rounded-sm border border-line bg-card p-6">
          <Link href={주소({ g: undefined })} className="text-sm text-mute underline underline-offset-2">
            ← 목록으로
          </Link>

          {숫자탈 ? (
            <div className="mt-4">
              <p className="break-keep text-body-lg font-bold text-ink">
                {숫자탈.includes('로그인') ? '로그인하면 경쟁률을 볼 수 있어요' : '못 읽었어요'}
              </p>
              <p className="mt-2 break-keep text-lg text-mute">
                {숫자탈.includes('로그인')
                  ? '어느 자리에 몇 번 채용했는지는 로그인 없이 보여요. 경쟁률 숫자만 회원에게 보여드려요.'
                  : 숫자탈}
              </p>
              {숫자탈.includes('로그인') && (
                <Link href={'/login?next=' + encodeURIComponent(주소({}))}
                  className="mt-5 inline-block rounded-md bg-brand-red px-7 py-5 text-btn font-bold text-white hover:bg-brand-red-dark">
                  로그인하기
                </Link>
              )}
            </div>
          ) : 한것 ? (
            <div className="mt-4">
              <h2 className="break-keep text-h3 font-bold">
                {한것.머리.기관} · {한것.머리.지역} · {한것.머리.직군}
                {한것.머리.고용형태 ? ' · ' + 한것.머리.고용형태 : ''}
              </h2>
              <p className="mt-2 text-body-lg font-bold text-ink">{요약문(한것.머리)}</p>
              {한것.머리.평균 && 한것.머리.가장낮음 && (
                <p className="mt-1 text-lg text-mute">
                  가장 낮았을 때 {한것.머리.가장낮음} 대 1 · 가장 높았을 때 {한것.머리.가장높음} 대 1
                </p>
              )}

              <ul className="mt-5 flex flex-col gap-3">
                {한것.회차들.map((r) => (
                  <li key={r.sn} className="rounded-xs bg-paper p-5 dark:bg-gray-950">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-lg text-mute">
                        {r.해}년{r.마감 ? ` · 마감 ${r.마감}` : ''}
                      </span>
                      <span className="text-body-lg font-bold text-ink">
                        {r.경쟁률상태 === '있음' && r.경쟁률
                          ? `${r.경쟁률} : 1`
                          : <span className="text-mute">경쟁률 낼 값 없음</span>}
                      </span>
                    </div>
                    {r.공고제목 && (
                      <p className="mt-1 break-keep text-lg text-ink">{r.공고제목}</p>
                    )}
                    {r.자리이름 && <p className="text-sm text-mute">{r.자리이름}</p>}

                    {r.단계들 && r.단계들.length > 0 && (
                      <ul className="mt-3 flex flex-col gap-1">
                        {r.단계들.map((s, i) => (
                          <li key={i} className="text-sm text-mute">
                            <b className="text-ink">{s.이름 ?? (i + 1) + '차'}</b>
                            {s.선발 != null && <> · {s.선발}명 뽑음</>}
                            {s.응시 != null && <> · {s.응시}명 지원</>}
                            {s.확정일 && <> · 결과 {s.확정일}</>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.첫응시 != null && r.끝선발 ? (
                      <p className="mt-2 text-sm text-ink">
                        {r.첫응시}명이 지원해 {r.끝선발}명을 뽑았어요
                      </p>
                    ) : null}
                  </li>
                ))}
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

            {/* 자리 이름으로 찾기 — 설계 5절 */}
            <form action="/compete" method="get" className="mb-6 flex gap-2">
              {sp.job && <input type="hidden" name="job" value={sp.job} />}
              {sp.sido && <input type="hidden" name="sido" value={sp.sido} />}
              {sp.org && <input type="hidden" name="org" value={sp.org} />}
              <input name="q" defaultValue={sp.q ?? ''} placeholder="기관·자리 이름으로 찾기"
                aria-label="기관이나 자리 이름으로 찾기"
                className="min-w-0 flex-1 rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink focus:border-teal-strong focus:outline-none" />
              <button type="submit"
                className="shrink-0 rounded-xs border border-line px-5 py-3 text-lg text-ink hover:bg-gray-50">
                찾기
              </button>
            </form>
          </div>

          {d.묶음.length === 0 ? (
            <p className="text-lg text-mute">고른 조건에 맞는 자리가 없어요.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.묶음.map((g) => (
                <li key={g.묶음키}>
                  <Link href={주소({ g: g.묶음키, p: undefined })}
                    className="block rounded-sm border border-line bg-card p-5 hover:border-teal-strong">
                    <p className="break-keep text-body-lg font-bold text-ink">
                      {g.기관} · {g.지역} · {g.직군}
                      {g.고용형태 ? ' · ' + g.고용형태 : ''}
                    </p>
                    {g.자리 && (
                      <p className="mt-1 break-keep text-sm text-mute">{g.자리}</p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={칩}>{g.첫해}~{g.끝해}년</span>
                      <span className={칩}>{g.회차}번 채용</span>
                      {g.기본값단계 && <span className={칩}>단계 이름 기본값</span>}
                      <span className="text-sm text-mute">
                        {회원인가 ? '경쟁률 보기 →' : '로그인하면 경쟁률을 볼 수 있어요'}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {끝쪽 > 1 && (
            <nav aria-label="쪽" className="mt-7 flex items-center justify-between">
              {쪽 > 1
                ? <Link href={주소({ p: String(쪽 - 1) })}
                    className="rounded-xs border border-line px-5 py-3 text-lg text-ink hover:bg-gray-50">
                    이전
                  </Link>
                : <span />}
              <span className="text-lg text-mute">{쪽} / {끝쪽}</span>
              {쪽 < 끝쪽
                ? <Link href={주소({ p: String(쪽 + 1) })}
                    className="rounded-xs border border-line px-5 py-3 text-lg text-ink hover:bg-gray-50">
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
