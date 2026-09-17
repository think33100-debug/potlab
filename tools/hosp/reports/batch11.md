# batch11 보고서 (충남·충북 종합병원 22곳)

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 충청남도 공주의료원 | 충남 | 자동 html | https://gjmc.or.kr/board/kwzey | 13 | cfgs/gjmc.json (이전 실행분 재검증 통과). 등록일만 있음 · 면접대상자 공지도 섞임 |
| 충청남도 서산의료원 | 충남 | 자동 html | https://seosanmc.or.kr/board/recruit | 13 | cfgs/seosanmc.json (재검증 통과). robots.txt 403(없음) |
| 충청남도 천안의료원 | 충남 | 자동 html | https://www.camc.or.kr/board/syfsx | 8 | cfgs/camc.json (재검증 통과). robots * Allow / |
| 충청남도 홍성의료원 | 충남 | 자동 html | https://www.hsmc.or.kr/board/syfsx | 7 | cfgs/hsmc.json (재검증 통과). 제목에 마감일 포함 |
| 충청북도 충주의료원 | 충북 | 자동 html | https://cjmct.or.kr/board/syfsx | 6 | cfgs/cjmct.json (재검증 통과). robots 는 search 만 차단 |
| 충청북도 청주의료원 | 충북 | 자동 html | https://www.cjmc.or.kr/bbs/board.php?bo_table=recurit_new | 4 | cfgs/cjmc.json. 그누보드(채용정보 메뉴가 iframe). 목록 날짜가 MM-DD 뿐이라 날짜 미수집. 10건 중 합격자·결과 공지 6건 skip |
| 아산충무병원 | 충남 | 자동 html | https://www.asancm.co.kr/about/news/recruit/ | 10 | cfgs/asancm.json (이전 실행분 재검증 통과). 작성일 하나 · 제목에 (마감) 표시 · robots * Allow / |
| 의료법인 백제병원 | 충남 | 자동 html | https://www.bjhosp.co.kr/RecruitInfo/RecruitInfoList.asp | 12 | cfgs/bjhosp.json — 이전 실행분은 enc EUC-KR 로 제목이 깨져 뽑혔음(실제 바이트 UTF-8). enc 한 줄만 지워 재검증 통과. 논산시립노인전문병원 공고 섞임 · robots 404 |
| 의료법인 영서의료재단 천안충무병원 | 충남 | 자동 html | https://www.cmhos.co.kr/cmhos/community/employ_bbs_list.asp | 10 | cfgs/cmhos.json (재검증 통과). 목록에 날짜 없음(마감은 본문·제목 [마감]) · onclick bbsKey 로 상세 조립 · robots 404 |
| 재단법인 아산사회복지재단 부속 보령아산병원 | 충남 | 자동 html | https://brh.asanfoundation.or.kr/asan/depts/D136/K/bbs.do?menuId=4984 | 10 | cfgs/brh.json (재검증 통과). 아산재단 공통 CMS · 목록 날짜 미수집(등록일 열 주석) · robots 게시판 허용 |
| 국립소방병원 | 충북 | 자동 html | https://recruit.incruit.com/fhna/job/ | 2 | cfgs/fhna.json (재검증 통과). 인크루트 채용홈(EUC-KR) · 접수기간 시작~마감 둘 다 · 마감 공고도 남으니 마감일로 걸러야 함 |
| 의료법인 명지의료재단 명지병원 | 충북 | 자동 html | http://jcmj.co.kr/web/bbs/board.php?bo_table=d06 | 15 | cfgs/jcmj.json (재검증 통과). 제천 명지병원 · 그누보드 · http 만 · robots 없음 |
| 의료법인한마음의료재단하나병원 | 충북 | 자동 html | https://www.cjhana.co.kr/board/board_list.php?board_name=recruit | 5 | cfgs/cjhana.json (재검증 통과). 청주 하나병원 자체 PHP 게시판 · 등록일 하나 · 공고 드묾 |
| 건국대학교 충주병원 | 충북 | 자동 html | https://www.kuh.co.kr/bbs/data/list.do?per_menu_idx=51&tabCnt=3&menu_idx=134 | 10 | cfgs/kuh_cj.json. 충주건대병원(kuh.co.kr · 서울 kuh.ac.kr 과 별개). onclick fn_view → view.do GET 조립(상세 200 확인). 접수기간이 두 자리 연도(26-09-11)라 못 잡고 등록일만 수집 · robots 404 |
| 의료법인 건명의료재단 중앙제일병원 | 충북 | 자동 html | https://joongangjeil.co.kr/introduction/recruit.php | 8 | cfgs/joongangjeil.json. 자체 PHP li 목록 · 등록일 하나 · 입사지원서양식 공지 skip · robots 는 /admin/ 등만 차단 |
| 의료법인 인화재단 한국병원 | 충북 | 자동 html | http://www.hanhsp.co.kr/Sub05/Sub05_12.asp?ModuleID=6 | 14 | cfgs/hanhsp.json. 청주 한국병원 ASP · HTML 이 깨져(<tr> 없음) 번호 셀부터 잡음 · 공지 행과 일반 행이 같은 Srno 로 중복(주소로 제거 필요) · 제목에 [모집]/[마감] · http 만 · robots /admin/ 만 |
| 의료법인 자산의료재단 제천서울병원 | 충북 | 자동 html | http://www.seoulhp.co.kr/news/recruit/index.jsp | 1 | cfgs/seoulhp.json. JSP 게시판 · onclick read.jsp?no=N 조립(상세 200) · 글이 2건뿐(양식 1 · 2022년 모집 1) 이라 실제로는 거의 안 올리는 듯 · robots 404 |
| 의료법인 정산의료재단 효성병원 | 충북 | 자동 html | http://106.248.126.61/hyosung/forum.cfm?forum=66 | 9 | cfgs/hyosunghosp.json. 5388hyosunghospital.com → hyosunghosp.co.kr 프레임 → IP(106.248.126.61/hyosung) ColdFusion 으로 302. 도메인으로는 forum.cfm 404 라 IP 주소 사용(IP 바뀌면 깨짐). 제목은 a title 속성 · 등록일 하나 · robots 404 |
| 의료법인 힐링의료재단 옥천성모병원 | 충북 | 게시판 없음 | https://okhospital.co.kr/ | 0 | 홈페이지(그누보드)에 채용 게시판 없음 · 공지사항(bo_table=news) 6건도 전부 진료 안내. 채용은 사람인·너스케입에만 올림(웹검색 확인) |
| 재단법인베스티안재단베스티안병원 | 충북 | 사람인만 | http://bestianosong.com/ | 0 | 오송 베스티안병원 WordPress 홈페이지 · 의료원(bestian.kr) 모두 채용 메뉴 없음(bestian.kr 에 입사지원서 다운로드 링크만). 사람인에 방사선사·원무·간호조무사 등 공고 진행 중(웹검색). robots: /wp-admin/ 만 |
| 청주성모병원 | 충북 | 자동 html | https://www.ccmc.or.kr/bbs/board.php?bo_table=commu_02 | 15 | cfgs/ccmc.json. 그누보드 · 목록 날짜 MM-DD 뿐이라 날짜 미수집(마감은 본문) · 분류(간호부 채용·임상과장초빙)와 모집중/마감 표시 있음 · robots 404 |
| 의료법인 예당의료재단 예산종합병원 | 충남 | 자동 html | http://www.yshospital.com/customer-service/recruitment.php | 1 | cfgs/yshospital.json. 자체 PHP 카드 목록 · 상대링크라 base /customer-service · 등록일 하나 · 공고 드묾(현재 1건) · robots 404 |

## 요약
- 자동 html 20 · 손 확인 0 · 사람인만 1(베스티안) · 게시판 없음 1(옥천성모) · 미확인 0 (22곳)
- 이전 실행분 cfgs/bjhosp.json 은 enc EUC-KR 로 제목이 깨졌음 → 바이트가 UTF-8 이라 enc 한 줄만 제거(재검증 12줄)
- 효성병원은 IP 주소 목록(106.248.126.61) · 한국병원은 공지/일반 중복 → 수집기에서 주소 기준 중복 제거 필요
