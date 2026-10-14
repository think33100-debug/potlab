/* 강진의료원 「필기시험 장소 (변경) 공고」 2건을 보류함으로 — 2026-10-14 세중님 결정
 *
 *   기관 원문   [전라남도 공고 제2026-603호] … 통합채용 **필기시험 장소 변경 공고**
 *   우리 제목   강진의료원 전라남도 공고 제2026-603호 **물리치료사 채용공고**
 *   보인 기간   2026-09-30 ~ (15일) · apply_to 가 비어 저절로 안 내려갔습니다
 *
 * 「지난 공고」(hidden) 가 아니라 **보류함**(hold) 입니다 — 버리지 않습니다 (지침 15절).
 * `admin_decide('보류함으로')` 가 하는 것과 **같게** 씁니다. 그 창구는 `is_admin()`
 * 을 요구해서 서버 열쇠로는 못 부릅니다. `admin_locked` 를 켜야 수집기가
 * 다음 바퀴에 되살리지 않습니다.
 *
 * ★ 지우는 줄이 없습니다 — `update` 뿐입니다 (승인 창이 뜨지 않습니다 · 지침 8-7).
 *   `admin_decide` 의 `delete from rejudge_hidden` 은 뺐습니다 — 이 2건은 그 표에
 *   없습니다(0줄, 돌려서 확인). 지울 까닭이 없는 줄을 지우지 않습니다.
 */
select set_config('app.누가', '세중님 결정 (2026-10-14)', true);
select set_config('app.왜',
  '보류함으로 · 채용공고 아님 (시험장소 공고)', true);

update job_posts set
  hold         = true,
  hidden       = false,
  admin_locked = true,
  admin_at     = now(),
  admin_note   = '채용공고 아님 (시험장소 공고)',
  updated_at   = now()
where id in ('HS37047046', 'HS1611728177');
