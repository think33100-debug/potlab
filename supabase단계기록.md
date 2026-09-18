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
