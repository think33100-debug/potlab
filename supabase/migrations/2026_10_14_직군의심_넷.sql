/* 「직군 의심」 4건 — 2026-10-14 세중님 결정
 *
 * ① 강원대학교병원 「강원특별자치도광역치매센터 직원(육아휴직대체) 채용」
 *    세중님 규칙 — 「원문 응시자격·모집직종에 작업치료사가 있으면 그대로 두고
 *    근거를 evidence 에 원문 줄로」. **있습니다.** 원문을 받아 봤습니다
 *    (HTTP 200 · 태그 걷은 글 2,680자) —
 *
 *      「○ 자격 요건
 *         - 간호사, 작업치료사, 사회복지사1급 중 1개 이상 면허(자격) 소지자
 *         - 운전가능자」
 *
 *    → 그대로 둡니다. 원문 줄을 `evidence.직군근거원문` 에 적습니다.
 *
 *    ★ 그런데 **마감이 지났습니다.** 같은 원문에
 *        「가. 응시원서 접수: 2026.9.28.(월) ~ 2026.10.12.(월) 17:00」
 *      이라고 적혀 있는데 `apply_to` 가 비어 화면에 「마감일 공고문 확인」으로
 *      **이틀째** 떠 있습니다. 옛 Apps Script 수집기(source `HS`)가 마감일을
 *      안 담습니다. 「마감 지난 공고는 회원에게 보여주지 않는다」는 이 프로젝트의
 *      방침이라(CLAUDE.md 15절) 원문 줄 그대로 채웁니다 — 그러면 저절로 내려갑니다.
 *      **새 결정이 아니라 마감일 되메우기**입니다.
 *      `updated_at` 은 건드리지 않습니다 (지침 9절 — 되메우기).
 *
 * ② 사회적협동조합 프리지아 「발달장애인 주간활동센터 센터장 공고」
 *    → 보류함 「관리직(센터장) · 치료사 채용 아님」 · 잠금 켬
 *
 * ③ 마음건강복지관 「재활활동보조원 채용공고」
 *    → 보류함 「우리 직군 아님」 · 잠금 켬
 *
 * ④ 호원대학교 「물리치료학과 조교 채용」
 *    → 보류함 「학과 조교 · 치료사 채용 아님」 · 잠금 켬
 *
 * ★ 지우는 줄이 없습니다 — `update` 뿐입니다 (승인 창이 뜨지 않습니다 · 지침 8-7).
 */
select set_config('app.누가', '세중님 결정 (2026-10-14)', true);

/* ── ① 그대로 두고 근거를 원문 줄로 + 마감일 되메우기 ───────────────── */
select set_config('app.왜',
  '직군 근거를 원문 줄로 적고 마감일을 원문에서 채웁니다 (내리지 않습니다)', true);

update job_posts set
  evidence = coalesce(evidence, '{}'::jsonb) || jsonb_build_object(
    '직군근거원문',
      '원문 「○ 자격 요건 - 간호사, 작업치료사, 사회복지사1급 중 1개 이상 면허(자격) 소지자'
      || ' - 운전가능자」 (2026-10-14 에 기관 홈페이지를 받아 확인 · HTTP 200 · 2,680자)',
    '마감근거원문',
      '원문 「가. 응시원서 접수: 2026.9.28.(월) ~ 2026.10.12.(월) 17:00」'),
  apply_from    = coalesce(apply_from, '2026-09-28'::date),
  apply_to      = coalesce(apply_to,   '2026-10-12'::date),
  apply_to_time = coalesce(apply_to_time, '17:00'),
  deadline_src  = coalesce(deadline_src, '원문 · 응시원서 접수 (2026-10-14 손으로 확인)')
where id = 'HS1197110823';

/* ── ②③④ 보류함 + 잠금 ──────────────────────────────────────── */
select set_config('app.왜', '보류함으로 · 관리직(센터장) · 치료사 채용 아님', true);

update job_posts set
  hold = true, hidden = false, admin_locked = true, admin_at = now(),
  admin_note = '관리직(센터장) · 치료사 채용 아님', updated_at = now()
where id = 'WNK160012608180001';

select set_config('app.왜', '보류함으로 · 우리 직군 아님', true);

update job_posts set
  hold = true, hidden = false, admin_locked = true, admin_at = now(),
  admin_note = '우리 직군 아님 (재활활동보조원)', updated_at = now()
where id = 'WNK161132609030012';

select set_config('app.왜', '보류함으로 · 학과 조교 · 치료사 채용 아님', true);

update job_posts set
  hold = true, hidden = false, admin_locked = true, admin_at = now(),
  admin_note = '학과 조교 · 치료사 채용 아님', updated_at = now()
where id = 'WNK161322610010022';
