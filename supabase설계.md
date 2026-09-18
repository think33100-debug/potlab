# POT JOB · Supabase 설계안

2026-09-18 (2판) · `현황.md` (서버 v302 · 앱 a31) 를 바탕으로

**코드는 아직 없습니다.** 표 모양과 근거만 적었습니다. 아래 SQL 은 생김새를 보이려는 것이지 그대로 돌리는 것이 아닙니다.

## 0. 이 설계가 지키는 것

**화면을 전제로 짜지 않았습니다.** 지금 `index.html` 의 탭 8개도, 앞으로 만들 Next.js 화면도 설계에 안 들어옵니다. 판단 기준은 셋뿐입니다.

1. **자료 자체가 그런 모양인가** — 한 공고에 첨부가 여럿이면 표를 나눕니다. 화면이 첨부를 보여주든 말든.
2. **무엇으로 거르고 정렬하는가** — 거르는 칸만 진짜 칸으로 둡니다. 나머지는 JSON 으로 묶습니다.
3. **누가 볼 수 있는가** — RLS 로 DB 가 막습니다. 화면이 안 보여주는 것에 기대지 않습니다.

그래서 **React Native 에서도 같은 표·같은 RLS 를 그대로 씁니다.** 앱과 웹이 같은 PostgREST 를 부르고, 화면만 다릅니다.

이름은 전부 영문 소문자로 씁니다. 한글 칸 이름은 PostgREST·타입 생성·React Native 어디서나 따옴표를 달고 다녀야 합니다.

### 0-1. 무엇을 옮기고 무엇을 안 옮기나 (2026-09-18 결정)

| | |
|---|---|
| **옮깁니다** | 채용공고 · 공고수정 · 버림규칙 · 수집가능기관 · WN판정 — **다섯뿐입니다** |
| **비우고 시작합니다** | 급여데이터(13줄) · 알림설정 · 관심공고 · 공고반응 · 커뮤니티 전부 · 접근기록 |
| **CSV 에서 다시 붓습니다** | 기관 자료 8개 |

**회원은 0명에서 다시 시작합니다.** 설계가 훨씬 단순해집니다 — 옛 카카오ID 를 이어 붙이는 장치도, 임시 UUID 도, 「옮기는 동안만 쓰는 칸」도 필요 없습니다. 회원 표는 처음부터 제 모양으로 만듭니다.

---

## 1. 테이블 설계

### 1-1. 채용공고 35칸 → **한 테이블 + JSON 두 칸 + 첨부 표**

| 안 | 문제 |
|---|---|
| 통째로 한 테이블 (35칸 그대로) | 출처마다 채우는 칸이 달라 절반이 늘 NULL. HS(병원 게시판)는 제목·링크·날짜뿐이고 AL(알리오)은 전형단계까지 옵니다 |
| 출처별 표 7개 | **목록 조회가 늘 UNION 7개.** 이게 제일 자주 도는 질의입니다. 색인도 7벌, 규칙도 7벌 |
| **공통 칸 + JSON** ← 고름 | 거르는 칸만 진짜 칸. 본문은 공고 하나를 열 때만 읽습니다 |

**근거는 「무엇으로 거르는가」입니다.** 목록에서 쓰는 것은 지역·직군·마감·탭·숨김·보류 여섯입니다. 전형방법·제출서류·문의처로 거르는 일은 없습니다.

