# 종합병원 채용 게시판 조사·설정 지침 (에이전트용)

작업 폴더: `C:/Users/think/OneDrive/바탕 화면/potjob/potlab/tools/hosp` (Node 20+, curl 사용 가능. 경로는 C:/… 로.)
대상 목록: `targets_general.json` 의 배정된 범위 (`batches/batchN.json` 에 그대로 복사돼 있음). 각 항목: name(심평원 이름 · 글자 그대로 써야 함) · est(설립구분) · sido · sgg · pub(공공기관 목록 설립형태, 있으면) · home(공공목록의 홈페이지, 있으면).

## 병원 하나마다 할 일
1. **채용 공고 목록 페이지 찾기.** home 이 있으면 거기서 「채용」 메뉴를 찾고, 없으면 웹 검색 「<병원명> 채용공고」 「<병원명> 인재채용」. 주소를 지어내지 말 것 — 실제로 열어(curl -s -A "Mozilla/5.0") 200 이 오고 목록이 보이는 주소만 씀.
2. **robots.txt 확인** (`https://호스트/robots.txt`). `User-agent: *` 에 그 경로가 Disallow 면 긁지 않고 「손 확인(robots)」 으로 적음.
3. **구조 분류 후 설정 만들기** — 설정 파일은 `cfgs/<영문slug>.json` (slug 는 호스트명에서 · 겹치지 않게).
   - **HTML 게시판**(서버가 목록을 그려 줌): `hs_test.js` 머리 주석의 형식대로 row·title·link(linkFmt)·date·skip·single 을 적고 `node hs_test.js cfgs/<slug>.json` 으로 실제 페이지에서 뽑히는지 확인. 뽑힌 줄의 링크 하나를 curl 로 열어 200 과 제목 포함을 확인. 날짜가 하나뿐인데 등록일이면 `"single":"posted"`(기본), 마감일이면 `"single":"deadline"`. EUC-KR 이면 `"enc":"EUC-KR"`.
   - **마이다스 구형(appsite)**: 목록 페이지가 빈 껍데기이고 `/appsite/company/index` 에 `appsiteSn` hidden input 이 있음 → `curl -s -A "Mozilla/5.0" -H "Referer: https://호스트/appsite/company/index" -d "appsiteSn=번호&settingType=E" https://호스트/appsite/company/getMainView` 가 JSON(jobnoticeInProgressList) 을 주면 됨(settingType 은 index 페이지의 hidden 값을 씀). 설정: `{"name":"…","type":"appsite","host":"https://호스트","sn":번호,"settingType":"E"}`.
   - **그리팅(greetinghr.com)**: `{"name":"…","type":"greeting","host":"https://xxx.career.greetinghr.com","url":"https://xxx.career.greetinghr.com/ko/guide"}` (guide 페이지의 __NEXT_DATA__ 에 openings 가 있는지 확인).
   - **가톨릭 CMC 계열**(cmc*.or.kr, `/api/article/N?page=1&size=12` JSON 배열): `{"name":"…","type":"cmc","url":"https://호스트/api/article/N?page=1&size=12","base":"https://호스트"}`.
   - **못 긁는 것**: 마이다스 JobFlex(`/career/` Next.js · api-llm.recruiter.co.kr), 나인하이어, Vaadin, 이미지·PDF 만 있는 게시판, 사람인·잡코리아에만 올리는 곳, 로그인 필요 → 설정을 만들지 말고 보고서에 「손 확인(이유)」.
   - 병원 홈페이지에 채용 게시판이 없고 사람인/잡코리아/워크넷 링크만 있으면 「사람인만」 「워크넷만」 으로 적음 (워크넷은 이미 API 로 받고 있음).
4. **보고서** `reports/batchN.md` 에 표 한 줄씩:
   `| 병원명 | 시도 | 결과(자동 html / 자동 appsite / 자동 greeting / 자동 cmc / 손 확인(이유) / 사람인만 / 워크넷만 / 게시판 없음) | 목록 주소 | 뽑힌 줄 수 | 비고 |`
   결과 줄은 병원 하나에 하나. 확인 못 한 것은 「미확인 · 이유」 로 솔직하게.

## 주의
- 이름(name)은 targets 의 name 과 **글자 하나 다르지 않게**.
- 정규식은 JSON 문자열이라 백슬래시를 두 번(`\\s`). 파일은 Write 도구로 만들 것(Bash heredoc 은 백슬래시를 지움).
- 한 병원에 10분 넘게 쓰지 말 것. 막히면 「손 확인」 으로 적고 다음.
- 이미 `cfgs/` 에 있는 병원(상급종합 35곳)은 건드리지 않음.
- 웹 검색 결과의 채용 페이지가 실제 병원과 다른 곳(같은 이름의 다른 지역 병원)이 아닌지 시도·시군구로 확인.
