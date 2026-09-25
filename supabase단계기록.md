# Supabase 단계 기록 · 되돌리는 법

프로젝트 `qbnxycavokzcdonlfdat` · 2026-09-18

모든 변경은 **마이그레이션으로** 넣었습니다. 대시보드에서 손으로 만든 표는 없습니다.
되돌릴 때는 **번호가 큰 것부터 거꾸로** 하십시오.

| 번호 | 이름 | 만든 것 |
|---|---|---|
| 20260918002557 | `step1_extensions_and_profiles` | `pg_trgm` · `profiles` · `admins` · `is_admin()` |
| 20260918002612 | `step2_job_posts` | `job_posts` · `job_attachments` · `job_post_edits` · 색인 6 |
| 20260918002625 | `step3_migrated_rest` | `drop_rules` · `collectable_orgs` · `wn_verdicts` |
| 20260918002633 | `step4_member_data` | `salary_records` · `student_specs` · `salary_stats()` |
| 20260918002649 | `step5_community` | `posts` · `comments` · `post_images` · `post_likes` · `reports` · 트리거 3 |
| 20260918002712 | `step6_chat` | `chat_rooms` · `chat_members` · `chat_messages` · `in_room()` · `unread_count()` |
| 20260918002720 | `step7_reactions_and_stars` | `job_events` · `job_stars` |
| 20260918002729 | `step8_collector_state_and_notify` | `collector_state` · `seen_postings` · `notification_settings` · `push_devices` · 버킷 2 |
| 20260918002804 | `step9_harden` | `pg_trgm` 을 `extensions` 로 · 트리거 함수 EXECUTE 회수 |
| 20260918002825 | `step10_grants` | 표 권한(GRANT) — **이게 없으면 RLS 를 잘 짜도 안 열립니다** |
| 20260918002857 | `step11_score_column` | `job_scores` 뷰 → `job_posts.score` 칸 · `refresh_job_scores()` |
| 20260918041338 | `step12_org_reference_tables` | 기관 자료 표 9개 + 색인 + RLS |
| 20260918041821 | `step13_service_role_grants` | **service_role 권한** — 없으면 수집기·적재기가 막힙니다 |
| 20260918041852 | `step14_org_directory` | `org_directory` 대조용 한 장 (trgm) |

## 지금 상태

```
표 33개 · 전부 RLS 켜짐 · 대조용 뷰 org_directory 1개
기관 자료 62,749줄 (1단계 완료)
공고 0 · 회원 1(세중 · 관리자) · auth 계정 1(kakao)
버킷 2개 (post-images 공개 · chat-images 비공개, 둘 다 2MB 제한 · webp/jpeg/png)
```

## 되돌리기

### 통째로 (0단계 이전으로)

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
delete from storage.buckets where id in ('post-images','chat-images');
```

자료가 0줄이라 **지금은 이게 가장 깔끔합니다.** 자료가 들어간 뒤에는 쓰지 마십시오.

### 한 단계씩

```sql
-- 14
drop materialized view org_directory;
-- 13
revoke all on all tables in schema public from service_role;
-- 12
drop table hospitals, public_hospitals, dementia_safe_centers, dementia_centers,
           dev_rehab_orgs, ltc_facilities, mental_centers,
           welfare_centers, welfare_facilities cascade;
