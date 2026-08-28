/* ============================================================
 * flow6.js — 학생 3명 · 치료사 3명 전체 흐름
 * ------------------------------------------------------------
 * 흉내가 아니라 진짜로 돌립니다.
 *   서버 : Wage.gs 를 그대로 실행 (구글 시트만 메모리로 대체)
 *   화면 : pages/index.html 을 jsdom 으로 띄워 값을 넣고 제출을 누름
 *   병원 : 진짜 CSV 12,407행
 *
 * 쓰는 법:  node flow6.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { makeEnv, makeSheet, loadServer } = require('./gas_stub.js');

const ROOT = __dirname;
let pass = 0, fail = 0;
const cur = { who: '' };
const ok = m => { console.log('    ok   ' + m); pass++; };
const bad = m => { console.log('    FAIL [' + cur.who + '] ' + m); fail++; };
const hint = m => console.log('    주의 ' + m);
const head = m => console.log('\n' + m);

/* ---------- 시트 준비 ---------- */
function csv(file) {
  const txt = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, '');
  return txt.split(/\r?\n/).filter(l => l.trim()).map(l => {
    const out = []; let cell = '', q = false;
    for (const c of l) {
      if (c === '"') q = !q;
      else if (c === ',' && !q) { out.push(cell); cell = ''; }
      else cell += c;
    }
    out.push(cell);
    return out;
  });
}

const env = makeEnv({ fetch: () => JSON.stringify({ result: [] }) });
const hospCsv = csv('병원목록_2026_2Q.csv');
const regionCsv = csv('지역별기관수_2026_2Q.csv');
env.sheets['병원목록'] = makeSheet('병원목록', hospCsv);
env.sheets['지역기관수'] = makeSheet('지역기관수', regionCsv);

const SRV = loadServer(env, path.join(ROOT, 'Wage.gs'));
const H = SRV.HEADERS;
const col = n => H.indexOf(n);

env.sheets['급여데이터'] = makeSheet('급여데이터', [H.slice()]);
env.sheets['채용공고'] = makeSheet('채용공고',
  [['공고ID', '기관명', '제목', '고용형태', '근무지', '접수시작', '접수마감', '링크', '수집일']]);
env.sheets['알림설정'] = makeSheet('알림설정', [['닉네임', '메일', '종류', '등록일']]);
env.sheets['배너'] = makeSheet('배너', [['이미지', '제목', '설명', '버튼', '주소']]);
env.sheets['건의사항'] = makeSheet('건의사항', [['일시', '종류', '내용', '연락처']]);

head('[준비] 시트');
console.log('    병원 ' + (hospCsv.length - 1) + '행 / 지역 ' + (regionCsv.length - 1)
  + '행 / 서버 함수 ' + Object.keys(SRV.API).length + '개');

/* ---------- 화면 띄우기 ---------- */
const rawHtml = fs.readFileSync(path.join(ROOT, 'pages', 'index.html'), 'utf8');
const html = rawHtml.replace(/<script src="\/app\.js\?v=\d+"><\/script>/, '');
const dom = new JSDOM(html, {
  url: 'https://potjob.co.kr/', runScripts: 'dangerously',
  pretendToBeVisual: true, virtualConsole: new VirtualConsole()
});
const win = dom.window;

/* 화면이 부르는 서버 함수를 진짜 Wage.gs 에 연결합니다 */
const calls = [];
function makeRun(okFn, errFn) {
  const r = {
    withSuccessHandler: f => makeRun(f, errFn),
    withFailureHandler: f => makeRun(okFn, f)
  };
  Object.keys(SRV.API).forEach(name => {
    r[name] = function () {
      const args = Array.prototype.slice.call(arguments);
      calls.push(name);
      let res, err = null;
      try { res = SRV.API[name].apply(null, args); } catch (e) { err = e; }
      setTimeout(() => {
        if (err) { if (errFn) errFn(err); }
        else if (okFn) okFn(res);
      }, 0);
    };
  });
  return r;
}
win.google = { script: { run: makeRun(null, null), host: { close() {}, setHeight() {} } } };

