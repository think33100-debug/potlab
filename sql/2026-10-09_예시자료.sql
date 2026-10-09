/* 예시(시험) 자료 — 화면마다 모든 상태를 눈으로 볼 수 있게 깝니다 (2026-10-09).
 *
 * ── 규칙 ─────────────────────────────────────────────────────
 * · 모든 줄에 시험자료 = true. 회원용 창구가 그 칸을 보고 걸러냅니다
 * · 붙는 곳은 둘뿐 — 기관 TEST:마스터시험병원 · 교육기관 「시험 교육기관 (마스터 전용)」
 * · 회원번호는 마스터와 excluded = true 인 시험 계정 셋만 씁니다
 *   (작업지침 8-9 — 시험 자료를 실제 회원 계정에 넣지 않습니다)
 * · 치우는 것은 시험자료치우기(). 올리는 쪽에 delete 가 한 줄도 없습니다
 *
 * 깔아 둔 상태 목록은 docs/화면상태목록.md 에 있습니다.
 * 견본 서류 여섯 장은 tools/견본서류만들기.mjs 가 만듭니다 (storage · 함수 밖).
 *
 * 돌리는 법 — 위에서 아래로 한 덩이씩. 교육 쪽이 먼저여야
 * 뒤 덩이의 회차 번호(2~6)가 맞습니다.
 */

/* ═══ ① 교육 — 회차 다섯 가지 상태 ═══════════════════════════ */
do $$
declare M constant uuid := '3a204fae-3180-42ee-a637-7ad62166e4c4';
        S constant uuid := '6bc01c4a-514d-4b6a-b9fa-c061bf0b8ed5';  -- 시험학생
        P constant uuid := 'b2b4c0e8-3f35-4356-95c1-f235182aaf11';  -- 시험물리
        기관 constant text := '시험 교육기관 (마스터 전용)';
        오늘 date := (now() at time zone 'Asia/Seoul')::date;
        c1 bigint; c2 bigint; c3 bigint; c4 bigint; c5 bigint;
        s1 bigint; s2 bigint; s3 bigint; s4 bigint; s5 bigint;
        r1 bigint;
