/* 고용24(JobFlex) 응답 원문 확인 — 2026-10-05.
 *
 *  왜 — job_posts 의 근무지 칸(work_place)에 「비정규직」·「정규직」·「수시」가
 *  들어가 있습니다. 지역이 아닙니다. 어느 항목이 무엇인지 **주석 말고
 *  응답 원문으로** 확인하고 고쳐야 합니다 (작업지침 2·5번).
 *
 *  ⚷ 열쇠가 없는 공개 API 입니다. 읽기만 하고 DB 에 아무것도 안 씁니다.
 *
 *  쓰는 법   node tools/고용24_꼬리표_확인.mjs
 */
const API = 'https://api-recruiter.recruiter.co.kr/position/v1/jobflex';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* 실제로 탈이 난 세 곳입니다 (job_posts 에서 뽑았습니다) */
const 곳들 = [
  { 호스트: 'nhimc', 이름: '국민건강보험공단일산병원' },
  { 호스트: 'ish-recruiter', 이름: '가톨릭관동대학교 국제성모병원' },
  { 호스트: 'stcarollo', 이름: '성가롤로병원' },
];

async function 한쪽(호스트) {
  const 몸 = {
    pageableRq: { page: 1, size: 20, sort: ['CREATED_DATE_TIME'] },
    filter: { keyword: '', tagSnList: [], jobGroupSnList: [], careerTypeList: [],
      regionSnList: [], submissionStatusList: [], openStatusList: [], resumeLanguageTypeList: [] },
  };
  const r = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': UA,
      Referer: 'https://' + 호스트 + '.recruiter.co.kr/',
      prefix: 호스트 + '.recruiter.co.kr',
    },
    body: JSON.stringify(몸),
  });
  return { code: r.status, 글: await r.text() };
}

console.log('고용24(JobFlex) 응답 원문 확인 · '
  + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));

for (const 곳 of 곳들) {
  console.log('\n════════ ' + 곳.이름 + ' (' + 곳.호스트 + ') ════════');
  const r = await 한쪽(곳.호스트);
  console.log('HTTP ' + r.code + ' · ' + r.글.length + '자');
  if (r.code !== 200) { console.log(r.글.slice(0, 400)); continue; }

  let j;
  try { j = JSON.parse(r.글); } catch (e) {
    console.log('JSON 이 아닙니다 — ' + r.글.slice(0, 400)); continue;
  }
  const 목록 = j?.list || j?.data?.list || [];
  console.log('공고 ' + 목록.length + '건');

  if (목록[0]) {
    console.log('\n── 한 건 원문 그대로 (앞 1,200자) ──');
    console.log(JSON.stringify(목록[0], null, 1).slice(0, 1200));
    console.log('\n   칸 이름 — ' + Object.keys(목록[0]).join(' · '));
  }

  console.log('\n── classificationCode · tagList · careerType 만 추려서 ──');
  for (const x of 목록.slice(0, 8)) {
    const tags = (x.tagList || []).map((t) => t.tagName).join(', ');
    console.log('   ' + String(x.positionSn).padEnd(8)
      + ' class=' + String(x.classificationCode || '(빈값)').padEnd(14)
      + ' tag=[' + tags + ']'
      + ' career=' + String(x.careerType || '(빈값)'));
    console.log('       제목 — ' + String(x.title || '').slice(0, 50));
  }

  /* 지역을 담은 칸이 따로 있나 — 있으면 그걸 써야 합니다 */
  const 지역칸 = 목록[0] ? Object.keys(목록[0])
    .filter((k) => /region|area|location|workplace|addr/i.test(k)) : [];
  console.log('\n   지역처럼 보이는 칸 — '
    + (지역칸.length ? 지역칸.map((k) => k + '=' + JSON.stringify(목록[0][k])).join(' · ')
                     : '**없음**'));
  await new Promise((f) => setTimeout(f, 600));
}
