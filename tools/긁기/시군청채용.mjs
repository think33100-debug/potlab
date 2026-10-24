/* 시·구청 **채용 게시판** 시범 — 보건소 공고가 거기 있나 (2026-10-24 세중님 1번 ⓑ)
 *
 *   node tools/긁기/시군청채용.mjs --찾기          시청 뿌리를 열어 「채용」 링크 후보를 찍습니다
 *   node tools/긁기/시군청채용.mjs --읽기          --찾기 로 **확인한** 주소에서 30일치를 셉니다
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 보건소 전용 홈페이지(clinic.paju.go.kr)에는 채용 링크가 **없었습니다**. 구청 홈페이지
 * (www.ydp.go.kr)에는 **「채용정보」 메뉴**가 있었습니다. 그래서 「보건소는 시·구청
 * 게시판이 자리」로 보이는데, **짐작하지 않고 다섯 곳을 열어 세어 봅니다** (세중님 ⓑ).
 *
 * ── 울타리 ───────────────────────────────────────────────────
 *   robots 먼저 · 같은 집 3.5초(공통.mjs) · **주소는 열어서 확인한 것만** (지침 3절)
 *   담지 않습니다 — 이번 걸음은 **세기만** 합니다 (hold=true 로 담는 것은 세중님 결정 뒤)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 가도되나집, 받기, 자고 } from './공통.mjs';
import { 표준읽기, 줄안의날 } from './읽기들.mjs';
import { sortJob } from '../sort-rule.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);

/* ★ 다섯 곳 — **서로 다른 시도**이고 홈페이지를 우리가 아는 곳입니다
   (기관 표 홈페이지 · 2026-10-24 밤에 심평원·공공표에서 담은 것) */
export const 곳들 = [
  { 이름: '노원구보건소', 시도: '서울', 시군구: '노원구', 보건소: 'https://www.nowon.kr/www/index.do' },
  { 이름: '상록수보건소', 시도: '경기', 시군구: '안산상록구', 보건소: 'https://www.ansan.go.kr/snshealth/' },
  { 이름: '부산광역시영도구보건소', 시도: '부산', 시군구: '부산영도구', 보건소: 'https://www.yeongdo.go.kr/health.web' },
  { 이름: '고흥군보건소', 시도: '전남', 시군구: '고흥군', 보건소: 'http://goheung.go.kr/health/' },
  { 이름: '옥천군보건소', 시도: '충북', 시군구: '옥천군', 보건소: 'https://www.oc.go.kr/health/index.do' },
];

/** 링크 글자가 채용 자리를 가리키나 */
export const 채용말 = /(채용|구인|임용|일자리|인력\s*모집|직원\s*모집)/;
/** 그 공고가 보건 쪽인가 (제목·기관 이름으로) */
export const 보건말 = /(보건소|보건지소|보건의료원|치매안심|치매센터|정신건강|방문건강|건강증진)/;

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  보('채용말 — 채용정보', 채용말.test('채용정보'));
  보('채용말 — 임용시험', 채용말.test('임기제공무원 임용시험'));
  보('채용말 — 입찰은 아님', !채용말.test('입찰공고'));
  보('보건말 — 치매안심센터', 보건말.test('도봉구치매안심센터'));
  보('보건말 — 보건소', 보건말.test('서울특별시 강북구 보건소'));
  보('보건말 — 세무과는 아님', !보건말.test('세무과 기간제'));
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 찾은자리 = path.join(여기, '시군청채용_주소.json');

