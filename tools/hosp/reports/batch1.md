# batch1 조사 보고서 (강원·경기 1)

조사일: 2026-09-16

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 강원특별자치도강릉의료원 | 강원 | 자동 html | https://www.gnmc.or.kr/recruit | 8 | cfgs/gnmc.json · 접수기간 시작~마감 둘 다 있음 · 공지행 제외 · robots.txt 403(없음) |
| 강원특별자치도삼척의료원 | 강원 | 자동 html | https://www.ksmc.or.kr/board/bbs/board.php?bo_table=recruit | 10 | cfgs/ksmc.json · 그누보드 · <time datetime> 시작~마감 · robots.txt 없음 |
| 강원대학교병원 | 강원 | 자동 html | https://www.knuh.or.kr/hospitalinfo/hospitalinfo_03_05_list.asp | 7 | cfgs/knuh_kw.json · EUC-KR ASP · 등록일만 · 제목이 목록에서 잘림 · 연구원/타기관 공고 섞임 · robots Yeti 규칙만 |
| 강원특별자치도영월의료원 | 강원 | 자동 html | https://www.youngwol.org/bbs/board.php?bo_table=info_05 | 14 | cfgs/youngwol.json · 그누보드 · 목록 날짜가 두 자리 연도(26-09-02)라 날짜 없이 뽑힘(상세에서 hsDetailDates 로) · robots.txt 없음 |
| 강원특별자치도속초의료원 | 강원 | 손 확인(robots) | https://www.sokchomc.co.kr/board/bbs/board.php?bo_table=bo_03 | - | robots.txt `User-agent: *` 에 `Disallow: /board/` → 긁지 않음. 채용정보 게시판은 그누보드 bo_03 |
| (의)영문의료재단 다보스병원 | 경기 | 손 확인(나인하이어) | https://davos.ninehire.site/ | - | 홈페이지(davoshospital.co.kr) 채용 메뉴가 나인하이어로만 연결 |
| 근로복지공단 동해병원 | 강원 | 자동 html | https://www.comwel.or.kr/donghae/info/rcrt.jsp | 10 | cfgs/comwel_donghae.json · 공단 공통 게시판 · 링크 linkFmt(article_no) · robots Disallow / 이나 Allow /donghae/ 명시 · 등록일만 |
| 근로복지공단 태백병원 | 강원 | 자동 html | https://www.comwel.or.kr/taebaek/info/rcrt.jsp | 10 | cfgs/comwel_taebaek.json · 동해와 같은 구조(board_no=188) · 등록일만 |
| 강원특별자치도원주의료원 | 강원 | 자동 html | https://www.kwmc.or.kr/comm/recruit.html | 8 | cfgs/kwmc.json · 자체 게시판(_mboard) · a 의 title 속성으로 전체 제목 · 등록일만 · 상세 200 확인 · robots Disallow /_ 만 · 삼척·영월의료원장 공모 공고도 섞임 |
| 의료법인 강릉동인병원 | 강원 | 자동 html | http://www.dong-in.or.kr/portal/bbs02/list.do?menuNo=2040200 | 3 | cfgs/dongin_gn.json · eGov div 게시판 · 접수기간(시작~마감) 있으나 현재 정규식은 시작일 하나만 잡혀 posted 로 들어감(등록일과 같은 값) · 상세 GET view.do 200 확인 · robots.txt 없음 · http 만 |
| 홍천아산병원 | 강원 | 자동 html | https://hch.asanfoundation.or.kr/asan/depts/D140/K/bbs.do?menuId=4985 | 10 | cfgs/hch_asan.json · 아산재단 공통 CMS · 등록일(주석 처리된 td)만 · 상세 200 확인 · robots 는 장례식장 등만 차단 |
| 근로복지공단안산병원 | 경기 | 자동 html | https://www.comwel.or.kr/ansan/info/rcrt.jsp | 10 | cfgs/comwel_ansan.json · 동해·태백과 같은 공단 공통 게시판(board_no=140) · 등록일만 · 상세 200 확인 · robots Disallow / 이나 Allow /ansan/ 명시 |
| 한림대학교춘천성심병원 | 강원 | 자동 html | https://recruit.hallym.or.kr/hrt_p10_list.jsp?inggbn=ing&movePage=1 | 1 | cfgs/hallym_chuncheon.json · 한림대의료원 통합 목록에서 locate=5(춘천) 만 잡음 · 마감일만(to) · 상세 200 확인 · robots.txt 는 HTML(없음) · 지금 진행 중 공고가 1건뿐이라 1줄 |
| 경기도의료원 수원병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=227&menu_no=731 | 6 | cfgs/medical_suwon.json · 경기도의료원 공통 CMS · JS fView 대신 GET boardView.do 로 조립(200 확인) · 등록일만 · 면접/응시현황 안내 글 skip · robots.txt 404 |
| 경기도의료원 안성병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=279&menu_no=976 | 7 | cfgs/medical_ansung.json · 수원과 같은 구조 · 상세 200 확인 |
| 경기도의료원 이천병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=266&menu_no=913 | 6 | cfgs/medical_icheon.json · 수원과 같은 구조 |
| 경기도의료원의정부병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=240&menu_no=786 | 5 | cfgs/medical_uijeongbu.json · 수원과 같은 구조 |
| 경기도의료원파주병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=253&menu_no=850 | 6 | cfgs/medical_paju.json · 수원과 같은 구조 |
| 경기도의료원포천병원 | 경기 | 자동 html | https://www.medical.or.kr/front/boardList.do?brd_mgrno=292&menu_no=1038 | 5 | cfgs/medical_pocheon.json · 수원과 같은 구조 |
| 국립암센터 | 경기 | 자동 html | https://www.ncc.re.kr/board.ncc?uri=notice06&searchKey=total&searchValue=&pageNum=1 | 10 | cfgs/ncc.json · 자체 게시판 · JS fncView(ntcId) → boardView.ncc 로 조립(200·제목 확인) · 등록일만 · robots 에 notice06 차단 없음 · 연구소·청년인턴 공고 섞임 |
| 가톨릭대학교부천성모병원 | 경기 | 자동 cmc | https://www.cmcbucheon.or.kr/api/article/141?page=1&size=12 | 6 | cfgs/cmcbucheon.json · CMC 공통 Vue 게시판(board-no=141) JSON · createdDt~recruitClosedDt · 상세 /page/board/recruit/N 은 recruit.cmcnu.or.kr appView 로 302 · robots * Allow / |
| 가톨릭대학교의정부성모병원 | 경기 | 자동 cmc | https://www.cmcujb.or.kr/api/article/128?page=1&size=12 | 10 | cfgs/cmcujb.json · CMC 공통(board-no=128) JSON · 상세는 recruit.cmcnu.or.kr appView 로 302 · robots 첨부 하나만 차단 |
| 국민건강보험공단일산병원 | 경기 | 손 확인(JobFlex) | https://nhimc.recruiter.co.kr/career/home | - | 홈페이지 채용 메뉴가 마이다스 JobFlex(/career/ Next.js) 로만 연결. 구형 appsite/company/index 는 /career/home 으로 301 |
| 국군수도병원 | 경기 | 손 확인(robots) | https://afmd.mnd.go.kr/afmd/5636/subview.do | - | robots.txt `User-agent:*` `Disallow: /` (Allow 는 /$, /medcmd, /afp, /cic 만) → 긁지 않음. 채용공고 게시판(bbs/afmd/5108105)은 군무원 채용·합격자 공고 |
| 온재병원 | 강원 | 자동 html | http://www.xn--hc0bs21a7cp8rsyh23j.com/04_customer/customer_07.php | 14 | cfgs/onjae.json · 한글 도메인(온재병원.com, 구 속초보광병원) 자체 게시판 · 등록일만 · 상세 200·제목 확인 · robots 는 /board /wssm 등만 차단(/04_customer 허용) · http 만 |
| 의료법인 동해동인병원 | 강원 | 자동 html | http://www.dhdongin.or.kr/Board/boardList.asp?Gubun=7&Key=&KeyWord=&page=1&pagesize=10 | 5 | cfgs/dhdongin.json · ASP 자체 게시판 · 등록일만 · 상세 200 확인 · robots.txt 404 · 글 5건 중 마지막이 2020-05 로 사실상 사람인 위주 → 손 확인 겸용 권장 |
| 의산의료재단 강릉고려병원 | 강원 | 게시판 없음 | http://www.kindhp.com/page/info/news.php | - | 홈페이지(kindhp.com) 에 채용 메뉴 없음 · 병원소식 게시판에도 채용·모집 글 0건 · 인크루트/사람인 기업정보만 검색됨 |
| 강남병원 | 경기 | 자동 html | https://www.knmc.or.kr/board/bbs.list.php?B_GUBUN=C | 8 | cfgs/knmc.json · 용인 기흥 강남병원(knmc.or.kr) 확인 · ul.b_lst 카드형 · 등록일만 · 공지 2건(서류반환 고지·지원서 양식) skip · 상세 200 확인 · robots Allow / |
| 광명성애병원 | 경기 | 자동 html | https://www.ksungae.co.kr/square/recruitlist.do | 10 | cfgs/ksungae.json · 자체 게시판 · 등록일~마감일(마감 없는 글은 등록일만) · 상세 200 확인 · robots Allow / (upload 만 차단) · 재단 공통 sungae.co.kr/recruit 는 안내 페이지 |
| 남양주 한양병원 | 경기 | 자동 html | https://www.hynyj.co.kr/recruit | 5 | cfgs/hynyj.json · 그누보드 · 날짜가 두 자리 연도라 날짜 없이 뽑힘 · [마감] 글 skip · 상세 200 확인 · robots Allow / · 게시판 마지막 글 2024-04 로 오래됨(최근 공고는 잡코리아 한양의료재단) → 손 확인 겸용 권장 |
| 대아의료재단한도병원 | 경기 | 자동 html | https://www.handoh.com/sub_board/recruit.php | 9 | cfgs/handoh.json · 자체 게시판 · 등록일만 · 상세 200·제목 확인 · robots * Allow / (Googlebot 만 차단) |
