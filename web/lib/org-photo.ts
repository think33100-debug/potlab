/* 기관 사진·마크 — 시범 (2026-11-23 세중님 「일단 아주대학교병원만 · 작업치료사 공고 중에 · 출처는 제일 아래 작게」
   · 「기관이름 옆에는 마크」 · 「써도 돼 올려」).

   사진·마크와 출처는 Codex 가 모아 구글 드라이브에 둔 자료(릴스자동화_777기관_20261117 · institutions.json)에서 옮겼습니다.
   그 표의 기관번호(org_id)는 운영 DB 기관.기관번호와 글자까지 같습니다.

   ★ 파일은 web/public/org-photos/ 에 둡니다(영어 이름 · 지침 6-2b). 넣은 파일의 sha256 이 Codex 표의 원본 지문과 같은지 보고 넣었습니다.
     사용 허락은 Codex 표에 「미확인」(permission_confirmed false)이고, 세중님이 쓰기로 정하셨습니다(11/23).

   ★ 시범이라 화면이 기관을 **이름**으로 찾습니다 — job_one 이 기관번호를 화면에 내려주지 않고,
     병원 화면(/orgs?org=)도 이름으로 엽니다. 운영 DB 에서 「아주대학교병원」 이름의 공고는
     모두 이 기관번호 하나였습니다(17건 · 다른 번호 0건 · 2026-11-23 읽기 확인).
     여러 곳으로 넓힐 때는 이 표를 DB 로 옮기고 기관번호로 잇습니다 — DB 바꾸기라 세중님 승인 자리입니다. */

type 출처 = { 누가: string; 어디: string; 주소: string };

export type 기관사진 = {
  기관번호: string;
  이름: string;
  /* 사진을 붙일 직군 — 시범은 작업치료사 공고만 (null 이면 모든 공고) */
  직군: string | null;
  /* web/public/org-photos/ 안의 파일 이름 */
  파일: string;
  /* 원본 sha256 (Codex 표 asset_id 와 같음) · 원본 주소 — 기록용 */
  지문: string;
  원본주소: string;
  설명: string;
  출처: 출처;
  /* 기관 마크 — 기관 이름 옆 흰 칸. Codex 자료에 아주대는 「이름이 들어간 로고」(142×50) 하나뿐이라 고치지 않고 그대로 씁니다 */
  로고?: { 파일: string; 지문: string; 원본주소: string; 출처: 출처 };
};

const 사진표: 기관사진[] = [
  {
    기관번호: 'HIRA:JDQ4MTYyMiM1MSMkMSMkMCMkODkkMzgxMzUxIzExIyQxIyQzIyQ2MiQzNjE4MzIjNTEjJDEjJDYjJDgz',
    이름: '아주대학교병원',
    직군: '작업치료사',
    파일: 'ajou-hosp-exterior.jpg',
    지문: '52b0e075af58d5dbf0de7da1bbfd8da996bc623ccc5681d4ee0ab8e97c56e297',
    원본주소: 'https://www.ajoumc.or.kr/crosseditor/binary/images/000030/%EC%95%84%EC%A3%BC%EB%8C%80%EB%B3%91%EC%9B%90_%EC%A0%84%EA%B2%BD_(1).jpg',
    설명: '아주대학교병원 건물 전경',
    출처: { 누가: '아주대학교병원', 어디: '병원 누리집 보도자료', 주소: 'https://hosp.ajoumc.or.kr/board/commBoardNewsView.do?no=69294' },
    로고: {
      파일: 'ajou-hosp-logo.png',
      지문: 'e6bc7a2115fb17d85ec5c195a98afd0f422d44a4070dca4edb9bd49d7a061e71',
      원본주소: 'https://hosp.ajoumc.or.kr/common/front/kor/images/layout/logo_hd.png',
      출처: { 누가: '아주대학교병원', 어디: '병원 누리집', 주소: 'https://hosp.ajoumc.or.kr/' },
    },
  },
];

const 자리 = '/org-photos/';

export function 사진주소(s: 기관사진): string {
  return 자리 + s.파일;
}

/** 기관 마크 주소 — 없으면 null (화면은 원래 기본 그림) */
export function 로고주소(s: 기관사진 | null): string | null {
  return s?.로고 ? 자리 + s.로고.파일 : null;
}

/** 맨 아래 출처 줄에 적을 것 — 사진 · 로고 */
export function 출처들(s: 기관사진): ({ 말: string } & 출처)[] {
  return [{ 말: '사진', ...s.출처 }, ...(s.로고 ? [{ 말: '로고', ...s.로고.출처 }] : [])];
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