```sql
create table job_posts (
  id text primary key,            -- AL/JP/GJ/WN/ND/HS/BZ + 번호
  source text not null,
  external_id text,               -- 출처 쪽 번호 (중복 수집 방지)
  org_name text not null, title text not null,
  hire_type text, employ_type text,
  work_place text, sido text, sgg text,      -- 근무지 원문 + 뽑아낸 것
  edu text, headcount int,
  apply_from date, apply_to date, posted_at date,
  url text not null,
  job_group text, form text, org_kind text, tab text,
  hidden boolean not null default false,
  hold boolean not null default false,
  notify boolean not null default false,
  detail jsonb not null default '{}',    -- 일정·전형방법·지원자격·우대사항·결격사유
                                         -- ·자격증·제출서류·접수방법·문의처·연봉·기관홈
  evidence jsonb not null default '{}',  -- 분류근거·직군근거·탭근거·보류사유
  edited_fields text[] not null default '{}',
  detail_tries int not null default 0,   -- hs_dt_tried 가 있던 자리 (1-8 참고)
  collected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`external_id` 를 따로 둔 이유 — 지금은 `공고ID` 가 해시라 출처 쪽에서 제목만 바뀌어도 새 글이 됩니다. `unique (source, external_id)` 면 수집기가 UPSERT 로 덮어씁니다.

**첨부는 표를 나눕니다.** 나라일터 `getItemFile` 이 한 공고에 여럿을 주고 유형도 있습니다(`A=공고문 B=지원서 C=직무기술서`).

```sql
create table job_attachments (
  id bigserial primary key,
  job_id text not null references job_posts(id) on delete cascade,
  kind text, name text, url text not null,
  parsed_at timestamptz,          -- PDF 를 읽어 직군을 뽑은 시각
  unique (job_id, url)
);
```

JSON 에 넣어도 되지만 「아직 안 읽은 첨부」를 찾는 순간 표가 필요해집니다. 지금도 PDF 로 직군을 가리고 있어 곧 그 질의가 생깁니다.

### 1-2. 공고수정 → **본문을 직접 고치고, 이력은 따로**

지금은 원본을 안 건드리려고 시트를 따로 두고 **읽을 때마다** `applyFix_` 로 덮어씌웁니다. 공고를 한 건 읽든 백 건 읽든 매번 두 시트를 맞춰 봅니다.

DB 에서는 뒤집습니다.

- **본문을 직접 고칩니다.** 읽기가 표 하나로 끝납니다.
- 고친 칸 이름을 `edited_fields` 에 남기고, **수집기 UPSERT 는 이 칸들을 건드리지 않습니다.**
- 누가 언제 무엇을 바꿨는지는 `job_post_edits` 에 덧붙이기만 합니다.

```sql
create table job_post_edits (
  id bigserial primary key,
  job_id text not null references job_posts(id) on delete cascade,
  field text not null, old_value text, new_value text,
  edited_by uuid references profiles(id),
  edited_at timestamptz not null default now()
);
```

되돌리기는 `old_value` 를 쓰면 됩니다. **시트 시절보다 오히려 안전합니다** — 지금은 덮어쓴 값 하나만 남고 옛 값이 없습니다.

옮길 때 `공고수정` 시트의 값은 **`job_posts` 본문에 이미 반영된 상태로** 붓고, 고친 칸 이름을 `edited_fields` 에 넣습니다. 이력은 옛것까지 되살릴 필요 없습니다.

### 1-3. 회원 → **셋으로 나눔**

지금 36칸 중 절반이 늘 비던 이유는 하나입니다. **현직과 학생이 `구분` 칸 하나로 한 줄에 섞여 있습니다.** 회원을 0명에서 시작하므로 처음부터 나눠 만듭니다.

```sql
create table profiles (            -- 사람 그 자체
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null, job_group text not null,
  birth_year int, gender text, avatar text,
  pref_type text, pref_region text, memo text,
  excluded boolean not null default false,   -- 통계에서 뺌
  created_at timestamptz not null default now()
);

create table salary_records (      -- 현직만
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  hired_year int not null, region text not null,
  hospital_type text not null, employ_type text not null,
  net_monthly int not null,
  duty_count int, duty_hours int, weekend_count int, weekend_hours int,
  bonus_yearly int, extra_pay int, current_hired_year int,
  submitted_at timestamptz not null default now()
);

