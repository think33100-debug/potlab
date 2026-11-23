/* 기관 사진 — 시범 (2026-11-23 세중님 「일단 아주대학교병원만 · 작업치료사 공고 중에 · 출처는 제일 아래 작게」).

   사진과 출처는 Codex 가 모아 구글 드라이브에 둔 자료(릴스자동화_777기관_20261117 · institutions.json)에서 옮겼습니다.
   그 표의 기관번호(org_id)는 운영 DB 기관.기관번호와 글자까지 같습니다.

   ★ 시범이라 화면이 기관을 **이름**으로 찾습니다 — job_one 이 기관번호를 화면에 내려주지 않고,
     병원 화면(/orgs?org=)도 이름으로 엽니다. 운영 DB 에서 「아주대학교병원」 이름의 공고는
     모두 이 기관번호 하나였습니다(17건 · 다른 번호 0건 · 2026-11-23 읽기 확인).
     여러 곳으로 넓힐 때는 이 표를 DB(기관.사진경로 + 출처 칸)로 옮기고 기관번호로 잇습니다 — DB 바꾸기라 세중님 승인 자리입니다.

   ★ 사진 파일은 공개 저장소에 올리지 않습니다. Supabase Storage 공개 버킷 org-photos 에 두고(경로는 영어 · 지침 6-2b)
     화면은 그 주소를 씁니다. 버킷 만들기·올리기는 세중님 승인 뒤입니다.
     NEXT_PUBLIC_ORG_PHOTO_SOURCE=1 로 빌드하면 병원 누리집 원본 주소를 바로 씁니다 — 로컬 시안 캡처 전용입니다.

   ★ 사용 허락은 아직 확인되지 않았습니다 — Codex 표 rights_status 「미확인」 · permission_confirmed false.
     출처를 적는 것과 쓰도록 허락받은 것은 다릅니다. 운영에 올릴지는 세중님이 정합니다. */

export type 기관사진 = {
  기관번호: string;
  이름: string;
  /* 사진을 붙일 직군 — 시범은 작업치료사 공고만 (null 이면 모든 공고) */
  직군: string | null;
  파일: string;
  원본주소: string;
  설명: string;
  너비: number;
  높이: number;
  출처: { 누가: string; 어디: string; 주소: string };
  /* 기관 마크 (2026-11-23 세중님 「기관이름 옆에는 마크」) — 기관 이름 옆 흰 칸에 그립니다.
     그림은 공통 로고와 같은 길(Supabase 「기관로고」 표 → /api/org-logo/<열쇠> · lib/org-logo.ts)로 내보냅니다 — 표에 줄 넣기는 승인 뒤.
     Codex 자료에 아주대는 「이름이 들어간 로고」(142×50) 하나뿐이라 그것을 고치지 않고 그대로 씁니다 */
  로고?: { 열쇠: string; 원본주소: string; 너비: number; 높이: number; 출처: { 누가: string; 어디: string; 주소: string } };
};

const 사진표: 기관사진[] = [
  {
    기관번호: 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQzIyQ2MiQzNjE4MzIjNTEjJDEjJDYjJDgz',
    이름: '아주대학교병원',
    직군: '작업치료사',
    /* 파일 이름은 원본 sha256 — Codex 표의 asset_id 와 같습니다 */
    파일: '52b0e075af58d5dbf0de7da1bbfd8da996bc623ccc5681d4ee0ab8e97c56e297.jpg',
    원본주소: 'http://www.ajoumc.or.kr/crosseditor/binary/images/000030/%EC%95%84%EC%A3%BC%EB%8C%80%EB%B3%91%EC%9B%90_%EC%A0%84%EA%B2%BD_(1).jpg',
    설명: '아주대학교병원 건물 전경',
    너비: 750,
    높이: 478,
    출처: { 누가: '아주대학교병원', 어디: '병원 누리집 보도자료', 주소: 'https://hosp.ajoumc.or.kr/board/commBoardNewsView.do?no=69294' },
    로고: {
      열쇠: 'ajou-hosp',
      원본주소: 'https://hosp.ajoumc.or.kr/common/front/kor/images/layout/logo_hd.png',
      너비: 142, 높이: 50,
      출처: { 누가: '아주대학교병원', 어디: '병원 누리집', 주소: 'https://hosp.ajoumc.or.kr/' },
    },
  },
];

/** 기관 마크 주소 — 없으면 null (화면은 원래 기본 그림) */
export function 로고주소(s: 기관사진 | null): string | null {
  if (!s?.로고) return null;
  if (process.env.NEXT_PUBLIC_ORG_PHOTO_SOURCE === '1') return s.로고.원본주소;
  return `/api/org-logo/${s.로고.열쇠}`;
}

/** 맨 아래 출처 줄에 적을 것 — 사진 · 로고 */
export function 출처들(s: 기관사진): { 말: string; 누가: string; 어디: string; 주소: string }[] {
  return [{ 말: '사진', ...s.출처 }, ...(s.로고 ? [{ 말: '로고', ...s.로고.출처 }] : [])];
}

export function 사진주소(s: 기관사진): string {
  if (process.env.NEXT_PUBLIC_ORG_PHOTO_SOURCE === '1') return s.원본주소;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-photos/${s.파일}`;
}

/** 병원 화면(/orgs?org=이름) — 이름이 글자까지 같은 곳만 */
export function 기관사진찾기(이름: string | null | undefined): 기관사진 | null {
  if (!이름) return null;
  return 사진표.find((s) => s.이름 === 이름) ?? null;
}

/** 공고 상세 — 기관 이름이 같고, 직군을 정해 둔 사진이면 그 직군 공고만 */
export function 공고사진찾기(기관이름: string | null | undefined, 직군: string | null | undefined): 기관사진 | null {
  const s = 기관사진찾기(기관이름);
  if (!s) return null;
  return s.직군 == null || s.직군 === 직군 ? s : null;
}
