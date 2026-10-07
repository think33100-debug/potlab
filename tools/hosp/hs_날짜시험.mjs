/* HS 접수기간 읽기 — **붙이기 전 시험** (2026-10-07 세중님 지시)
 *
 *   node tools/hosp/hs_날짜시험.mjs            시험문제 9 + HS 20건
 *   node tools/hosp/hs_날짜시험.mjs --문제만     읽기_시험문제.md 의 아홉만
 *   node tools/hosp/hs_날짜시험.mjs --틀린것     틀린·못읽은 것의 원문도 찍습니다
 *
 * ── 왜 이 파일이 있나 ───────────────────────────────────────
 * `hsDetailDates_` 규칙이 옛 앱(Apps Script)에만 있고 수집기로 안 옮겨졌습니다.
 * 저장소의 tools/hosp/hs_dates.js 에 같은 규칙이 있는데 **아무도 안 부릅니다**
 * (첫 줄에 「시험기」라고 적혀 있습니다). 그래서 HS 출처 공고 313건의 마감일이
 * 비어 「수시채용」으로 떴습니다 — 공고읽기_오류조사_2026-10-07.md
 *
 * 붙이기 전에 **몇 건을 맞히는지** 먼저 재라는 지시입니다. 이 파일이 그 자리입니다.
 *
 * ── 수집기와 같은 길로 받습니다 ─────────────────────────────
 * hs_dates.js 자체의 fetch 는 utf-8 로 못 박혀 있어서 euc-kr 쪽을 빈손으로 냅니다
 * (강원대학교병원이 그랬습니다). 그래서 **수집기가 쓰는 글받기()** 로 받습니다 —
 * 그쪽은 Content-Type 과 앞 2,048바이트에서 charset 을 찾아 풀어 줍니다
 * (tools/certs/index.mjs:136).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 글받기 } from '../certs/index.mjs';

const require = createRequire(import.meta.url);
const { hsDetailDates, hsText } = require('./hs_dates.js');

const argv = process.argv.slice(2);
const 문제만 = argv.includes('--문제만');
const 틀린것 = argv.includes("--틀린것");
const 앵커 = argv.includes("--앵커");
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/* ── 읽기_시험문제.md 의 아홉. 답은 손으로 확인한 값입니다 ──
   ☆ 가 붙은 것은 곁증거(워크넷 쌍 공고)라 공고문으로는 확인 안 했습니다.
   null 은 「본문에 없다」가 정답인 것입니다 — 규칙이 빈손을 내면 **맞은 것**입니다 */
