import type { Metadata } from 'next';
import Link from 'next/link';
import { Hit } from '@/components/hit';
import { RapoOrgBoard } from '@/components/rapo/rapo-org-board';
import { OrgSearch } from '@/components/org-search';
import { RapoBottomNav } from '@/components/rapo/rapo-bottom-nav';
import { MembersOnly } from '@/components/members-only';
import { orgJobs, orgPublic, ourNumbers, place, TILE_NAME, type OrgFacets, type OrgPublic } from '@/lib/org';
import { hospitalStat, type HospitalStat, type 시설숫자 } from '@/lib/hospital';
import { RapoDetailSection, RapoGuideRow, RapoHospitalFacts, RapoSectionGap, type 경쟁률줄, type 병원보수 } from '@/components/rapo/rapo-job-detail';
import { serverSupabase, serverWho } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* 병원정보 찾기.

   목록과 상세를 한 주소에서 다룹니다 — 기관 이름에 빗금·물음표가 들어간 곳이
   있고(10곳), 같은 이름이 자료 두 곳에 있는 경우도 있어서
   주소 조각(/orgs/이름)으로는 가리키기가 어렵습니다.

   ── 새 디자인 (2026-11-12) ──
   목록은 「병원 찾기」 1328:2689 의 어두운 판(자기 앱 바 · 어두운 하단 탐색) — components/org-search.tsx 머리.
   기관 상세(?org=)는 「병원 게시판」(1328:2695) 어두운 판입니다 — components/rapo/rapo-org-board.tsx 머리 (2026-11-12 세중님 「다 피그마 기준」).
   전의 기관 정보 화면(components/org-detail.tsx)은 쓰지 않지만 지우지 않았습니다. */

/* 원본 「RAPO / App Bar」 어두운 판 — #0d1d29 · 56 높이 · 뒤로 20 · 제목 18 Bold #f6f8fa */
function 어두운앱바() {
  return (
    <header className="sticky top-0 z-20 flex h-[56px] items-center gap-(--rapo-dimension-x1) bg-[#0d1d29] px-(--rapo-dimension-x2)">
      <Link href="/" aria-label="뒤로"
        className="flex size-(--rapo-touch-min) shrink-0 items-center justify-center rounded-(--rapo-radius-r2) active:bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element -- Figma 원본 SVG 그대로 */}
        <img src="/rapo/orgs/back-20.svg" alt="" width={20} height={20} />
      </Link>
      <h1 className="min-w-0 flex-1 text-[18px] font-bold leading-[26px] text-[#f6f8fa]">병원 찾기</h1>
    </header>
  );
}

/* 병원 게시판 「병원 정보」 탭 (2026-11-13 세중님 「채용공고 상세에 나오는 병원 정보 저기 뜨게」).
   공고 상세 「병원 한눈에」와 **같은 창구**를 씁니다 — 새 DB 함수를 만들지 않았습니다.
     이 기관 공고가 있으면  그 공고 하나로 공고병원숫자 · 공고병원보수 · 공고경쟁률요약 (공고 상세와 글자까지 같은 값)
     공고가 없으면          org_hospital_by_name(이름) — 심평원 구분·병상·재활의학과 전문의·치료사만 (연봉·경쟁률·시설은 공고로만 찾습니다)
   숫자가 하나도 없으면 null — 탭은 「아직 모은 정보가 없어요」를 그립니다 */
/* 공고가 없는 복지관·치매센터 — 기관 이름으로 인원 표를 바로 읽습니다 (2026-11-13 세중님 「복지관이랑 치매센터 인원정보는 안 뜨네?」).
   공고 쪽(DB 공고시설찾기)과 같은 표·같은 칸이고, 화면 글은 공고 상세와 같은 조각(시설보임)이 만듭니다.
     장애인복지관  welfare_centers — 원래 누구나 읽힘 · 종사자 전체 수와 순위·정원
     치매센터      dementia_centers — 회원에게 인원 칸만 열었습니다 (금고 SQL_1113/Y · 운영자 칸은 막힘)
   ★ 종합사회복지관(welfare_facilities)은 인원 자료가 **없습니다** — 그래서 「아직 모은 정보가 없어요」가 맞습니다.
   이름이 같은 곳이 둘 이상이면 시도로 가리고, 그래도 둘이면 안 그립니다(엉뚱한 곳 숫자를 안 붙이게). */
