/* 긁기 ③ — **표준게시판 꼴** (list.do · board · php·html·jsp 섞인 것) (2026-10-24 세중님 3번)
 *
 *   node tools/긁기/표준게시판.mjs              목록만 (기본 · 마른)
 *   node tools/긁기/표준게시판.mjs --몇개 20
 *   node tools/긁기/표준게시판.mjs --진짜        보류함으로 담습니다
 *   node tools/긁기/표준게시판.mjs --자기점검
 *
 * ── 왜 한 읽기로 묶나 ───────────────────────────────────────
 * ①HTML 게시판 139곳에서 그누보드(19)·경기도의료원(3)을 빼면 **117곳**이 남는데,
 * 꼴 이름은 달라도(list.do 16 · board 10 · php·html·jsp …) **읽는 법은 같습니다** —
 * 「**글 번호가 든 링크** + 그 줄의 제목·날짜」. 그래서 읽기 하나로 넓게 덮습니다.
 *
 * ── 글 번호가 든 링크로 보는 것 ─────────────────────────────
 *   href 에 `…view…?…=123` · `?seq=123` · `nttSn=123` · `wr_id=123` · `bbsSeq=123` ·
 *   `brd_no=123` · `idx=123` · `no=123` 같은 **숫자 열쇠**가 있는 것
 *   ★ 번호가 **없는** 링크는 안 씁니다 (메뉴·붙박이 파일이 섞입니다)
 *   ★ `javascript:…('123')` 꼴도 집습니다 (쪽이 POST 로 여는 자리)
 *
 * ★ 제목이 6자보다 짧거나 메뉴말(「더보기」·「목록」…)이면 버립니다.
 * ★ 날짜는 **그 줄 안에서만** 찾습니다. 없으면 비웁니다 (지어내지 않습니다).
 * ★ 올린날 90일 안인 것만 담습니다 · hold=true 고정 (공통.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 받기, 설정, 담기, 최근인가, HS3가긁나, 도는곳줄, 글자풀기, robots셈, 가도되나집, robots못받았나 } from './공통.mjs';
import { sortJob } from '../sort-rule.mjs';
import { 표준읽기, 꼬리말, 엔티티풀기, 새올읽기, 새올목록몸, 새올상세주소, 새올상세제목, 잘린꼴,
  보건거름, 줄글, 규칙읽기 } from './읽기들.mjs';

export { 꼬리말, 엔티티풀기 };

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const 진짜 = argv.includes('--진짜');
const 몇개 = Number(argv.includes('--몇개') ? argv[argv.indexOf('--몇개') + 1] : 999) || 999;
const 출처 = argv.includes('--출처') ? argv[argv.indexOf('--출처') + 1] : 'HS4';

/* 읽는 함수는 **읽기들.mjs 한 자리**입니다 (지침 6절) — 여기서는 이름만 빌려 씁니다.
   떼어 낸 까닭: 이 파일은 들여오면 바로 긁기를 시작해서, 다른 도구가 읽기만
   쓸 수 없었습니다 (한바퀴표.mjs 가 그것을 씁니다) */
export const 목록읽기 = 표준읽기;