begin
  /* 마스터를 이 기관 담당자로 둡니다 (예시 표시) */
  insert into 회원자격 (profile_id, 갈래, 교육기관, 상태, 정한사람, 정한때, 시험자료)
  values (M, '교육담당자기관', 기관, '승인', M, now(), true)
  on conflict (profile_id, 교육기관) where 갈래 = '교육담당자기관'
    do update set 상태 = '승인', 시험자료 = true;

  /* 모집중 — 자리 넉넉 */
  insert into 교육과정 (주최갈래, 교육기관, 제목, 직군, 소개, 만든이, 시험자료)
  values ('기관', 기관, '[예시] 연하재활 기초 과정', '작업치료사',
          '예시 자료입니다. 실제 교육이 아닙니다.', M, true) returning 과정id into c1;
  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 입금기한, 입금자명규칙, 환불규정, 시험자료)
  values (c1, 오늘 + 20, 오늘 + 21, '서울 (예시)', 20, 오늘 - 2, 오늘 + 15, 120000,
          '국민은행', '000000-00-000000', '예시교육기관', 오늘 + 10,
          '이름 + 전화 뒤 4자리',
          E'시작 7일 전까지 전액 환불\n3일 전까지 50%\n그 뒤에는 환불이 안 됩니다', true)
  returning 회차id into s1;

  /* 정원이 찬 회차 (정원 1 · 확정 1 → 마감) */
  insert into 교육과정 (주최갈래, 교육기관, 제목, 직군, 소개, 만든이, 시험자료)
  values ('기관', 기관, '[예시] 수부 보조기 실습 (정원 참)', '작업치료사',
          '예시 자료입니다.', M, true) returning 과정id into c2;
  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 입금기한, 입금자명규칙, 환불규정, 상태, 시험자료)
  values (c2, 오늘 + 30, 오늘 + 30, '부산 (예시)', 1, 오늘 - 5, 오늘 + 20, 90000,
          '국민은행', '000000-00-000000', '예시교육기관', 오늘 + 7,
          '이름 그대로', '시작 7일 전까지 전액 환불', '마감', true)
  returning 회차id into s2;
  insert into 교육신청 (회차id, profile_id, 상태, 입금눌렀나, 입금누른때, 시험자료)
  values (s2, S, '참여확정', true, now(), true);

  /* 모집이 끝난 회차 — 미선정 한 명 */
  insert into 교육과정 (주최갈래, 교육기관, 제목, 직군, 소개, 만든이, 시험자료)
  values ('기관', 기관, '[예시] 인지재활 심화 (모집 끝)', '작업치료사',
          '예시 자료입니다.', M, true) returning 과정id into c3;
  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 환불규정, 상태, 시험자료)
  values (c3, 오늘 + 5, 오늘 + 5, '대구 (예시)', 2, 오늘 - 20, 오늘 - 1, 150000,
          '국민은행', '000000-00-000000', '예시교육기관', '시작 7일 전까지 전액 환불', '끝남', true)
  returning 회차id into s3;
  insert into 교육신청 (회차id, profile_id, 상태, 시험자료)
  values (s3, S, '참여확정', true), (s3, P, '미선정', true);

  /* 지난 과정 — 리뷰 있음 + 담당자 답글 */
  insert into 교육과정 (주최갈래, 교육기관, 제목, 직군, 소개, 만든이, 시험자료)
  values ('기관', 기관, '[예시] 삼킴 평가 워크숍 (지난 과정)', '작업치료사',
          '예시 자료입니다.', M, true) returning 과정id into c4;
  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 환불규정, 상태, 시험자료)
  values (c4, 오늘 - 30, 오늘 - 30, '서울 (예시)', 10, 오늘 - 60, 오늘 - 35, 80000,
          '국민은행', '000000-00-000000', '예시교육기관', '시작 7일 전까지 전액 환불', '끝남', true)
  returning 회차id into s4;
  insert into 교육신청 (회차id, profile_id, 상태, 입금눌렀나, 시험자료)
  values (s4, S, '참여확정', true, true);
  insert into 교육리뷰 (회차id, profile_id, 별점, 글, 시험자료)
  values (s4, S, 5, '예시 후기입니다. 실습 시간이 넉넉해서 좋았어요.', true)
  returning 리뷰id into r1;
  insert into 교육리뷰답글 (리뷰id, profile_id, 글, 시험자료)
  values (r1, M, '예시 답글입니다. 와 주셔서 고맙습니다.', true);

  /* 첫날 08시 전이라 아직 후기를 못 쓰는 회차 */
  insert into 교육과정 (주최갈래, 교육기관, 제목, 직군, 소개, 만든이, 시험자료)
  values ('기관', 기관, '[예시] 보조공학 입문 (후기 아직)', '물리치료사',
          '예시 자료입니다.', M, true) returning 과정id into c5;
  insert into 교육회차 (과정id, 시작, 끝, 장소, 정원, 접수시작, 접수끝, 수강료,
                        은행, 계좌번호, 예금주, 입금기한, 입금자명규칙, 환불규정, 시험자료)
  values (c5, 오늘 + 3, 오늘 + 3, '광주 (예시)', 10, 오늘 - 10, 오늘 + 1, 60000,
          '국민은행', '000000-00-000000', '예시교육기관', 오늘,
          '이름 그대로', '시작 7일 전까지 전액 환불', true)
  returning 회차id into s5;
  insert into 교육신청 (회차id, profile_id, 상태, 입금눌렀나, 입금누른때, 시험자료)
  values (s5, P, '참여확정', true, now(), true),
         (s5, S, '입금대기', false, null, true);
end $$;

/* ═══ ② 담당자 자격 · 재직 인증 · 1:1 대화 · 알림 · 커뮤니티 글 ═══ */
do $$
declare M constant uuid := '3a204fae-3180-42ee-a637-7ad62166e4c4';  -- 마스터
        S constant uuid := '6bc01c4a-514d-4b6a-b9fa-c061bf0b8ed5';  -- 시험학생
        P constant uuid := 'b2b4c0e8-3f35-4356-95c1-f235182aaf11';  -- 시험물리
        E constant uuid := 'ff6b44ed-ac07-467b-9bda-ce19e121dbd1';  -- 시험빈계정
        병원 constant text := 'TEST:마스터시험병원';
        학원 constant text := '시험 교육기관 (마스터 전용)';
        견본 constant text := '3a204fae-3180-42ee-a637-7ad62166e4c4/';
        q1 bigint; q2 bigint; q3 bigint; q4 bigint; q5 bigint;
        방1 bigint; 방2 bigint; 방3 bigint;