-- 11
alter table job_posts drop column score, drop column score_at;
drop function refresh_job_scores();
-- 10
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
-- 9
alter extension pg_trgm set schema public;
-- 8
delete from storage.buckets where id in ('post-images','chat-images');
drop table push_devices, notification_settings, seen_postings, collector_state cascade;
-- 7
drop table job_stars, job_events cascade;
-- 6
drop function unread_count(bigint); drop function in_room(bigint);
drop table chat_messages, chat_members, chat_rooms cascade;
-- 5
drop table reports, post_images, post_likes, comments, posts cascade;
drop function bump_like_count(); drop function bump_comment_count(); drop function comment_depth_guard();
-- 4
drop function salary_stats(text,text,int);
drop table student_specs, salary_records cascade;
-- 3
drop table wn_verdicts, collectable_orgs, drop_rules cascade;
-- 2
drop table job_post_edits, job_attachments, job_posts cascade;
-- 1
drop function is_admin(); drop table admins, profiles cascade;
```

## 만들면서 확인한 것

| 확인 | 결과 |
|---|---|
| 부분 색인이 정의대로 들어갔나 | `WHERE NOT hidden AND NOT hold` 3개 · trgm 1개 확인 |
| 댓글수·좋아요수 트리거 | 댓글 2개 → `comment_count`=2, 좋아요 1 → `like_count`=1 |
| 3단 댓글 막기 | 「댓글은 2단까지만 달 수 있습니다」 로 거부 |
| 급여 3명 미만 규칙 | `salary_stats()` 가 줄 자체를 안 돌려줌 |
| `pg_trgm` 을 옮긴 뒤 색인 | `Bitmap Index Scan on job_title_trgm` — 그대로 씀 |
| anon 으로 공고 읽기 | 2건 중 **숨기지 않은 1건만** 보임 |
| anon 으로 못 읽어야 할 것 | `collector_state` · `seen_postings` · `salary_records` · `admins` · `drop_rules` **다 막힘** |
| 시험 자료 | 전부 지웠습니다 (공고 0 · 회원 0 · auth 계정 0) |

## 짚어둘 것

**① 표 권한(GRANT)이 따로 필요합니다.**
RLS 는 「이미 닿을 수 있는 것」 을 좁히는 장치입니다. 규칙만 만들고 권한을 안 주면
`permission denied for table job_posts` 가 납니다. 실제로 그렇게 막혔고 10단계에서 고쳤습니다.
**표를 새로 만들 때마다 GRANT 를 같이 주십시오.**

**①-2 `service_role` 도 GRANT 가 필요합니다.**
RLS 는 통과하지만 표 권한까지 통과하지는 않습니다. 10단계에서 `anon`·`authenticated` 만 주고
빠뜨려서 기관 자료 적재가 `403 permission denied` 로 막혔습니다 (2026-09-18).
13단계에서 `alter default privileges` 까지 걸어 **앞으로 만드는 표에는 자동으로 붙습니다.**

**② 규칙이 하나도 없는 표 둘은 의도한 것입니다.**
`collector_state` · `seen_postings` 는 RLS 를 켜고 규칙을 안 만들어 `service_role` 만 닿습니다.
점검에 INFO 로 계속 뜨는데 고칠 것이 아닙니다.

**③ `is_admin()` · `in_room()` 은 anon 에게도 열려 있어야 합니다.**
RLS 규칙 안의 함수는 「질의를 던진 사람」 권한으로 불립니다. EXECUTE 를 뺏으면 규칙이 통째로 막힙니다.
새는 것은 「내가 관리자인가」 「내가 그 방에 있나」 뿐이고 둘 다 본인이 이미 아는 사실입니다.
점검에 WARN 으로 뜨지만 고치면 안 됩니다.

**④ `rls_auto_enable()` 은 제가 만든 게 아닙니다.**
Supabase 가 프로젝트에 넣어둔 이벤트 트리거로, `public` 에 표를 만들면 RLS 를 자동으로 켜줍니다.
주인이 `postgres` 라 건드리지 않았습니다.

**⑤ 사진은 버킷에만 만들어 뒀습니다.**
글을 지울 때 저장소 파일을 같이 지우는 일은 **아직 없습니다.** `on delete cascade` 는 DB 줄만 지웁니다.
화면을 만들 때 지우는 함수에 같이 넣거나, 주인 없는 파일을 치우는 일을 하나 두십시오.

**⑥ 안 만든 것** — `drop_analysis`(버림분석 · 수집기 이관 때), `hosp_sites`(병원 게시판 설정 288줄 · 수집기 이관 때).

## 2단계 — 공고 5종 (2026-09-18 완료)

```
채용공고 → job_posts            662 → 628   (공고ID 중복 34건 제외 · 전부 HS)
버림규칙 → drop_rules           108 → 108
수집 가능 기관 → collectable_orgs 671 → 671
WN판정 → wn_verdicts            416 → 416
공고수정 → job_post_edits          0 → 0
```

도구는 `tools/copy_jobs.js` 입니다. **시트는 읽기만 합니다** — `exportRows`(서버 v303)로 300줄씩 받아옵니다.
`공고수정` 이 0줄이라 `edited_fields` 는 `tools/copy_jobs_test.js` 로만 확인했습니다.

출처별 — WN 377 · HS 131 · AL 58 · GJ 47 · ND 8 · CE 7

**`source` 는 문서와 실제가 달랐습니다.** `현황.md` 는 「앞 두 글자 AL·JP·GJ…」 라고 하는데,
실제 공고ID 는 `WNK…`/`WNKF…`(워크넷) · `HS…` · `GJ…` · `ND…` · `CE…`(클린아이) 이거나 숫자(알리오)입니다.
662건을 세어 `sourceOf()` 를 그 모양에 맞췄습니다. `AL`·`JP` 접두사는 안 쓰입니다.

### 안 옮긴 것

| 무엇 | 왜 |
|---|---|
| 공고ID 중복 34건 | DB 는 기본열쇠라 하나만. 뒤엣것(나중 수집)을 남겼습니다 |
| 버림분석(`DA_SHEET`) | 옮기는 5종에 없습니다. 규칙만 갔고 근거 기록은 안 갔습니다 |
| 첨부(`job_attachments`) | 시트에 첨부 표가 없습니다. **수집기 이관 때** 채워집니다 |
| 인기 점수 | `job_events` 가 0줄이라 전부 0 |

---

## 수집기 옮길 때(5단계) 같이 볼 것

2026-09-18 공고를 옮기면서 자료에서 눈에 띈 것입니다. **고치지 않고 그대로 옮겼습니다.**

1. **`분류근거` 자리에 시각이 들어 있습니다** — 예: `{"분류근거": "2026-09-09 17:58:00"}`
   근거가 들어가야 할 칸에 판정한 시각이 들어갑니다. 수집기 어딘가에서 값을 잘못 넣는 것으로 보입니다.

2. **`연봉` 자리에 주소가 들어 있습니다** — 예: `{"연봉": "https://www.bohun.or.kr/…"}`
   연봉 칸에 공고 링크가 들어갑니다.

둘 다 `job_posts.detail` · `evidence` 에 그대로 남아 있으니, 수집기를 고친 뒤
다시 부으면 정리됩니다 (`exportRows` 는 그때까지 남겨둡니다).

`exportRows` · `sheetCounts` 와 API 표의 한 줄은 **5단계에서 지웁니다.**

---

## 1단계 — 기관 자료 (2026-09-18 완료)

```
표                      원본        DB        결과
hospitals              15332     15332     맞음
public_hospitals         231       231     맞음
dementia_safe_centers    256       256     맞음
dementia_centers         317       317     맞음
dev_rehab_orgs           305       305     맞음
ltc_facilities         30595     30595     맞음
mental_centers           737       737     맞음
welfare_centers          266       266     맞음
welfare_facilities     14710     14710     맞음
합계 62,749줄
```

붓는 도구는 `tools/load_orgs.js` 입니다. 표를 비우고 다시 붓고 건수를 대조합니다.
열쇠는 `.env.local`(저장소에 안 올라감)에서 읽습니다. 원본이 갱신되면 그냥 다시 돌리면 됩니다.

확인한 것 — 상급종합 47곳(실제와 일치) · 작업치료사 합계 11,071 · 물리치료사 54,880 ·
치매센터 남는 칸 6개가 `extra` jsonb 에 317줄 다 들어감.

`org_directory` 는 원본을 다시 부은 뒤 `refresh materialized view org_directory;` 를 돌려야 합니다.

---

## 로그인해야 보이게 (2026-09-25 완료)

오픈 전 필수 셋 중 첫째입니다. **막는 자리를 화면에서 DB 로 옮겼습니다.**
화면에서만 숨기면 요청을 직접 쏘는 쪽은 못 막습니다.

### 고치기 전에 실제로 쏴본 것 (로그인 없이, anon 열쇠만)

```
공고 목록 job_posts_pub?limit=1000     200   Content-Range 0-99/497
공고 검색 title=ilike.*치료*            200   100줄
병원정보 검색 org_search                200   20줄
기관 한 곳 org_public                   200   1줄
그 기관 공고 org_jobs                   200   8줄
근처 기관 org_nearby                    200   3줄
거르기 목록 org_facets                  200   전부
```

기관 표는 더 심했습니다 — 로그인한 회원 한 명이
`ltc_facilities` 30,595 · `hospitals` 15,332 · `welfare_facilities` 14,710 줄을
그대로 받아갈 수 있었습니다. anon 도 넷은 읽혔습니다.
「누구나 · true」라는 RLS 규칙이 붙어 있어서 사실상 아무것도 안 막고 있었습니다.

### 한 일

**공고** — 뷰를 통째로 읽는 길(`job_posts_pub`)을 닫고 함수 넷으로만 엽니다.

```
job_one(id)      한 건. 공유 링크가 살아야 해서 누구나. 본문(detail)은 회원만
job_list(...)    목록·검색. 회원만 · 한 번에 20건에서 끊음 (함수 안에 박아둠)
job_counts(...)  탭별 건수. 회원만
job_totals()     홈에 쓰는 개수. 줄이 안 나가므로 누구나
```

**기관** — 함수 일곱의 실행 권한을 걷었습니다.
`anon` 에서만 걷으면 안 됩니다 — 권한이 `PUBLIC` 에 붙어 있어서 anon 이 그걸
물려받습니다. 처음에 이걸 몰라 한 번 헛돌았습니다. `revoke ... from public` 이 답입니다.
`org_total` 만 남겨뒀습니다(홈의 「55,338곳」).

**기관 원자료 표·뷰 열** — 읽기 권한을 걷고 「누구나」 규칙을 지웠습니다.
RLS 는 켜둔 채 규칙이 없으면 전부 막힙니다.

```
hospitals · ltc_facilities · welfare_facilities · mental_centers
dementia_centers · public_hospitals · collectable_orgs
org_hospital_stat · org_coverage · org_targets
```

화면은 안 깨집니다 — `org_*` · `job_*` 함수 열둘이 모두 주인(postgres) 권한으로
돌아서 RLS 와 표 권한을 그냥 지나갑니다. 화면 코드가 이 표들을 직접 읽는 곳은
없습니다(확인함 · 0곳). 수집기는 `service_role` 이라 그대로 돕니다.

### 고친 뒤 다시 쏴본 것

로그인 없이 — 위의 일곱과 표·뷰 열, **전부 401 `42501`**.
`job_one` 만 200 이고 `detail` 은 `{}` 입니다(공유 링크는 살아 있어야 하므로).
홈은 그대로 돕니다 — `org_total` 55,338 · `job_totals` 497 · 커뮤니티 · 홈 문구.

회원으로 흉내 내어(`set local role authenticated`) 확인한 것 —

```
job_list()              20줄      job_list(p_page=>1)   20줄
org_search()            20줄      org_search(300 달라고) 20줄  ← least(…,20)
org_public 1 · org_hospital_by_name 1 · org_nearby 3 · org_facets 1
위의 표·뷰 열                     전부 막힘
```

### 확인 못 한 것

카카오·네이버 로그인은 **시작**만 확인했습니다(각자의 로그인 화면까지 도달,
PKCE 검증값이 쿠키에 들어간 것까지). 계정이 없어 로그인을 끝내지는 못했고,
그래서 **로그인한 상태의 화면은 브라우저로 확인하지 못했습니다.**
DB 쪽은 위처럼 흉내 내어 확인했습니다.

### 덧 — 마지막 쪽이 빈 쪽으로 넘어가던 것 (같은 날 고침)

쪽 넘기기를 확인하다 찾았습니다. 화면이 「받은 줄이 20이면 다음 쪽이 있다」로
판단하고 있었는데, 오늘 조건에 맞는 공고가 **정확히 320건(20 × 16)** 이라
마지막 쪽이 꽉 찼고, 「다음쪽」을 누르면 빈 쪽이 나왔습니다.

세어서 확인한 것 — 0~15쪽 각 20줄 · 16쪽 0줄 · 겹치는 줄 0 ·
원본(`job_posts_pub`)에서 같은 조건으로 직접 센 것도 320.

`job_list` 가 전체 건수(`total`)를 줄마다 같이 내주게 했습니다.
`org_search` 가 이미 그렇게 하고 있어서 같은 방식으로 맞췄습니다.
한 번에 20건 제한은 그대로입니다 — 숫자 한 칸이 늘어날 뿐입니다.