if (argv.includes('--자기점검')) {
  const 잼 = [];
  const 보 = (무엇, 참) => 잼.push([무엇, !!참]);
  const 견본 = `<table><tr><td>12</td>
     <td><a href="/board/view.do?menuId=3&amp;seq=5821">물리치료사 채용 공고</a></td>
     <td>2026-10-20</td></tr>
     <tr><td><a href="/recruit/selectNttInfo.do?nttSn=190472">작업치료사 모집(계약직)</a></td>
     <td>2026.10.18</td></tr>
     <tr><td><a href="javascript:fView('100725')">장애인 의료기관 이용편의 지원사업 작업치료사 채용</a></td>
     <td>2026-10-12</td></tr>
     <tr><td><a href="/menu/sub.do?menuId=7">더보기</a></td><td>-</td></tr>
     <tr><td><a href="/files/공고문.pdf?seq=3">공고문 내려받기</a></td><td>-</td></tr></table>`;
  const r = 목록읽기(견본, 'https://a.or.kr/board/list.do?menuId=3');
  보('번호 든 링크 셋만 읽는다', r.length === 3);
  보('seq 를 집는다', r[0].번호 === '5821');
  보('nttSn 도 집는다', r[1].번호 === '190472');
  보('javascript 번호도 집는다', r[2].번호 === '100725');
  보('★ 메뉴(더보기)는 버린다', !r.some((x) => /더보기/.test(x.제목)));
  보('★ 붙박이 파일(pdf)은 버린다', !r.some((x) => /내려받기/.test(x.제목)));
  보('상대 주소를 절대 주소로', r[0].주소.startsWith('https://a.or.kr/board/view.do?'));
  보('&amp; 를 푼다', !/&amp;/.test(r[0].주소));
  보('javascript 는 목록 주소를 둔다', r[2].주소 === 'https://a.or.kr/board/list.do?menuId=3');
  보('날짜를 집는다', r[0].올린날 === '2026-10-20' && r[1].올린날 === '2026-10-18');
  보('우리 직군 공고는 회원목록', sortJob(r[0].제목, null, null).갈래 === '회원목록');

  /* ── 새올(시·군·구청 고시공고) — 2026-11-11 eminwon.gangdong.go.kr 응답 꼴 그대로 ── */
  const 새올견본 = `<table><thead><tr><th>번호</th><th>고시공고번호</th><th>제목</th><th>담당부서</th></tr></thead><tbody>
    <tr class=""><td>1059</td><td>서울특별시 강동구 공고 제2026-2262호</td>
      <td class="title"><a href="javascript:searchDetail(59320)">강동구자원봉사센터 코디네이터(기간제근로자) 채용 공고</a></td>
      <td>복지정책과</td><td>2026-11-11</td><td>2</td></tr>
    <tr class="even"><td>1058</td><td>○○시 공고 제2026-11호</td>
      <td class="title"><a href="javascript:searchDetail('44629')">2027년 방문건강관리사업 기간제근로자 채용 공고</a></td>
      <td>건강증진과</td><td>2026-11-10</td><td>9</td></tr>
    <tr><td>1057</td><td>○○시 공고 제2026-10호</td>
      <td class="title"><a href="javascript:searchDetail(44620)">보건소 물리치료사(기간제) 채용 공고</a></td>
      <td>보건행정과</td><td>2026-11-09</td><td>3</td></tr>
    <tr><td>1056</td><td>○○시 공고 제2026-9호</td>
      <td class="title"><a href="javascript:searchDetail(44611)">보건소 시간선택제임기제공무원 서류전형 합격자 및 면접시험 일정 공고(물리치료...</a></td>
      <td>보건소</td><td>2026-11-08</td><td>3</td></tr></tbody></table>`;
  const 바탕 = 'https://eminwon.a.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do';
  const s = 새올읽기(새올견본, 바탕);
  보('새올 — 머리줄 빼고 넷을 읽는다', s.length === 4);
  보('새올 — 따옴표 없는 번호', s[0].번호 === '59320');
  보('새올 — 따옴표 든 번호', s[1].번호 === '44629');
  보('새올 — 부서 칸', s[1].부서 === '건강증진과' && s[0].부서 === '복지정책과');
  보('새올 — 날짜 칸', s[0].올린날 === '2026-11-11');
  보('새올 — 고시공고번호는 제목이 아니다', s[0].제목.startsWith('강동구자원봉사센터'));
  보('새올 — 상세는 GET 주소(같은 집 · 번호 · 칸 다 있음)', s[1].주소.startsWith('https://eminwon.a.go.kr' + '/emwp/')
    && /not_ancmt_mgt_no=44629/.test(s[1].주소) && /methodnm=selectOfrNotAncmtRegst/.test(s[1].주소)
    && /epcCheck=Y/.test(s[1].주소));
  보('새올 — 갈래를 상세 주소에 싣는다', /not_ancmt_se_code=01%2C04%2C05/.test(새올상세주소(바탕, 1, '01,04,05')));
  보('새올 목록 몸 — 채용(05) · 30줄 한 번', 새올목록몸().not_ancmt_se_code === '05' && 새올목록몸().ofr_pageSize === '30');
  보('새올 목록 몸 — 옛판은 homepagetype 을 뺀다(예산·화천·동해 400)', !('homepagetype' in 새올목록몸('05', 30, true))
    && 새올목록몸().homepagetype === 'new' && 새올목록몸('05', 30, true).method === 'selectListOfrNotAncmt');
  /* 옛 꼴 — eminwon.gbgs.go.kr(경산시) 응답 그대로: <a> 가 없고 칸마다 onclick, 머리줄도 <td> */
  const 옛꼴 = `<table><tr height=23 bgcolor=BAE6E7 align=center>
      <td width="40">번호</td><td>고시공고번호</td><td width="300">제목</td><td width="80">담당부서</td><td width="80">등록일</td></tr>
    <tr><TD height="1" colspan="8" bgcolor=D3d3d3><!--- colorilne ----></td></tr>
    <tr  >
     <td width="40" height="22" align="center" style="cursor:hand;" onclick="javaScript:searchDetail('51656')" >33</td>
     <td align="left" style="cursor:hand;" onclick="javaScript:searchDetail('51656')"><p align=left >경산시 공고 제2026-2060호</p></td>
     <td align="left" style="cursor:hand;" onclick="javaScript:searchDetail('51656')" ><p align=left>2026년 경산시 보건소 물리치료사 채용 공고</p></td>
     <td align="center" style="cursor:hand;" onclick="javaScript:searchDetail('51656')">건강증진과</td>
     <td align="center" style="cursor:hand;" onclick="javaScript:searchDetail('51656')" >2026-11-09</td>
    </tr></table>`;
  /* 셋째 꼴 — eminwon.namdong.go.kr(남동구): 제목 <a> 가 GET 상세 주소를 품고, 머리줄 「제&nbsp;&nbsp;목」 */
  const 셋째 = `<table><thead><tr class="list_top"><th>번호</th><th>고시공고번호</th><th>제&nbsp;&nbsp;목</th>
      <th>담당부서</th><th>등록일</th><th>조회수</th></tr></thead><tbody>
    <tr  ><td class="center">6748</td>
     <td width="110"><a href="/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?not_ancmt_mgt_no=72595&amp;pageIndex=1&amp;method=selectOfrNotAncmt&amp;methodnm=selectOfrNotAncmtRegst">공고 제2026-2009호</a></td>
     <td align="left"><p align=left><a href="/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do?not_ancmt_mgt_no=72595&amp;pageIndex=1&amp;method=selectOfrNotAncmt&amp;methodnm=selectOfrNotAncmtRegst">남동구보건소 기간제근로자(물리치료사) 채용 공고</a></p></td>
     <td class="center">건강증진과</td><td class="center">2026-11-11</td><td class="center">14</td></tr></tbody></table>`;
  const n3 = 새올읽기(셋째, 'https://eminwon.namdong.go.kr/emwp/gov/mogaha/ntis/web/ofr/action/OfrAction.do');
  보('새올 셋째 꼴 — 번호·제목·부서', n3.length === 1 && n3[0].번호 === '72595'
    && n3[0].제목 === '남동구보건소 기간제근로자(물리치료사) 채용 공고' && n3[0].부서 === '건강증진과');
  보('새올 셋째 꼴 — 쪽이 준 GET 링크(&amp; 풂)', n3[0] && n3[0].주소.startsWith('https://eminwon.namdong.go.kr/emwp/')
    && /not_ancmt_mgt_no=72595&pageIndex=1/.test(n3[0].주소));
  /* 넷째 꼴 — eminwon.jinju.go.kr(진주시): 줄 끝이 `</tr>` 가 아니라 `<tr>` */
  const 진주 = `<table><thead class="tb"><tr><th>번호</th><th>고시공고번호</th><th>제목</th><th>담당부서</th><th>등록일</th></tr></thead><tbody class="tb">
    <tr> <td class="first" onClick="javaScript:searchDetail('66029')">777</a></td>
     <td onClick="javaScript:searchDetail('66029')"><p align=center>진주시 공고 제2026-2671호</p></td>
     <td class="subject" onClick="javaScript:searchDetail('66029')"><p align=left>2027년 체육진흥과 기간제 근로...</p></td>
     <td onClick="javaScript:searchDetail('66029')">체육진흥과</td><td class="date" onClick="javaScript:searchDetail('66029')">2026-11-11</td>
    <tr>
    <tr> <td class="first" onClick="javaScript:searchDetail('66028')">776</a></td>
     <td onClick="javaScript:searchDetail('66028')"><p align=center>진주시 공고 제2026-2670호</p></td>
     <td class="subject" onClick="javaScript:searchDetail('66028')"><p align=left>진주시보건소 방문건강관리 기간제근로자 채용</p></td>
     <td onClick="javaScript:searchDetail('66028')">건강증진과</td><td class="date" onClick="javaScript:searchDetail('66028')">2026-11-10</td>
    <tr></tbody></table>`;
  const jj = 새올읽기(진주, 바탕);
  보('새올 넷째 꼴 — 닫는 </tr> 없어도 두 줄', jj.length === 2 && jj[1].부서 === '건강증진과' && jj[1].올린날 === '2026-11-10');
  보('상세 제목 — 진주 꼴(고시공고구분 앞에서 끊음)', 새올상세제목('<td>제목</td><td>2027년 체육진흥과 기간제 근로자 채용 공고</td>'
    + '<th>고시공고구분</th><td>공고(채용공고)</td>') === '2027년 체육진흥과 기간제 근로자 채용 공고');
  보('상세 제목 — 남동 꼴(제 목 … 번 호)', 새올상세제목('<th>제 목</th><td>만수5동 6통장 공개모집 공고</td><th>번 호</th><td>x</td>')
    === '만수5동 6통장 공개모집 공고');
  const o = 새올읽기(옛꼴, 바탕);
  보('새올 옛 꼴 — 한 줄', o.length === 1);
  보('새올 옛 꼴 — 머리줄로 제목·부서·날짜 자리', o[0] && o[0].제목 === '2026년 경산시 보건소 물리치료사 채용 공고'
    && o[0].부서 === '건강증진과' && o[0].올린날 === '2026-11-09' && o[0].번호 === '51656'
    && o[0].공고번호 === '경산시 공고 제2026-2060호');
  보('보건 거름 — 복지정책과 자원봉사 코디네이터는 뺀다', !보건거름(s[0].제목, s[0].부서));
  보('보건 거름 — 건강증진과는 남긴다', 보건거름(s[1].제목, s[1].부서));
  보('보건 거름 — 보건행정과 부서도 남긴다', 보건거름('기간제근로자 채용 공고', '보건행정과'));
  보('보건 거름 — 부서가 달라도 제목에 작업치료면 남긴다', 보건거름('○○재활원 작업치료사 채용', '복지정책과'));
  보('보건 거름 — 세무과 기간제는 뺀다', !보건거름('세무과 기간제근로자 채용', '세무과'));
  보('보건 거름 — 「재활용품」은 재활이 아니다', !보건거름('불정면 재활용품 품질개선 지원사업 기간제 근로자 채용 공고', '불정면'));
  보('보건 거름 — 재활원은 남긴다', 보건거름('○○시립재활원 기간제근로자 채용', '복지정책과'));
  보('★ 제목에 직군 없는 보건소 공고는 버리지 않는다(보류함)', sortJob(s[1].제목, null, null).갈래 === '보류함');
  보('제목에 직군이 있으면 회원목록', sortJob(s[2].제목, null, null).갈래 === '회원목록');
  보('잘린 제목을 알아본다', 잘린꼴.test(s[3].제목) && !잘린꼴.test(s[2].제목));
  보('상세 쪽에서 온 제목을 꺼낸다', 새올상세제목('<td>제목</td><td>보건소 물리치료사(기간제) 채용&nbsp;공고</td>'
    + '<th>담당부서</th><td>보건행정과</td>') === '보건소 물리치료사(기간제) 채용 공고');
  보('줄 글 — 링크가 든 tr 글자만', 줄글('<tr><td>x</td></tr><tr><td><a href="v?seq=1">공고</a></td><td>건강증진과</td></tr>',
    '<tr><td>x</td></tr><tr><td>'.length) === '공고 건강증진과');
  보('글자 — 머리가 EUC-KR 이면 EUC-KR 로 푼다',
    글자풀기(Buffer.from([0xba, 0xb8, 0xb0, 0xc7, 0xbc, 0xd2]), 'text/html; charset=EUC-KR') === '보건소');
  /* 곳마다 규칙 — www.pohang.go.kr 채용공고 목록 꼴 그대로 (href="#" · data-action 에 번호) */
  const 포항 = `<tbody><tr><td class="list_num">6580</td><td>포항시 남구보건소 공고 <br/> 제2026-78호</td>
    <td class="taL list_tit"><a href="#" data-action="/portal/saeol/gosi/view.do?notAncmtMgtNo=76371&mid=0202020000" onclick="req.post(this); return false;">
      2026년 포항시 남구 치매안심센터 기간제근로자(송영) 채용 공고</a></td><td class="list_dept">건강관리과</td>
    <td class="list_date">2026-11-10</td></tr>
    <tr><td class="list_num">6575</td><td>포항시 북구 공고 <br/> 제2026-499호</td>
    <td class="taL list_tit"><a href="#" data-action="/portal/saeol/gosi/view.do?notAncmtMgtNo=76290&mid=0202020000" onclick="req.post(this); return false;">
      북구보건소 기간제근로자(물리치료사) 채용 공고</a></td><td class="list_dept">보건정책과</td>
    <td class="list_date">2026-11-05</td></tr></tbody>`;
  const 포항규칙 = { row: '<tr>\\s*<td class="list_num">[\\s\\S]*?<\\/tr>', title: '<a[^>]*data-action[^>]*>([\\s\\S]*?)<\\/a>',
    link: 'notAncmtMgtNo=(\\d+)', linkFmt: 'https://www.pohang.go.kr/portal/saeol/gosi/view.do?notAncmtMgtNo={1}&mid=0202020000',
    date: '(20\\d{2}-\\d{2}-\\d{2})' };
  const ph = 규칙읽기(포항, 포항규칙);
  보('규칙 — 두 줄 · 번호 · 날짜(올린 날) · 주소 조립', ph.length === 2 && ph[0].번호 === '76371' && ph[0].올린날 === '2026-11-10'
    && ph[0].주소 === 'https://www.pohang.go.kr/portal/saeol/gosi/view.do?notAncmtMgtNo=76371&mid=0202020000');
  보('규칙 — 제목은 태그·빈칸 걷음', ph[1] && ph[1].제목 === '북구보건소 기간제근로자(물리치료사) 채용 공고');
  보('규칙 — 부서는 줄 글자(공고번호 칸의 「남구보건소」 포함)', ph[0] && /남구보건소/.test(ph[0].부서) && /건강관리과/.test(ph[0].부서));
  보('규칙 — link 번호 없는 줄은 버린다', 규칙읽기(포항.replace(/notAncmtMgtNo=76290/, 'x=1'), 포항규칙).length === 1);
  보('글자 — 말이 없으면 UTF-8 그대로', 글자풀기(Buffer.from('보건소', 'utf8'), 'text/html') === '보건소');
  const 어긴것 = 잼.filter(([, ok]) => !ok);
  for (const [무엇, ok] of 잼) console.log((ok ? '  ○ ' : '  ✗ ') + 무엇);
  if (어긴것.length) { console.error('✗ 자기점검 ' + 어긴것.length + '가지 실패'); process.exit(1); }
  console.log('○ 자기점검 통과 — ' + 잼.length + '가지');
  process.exit(0);
}

