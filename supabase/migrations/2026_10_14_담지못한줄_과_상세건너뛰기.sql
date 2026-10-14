/* 2026-10-14 세중님 0·1번 — 돌린 SQL 을 저장소에 남깁니다
 *
 * 세 가지를 올렸습니다 (전부 create or replace · 승인 창 없음) —
 *   담지못한줄(int)          0번 · 수집기가 창구에 못 보낸 줄을 셉니다
 *   hold_digest(…)           0번 · 하루 요약에 그 숫자를 싣습니다 (default 24 그대로)
 *   상세건너뛸공고(text,text) 1번 · 오늘 이미 쓸 만한 본문을 받은 공고 + 그때 가린 직군
 *
 * 본문은 길어서 여기 다시 적지 않습니다 — 지금 DB 에 있는 것이 그대로입니다.
 * 다시 보려면:
 *   select prosrc from pg_proc where proname in
 *     ('담지못한줄', 'hold_digest', '상세건너뛸공고');
 *
 * 까닭과 전후 숫자는 docs/한줄때문에_안죽게_1014.md 에 있습니다.
 *
 * ⚠ hold_digest 의 인수에는 `default 24` 가 붙어 있습니다 — 빼면 42P13 으로
 *   막히고 DROP 이 필요해져 승인 창이 뜹니다 (지침 6-2 · 8-7).
 * ⚠ 셋 다 service_role 에만 열려 있습니다 (hold_digest 는 anon · 요약 스크립트가
 *   열쇠로 부릅니다). 끝에 revoke/grant 를 함께 걸었습니다 (지침 6-2 · 6-3).
 */