async function 시설숫자받기(sb: Awaited<ReturnType<typeof serverSupabase>>, name: string, sido: string | null): Promise<시설숫자 | null> {
  const 하나 = <T extends { sido?: string | null }>(줄: T[] | null): T | null => {
    const 후보 = (줄 ?? []).filter((x) => !sido || !x.sido || x.sido.startsWith(sido) || sido.startsWith(x.sido));
    return 후보.length === 1 ? 후보[0] : null;
  };
  const { data: 복지 } = await sb.from('welfare_centers').select('name, sido, staff_now, staff_quota').eq('name', name);
  const w = 하나(복지 as { name: string; sido: string | null; staff_now: number | null; staff_quota: number | null }[] | null);
  if (w && w.staff_now != null) {
    /* 순위는 공고 쪽과 같은 셈 — 종사자가 더 많은 곳 수 + 1 */
    const { data: 모두 } = await sb.from('welfare_centers').select('sido, staff_now').not('staff_now', 'is', null).limit(2000);
    const 줄 = (모두 ?? []) as { sido: string | null; staff_now: number }[];
    const 시도줄 = 줄.filter((y) => y.sido === w.sido);
    return {
      갈래: '복지관', 이름: w.name, 종사자: w.staff_now, 정원: w.staff_quota, 시도: w.sido,
      전국순위: 줄.filter((y) => y.staff_now > w.staff_now!).length + 1, 전국곳수: 줄.length,
      시도순위: 시도줄.filter((y) => y.staff_now > w.staff_now!).length + 1, 시도곳수: 시도줄.length,
      출처: '보건복지부 장애인복지관 현황 2024년 4월',
    };
  }
  const { data: 치매 } = await sb.from('dementia_centers').select('name, kind, doctors, nurses, social_workers, others').eq('name', name);
  const 치매줄 = (치매 ?? []) as { name: string; kind: string | null; doctors: number | null; nurses: number | null; social_workers: number | null; others: string | null }[];
  const d = 치매줄.length === 1 ? 치매줄[0] : null;
  if (d) {
    /* 「그밖」 글에서 작업·물리치료사 수 — 공고 쪽 정규식과 같은 꼴 (예: 작업치료사(1)+보건직(1)) */
    const 수 = (말: string) => { const m = (d.others ?? '').match(new RegExp(말 + String.raw`\s*\(?\s*([0-9]+)`)); return m ? Number(m[1]) : null; };
    return {
      갈래: '치매센터', 이름: d.name, 종류: d.kind, 의사: d.doctors, 간호사: d.nurses, 사회복지사: d.social_workers,
      ot: 수('작업치료사'), pt: 수('물리치료사'), 출처: '전국치매센터표준데이터',
    };
  }
  return null;
}

async function 병원정보받기(sb: Awaited<ReturnType<typeof serverSupabase>>, name: string, sido: string | null) {
  const 공고 = (await orgJobs(sb, name))[0]?.id ?? null;
  const [숫자, 보수, 경쟁률] = 공고
    ? await Promise.all([
        sb.rpc('공고병원숫자', { p_공고: 공고 }).maybeSingle().then(({ data }) => (data as unknown as HospitalStat | null) ?? null),
        sb.rpc('공고병원보수', { p_공고: 공고 }).maybeSingle().then(({ data }) => (data as unknown as 병원보수 | null) ?? null),
        sb.rpc('공고경쟁률요약', { p_공고: 공고 }).then(({ data }) => (Array.isArray(data) ? data as 경쟁률줄[] : [])),
      ])
    : [await hospitalStat(sb, name), null, [] as 경쟁률줄[]];
  /* 공고로 못 찾은 병원 숫자는 이름으로 한 번 더 */
  const 병원숫자 = 숫자 ?? (공고 ? await hospitalStat(sb, name) : null);
  /* 병원으로도 공고로도 못 찾았으면 복지관·치매센터 표를 이름으로 */
  const 시설 = 병원숫자?.시설 ?? (병원숫자 ? null : await 시설숫자받기(sb, name, sido));
  const 치료사 = 병원숫자 && !시설 && (병원숫자.pt != null || 병원숫자.ot != null)
    ? { pt: 병원숫자.pt, ot: 병원숫자.ot, 기준: 병원숫자.data_version?.replace(/^심평원\s*/, '') ?? null } : null;
  return RapoHospitalFacts({ 치료사, 바쁨: 시설 ? null : 병원숫자, 시설, 경쟁률, 보수, 공고없이: true });
}