const 설정자리 = path.join(여기, '표준게시판_곳들.json');
if (!fs.existsSync(설정자리)) {
  console.error('✗ ' + 설정자리 + ' 가 없습니다 — 먼저 node tools/긁기/곳들만들기.mjs --꼴 표준게시판 --적기');
  process.exit(1);
}
/* ★ 2026-10-29 세중님 — 손확인 ② 로 들어온 **채용 전용 게시판**도 같은 읽기로 긁습니다.
   파일을 **따로** 둔 까닭 — `표준게시판_곳들.json` 은 `곳들만들기.mjs` 가 분류표에서
   다시 만드는 파일입니다. 거기 손으로 받은 곳을 넣으면 다음에 다시 만들 때 조용히
   사라집니다 (지침 9절 — 「이미 쌓인 자료는 안 고쳐집니다」의 거꾸로 꼴) */
const 더할자리 = path.join(여기, '손확인추가_곳들.json');
/* ★ 2026-11-11 — **보건소 공고를 시·군·구청 고시공고(새올)에서** 받습니다 (멘토-1.2-3 · 멘토-1.13-2).
   손확인추가와 같은 까닭으로 파일을 따로 둡니다. 새 크론 줄 없이 이 파일(22:40 크론)이 함께 읽습니다 */
const 새올자리 = path.join(여기, '보건소새올_곳들.json');
const 파일곳 = (자리, 꼴) => (fs.existsSync(자리) ? JSON.parse(fs.readFileSync(자리, 'utf8')).곳들 : [])
  .map((x) => ({ ...x, 꼴 }));
