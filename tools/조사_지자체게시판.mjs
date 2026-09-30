/* 조사 — 시·군·구청 홈페이지에만 올라가는 보건소 치료사 공고가 얼마나 되나 (2026-09-30).
 *
 *   node tools/조사_지자체게시판.mjs
 *
 * **조사만 합니다.** 담지 않고, 수집기를 만들지도 않습니다.
 *
 * ── 주소를 짐작하지 않습니다 ─────────────────────────────────
 * 처음에 게시판 주소 10개를 제가 지어냈다가 다 틀렸습니다 (CLAUDE.md 3번).
 * 이제 **각 청 첫 화면을 열어 「고시공고 · 채용 · 공고」 가 든 링크를 찾아** 들어갑니다.
 * 못 찾으면 [확인 안 됨] 으로 남깁니다.
 *
 * ── 지킬 것 ──────────────────────────────────────────────────
 * · robots.txt 를 먼저 읽고 막힌 곳은 **안 긁습니다**
 * · 한 곳당 요청은 robots + 첫 화면 + 게시판 하나 = 최대 3번
 * · 한 번 볼 때마다 2초 쉽니다
 * · 짐작한 것은 [확인 안 됨] 으로 표시합니다
 */
import fs from 'node:fs';
import { robots읽기, 가도되나 } from './robots.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* 대도시 3 · 중소도시 4 · 군 3. **첫 화면 주소만** 적습니다 (이건 지어낸 것이 아닙니다) */
const 볼곳 = [
  { 갈래: '대도시', 이름: '서울 노원구', 집: 'https://www.nowon.kr' },
  { 갈래: '대도시', 이름: '부산 해운대구', 집: 'https://www.haeundae.go.kr' },
  { 갈래: '대도시', 이름: '대구 달서구', 집: 'https://www.dalseo.daegu.kr' },
  { 갈래: '중소도시', 이름: '경기 김포시', 집: 'https://www.gimpo.go.kr' },
  { 갈래: '중소도시', 이름: '충북 제천시', 집: 'https://www.jecheon.go.kr' },
  { 갈래: '중소도시', 이름: '전북 익산시', 집: 'https://www.iksan.go.kr' },
  { 갈래: '중소도시', 이름: '경남 통영시', 집: 'https://www.tongyeong.go.kr' },
  { 갈래: '군', 이름: '전남 고흥군', 집: 'https://www.goheung.go.kr' },
  { 갈래: '군', 이름: '경북 예천군', 집: 'https://www.ycg.kr' },
  { 갈래: '군', 이름: '강원 정선군', 집: 'https://www.jeongseon.go.kr' },
];

async function 받기(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    return { code: r.status, 글: await r.text(), 끝주소: r.url };
  } catch (e) { return { code: 0, 글: '', 왜: String(e.message).slice(0, 70) }; }
}

/* robots 해석은 tools/robots.mjs 한 곳에 있습니다.
   2026-09-30 에 여기서 직접 읽다가 다섯 곳 중 넷을 틀렸습니다 —
   주석(#)을 안 걸렀고 Allow 를 안 봤습니다 */
async function robots확인(집, 길) {
  const r = await 받기(집 + '/robots.txt');
  if (r.code !== 200 || !r.글) return { 됨: true, 왜: 'robots.txt 없음 (HTTP ' + r.code + ')' };
  return 가도되나(robots읽기(r.글), 길 || '/');
}

/** 첫 화면에서 고시공고·채용 게시판으로 보이는 링크를 찾습니다 */
function 게시판찾기(글, 집) {
  const 후보 = [];
  for (const m of 글.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    const 말 = m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!말) continue;
    let 점수 = 0;
    if (/고시\s*·?\s*공고|고시공고/.test(말)) 점수 += 3;
    if (/채용|구인|일자리/.test(말)) 점수 += 3;
    if (/공고|공지/.test(말)) 점수 += 1;
    if (/입찰|낙찰|수의계약/.test(말)) 점수 -= 3;
    if (점수 <= 0) continue;
    let u = m[1];
    if (u.startsWith('#') || /^javascript:/i.test(u)) continue;
    if (!/^https?:/i.test(u)) u = 집 + (u.startsWith('/') ? u : '/' + u);
    if (!u.startsWith(집)) continue;                 // 남의 사이트로 나가지 않습니다
    후보.push({ 점수, 말, u });
  }
  후보.sort((a, b) => b.점수 - a.점수);
  return 후보[0] || null;
}

