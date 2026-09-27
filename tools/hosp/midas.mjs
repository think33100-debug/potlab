/* 마이다스 채용사이트(*.recruiter.co.kr) 에서 공고 목록을 받습니다 (2026-09-27).
 *
 *   node tools/hosp/midas.mjs cnuh            한 곳
 *   node tools/hosp/midas.mjs cnuh dbhosp     여러 곳
 *
 * ── 구형과 신형이 있습니다 ───────────────────────────────────
 *   구형  /appsite/company/index    → **POST /appsite/company/getMainView** 가 JSON 을 줍니다
 *   신형  /career/...               → Next.js(jobflex). 아직 못 풀었습니다 (아래)
 *
 * ── 구형을 어떻게 알았나 ─────────────────────────────────────
 * **짐작이 아닙니다.** gas 의 서울특별시 동부병원 note 에 이미 적혀 있었습니다 —
 *   「index 의 hidden id=appsiteSn 1900 · settingType C.
 *     getMainView JSON 의 jobnoticeInProgressList 에
 *     applyStartDate/applyEndDate/receiptState 있음」
 * 그걸 그대로 따라가니 빛고을전남대(appsiteSn 4978)에서 82,953바이트 JSON 이
 * 왔고 공고 6건이 들어 있었습니다.
 *
 * ── 신형(jobflex)은 일곱 번 두드려 다 404 였습니다 ───────────
 * 번들 31개(2.7MB)를 훑어 `/position/v1/jobflex` 같은 경로를 찾아냈지만
 * `/api/...` 를 붙여도 붙이지 않아도 NoHandlerFoundException 입니다.
 * 그래서 멈추고, **브라우저가 실제로 부르는 주소를 받아 적는** 쪽으로 갔습니다
 * (`probe-browser.mjs` 가 JSON 응답을 전부 적습니다).
 *
 * ── 공용 사이트 가르기 ───────────────────────────────────────
 * 한 appsite 에 여러 병원 공고가 같이 옵니다. **제목에 병원 이름이 들어 있습니다** —
 *   「2026년 9월 **전남대학교병원** 직원(지원직) 공개채용 공고」
 *   「2026년 8월 **화순전남대학교병원** 직원(대체근로자) 공개채용 공고」
 * 그래서 한 번 받아 제목으로 나눠 붙입니다.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0';

/** 구형 appsite 에서 { appsiteSn, settingType } 를 읽습니다 */
export async function 자리번호(호스트) {
  const u = 'https://' + 호스트 + '.recruiter.co.kr/appsite/company/index';
  const h = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
  const sn = (h.match(/id=["']appsiteSn["'][^>]*value=["'](\d+)/)
    || h.match(/appsiteSn["']?\s*[:=]\s*["']?(\d+)/) || [])[1];
  const st = (h.match(/settingType["'][^>]*value=["']([A-Z])/) || [])[1] || 'C';
  return { sn, st, 쪽크기: h.length, 주소: u };
}

/** 구형 appsite 의 공고 목록. 못 받으면 { 왜 } */
export async function 목록(호스트) {
  const a = await 자리번호(호스트);
  if (!a.sn) return { 왜: '쪽에서 appsiteSn 을 못 찾았습니다 (신형일 수 있습니다)', ...a };
  const b = new URLSearchParams({ appsiteSn: a.sn, settingType: a.st });
  const r = await fetch('https://' + 호스트 + '.recruiter.co.kr/appsite/company/getMainView', {
    method: 'POST', body: b,
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'application/json', Referer: a.주소 } });
  const t = await r.text();
  if (!r.ok) return { 왜: 'HTTP ' + r.status + ' · ' + t.slice(0, 200), ...a };
  let j;
  try { j = JSON.parse(t); } catch { return { 왜: 'JSON 이 아닙니다 · 앞 200자 ' + t.slice(0, 200), ...a }; }
  /* 진행중 목록이 어느 칸에 있는지 이름이 판마다 다를 수 있어 훑어 찾습니다 */
  const 진행 = 찾기(j, (k) => /jobnoticeInProgressList|inProgressList/i.test(k));
  const 것들 = (진행 || []).map((x) => ({
    제목: String(x.jobnoticeName || x.noticeName || x.title || x.subject || '').trim(),
    부터: x.applyStartDate || x.receiptStartDate || '',
    까지: x.applyEndDate || x.receiptEndDate || '',
    상태: x.receiptState || x.state || '',
    번호: x.jobnoticeSn || x.sn || x.id || '',
  })).filter((x) => x.제목);
  return { ...a, 몸크기: t.length, 것들 };
}

/* 어느 칸에 있는지 몰라 나무를 훑습니다 */
function 찾기(o, 맞나, 깊이) {
  if (!o || typeof o !== 'object' || (깊이 || 0) > 6) return null;
  for (const [k, v] of Object.entries(o)) {
    if (맞나(k) && Array.isArray(v)) return v;
    const r = 찾기(v, 맞나, (깊이 || 0) + 1);
    if (r) return r;
  }
  return null;
}

if (process.argv[1] && process.argv[1].endsWith('midas.mjs')) {
  const 볼것 = process.argv.slice(2);
  if (!볼것.length) { console.log('쓰는 법 — node tools/hosp/midas.mjs cnuh dbhosp …'); process.exit(1); }
  for (const h of 볼것) {
    const r = await 목록(h);
    console.log('\n══ ' + h + '.recruiter.co.kr');
    if (r.왜) { console.log('   ✗ ' + r.왜); continue; }
    console.log('   appsiteSn ' + r.sn + ' · settingType ' + r.st + ' · JSON ' + r.몸크기 + '바이트');
    console.log('   진행중 공고 ' + r.것들.length + '건');
    r.것들.forEach((x, i) => console.log('     ' + (i + 1) + '. ' + x.제목.slice(0, 62)
      + '  ' + x.부터 + '~' + x.까지 + (x.상태 ? ' [' + x.상태 + ']' : '')));
    await new Promise((x) => setTimeout(x, 500));
  }
}