const 만 = argv.includes('--만') ? argv[argv.indexOf('--만') + 1] : null;   /* 시험용 — 한 파일만 */
const 이름들 = argv.includes('--곳') ? argv[argv.indexOf('--곳') + 1].split(',') : null;   /* 시험용 — 이 곳들만 */
const 곳들 = [
  ...파일곳(설정자리, '표준게시판'),
  ...파일곳(더할자리, '손확인추가'),
  ...파일곳(새올자리, '보건소새올'),
].filter((x) => (!만 || x.꼴 === 만) && (!이름들 || 이름들.includes(x.이름)));
/* 새올 목록은 한 시청 호스트를 여러 보건소가 나눠 씁니다(성남·수원·창원 …) — **한 번만** 받습니다.
   ★ 갈래 — 채용(05)을 **쓰는** 시청은 05. 05 를 안 쓰는 시청(강북구는 05 마지막 글이 2015년)은
     채용 공고가 「공고」 갈래에 섞여 있어 01~05 전부 (곳 설정의 `새올갈래`).
   ★ 줄 수는 30 — 100 으로 하니 대덕구·중랑구가 HTTP 400, 부천이 20초를 넘었습니다 (2026-11-11 마른 시험).
     01~05 · 30줄은 시청마다 사흘~엿새치라 하루 한 번이면 빠지지 않습니다 */
