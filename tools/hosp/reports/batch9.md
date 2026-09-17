# batch9 보고서 (전남·광주 종합병원 31곳)

| 병원명 | 시도 | 결과 | 목록 주소 | 뽑힌 줄 수 | 비고 |
|---|---|---|---|---|---|
| 광주씨티병원 | 전남(광주남구) | 손 확인(게시판 미갱신) | http://www.ct119.co.kr/index.php?cate=004004 | - | 홈페이지 채용정보 게시판은 있으나 최신 글이 2023년(간호사 모집)이고 날짜열 없음(번호·제목·파일·조회). 실제 공고는 잡코리아·사람인·널스링크에 올림. robots Allow / |
| 광주일곡병원 | 전남(광주북구) | 자동 html | https://www.ilgok.co.kr/Module/Board/Board.asp?ModuleID=2 | 1 | cfgs/ilgok.json. 글 2개뿐(양식·2022년 작성 「2026년 간호사 모집 안내」). 실제 공고는 사람인·잡코리아·사랑방 위주 → 사실상 사람인만에 가까움 |
| 광주한국병원 | 전남(광주서구) | 손 확인(JS 렌더링) | https://www.hkh.co.kr/build/hkh/menu-board_647da88a-c35c-4227-af60-b4901702aabf.html | - | 목록이 빈 표이고 custom.js 가 POST /api/homepage/board/cnts/list 로 JSON 받아 그림. hs_test 지원 형식 아님. robots 없음 |
| 광주현대병원 | 전남(광주북구) | 자동 html | http://www.hyundae-hosp.co.kr/apps/community/job.php?bcb_bcode=31 | 1 | cfgs/hyundae_hosp.json. EUC-KR. 마감은 제목에 <채용마감>/<마감> 붙임 → skip. 공지 행은 일반 행에 중복돼 있어 일반 행만 잡음. robots 404 |
| 광주희망병원 | 전남(광주북구) | 손 확인(robots) | https://heemang75.com/bbs/?b_id=job_info&mn=119&site=basic | - | HTML 게시판(제목·등록일 2025-10 등) 긁을 수 있으나 robots.txt 마지막 줄 「user-agent: * … disallow:/」(주석과 한 줄에 붙어 형식은 깨졌지만 전체 금지 의도) → 안 긁음 |
| 근로복지공단 순천병원 | 전남(순천시) | 자동 html | https://www.comwel.or.kr/suncheon/info/rcrt.jsp | 10 | cfgs/comwel_suncheon.json. robots Disallow / 이나 Allow /suncheon/ 예외. 등록일만. 같은 공고가 알리오에도 올라옴(중복 주의) |
| 나주종합병원 | 전남(나주시) | 자동 html | http://www.ngh.co.kr/cms/bbs/cms.php?dk_cms=comm_02 | 1 | cfgs/ngh.json. 매달 「<2026년 9월 채용공고>」 1건 올리고 지난 달은 [마감]. 목록 날짜가 월-일뿐이라 날짜없음. robots 는 Yeti 만 제한 |
| 동아병원 | 전남(광주남구) | 자동 html | https://dongahospital.co.kr/bbs/board.php?bo_table=0403 | 1 | cfgs/dongahospital.json. 그누보드. 마감은 제목에 (마감). 등록일만. robots Allow / |
| 목포기독병원 | 전남(목포시) | 자동 html | https://www.mch.co.kr/bbs/board.php?bo_table=employ_notice | 8 | cfgs/mch.json. 공고기간(시작~마감)·진행상태 열 있음. 마감 글은 링크 없음. robots 없음 |
| 목포시의료원 | 전남(목포시) | 자동 html | https://mokpomc.or.kr/bbs/board.php?bo_table=5_4 | 1 | cfgs/mokpomc.json. 그누보드. 접수 시작~마감이 HTML 주석에 있어 둘 다 뽑힘. 서류전형 합격자 공고 등은 skip. robots Googlebot·Yeti 만 제한 |
| 목포한국병원 | 전남(목포시) | 손 확인(robots) | https://www.hank.co.kr/pages/job/CV_list.php | - | 목록에 공고기간(2026-09-01 ~ 2026-12-31 등) 있어 긁기 쉬우나 robots.txt 「User-Agent: * Disallow: /」 |
| 미래로21병원 | 전남(광주서구) | 자동 html | https://www.mr21mc.kr/Module/Board/Board.asp?ModuleID=4 | 2 | cfgs/mr21mc.json. 일곡병원과 같은 ASP CMS. 작성일만. robots /admin/ 만 제한 |
| 빛가람종합병원 | 전남(나주시) | 사람인만 | http://www.bitgaramhospital.co.kr/ | - | 홈페이지에 공지사항·병원소식 게시판만 있고 채용 게시판 없음(공지 목록에도 채용 글 없음). 사람인·병원잡·인크루트에 올림 |
| 빛고을전남대학교병원 | 전남(광주남구) | 자동 appsite | https://cnuh.recruiter.co.kr/appsite/company/index | 6(진행중) | cfgs/cnubh.json. 홈페이지(cnubh.com sub.cs?m=165) 채용정보가 전남대학교병원 공용 appsite(sn 4978, E) 로 감. 공고명이 「전남대학교병원 직원…」 이라 빛고을만 못 가림. 전남대병원 cfg 와 중복되면 하나만 켤 것 |
| 상무병원 | 전남(광주서구) | 자동 html | https://www.sangmoohospital.co.kr/bbs/board.php?bo_table=recruit | 1 | cfgs/sangmoohospital.json. 그누보드. 「간호사 상시모집」 공지 1건뿐(월-일 날짜라 날짜없음). 직종별 공고는 홈페이지에 안 올리는 듯 |
| 서광병원 | 전남(광주서구) | 손 확인(게시판 미갱신) | http://www.sghospital.kr/wp_recruit/index.html?code=recruit&mode=list | - | 채용정보 게시판 글 3개(양식·2022·2023 간호사 모집), 날짜가 2자리 연도(23.06.20). 실제 공고는 사람인·잡코리아 |
| 선한병원 | 전남(광주서구) | 자동 html | http://www.shhospital.co.kr/0709 | 6 | cfgs/shhospital.json. 진행 중 공고는 공지(고정) 행, 끝나면 번호 행으로 내리고 (마감) 붙임. 등록일만. robots 는 오류 페이지 |
| 성가롤로병원 | 전남(순천시) | 손 확인(JobFlex) | https://stcarollo.recruiter.co.kr/career/job | - | 마이다스 JobFlex(/career/ Next.js). /appsite/company/index 는 /career/home 으로 넘어감 |
| 순천중앙병원 | 전남(순천시) | 손 확인(게시판 미갱신) | http://www.sunchon-jungang.co.kr/myboard/myboard10 | - | 홈페이지 「채용공고」 게시판(myboard10) 은 2024-01-04 글 2개(제목 「703호」 「응급의학과」 · 본문도 「채용공고」 뿐)뿐. 실제 공고는 병원잡·사람인(경력간호사 상시모집). robots 는 문서파일만 제한 |
| 신가병원 | 전남(광주광산구) | 사람인만 | http://www.singahospital.co.kr/xboard/board.php?tbnum=23 | - | 홈페이지에 채용 게시판 없음. 공지사항(tbnum=23) 글 2개 중 「입사지원서·진료기록 사본 다운로드」 양식만 있음. 2026 신규간호사 모집은 사람인·잡코리아·간호학과 공지로만 확인. robots /lib/ /member/ 만 제한 |
| 여수전남병원 | 전남(여수시) | 자동 html | https://www.yscnhosp.com/ych_recruit | 3 | cfgs/yscnhosp.json. 그누보드 개조(ul.na-table). 열: 진행상태·제목·모집기간(시작~마감). 글 3개(2025-08~10) 모두 마감. 운전직 등은 잡코리아에도 올림. robots Allow / |
| 여천전남병원 | 전남(여수시) | 자동 html | http://www.yccnhosp.com/Board/boardList.asp?Gubun=1&Key=&KeyWord=&page=1&pagesize=10 | 6 | cfgs/yccnhosp.json. 「채용정보」(Gubun=5) 는 2012년 글 1개뿐이고 신입간호사 모집 등 실제 채용 글은 공지사항(Gubun=1) 에 섞여 올라옴 → 공지사항을 긁고 휴진·제도안내는 skip. 채용 아닌 공지가 섞일 수 있음. 작성일만. robots 404(IIS) |
| 운암한국병원 | 전남(광주북구) | 자동 html | http://uhkh.co.kr/Module/Board/Board.asp?ModuleID=5 | 1 | cfgs/uhkh.json. 일곡·미래로21 과 같은 ASP CMS. 진행 중 공고는 공지 행, 끝나면 제목에 마감 → skip. 작성일만. 간호사 위주(1년 1~2건). robots /admin/ 만 제한 |
| 영광종합병원 | 전남(영광군) | 자동 html | https://ygmc.co.kr/?pn=board.list&_menu=jobs | 1 | cfgs/ygmc.json. 「상시채용」 게시판. 링크가 onclick 의 location.href 라 _uid 로 조립. 글 1개(공지 「[채용공고] 신규 및 경력 간호사 모집」)뿐이고 공지 행은 날짜 없음. 임상병리사·응급구조사 등 직종 공고는 사람인·인크루트에만. robots 404 |
| 의료법인대송의료재단 무안병원 | 전남(무안군) | 자동 html | http://www.muangh.co.kr/bbs/board.php?bo_table=recruit | 2 | cfgs/muangh.json. 무안종합병원(muangh.co.kr) 그누보드 채용정보. 끝난 공고는 [종료] → skip. 남는 2건은 간호사 상시모집. 전산·수술실 등 개별 공고도 올림(2026-01). robots 302→404 |
| 의료법인목포구암의료재단 목포중앙병원 | 전남(목포시) | 자동 html | http://www.mj-hospital.co.kr/Module/Board/Board.asp?ModuleID=3 | 5 | cfgs/mj_hospital.json. 일곡·운암한국 과 같은 ASP CMS. 월 여러 건(간호사·물리치료사·방사선사·영양사 등). 마감은 제목에 ( * 채 용 마 감 * ) 처럼 띄어 씀 → 마\s*감 skip. 작성일만. robots /admin/ 만 제한 |
| 의료법인한국의료재단 순천한국병원 | 전남(순천시) | 손 확인(robots) | http://www.hankook.or.kr/Module/Board/Board.asp?ModuleID=2 | - | 채용안내 게시판(같은 ASP CMS, [채용완료] 접두어·「병동 간호사 모집안내」 등) 있어 긁기 쉬우나 robots.txt 「User-agent: * Disallow: /」 |
| 의료법인 우범의료재단 장흥종합병원 | 전남(장흥군) | 사람인만 | http://jhgh.kr/bbs/board.php?bo_table=notice | - | 홈페이지(jhgh.kr, 그누보드)에 채용 게시판 없음. 병원소식(notice)에 「간호부 입사지원서」 「입사지원서(간호부 장학생)」 양식 공지만 있고 날짜도 월-일뿐. 실제 공고는 사람인·병원잡·잡코리아. robots 404 |
| 의료법인영성의료재단 고흥종합병원 | 전남(고흥군) | 게시판 없음 | https://kgh.kr/kgh/bbs/board.php?bo_table=kgh_notice | - | 홈페이지(kgh.kr, 그누보드)에 채용 게시판 없음. 공지사항에 「2025년도 간호사 지원서」(양식)·「2019년 간호사…모집 안내」·요양원 시설장 모집 정도만 드물게 섞이고 날짜가 월-일뿐. 실제 공고는 인크루트·더팀스·병원잡. robots 302→404 |
| 의료법인거명의료재단 영광기독병원 | 전남(영광군) | 자동 html | https://www.ygch.co.kr/?page_id=3917 | 7 | cfgs/ygch.json. 워드프레스 KBoard 「채용안내」. 2026-09-08 에도 새 글(경리행정직·새싹지킴이 간사). 마감은 제목에 (마감) → skip. 작성일이 두 번 나와 첫 span 까지만 블록. 작성일만. robots Allow / |
| 의료법인청언의료재단 순천제일병원 | 전남(순천시) | 자동 html | https://suncheonjeil.com/content08/ | 1 | cfgs/suncheonjeil.json. 새 홈페이지(워드프레스 KBoard) 「채용안내」 가 공지사항과 합쳐진 게시판. 채용정보 카테고리엔 이력서 양식뿐이고 「2026년도 신규 및 경력 간호사 채용 공고」(2025-10) 는 카테고리 없이 올라옴 → 전체를 긁고 휴진·캠페인 등 skip(채용 아닌 공지 섞일 수 있음). 링크의 &#038; 때문에 uid 로 linkFmt 조립. 전산직 등 개별 공고는 순천대 게시판·사람인에만. 옛 scjh.co.kr 접속 불가. robots Disallow 없음 |
