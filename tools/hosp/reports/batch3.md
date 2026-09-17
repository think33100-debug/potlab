# batch3 조사 결과

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 의료법인백송의료재단 굿모닝병원 | 경기 | 자동 html | https://www.goodmhospital.co.kr/app/communication/recruit.php | 12 | ul.b_lst 카드형 · 등록일만 · robots 없음 · 상세 200 확인 · cfgs/goodmhospital.json |
| 의료법인우리의료재단김포우리병원 | 경기 | 자동 html | https://www.gwhospital.co.kr/intro/recruit_list.php | 16 | 표: 번호·직종·제목·접수기간(시작~마감)·상태, 링크는 data-id→recruit_view.php?idx=N 조립(상세 200·제목 확인). robots * Allow. ※ 서버 TLS 가 약해(DH key too small) Node fetch 는 실패·curl 은 됨 → 저장 HTML 로 검증. Apps Script 에서 열리는지 확인 필요. 나인하이어(l2av0tfl.ninehire.site)도 병행 운영 · cfgs/gwhospital.json |
| 의료법인인봉의료재단뉴고려병원 | 경기 | 자동 html | https://www.nkhospital.net/notice/notice.php?jb_code=100 | 2 | 채용정보 게시판에 글 2건뿐(간호부·작업치료사). 카드형 li>a, 등록일만. robots 없음(404). 상세 200 확인 · cfgs/nkhospital.json |
| 의료법인칠석의료재단사랑의병원 | 경기 | 자동 html | https://www.sarangmc.co.kr/index.php/board/list/employment/694 | 4 | 카드형 li>a, 제목 h3(목록에서 잘림 ..)·기간 시작~마감. 합격자 발표 글은 skip. robots * Allow / (Crawl-delay 3600). 상세 200 확인 · cfgs/sarangmc.json |
| 중앙대학교광명병원 | 경기 | 손 확인(JobFlex) | https://caumc.recruiter.co.kr/career/home | - | 중앙대의료원 통합 채용사이트 · 마이다스 JobFlex(Next.js) → 긁지 않음 |
| 한양대학교구리병원 | 경기 | 손 확인(JobFlex) | https://hyumcguri.recruiter.co.kr/career/home | - | 마이다스 JobFlex(Next.js) → 긁지 않음 |
| 인제대학교일산백병원 | 경기 | 자동 html | https://www.paik.ac.kr/ilsan/user/job/list.do?menuNo=900101 | 10 | 기존 cfgs/paik_ilsan.json 그대로(건드리지 않음) · 오늘 실행 200 · 10줄 |
| 학교법인 을지학원 의정부을지대학교병원 | 경기 | 자동 html | https://www.uemc.ac.kr/info/info_pg06_04.jsp | 15 | 기존 cfgs/uemc.json 그대로(건드리지 않음) · 오늘 실행 200 · 15줄 |
| 한림대학교동탄성심병원 | 경기 | 자동 html | https://recruit.hallym.or.kr/ | 4 | 한림대의료원 통합 채용 사이트. 목록 페이지는 10건씩 나뉘어 동탄 글이 2쪽에 밀리므로 진행중 전부(17건)를 한 번에 보여주는 메인 페이지를 씀. locate=9=동탄. 마감일만 있음(single deadline). robots 없음. 상세 200·제목 확인 · cfgs/hallym_dongtan.json |
| 경상남도마산의료원 | 경남 | 자동 html | https://www.mmc.or.kr/board/list?id=12&menuId=112 | 1 | 채용정보 게시판. 접수마감 행은 링크가 없어(onclick alert) 접수중 행만 row 로 잡음. 합격자·친인척 공지 skip 후 1건(전문의 초빙). 작성일·마감일 둘 다 있음. 링크의 ;jsessionid 제거해 linkFmt 조립. robots: Googlebot 만 /board/ 차단, * 없음. 상세 200 확인 · cfgs/mmc.json |
| 근로복지공단 창원병원 | 경남 | 자동 html | https://www.comwel.or.kr/changwon/info/rcrt.jsp | 10 | 근로복지공단 공통 게시판(동해병원 cfg 와 같은 구조, board_no=152). 등록일만. robots: Disallow / 이나 Allow /changwon/ 명시. 상세 200·제목 확인 · cfgs/comwel_changwon.json |
| 의료법인성광의료재단일산차병원 | 경기 | 손 확인(SPA) | https://recruit.chamc.co.kr/ | - | 차병원 통합 채용 사이트. Angular+requireJS SPA(page.ckd) 라 서버 HTML 에 목록이 없고 .ckd API 로 그림(/recruit/announcement 직접 열면 404). 목록 API 를 못 찾아 긁지 않음. robots * 규칙 없음. 사람인·잡코리아 병행 |
| 의료법인자인의료재단(더자인병원) | 경기 | 자동 html | https://www.the-jain.co.kr/bbs/board.php?bo_table=ot | 9 | 그누보드 채용정보(bo_table=ot) div.bl-list 행, 등록일만. 홈페이지 글은 드묾(최근 2024-12) · 주로 사람인·잡코리아. robots * Allow /. 상세 200·제목 확인 · cfgs/thejain.json |
| 인산의료재단 메트로병원 | 경기 | 자동 html | http://www.metrohospital.co.kr/bbs_list.php?menu_number=527&tb=board_recruitment | 1 | 채용공고 게시판 18행 중 [마감] 17건 skip → 1건. 글 대부분이 임상시험센터 자원자 모집이고 직원 채용은 드묾. 접수기간(시작~마감) 있음. robots * 는 /data/ 등만 차단. 상세 200 확인 · cfgs/metrohospital.json |
| 차의과학대학교분당차병원 | 경기 | 손 확인(SPA) | https://recruit.chamc.co.kr/ | - | 일산차병원과 같은 차병원 통합 채용 SPA → 긁지 않음 |
| 참조은병원 | 경기 | 손 확인(robots) | https://chamhosp.co.kr/?p=22 | - | 채용공고 페이지는 있으나 목록을 AJAX(/_Prog/cje/newsRoom/employmentListHtml.php)로 그리는데 robots * Disallow /_Prog/ → 긁지 않음. (그 응답은 카드형 · 진행중/마감 표시 · 날짜 「2026. 08. 26」) |
| 추병원 | 경기 | 자동 html | http://www.choomc.com/bbs_data/common/list.asp?table=choo_data&category=12 | 15 | EUC-KR ASP 게시판(채용안내). 등록일만. 전공의 모집 글이 많음. robots.txt 404. 상세 200·제목 확인 · cfgs/choomc.json |
| 현대병원 | 경기 | 자동 html | https://www.hdgh.co.kr/intro/recruit.php?m_menu_code=MM0010&s_menu_code=SM1004&m_seq=4&s_seq=78 | 6 | 남양주 현대병원. 진행중 탭 카드(onclick submit_view(board_seq) → linkFmt). 기간 「시작 ~ 채용시 마감」 이라 시작일만(posted). robots 없음. 상세 200·제목 확인 · cfgs/hdgh.json |
| 화성유일병원 | 경기 | 사람인만 | https://hsyuil.kr/ | - | 홈페이지에 채용 메뉴·게시판 없음(공지사항에도 채용 글 없음). 사람인·너스케입에 게시. robots.txt 404 |
| 효산의료재단 안양샘병원 | 경기 | 자동 html | https://anyang.samhospital.com/bbs/board.php?bo_table=recruit | 5 | 그누보드 recruit 게시판(글 링크는 bo_table=news&wr_id=N). 작성일만. [마감]·합격자·서류 글 skip. robots * Allow /. ※ 서버 TLS 약함(DH key too small) → Node fetch 실패·curl 은 됨 → 저장 HTML 로 검증, Apps Script 에서 열리는지 확인 필요. 상세 200 확인 · cfgs/samhospital_anyang.json |
| 효산의료재단 지샘병원 | 경기 | 자동 html | https://www.gsamhospital.com/bbs/board.php?bo_table=recruit | 4 | 안양샘과 같은 구조. 같은 TLS 문제(저장 HTML 로 검증). robots * Allow /. 상세 200 확인 · cfgs/gsamhospital.json |
| 강일병원 | 경남 | 자동 html | http://kang-il-hospital.co.kr/kr/index.php?pCode=notice02 | 2 | 채용공고 게시판(글 2건, 2025-08·09). 등록일만. robots * Allow /. 상세 200·제목 확인 · cfgs/kangil.json |
| 베데스다복음병원 | 경남 | 게시판 없음 | https://www.bdsh.co.kr/ | - | 홈페이지 게시판은 공지·보도·갤러리뿐, 공지에 채용 글 없음. 사람인(2019)·모두잡 등에 간헐 게시. robots * 규칙 없음(Yeti 만) |
| 새통영병원 | 경남 | 자동 html | http://www.saety.co.kr/Module/MBoard/MBoard.asp?Gubun=4 | 0 | 채용공고 게시판은 있으나 글 전부(2013~2025) 「(종료)·(채용완료)」 라 skip 후 0건. 새 글이 오르면 잡힘. 잡코리아 병행. robots.txt 404. 상세 200 확인 · cfgs/saety.json |
| 양산성모병원 | 경남 | 자동 html | https://www.yangsansm.com/recruit | 10 | 구 웅상중앙병원. 그누보드 기반 표(tr.group), 링크 /recruit/N. 날짜가 「09-15」 처럼 연도 없이 나와 date 를 안 잡음(제목·링크만). robots * Allow /. 상세 200·제목 확인 · cfgs/yangsansm.json |
| 연세에스병원 | 경남 | 자동 html | http://www.yonseis.com/cscenter/recruit.php | 1 | 채용정보 ul.board_ul li 카드, 링크에 base64 bbsData. 등록일만. 글 1건(2026-08 간호사). robots * Allow /. 상세 200·제목 확인 · cfgs/yonseis.json |
| 의료법인 거붕 백병원 | 경남 | 자동 html | http://www.gbh.or.kr/info/info04.html | 10 | 채용정보 li.rowdata 행, 접수기간(시작~마감)·진행여부 있음. 지난 공고도 목록에 남지만 마감일로 걸러짐. robots * Allow /. 상세 200·제목 확인 · cfgs/gbh.json |
| 의료법인 대우의료재단대우병원 | 경남 | 자동 html | http://www.dwho.or.kr/bbs/board.php?bo_table=dwhojob | 15 | 그누보드 basic_c_job 표(직종·제목·기간·상태). 기간 「시작 ~ 마감」 또는 「시작 ~ 채용시마감」. robots.txt 404. 상세 200·제목 확인 · cfgs/dwho.json |
| 의료법인 문병욱의료재단 진주고려병원 | 경남 | 자동 html | https://jinjukoreahospital.co.kr/story/careers/ | 1 | WordPress ez_board 표, 상대링크 ?pg=1&no=N → linkFmt. 글 3건(상시 간호사모집 공지 등). robots: Crawl-delay 60. 상세 200·제목 확인 · cfgs/jinjukorea.json |
| 의료법인 성념의료재단맑은샘병원 | 경남 | 자동 html | http://clearwell.kr/waybbs/board.php?bo_table=board7 | 7 | 채용정보 메뉴(sub01/sub06.php)가 iframe 으로 띄우는 그누보드 게시판을 직접 씀. 공지 행이 위에 반복돼 중복 가능. (마감)·입사지원서 skip. 작성일만. robots.txt 404. 상세 200·제목 확인 · cfgs/clearwell.json |
| 의료법인갑을의료재단 갑을장유병원 | 경남 | 손 확인(robots) | https://www.kbhospital.com/main/sub.html?boardID=www74 | - | 채용정보 게시판(anyboard 표, 등록일, 2027 간호사 모집 등) 있으나 robots.txt 「User-agent: * Disallow: /」 → 긁지 않음 |