begin
  /* ───── 담당자 자격 — 갈래 3 × 상태 4 ───── */
  insert into 회원자격 (profile_id, 갈래, 기관번호, 상태, 사업자번호, 사업자상태,
                        사업자확인때, 사업자확인법, 시험자료)
  values (S, '채용담당자', 병원, '심사중', '0000000000', '계속사업자',
          now(), '국세청 진위확인', true) returning id into q1;

  insert into 회원자격 (profile_id, 갈래, 기관번호, 상태, 사업자번호, 사업자상태,
                        사업자확인때, 사업자확인법, 정한사람, 정한때, 시험자료)
  values (P, '채용담당자', 병원, '승인', '0000000001', '휴업자',
          now(), '국세청 진위확인', M, now(), true) returning id into q2;

  insert into 회원자격 (profile_id, 갈래, 기관번호, 상태, 사업자번호, 사업자상태,
                        사업자확인때, 사업자확인법, 반려까닭, 정한사람, 정한때, 시험자료)
  values (E, '채용담당자', 병원, '반려', '0000000002', '폐업자',
          now(), '국세청 진위확인',
          '예시 반려 사유입니다. 사업자 상태가 폐업으로 확인됐어요.',
          M, now(), true) returning id into q3;

  insert into 회원자격 (profile_id, 갈래, 교육기관, 상태, 시험자료)
  values (P, '교육담당자기관', 학원, '심사중', true) returning id into q4;

  insert into 회원자격 (profile_id, 갈래, 상태, 면허확인, 정한사람, 정한때, 반려까닭, 시험자료)
  values (S, '교육담당자개인', '정지', true, M, now(),
          '예시 정지 사유입니다. 신고가 쌓여 잠시 멈췄어요.', true) returning id into q5;

  /* ───── 인증자료 — 갈래별 한 장씩 · 지운 것도 한 줄 ───── */
  insert into 인증자료 (profile_id, 자격id, 갈래, 경로, 시험자료) values
    (S, q1, '사업자등록증', 견본 || 'sample-3.pdf', true),
    (P, q2, '사업자등록증', 견본 || 'sample-3.pdf', true),
    (P, q2, '사원증',       견본 || 'sample-4.pdf', true),
    (P, q4, '고유번호증',   견본 || 'sample-1.pdf', true),
    (S, q5, '면허증',       견본 || 'sample-6.pdf', true);
  insert into 인증자료 (profile_id, 자격id, 갈래, 경로, 지운때, 지운까닭, 시험자료)
  values (E, q3, '사업자등록증', 견본 || 'sample-3.pdf', now(), '반려 후 정리', true);

  /* ───── 재직 인증 — 상태 셋 ───── */
  insert into 재직인증 (profile_id, 상태, 병원이름, 경로, 시험자료)
  values (S, '심사중', '시험병원 (마스터 전용)', 견본 || 'sample-5.pdf', true);
  insert into 재직인증 (profile_id, 상태, 병원이름, 경로, 파일지운때,
                        정한사람, 정한때, 시험자료)
  values (M, '확인', '시험병원 (마스터 전용)', null, now(), M, now(), true);
  insert into 재직인증 (profile_id, 상태, 병원이름, 경로, 파일지운때,
                        정한사람, 정한때, 반려까닭, 시험자료)
  values (P, '반려', '시험병원 (마스터 전용)', null, now(), M, now(),
          '예시 반려 사유입니다. 글씨가 안 보여요. 다시 올려 주세요.', true);

  /* ───── 1:1 대화 ───── */

  -- 신청 — 마스터가 「받을지」 정하는 자리 (시험학생이 걸었습니다)
  insert into chat_rooms (dm_key, 상태, 건사람, 시험자료)
  values (least(S::text, M::text) || '|' || greatest(S::text, M::text), '신청', S, true)
  returning id into 방1;
  insert into chat_members (room_id, profile_id) values (방1, S), (방1, M);
  insert into chat_messages (room_id, sender_id, body)
  values (방1, S, '예시 자료입니다. 말 걸기 신청 상태예요.');

  -- 수락 — 글 둘 + 사진 둘 (안 본 것 · 본 것)
  insert into chat_rooms (dm_key, 상태, 건사람, 시험자료)
  values (least(P::text, M::text) || '|' || greatest(P::text, M::text), '수락', M, true)
  returning id into 방2;
  insert into chat_members (room_id, profile_id) values (방2, M), (방2, P);
  insert into chat_messages (room_id, sender_id, body, created_at) values
    (방2, M, '예시 대화입니다. 안녕하세요.',  now() - interval '20 min'),
    (방2, P, '예시 답입니다. 네 안녕하세요.',  now() - interval '18 min');
  -- 아직 안 본 사진 — 본때가 비어 창구가 경로를 줍니다
  insert into chat_messages (room_id, sender_id, image_path, created_at)
  values (방2, P, 견본 || 'sample-2.pdf', now() - interval '12 min');
  -- 이미 본 사진 — 경로는 남아 있고 대화읽기() 가 안 줍니다.
  -- chat_messages 는 「글이나 사진 중 하나는 있어야」 하는 제약이 있어 경로를 못 비웁니다
  insert into chat_messages (room_id, sender_id, image_path, 본때, created_at)
  values (방2, P, 견본 || 'sample-2.pdf', now() - interval '5 min', now() - interval '10 min');

  -- 거절 — 내대화() 가 안 보여 줍니다 (상태 <> '거절')
  insert into chat_rooms (dm_key, 상태, 건사람, 시험자료)
  values (least(E::text, M::text) || '|' || greatest(E::text, M::text), '거절', M, true)
  returning id into 방3;
  insert into chat_members (room_id, profile_id) values (방3, M), (방3, E);
  insert into chat_messages (room_id, sender_id, body)
  values (방3, M, '예시 자료입니다. 상대가 거절한 방이에요.');

  insert into 대화차단 (막은사람, 막힌사람) values (S, P) on conflict do nothing;

  /* ───── 알림 — 갈래별 · 읽음과 안읽음 ───── */
  insert into 알림함 (profile_id, 갈래, 제목, 본문, 링크, 읽은때, 만든때, 시험자료) values
    (M, '마감임박', '찜한 공고가 사흘 뒤 마감이에요', '예시 알림입니다.', '/jobs',
      null,  now() - interval '1 hour', true),
    (M, '새공고',   '찜한 기관에 새 공고가 올라왔어요', '예시 알림입니다.', '/jobs',
      null,  now() - interval '3 hour', true),
    (M, '대화신청', '말을 걸어온 분이 있어요', '받을지 안 받을지 고르실 수 있어요.', '/talk',
      null,  now() - interval '5 hour', true),
    (M, '대화수락', '대화가 시작됐어요', null, '/talk/' || 방2,
      now(), now() - interval '7 hour', true),
    (M, '교육신청', '신청이 접수됐어요', '입금 안내를 확인해 주세요.', '/edu',
      now(), now() - interval '1 day',  true),
    (M, '자격결과', '담당자 신청이 승인됐어요', '이제 공고를 올리실 수 있어요.', '/partner',
      now(), now() - interval '2 day',  true),
    (M, '재직결과', '재직 확인이 끝났어요', '배지가 붙었어요.', '/verify',
      now(), now() - interval '3 day',  true),
    (S, '마감임박', '찜한 공고가 사흘 뒤 마감이에요', '예시 알림입니다.', '/jobs',
      null,  now() - interval '2 hour', true);

  /* ───── 커뮤니티 — 중고거래 · 자유 ───── */
  insert into posts (channel, author_id, title, body, 시험자료) values
    ('market', M, '[예시] 평가도구 나눔합니다',
     E'예시 글입니다. 실제 거래가 아닙니다.\n가격 0원 · 지역 서울', true),
    ('market', S, '[예시] 교재 구합니다',
     '예시 글입니다. 실제 거래가 아닙니다.', true),
    ('free',   P, '[예시] 첫 출근 후기', '예시 글입니다.', true);
