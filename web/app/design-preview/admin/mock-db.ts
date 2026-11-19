'use client';

/* 관리자 미리보기 전용 가짜 DB — **개발 서버에서만** (2026-11-19 · 관리자 다시 입히기 캡처용).

   이 PC 는 DB 열쇠가 없어(.env 를 만들지 않습니다) 관리자 화면이 숫자 없이 「못 불러왔어요」로만 보입니다.
   새 모양을 숫자가 찬 채로 보려고, 이 모듈을 불러온 미리보기 화면에서만 브라우저 fetch 가
   Supabase 주소(/rest/v1/…)로 가는 것을 가로채 **지어낸 견본**을 돌려줍니다.
   ★ 견본 숫자는 진짜가 아닙니다 — 화면 모양을 보는 용도뿐입니다. 사람 이름은 넣지 않습니다.
   ★ 쓰기(insert·update·delete)는 모두 거절합니다 — 저장·동작 없는 시안입니다.
   배포(production)에서는 미리보기 화면 자체가 404 라 이 모듈이 불리지 않습니다. */

const 날들 = (n: number) => {
  const out: string[] = [];
  const 오늘 = new Date('2026-11-19T12:00:00+09:00');
  for (let i = n - 1; i >= 0; i--) out.push(new Date(오늘.getTime() - i * 864e5).toISOString().slice(0, 10));
  return out;
};

const 견본: Record<string, unknown> = {
  admin_stats_now: {
    today: '2026-11-19', members: 128, members_today: 4, members_week: 31,
    job_groups: { 물리치료사: 71, 작업치료사: 49, '안 정함': 8 },
    roles: { 임상: 76, 학생: 44, '안 정함': 8 },
    providers: { kakao: 93, 'custom:naver': 21, apple: 14 },
    jobs: 294, jobs_open: 281, jobs_today: 12, jobs_hold: 6,
    posts: 57, posts_today: 3, comments: 140, comments_today: 9, notify_on: 61, orgs: 58610,
    signup: { d1: { started: 6, done: 5 }, d7: { started: 40, done: 34 } },
  },
  admin_stats_daily: 날들(30).map((day, i) => ({ day, visits: 60 + Math.round(40 * Math.sin(i / 4)) + i * 3, views: 240 + i * 11, admin_visits: i % 5 === 0 ? 1 : 0 })),
  admin_stats_screens: [
    { kind: 'home', views: 1076, visits: 402 }, { kind: 'jobs', views: 781, visits: 333 },
    { kind: 'job', views: 512, visits: 210 }, { kind: 'community', views: 167, visits: 88 },
    { kind: 'orgs', views: 46, visits: 31 }, { kind: 'other', views: 40, visits: 22 },
  ],
  admin_stats_devices: [{ device: 'mobile', visits: 512, views: 2010 }, { device: 'desktop', visits: 133, views: 610 }],
  admin_stats_top_jobs: [
    { id: 'S1', title: '물리치료사 채용', org_name: '가온병원', views: 76, outs: 21 },
    { id: 'S2', title: '작업치료사 모집', org_name: '새봄의료원', views: 39, outs: 12 },
    { id: 'S3', title: '소아재활 치료사 모집', org_name: '다온대학교병원', views: 32, outs: 8 },
  ],
  admin_stats_top_posts: [
    { id: 1, title: '첫 출근 전에 챙길 것', channel: 'free', views: 41 },
    { id: 2, title: '연봉 협상 경험 나눠요', channel: 'free', views: 29 },
  ],
  admin_stats_shares: 날들(7).map((day, i) => ({ day, shares: 3 + i * 2, copies: 2 + i })),
  admin_stats_revisit: 날들(14).map((day, i) => ({
    day, first_browsers: 30 + i, back_browsers: 6 + (i % 4), back_done: i < 7,
    back_pct: i < 7 ? 20 + (i % 4) : null, d7_browsers: 2, d7_pct: i < 7 ? 6 : null,
  })),
  admin_광고배너: [
    { 자리: '앱', 이름: '견본 배너', 켜짐: true, 오늘봄: 210, 오늘누름: 9, 다봄: 2310, 다누름: 67 },
  ],
  커버리지: [
    { 갈래: '공공보건의료', 대상: 231, 들어온곳: 168, 퍼센트: 73, 분모인가: true, 어떻게: '기관마다 봅니다' },
    { 갈래: '상급종합', 대상: 47, 들어온곳: 44, 퍼센트: 94, 분모인가: true, 어떻게: '기관마다 봅니다' },
    { 갈래: '종합병원', 대상: 271, 들어온곳: 150, 퍼센트: 55, 분모인가: true, 어떻게: '기관마다 봅니다' },
    { 갈래: '치매안심센터', 대상: 256, 들어온곳: 12, 퍼센트: 5, 분모인가: false, 어떻게: '중앙 게시판 한 곳으로 모입니다 — 기관 수로 세지 않습니다' },
  ],
  admin_네숫자: {
    잰때: '2026-11-19T06:14:57Z', 회원화면: 294,
    신뢰셋: { '①마감지난공고가보임': 0, '②회원화면에틀린값': 5, '②잰날': '2026-11-19', '②표본': '워크넷 20 + 긁기 19', '③직군빈칸': 0, '③직군의심': 0, '③겹친것': 0 },
    '③일곱칸': { 접수마감: 99.3, 근무지: 98.6, 지원자격: 98.3, 모집인원: 98.0, 예상연봉: 94.6, 마감시각: 69.6, 바쁜정도: 52.0, 병원뜯어보기: 52.0, 마감시각_분모: 23, 마감시각_찬것: 16 },
  },
  admin_회원목록: Array.from({ length: 6 }, (_, i) => ({
    회원번호: String(10 + i).padStart(5, '0'), 닉네임: `견본회원${i + 1}`, 직군: i % 2 ? '작업치료사' : '물리치료사',
    역할: i % 3 ? '임상' : '학생', 가입일: `2026-11-${String(10 + i).padStart(2, '0')}`, 탈퇴일: null,
    글: i, 댓글: i * 2, 급여넣음: i % 2 === 0, 스펙넣음: false, 알림받음: true, 동의판: '2026-11-23', 동의시각: null, id: `00000000-0000-0000-0000-00000000000${i}`,
  })),
};

