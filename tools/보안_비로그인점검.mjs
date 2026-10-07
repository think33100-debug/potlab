/* 오픈 전 보안 점검 — 비로그인(anon) 열쇠로 무엇이 새는지 (2026-10-07).
 *
 *   node tools/보안_비로그인점검.mjs
 *
 * ── 무엇을 하나 ──────────────────────────────────────────────
 * 브라우저에 나가는 anon 열쇠 하나만 들고, 회원·관리자 자료가 든 표와
 * 함수를 **하나씩** 두드립니다. 돌아온 HTTP 코드와 응답 앞머리를 적습니다.
 *
 * ── 안 하는 것 ───────────────────────────────────────────────
 * **자료를 바꾸는 함수는 부르지 않습니다.** 부르면 실제로 바뀝니다
 * (제목채우기 · hide_www_twins · rival_match_run 따위).
 * 그쪽은 DB 안에서 `set local role anon` + rollback 으로 따로 봤습니다.
 *
 * 열쇠 값은 어디에도 찍지 않습니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));

function env() {
  const out = {};
  for (const f of [path.join(여기, '..', '.env.local'), path.join(여기, '..', '.env'),
    path.join(여기, '..', 'web', '.env.local')]) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
  }
  Object.keys(process.env).forEach((k) => { if (process.env[k]) out[k] = process.env[k]; });
  out.SUPABASE_ANON_KEY = out.SUPABASE_ANON_KEY || out.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  out.SUPABASE_URL = out.SUPABASE_URL || out.NEXT_PUBLIC_SUPABASE_URL;
  return out;
}

const cfg = env();
if (!cfg.SUPABASE_ANON_KEY || !cfg.SUPABASE_URL) {
  console.error('SUPABASE_ANON_KEY · SUPABASE_URL 이 없습니다'); process.exit(1);
}
const 머리 = {
  apikey: cfg.SUPABASE_ANON_KEY,
  Authorization: 'Bearer ' + cfg.SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

/* 표 읽기 — 회원·관리자 자료가 든 곳을 먼저 씁니다 */
const 표 = [
  ['profiles',        '회원 — 닉네임·직군·학교'],
  ['admins',          '관리자 명단'],
  ['job_stars',       '회원이 찜한 공고'],
  ['org_stars',       '회원이 찜한 기관'],
  ['reports',         '커뮤니티 신고'],
  ['공고신고',         '공고 오류 신고 (오늘 만든 것)'],
  ['공고올림',         '추천 올림 기록 (오늘 만든 것)'],
  ['collect_secret',  '수집기 열쇠'],
  ['page_hits',       '누가 무엇을 봤나'],
  ['job_posts',       '공고 날것 (근거·점수까지)'],
  ['student_specs',   '회원 스펙'],
  ['salaries',        '회원 급여'],
  ['notifications',   '알림'],
  ['access_log',      '개인정보 접속기록'],
  ['posts',           '커뮤니티 글 (글쓴이 번호가 있음)'],
  ['comments',        '댓글'],
  ['post_likes',      '좋아요 (누가 눌렀나)'],
  ['site_settings',   '설정값'],
  ['collect_source',  '수집 경로'],
];

/* 함수 — 읽기만 하는 것들. 개인정보가 섞일 수 있는 것을 먼저 */
const 함수 = [
  ['lang_best',        { p_profile: '8c9a5cfa-e3d3-4426-aca5-37398bf2bd02' },
    '남의 회원번호로 어학 점수를 물어봅니다'],
  ['글쓴적있나',        { p_id: '8c9a5cfa-e3d3-4426-aca5-37398bf2bd02' },
    '그 회원이 글을 썼는지 물어봅니다'],
  ['닉네임잡혔나',      { p_nickname: '세중' }, '닉네임이 있는지 물어봅니다'],
  ['job_list',         {}, '공고 목록 (회원만이어야 함)'],
  ['job_one',          { p_id: 'HS1000689757' }, '공고 한 건 (본문은 회원만이어야 함)'],
  ['공개공고',          {}, '비로그인 맛보기 (열려 있는 것이 맞음)'],
  ['pay_stats',        {}, '급여 통계'],
  ['spec_stats',       {}, '스펙 통계'],
  ['lang_stats',       {}, '어학 통계'],
  ['rookie_salary',    { p_job: '작업치료사' }, '초임'],
  ['경쟁률찾기목록',     { p_쪽: 0 }, '경쟁률 — 숫자는 회원만이어야 함'],
  ['내프로필',          {}, '내 프로필 (로그인 필요여야 함)'],
  ['route_health',     {}, '관리자 진단 — 화면 건강'],
  ['api_quota_today',  {}, '관리자 진단 — 공공데이터 하루 한도'],
  ['pub_baseline_check', {}, '관리자 진단 — 공고 수 기준값'],
  ['admin_rival',      {}, '관리자 — 경쟁사 비교'],
  ['admin_api_quota',  {}, '관리자 — 한도 표'],
  ['admin_ocr_zero',   {}, '관리자 — PDF 0자'],
  ['admin_신고목록',    { p_처리전만: true, p_page: 0 }, '관리자 — 신고 목록'],
  ['admin_공고신고목록', { p_처리전만: true, p_page: 0 }, '관리자 — 공고 오류 신고'],
  ['admin_올린공고목록', { p_지난것: false }, '관리자 — 추천 올린 공고'],
  ['is_admin',         {}, '내가 관리자인가 (거짓이어야 함)'],
];

const 자르기 = (s, n = 200) => (s.length > n ? s.slice(0, n) + '…' : s);
let 샌것 = 0;

const 판정 = (코드, 글) => {
  if (코드 === 401 || 코드 === 403) return '○ 막힘';
  if (코드 >= 400) return '○ 거절(' + 코드 + ')';
  const 비었나 = glob비었나(글);
  if (비었나) return '○ 열리지만 빈 것';
  샌것++;
  return '★ 자료가 나옵니다';
};
const glob비었나 = (글) => {
  const t = (글 || '').trim();
  return t === '' || t === '[]' || t === 'null' || t === '{}' || t === '[null]';
};

console.log('비로그인(anon) 열쇠로 두드립니다. 열쇠 값은 찍지 않습니다.\n');
console.log('── 표 읽기 (GET /rest/v1/<표>?select=*&limit=1) ──');
for (const [t, 뜻] of 표) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + encodeURIComponent(t)
    + '?select=*&limit=1', { headers: 머리 });
  const 글 = await r.text();
  console.log('  ' + 판정(r.status, 글).padEnd(14) + t.padEnd(16) + 뜻);
  console.log('      HTTP ' + r.status + ' · ' + 자르기(글));
}

console.log('\n── 함수 (POST /rest/v1/rpc/<함수>) ──');
for (const [f, 몸, 뜻] of 함수) {
  const r = await fetch(cfg.SUPABASE_URL + '/rest/v1/rpc/' + encodeURIComponent(f),
    { method: 'POST', headers: 머리, body: JSON.stringify(몸) });
  const 글 = await r.text();
  console.log('  ' + 판정(r.status, 글).padEnd(14) + f.padEnd(22) + 뜻);
  console.log('      HTTP ' + r.status + ' · ' + 자르기(글));
}

console.log('\n── 자료가 나온 곳 ' + 샌것 + '개 ──');
console.log('※ 「자료가 나옵니다」 가 다 문제는 아닙니다 — 공개공고·통계·설정값은 일부러 엽니다.');
console.log('   개인정보(닉네임·회원번호·급여·스펙)가 섞였는지 위 응답 원문으로 보십시오.');