end $$;

/* ═══ ③ 운영진이 쓴 글 표시 ═══════════════════════════════════
   posts 에는 쓴역할 칸을 안 둡니다 — 있으면 REST select 로 페르소나가 드러납니다 */
insert into 운영진글 (글번호, 갈래, 쓴역할, 시험자료)
select p.id, '글', '작업치료사', true
  from posts p
 where p.시험자료 and p.author_id = '3a204fae-3180-42ee-a637-7ad62166e4c4'
on conflict do nothing;

/* ═══ ④ 마스터의 교육 신청 — 페르소나를 안 바꿔도 네 상태가 보이게 ═══
   아래 회차 번호는 ① 을 처음 돌렸을 때 나온 값입니다.
   다시 깔 때는 select 회차id, 제목 from 교육회차 join 교육과정 using (과정id)
   where 시험자료 로 번호를 확인하고 바꿔 넣으십시오.
     2 신청 안 함     → 신청하기 단추 · 「계좌는 신청하시면」
     3 입금대기       → 계좌 칸 · 「입금했어요」 단추
     4 미선정         → 단추 없음
     5 참여확정(지난) → 후기 쓰기 칸 열림
     6 참여확정(앞)   → 「후기는 첫날 오전 8시부터」 */
insert into 교육신청 (회차id, profile_id, 상태, 입금눌렀나, 입금누른때, 시험자료) values
  (3, '3a204fae-3180-42ee-a637-7ad62166e4c4', '입금대기',  false, null,  true),
  (4, '3a204fae-3180-42ee-a637-7ad62166e4c4', '미선정',    false, null,  true),
  (5, '3a204fae-3180-42ee-a637-7ad62166e4c4', '참여확정',  true,  now(), true),
  (6, '3a204fae-3180-42ee-a637-7ad62166e4c4', '참여확정',  true,  now(), true)
on conflict do nothing;

/* ═══ ⑤ 교육회차보기() 의 시험자료 구멍 막기 ═══════════════════
   목록(신청가능교육)은 걸러내는데 여기는 안 걸렀습니다 —
   회차 번호만 알면 회원도 열 수 있었습니다. 전문은 마이그레이션
   2026_10_09_교육회차보기_시험자료_가리기 에 있습니다. 바뀐 줄은 이 한 줄입니다:

     and (not s.시험자료 or 시험자료볼까())
*/
