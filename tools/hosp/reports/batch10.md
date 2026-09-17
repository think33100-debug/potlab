# batch10 보고서 (전남·전북·제주·충남 종합병원 31곳)

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 의료법인한마음의료재단 여수제일병원 | 전남 | 자동 html | https://jeilhp.com/recruit | 1 | XE3 게시판. 「직원 상시 채용공고」 1건(상세에 직종별)·지원서 양식은 skip. 등록일만 |
| 의료법인행촌의료재단 해남종합병원 | 전남 | 자동 html | https://hngh.kr/pages/page_85.php | 3 | 자체 PHP 게시판. 연 1회 「YYYY년 채용공고」 형식·지원서 양식은 skip. 등록일만 |
| 의료법인해민의료재단 세안종합병원 | 전남 | 자동 html | https://seian.kr/default/1004web/cc/c02.php | 6 | EUC-KR 자체 게시판. 목록에 날짜 없음(연 1회 간호사 채용공고, 종료 표시는 제목에). 상세 200 확인 |
| 첨단종합병원 | 전남 | 자동 html | http://www.cheomdanhosp.co.kr/bbs/board.php?bo_table=505010 | 13 | 그누보드 li 목록. 등록일만. http 만 열림 |
| 전라남도 강진의료원 | 전남 | 자동 html | https://www.gjmed.or.kr/bbs/board.php?bo_table=notice3 | 7 | 그누보드5 표. 날짜가 MM-DD 뿐이라 안 뽑음(상세에서). 합격자·서식은 skip. robots Allow / |
| 전라남도 순천의료원 | 전남 | 자동 html | https://jsmc.or.kr/?contentId=c9f0f895fb98ab9159f51fd0297e236d | 5 | 자체 게시판. 마감 글은 <a> 없이 <div> 라 자동으로 빠짐. 날짜 YY.MM.DD 라 안 뽑음. 상세 200 확인 |
| 전북특별자치도 군산의료원 | 전북 | 자동 html | https://www.kunmed.or.kr/board/bbs/board.php?bo_table=recruit | 7 | 그누보드4 표. 등록일만. ※ node fetch 는 헤더 형식 오류(Missing CR)로 실패 → curl 저장본으로 검증. Apps Script UrlFetch 에서 되는지 확인 필요 |
| 전북특별자치도 남원의료원 | 전북 | 자동 html | https://www.namwonmed.or.kr/content/hire_notice | 20 | 자체 게시판. 상세 페이지 없이 목록 아래 접힌 상세(hwp 첨부) → 링크는 목록+#tr_N. 모집기간 시작~종료 |
| 제주특별자치도 서귀포의료원 | 제주 | 자동 html | https://www.jjsmc.or.kr/bbs/board.php?bo_table=4_5_1_1 | 6 | 그누보드4 표. 모집기간 시작~종료. 공지(양식·서류·결격사유)·합격자 답글 skip. 상세 200 확인 |
| 의료법인 오성의료재단 동군산병원 | 전북 | 자동 html | https://www.donggunsanhosp.co.kr/kor/recruit.cs | 10 | 자체 게시판(recruit.cs). 모집기간 시작~종료·직종·진행상황. 합격자·양식 skip. 상세 200 확인 |
| 익산병원 | 전북 | 자동 html | http://www.iksanhp.com/07_community/contents.asp?code=291 | 16 | EUC-KR ASP 게시판. 등록일만. 공지(신입 확인·서류 반환) skip. http 만. 상세 200 확인 |
| 재단법인 아산사회복지재단 정읍아산병원 | 전북 | 자동 html | https://jeh.asanfoundation.or.kr/asan/depts/D139/K/bbs.do?menuId=2930 | 2 | 아산재단 홈빌더 게시판. 등록일은 HTML 주석 안에서 뽑음. [마감] 글 skip. 글이 드묾. 상세 200 확인 |
| 재단법인예수병원유지재단예수병원 | 전북 | 자동 html | https://www.jesushospital.com/khospital/khospital01_04_01?lang=kor | 19 | 자체 게시판. 모집기간 시작~종료·상태(진행중/마감). robots Disallow 없음. 상세 200 확인 |
| 의료법인영경의료재단전주병원 | 전북 | 자동 html | https://www.jjhospital.co.kr/bbs/recruit | 13 | 아임웹류 bbs_shop li 목록. 작성일만. 마감 글은 제목에 (마감) 붙음. 공지(양식·복리후생) skip. 상세 200 확인 |
| 전주고려병원 | 전북 | 자동 html | http://www.jkhospital.co.kr/bbs/board.php?bo_table=sub06_01 | 4 | 그누보드5 · 공지와 섞인 게시판이라 제목에 모집|채용 있는 것만. 날짜 MM-DD 라 안 뽑음. 연 1회 정도. http 만. 상세 200 확인 |
| 의료법인 중앙의료재단 중앙병원 | 제주 | 자동 html | https://www.jeju-jungangh.com/kor/wpbbs/list.php?wpboard=recruit | 1 | 웹플랜 wpbbs 표. 작성일만. (마감) 글 skip → 현재 1건(3교대 간호사 상시). 상세 200 확인 |
| 의료법인현경의료재단 광양서울병원 | 전남 | 자동 html | https://www.gsh119.co.kr/bbs/board2 | 1 | 채용 게시판 없음 → 공지사항(아임웹류 bbs_shop)에 채용 글이 공지로 올라와 제목에 채용|모집 있는 것만 뽑음. 현재 「2024 간호사 채용 안내」(2022-12 등록·상시) 1건. 상세 200 확인 |
| 하남성심병원 | 전남 | 게시판 없음 | https://www.sungshim.co.kr/ | - | React SPA(라우트에 공지·고객지원만, 채용 없음). 옛 주소 hpsungshim.co.kr 은 403. 널스링크·사람인에만 공고 |
| 해남우리종합병원 | 전남 | 게시판 없음 | http://hnwoori.co.kr/bbs/board.php?bo_table=5_4 | - | 「채용정보」(그누보드 5_4)는 회원 문의글 게시판(채용문의·간호부장님께 등)이고 공식 공고는 2017년 1건뿐. 공지사항(5_1)에도 채용 글 없음. 너스케입·사람인에 올림 |
| 해피뷰병원 | 전남 | 자동 html | http://www.hview.co.kr/Module/Board/Board.asp?ModuleID=2 | 2 | drline ASP 채용안내 게시판. 작성일만. 연 1회 신규 간호사 공고(2025·2026). 공지(지원서 양식) skip. 첫 행 </tr> 누락 HTML 대응. 상세 200 확인 |
| 대자인병원 | 전북 | 자동 greeting | https://designhosp.career.greetinghr.com/ko/home | 8+ | 그리팅 채용사이트. /ko/guide 는 404 라 /ko/home 사용 — __NEXT_DATA__ 에 ["openings"] 질의 있음(신규 간호사·약사·임상심리사 등). robots: /o/*/apply 만 Disallow |
| 부안성모병원 | 전북 | 미확인 · 홈페이지 접속 불가 | http://www.smhsp.co.kr | - | 하이닥 등록 홈페이지 smhsp.co.kr 이 DNS 조회 안 됨(www/비www 모두). 웹 검색에는 사람인 기업정보만 나옴 → 사실상 사람인만 |
| 의료법인석천재단고창병원 | 전북 | 게시판 없음 | http://gchospital.net/main.php?m1=26&m2=63 | - | 채용정보 메뉴(인재관·직원 복지·입사지원하기)가 모두 고정 페이지. 입사지원하기(m2=63)에 상시 채용 안내(간호사 등)와 지원서 양식만. 병원소식(m2=69)은 소식지·행사. 공고는 사람인·병원잡 |
| 정읍한국병원 | 전북 | 손 확인(TLS 접속 불가) | https://jehk.kr/community_05.html | - | 커뮤니티>채용정보 게시판 있음(2026-09-17 수의사, 2026-06 간호사·간호조무사 등 9건 · 연 2~3건). curl·node·.NET 모두 TLS 핸드셰이크 실패(연결 끊김)라 설정을 못 만듦. 상세 주소 형식 community_05.html?query=view&...&bid=N |
| 의료법인 혜인의료재단 한국병원 | 제주 | 자동 html | https://www.hankookhospital.co.kr/bbs/board.php?bo_table=recruit | 8 | 그누보드5 ul/li 목록(카테고리 진행중/마감). 작성일만. (마감) 글 skip. 상세는 /recruit/<한글슬러그>/ 200 확인 |
| 제주대학교병원 | 제주 | 자동 html | https://www.jejunuh.co.kr/prog/rcrutPbanc/main/sub05_03_03_01/list.do | 9 | 홈페이지 채용공고 표(접수기간 시작~종료). 공지 행은 번호 행에 중복돼 번호 행만. 상세 view.do?rcrutPbancNo=N GET 200 확인. 인크루트·마이다스 채용사이트도 있으나 홈페이지 목록에 같이 올라옴 |
| 제주한라병원 | 제주 | 자동 html | https://www.hallahosp.co.kr/bbs/board.php?bo_table=5_3_2_1 | 13 | 그누보드5 표. 등록일만(제목에 ~9/23 식 마감). 공지 중 양식·서류반환만 skip(약사·간호사 상시채용 공지는 남김). robots Allow /. 상세 200 확인 |
| 한마음병원 | 제주 | 자동 html | http://www.hanmaeum.jeju.kr/board/list.do?tblNm=Hire | 2 | 자체 ul/li 게시판(채용안내). 등록일만. 제목 끝 「- 진행중/모집중/마감」 → 「- 마감」 skip. 공지(지원서·반환청구서) skip. http 만. 상세 200 확인 |
| 당진종합병원 | 충남 | 자동 html | http://www.dangjinmc.co.kr/ds7_4_1.html | 1 | EUC-KR 자체(duri) 게시판 「채용소식」. 공지 2건(간호사 상시 채용모집·입사지원서)뿐이고 일반 글 없음 — 잡코리아 공고 5건은 홈페이지에 안 올라옴. 등록일만. 상세 200 확인 |
| 서산중앙병원 | 충남 | 자동 html | https://www.isjh.co.kr/careers_3 | 7 | 아임웹류 CMS(rp-tr div 표) 채용정보>채용공고. 등록일만(채용기간은 「채용시 마감」 라벨). robots /root/ 만 Disallow. 상세 200 확인 |
| 순천향대학교부속 천안병원 | 충남 | 손 확인(JSON POST 전용 채용시스템) | https://jobapplication.schmc.ac.kr/?departmentidx=190004 | - | 순천향중앙의료원 온라인 채용시스템. 목록이 JS 로 POST /recruit/biz/job/getJobAllListFromFrontNew(JSON body, departmentidx=190004) 에서 옴(GET 405·form POST 415). 상세도 POST 폼. 병원 홈 인재채용(schmc.ac.kr/cheonan bbsNo=905)은 전공의 모집만 |