/* 「병원 정보」 탭 맨 위 — 어떤 곳이고 어디 있는지 (2026-11-13 세중님 「주소 정도만 같이 추가되면 어디에 있는 거군아 정도 알 것 같아」).
   종류는 기관 표의 kinds 에서 더 넓은 말(「복지관」 ⊂ 「장애인복지관」)을 빼고 남은 것 · 없으면 타일 이름.
   주소는 자료에 따라 시도가 빠져 있어(「강동구 고덕로 201」) 시도를 앞에 붙입니다. 공고 상세 「근무 장소」와 같은 줄 모양 */
function 기관정보칸(o: OrgPublic) {
  const 종류들 = (o.kinds ?? []).filter((k, _, 모두) => !모두.some((x) => x !== k && x.includes(k)));
  const 종류 = 종류들.slice(0, 2).join(' · ') || TILE_NAME[o.tile] || null;
  const 시도 = o.sido_std ?? '';
  const 주소 = o.addr ? (시도 && !o.addr.startsWith(시도) ? `${시도} ${o.addr}` : o.addr) : place(o.sido_std, o.sgg_std) || null;
  if (!종류 && !주소) return null;
  return (
    <RapoDetailSection title="기관 정보">
      <div className="flex flex-col gap-(--rapo-dimension-x3)">
        {종류 && <RapoGuideRow label="종류">{종류}</RapoGuideRow>}
        {주소 && <RapoGuideRow label="주소">{주소}</RapoGuideRow>}
      </div>
    </RapoDetailSection>
  );
}

/* 거르기 목록도 회원만입니다 (2026-09-25 · org_facets 의 실행 권한을 걷었습니다).
   로그인 안 한 분에게는 빈 것이 오고, 아래에서 가입 권유를 그립니다 */
async function facets(sb: Awaited<ReturnType<typeof serverSupabase>>): Promise<OrgFacets> {
  const { data } = await sb.rpc('org_facets');
  return (data as OrgFacets | null)
    ?? { tiles: {}, sidos: [], sggs: {}, total: 0 };
}

export async function generateMetadata({ searchParams }: PageProps<'/orgs'>): Promise<Metadata> {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  if (!org) {
    return {
      title: '병원정보 찾기 · RAPO',
      description: '치료사가 일하는 곳을 이름·종별·지역으로 찾아봐요',
    };
  }
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;
  /* 회원이 공유한 링크면 제목이 제대로 붙고, 아니면 이름만 붙습니다 —
     기관 자료는 회원만 읽을 수 있습니다 */
  const o = await orgPublic(await serverSupabase(), org, sido);
  if (!o) return { title: `${org} · RAPO` };

  const desc = [TILE_NAME[o.tile] ?? '기관', place(o.sido_std, o.sgg_std)]
    .filter(Boolean).join(' · ');
  return {
    title: `${o.name} · RAPO`,
    description: desc,
    openGraph: { title: o.name, description: desc, type: 'article' },
  };
}

