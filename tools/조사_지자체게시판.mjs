/* 조사 — 시·군·구청 홈페이지에만 올라가는 보건소 치료사 공고가 얼마나 되나 (2026-09-30).
 *
 *   node tools/조사_지자체게시판.mjs
 *
 * **조사만 합니다.** 담지 않고, 수집기를 만들지도 않습니다.
 *
 * ── 왜 ───────────────────────────────────────────────────────
 * 나라일터 조사에서 본 것 — 보건소 공고는 제목에 직종을 안 씁니다.
 *   「결핵관리사업 기간제근로자 채용」 「지역사회중심재활사업 기간제근로자 채용」
 * 게다가 **나라일터에 안 올리고 시·군·구청 게시판에만** 올리는 곳이 있습니다.
 * 그런 공고가 얼마나 되는지 세어 보는 것이 이 조사입니다.
 *
 * ── 지킬 것 ──────────────────────────────────────────────────
 * · robots.txt 를 먼저 읽고 막힌 곳은 **안 긁습니다**
 * · 목록 화면만 봅니다. 상세는 안 엽니다
 * · 한 곳 볼 때마다 2초 쉽니다. 기관 사이트에 부담 주지 않게
 * · 못 읽은 곳은 [확인 안 됨] 으로 남깁니다. 짐작해 채우지 않습니다
 */
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const 쉼 = (ms) => new Promise((y) => setTimeout(y, ms));

/* 대도시 3 · 중소도시 4 · 군 3.
   주소는 **짐작하지 않고** 각 청 홈페이지에서 고시공고/채용공고 게시판을 찾아 적습니다.
   못 찾은 곳은 아래에서 [확인 안 됨] 으로 남깁니다. */
const 볼곳 = [
  { 갈래: '대도시', 이름: '서울 노원구', url: 'https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1013' },
  { 갈래: '대도시', 이름: '부산 해운대구', url: 'https://www.haeundae.go.kr/board/list.do?boardId=BBS_0000027&menuCd=DOM_000000102001001000' },
  { 갈래: '대도시', 이름: '대구 달서구', url: 'https://www.dalseo.daegu.kr/pages/board/list.do?bbsId=BBS_00014' },
  { 갈래: '중소도시', 이름: '경기 김포시', url: 'https://www.gimpo.go.kr/portal/selectBbsNttList.do?bbsNo=39&key=2216' },
  { 갈래: '중소도시', 이름: '충북 제천시', url: 'https://www.jecheon.go.kr/www/selectBbsNttList.do?bbsNo=53&key=282' },
  { 갈래: '중소도시', 이름: '전북 익산시', url: 'https://www.iksan.go.kr/index.iksan?menuCd=DOM_000000104001001000' },
  { 갈래: '중소도시', 이름: '경남 통영시', url: 'https://www.tongyeong.go.kr/board.web?cmd=list&board_id=BBS_0000023' },
  { 갈래: '군', 이름: '전남 고흥군', url: 'https://www.goheung.go.kr/board/list.goheung?boardId=BBS_0000006' },
  { 갈래: '군', 이름: '경북 예천군', url: 'https://www.ycg.kr/open.content/ko/notice/notice.public/' },
  { 갈래: '군', 이름: '강원 정선군', url: 'https://www.jeongseon.go.kr/portal/bbs/list/B0000030.do?menuNo=200311' },
];

/** robots.txt 를 읽어 그 길이 막혀 있나 봅니다 */
async function robots확인(url) {
  try {
    const u = new URL(url);
    const r = await fetch(u.origin + '/robots.txt', { headers: { 'User-Agent': UA } });
    if (!r.ok) return { 됨: true, 왜: 'robots.txt 없음 (HTTP ' + r.status + ')' };
    const t = await r.text();
    /* User-agent: * 아래의 Disallow 만 봅니다 */
    const 덩 = t.split(/user-agent\s*:/i).find((x) => /^\s*\*/.test(x)) || '';
    const 막힌길 = [...덩.matchAll(/disallow\s*:\s*(\S*)/gi)].map((m) => m[1]).filter(Boolean);
    if (막힌길.includes('/')) return { 됨: false, 왜: 'robots.txt 가 전체를 막았습니다' };
    const 걸림 = 막힌길.find((p) => p !== '/' && u.pathname.startsWith(p));
    if (걸림) return { 됨: false, 왜: 'robots.txt 가 ' + 걸림 + ' 를 막았습니다' };
    return { 됨: true, 왜: '막힌 길 ' + 막힌길.length + '개 · 이 길은 안 막힘' };
  } catch (e) { return { 됨: false, 왜: 'robots.txt 를 못 읽음 · ' + String(e.message).slice(0, 50) }; }
}