const 문제 = [
  { 번: 1, id: 'HS700684036',  곳: '경기도의료원 안성병원',   답: '2026.10.10', 어디: '본문',
    url: 'https://www.medical.or.kr/front/boardView.do?brd_mgrno=279&menu_no=976&brd_no=100629' },
  { 번: 2, id: 'HS1197110823', 곳: '강원대 광역치매센터',     답: '2026.10.12', 어디: '본문(euc-kr)',
    url: 'https://www.knuh.or.kr/hospitalinfo/hospitalinfo_03_05_view.asp?bid=5&tid=&page=1&idx=34193&smode=&skey=' },
  { 번: 3, id: 'HS1804530245', 곳: '광주기독 작업치료사',     답: null, 어디: '첨부 hwp (본문에 없음)',
    url: 'https://www.kch.or.kr/user/board/view/board_cd/notice/wr_no/993' },
  { 번: 4, id: 'HS802239364',  곳: '광주기독 물리치료사',     답: null, 어디: '첨부 hwp (본문에 없음)',
    url: 'https://www.kch.or.kr/user/board/view/board_cd/notice/wr_no/992' },
  { 번: 5, id: 'HS485195755',  곳: '중앙보훈 업무지원직',     답: null, 어디: '본문이 그림',
    url: 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=189987' },
  { 번: 6, id: 'HS146236860',  곳: '중앙보훈 기간제',         답: null, 어디: '본문이 그림',
    url: 'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=189986' },
  /* ★ 2026-10-07 — 이 둘의 답을 고쳤습니다. 처음에 「본문이 비었다 · 첨부 PDF 에만
     있다」 고 적었는데 **틀렸습니다.** 상세 화면에 「접수 기한: …」 이 적혀 있습니다.
     제가 앞서 「접수기간·원서접수·마감·기간」 으로만 찾아보고 「없음」 이라 했습니다 —
     이 사이트는 「접수 **기한**」 입니다. 치매센터 11건 중 10건이 상세 화면에
     적혀 있습니다. 첨부 PDF 를 읽을 필요가 없습니다 */
  { 번: 7, id: 'ND1724',       곳: '서울광역치매센터',        답: '2026.10.19', 어디: '본문 「접수 기한」',
    url: 'https://www.nid.or.kr/notification/recruit_view.aspx?no=1724' },
  { 번: 8, id: 'ND1721',       곳: '경기도광역치매센터',      답: '2026.10.13', 어디: '본문 「접수 기한」',
    url: 'https://www.nid.or.kr/notification/recruit_view.aspx?no=1721' },
  { 번: 9, id: 'HS258328719',  곳: '충청북도 충주의료원',     답: null, 어디: '첨부 hwp (본문에 없음)',
    url: 'https://cjmct.or.kr/board/view/syfsx/7141' },
];

/* 회원에게 보이는 HS 공고 중 마감일이 빈 것 스물 (2026-10-07 뽑음).
   답을 미리 모르는 것들입니다 — 규칙이 무엇을 내놓는지 **눈으로** 봅니다 */
const 스물 = [
  ['HS5533832',    '의정부을지대병원',  'https://www.uemc.ac.kr/info/info_pg06_05.jsp?board_code=BOARD_4&board_sequence=25015'],
  ['HS646828148',  '칠곡경북대병원',    'https://www.knuch.kr:442/content/04info/11_01.asp?proc_type=view&b_num=5093&rtn_url=%2Fcontent%2F04info%2F11%5F01%2Easp'],
  ['HS399005112',  '칠곡경북대병원',    'https://www.knuch.kr:442/content/04info/11_01.asp?proc_type=view&b_num=5092&rtn_url=%2Fcontent%2F04info%2F11%5F01%2Easp'],
  ['HS859191105',  '제주한라병원',      'https://www.hallahosp.co.kr/bbs/board.php?bo_table=5_3_2_1&wr_id=3242'],
  ['HS146236860',  '중앙보훈병원',      'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=189986'],
  ['HS1911745935', '대전보훈병원',      'https://www.bohun.or.kr/daejeon/na/ntt/selectNttInfo.do?mi=33414&nttSn=189981'],
  ['HS485195755',  '중앙보훈병원',      'https://www.bohun.or.kr/seoul/na/ntt/selectNttInfo.do?mi=32253&nttSn=189987'],
  ['HS495924462',  '원주의료원',        'https://www.kwmc.or.kr/comm/recruit.html?gnb=5&snb=2&tnb=&srch_t=&srch_k=&page=1&pgcode=&b_code=recruit&b_name=&pview=&srch_gubun=0&srch_year=2026&boardpage=read&b_num=26969'],
  ['HS2085442631', '원주의료원',        'https://www.kwmc.or.kr/comm/recruit.html?gnb=5&snb=2&tnb=&srch_t=&srch_k=&page=1&pgcode=&b_code=recruit&b_name=&pview=&srch_gubun=0&srch_year=2026&boardpage=read&b_num=26960'],
  ['HS218887824',  '백제병원',          'https://www.bjhosp.co.kr/RecruitInfo/RecruitInfoView.asp?Srno=630&Page=1&Gubun=1'],
  ['HS594209567',  '서산중앙병원',      'https://www.isjh.co.kr/careers_3/view/67606'],
  ['HS700684036',  '안성병원',          'https://www.medical.or.kr/front/boardView.do?brd_mgrno=279&menu_no=976&brd_no=100629'],
  ['HS1429957266', '제주중앙병원',      'https://www.jeju-jungangh.com/kor/wpbbs/view.php?wpboard=recruit&bno=82'],
  ['HS1584105127', '대자인병원',        'https://designhosp.career.greetinghr.com/ko/o/238825'],
  ['HS1804530245', '광주기독병원',      'https://www.kch.or.kr/user/board/view/board_cd/notice/wr_no/993'],
  ['HS802239364',  '광주기독병원',      'https://www.kch.or.kr/user/board/view/board_cd/notice/wr_no/992'],
  ['HS1197110823', '강원대병원',        'https://www.knuh.or.kr/hospitalinfo/hospitalinfo_03_05_view.asp?bid=5&tid=&page=1&idx=34193&smode=&skey='],
  ['HS1687167732', '계명대동산병원',    'https://dongsan.dsmc.or.kr:49870/content/03intro/04_01.php?proc_type=view&a_num=11300279&b_num=1166&rtn_url=%2Fcontent%2F03intro%2F04_01.php'],
  ['HS399735101',  '계명대동산병원',    'https://dongsan.dsmc.or.kr:49870/content/03intro/04_01.php?proc_type=view&a_num=11300279&b_num=1167&rtn_url=%2Fcontent%2F03intro%2F04_01.php'],
  ['HS1151678462', '선한병원',          'http://www.shhospital.co.kr/0709/view/id/8503'],
];

/* 원문에 적힌 「수시」 신호 — 2번 일감(수시 기준)의 낱말 그대로 */
const 수시말 = /채용\s*시\s*까지|채용시까지|상시|수시|충원\s*시|결원\s*시/;

async function 본문받기(url) {
  const g = await 글받기(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko' } });
  if (g.왜 || g.code !== 200) return { 왜: g.왜 || ('HTTP ' + g.code) };
  return { 글: hsText(g.html), html: g.html };
}

console.log('HS 접수기간 읽기 시험 — 붙이기 전 (2026-10-07)');
console.log('받는 길: 수집기와 같은 글받기() · 규칙: hs_dates.js 의 hsDetailDates()\n');

/* ── ① 시험문제 아홉 ─────────────────────────────────────── */
console.log('━━ ① 읽기_시험문제.md 아홉 문제');
console.log('  번 기관                   정답        읽은값      판정');
let 맞음 = 0, 틀림 = 0, 빈손정답 = 0;
const 틀린목록 = [];
for (const q of 문제) {
  const r = await 본문받기(q.url);
  if (r.왜) {
    console.log('  ' + String(q.번).padStart(2) + ' ' + q.곳.padEnd(22) + ' 못 받았습니다 · ' + r.왜);
    continue;
  }
  const d = hsDetailDates(r.글);
  const 읽은 = d.to || '';
  let 판정;
  if (q.답 === null) {
    /* 본문에 없는 것이 정답 — 빈손이면 맞은 것입니다 */
    if (!읽은) { 판정 = '○ 맞음 (본문에 없음)'; 맞음++; 빈손정답++; }
    else { 판정 = '★ 틀림 — 본문에 없는데 ' + 읽은 + ' 을 냈습니다'; 틀림++; 틀린목록.push([q, r, d]); }
  } else if (읽은 === q.답) { 판정 = '○ 맞음'; 맞음++; }
  else if (!읽은) { 판정 = '△ 못 읽음 (정답 ' + q.답 + ')'; 틀린목록.push([q, r, d]); }
  else { 판정 = '★ 틀림 (정답 ' + q.답 + ')'; 틀림++; 틀린목록.push([q, r, d]); }
  console.log('  ' + String(q.번).padStart(2) + ' ' + q.곳.padEnd(22)
    + String(q.답 || '(없음)').padEnd(12) + String(읽은 || '-').padEnd(12) + 판정);
}
console.log('\n  맞음 ' + 맞음 + ' · 틀림 ' + 틀림 + ' · 점수 ' + (맞음 - 틀림 * 3) + '점'
  + '  (맞음 중 「본문에 없음」이 정답인 것 ' + 빈손정답 + '건)');

/* ── ② HS 스물 ───────────────────────────────────────────── */
if (!문제만) {
  console.log('\n━━ ② 회원에게 보이는 HS 공고 스물 (답을 모르는 것들)');
  console.log('  공고ID         기관             접수시작     마감         수시말');
  let 읽힌것 = 0, 수시것 = 0;
  for (const [id, 곳, url] of 스물) {
    const r = await 본문받기(url);
    if (r.왜) { console.log('  ' + id.padEnd(15) + 곳.padEnd(17) + '못 받았습니다 · ' + r.왜); continue; }
    const d = hsDetailDates(r.글);
    const 수시 = 수시말.test(r.글);
    if (d.to) 읽힌것++;
    if (수시) 수시것++;
    console.log('  ' + id.padEnd(15) + 곳.padEnd(17)
      + String(d.from || '-').padEnd(13) + String(d.to || '-').padEnd(13)
      + (수시 ? '★ ' + (r.글.match(수시말) || [''])[0] : ''));
    /* 날짜를 낸 것은 **어디서 낸 것인지** 함께 찍습니다 (지침 2절).
       8건을 읽었다고만 적으면 맞게 읽었는지 알 수 없습니다 */
    if (앵커 && d.to) {
      const anchors = /(원서\s*)?접수\s*(기간|기한|일정|마감|일시|일자|기일)|모집\s*기간|채용\s*기간|지원\s*기간|응시원서\s*접수|마감\s*일시|마감일|공고\s*기간/g;
      let m, n = 0;
      while ((m = anchors.exec(r.글)) && n < 3) {
        n++;
        console.log('        앵커 「' + m[0].replace(/\s+/g, ' ') + '」 → '
          + r.글.slice(m.index, m.index + 120));
      }
      if (!n) console.log('        ★ 앵커가 없는데 날짜를 냈습니다 — 봐야 합니다');
    }
  }
  console.log('\n  마감일을 읽은 것 ' + 읽힌것 + '/' + 스물.length
    + ' · 원문에 수시말이 있는 것 ' + 수시것 + '건');
}

/* ── ③ 틀린·못 읽은 것의 원문 (지침 2절) ────────────────── */
if (틀린것 && 틀린목록.length) {
  console.log('\n━━ ③ 틀린·못 읽은 것의 원문');
  for (const [q, r, d] of 틀린목록) {
    console.log('\n  ── ' + q.번 + ' ' + q.곳 + ' (' + q.어디 + ') · 글자 ' + r.글.length + '자');
    console.log('     읽은 값 ' + JSON.stringify(d));
    const i = r.글.search(/접수|기간|마감/);
    console.log('     「접수|기간|마감」 ' + (i < 0 ? '없음' : '→ …'
      + r.글.slice(Math.max(0, i - 80), i + 260) + '…'));
    const 날 = [...r.글.matchAll(/20\d{2}\s*[.년\-/]\s*\d{1,2}\s*[.월\-/]\s*\d{1,2}/g)].map((m) => m[0]);
    console.log('     네자리 연도 날짜 ' + 날.length + '개: ' + 날.slice(0, 8).join(' | '));
  }
}