const 공고견본 = [
  { id: 'S1', source: 'WN', org_name: '가온병원', title: '물리치료사 채용', job_group: '물리치료사', hold: true, hidden: false, collected_at: '2026-11-19T01:00:00Z', evidence: { 보류사유: '모집 직군 확인 필요' }, tab: '병원', sido: '서울', sgg: '강서구', apply_to: '2026-11-24', url: 'https://example.org' },
  { id: 'S2', source: 'HS3', org_name: '새봄의료원', title: '작업치료사 모집', job_group: '작업치료사', hold: true, hidden: false, collected_at: '2026-11-18T03:00:00Z', evidence: { 보류사유: '접수 마감일 확인 필요' }, tab: '공공', sido: '경기', sgg: '수원시', apply_to: '2026-11-28', url: 'https://example.org' },
  { id: 'S3', source: 'WN', org_name: '다온대학교병원', title: '소아재활 치료사 모집', job_group: '물리치료사', hold: false, hidden: false, collected_at: '2026-11-18T02:00:00Z', evidence: {}, tab: '대학', sido: '대구', sgg: '중구', apply_to: '2026-12-01', url: 'https://example.org' },
];

function 응답(body: unknown, count?: number) {
  const n = Array.isArray(body) ? body.length : 1;
  const 전체 = count ?? n;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(0, n - 1)}/${전체}` },
  });
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production' && !(window as unknown as { __관리자견본?: boolean }).__관리자견본) {
  (window as unknown as { __관리자견본?: boolean }).__관리자견본 = true;
  const 원래 = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('/rest/v1/') && !url.includes('/auth/v1/') && !url.includes('/storage/v1/')) return 원래(input, init);
    const 방법 = (init?.method ?? 'GET').toUpperCase();
    const u = new URL(url);
    const 길 = decodeURIComponent(u.pathname.replace(/^.*\/rest\/v1\//, ''));
    if (url.includes('/auth/v1/')) return 응답({});
    if (길.startsWith('rpc/')) {
      const 이름 = 길.slice(4);
      return 이름 in 견본 ? 응답(견본[이름]) : 응답([]);
    }
    if (방법 !== 'GET' && 방법 !== 'HEAD') return new Response('{"message":"미리보기에서는 저장하지 않아요"}', { status: 405 });
    if (길 === 'admin_jobs') {
      const 보류만 = u.searchParams.get('hold') === 'eq.true';
      const 줄 = 보류만 ? 공고견본.filter((r) => r.hold) : 공고견본;
      return 응답(방법 === 'HEAD' ? null : 줄, 보류만 ? 6 : 294);
    }
    if (길 === 'reports') return 응답(null, 2);
    return 응답([], 0);
  };
}

export {};
