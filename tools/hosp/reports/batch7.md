# batch7 보고서 (서울 종합병원 27곳 + 세종 2곳 + 울산 2곳)

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 서울적십자병원 | 서울 | 자동 html | https://www.rch.or.kr/web/rchseoul/bbs/employment | 4 | cfgs/rch_seoul.json. 적십자사 공통 CMS. 게시일자가 두 자리 연도(26-09-04)라 날짜 없음. 합격자발표 글이 섞여 skip. robots * Allow |
| 서울특별시보라매병원 | 서울 | 자동 html | https://www.brmh.org/job/list.do | 7 | cfgs/brmh.json. row 를 제목칸+모집기간칸까지만 잡아 등록일 혼입 방지. 고정 공지도 실제 공고라 포함 |
| 서울특별시 동부병원 | 서울 | 자동 appsite | https://dbhosp.recruiter.co.kr/appsite/company/index | JSON(진행중 2건 확인) | cfgs/dbhosp.json. appsiteSn 1900 · settingType C. robots * Disallow / 이나 Allow /appsite/ |
| 서울특별시서남병원 | 서울 | 손 확인(JobFlex) | https://seoulsnh.recruiter.co.kr/career/home | - | 홈의 「채용안내」가 마이다스 JobFlex(/career/ Next.js). 자체 ASP 게시판(/recruit/view.asp?tb_name=etc_incruit&gubun=A&AC_F=5&AC_S=3&AC_T=1&s_type=i)은 진행중 0건·마감목록 최신이 2024-06 으로 멈춤 |
| 세란병원 | 서울 | 자동 html | https://www.seran.co.kr/index.php/board/list/recruit/70 | 1 | cfgs/seran.json. 「채용 및 대외공고」 게시판. 현재 공고 1건(2026-03-20)뿐이라 게시판이 잘 안 쓰이는 듯 · 등록일만. robots Crawl-delay 3600 |
| 인제대학교 상계백병원 | 서울 | 자동 html | https://www.paik.ac.kr/sanggye/user/job/list.do?menuNo=700029 | 9 | cfgs/paik_sanggye.json. 부산백병원(paik.json)과 같은 CMS. 상세 GET 200 확인 |
| 한림대학교 강남성심병원 | 서울 | 자동 html | https://recruit.hallym.or.kr/hrt_p10_list.jsp?inggbn=ing&movePage=1 | 2 | cfgs/hallym_gangnam.json. 한림의료원 통합 목록에서 locate=3 만. 마감일 하나 → single deadline |
| 한림대학교 한강성심병원 | 서울 | 자동 html | https://recruit.hallym.or.kr/hrt_p10_list.jsp?inggbn=ing&movePage=1 | 1 | cfgs/hallym_hangang.json. 같은 통합 목록에서 locate=2 만 |
| 서울특별시서울의료원 | 서울 | 자동 html | https://www.seoulmc.or.kr/pms/board/list.do?boardidn=216&menucdv=06030000 | 7 | cfgs/seoulmc.json. 채용공고 게시판(boardidn=216) 접수기간 from/to. 상세는 gotoView(216,N) → detail.do GET 200 확인. 신규채용사이트(smc.recruiter.co.kr JobFlex) 링크도 있으나 이 게시판에 2026-09 공고 계속 올라옴. 안내 글 skip. robots 게시판 허용 |
| 성심의료재단강동성심병원 | 서울 | 자동 html | https://recruit.kdh.or.kr/sub_51.php | 8 | cfgs/kdh.json. 자체 채용사이트(한림 통합 recruit.hallym.or.kr 에는 없음). 접수중 탭 · 등록일·마감일 → from/to. 상세 sub_51_view.php?id=N GET 200 확인. robots.txt 는 WAF 차단 페이지(Disallow 없음) |
| 성애의료재단 성애병원 | 서울 | 자동 html | https://h.sungae.co.kr/square/recruitlist.do | 6 | cfgs/sungae.json. 채용정보 게시판 등록일·마감일 → from/to. 상세 recruitview.do?bid=N GET 200 확인. 양식·일정·공지 글 skip. robots * Allow / |
| 의료법인한전의료재단 한일병원 | 서울 | 자동 html | https://www.hanilmed.net/portal/medRecruit/list.do?menuNo=20107030 | 10 | cfgs/hanilmed.json (진주 한일병원 hanilhosp.json 과 별개). 채용공고 표 · row 를 제목~접수기간까지만. 접수기간 「~ 채용시까지」면 날짜 하나 → posted. 상세 GET 200 확인. robots * Allow / |
| 의료법인서울효천의료재단 에이치플러스양지병원 | 서울 | 자동 html | https://www.newyjh.com/hospital/hospital-100200.html | 10 | cfgs/newyjh.json. 채용공고 게시판 · 등록일 하나 → posted. 링크는 JS 폼(Idx/Mode=V) → hospital-100200_view.html?Idx=N&Mode=V 조립 · GET 200 확인. robots Disallow /*?*Page= 만 |
| 의료법인동신의료재단 동신병원 | 서울 | 자동 html | https://dshospital.co.kr/index.php/board/list/jab/32 | 1 | cfgs/dshospital.json. 인재채용 게시판 · 기간 2025-12-01~2026-12-31 → from/to. 상세 GET 200 확인. 공고가 드묾(현재 1건). robots Allow · Crawl-delay 3600 |
| 우리들병원 | 서울 | 손 확인(robots) | https://seoul.wooridul.co.kr/about/news | - | 강서구 하늘길 70 = 서울김포공항 우리들병원. seoul/gimpo/www.wooridul.co.kr 모두 robots `User-agent: * Disallow: /` (Googlebot·Yeti·Daum 만 Allow). 병원소식 게시판에 공지·채용 섞여 있음. 사람인·잡코리아에도 올림 |
| 순천향대학교 부속 서울병원 | 서울 | 손 확인(POST JSON 채용시스템) | https://jobadmin.schmc.ac.kr/recruit/biz/job/recruiteList | - | 순천향중앙의료원 통합 채용시스템. 목록이 빈 껍데기이고 POST /recruit/biz/job/getJobAllListFromFrontNew (JSON body departmentidx=190002 서울병원) 로 그림 → html 파서로 못 긁음. 병원 홈(schmc.ac.kr/seoul)에는 채용절차·입사지원 링크만 |
| 이화여자대학교의과대학부속서울병원 | 서울 | 자동 html | https://seoul.eumc.ac.kr/intro/recrut/list.do?bid_status=I | - | 이미 cfgs/eumc_seoul.json 있음(상급종합 작업분) · 건드리지 않음 |
| 의료법인 청구성심병원 | 서울 | 자동 html | https://cgss.co.kr/career | 1 | cfgs/cgss.json. 아임웹 채용 안내 게시판 · 등록일 하나 → posted. 상세 GET 200 확인. 현재 1건(2026-08-26). 사람인·인크루트에도 올림. robots Allow / |
| 의료법인성화의료재단 대한병원 | 서울 | 게시판 없음 | http://www.daehanh.com | - | 그누보드 사이트에 notice·news·gallery·faq·qa 게시판뿐 · 공지사항에도 채용 글 없음. 인크루트·너스케입에 올림 |
| 의료법인풍산의료재단동부제일병원 | 서울 | 게시판 없음 | http://www.dbjeil.co.kr | - | 그누보드 게시판 1_x~6_x 중 채용 게시판 없음(5_5 「채용서류 반환 고지」만). 너스케입·병원잡에 올림 |
| 한국보훈복지의료공단 중앙보훈병원 | 서울 | 자동 html | https://www.bohun.or.kr/seoul/na/ntt/selectNttList.do?mi=32253&bbsId=1158 | 7 | cfgs/bohun_seoul.json. 보훈공단 공통 CMS(부산·대구 cfg 와 같은 구조). 상단 고정 「공지」 행이 전문의 상시채용이라 함께 잡음. 등록일 하나 → posted. 상세 selectNttInfo.do GET 200 확인. 합격자·안내 글 skip. robots 게시판 허용 |
| 한국원자력의학원원자력병원 | 서울 | 자동 html | https://www.kirams.re.kr/board/generalBoardList7.do | 10 | cfgs/kirams.json. 홈 소식/공지 > 채용공고 표(번호·상태·제목·접수기간·등록일). row 를 td_date 앞까지만. 접수기간이 「시작일~ 채용시」 라 posted 로. 링크 JS page_move → generalBoardView7.do?no=N 조립 · GET 200 확인. 현재 10건 모두 접수중(상시). robots * 블록 없음 |
| 서울현대병원 | 서울 | 게시판 없음 | https://www.seoulhyundai.co.kr | - | 강북구 수유. 그누보드 사이트에 공지사항(notice) 게시판뿐 · sitemap.xml 에도 다른 게시판 없음 · 공지에 채용 글 없음. 잡코리아(suhd321)·너스케입에 올림. robots * Allow / |
| 씨엠병원 | 서울 | 사람인만 | https://www.cmhospital.co.kr/cmhospital/sub_05_11.php | - | 영등포 CM병원(EUC-KR). 채용안내 페이지에 자체 목록 없이 잡코리아·사람인 검색 링크만. 병원잡·너스케입에도 올림 |
| 의료법인 영제 의료재단 엔케이세종병원 | 세종시 | 게시판 없음 | http://www.nksjhsp.co.kr | - | 그누보드 사이트 메뉴(인사말·진료·검진·병원소식 5_1·공지사항 5_2·QnA) 에 채용 게시판 없음 · 병원소식/공지에 채용 글 없음. 사람인·인크루트·병원잡에 올림 |
| 서울산보람병원 | 울산 | 게시판 없음 | http://eunyang.imc-boram.co.kr/sub31.html | - | 울주군 삼남읍. 채용정보(sub31)가 「인재를 채용합니다」 문구 + recruit.hwp 지원서 양식뿐인 정적 페이지 · 공지사항(sub29)에도 채용 글 없음. robots Disallow 없음 |
| 홍익병원 | 서울 | 자동 html | https://hih.or.kr/about/employ_list.php | 9 | cfgs/hih.json. 병원소개 > 채용공고 div 표(번호·제목·공고기간·파일·등록일). row 를 파일칸 앞까지만 → 공고기간 from/to. 상세 employ_view.php?board_seq=N GET 200 확인. 합격자 명단 글 skip. robots 404 |
| 울산병원 | 울산 | 자동 html | https://ush.kr/bbs/board.php?bo_table=incur_notice | 2 | cfgs/ush.json. 그누보드 채용안내 게시판. 「채용진행중」 행만 · 접수기간 from/to(등록일 칸 앞에서 끊음). 상세 GET 200 확인. 서류반환 안내 글 skip. robots /adm/ 만 |
| 혜민병원 | 서울 | 자동 html | https://www.e-hyemin.co.kr/html/?pmode=bbsdat&spag=careers&pseq=2 | 2 | cfgs/hyemin.json. 병원소개 > 채용공고 ul>li 목록. 링크가 <a name=btnBbsView seq=N> JS 라 linkFmt 로 smode=view 조립 · GET 200 확인. 작성일 하나 → posted. 제목에 [마감]/-마감- 붙이는 방식 · 양식 글 skip. 간호사 공고 위주 · 연 2~3건. robots * 없음(Yeti 만) |
| 희명병원 | 서울 | 자동 html | https://hmhp.co.kr:41329/new/sub/sub07-08.php | 1 | cfgs/hmhp.json. hmhp.co.kr → :41329 포트로 넘어가는 실제 홈. 희명채용공고 EUC-KR 표. 링크 ?act=view&bbs_data=…&PHPSESSID=… 를 linkFmt 로 붙임 · GET 200 확인. 등록일 하나 → posted. 현재 1건(2025-11) · 잡코리아에도 올림. robots 404 |
| 세종충남대학교병원 | 세종시 | 손 확인(JobFlex) | https://cnuhinsa.recruiter.co.kr/career/home | - | 자체 홈(cnush.co.kr) 채용정보센터(/recruit/index.do)는 curl·브라우저 모두 500 에러. 충남대병원 채용정보센터(cnuh.co.kr/prog/recruitNotice/02/ALL/list.do · 02=세종) 는 html 로 뽑히지만 진행중 0건 · 마감 최신이 2022-10 으로 멈춤. 현재 채용은 「충남대학교병원(대전·세종) 직원 채용사이트」 cnuhinsa.recruiter.co.kr(마이다스 JobFlex /career/ Next.js) 로 통합 → 못 긁음 |
