/* tools/수집기멈춤경보.mjs 회귀 — 메일을 **실제로 보낸 때만** 쉬는 기록이 남는가 (2026-11-04).
 *
 *   node tools/수집기멈춤경보_회귀.mjs
 *
 * ── 어떻게 ───────────────────────────────────────────────────
 * 원 도구의 소스를 읽어 import 줄만 떼고 새 VM 문맥에서 **실제 분기를 그대로** 돌립니다.
 * fs · 받아보기 · path · os · fileURLToPath · process · Date · fetch · console 은 전부
 * 합성 모의이고, 문맥에 그 밖의 전역이 없어 진짜 자원에 닿을 길이 없습니다.
 * 진짜 환경 파일 · 프로세스 환경값 · 파일 쓰기 · 메일 · RPC 0 입니다.
 * 이 파일이 진짜 fs 로 하는 일은 **원 도구 소스를 읽는 것 한 번**뿐입니다.
 *
 * 출력은 사례 이름과 합성 건수뿐입니다. 합성 열쇠 값도 찍지 않습니다.
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const 원본경로 = fileURLToPath(new URL('./수집기멈춤경보.mjs', import.meta.url));
const 기록파일 = '/합성집/경보기록.json';
const 이제 = 1_800_000_000_000;
const 시간 = 3600e3;

const 가짜열쇠 = ['합성-메일-열쇠', '합성-수집-열쇠', '합성-DB-열쇠'];
const 기본환경 = {
  RESEND_KEY: 가짜열쇠[0],
  NOTIFY_EMAIL: 'alarm@example.invalid',
  COLLECT_KEY_HS3: 가짜열쇠[1],
  SUPABASE_URL: 'https://db.example.invalid',
  SUPABASE_SERVICE_KEY: 가짜열쇠[2],
};
const 키빼기 = (...이름) => Object.fromEntries(
  Object.entries(기본환경).filter(([k]) => !이름.includes(k)));

const 늦은것 = (경로 = '합성수집기', 몇시간째 = 3) => ({ 경로, 왜: '합성 까닭', 몇시간째 });
const HTTP = (status, body = '{"id":"합성-응답"}') => async () => ({
  ok: status >= 200 && status < 300, status, text: async () => body,
});

/* 소스 원문에서 import 다섯 줄만 뗍니다. 줄 수가 달라지면 모의가 모자란 것이니 바로 멈춥니다 */
const 소스 = (() => {
  const 원문 = fs.readFileSync(원본경로, 'utf8');
  let 뗀수 = 0;
  const 본문 = 원문.replace(/^import\s[^;\n]*;[ \t]*$/gm, () => { 뗀수 += 1; return ''; });
  if (뗀수 !== 5 || /^\s*import[\s(]/m.test(본문)) throw new Error('원 도구의 import 꼴이 바뀌었습니다 — 모의를 다시 맞추십시오');
  return 본문.replaceAll('import.meta.url', '가짜메타주소');
})();
const 이름들 = ['fs', '받아보기', 'path', 'os', 'fileURLToPath', 'process', 'Date', 'fetch', 'console', '가짜메타주소'];
const 도구 = vm.runInNewContext('(async function (' + 이름들.join(', ') + ') {\n' + 소스 + '\n})',
  Object.create(null), { filename: '수집기멈춤경보.mjs(합성)' });

class 끝남 extends Error {
  constructor(코드) { super('process.exit'); this.코드 = 코드; }
}

/* 원 도구를 한 바퀴 돌립니다. 저장원문 — 합성 기록 파일의 처음 글 (없으면 null) */
async function 돌리기({ argv = [], env = 기본환경, 늦음 = [늦은것()], 저장원문 = null, 메일 = HTTP(200),
  쓰기실패 = false, 지금 = 이제 } = {}) {
  const 파일들 = new Map();
  if (저장원문 !== null) 파일들.set(기록파일, 저장원문);
  const 결과 = { 발송: 0, 기록: 0, 지움: 0, RPC: 0, 종료: null, 던짐: false, 딴데씀: 0, 출력: '', 메일요청: null };

  const 찍기 = (...글) => { 결과.출력 += 글.join(' ') + '\n'; };
  const 가짜fs = {
    existsSync: (f) => 파일들.has(f),
    readFileSync: (f) => {
      if (!파일들.has(f)) throw new Error('합성 ENOENT');
      return 파일들.get(f);
    },
    writeFileSync: (f, 글) => {
      if (f !== 기록파일) { 결과.딴데씀 += 1; return; }
      결과.기록 += 1;
      if (쓰기실패) throw new Error('합성 쓰기 실패');
      파일들.set(f, 글);
    },
    rmSync: (f) => { 결과.지움 += 1; 파일들.delete(f); },
  };
  const 가짜받아보기 = async () => {
    결과.RPC += 1;
    return { ok: true, status: 200, text: async () => JSON.stringify({ '늦은 수집기': 늦음 }) };
  };
  const 가짜fetch = async (주소, 설정) => {
    결과.발송 += 1;
    결과.메일요청 = { 주소, 설정 };
    return 메일();
  };

  try {
    await 도구(
      가짜fs,
      가짜받아보기,
      { dirname: () => '/합성저장소/tools', join: (...조각) => 조각.join('/') },
      { homedir: () => '/합성집' },
      () => '/합성저장소/tools/수집기멈춤경보.mjs',
      {
        env: { ...env },
        argv: ['node', '수집기멈춤경보.mjs', ...argv],
        exit: (코드) => { throw new 끝남(코드); },
      },
      { now: () => 지금 },
      가짜fetch,
      { log: 찍기, error: 찍기 },
      'file:///합성저장소/tools/수집기멈춤경보.mjs',
    );
  } catch (e) {
    if (e instanceof 끝남) 결과.종료 = e.코드;
    else 결과.던짐 = true;
  }
  결과.저장원문 = 파일들.has(기록파일) ? 파일들.get(기록파일) : null;
  결과.저장본 = 결과.저장원문 === null ? null : JSON.parse(결과.저장원문);
  return 결과;
}

/* 모든 사례가 발송·기록·exit·보존값을 함께 봅니다 */
function 확인(결과, 기대) {
  const 전체 = { RPC: 1, 지움: 0, 딴데씀: 0, 던짐: false, ...기대 };
  for (const k of Object.keys(전체)) {
    assert.deepEqual(결과[k], 전체[k], k + ' 기대 ' + JSON.stringify(전체[k]) + ' · 실제 ' + JSON.stringify(결과[k]));
  }
  for (const 열쇠 of 가짜열쇠) assert.ok(!결과.출력.includes(열쇠), '합성 열쇠가 콘솔 출력에 들어갔습니다');
}
const 있다 = (결과, 글) => assert.ok(결과.출력.includes(글), '콘솔 출력에 기대한 글이 없습니다');

const 앞기록 = (값) => JSON.stringify(값, null, 1) + '\n';

/* 설정이 없어 보내지 못한 공통 기대 — 메일0 · 기록0 · 상태 그대로 · 화면 안내 유지 */
async function 미설정사례(env) {
  const 저장원문 = 앞기록({ 다른수집기: 이제 - 100 * 시간 });
  const r = await 돌리기({ env, 저장원문 });
  확인(r, { 발송: 0, 기록: 0, 종료: null, 저장원문 });
  있다(r, '화면에만 찍습니다');
  있다(r, '제목: ');
  있다(r, '합성수집기 3시간째');
  있다(r, '쉬는 기록을 남기지 않았습니다');
}

const 사례 = [
  ['메일키·주소 모두 없음', () => 미설정사례(키빼기('RESEND_KEY', 'NOTIFY_EMAIL'))],
  ['메일키만 없음', () => 미설정사례(키빼기('RESEND_KEY'))],
  ['주소만 없음', () => 미설정사례(키빼기('NOTIFY_EMAIL'))],

  ['정상 200 — 기록 1', async () => {
    const r = await 돌리기();
    확인(r, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 } });
    assert.equal(r.메일요청.주소, 'https://api.resend.com/emails');
    assert.equal(r.메일요청.설정.headers.Authorization, 'Bearer ' + 가짜열쇠[0]);
    있다(r, '보냈습니다 — ');
  }],
  ['HTTP 500 — 기록 0', async () => {
    const 저장원문 = 앞기록({ 다른수집기: 이제 - 시간 });
    const r = await 돌리기({ 메일: HTTP(500, '합성 서버 오류'), 저장원문 });
    확인(r, { 발송: 1, 기록: 0, 종료: 1, 저장원문 });
    있다(r, 'HTTP 500');
  }],
  ['HTTP 429 — 기록 0', async () => {
    const 저장원문 = 앞기록({ 다른수집기: 이제 - 시간 });
    const r = await 돌리기({ 메일: HTTP(429, '합성 한도'), 저장원문 });
    확인(r, { 발송: 1, 기록: 0, 종료: 1, 저장원문 });
    있다(r, 'HTTP 429');
  }],
  ['메일 연결 throw — 기록 0', async () => {
    const 저장원문 = 앞기록({ 다른수집기: 이제 - 시간 });
    const r = await 돌리기({ 메일: async () => { throw new Error('합성 연결 실패'); }, 저장원문 });
    확인(r, { 발송: 1, 기록: 0, 종료: null, 던짐: true, 저장원문 });
  }],
  ['--보기 — 발송 0 · 기록 0', async () => {
    const r = await 돌리기({ argv: ['--보기'] });
    확인(r, { 발송: 0, 기록: 0, 종료: 0, 저장원문: null });
    있다(r, '제목: ');
  }],
  ['쿨다운 중 — 발송 0 · 기록 0', async () => {
    const 저장원문 = 앞기록({ 합성수집기: 이제 - 6 * 시간 + 1 });
    const r = await 돌리기({ 저장원문 });
    확인(r, { 발송: 0, 기록: 0, 종료: 0, 저장원문 });
    있다(r, '보낼 것이 없습니다');
  }],
  ['쿨다운 경계 6시간 — 다시 보냄', async () => {
    const r = await 돌리기({ 저장원문: 앞기록({ 합성수집기: 이제 - 6 * 시간 }) });
    확인(r, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 } });
  }],
  ['늦음 0 — 발송 0 · 기록 0', async () => {
    const r = await 돌리기({ 늦음: [] });
    확인(r, { 발송: 0, 기록: 0, 종료: 0, 저장원문: null });
  }],
  ['늦음이 기준 2시간 미만 — 발송 0 · 기록 0', async () => {
    const r = await 돌리기({ 늦음: [늦은것('합성수집기', 1)] });
    확인(r, { 발송: 0, 기록: 0, 종료: 0, 저장원문: null });
  }],
  ['기존 기록 보존 — 다른 키와 쉬는 중인 키 그대로', async () => {
    const 앞 = { 옛수집기: 이제 - 500 * 시간, 쉬는수집기: 이제 - 시간 };
    const r = await 돌리기({
      늦음: [늦은것('쉬는수집기'), 늦은것('합성수집기')], 저장원문: 앞기록(앞),
    });
    확인(r, { 발송: 1, 기록: 1, 종료: null, 저장본: { ...앞, 합성수집기: 이제 } });
    assert.ok(!JSON.parse(r.메일요청.설정.body).subject.includes('쉬는수집기'), '쉬는 수집기는 메일에 안 들어갑니다');
  }],
  ['메일 성공 뒤 기록 쓰기 실패 — 앞 상태 그대로', async () => {
    const 저장원문 = 앞기록({ 다른수집기: 이제 - 시간 });
    const r = await 돌리기({ 저장원문, 쓰기실패: true });
    확인(r, { 발송: 1, 기록: 1, 종료: null, 던짐: true, 저장원문 });
  }],
  ['같은 출처 쿨다운 — 성공 뒤 1시간 쉼 · 6시간 뒤 다시', async () => {
    const 첫 = await 돌리기();
    확인(첫, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 } });
    const 둘 = await 돌리기({ 저장원문: 첫.저장원문, 지금: 이제 + 시간 });
    확인(둘, { 발송: 0, 기록: 0, 종료: 0, 저장원문: 첫.저장원문 });
    const 셋 = await 돌리기({ 저장원문: 첫.저장원문, 지금: 이제 + 6 * 시간 });
    확인(셋, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 + 6 * 시간 } });
  }],
  ['설정 없던 다음 바퀴에 설정이 생기면 바로 보냄', async () => {
    const 앞 = await 돌리기({ env: 키빼기('RESEND_KEY') });
    확인(앞, { 발송: 0, 기록: 0, 종료: null, 저장원문: null });
    const 뒤 = await 돌리기({ 저장원문: 앞.저장원문, 지금: 이제 + 30 * 60e3 });
    확인(뒤, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 + 30 * 60e3 } });
  }],
  ['--시험 성공 — 가짜 줄만 기록 1', async () => {
    const r = await 돌리기({ argv: ['--시험'], 늦음: [] });
    확인(r, { 발송: 1, 기록: 1, 종료: null, 저장본: { '시험(가짜)': 이제 } });
    assert.ok(JSON.parse(r.메일요청.설정.body).subject.startsWith('[피오티잡 · 시험] '));
  }],
  ['--시험 설정 없음 — 기록 0', async () => {
    const r = await 돌리기({ argv: ['--시험'], 늦음: [], env: 키빼기('NOTIFY_EMAIL') });
    확인(r, { 발송: 0, 기록: 0, 종료: null, 저장원문: null });
  }],
  ['--잊기 — 기록을 비우고 끝남', async () => {
    const r = await 돌리기({ argv: ['--잊기'], 저장원문: 앞기록({ 합성수집기: 이제 }) });
    확인(r, { RPC: 0, 발송: 0, 기록: 0, 지움: 1, 종료: 0, 저장원문: null });
  }],
  ['200 응답에 id 없음 — 지금처럼 기록 1', async () => {
    const r = await 돌리기({ 메일: HTTP(200, '합성 비JSON') });
    확인(r, { 발송: 1, 기록: 1, 종료: null, 저장본: { 합성수집기: 이제 } });
    있다(r, '응답에 id 가 없습니다');
  }],
];

let 실패 = 0;
for (const [이름, 시험] of 사례) {
  try {
    await 시험();
    console.log('통과  ' + 이름);
  } catch (e) {
    실패 += 1;
    console.log('실패  ' + 이름 + ' — ' + String(e.message).split('\n')[0]);
  }
}
console.log('합성 사례 ' + 사례.length + '건 · 통과 ' + (사례.length - 실패) + ' · 실패 ' + 실패);
process.exitCode = 실패 ? 1 : 0;