const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let scriptErr = 0;
inline.forEach((s, i) => {
  try { win.eval(s); }
  catch (e) { console.log('    FAIL 화면 script #' + (i + 1) + ': ' + e.message); scriptErr++; fail++; }
});
head('[준비] 화면');
if (!scriptErr) ok('화면 스크립트 ' + inline.length + '개 실행됨');

const tick = n => new Promise(r => setTimeout(r, n || 15));
const $ = id => win.document.getElementById(id);
const txt = id => { const e = $(id); return e ? (e.textContent || '') : ''; };
const lastMsg = () => txt('msg');

/* 값을 넣습니다. 고르는 칸이면 실제 선택지에 있는지 먼저 확인합니다. */
function setv(id, v) {
  const e = $(id);
  if (!e) { bad('입력칸이 없습니다: ' + id); return false; }
  if (e.tagName === 'SELECT') {
    const opts = [...e.options].map(o => o.value);
    if (opts.indexOf(String(v)) < 0) {
      bad(id + ' 선택지에 없는 값 "' + v + '" — 있는 값: '
        + opts.filter(Boolean).slice(0, 5).join(' / '));
      return false;
    }
  }
  e.value = String(v);
  e.dispatchEvent(new win.Event('input', { bubbles: true }));
  e.dispatchEvent(new win.Event('change', { bubbles: true }));
  return true;
}

/* ---------- 기존 참여자 심기 ---------- */
/* 순위가 나오려면 같은 조건 3명이 먼저 있어야 합니다 (MIN_PEER_FOR_RANK=3) */
head('[준비] 기존 참여자 심기');
const seedPro = [
  ['기존가', 245, 2020, '재활병원', '경기·인천'],
  ['기존나', 262, 2020, '재활병원', '경기·인천'],
  ['기존다', 231, 2020, '재활병원', '경기·인천'],
  ['기존라', 288, 2020, '재활병원', '경기·인천'],
  ['기존마', 254, 2021, '요양병원', '서울'],
  ['기존바', 275, 2019, '재활병원', '경기·인천'],
  ['기존사', 240, 2020, '재활병원', '서울']
];
let seeded = 0;
seedPro.forEach(p => {
  const r = SRV.submitWage({
    role: '현직', nick: p[0], job: '작업치료사',
    startYear: p[2], curStartYear: p[2], region: p[4], hospitalType: p[3],
    employment: '정규직', salary: p[1], nightDuty: 2, dutyHours: 3,
    weekendWork: 1, weekendHours: 4, bonus: 200, birthYear: 1995,
    note: '', certs: [], courses: [], practice: [], career: []
  });
  if (r && r.ok) seeded++; else console.log('    심기 실패 ' + p[0] + ': ' + (r && r.message));
});
seeded === seedPro.length ? ok(seeded + '명 심었습니다')
                          : bad('심기 실패 ' + (seedPro.length - seeded) + '건');

const seedSpec = [
  ['스펙가', 4.1, 780, '수도권 4년제'], ['스펙나', 3.7, 700, '지방 4년제'],
  ['스펙다', 3.9, 820, '수도권 3년제'], ['스펙라', 3.4, 640, '지방 3년제']
];
seedSpec.forEach(s => {
  SRV.submitWage({
    role: '현직', nick: s[0], job: '작업치료사', startYear: 2021, curStartYear: 2021,
    region: '경기·인천', hospitalType: '재활병원', employment: '정규직', salary: 235,
    school: s[3], gpa: s[1], gpaMax: 4.5, toeic: s[2],
    certs: ['컴퓨터활용능력 2급'], courses: ['수부재활'],
    practice: [{ hospital: '분당서울대학교병원', months: 2 }], career: [],
    birthYear: 1996, note: ''
  });
});
ok('스펙 낸 현직 ' + seedSpec.length + '명 추가');

