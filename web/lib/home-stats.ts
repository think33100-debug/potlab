/* 첫 화면이 브라우저로 넘기는 숫자.

   첫 화면 구역은 브라우저에서 도는 부품이라, 넘긴 값은 쪽 자료에 그대로 실립니다.
   그래서 쓰는 칸만 골라 담습니다. 응답의 나머지 칸(참여 수·연봉 값)은
   서버에서 끝나고 브라우저로 가지 않습니다. */
export type HomeStats = {
  hospitals: number;        // 심평원 병원 수
  ot: number;               // 작업치료사
  pt: number;               // 물리치료사
  hira_ver: string | null;  // 심평원 자료판. 화면에는 안 씁니다 — 분기 표기를 안 내보내기로 했습니다
  min_n: number;            // 안내 글에 적는 최소 인원
};

export function toPublicHomeStats(raw: unknown): HomeStats {
  const r = (raw ?? {}) as Partial<HomeStats>;
  return {
    hospitals: r.hospitals ?? 0,
    ot: r.ot ?? 0,
    pt: r.pt ?? 0,
    hira_ver: r.hira_ver ?? null,
    min_n: r.min_n ?? 3,
  };
}
