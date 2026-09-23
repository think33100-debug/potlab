/* 스펙쌓기 화면의 등급·문구. 점수 계산은 여기 없습니다 —
   DB 의 spec_parts() 한 곳에만 둡니다. 두 군데 두면 언젠가 어긋납니다.
   (node lib/spec.test.mjs)

   등급과 문구는 옛 앱 gas/wage.js studentScore_ 에서 옮겼습니다.
   말투만 「~있어요」 쪽으로 바꿨습니다. */

/* 배점은 여기 없습니다. lib/spec-weights.ts 로 옮겼습니다 (2026-09-23).

   이 파일은 화면이 불러오는 파일이라, 여기 값을 두면 브라우저 번들에
   그대로 실립니다 — 화면에 안 그려도 개발자도구를 열면 읽힙니다.
   우리가 직접 만든 기준이라 밖으로 나가면 안 됩니다. */
export type PartKey =
  'gpa' | 'lang' | 'certs' | 'school' | 'courses' | 'practice';

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

/* 이미 채운 것 중 하나를 짚어 응원합니다 (옛 CHEER) */
const CHEER: Record<PartKey, string> = {
  gpa: '학점을 이만큼 만든 게 제일 커요',
  certs: '자격증 챙긴 게 눈에 띄어요',
  lang: '어학 점수까지 챙기셨네요',
  school: '학교에서 잘 버텨오셨어요',
  courses: '학회 교육까지 들은 건 흔치 않아요',
  practice: '실습 경험이 좋아요',
};

/* 칭찬할 차례. 흔치 않은 것부터 짚습니다.

   전에는 「배점 대비 제일 많이 채운 칸」을 골랐습니다. 그러려면 배점을
   화면 쪽에서 알아야 해서 값이 브라우저로 딸려 나갔습니다.
   지금은 채웠는지만 보고 이 차례대로 고릅니다 — 배점을 안 봅니다. */
const CHEER_ORDER: PartKey[] =
  ['practice', 'courses', 'certs', 'lang', 'gpa', 'school'];

export function cheerOf(score: number, parts: Record<string, number>): string {
  if (score >= 85) return '더 채울 것도 없어요. 이제 면접만 준비하세요';
  const best = CHEER_ORDER.find((k) => (parts[k] ?? 0) > 0) ?? null;
  return best ? `${CHEER[best]}. 이대로만 가면 돼요` : '이제 시작이니 하나씩 채워가면 돼요';
}

/* 다음에 챙기면 좋을 것 하나.

   전에는 「남은 점수가 큰 칸부터」 골랐습니다 (옛 gaps). 그러면 추천 순서가
   배점 순서 그대로라, 값을 몇 번만 바꿔 보면 어디에 몇 점이 걸렸는지
   드러납니다. 배점은 우리가 직접 만든 기준이라 밖으로 나가면 안 됩니다.

   그래서 배점을 아예 안 봅니다. 「지금 시작할 수 있는 것부터」라는
   손으로 정한 차례를 씁니다 — 아래 순서는 배점 순서와 일부러 다릅니다
   (배점은 학점이 제일 큰데 여기서는 뒤에서 두 번째입니다).

   채웠는지 안 채웠는지만 봅니다. 그 한 가지는 어쩔 수 없이 드러나지만,
   그건 학생 본인이 이미 아는 사실입니다.

   학력은 아예 안 권합니다 — 지금 와서 바꿀 수 있는 것이 아닙니다.
   ponytail: 또래와 견줘서 고르는 방법이 더 좋습니다. 현직·학생 스펙이
   쌓이면 그때 바꿉니다 (제안은 보고서에 적어 두었습니다). */
export const NEXT_ORDER: PartKey[] = ['lang', 'courses', 'certs', 'practice', 'gpa'];

export const NEXT_WHY: Record<PartKey, string> = {
  lang: '어학은 준비 기간이 기니 제일 먼저 시작하는 게 좋아요',
  courses: '학회 교육은 학기 중에도 들을 수 있어요',
  certs: '자격증은 방학 때 몰아서 딸 수 있어요',
  practice: '실습 나갈 곳을 미리 정해두면 선택지가 넓어져요',
  gpa: '남은 학기 학점이 아직 많이 남아 있어요',
  school: '',
};

/** 아직 안 채운 것 중 차례가 빠른 하나. 전부 채웠으면 null */
export function nextUp(parts: Record<string, number>): PartKey | null {
  return NEXT_ORDER.find((k) => (parts[k] ?? 0) <= 0) ?? null;
}

/* 화면에 보여줄 차례. 배점 순서가 아니라 읽기 좋은 순서입니다 —
   배점 순서대로 늘어놓으면 그것만으로도 무엇이 큰지 드러납니다 */
export const PART_ORDER: PartKey[] =
  ['gpa', 'lang', 'certs', 'courses', 'practice', 'school'];