/* ---------- 시나리오 ---------- */
const PROS = [
  { who: '치료사① 경기 재활병원 6년차', role: '현직', nick: '검사현직1',
    startYear: 2020, curStartYear: 2020, region: '경기·인천', hospitalType: '재활병원',
    employment: '정규직', salary: 258, nightDuty: 3, dutyHours: 3,
    weekendWork: 2, weekendHours: 4, bonus: 300, birthYear: 1994, wantRank: true },
  { who: '치료사② 서울 요양병원 신입 · 상여 없음', role: '현직', nick: '검사현직2',
    startYear: 2026, curStartYear: 2026, region: '서울', hospitalType: '요양병원',
    employment: '계약직', salary: 205, nightDuty: 0, dutyHours: 0,
    weekendWork: 0, weekendHours: 0, bonus: 0, birthYear: 2001, wantRank: false },
  { who: '치료사③ 부산 종합병원 12년차 · 고액', role: '현직', nick: '검사현직3',
    startYear: 2014, curStartYear: 2019, region: '부산·울산·경남', hospitalType: '종합병원',
    employment: '정규직', salary: 342, nightDuty: 5, dutyHours: 4,
    weekendWork: 3, weekendHours: 6, bonus: 600, birthYear: 1988, wantRank: false }
];

const STUS = [
  { who: '학생① 수도권 4년제 4학년 · 고스펙', role: '학생', nick: '검사학생1',
    grade: '4학년', school: '수도권 4년제', gpa: 4.2, gpaMax: 4.5, toeic: 830,
    wantType: '대학병원', wantRegion: '서울', birthYear: 2002,
    certs: ['컴퓨터활용능력 1급', '한국사능력검정'],
    courses: ['수부재활', '연하재활', '인지재활'],
    practice: [{ hospital: '분당서울대학교병원', months: 2 },
               { hospital: '세브란스병원', months: 2 },
               { hospital: '보바스기념병원', months: 2 }] },
  { who: '학생② 지방 3년제 2학년 · 중간', role: '학생', nick: '검사학생2',
    grade: '2학년', school: '지방 3년제', gpa: 3.3, gpaMax: 4.5, toeic: 610,
    wantType: '재활병원', wantRegion: '경기·인천', birthYear: 2004,
    certs: ['운전면허'], courses: ['수부재활'],
    practice: [{ hospital: '보바스기념병원', months: 2 }] },
  { who: '학생③ 1학년 · 점수 거의 없음', role: '학생', nick: '검사학생3',
    grade: '1학년', school: '지방 3년제', gpa: 2.4, gpaMax: 4.5, toeic: '',
    wantType: '요양병원', wantRegion: '대구·경북', birthYear: 2006,
    certs: [], courses: [], practice: [] }
];

/* 다음 사람은 새로 들어온 사람입니다. 앞사람 값이 남지 않게 비웁니다. */
function clearForm() {
  ['nick', 'startYear', 'curStartYear', 'region', 'hospitalType', 'employment',
   'salary', 'nightDuty', 'dutyHours', 'weekendWork', 'weekendHours', 'bonus',
   'birthYear', 'note', 'grade', 'school', 'gpa', 'toeic', 'certEtc', 'courseEtc',
   'wantType', 'wantRegion'].forEach(id => { const e = $(id); if (e) e.value = ''; });
  if (win.picked) { win.picked.certs = []; win.picked.courses = []; }
  if (win.rows) { win.rows.practice = []; win.rows.career = []; }
}

/* 로그인 정보 — 서버는 닉네임과 이용 코드를 함께 봅니다 */
const credOf = (nick, id) => ({ nick: nick, code: SRV.VIEW_CODE, id: id, job: '작업치료사' });