if (argv.includes('--찾기')) {
  const 낸것 = [];
  for (const 곳 of 곳들) {
    let 뿌리 = '';
    try { 뿌리 = new URL(곳.보건소).origin + '/'; } catch { continue; }
    console.log('\n■ ' + 곳.이름 + ' — ' + 뿌리);
    const 됨 = await 가도되나집(뿌리);
    if (!됨.됨) { console.log('  ✗ robots — ' + 됨.왜 + ' (두드리지 않습니다)'); continue; }
    const r = await 받기(뿌리);
    if (!r.됨) { console.log('  ✗ ' + r.왜); continue; }
    const 링크 = [...r.html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)]
      .map((m) => [m[1], m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()])
      .filter(([, t]) => 채용말.test(t) && !/입찰/.test(t));
    const 본것 = [];
    for (const [h, t] of 링크) {
      let 주소 = '';
      try { 주소 = new URL(h.replace(/&amp;/g, '&'), 뿌리).toString(); } catch { continue; }
      if (본것.some((x) => x.주소 === 주소)) continue;
      본것.push({ 글자: t.slice(0, 24), 주소 });
    }
    for (const x of 본것.slice(0, 8)) console.log('  · 「' + x.글자 + '」  ' + x.주소.slice(0, 78));
    console.log('  — 채용 링크 ' + 본것.length + '개');
    낸것.push({ ...곳, 뿌리, 후보: 본것.slice(0, 8) });
    await 자고(1200);
  }
  fs.writeFileSync(찾은자리, JSON.stringify({ 잰때: new Date().toISOString().slice(0, 16), 곳들: 낸것 }, null, 1) + '\n');
  console.log('\n○ ' + 찾은자리 + ' 에 적었습니다 (아무것도 담지 않았습니다)');
  process.exit(0);
}

if (!argv.includes('--읽기')) {
  console.error('쓰는 법 — --찾기 | --읽기 [--몇개 5] | --자기점검');
  process.exit(2);
}

/* ── 읽기 — --찾기 로 확인한 주소에서 30일치를 셉니다 ── */
if (!fs.existsSync(찾은자리)) { console.error('✗ 먼저 --찾기 로 주소를 확인하십시오'); process.exit(1); }
const 찾음 = JSON.parse(fs.readFileSync(찾은자리, 'utf8'));
const 서른날전 = new Date(Date.now() - 30 * 24 * 3600e3).toISOString().slice(0, 10);
console.log('30일 기준 — ' + 서른날전 + ' 이후\n');
const 표 = [];
for (const 곳 of 찾음.곳들) {
  for (const 후보 of 곳.후보 || []) {
    const 됨 = await 가도되나집(후보.주소);
    if (!됨.됨) { console.log('  ✗ ' + 곳.이름 + ' ' + 후보.글자 + ' — robots 금지'); continue; }
    const r = await 받기(후보.주소);
    await 자고(3500);
    if (!r.됨) { console.log('  ✗ ' + 곳.이름 + ' 「' + 후보.글자 + '」 — ' + r.왜); continue; }
    const 줄들 = 표준읽기(r.html, 후보.주소) || [];
    if (!줄들.length) { console.log('  · ' + 곳.이름 + ' 「' + 후보.글자 + '」 — 줄 0 (목록 꼴이 아닙니다)'); continue; }
    const 최근 = 줄들.filter((x) => (x.올린날 || 줄안의날(x.제목) || '') >= 서른날전);
    const 우리 = 최근.filter((x) => sortJob(x.제목, null, null).갈래 === '회원목록');
    const 보건 = 최근.filter((x) => 보건말.test(x.제목));
    console.log('  ○ ' + 곳.이름.padEnd(16) + '「' + 후보.글자.padEnd(12) + '」 줄 '
      + String(줄들.length).padStart(3) + ' · 30일 ' + String(최근.length).padStart(3)
      + ' · 우리 직군 ' + 우리.length + ' · 보건 쪽 ' + 보건.length);
    for (const x of 보건.slice(0, 3)) console.log('       보건 쪽 — ' + (x.올린날 || '날짜없음') + '  ' + x.제목.slice(0, 48));
    표.push({ 곳: 곳.이름, 시도: 곳.시도, 글자: 후보.글자, 주소: 후보.주소,
      줄: 줄들.length, 서른날: 최근.length, 우리직군: 우리.length, 보건쪽: 보건.length });
  }
}
console.log('\n── 셈 ──');
console.log('  읽은 게시판 ' + 표.length + '개 · 30일 줄 ' + 표.reduce((a, b) => a + b.서른날, 0)
  + ' · 우리 직군 ' + 표.reduce((a, b) => a + b.우리직군, 0)
  + ' · 보건 쪽 ' + 표.reduce((a, b) => a + b.보건쪽, 0));
fs.writeFileSync(path.join(여기, '..', '..', 'docs', '시군청채용_시범_1024.json'),
  JSON.stringify({ 잰때: new Date().toISOString().slice(0, 16), 서른날전, 표 }, null, 1) + '\n');
console.log('○ docs/시군청채용_시범_1024.json 에 적었습니다 (담지 않았습니다)');
