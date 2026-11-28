/* 기관 사진·마크 (2026-11-23 세중님 「출처는 제일 아래 작게」 · 「기관이름 옆에는 마크」 · 「써도 돼 올려」
   · 코덱스와 나눠 넣기 「그렇게 해」).

   기관마다 한 줄 — web/lib/org-photos.json. 그림 파일은 web/public/org-photos/.
   줄은 손으로 고치지 않고 tools/기관사진넣기.mjs 가 코덱스 묶음(RAPO/기관이미지_코덱스/넣을것/<차례>/)을 읽어 더합니다 —
   지문(sha256)이 맞는 파일만 들어갑니다. 사용 허락은 Codex 표에 「미확인」이고, 세중님이 쓰기로 정하셨습니다(11/23).

   ★ 화면이 기관을 **이름**으로 찾습니다 — job_one 이 기관번호를 화면에 내려주지 않고, 병원 화면(/orgs?org=)도 이름으로 엽니다.
     그래서 줄마다 「이름들」에 그 기관번호의 공고에 실제로 쓰인 이름을 넣습니다(운영 DB 에서 읽어 확인 ·
     같은 이름이 다른 기관번호에도 쓰이면 넣지 않습니다). 모르는 이름이면 사진이 안 붙을 뿐 — 엉뚱한 병원에 붙지는 않습니다.
     기관번호로 잇기는 DB 바꾸기라 세중님 승인 자리입니다. */

import 표 from './org-photos.json';

type 출처 = { 출처글: string; 출처주소: string };
type 그림 = { 파일: string; sha256: string } & 출처;

export type 기관사진 = {
  기관번호: string;
  ref?: string;
  이름들: string[];
  /* 사진을 붙일 직군 — null 이면 그 기관 모든 공고 (11/23 세중님 「모든 공고에」 — 기본은 null) */
  직군: string | null;
  설명: string;
  배경: 그림;
  로고: 그림 | null;
  넣은날?: string;
};

const 사진표 = 표 as 기관사진[];
const 자리 = '/org-photos/';

export function 사진주소(s: 기관사진): string {
  return 자리 + s.배경.파일;
}

/** 기관 마크 주소 — 없으면 null (화면은 원래 기본 그림) */
export function 로고주소(s: 기관사진 | null): string | null {
  return s?.로고 ? 자리 + s.로고.파일 : null;
}

/** 맨 아래 출처 줄 — 「사진 출처 · …」「로고 출처 · …」 */
export function 출처들(s: 기관사진): { 말: string; 글: string; 주소: string }[] {
  return [
    { 말: '사진', 글: s.배경.출처글, 주소: s.배경.출처주소 },
    ...(s.로고 ? [{ 말: '로고', 글: s.로고.출처글, 주소: s.로고.출처주소 }] : []),
  ];
}

/** 병원 화면(/orgs?org=이름) — 이름이 글자까지 같은 곳만 */
export function 기관사진찾기(이름: string | null | undefined): 기관사진 | null {
  if (!이름) return null;
  return 사진표.find((s) => s.이름들.includes(이름)) ?? null;
}

/** 공고 상세 — 기관 이름이 같고, 직군을 정해 둔 줄이면 그 직군 공고만 */
export function 공고사진찾기(기관이름: string | null | undefined, 직군: string | null | undefined): 기관사진 | null {
  const s = 기관사진찾기(기관이름);
  if (!s) return null;
  return s.직군 == null || s.직군 === 직군 ? s : null;
}