/* 화면에 값을 채우고 제출을 누릅니다 */
async function fillAndSubmit(p) {
  cur.who = p.who;
  head('── ' + p.who);

  clearForm();
  win.setRole(p.role);
  await tick();
  win.role === p.role ? ok('역할 ' + p.role) : bad('역할이 ' + win.role);

  setv('nick', p.nick);

  const proKeys = ['startYear', 'curStartYear', 'region', 'hospitalType', 'employment',
                   'salary', 'nightDuty', 'dutyHours', 'weekendWork', 'weekendHours',
                   'bonus', 'birthYear'];
  const stuKeys = ['grade', 'school', 'gpa', 'gpaMax', 'toeic',
                   'wantType', 'wantRegion', 'birthYear'];
  (p.role === '현직' ? proKeys : stuKeys).forEach(k => {
    if (p[k] !== undefined) setv(k, p[k]);
  });

  if (p.role === '학생') {
    if (win.picked) {
      win.picked.certs = (p.certs || []).slice();
      win.picked.courses = (p.courses || []).slice();
    }
    if (win.rows) win.rows.practice = (p.practice || []).slice();
  }

  /* 필수값이 비면 막히는지 먼저 봅니다 */
  const keepNick = $('nick').value;
  const n0 = calls.filter(c => c === 'submitWage').length;
  $('nick').value = 'ㄱ';
  win.submit();
  await tick();
  calls.filter(c => c === 'submitWage').length === n0
    ? ok('닉네임 1자는 막힘 — "' + lastMsg() + '"')
    : bad('닉네임 1자가 통과했습니다');
  $('nick').value = keepNick;

  /* 진짜 제출 */
  const before = calls.filter(c => c === 'submitWage').length;
  win.submit();
  await tick(60);
  if (calls.filter(c => c === 'submitWage').length <= before) {
    bad('제출이 안 됐습니다 — 화면 메시지: "' + lastMsg() + '"');
    return null;
  }
  ok('제출됨');

  const row = env.sheets['급여데이터']._data.find(r => r[col('닉네임')] === p.nick);
  if (!row) { bad('시트에 없습니다 — 서버 거절: "' + lastMsg() + '"'); return null; }
  ok('시트에 저장됨');
  return row;
}

