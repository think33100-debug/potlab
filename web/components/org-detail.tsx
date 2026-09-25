import Link from 'next/link';
import { Icon } from '@/components/icon';
import { Rise } from '@/components/job-parts';
import { OrgSave } from '@/components/org-save';
import { OrgStat } from '@/components/org-stat';
import { ShareButtons } from '@/components/share-buttons';
import { BUSY_COLOR } from '@/lib/brand';
import { iconMap } from '@/lib/icons';
import { MembersOnly } from '@/components/members-only';
import { orgJobs, orgNearby, orgPublic, place, shortKinds, TILE_NAME } from '@/lib/org';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

/* 기관 하나.

   ── 2026-09-25 에 바뀐 것 ──────────────────────────────────────────
   **기관 상세는 통째로 회원만 봅니다.**

   전에는 「이름·종별·지역·주소·전화·공고는 누구나」였습니다. 그런데 그 자료를
   내주는 함수(org_public · org_jobs · org_nearby)가 로그인을 안 보고 있어서,
   요청을 직접 쏘면 기관 55,338곳이 그대로 나갔습니다.
   실제로 쏴서 확인했습니다 — org_public 1줄 · org_jobs 8줄 · org_nearby 3줄.

   지금은 셋 다 실행 권한을 anon 에서 걷었습니다. 로그인 안 한 분에게는
   아무것도 안 오고, 여기서 가입 권유를 그립니다. */

const BAND_WORD: Record<string, string> = { busy: '바쁜 곳', mid: '보통', easy: '여유로운 곳' };