const 받은목록 = new Map();
async function 목록받기(곳) {
  const 열쇠 = 곳.주소 + '|' + (곳.읽기 === '새올' ? (곳.새올갈래 || '05') + '|' + (곳.새올줄 || 30)
    + (곳.새올옛판 ? '|옛판' : '') : 'GET');
  if (!받은목록.has(열쇠)) {
    받은목록.set(열쇠, 곳.읽기 === '새올'
      ? await 받기(곳.주소, { 몸: 새올목록몸(곳.새올갈래 || '05', 곳.새올줄 || 30, !!곳.새올옛판) }) : await 받기(곳.주소));
  }
  return 받은목록.get(열쇠);
}
let 보건곳 = 0; let 상세받음 = 0;
const cfg = 설정();
const 담을것 = []; const 안담음 = [];
let 건너뜀 = 0;
let 열림 = 0; let 못열림 = 0; let 줄없음 = 0; let 서버시도못열림 = 0;
for (const 곳 of 곳들.slice(0, 몇개)) {
  /* ★ 세중님 ㉩ (10/24 밤) — HS3 가 긁는 곳은 건너뜁니다 */
  if (HS3가긁나(곳.이름)) { 건너뜀++; continue; }
  /* ★ 2026-11-11 — `서버에서시도` 곳: 이 PC 에서는 연결부터 안 됐던 곳입니다(연결 시간 초과·끊김 · 두 번).
     서버 쪽 길에서는 열릴 수 있어 하루 한 바퀴 넣어 둡니다. **robots.txt 부터 연결이 안 되면 목록을 두드리지 않고**
     넘어갑니다 — 곳마다 robots 12초가 상한이고, 다른 곳 차례는 막지 않습니다(한 줄씩 돌고 실패는 잡힙니다) */
  if (곳.서버에서시도) {
    await 가도되나집(곳.주소);
    if (robots못받았나(곳.주소)) { 서버시도못열림++; 못열림++; console.log('  ✗ ' + 곳.이름.slice(0, 20).padEnd(21) + '서버에서 시도 — robots.txt 부터 연결 안 됨 (목록 안 두드림)'); continue; }
  }
  const r = await 목록받기(곳);
  if (!r.됨) { 못열림++; console.log('  ✗ ' + 곳.이름.slice(0, 20).padEnd(21) + r.왜); continue; }
  열림++;
  /* `규칙` — 표준읽기로 못 읽는 게시판만 곳 설정에 규칙을 적어 읽습니다 (읽기들.mjs 규칙읽기 · 2026-11-11) */
  /* 새올인데 표가 아니라 <ul><li> 로 그리는 곳(광주 남구)은 `읽기: "새올"` + `규칙` — POST 는 새올대로, 읽기만 규칙으로 */
  let 줄들 = 곳.규칙 && (곳.읽기 === '규칙' || 곳.읽기 === '새올') ? 규칙읽기(r.html, 곳.규칙)
    : (곳.읽기 === '새올' ? 새올읽기(r.html, 곳.주소, 곳.새올갈래 || '05') : 목록읽기(r.html, 곳.주소));
  if (!줄들.length) { 줄없음++; console.log('  · ' + 곳.이름.slice(0, 20).padEnd(21) + '줄 0 (꼴이 다릅니다 — 손확인)'); continue; }
  const 목록수 = 줄들.length;
  /* ★ 시·군·구청 게시판은 모든 부서 글이 섞입니다 — **보건 글만** (부서 칸 · 없으면 그 줄 글) */
  if (곳.보건만) 줄들 = 줄들.filter((x) => 보건거름(x.제목, x.부서 || 줄글(r.html, x.자리)));
  /* ★ 한 호스트를 여러 보건소가 나눠 쓰면 부서·제목의 구 이름으로 가릅니다.
     대표 곳은 남의 구 이름이 **없는** 줄을 다 받습니다 (빠지지 않게) */
  const 구글 = (x) => (x.부서 || '') + ' ' + x.제목;
  if (곳.부서말) 줄들 = 줄들.filter((x) => new RegExp(곳.부서말).test(구글(x)));
  if (곳.부서말제외) 줄들 = 줄들.filter((x) => !new RegExp(곳.부서말제외).test(구글(x)));
  const 보건수 = 줄들.length;
  if (곳.보건만 && 보건수) 보건곳++;
  /* ★ 새올 목록 제목은 길면 「…」로 잘립니다 — 보건 줄만 **상세를 열어 온 제목**으로 (곳당 3번까지) */
  if (곳.읽기 === '새올') {
    let n = 0;
    for (const x of 줄들) {
      if (n >= 3 || !잘린꼴.test(x.제목) || !최근인가(x.올린날, 90)) continue;
      n++; 상세받음++;
      const d = await 받기(x.주소);
      const 온제목 = d.됨 ? 새올상세제목(d.html) : '';
      if (온제목 && 온제목.length >= x.제목.replace(잘린꼴, '').length) x.제목 = 온제목;
    }
  }
  const 우리것 = 줄들.filter((x) => sortJob(x.제목, null, null).갈래 !== '쓰레기통');
  const 담을 = 우리것.filter((x) => 최근인가(x.올린날, 90));
  안담음.push(...우리것.filter((x) => !최근인가(x.올린날, 90)).map((x) => ({ 곳: 곳.이름, ...x })));
  console.log('  ○ ' + 곳.이름.slice(0, 20).padEnd(21) + '목록 ' + String(목록수).padStart(3)
    + (곳.보건만 ? ' → 보건 ' + String(보건수).padStart(3) : '')
    + ' → 버릴 것 뺀 뒤 ' + String(우리것.length).padStart(3)
    + ' → 90일 안 ' + String(담을.length).padStart(3)
    + (곳.기관번호 ? '' : '  (기관번호 없음)'));
  for (const x of 담을.slice(0, 2)) {
    console.log('      ' + x.올린날 + '  [' + sortJob(x.제목, null, null).갈래 + ']  ' + x.제목.slice(0, 50));
  }
  for (const x of 담을) {
    /* ★ 기관번호가 없는 보건소는 `아이디머리`(시청 호스트 글자)로 — 'x' 하나로 두면
       다른 시청의 같은 글 번호가 한 공고로 덮입니다 */
    담을것.push({ id: 'HS4-' + (곳.기관번호 ? 곳.기관번호.slice(5, 13) : (곳.아이디머리 || 'x')) + '-' + x.번호,
      source: 출처, org_name: 곳.이름, title: x.제목, url: x.주소, posted_at: x.올린날,
      sido: (곳.지역 || '').split(' ')[0] || null, 기관번호: 곳.기관번호 || null });
  }
}
console.log('\nHS3 가 긁어 건너뜀 ' + 건너뜀 + ' (세중님 ㉩) · 열린 곳 ' + 열림 + ' · 못 연 곳 ' + 못열림
  + (서버시도못열림 ? ' (그중 서버에서 시도 ' + 서버시도못열림 + ')' : '') + ' · 줄 0 인 곳 ' + 줄없음
  + ' · 보건 줄 나온 곳 ' + 보건곳 + ' · 잘린 제목 상세 ' + 상세받음 + '번'
  + ' · robots 읽은 호스트 ' + robots셈().읽은호스트 + ' (막은 곳 ' + robots셈().막은호스트.length
  + (robots셈().막은호스트.length ? ' — ' + robots셈().막은호스트.join(', ') : '') + ')'
  + ' · 담을 것 ' + 담을것.length + '건 (안 담음 ' + 안담음.length
  + ' — 날짜 없음 ' + 안담음.filter((x) => !x.올린날).length + ' · 오램 '
  + 안담음.filter((x) => x.올린날).length + ')');

const 결과 = await 담기(cfg, 출처, 담을것, { 진짜 });
if (!결과.됨) { console.log('✗ 담지 못했습니다 — ' + (결과.왜 || 결과.답)); process.exit(1); }
console.log(결과.마른 ? '[마른] 아무것도 안 담았습니다 — --진짜 로 담습니다'
  : '○ 담았습니다 — ' + 결과.답 + ' · 기관번호 붙임 ' + 결과.기관붙임 + '건');

/* ★ 2026-10-28 세중님 2번 — 날마다 **한 줄**로 「도는 곳 N/777」.
   22:40 크론에서 이 파일이 **맨 뒤 목록 긁기**라 여기서 한 번만 찍습니다
   (경기도의료원 → 그누보드 → 표준게시판 차례 · 크론 줄은 안 건드립니다) */
console.log('긁기_날마다 — ' + 도는곳줄());