/* ---------- 실행 ---------- */
(async () => {
  head('════ 치료사 3명 ════');
  for (const p of PROS) {
    const row = await fillAndSubmit(p);
    if (!row) continue;

    const sal = Number(row[col('월실수령(만원)')]);
    sal === p.salary ? ok('실수령 ' + sal + '만원 그대로 기록')
                     : bad('실수령이 ' + sal + ' (넣은 값 ' + p.salary + ')');
    row[col('구분')] === '현직' ? ok('구분 현직') : bad('구분이 ' + row[col('구분')]);
    const id = row[col('제출ID')];

    await tick(40);
    txt('doneCode').indexOf(p.nick) > -1
      ? ok('완료 화면에 닉네임 표시')
      : bad('완료 화면 닉네임: "' + txt('doneCode') + '"');

    const pv = SRV.getPreview(p.nick, id);
    if (!pv || !pv.ok) bad('getPreview 실패');
    else if (pv.topPercent === null) {
      p.wantRank ? bad('동료 ' + pv.peerCount + '명인데 순위가 안 나옵니다')
                 : ok('동료 ' + pv.peerCount + '명 — 3명 미만이라 순위 감춤 (설계대로)');
    } else {
      const okRange = pv.topPercent >= 0 && pv.topPercent <= 100
                   && pv.rank >= 1 && pv.rank <= pv.peerCount;
      okRange ? ok('순위 상위 ' + pv.topPercent + '% · ' + pv.peerCount + '명 중 ' + pv.rank + '등')
              : bad('순위 값이 범위 밖: ' + JSON.stringify(pv).slice(0, 90));
    }

    const hr = SRV.getHourly(credOf(p.nick, id), id);
    if (hr && hr.ok) {
      const h = Math.round(hr.mine || 0);
      if (h <= 0) bad('시급이 0 이하: ' + h);
      else if (h < 5000 || h > 60000) bad('시급이 비현실적: ' + h.toLocaleString() + '원');
      else ok('시급 ' + h.toLocaleString() + '원 (기본 ' + hr.baseHours + '시간 + 추가 ' + hr.extraHours + '시간)');
    } else hint('시급 응답 없음: ' + (hr && hr.message));

    const mv = SRV.getMoveEstimate(credOf(p.nick, id));
    (mv && typeof mv === 'object') ? ok('이직 추정 응답 정상') : bad('이직 추정 실패');

    const cs = SRV.calcSalary({ mode: '월실수령', amount: p.salary, birthYear: p.birthYear });
    (cs && typeof cs === 'object') ? ok('연봉 계산기 응답 정상') : bad('연봉 계산기 실패');
  }

  head('════ 학생 3명 ════');
  for (const s of STUS) {
    const row = await fillAndSubmit(s);
    if (!row) continue;

    row[col('구분')] === '학생' ? ok('구분 학생') : bad('구분이 ' + row[col('구분')]);
    const sal = row[col('월실수령(만원)')];
    (!sal || Number(sal) === 0) ? ok('학생은 급여칸이 비어 있음')
                                : bad('학생인데 급여가 들어갔습니다: ' + sal);
    const id = row[col('제출ID')];

    const r = SRV.getStudentResult(credOf(s.nick, id), id);
    if (!r || !r.ok) { bad('getStudentResult 실패: ' + (r && r.message)); continue; }
    const sc = r.spec && r.spec.score;
    const gr = r.spec && (r.spec.tier || r.spec.grade);
    (typeof sc === 'number' && sc >= 0 && sc <= 100) ? ok('점수 ' + sc + '점')
                                                     : bad('점수가 이상합니다: ' + sc);
    gr ? ok('등급 ' + gr) : bad('등급 없음');
    s._score = sc; s._grade = gr;

    const card = SRV.getStudentCard(credOf(s.nick, id), id);
    (card && card.ok !== false) ? ok('결과 카드 생성됨')
                                : hint('결과 카드 응답: ' + JSON.stringify(card).slice(0, 60));
  }

  head('── 학생 점수 순서');
  cur.who = '학생 비교';
  const sc = STUS.map(s => s._score);
  if (sc.every(v => typeof v === 'number')) {
    (sc[0] > sc[1] && sc[1] > sc[2])
      ? ok('고스펙 ' + sc[0] + ' > 중간 ' + sc[1] + ' > 저스펙 ' + sc[2] + ' — 순서 맞음')
      : bad('점수 순서가 뒤집혔습니다: ' + sc.join(' / '));
    console.log('    등급: ' + STUS.map(s => s._grade).join(' / '));
  } else bad('점수를 못 구했습니다');

  /* ---------- 섞임·중복 ---------- */
  head('════ 섞임 검사 ════');
  cur.who = '전체';
  const all = env.sheets['급여데이터']._data.slice(1);
  const stuRows = all.filter(r => r[col('구분')] === '학생');
  const proRows = all.filter(r => r[col('구분')] === '현직');
  console.log('    현직 ' + proRows.length + '명 / 학생 ' + stuRows.length + '명 / 합계 ' + all.length);
  stuRows.length === 3 ? ok('학생 3명 모두 저장') : bad('학생이 ' + stuRows.length + '명');
  stuRows.every(r => !Number(r[col('월실수령(만원)')]))
    ? ok('학생 행에 급여 없음') : bad('급여가 들어간 학생 행 있음');
  proRows.every(r => Number(r[col('월실수령(만원)')]) > 0)
    ? ok('현직 행에 급여 모두 있음') : bad('급여 빈 현직 행 있음');

  const dupMap = {};
  all.forEach(r => { const n = r[col('닉네임')]; dupMap[n] = (dupMap[n] || 0) + 1; });
  const dups = Object.keys(dupMap).filter(k => dupMap[k] > 1);
  dups.length ? bad('닉네임 중복: ' + dups.join(' ')) : ok('닉네임 중복 없음');

  const st = SRV.getStats(credOf('검사현직1'), { job: '작업치료사' });
  if (st && st.ok) {
    const leak = STUS.some(s => JSON.stringify(st).indexOf(s.nick) > -1);
    leak ? bad('급여 통계에 학생이 섞였습니다') : ok('급여 통계에 학생 없음');
  } else hint('getStats 응답: ' + JSON.stringify(st).slice(0, 80));

  const again = SRV.submitWage({
    role: '현직', nick: '검사현직1', job: '작업치료사', startYear: 2020,
    curStartYear: 2020, region: '경기·인천', hospitalType: '재활병원',
    employment: '정규직', salary: 300
  });
  (again && !again.ok) ? ok('같은 닉네임 재제출 거부 — "' + again.message + '"')
                       : bad('같은 닉네임이 또 들어갔습니다');

  const low = SRV.submitWage({
    role: '현직', nick: '이상치낮음', job: '작업치료사', startYear: 2020,
    curStartYear: 2020, region: '서울', hospitalType: '재활병원',
    employment: '정규직', salary: 90
  });
  (low && !low.ok) ? ok('너무 낮은 금액 거부 — "' + low.message + '"')
                   : hint('90만원 통과 — 관리자 확인 대상으로 들어갑니다');

  /* ---------- 역할을 바꿨을 때 앞 값이 남는지 ---------- */
  /* 처음 화면은 '현직'입니다. 급여를 적다가 '학생'으로 바꾸면
     급여칸은 화면에서 숨겨질 뿐 값이 남습니다. 그대로 제출되는지 봅니다. */
  head('════ 역할 전환 검사 ════');
  cur.who = '역할 전환';
  clearForm();
  win.setRole('현직');
  await tick();
  setv('salary', 999);           // 현직인 줄 알고 급여를 적습니다
  setv('region', '서울');
  setv('startYear', 2020);
  setv('hospitalType', '재활병원');
  setv('employment', '정규직');

  win.setRole('학생');           // 도중에 학생으로 바꿉니다
  await tick();
  const payHidden = ($('cardPay').className || '').indexOf('hide') > -1;
  payHidden ? ok('급여 칸이 화면에서 숨겨짐') : bad('급여 칸이 그대로 보입니다');

  const salLeft = $('salary').value;
  if (salLeft) hint('숨겨졌지만 급여칸 값이 남아 있습니다: ' + salLeft);

  setv('nick', '전환검사');
  setv('grade', '3학년');
  setv('school', '지방 3년제');
  setv('gpa', 3.5);
  setv('wantType', '재활병원');
  win.submit();
  await tick(60);

  const swRow = env.sheets['급여데이터']._data.find(r => r[col('닉네임')] === '전환검사');
  if (!swRow) bad('전환 검사 제출이 안 됐습니다 — "' + lastMsg() + '"');
  else {
    swRow[col('구분')] === '학생' ? ok('구분은 학생으로 저장') : bad('구분이 ' + swRow[col('구분')]);
    const leftSal = Number(swRow[col('월실수령(만원)')]);
    if (leftSal > 0) {
      bad('학생 행에 앞서 적은 급여 ' + leftSal + '만원이 그대로 저장됩니다');
      /* 통계까지 오염되는지가 진짜 중요한 부분입니다 */
      const st2 = SRV.getStats(credOf('검사현직1'), { job: '작업치료사' });
      const dirty = JSON.stringify(st2).indexOf('전환검사') > -1;
      dirty ? bad('급여 통계까지 오염됩니다')
            : ok('다만 통계는 구분으로 걸러져 오염되지 않음 (proRows_ 가 학생 제외)');
    } else ok('학생 행에 급여가 남지 않음');

    /* 급여 말고 나머지 현직 항목도 안 따라왔는지 봅니다 */
    const leftovers = [['지역', '서울'], ['병원유형', '재활병원'],
                       ['고용형태', '정규직'], ['입사연도', '2020']];
    const stuck = leftovers.filter(x => String(swRow[col(x[0])] || '') === x[1]);
    stuck.length ? bad('학생 행에 남은 현직 값: ' + stuck.map(x => x[0]).join(' '))
                 : ok('지역·병원유형·고용형태·입사연도도 안 따라옴');

    /* 학생 본인 항목은 제대로 들어갔는지 */
    swRow[col('학년')] === '3학년' ? ok('학년은 정상 저장') : bad('학년이 ' + swRow[col('학년')]);
  }

  /* 되돌렸을 때 적어둔 값이 살아있는지 — 지우는 방식이면 여기서 걸립니다 */
  win.setRole('현직');
  await tick();
  $('salary').value === '999' ? ok('현직으로 되돌리면 적어둔 급여가 그대로 있음')
                              : bad('되돌렸더니 값이 사라졌습니다: "' + $('salary').value + '"');

  /* ---------- 병원·지역 ---------- */
  head('════ 병원·지역 ════');
  const hs = SRV.searchHospital(credOf('검사현직1'), '보바스');
  (hs && hs.ok && hs.rows && hs.rows.length)
    ? ok('병원 검색 ' + hs.rows.length + '건 — 첫 결과 ' + hs.rows[0].name)
    : bad('병원 검색 실패: ' + JSON.stringify(hs).slice(0, 80));

  if (hs && hs.rows && hs.rows.length) {
    /* 상세는 이름이 아니라 검색 결과의 번호(idx)를 넘깁니다 */
    const idx = hs.rows[0].idx !== undefined ? hs.rows[0].idx : hs.rows[0].i;
    const hd = SRV.hospitalDetail(credOf('검사현직1'), idx);
    if (hd && hd.ok) {
      ok('상세 — 작업 ' + hd.ot + ' · 물리 ' + hd.pt + ' · 병상 ' + hd.bed);
      /* 업무 강도는 직군별로 따로 나옵니다 */
      const d = hd.densityOT;
      if (d && d.label) {
        ok('업무 강도(작업) ' + d.score + '점 — ' + d.label);
        (d.score >= 0 && d.score <= 10) ? ok('점수가 0~10 안') : bad('점수 범위 밖: ' + d.score);
        const expect = d.score >= 6 ? '바쁜 편' : (d.score >= 3 ? null : null);
        if (expect && d.label !== expect) bad('점수 ' + d.score + '인데 판정이 ' + d.label);
      } else hint('업무 강도 없음 — 병상이 적거나 인원 신고가 없는 곳');
    } else bad('병원 상세 실패');
  }

  const cmp = SRV.compareHospitals(credOf('검사현직1'), '보바스기념병원', '세브란스병원', '작업치료사');
  (cmp && cmp.ok) ? ok('두 곳 비교 정상') : bad('비교 실패: ' + (cmp && cmp.message));

  const ro = SRV.regionOverview(credOf('검사현직1'));
  (ro && ro.ok) ? ok('지역 현황 정상') : bad('지역 현황 실패: ' + JSON.stringify(ro).slice(0, 80));

  /* ---------- 채용·알림 (이번에 고친 부분) ---------- */
  head('════ 채용·알림 ════');
  const jp = SRV.getJobPosts(credOf('검사현직1'), '작업치료사');
  jp ? ok('getJobPosts 응답 (' + ((jp.rows && jp.rows.length) || 0) + '건 — 시트가 비어 정상)')
     : bad('getJobPosts 응답 없음');
  const sn = SRV.saveNoti(credOf('검사현직1'), null, true, ['job', 'urgent']);
  (sn && sn.ok && sn.agreed) ? ok('알림 등록 — "' + sn.message + '"')
                             : bad('알림 등록 실패: ' + JSON.stringify(sn).slice(0, 80));
  /* 없는 종류를 넣으면 켜지면 안 됩니다 */
  const snBad = SRV.saveNoti(credOf('검사현직1'), null, true, ['없는종류']);
  (snBad && snBad.ok && !snBad.agreed) ? ok('없는 알림 종류는 무시하고 해제 — "' + snBad.message + '"')
                                       : bad('없는 종류가 등록됐습니다');
  SRV.saveNoti(credOf('검사현직1'), null, true, ['job']);
  const gn = SRV.getNoti(credOf('검사현직1'));
  gn ? ok('알림 조회 정상') : bad('알림 조회 실패');
  const bn = SRV.adminGetBanners('potjob-admin-9174');
  (bn && bn.ok) ? ok('배너 조회 정상') : bad('배너 조회 실패');
  const bnBad = SRV.adminGetBanners('틀린키');
  (bnBad && !bnBad.ok) ? ok('틀린 관리자 키 거부') : bad('틀린 키가 통과했습니다');

  console.log('\n' + '='.repeat(52));
  console.log(fail ? '실패 ' + fail + '건 / 통과 ' + pass + '건'
                   : '전부 통과 (' + pass + '건)');
  console.log('='.repeat(52));
  process.exit(fail ? 1 : 0);
})();
