# batch2 보고서 (경기 종합병원 31곳)

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 대진의료재단 분당제생병원 | 경기 | 자동 html | https://www.dmc.or.kr/recruit/recruit/list.do | 9 | 자체 채용사이트. 상단 고정글이 목록에 한 번 더 나와 중복 1건. 「채용시까지」는 posted 로 잡힘 |
| 동국대학교일산불교병원 | 경기 | 자동 html | http://www.dumc.or.kr/hospital/recruit/hospitalRecruitList.jsp?nowPageInfo=ILSH&nowMenuId=00000130 | 10 | EUC-KR. https 는 TLS 실패라 http. 지원기간 시작~마감 둘 다 있음. robots 없음 |
| 메디인병원 | 경기 | 자동 html | https://www.medi-in.co.kr/backend/api/recruit?page=1&limit=20 | 15 | React SPA 라 목록 HTML 없음 → JSON API 를 정규식으로 긁음. 상세는 SPA /news/recruit/{id}. 공고 본문이 그림뿐인 경우 많음 |
| 메디필드한강병원 | 경기 | 자동 html | https://www.hanganghospital.com/bbs/board.php?bo_table=recruit | 2 | 그누보드. 2026 신설 종합병원. robots 404 |
| 부천세종병원 | 경기 | 손 확인(목록이 POST ajax JSON) | https://recruit.sejongh.co.kr/_page/notice/list | 0 | 목록은 POST /notice/list/data(JSON, GET 은 405) 로 JS 가 그림. 부천·인천 공고가 한 사이트에 [부천세종병원] 접두어로 섞임. 상세 view?id=N |
| 부천우리병원 | 경기 | 자동 html | https://urimedi.com/bbs/board.php?bo_table=Recruit | 4 | 그누보드. 등록일만. 최근 글 2025-08 |
| 성남시의료원 | 경기 | 자동 html | https://www.scmc.kr/recruit/recruitList/ | 5 | 이전 실행에서 cfg 만들어 둔 것을 검증만 함. 표: 번호·구분·제목·모집기간(시작~마감). 합격자·전형 공고 skip(「면접 전형」 띄어쓴 제목 1건은 통과). robots: Yeti 만 명시 |
| 순천의료재단 성남정병원 | 경기 | 자동 html | https://www.chungsh.com/index.php/board/list/job/35 | 2 | 이전 실행에서 cfg 만들어 둔 것을 검증만 함. 자체 CMS, ul.listul 항목마다 분류·제목·기간(시작~마감). 「채용서류 반환 안내」 skip. robots: /medis/ 등만 차단 |
| 성남중앙병원 | 경기 | 자동 html | https://schosp.co.kr/sub/sub0604.php | 10 | 자체 PHP 게시판. 작성일이 두 자리 연도(25-12-30)라 날짜 못 뽑음(날짜 없음). 진행사항 열에 진행중/마감. 최근 글 2025-12. robots 없음(302) |
| 연세대학교 의과대학 용인세브란스병원 | 경기 | 자동 appsite | https://yuhs.recruiter.co.kr/appsite/company/index (sn 4468 · settingType A) | 6 | 연세의료원 공동 채용사이트. 신촌·강남·용인 공고가 섞여 나오며 recruitClassName/제목 접두어 [용인] 으로 골라야 함(현재 진행 6건 중 용인 1건). 수련직·교원직은 yi.severance.healthcare/recruit/recruit.do 별도 |
| 오산한국병원 | 경기 | 자동 html | http://www.oshankook.net/bbs/board.php?bo_table=sub08_01 | 4 | 이전 실행에서 만든 cfg 검증. 그누보드 갤러리형, 등록일만. 최근 글 2025-09. robots 404 |
| 원광대학교 산본병원 | 경기 | 자동 html | https://www.wmcsb.co.kr/bbs/board.php?bo_table=hospnews_04 | 7 | 이전 실행에서 만든 cfg 검증. 그누보드, 등록일만(마감은 본문). 진행중 글은 공지로 상단 고정. robots: * Allow / |
| 의료법인 녹산의료재단동수원병원 | 경기 | 자동 html | https://www.dswhosp.co.kr/support/recruit.php | 23 | 이전 실행에서 만든 cfg 검증. 자체 PHP 게시판, 제목 앞 [진행]/[마감], 작성일 하나. robots: /admin/ 등만 차단 |
| 의료법인 덕산의료재단 수원덕산병원 | 경기 | 자동 html | https://www.swdeoksanmc.com/employ/recruit_notice/list.do | 14 | 이전 실행에서 만든 cfg 검증. 채용정보센터, 시작일시~마감(상시채용이면 시작일만). 상세 view.do?rc_idx=N |
| 안성성모병원 | 경기 | 자동 html | http://www.ansmc.co.kr/bbs/board.php?bo_table=sub05_05 | 5 | 이전 실행에서 만든 cfg 검증. 그누보드(인재채용>채용정보). 등록일이 월-일(09-08)만이라 날짜 없음. 마지막 글 2023 신규간호사라 갱신 드묾. http 만. robots: * Allow / |
| 의료법인 갈렌의료재단 박병원 | 경기 | 자동 html | https://www.parkmedical.co.kr/board/recruit | 9 | 이전 실행에서 만든 cfg 검증. Next.js 지만 목록이 서버에서 그려짐. 등록일 하나(time). 상세 /board/recruit/N 200 확인. 최근 글 2025-12. robots: /api /admin 만 차단 |
| 의료법인 록향의료재단 신천연합병원 | 경기 | 자동 html | https://suh.or.kr/service_03.html | 10 | 이전 실행에서 만든 cfg 검증. EUC-KR 자체 게시판(LimBo). 접수기간 시작~마감(연도 없는 글은 날짜 없음). 최근 글 2026-07. 상세 bid=2488 200 확인. robots 404 |
| 의료법인 명인의료재단 화홍병원 | 경기 | 자동 html | https://www.hwahonghospital.com/page/intro/news/hire.php | 1 | 이전 실행에서 만든 cfg 검증. 카드형 PHP 게시판. 날짜가 두 자리 연도라 날짜 없음. 글 1건(2026 신규간호사)뿐 — 수시는 사람인·너스케입. robots: * Allow / |
| 의료법인 석경의료재단 센트럴병원 | 경기 | 자동 html | https://www.cmch.co.kr/sub_hospital/recruit_list.php | 10 | 이전 실행에서 만든 cfg 검증. 자체 PHP 게시판, 작성일 하나. 신규간호사 공채 위주(최근 2026-03). 수시는 사람인·잡코리아. robots: * Allow / |
| 의료법인 양진의료재단 평택성모병원 | 경기 | 자동 html | https://www.ptsm.co.kr/bbs/board.php?tbl=bbs52 | 6 | 이전 실행에서 만든 cfg 검증. 카드형 목록, 목록에 날짜 없음. 상세(num=116) 200 이나 본문이 그림뿐이고 제목도 안 반복됨(이메일 지원). 최근 글 2026-08. robots: * Allow / |
| 의료법인 영동의료재단 의정부백병원 | 경기 | 자동 html | http://upaik.co.kr/Module/Board/Board.asp?ModuleID=2 | 9 | 이전 실행에서 만든 cfg 검증. ASP 게시판, 등록일 하나. 제목이 전부 「간호사 모집 공고」 로 같음(등록일로 구분). 최근 글 2026-04. http 만. robots: /admin/ 만 차단 |
| 의료법인 일심의료재단 포천우리병원 | 경기 | 자동 html | http://swoori.co.kr/bbs/board.php?bo_table=recruit | 13 | 이전 실행에서 만든 cfg 검증. 그누보드, 등록일 하나. 최근 글 2026-08(치과위생사). http 만. robots 200 이지만 빈 내용 |
| 의료법인 플러스의료재단 단원병원 | 경기 | 자동 html | https://www.dwhosp.co.kr/bbs/board.php?bo_table=recruit | 16 | 이전 실행에서 만든 cfg 검증. 그누보드 변형(작은따옴표 href → wr_id 로 조립). 공지글이 위에 한 번 더 나와 중복 4건 포함. 제목 끝 -마감 표기. 최근 글 2025-08. robots: Disallow 없음 |
| 의료법인 박애의료재단 박애병원 | 경기 | 손 확인(robots) | http://www.bagaehospital.com/main/sub.html?pageCode=5 | 0 | 병원소개>채용공고(anyboard, boardID=www5, 번호·제목·작성일 표로 긁기 쉬움) 이나 robots.txt 가 `User-agent: * Disallow: /`(Yeti·Naverbot 만 허용) 라 설정 안 만듦. 제목 앞 <마감> 표기. 최근 글 2023-12, 수시는 사람인·메디잡 |
| 의료법인명지의료재단명지병원 | 경기 | 손 확인(robots) | https://mjh.or.kr/employ/recruit_notice/list.do | 0 | 채용정보센터(수원덕산과 같은 플랫폼, list_bbs_title + view.do?rc_idx=N, 시작~마감 일시) 로 긁기 쉬움이나 robots.txt 가 `User-agent: * Disallow: /`(Yeti·Googlebot 만 허용, Crawl-delay 30) 라 설정 안 만듦. 공고 매우 활발(2026-09 에만 10건+) — 손 확인 우선순위 높음 |
| 의료법인 남촌의료재단 시화병원 | 경기 | 자동 html | https://www.shhosp.co.kr/group/intro/job/noticeList.do | 8 | 시화병원 홈페이지 채용공고(갤러리형, 한 페이지 8건·진행중만 노출). onclick fn_Detail('N') → GET noticeView.do?jobNoticeNo=N 200 확인. 접수기간 '시작 ~ 2999-12-31'(상시) 라 시작일만 잡혀 posted. 공고 활발(2026-09 3건). robots: Yeti 만 명시 |
| 의료법인 토마스의료재단 윌스기념병원 | 경기 | 자동 html | https://allspine.com/intro/intro06_03.html | 15 | 수원 윌스기념병원(allspine.com) 병원소개>채용안내. li.rowdata, 제목은 목록에서 '...' 로 잘림, 접수기간 from~to(구분자 없는 '20260501' 식 글은 날짜 없음), 진행여부 진행중/마감. 상세 jb_idx=20505 200 확인. 공지(채용서류 반환) skip. robots: Allow / |
| 의료법인대인의료재단 다니엘종합병원 | 경기 | 게시판 없음 | http://www.danielhospital.co.kr/sub28.html | 0 | 다니엘소식>채용안내 페이지가 「직원을 찾습니다」 문구와 그림 2장(ilikedoctor 템플릿) 뿐, 공고 목록·외부 링크 없음. .com 도 같은 사이트. 공고는 너스케입·인크루트에 올림 |
| 세종여주병원 | 경기 | 사람인만 | (홈페이지 없음) | 0 | 하이닥 등에 적힌 홈페이지 www.yjhp.co.kr 가 DNS 없음(nslookup Non-existent domain, http/https 모두 접속 불가). 공고는 사람인(물리치료사·간호사)·너스케입에만 확인됨 |
| 의료법인 은혜와감사의료재단 화성중앙종합병원 | 경기 | 손 확인(목록이 POST ajax JSON · 현재 0건) | http://www.hjhospital.co.kr/bbs/notice.php | 0 | 홈페이지 「채용정보」 게시판은 JS 가 POST /_Proc/notice_list_proc.php(JSON, 제목이 \u 이스케이프) 로 그림. 같은 방식의 병원소식은 글이 있으나 채용정보는 TotalCount 0 — 홈페이지에 공고를 안 올림. 공고는 사람인·너스케입(2024 신규간호사). robots: * Allow / |
| 의료법인 원광의료재단 원광종합병원 | 경기 | 게시판 없음 | http://www.wkgh.co.kr/boad/bd_news/1/egolist.asp?bd=3 (공지사항) | 0 | 홈페이지(www.wkgh.co.kr, 루트는 404 · 하위 asp 만 200) 메뉴에 채용 게시판이 없고 커뮤니티>공지사항(bd=3)·공지사항 및 안내(bd=7) 에도 진료안내·검진 이벤트뿐 채용 글 없음. 공고는 너스케입(2025 경력간호사)·잡코리아·사람인에 올림. robots 404 |