export default async function OrgsPage({ searchParams }: PageProps<'/orgs'>) {
  const sp = await searchParams;
  const org = typeof sp.org === 'string' ? sp.org : null;
  const sido = typeof sp.sido === 'string' && sp.sido ? sp.sido : null;

  if (org) {
    /* 병원 이름이 자료에 있는지만 봅니다(없으면 책갈피를 안 그리고 안내 한 줄). 회원만 읽히는 창구라 비회원은 문지기에서 이미 로그인으로 갑니다 */
    const sb = await serverSupabase();
    const 기관 = await orgPublic(sb, org, sido);
    const 있나 = !!기관;
    /* 처음 열면 「병원 정보」 (2026-11-13 세중님) — 맨 위 기관 정보(종류·주소), 그 아래 한눈에 숫자 */
    const 탭 = sp.tab === 'review' ? 'review' : sp.tab === 'talk' ? 'talk' : 'info';
    const 숫자 = 탭 === 'info' && 기관 ? await 병원정보받기(sb, org, sido) : null;
    const 위칸 = 탭 === 'info' && 기관 ? 기관정보칸(기관) : null;
    const 정보 = 위칸 || 숫자 ? (
      <>
        {위칸}
        {위칸 && 숫자 && <RapoSectionGap />}
        {숫자}
      </>
    ) : null;
    return (
      <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl" style={{ background: '#112332' }}>
        <Hit kind="org" target={org} />
        <RapoOrgBoard name={org} sido={sido} 탭={탭} 있나={있나} 정보={정보} />
        <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
        <RapoBottomNav current="/community" dark />
      </div>
    );
  }

  const sb = await serverSupabase();
  /* 세 값입니다 — 회원 · 비회원 · 모름.
     「모름」(물어봤는데 답을 못 받음)일 때 가입 권유를 그리면,
     회원에게 「가입하고 전부 보기」 가 뜹니다 (2026-09-25에 실제로 났습니다) */
  const who = await serverWho(sb);

  /* 「모름」은 **빈 화면**입니다 — 공고 상세와 같은 방향 (2026-09-25).
     전에는 회원 쪽으로 넘겨 자료가 빈 채로 그려졌습니다. 그러면
     「찾는 결과가 없습니다」처럼 보여, 없는 사실을 지어내는 꼴이 됩니다.
     같은 함수를 쓰는 세 곳이 막힐 때 가는 방향이 달랐습니다. 한쪽으로 맞췥니다 */
  if (who === '모름') return null;

  if (who === '비회원') {
    return (
      <div className="bg-[#F4F4F1]">
        <main className="mx-auto w-full max-w-2xl px-6 pt-6 pb-[88px] md:px-7">
          <Hit kind="orgs" />
          <h1 className="break-keep text-h1 font-bold text-[#14181C]">병원정보 찾기</h1>
          <p className="mt-2 break-keep text-lg text-[#5F666C]">
            치료사가 일하는 곳을 이름 · 종별 · 지역으로 찾아봐요
          </p>
          {/* 곳 수는 지어내지 않고 실제로 셉니다 — org_total 은 줄이 안 나가서
              로그인 없이도 부를 수 있게 열어뒀습니다 */}
          <MembersOnly
            title={<>병원정보는<br />회원만 볼 수 있어요</>}
            body={`치료사가 일하는 곳 ${(await ourNumbers()).orgs.toLocaleString('ko-KR')} 곳. 인원 · 병상 · 얼마나 바쁜 곳인지까지 찾아볼 수 있어요.`}
            진단="app/orgs/page.tsx · 서버(serverWho)"
          />
        </main>
      </div>
    );
  }

  const f = await facets(sb);

  return (
    <div data-rapo className="mx-auto min-h-dvh w-full max-w-3xl bg-[#112332]">
      <어두운앱바 />
      <main className="px-[22px] pb-(--rapo-dimension-x6) pt-[15px]">
        <Hit kind="orgs" />
        <OrgSearch facets={f} />
      </main>
      <div aria-hidden style={{ height: 'calc(73px + env(safe-area-inset-bottom))' }} />
      <RapoBottomNav current="/" dark />
    </div>
  );
}