/* 우리 직군 공고로 볼 말 */
const 우리말 = /물리치료사|작업치료사|물리치료|작업치료/;
/* 보건소 공고에 직종이 안 적힌 경우 — 이런 말이 있으면 「열어봐야 알 것」 */
const 어쩌면 = /지역사회중심재활|재활사업|치매안심|방문건강|통합돌봄|건강증진|보건소.*기간제|재활\s*운동/;

const 결과 = [];
console.log('시·군·구청 고시공고 게시판 조사 — ' + new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
console.log('목록 화면만 봅니다. 상세는 안 엽니다. 한 곳마다 2초 쉽니다.\n');

for (const 곳 of 볼곳) {
  const r = await robots확인(곳.url);
  if (!r.됨) {
    결과.push({ ...곳, 상태: '안 긁음', 왜: r.왜, 우리것: 0, 어쩌면: 0 });
    console.log('⏭  ' + 곳.이름.padEnd(12) + '안 긁음 — ' + r.왜);
    await 쉼(2000);
    continue;
  }
  let code = 0, 글 = '';
  try {
    const res = await fetch(곳.url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    code = res.status; 글 = await res.text();
  } catch (e) {
    결과.push({ ...곳, 상태: '[확인 안 됨]', 왜: String(e.message).slice(0, 60), 우리것: 0, 어쩌면: 0 });
    console.log('✗  ' + 곳.이름.padEnd(12) + '[확인 안 됨] — ' + String(e.message).slice(0, 50));
    await 쉼(2000);
    continue;
  }
  if (code !== 200 || 글.length < 500) {
    결과.push({ ...곳, 상태: '[확인 안 됨]', 왜: 'HTTP ' + code + ' · ' + 글.length + '바이트',
      우리것: 0, 어쩌면: 0, 원문: 글.replace(/\s+/g, ' ').slice(0, 300) });
    console.log('✗  ' + 곳.이름.padEnd(12) + '[확인 안 됨] — HTTP ' + code + ' · ' + 글.length + '바이트');
    await 쉼(2000);
    continue;
  }
  const 글자 = 글.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
  const 우리것 = [...글자.matchAll(우리말)].length;
  const 어쩌면수 = [...글자.matchAll(어쩌면)].length;
  /* 걸린 말 둘레를 조금 보여 줍니다 */
  const 보기 = [];
  for (const m of 글자.matchAll(우리말)) {
    보기.push(글자.slice(Math.max(0, m.index - 40), m.index + 40).trim());
    if (보기.length >= 2) break;
  }
  결과.push({ ...곳, 상태: '읽음', 왜: r.왜, 바이트: 글.length, 우리것, 어쩌면: 어쩌면수, 보기 });
  console.log('○  ' + 곳.이름.padEnd(12) + '읽음 ' + String(글.length).padStart(7) + '바이트 · '
    + '우리 직군 낱말 ' + 우리것 + ' · 열어봐야 할 말 ' + 어쩌면수);
  보기.forEach((b) => console.log('      「' + b.slice(0, 76) + '」'));
  await 쉼(2000);
}

console.log('\n── 모아 보기 ──');
const 읽음 = 결과.filter((x) => x.상태 === '읽음');
console.log('  본 곳 ' + 볼곳.length + ' · 읽음 ' + 읽음.length
  + ' · robots 로 안 긁음 ' + 결과.filter((x) => x.상태 === '안 긁음').length
  + ' · [확인 안 됨] ' + 결과.filter((x) => x.상태 === '[확인 안 됨]').length);
console.log('  우리 직군 낱말이 보인 곳 ' + 읽음.filter((x) => x.우리것).length + '곳');
console.log('  열어봐야 할 말이 보인 곳 ' + 읽음.filter((x) => x.어쩌면).length + '곳');

fs.writeFileSync('tools/hosp/reports/지자체게시판조사.json',
  JSON.stringify({ 본때: new Date().toISOString(), 결과 }, null, 1) + '\n');
console.log('\n  자세한 것은 tools/hosp/reports/지자체게시판조사.json 에 남겼습니다');