create table student_specs (       -- 학생만
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  school_type text, grade int, gpa numeric, gpa_scale numeric,
  lang_score int, licenses text[], trainings text[],
  practice jsonb, career jsonb,
  practice_months int, career_months int,
  submitted_at timestamptz not null default now()
);
```

**「현직/학생」 칸을 아예 두지 않습니다.** 급여 줄이 있으면 현직, 스펙 줄만 있으면 학생입니다. 칸으로 두면 칸과 실제 줄이 어긋날 수 있는데, 어긋나면 어느 쪽이 맞는지 아무도 모릅니다.

얻는 것 셋.

- **NOT NULL 을 걸 수 있습니다.** 한 줄에 섞여 있으면 아무 칸에도 못 겁니다.
- 통계가 각자 표만 봅니다. 급여 집계가 학생 줄을 걸러낼 필요가 없습니다.
- **학생이 졸업해 현직이 되면 줄을 하나 더 만들면 됩니다.** 학생 시절 스펙이 안 지워집니다 — 지금은 덮어써야 합니다.

### 1-4. 커뮤니티 — 사진·대댓글까지

```sql
create table posts (
  id bigserial primary key, channel text not null,
  author_id uuid not null references profiles(id) on delete cascade,
  title text, body text not null,
  hidden boolean not null default false,
  comment_count int not null default 0, like_count int not null default 0,
  view_count int not null default 0, report_count int not null default 0,
  created_at timestamptz not null default now(), edited_at timestamptz
);
create table comments (
  id bigserial primary key,
  post_id bigint not null references posts(id) on delete cascade,
  parent_id bigint references comments(id) on delete cascade,   -- 대댓글
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null, hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table post_likes (
  post_id bigint not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);
create table reports (
  id bigserial primary key,
  target_type text not null,       -- 'post' | 'comment'
  target_id bigint not null,
  reporter_id uuid not null references profiles(id),
  reason text, created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
```

**지금 시트와 달라지는 것 하나** — 글에 닉네임·직군·아바타를 **복사하지 않습니다.** 지금은 복사해 둬서 닉네임을 바꾸면 옛 글에 옛 닉네임이 남습니다.

**대댓글은 `parent_id` 한 칸이면 됩니다.** 깊이는 2단으로 제한합니다 — 「부모의 부모는 없어야 한다」 규칙 하나. 무한 깊이는 필요해지면 그때.

**셈(댓글수·좋아요수)은 칸으로 둡니다.** 목록이 제일 자주 도는 질의라 매번 `count(*)` 는 느립니다. 트리거로 맞춥니다.

### 1-5. 사진 — **올리기 전에 줄입니다**

사진은 나중에 붙이는 기능이 아니라 **처음부터 규칙으로 박습니다.** 한 번 원본이 쌓이기 시작하면 되돌리기 어렵습니다.

```
올리는 쪽(웹·앱)에서 두 장을 만듭니다
  본문용   긴 변 1600px · WebP · 품질 0.8   → 200~400KB
  목록용   긴 변  400px · WebP · 품질 0.7   →  20~40KB
원본은 올리지 않습니다.
```

```sql
create table post_images (
  id bigserial primary key,
  post_id bigint not null references posts(id) on delete cascade,
  path       text not null,        -- 1600px · 글을 열었을 때
  thumb_path text not null,        -- 400px · 목록·미리보기
  width int, height int,           -- 자리를 미리 잡아 화면이 안 튀게
  bytes int,
  sort int not null default 0
);
```

**목록에서는 `thumb_path` 만 받습니다.** 목록에 20개가 뜰 때 1600px 을 받으면 한 번에 4~8MB 입니다. 썸네일이면 400~800KB 입니다. **열 배 차이가 매달 전송량에 그대로 나타납니다.**

**왜 서버에서 안 줄이나** — 서버에서 줄이면 원본을 **이미 올린 뒤**입니다. 저장은 아껴도 올릴 때 쓴 전송량은 그대로 나갑니다. 폰에서 5MB 를 올리고 서버가 300KB 로 줄이면, 5MB 는 이미 썼습니다. **올리기 전에 줄이는 것만이 둘 다 아낍니다.**

만드는 방법은 웹·앱이 다르지만 결과는 같게 맞춥니다.

- 웹 — `createImageBitmap` 으로 읽고 `canvas` 에 줄여 그린 뒤 `toBlob('image/webp', 0.8)`
- 앱(React Native) — 사진 고르는 라이브러리가 대개 리사이즈를 같이 해줍니다. 안 되면 이미지 처리 모듈로

**둘이 같은 규칙을 쓰도록 한 곳에 적어 둡니다.** 웹은 1600, 앱은 2000 이면 같은 글에 크기가 섞입니다.

버킷은 둘로 나눕니다.

```
post-images   공개 읽기 · 쓰기는 본인 경로에만   {profile_id}/{uuid}.webp · {uuid}_t.webp
chat-images   비공개 · 방 사람만 · 서명 주소로 내려받기
```

**글을 지우면 사진도 지웁니다.** `on delete cascade` 는 DB 줄만 지우고 저장소 파일은 안 지웁니다. 지우는 함수에서 같이 지우거나, 주기적으로 주인 없는 파일을 치우는 일을 하나 둡니다. **이걸 안 하면 저장소만 조용히 찹니다.**

### 1-6. 1:1 대화

```sql
create table chat_rooms (
  id bigserial primary key,
  dm_key text unique,              -- 작은id||'-'||큰id · 방이 두 번 안 생기게
  created_at timestamptz not null default now()
);
create table chat_members (
  room_id bigint not null references chat_rooms(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default 'epoch',
  joined_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);
create table chat_messages (
  id bigserial primary key,
  room_id bigint not null references chat_rooms(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text, image_path text, image_thumb_path text,
  created_at timestamptz not null default now()
);
```

**참여자를 표로 뺀 이유** — 1:1 이라고 `user_a`·`user_b` 두 칸으로 두면 나중에 단톡방에서 표를 새로 짜야 합니다.

**읽음은 사람마다 시각 하나** 입니다. 안 읽은 수 = 그 시각 이후 메시지 수. 메시지마다 읽음을 남기면 메시지 하나에 사람 수만큼 줄이 생깁니다.

실시간은 Realtime 이 `chat_messages` INSERT 를 그대로 흘려보냅니다. 앱·웹 같은 코드입니다.

### 1-7. 공고반응 → 기록은 쌓고, 점수는 따로

```sql
create table job_events (
  id bigserial primary key,
  job_id text not null references job_posts(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,  -- 비로그인도 받음
  kind text not null,              -- click | stay | out | star
  value int,                       -- stay 는 초
  created_at timestamptz not null default now()
);
create table job_stars (           -- 관심공고
  profile_id uuid not null references profiles(id) on delete cascade,
  job_id text not null references job_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, job_id)
);
```

**찜은 기록과 따로 둡니다.** 「지금 찜한 상태인가」는 현재값, `job_events` 는 지나간 일입니다.

```sql
create materialized view job_scores as
select job_id,
       count(*) filter (where kind='click') * 1
     + count(*) filter (where kind='star')  * 5
     + sum(case when kind='stay' then least(value,120) else 0 end) / 30.0
     - count(*) filter (where kind='out')   * 1  as score,
       max(created_at) as last_at
from job_events where created_at > now() - interval '30 days'
group by job_id;
```

지금 `trk_score` 10분 캐시와 같은 주기로 갱신합니다. **회원 0명에서 시작하니 한동안은 그냥 뷰로 둡니다.** 느려지면 실체화하면 되고 부르는 쪽은 같습니다. 가중치는 예시이고 실제 값은 자료가 쌓인 뒤에 정하십시오.

### 1-8. 기관 자료 8개 → **따로 두고, 대조용 한 장을 덧댐**

**합치지 않습니다.** 원본이 다르고 칸이 다르고 **통째로 다시 붓는 자료**입니다. 하나로 합치면 한 곳을 갱신할 때 나머지 일곱을 건드립니다.

대신 대조에만 쓰는 한 장을 덧댑니다. `hospMatch_` 의 「이름 다듬기 + 지역 거르기 + 점수」 가 여기서 짧아집니다.

```sql
create materialized view org_directory as
  select 'hospital' as source, name, kind, sido, sgg from hospitals
  union all select 'public', name, kind, sido, sgg from public_orgs
  union all select 'care', name, type, sido, sgg from care_facilities ...;
create index on org_directory using gin (name gin_trgm_ops);
```

`pg_trgm` 으로 「전남대학교병원 ↔ 화순전남대학교병원」 을 점수로 뽑습니다.

### 1-9. 이어가기 상태 — 속성 15칸을 **두 갈래로**

지금 속성에 성격이 다른 둘이 섞여 있습니다.

**(가) 진짜 상태 한 덩어리** — `collect_cfg`·`hs_next`·`heavy_done`·`wn_done`·`wn_more`·`vpage_*`·`ypage`·`tick_log`·`tick_err`·`hs_last_log`·`drop_mailed`·`drop_rules_text`

```sql
create table collector_state (
  key text primary key, value jsonb not null,
  updated_at timestamptz not null default now()
);
```

`jsonb` 는 사실상 크기 걱정이 없습니다. **9KB 한도가 사라집니다.**

**(나) 원래 줄이 여럿이던 것** — `job3_done`·`hs_dt_tried`·`hs_cnt_*`

**JSON 덩어리로 만든 것 자체가 속성 한 칸에 넣으려던 억지였습니다.**

```sql
create table seen_postings (       -- job3_done 이 있던 자리
  source text not null, external_id text not null,
  opened_at timestamptz not null default now(),
  result text,                     -- 담음 / 버림 / 보류
  primary key (source, external_id)
);
```

- **600칸으로 잘라 쓰던 것이 다 들어갑니다.** 몇 만 줄이어도 상관없습니다.
- 「이미 열어봤나」가 JSON 파싱이 아니라 **색인 한 번**입니다.
- 오래된 것 지우기가 `delete ... where opened_at < now() - interval '90 days'` 한 줄입니다.

`hs_dt_tried` 는 **공고마다의 상태**라 표가 필요 없습니다 — `job_posts.detail_tries` 칸 하나(1-1). `hs_cnt_*` 는 사이트마다의 상태라 수집기 이관 때 `hosp_sites` 표로 같이 갑니다.

### 1-10. 색인

```sql
-- 목록: 안 숨기고 · 안 보류하고 · 아직 안 끝난 것을, 직군·지역으로
create index job_live_idx on job_posts (job_group, sido, posted_at desc)
  where not hidden and not hold;
create index job_deadline_idx on job_posts (apply_to) where not hidden and not hold;
create index job_tab_idx on job_posts (tab, posted_at desc) where not hidden and not hold;
create index job_title_trgm on job_posts using gin (title gin_trgm_ops);
create unique index job_src_uniq on job_posts (source, external_id) where external_id is not null;

create index on job_events (job_id, created_at desc);
create index on comments (post_id, created_at);
create index on posts (channel, created_at desc) where not hidden;
create index on post_images (post_id, sort);
create index on chat_messages (room_id, created_at desc);
create index on salary_records (hospital_type, region, hired_year);
create index on seen_postings (opened_at);
```

**부분 색인이 핵심입니다.** 숨긴·보류 공고는 목록에 안 나오는데 지금은 전부 읽고 자바스크립트로 거릅니다. 색인에서 빼면 목록이 훨씬 작아집니다. `sido` 를 칸으로 둔 이유도 같습니다 — 원문에 `LIKE '%서울%'` 하면 색인을 못 탑니다.

---

## 2. RLS

전부 `enable row level security` 로 시작합니다. **켜지 않은 표는 PostgREST 로 통째로 열립니다.**

```sql
create table admins (profile_id uuid primary key references profiles(id));
create function is_admin() returns boolean
  language sql security definer stable
  as $$ select exists (select 1 from admins where profile_id = auth.uid()) $$;
```

`profiles.role` 칸으로 안 두는 이유 — `profiles` 에 RLS 를 걸면 그 규칙 안에서 다시 `profiles` 를 읽어 **재귀에 걸립니다.**

| 표 | 읽기 | 쓰기 |
|---|---|---|
| `job_posts`·`job_attachments` | **누구나** (숨김·보류 뺀 것) | 서버만 · 관리자는 수정 |
| 기관 자료 8개·`org_directory` | 누구나 | 서버만 |
| `profiles` | 누구나 (닉네임·직군·아바타) | 본인만 |
| `salary_records`·`student_specs` | **집계만** | 본인만 |
| `job_stars`·`chat_*`·알림설정 | 본인만 | 본인만 |
| `posts`·`comments`·`post_images` | 누구나 (안 숨긴 것) | 글쓴이만 · 관리자는 숨김 |
| `job_events` | 아무도 못 읽음 | 누구나 넣기만 |
| `collector_state`·`seen_postings` | 서버만 | 서버만 |

```sql
create policy "공고는 누구나" on job_posts for select using (not hidden and not hold);
create policy "공고 수정은 관리자만" on job_posts for update using (is_admin());
-- service_role 키는 RLS 를 통과하므로 수집기는 따로 규칙이 필요 없습니다

create policy "내 찜만" on job_stars for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "글은 다 보임" on posts for select using (not hidden);
create policy "내 글만 고침" on posts for update using (author_id = auth.uid());
create policy "내 글만 지움" on posts for delete using (author_id = auth.uid() or is_admin());

create policy "내 방만" on chat_messages for select
  using (exists (select 1 from chat_members m
                 where m.room_id = chat_messages.room_id and m.profile_id = auth.uid()));
```

**급여 원본 줄은 아무에게도 안 보여줍니다.** 「상위 몇 %」는 집계지 남의 줄이 아닙니다. `security definer` 함수로만 내보내고, **n 이 3 미만이면 빈 값**을 돌려줍니다(지금 `MIN_PEER_FOR_RANK` 와 같은 규칙). 회원이 적을 때는 한 줄만 봐도 누군지 짐작됩니다. **0명에서 시작하니 한동안 이 규칙이 계속 걸립니다 — 정상입니다.**

**Storage 도 RLS 를 겁니다.** `post-images` 는 공개 읽기 · 쓰기는 `{profile_id}/…` 경로에만. `chat-images` 는 비공개로 두고 방 사람에게만 서명 주소를 발급합니다.

---

## 3. 인증

### 3-1. 카카오 · 애플 · 네이버 — **셋 다 됩니다** (직접 확인함)

Supabase 기본 목록에 **카카오와 애플이 있습니다.**

> Apple, Azure, Bitbucket, Discord, Facebook, Figma, GitHub, GitLab, Google, **Kakao**, Keycloak, LinkedIn, Notion, Slack, Spotify, Twitter, Twitch, WorkOS, Zoom

네이버는 이 목록에 없습니다. 그래서 **네이버가 OIDC 를 지원하는지 직접 두드려 봤습니다.**

```
GET https://nid.naver.com/.well-known/openid-configuration   →  HTTP 200 · application/json
{
  "issuer": "https://nid.naver.com",
  "authorization_endpoint": "https://nid.naver.com/oauth2/authorize",
  "token_endpoint":         "https://nid.naver.com/oauth2/token",
  "jwks_uri":               "https://nid.naver.com/oauth2/jwks",
  "userinfo_endpoint":      "https://openapi.naver.com/v1/nid/me",
  "response_types_supported":   ["code"],
  "scopes_supported":           ["openid", "profile"],
  "grant_types_supported":      ["authorization_code"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
  "code_challenge_methods_supported":      ["S256"],
  "subject_types_supported":               ["pairwise"],
  "id_token_signing_alg_values_supported": ["RS256"]
}

GET https://nid.naver.com/oauth2/jwks   →  HTTP 200 · RSA 공개키 2개
```

**네이버는 OIDC 를 제대로 지원합니다.** 표준 명세 자리에 문서가 있고, JWKS 도 있고, RS256 id_token 에 PKCE(S256)까지 됩니다.

Supabase 쪽 요건도 맞춰 봤습니다.

> **OIDC provider** — Use an OIDC provider when your identity provider supports OpenID Connect. Supply the `issuer` URL and the discovery document, JWKS, and endpoints are resolved automatically.
> The discovery document is fetched from `{issuer}/.well-known/openid-configuration`.
> **Free plan projects can add up to 3 custom providers. Pro plan and above have unlimited.**

**→ Edge Function 이 필요 없습니다.** 대시보드에서 「New Provider → Auto-discovery (OIDC)」 로 넣으면 끝입니다.

```
식별자      custom:naver        (custom: 로 시작해야 합니다)
Client ID   (지금 쓰는 것 그대로)
Secret      (지금 쓰는 것 그대로)
Issuer URL  https://nid.naver.com
Scopes      openid profile     (openid 는 안 적어도 자동으로 붙습니다)
```

Free 요금제에서 custom provider 3개까지인데 **우리는 네이버 하나면 됩니다.** 카카오·애플은 기본 제공이라 이 3개에 안 들어갑니다.

**지금 키를 그대로 쓸 수 있나 — 됩니다.** 실제로 두드려 봤습니다.

```
지금 CLIENT_ID 로 OIDC 창구 · 등록된 주소       → 302 → nidlogin.login  (정상)
지금 CLIENT_ID 로 OIDC 창구 · 안 등록된 주소     → 400 "Unable to log in to Potjob"
없는 CLIENT_ID 로 OIDC 창구                     → 404 Not Found
```

네이버가 우리 앱을 **이름(Potjob)까지 알아봅니다.** 지금 `wage.js` 가 쓰는 옛 창구(`/oauth2.0/authorize`)와 OIDC 창구(`/oauth2/authorize`)는 주소가 다른데, **같은 Client ID 가 양쪽에서 다 먹습니다.**

**바꿔야 할 것은 하나뿐입니다 — 콜백 주소.** 지금은 `https://potjob.co.kr/` 만 등록돼 있습니다. 네이버 개발자센터에서 Supabase 콜백 주소를 **추가**하십시오(지우지 말고 더하십시오 — 지우면 지금 서비스가 멈춥니다).

```
https://<프로젝트>.supabase.co/auth/v1/callback
```

**Edge Function 으로 붙일 필요가 없어졌으니**, 그 경우 늘어났을 코드(네이버 토큰 받기 · 검증 · Admin API 로 세션 만들기 · 갱신 · 오류 처리, 어림잡아 150~250줄에 우리가 계속 손봐야 하는 것)는 **하나도 안 씁니다.** 대시보드 설정 다섯 줄로 끝납니다.

**알아둘 것 하나** — `subject_types_supported` 가 `pairwise` 입니다. 네이버가 주는 식별자(`sub`)는 **앱마다 다릅니다.** 지금은 회원을 0명에서 시작하니 상관없지만, 나중에 네이버 앱 등록을 새로 만들면 **기존 네이버 회원이 전부 남남이 됩니다.** 앱 등록은 지금 것을 계속 쓰십시오.

### 3-2. `pass_()` 가 하던 일은 어디로

| 하던 일 | 어디로 |
|---|---|
| 카카오 토큰 확인 | **Supabase Auth.** Postgres 가 JWT 를 확인하고 `auth.uid()` 로 씁니다 — 우리 코드 없음 |
| 「급여 등록한 사람만」 | RLS 안 함수 하나 — `exists (select 1 from salary_records where profile_id = auth.uid())` |
| **분당 40회 제한** | **자동으로 안 됩니다.** 내장 제한은 인증 쪽(로그인·메일)에만 있습니다 |
| 접근기록 | **안 옮깁니다.** 필요하면 Supabase 로그 |

분당 제한만 새로 정하면 됩니다. 읽기는 원래 누구나 보는 것이고(하루 60건 제한은 구글 한도 때문이었지 정책이 아니었습니다), **쓰기만** 막으면 됩니다.

```sql
create policy "1분에 열 번까지" on posts for insert with check (
  author_id = auth.uid()
  and (select count(*) from posts
       where author_id = auth.uid() and created_at > now() - interval '1 minute') < 10
);
```

앞단(Vercel 미들웨어)에 두는 방법도 있지만 **앱에서 오는 요청은 그 앞단을 안 지납니다.** DB 에 두면 웹·앱 어디서 와도 같게 걸립니다.

---

## 4. 인증키 10개

| 방법 | 좋은 점 | 나쁜 점 | 언제 |
|---|---|---|---|
| **Edge Function 시크릿** | 기본. 코드·저장소에 안 남음 | Edge Function 밖에서는 못 씀 | 수집기를 Edge Function 으로 옮길 때 |
| **Supabase Vault** | **DB 안에서 꺼내 씁니다.** `pg_cron`+`pg_net` 으로 DB 가 직접 외부 API 를 부를 때 유일한 길 | DB 를 통째로 받아 가면 함께 감 | 수집을 DB 안에서 돌릴 때 |
| **GitHub Actions Secrets** | 이미 쓰고 계심(푸시 발송). 시간 제한이 느슨함 | 키가 두 군데로 갈라짐 | 수집기를 Actions 에 남길 때 |
| 외부 시크릿 매니저 | — | 키 10개에 과합니다 | 안 씀 |

**권하는 것** — 수집기 자리를 정할 때까지 **Edge Function 시크릿 한 곳**으로 모으고, DB 안에서 도는 것이 생기면 Vault 를 더합니다.

**카카오·네이버·애플 열쇠는 여기 안 셉니다.** 그건 Supabase Auth 설정에 들어가고 우리 코드가 안 만집니다. 10개 중 그 둘(`KAKAO_SECRET`·네이버)이 빠져 **우리가 관리할 키가 8개로 줄어듭니다.**

키가 두 군데 이상으로 갈라지는 것만 피하십시오 — 어디 뒀는지 잊는 게 새는 것보다 자주 일어납니다.

---

## 5. 옮기는 순서

**원칙 — 어느 단계에서 멈춰도 지금 서비스가 그대로 돌아야 합니다.** 회원을 안 옮기기로 해서 **제일 위험하던 단계가 통째로 사라졌습니다.**

| 단계 | 하는 일 | 되는 것 | 아직 안 되는 것 | 되돌리기 |
|---|---|---|---|---|
| **0** | 프로젝트 · 표 만들기 | 아무것도 안 바뀜 | 전부 | 프로젝트 삭제 |
| **1** | 기관 자료 8개 CSV 붓기 | DB 에서 병원 검색 | 회원 · 공고 | `TRUNCATE` |
| **2** | 공고 5종 베끼기 | DB 에 공고가 쌓임. **원본은 여전히 시트** | 쓰기 전부 | 표만 비움 |
| **3** | Next.js 화면이 **읽기만** | 새 화면에서 공고를 봄 (potjob.co.kr 그대로) | 로그인 · 찜 · 글쓰기 | 새 화면을 안 열면 끝 |
| **4** | 로그인 3종 (카카오·애플·네이버) + `profiles` | 가입 · 로그인 · 내 정보 | 커뮤니티 · 찜 | 옛 화면으로 계속 |
| **5** | 급여 · 찜 · 알림 · 반응 | 새 화면이 진짜가 됨 | 커뮤니티 | 회원이 적을 때 돌아서기 |
| **6** | 커뮤니티 + 사진 + 1:1 대화 | 새 기능 | 수집 | 기능만 끔 |
| **7** | 수집기 (따로 진행) | 시트 없이 돎 | — | 시트 수집기 다시 켬 |
| **8** | 도메인 전환 · Apps Script 읽기 전용 | 끝 | — | DNS 되돌리기 |

**옛 회원을 안 옮기니 「양쪽에 회원이 있는 상태」가 없습니다.** 새 화면에서 가입한 사람은 처음부터 Supabase 사람입니다. 옛 화면은 회원 0명인 채로 공고만 보여주다 닫으면 됩니다.

**5단계가 새로운 분기점입니다** — 여기서부터 급여 제출이 Supabase 에만 쌓입니다. 다만 그때도 회원이 이제 막 붙기 시작한 때라, 되돌릴 일이 생겨도 옮길 것이 얼마 없습니다.

베끼기는 **한 번 쓰고 버리는 스크립트**로. 시트 → CSV → `COPY` 가 가장 단순합니다. **양방향 동기화는 만들지 마십시오.** 각 단계 끝에 「시트 N줄 → DB N줄」을 숫자로 확인하십시오.

---

## 6. 돈

공식 요금표 기준 (2026-09-18 확인).

| | Free | Pro |
|---|---|---|
| 값 | 0 | **$25/월** |
| DB | **500 MB** | 8 GB (초과 GB당 $0.125) |
| 파일 | **1 GB** | 100 GB (초과 GB당 $0.0213) |
| 전송량 | **5 GB** | 250 GB (초과 GB당 $0.09) |
| 월 이용자 | 50,000 | 100,000 |
| Custom provider | **3개까지** (네이버 하나면 충분) | 무제한 |
| 멈춤 | **1주 안 쓰면 멈춤 · 2개까지** | 안 멈춤 · 매일 백업(7일) |

- **DB 500MB** — 한참 멉니다. 기관 자료를 다 부어도 20MB 안쪽. **다만 `job_events` 는 회원이 늘면 무한정 쌓입니다** — 30일 지난 것 지우는 규칙을 처음부터 넣으십시오.
- **전송량 5GB** — 이게 먼저 찹니다. 목록에서 `detail` 을 같이 받지 않는 것, **목록 사진은 썸네일만 받는 것** 둘만 지켜도 크게 다릅니다.
- **사진 1GB** — 1-5 의 규칙을 지키면:

| | 한 장 | 1GB 로 | 글 3장 기준 |
|---|---|---|---|
| 폰 원본 그대로 | 3~5MB | 200~300장 | 글 70~100개 |
| **1600px WebP (본문)** | 200~400KB | 2,500~5,000장 | **글 800~1,600개** |
| 400px WebP (썸네일) | 20~40KB | (덤) | |

**같은 1GB 로 열 배 이상 갑니다.** 본문 한 장과 썸네일 한 장을 같이 올려도 썸네일이 워낙 작아 셈이 거의 안 달라집니다.

**언제부터 돈이 드나 — 셋 중 먼저 오는 것**

1. 사진 1GB — 줄여 올리면 글 천 개 넘게 갑니다
2. 전송량 5GB/월 — 썸네일만 받으면 한참 멉니다
3. **1주 안 쓰면 멈춤 — 사실상 이게 제일 먼저입니다.** 서비스로 쓰는 순간 Free 는 못 씁니다. 멈춘 프로젝트는 손으로 깨워야 하고 그동안 앱이 죽습니다

**그래서 3·4단계(읽기·로그인만 얹어 써보는 동안)까지는 Free 로 충분하고, 5단계에서 쓰기를 넘기는 순간 Pro($25/월)로 올리십시오.** 회원이 붙는 서비스를 1주 만에 멈추는 판에 두는 건 위험합니다. 앱을 낼 거라면 더욱.

한 달 $25 는 지금 겪는 것 — 6분 제한 · 주소 7,500자 · 파일 업로드 불가 · 속성 9KB — 을 한꺼번에 없앱니다.

---

## 아직 안 정한 것

1. **인기순 가중치** — 자료가 쌓인 뒤에
2. **수집기를 어디서 돌릴지** — Edge Function · Actions · DB(pg_cron) 중. 이게 정해져야 인증키 자리도 정해집니다 (따로 하기로 하신 부분)
3. **사진 리사이즈를 웹·앱에서 어떤 것으로 할지** — 규칙(1600 · 400 · WebP)은 정했고 도구만 남았습니다

네이버·카카오 식별자 문제는 **둘 다 해결됐습니다.** 네이버는 OIDC 로 붙고, 회원을 안 옮기니 식별자를 맞출 일이 없습니다.
