/* global Response */
/* 클린아이 하루 한 번 — 자기점검 (2026-11-25). 네트워크 0 (fetch 를 가짜로 바꿉니다).
 *   node tools/클린아이하루1번.test.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const 기록 = path.join(fs.mkdtempSync(path.join(os.tmpdir(), '클린아이-')), '연것.json');
process.env.POTJOB_CLEANEYE_STATE = 기록;
const { 첨부받기, 열때인가, 오늘열었나, 못여는까닭, 클린아이주소인가, 자료없음인가, 목록못받음까닭 } = await import('./cleaneye-file.mjs');

let 탈 = 0; let 수 = 0;
const 봐 = (말, 됨) => { 수++; if (!됨) { 탈++; console.log('✗ ' + 말); } };
const KST = (날짜, 시각) => Date.parse(날짜 + 'T' + 시각 + ':00+09:00');
const 진짜지금 = Date.now;
const 시계 = (날짜, 시각) => { Date.now = () => KST(날짜, 시각); };

/* 창 */
봐('17:49 닫힘', !열때인가(KST('2026-11-25', '17:49')));
봐('17:50 열림', 열때인가(KST('2026-11-25', '17:50')));
봐('18:59 열림', 열때인가(KST('2026-11-25', '18:59')));
봐('19:00 닫힘', !열때인가(KST('2026-11-25', '19:00')));
봐('자정 닫힘', !열때인가(KST('2026-11-26', '00:10')));
봐('주소 가르기', 클린아이주소인가('https://job.cleaneye.go.kr/user/ypCareersData.do?idx=1')
  && !클린아이주소인가('https://apis.data.go.kr/B551982/openApiEmployInfo') && !클린아이주소인가(null));

/* 가짜 fetch */
let 부름 = [];
let 파일답 = () => new Response(Buffer.from('%PDF-1.4 가짜'), { status: 200 });
globalThis.fetch = async (u) => {
  부름.push(String(u));
  if (/FileDownload/.test(u)) return 파일답();
  return new Response("<a onclick=\"fn_FileDown('a.pdf','공고문.pdf','/x/')\">", { status: 200 });
};
const 쪽 = (n) => 'https://job.cleaneye.go.kr/user/ypCareersData.do?idx=' + n;

시계('2026-11-25', '10:00');
let r = await 첨부받기(쪽(1), { 다시: 0 });
봐('창 밖이면 요청 0 · 창밖 표시', r.창밖 === true && !r.buf && 부름.length === 0);

시계('2026-11-25', '17:51');
r = await 첨부받기(쪽(1), { 다시: 0 });
봐('창 안 첫 번째는 받음 (화면 + 파일 두 번)', !!r.buf && 부름.length === 2);
봐('연 것으로 적힘', 오늘열었나(쪽(1)));
r = await 첨부받기(쪽(1), { 다시: 0 });
봐('같은 날 두 번째는 요청 0', r.창밖 === true && 부름.length === 2);
봐('다른 공고는 받을 수 있음', 못여는까닭(쪽(2)) === '');

파일답 = () => new Response('다운로드 요청이 많습니다. 잠시 후 다시 시도해 주세요.', { status: 429 });
r = await 첨부받기(쪽(2), { 다시: 0 });
봐('429 는 넘침이고 연 것으로 안 적음', r.넘침 === true && !오늘열었나(쪽(2)));
파일답 = () => new Response(Buffer.from('%PDF-1.4 가짜'), { status: 200 });
r = await 첨부받기(쪽(2), { 다시: 0 });
봐('429 뒤 창 안에서 다시 받음', !!r.buf && 오늘열었나(쪽(2)));

시계('2026-11-26', '17:55');
봐('다음 날은 다시 열 수 있음', 못여는까닭(쪽(1)) === '');
fs.writeFileSync(기록, '{깨짐');
봐('기록이 깨졌으면 빈 것으로', 못여는까닭(쪽(1)) === '');

/* 부르는 쪽 — 글로 봅니다 */
const 읽 = (f) => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
봐('수집기 — 미룸은 판정을 안 남김', /a\.미룸\) \{ 셈\.미룸\+\+; return null; \}/.test(읽('collect-cleaneye.mjs')));
봐('수집기 — 전체도 새것만 엶', /옵션\.새것 && !옵션\.새것\.has\(id\)/.test(읽('collect-cleaneye.mjs')));
봐('되메우기 — 못 여는 공고는 볼 것에서 뺌', /\.filter\(지금열수있나\)/.test(읽('첨부되메우기.mjs')));
봐('없어진공고찾기 — 클린아이 화면을 안 엶', /!클린아이주소인가\(x\.url\)/.test(읽('없어진공고찾기.mjs')));

/* 목록 답 — 광주 원문(서버 로그) */
const 머리 = (c, m) => '<?xml version="1.0" encoding="UTF-8"?> <response> <openXmlEmployInfo-header> <resultCode>' + c
  + '</resultCode> <resultMsg>' + m + '</resultMsg> </openXmlEmployInfo-header> </response>';
봐('광주 원문은 자료 없음', 자료없음인가(머리('3', 'NONOTEXISTDATA_ERROR')));
봐('정상 답은 아님', !자료없음인가(머리('00', 'NORMAL_SERVICE')));
봐('다른 탈(22 한도)은 아님', !자료없음인가(머리('22', 'LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR')));
봐('코드 3 이어도 말이 다르면 아님', !자료없음인가(머리('3', 'UNKNOWN_ERROR')));
봐('빈 답은 아님', !자료없음인가('') && !자료없음인가(null));
봐('17곳 다 못 받으면 탈', !!목록못받음까닭({ 시도수: 17, 못받은시도: 17, 받은수: 0 }));
봐('17곳이 정상인데 모두 0건이어도 탈 (11/24 18:36)', !!목록못받음까닭({ 시도수: 17, 못받은시도: 0, 받은수: 0 }));
봐('한 곳 못 받은 것은 그대로 감', 목록못받음까닭({ 시도수: 17, 못받은시도: 1, 받은수: 400 }) === '');
봐('다 받으면 그대로 감', 목록못받음까닭({ 시도수: 17, 못받은시도: 0, 받은수: 430 }) === '');
봐('정찰은 전체 바퀴에서만', /if \(!dry && !순찰 && 받은번호전부\)/.test(읽('collect-cleaneye.mjs')));

Date.now = 진짜지금;
console.log((탈 ? '✗ ' + 탈 + '건 탈 · ' : '○ ') + (수 - 탈) + '/' + 수);
process.exit(탈 ? 1 : 0);
