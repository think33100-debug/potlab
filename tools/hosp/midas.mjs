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

/* 'cnuh' 도 'https://cnuh.recruiter.co.kr' 도 받습니다 (수집기 설정은 host 가 주소 꼴) */
const 뿌리 = (호스트) => (/^https?:\/\//.test(String(호스트))
  ? String(호스트).replace(/\/+$/, '')
  : 'https://' + 호스트 + '.recruiter.co.kr');

/** 구형 appsite 에서 { appsiteSn, settingType } 를 읽습니다 */
export async function 자리번호(호스트) {
  const u = 뿌리(호스트) + '/appsite/company/index';
  const h = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
  const sn = (h.match(/id=["']appsiteSn["'][^>]*value=["'](\d+)/)
    || h.match(/appsiteSn["']?\s*[:=]\s*["']?(\d+)/) || [])[1];
  const st = (h.match(/settingType["'][^>]*value=["']([A-Z])/) || [])[1] || 'C';
  return { sn, st, 쪽크기: h.length, 주소: u };
}

/** 구형 appsite 의 진행중 목록 **원본 줄** (수집기 sites.mjs 가 씁니다 · 2026-11-11 Q86).
 *  둘 다 robots 가 허락한 `/appsite/` 아래입니다 — index(GET) → getMainView(POST).
 *  index 에서 번호를 못 읽으면 설정의 sn·settingType 을 씁니다 (`미리`).
 *  돌려주는 것 { 줄: [...], sn, st, 몸크기 } · 못 받으면 { 왜 }. 던지지 않습니다.
 *  ⚠ 진행중 목록은 **첫 화면 6칸**까지입니다 (hs_pages.mjs 머리 · 2026-09-27). */
export async function 진행중원본(호스트, 미리 = {}) {
  let a;
  try { a = await 자리번호(호스트); } catch (e) { a = { 주소: 뿌리(호스트) + '/appsite/company/index', 왜index: String(e && (e.cause?.code || e.message)).slice(0, 80) }; }
  const sn = a.sn || (미리.sn != null ? String(미리.sn) : '');
  const st = a.sn ? a.st : (미리.st || a.st || 'C');
  if (!sn) return { 왜: 'index 에서 appsiteSn 을 못 찾았고 설정에도 sn 이 없습니다' + (a.왜index ? ' · ' + a.왜index : '') };
  let r, t;
  try {
    r = await fetch(뿌리(호스트) + '/appsite/company/getMainView', {
      method: 'POST', body: new URLSearchParams({ appsiteSn: sn, settingType: st }),
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded',
        accept: 'application/json', Referer: a.주소 } });
    t = await r.text();
  } catch (e) { return { 왜: 'getMainView 못 받음 · ' + String(e && (e.cause?.code || e.message)).slice(0, 80) }; }
  if (!r.ok) return { 왜: 'getMainView HTTP ' + r.status + ' · ' + t.slice(0, 120) };
  let j;
  try { j = JSON.parse(t); } catch { return { 왜: 'getMainView 가 JSON 이 아닙니다 · 앞 120자 ' + t.slice(0, 120) }; }
  /* 진행중 목록이 어느 칸에 있는지 이름이 판마다 다를 수 있어 훑어 찾습니다 */
  const 진행 = 찾기(j, (k) => /jobnoticeInProgressList|inProgressList/i.test(k));
  if (!진행) return { 왜: 'getMainView 에 진행중 목록 칸이 없습니다 · 열쇠 ' + Object.keys(j).join(',').slice(0, 120) };
  return { 줄: 진행, sn, st, 몸크기: t.length };
}

/** 구형 appsite 의 공고 목록. 못 받으면 { 왜 } */
export async function 목록(호스트) {
  const m = await 진행중원본(호스트);
  if (m.왜) return { 왜: m.왜 };
  const 것들 = m.줄.map((x) => ({
    제목: String(x.jobnoticeName || x.noticeName || x.title || x.subject || '').trim(),
    부터: x.applyStartDate || x.receiptStartDate || '',
    까지: x.applyEndDate || x.receiptEndDate || '',
    상태: x.receiptState || x.state || '',
    번호: x.jobnoticeSn || x.sn || x.id || '',
  })).filter((x) => x.제목);
  return { sn: m.sn, st: m.st, 몸크기: m.몸크기, 것들 };
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
