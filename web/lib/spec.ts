/* 스펙쌓기 화면의 등급·문구. 점수 계산은 여기 없습니다 —
   DB 의 spec_parts() 한 곳에만 둡니다. 두 군데 두면 언젠가 어긋납니다.
   (node lib/spec.test.mjs)

   등급과 문구는 옛 앱 gas/wage.js studentScore_ 에서 옮겼습니다.
   말투만 「~있어요」 쪽으로 바꿨습니다. */

/* 배점 — DB 의 spec_parts() 와 같아야 합니다. 화면에 표로 보여주는 용도입니다 */
export const PART_MAX = {
  gpa: 60, lang: 15, certs: 10, school: 5, courses: 5, practice: 5,
} as const;

export type PartKey = keyof typeof PART_MAX;

export const PART_LABEL: Record<PartKey, string> = {
  gpa: '학점', lang: '어학', certs: '자격증',
  school: '학력', courses: '이수 교육', practice: '실습 · 경력',
};

export type Tier = { key: string; emoji: string; headline: string; comment: string; place: string };

export function tierOf(score: number): Tier {
  if (score >= 85) return {
    key: 'S', emoji: '🔥', headline: '취업 하이패스를 받았어요',
    comment: '톨게이트 안 서고 그냥 통과해요',
    place: '수도권 대학병원·공공기관까지 넣어볼 만해요' };
  if (score >= 70) return {
    key: 'A', emoji: '🎟️', headline: 'VIP석을 잡았어요',
    comment: '앞자리에서 편하게 갈 수 있어요',
    place: '지방 대학병원·수도권 종합병원을 노려볼 수 있어요' };
  if (score >= 55) return {
    key: 'B', emoji: '🎫', headline: '일반석을 잡았어요',
    comment: '자리는 잡았어요. 여기서부터가 중요해요',
    place: '재활병원·지방 종합병원은 무난하게 지원할 수 있어요' };
  if (score >= 40) return {
    key: 'C', emoji: '🧾', headline: '대기표를 뽑았어요',
    comment: '번호를 당기려면 몇 개만 더 채우면 돼요',
    place: '지금은 지역 병원 위주로 넣게 돼요' };
  return {
    key: 'D', emoji: '🎒', headline: '아직 출발 전이에요',
    comment: '시간은 충분해요. 하나씩 채우면 돼요',
    place: '한 항목만 채워도 위 등급으로 올라가요' };
}

/* 이미 채운 것 중 제일 잘한 것을 짚어 응원합니다 (옛 CHEER) */
const CHEER: Record<PartKey, string> = {
  gpa: '학점을 이만큼 만든 게 제일 커요',
  certs: '자격증 챙긴 게 눈에 띄어요',
  lang: '어학 점수까지 챙기셨네요',
  school: '학교에서 잘 버텨오셨어요',
  courses: '학회 교육까지 들은 건 흔치 않아요',
  practice: '실습 경험이 좋아요',
};

export function cheerOf(score: number, parts: Record<string, number>): string {
  if (score >= 85) return '더 채울 것도 없어요. 이제 면접만 준비하세요';
  let best: PartKey | null = null, rate = -1;
  for (const k of Object.keys(PART_MAX) as PartKey[]) {
    const v = parts[k] ?? 0;
    const r = v / PART_MAX[k];
    if (v > 0 && r > rate) { rate = r; best = k; }
  }
  return best ? `${CHEER[best]}. 이대로만 가면 돼요` : '이제 시작이니 하나씩 채워가면 돼요';
}

/* 남은 점수가 큰 칸부터 알려줍니다 — 어디를 채워야 제일 많이 오르는지 */
export function gaps(parts: Record<string, number>): { key: PartKey; left: number }[] {
  return (Object.keys(PART_MAX) as PartKey[])
    .map((k) => ({ key: k, left: PART_MAX[k] - (parts[k] ?? 0) }))
    .filter((x) => x.left > 0)
    .sort((a, b) => b.left - a.left);
}