export async function OrgDetail({ name, sido }: { name: string; sido: string | null }) {
  const sb = await serverSupabase();
  /* 회원 · 비회원 · 모름. 「모름」이면 가입 권유를 안 그립니다 */
  const who = await serverWho(sb);

  if (who === '비회원') {
    return (
      <>
        <Back />
        <h1 className="mt-6 break-keep text-[26px] font-black text-[#14181C]">{name}</h1>
        <MembersOnly
          title={<>병원정보는<br />회원만 볼 수 있어요</>}
          body="치료사 인원 · 병상 · 얼마나 바쁜 곳인지와 지금 열린 공고까지. 가입은 3분이면 끝나요."
        />
      </>
    );
  }

  const [org, icons] = await Promise.all([orgPublic(sb, name, sido), iconMap('공고 상세')]);

  if (!org) {
    return (
      <>
        <Back />
        <h1 className="mt-6 break-keep text-[26px] font-black text-[#14181C]">{name}</h1>
        <p className="mt-4 break-keep text-[15px] text-[#5F666C]">
          이 기관을 자료에서 못 찾았어요. 이름이 바뀌었거나 문을 닫았을 수 있어요
        </p>
      </>
    );
  }

  const [jobs, near] = await Promise.all([
    orgJobs(sb, org.name),
    orgNearby(sb, org.name, org.sido_std),
  ]);

  const where = place(org.sido_std, org.sgg_std);
  const kind = TILE_NAME[org.tile] ?? '기관';

  const facts: [string, string][] = [];
  if (org.addr) facts.push(['주소', org.addr]);
  if (org.tel) facts.push(['전화', org.tel]);
  if (org.kinds?.length) facts.push(['종별', shortKinds(org.kinds)]);
  if (org.est_type) facts.push(['설립구분', org.est_type]);

  return (
    <>
      {/* ① 상단바 ─────────────────────────────── */}
      <div className="-mr-5 flex items-center justify-between">
        <Back />
        <ShareButtons
          title={org.name}
          text={[kind, where].filter(Boolean).join(' · ')}
          path={`/orgs?org=${encodeURIComponent(org.name)}&sido=${encodeURIComponent(org.sido_std ?? '')}`}
          compact
        />
      </div>

      {/* ② 머리 ───────────────────────────────── */}
      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#ECECE8] px-3 py-1 text-[13px] font-bold text-[#4A5056]">
            {kind}
          </span>
          {org.band && (
            <span className="rounded-full px-3 py-1 text-[13px] font-bold text-white"
                  style={{ backgroundColor: BUSY_COLOR[org.band] }}>
              {BAND_WORD[org.band]}
            </span>
          )}
        </div>

        <h1 className="mt-4 break-keep text-[28px] font-black leading-[1.32] text-[#14181C]"
            style={{ overflowWrap: 'break-word' }}>
          {org.name}
        </h1>

        <p className="mt-3 break-keep text-[15px] text-[#4A5056]">
          {org.addr || where || '주소가 자료에 없어요'}
        </p>
      </header>

      {/* ③ 병원 전체 인원 · ④ 얼마나 바쁜 곳인지 — 회원만 ── */}
      <OrgStat name={org.name} sido={org.sido_std} staffed={org.staffed} icons={icons} />

      {/* ⑤ 이 기관의 공고 ─────────────────────── */}
      <Rise>
        <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
            <Icon name={icons['job.headcount']} size={18} className="shrink-0 text-[#5F666C]" />
            이 기관의 공고
          </h2>

          {jobs.length === 0 ? (
            <p className="mt-4 break-keep text-[15px] text-[#5F666C]">
              지금 열린 공고가 없어요. 새로 뜨면 아래 단추로 알려드릴게요
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="block rounded-[12px] bg-[#F4F4F1] px-5 py-4
                               transition-transform duration-[120ms] active:scale-[0.99]
                               motion-reduce:transition-none"
                  >
                    <p className="break-keep text-[15px] font-bold leading-[1.45] text-[#14181C]">
                      {j.title}
                    </p>
                    <p className="mt-1 break-keep text-[13px] text-[#5F666C]">
                      {[j.job_group, j.employ_type,
                        j.apply_to ? `~${j.apply_to.slice(5).replace('-', '.')}` : null]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 break-keep rounded-[10px] bg-[#ECECE8] p-4 text-[12px]
                        leading-relaxed text-[#5F666C]">
            지난 공고는 아직 못 보여드려요. 공공기관 쪽에서 마감된 공고를 주지 않아서,
            우리가 모으기 시작한 뒤의 것만 남습니다.
          </p>
        </section>
      </Rise>

      {/* ⑥ 기본 정보 ──────────────────────────── */}
      {facts.length > 0 && (
        <Rise>
          <section className="mt-7 rounded-[14px] border border-[#E3E3DE] bg-white p-6">
            <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#1B2025]">
              <Icon name={icons['job.place']} size={18} className="shrink-0 text-[#5F666C]" />
              기본 정보
            </h2>
            <dl className="mt-4 grid grid-cols-[4.5rem_1fr] gap-y-3">
              {facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="break-keep text-[13px] text-[#5F666C]">{k}</dt>
                  <dd className="break-keep text-[14px] text-[#4A5056]"
                      style={{ overflowWrap: 'break-word' }}>{v}</dd>
                </div>
              ))}
            </dl>

            {org.homepage && (
              <a
                href={org.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-between gap-3 rounded-[12px]
                           border border-[#E3E3DE] px-5 py-4
                           transition-transform duration-[120ms] active:scale-[0.99]
                           motion-reduce:transition-none"
              >
                <span className="break-keep text-[14px] font-medium text-[#4A5056]">
                  기관 홈페이지 열기
                </span>
                <Icon name="arrow-up-right" size={16} className="shrink-0 text-[#5F666C]" />
              </a>
            )}
          </section>
        </Rise>
      )}

      {/* ⑦ 근처의 비슷한 곳 ───────────────────── */}
      {near.length > 0 && (
        <Rise>
          <section className="mt-7">
            <h2 className="break-keep text-[17px] font-bold text-[#1B2025]">
              근처의 비슷한 곳
            </h2>
            <p className="mt-1 break-keep text-[13px] text-[#5F666C]">
              {[where, kind].filter(Boolean).join(' · ')}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {near.map((o) => (
                <li key={`${o.name}/${o.sido_std}`}>
                  <Link
                    href={`/orgs?org=${encodeURIComponent(o.name)}&sido=${encodeURIComponent(o.sido_std ?? '')}`}
                    className="flex items-center justify-between gap-3 rounded-[12px]
                               border border-[#E3E3DE] bg-white px-5 py-4
                               transition-transform duration-[120ms] active:scale-[0.99]
                               motion-reduce:transition-none"
                  >
                    <span className="min-w-0 break-keep text-[15px] font-bold text-[#14181C]">
                      {o.name}
                    </span>
                    <Icon name="chevron-left" size={16}
                          className="shrink-0 rotate-180 text-[#8A9299]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </Rise>
      )}

      {/* ⑧ 출처 ───────────────────────────────── */}
      <div className="mt-7 flex items-start gap-2 rounded-[10px] bg-[#ECECE8] p-5">
        <Icon name={icons['job.source']} size={15} className="mt-0.5 shrink-0 text-[#5F666C]" />
        <p className="break-keep text-[12px] leading-relaxed text-[#5F666C]">
          건강보험심사평가원 병원 자료를 기관 한 곳 단위로 다시 묶었어요.
        </p>
      </div>

      {/* ⑨ 하단 고정 — 탭바 위에 얹습니다 */}
      <OrgSave name={org.name} sido={org.sido_std} />
    </>
  );
}

function Back() {
  return (
    <Link
      href="/orgs"
      className="-ml-5 flex h-[48px] w-[48px] items-center justify-center rounded-full text-[#4A5056]
                 transition-transform duration-[120ms] active:scale-[0.88]
                 motion-reduce:transition-none"
    >
      <Icon name="chevron-left" size={24} />
      <span className="sr-only">병원정보 찾기로</span>
    </Link>
  );
}