const 우리말 = /물리치료사|작업치료사|물리치료|작업치료/g;
const 어쩌면 = /지역사회중심재활|재활사업|치매안심|방문건강|통합돌봄|건강증진|재활\s*운동/g;
const 글자만 = (h) => h.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');

const 결과 = [];
console.log('시·군·구청 고시공고 게시판 조사 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('첫 화면에서 게시판 링크를 찾아 들어갑니다. 주소는 짐작하지 않습니다.\n');

for (const 곳 of 볼곳) {
  const 한줄 = { ...곳 };
  const rb = await robots확인(곳.집);
  await 쉼(2000);
  if (!rb.됨) {
    결과.push({ ...한줄, 상태: '안 긁음', 왜: rb.왜 });
    console.log('⏭  ' + 곳.이름.padEnd(12) + '안 긁음 — ' + rb.왜);
    continue;
  }
  const 첫 = await 받기(곳.집);
  await 쉼(2000);
  if (첫.code !== 200 || 첫.글.length < 500) {
    결과.push({ ...한줄, 상태: '[확인 안 됨]', 왜: '첫 화면 HTTP ' + 첫.code + ' · ' + 첫.글.length + '바이트' });
    console.log('✗  ' + 곳.이름.padEnd(12) + '[확인 안 됨] — 첫 화면 HTTP ' + 첫.code);
    continue;
  }
  const 판 = 게시판찾기(첫.글, 곳.집);
  if (!판) {
    결과.push({ ...한줄, 상태: '[확인 안 됨]', 왜: '첫 화면에서 고시공고·채용 링크를 못 찾음' });
    console.log('✗  ' + 곳.이름.padEnd(12) + '[확인 안 됨] — 게시판 링크를 못 찾음');
    continue;
  }
  const 판글 = await 받기(판.u);
  await 쉼(2000);
  if (판글.code !== 200 || 판글.글.length < 500) {
    결과.push({ ...한줄, 상태: '[확인 안 됨]', 왜: '게시판 HTTP ' + 판글.code, 게시판: 판.말, 주소: 판.u });
    console.log('✗  ' + 곳.이름.padEnd(12) + '[확인 안 됨] — 「' + 판.말 + '」 HTTP ' + 판글.code);
    continue;
  }
  const t = 글자만(판글.글);
  const 우리것 = (t.match(우리말) || []).length;
  const 어쩌면수 = (t.match(어쩌면) || []).length;
  const 보기 = [];
  우리말.lastIndex = 0;
  for (const m of t.matchAll(우리말)) {
    보기.push(t.slice(Math.max(0, m.index - 45), m.index + 45).trim());
    if (보기.length >= 2) break;
  }
  결과.push({ ...한줄, 상태: '읽음', 게시판: 판.말, 주소: 판.u, 바이트: 판글.글.length, 우리것, 어쩌면: 어쩌면수, 보기 });
  console.log('○  ' + 곳.이름.padEnd(12) + '「' + 판.말.slice(0, 14).padEnd(16) + '」 '
    + String(판글.글.length).padStart(7) + '바이트 · 우리 직군 ' + 우리것 + ' · 열어봐야 할 말 ' + 어쩌면수);
  보기.forEach((b) => console.log('      「' + b.slice(0, 80) + '」'));
}

console.log('\n── 모아 보기 ──');
const 읽음 = 결과.filter((x) => x.상태 === '읽음');
console.log('  본 곳 ' + 볼곳.length + ' · 읽음 ' + 읽음.length
  + ' · robots 로 안 긁음 ' + 결과.filter((x) => x.상태 === '안 긁음').length
  + ' · [확인 안 됨] ' + 결과.filter((x) => x.상태 === '[확인 안 됨]').length);
console.log('  우리 직군 낱말이 보인 곳 ' + 읽음.filter((x) => x.우리것).length + '곳');
console.log('  열어봐야 할 말이 보인 곳 ' + 읽음.filter((x) => x.어쩌면).length + '곳');

try {
  fs.mkdirSync('tools/hosp/reports', { recursive: true });
  fs.writeFileSync('tools/hosp/reports/지자체게시판조사.json',
    JSON.stringify({ 본때: new Date().toISOString(), 결과 }, null, 1) + '\n');
  console.log('\n  자세한 것은 tools/hosp/reports/지자체게시판조사.json 에 남겼습니다');
} catch (e) { console.error('  보고서 못 남김 · ' + e.message); }
