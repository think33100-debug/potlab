/* hide_stale_posts — ① 잠긴 공고도 마감 지나면 내립니다 · ② 마감 **시각**까지 봅니다
 *   (2026-10-17 세중님 승인 · 승인 묶음 ①②)
 *
 * ── 왜 ───────────────────────────────────────────────
 * 2026-10-17 09:25 KST 에 **마감 지난 공고가 회원 화면에 보였습니다** (네숫자 ② 0 → 1).
 *   HS146236860 · 중앙보훈병원 물리치료사 계약직 · 마감 2026-10-16 09:00 KST
 * 밤정리를 당겨 돌렸는데 「마감 지나 옮긴 공고 0건」 이 나와 찾았습니다 —
 * `admin_locked = true` 라 ① 조건의 `not admin_locked` 에 걸려 **안 내려갔습니다.**
 * 잠근 사람은 세중님입니다(job_state_log 9036 · 2026-10-07 「그림 공고를 사람이 읽음」).
 * 정당한 조치였고 마감 전까지는 보이는 게 맞았습니다.
 *
 * **`admin_locked` 는 「값을 덮어쓰지 마라」는 뜻이지 「마감이 지나도 내리지 마라」가
 * 아닙니다.** 마감 지남은 값을 바꾸는 일이 아니라 내리는 일입니다.
 *
 * 그리고 구멍이 하나 더 있었습니다 — `apply_to_time` 이 09:00 인데 **날짜만** 봐서
 * 마감 당일은 종일 보였습니다. 이 공고는 합쳐 약 38시간 보였습니다.
 *
 * ── 무엇이 바뀌나 (①·③ 두 문단만) ─────────────────────────
 *   ① 내리기   `not admin_locked` 뺌 + 날짜 → **날짜+시각(KST)**
 *   ③ 되살리기 `not admin_locked` 뺌 + 날짜 → **날짜+시각(KST)**
 *              · `hidden_why = '마감 지남'` **정확히 같을 때만** (이 함수가 내린 것만)
 *              · `not hold` 더함 — **보류함 것은 절대 안 되살립니다**
 *   시각이 없으면 **그날 23:59 KST** 로 봅니다 (세중님 지시)
 *   ②·②-2·④ 는 **글자 하나 안 바꿨습니다.**
 *
 * ── 안 건드리는 것 ──────────────────────────────────
 * 쓰레기통은 `job_posts` 에 없습니다(별도) — 이 함수가 닿지 않습니다.
 * 관리자가 **다른 까닭으로** 숨긴 공고는 `hidden_why` 가 '마감 지남' 이 아니라
 * ③에 안 걸립니다. 보류함(hold)은 ①에서도 ③에서도 뺍니다.
 *
 * ── 권한 ───────────────────────────────────────────
 * **`create or replace` 이고 인수(integer, integer)와 기본값이 같습니다.**
 * 그래서 ACL 이 **그대로 보존됩니다** — `drop` 을 쓸 때만 날아갑니다 (지침 6-2a).
 * 그래도 끝에 revoke/grant 를 전과 **똑같이** 다시 적어 둡니다.
 * 인수 기본값을 그대로 다시 적습니다 — 빼면
 * 「cannot remove parameter defaults from existing function」 이 납니다.
 *
 * delete · drop 글자가 없습니다 (지침 8-7).
 *
 * ── 올리기 전 마른 실행 (2026-10-17 09:45 KST) ──────────────
 * 읽기만 하는 스크립트로 **SQL 과 같은 규칙**을 JS 로 다시 세었습니다.
 *   ① 내려갈 공고 0건 — ⓐ 날짜 지남 0 (그중 잠김 0) · ⓑ 오늘 마감인데 시각 지남 0 (잠김 0)
 *   ③ 되살아날 공고 0건 (그중 잠김 0)
 *   잰 바탕 — 보이는 공고(hidden=f·hold=f·마감일 있음) **345건** ·
 *             hidden_why='마감 지남' 이고 마감일 있는 것 **882건**(그중 보류함 0) ·
 *             회원 화면 job_posts_pub **351건**
 *   → **움직이는 줄이 없습니다.** 재발을 막는 고침입니다.
 *      (문제의 1건은 09:35 KST 에 손으로 내렸습니다 — hidden_why='마감 지남')
 *
 * ── 확인하지 못한 것 (세중님께) ─────────────────────────
 * **SQL 문법은 DB 에 걸어 보지 못했습니다.** 저장소에 마이그레이션 올리는 도구가 없고
 * (supabase CLI 는 깔리지만 config.toml 이 없어 link 가 안 되고 DB 비밀번호도 없습니다),
 * 그래서 `psql` 로도 `begin; … rollback;` 을 못 돌렸습니다.
 * 뜻이 맞는지는 JS 로 같은 규칙을 돌려 확인했지만, **괄호·형변환은 올리실 때 처음 검사됩니다.**
 */

create or replace function public.hide_stale_posts(
  p_days integer default 30,
  p_rolling_days integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_사유 text := p_days || '일 지남';
  v_정찰유효 int := 14;
  v_뚜껑일 int := 90;
  v_마감 int := 0; v_날수 int := 0; v_풀림 int := 0; v_정찰풀림 int := 0; v_뚜껑 int := 0;
begin
  perform set_config('app.누가', '지난 공고 감추기', true);

  /* ① 마감이 지난 것 — 보이는 공고만, 보류함은 뺍니다.
     ★ 2026-10-17 — `not admin_locked` 를 **뺐습니다.** 잠긴 공고도 마감이 지나면
       내립니다. 잠금은 「값을 덮어쓰지 마라」지 「내리지 마라」가 아닙니다.
     ★ 2026-10-17 — 날짜만 보던 것을 **날짜+시각(KST)** 으로 봅니다.
       `apply_to_time` 이 없으면 **그날 23:59 KST** 로 봅니다.
     담당자 공고도 여기서는 같이 내립니다 (마감일은 담당자가 적은 값입니다) */
  update job_posts set hidden = true, hold = false, hidden_why = '마감 지남', hidden_on = v_오늘
  where apply_to is not null
    and ((apply_to + coalesce(apply_to_time, time '23:59')) at time zone 'Asia/Seoul') < now()
    and not hidden and not hold;
  get diagnostics v_마감 = row_count;

  /* ② 마감일이 없고 아무 신호도 없는 것 — 지금까지와 같습니다 */
  update job_posts set hidden = true, hold = false, hidden_why = v_사유, hidden_on = v_오늘
  where apply_to is null and not admin_locked
    and source <> 'BIZ'
    and not hidden and not hold
    and coalesce(first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - p_days
    and not (seen_on is not null and seen_on >= v_오늘 - v_정찰유효
             and coalesce(gone_streak, 0) = 0);
  get diagnostics v_날수 = row_count;

  /* ★ ②-2 날수 뚜껑 — **정찰이 살아 있다고 해도** 내립니다 (2026-10-12) */
  update job_posts set hidden = true, hold = false,
         hidden_why = v_뚜껑일 || '일 넘음 (정찰이 보고 있어도)', hidden_on = v_오늘
  where apply_to is null and not admin_locked
    and source <> 'BIZ'
    and not hidden and not hold
    and coalesce(first_seen, (collected_at at time zone 'Asia/Seoul')::date) < v_오늘 - v_뚜껑일;
  get diagnostics v_뚜껑 = row_count;

  /* ③ 마감이 늘어났으면 다시 보이게
     ★ 2026-10-17 — `not admin_locked` 를 뺐습니다(①과 짝). 안 빼면 잠긴 공고는
       내려가기만 하고 **영영 못 올라옵니다.**
     ★ 되살리는 것은 **이 함수가 내린 것만** 입니다 —
       `hidden_why = '마감 지남'` 정확히 같을 때만. 관리자가 다른 까닭으로 숨긴 것,
       쓰레기통, 보류함(hold)은 **절대 안 건드립니다** (세중님 조건). */
  update job_posts set hidden = false, hidden_why = null, hidden_on = null
  where hidden and not hold
    and hidden_why = '마감 지남'
    and apply_to is not null
    and ((apply_to + coalesce(apply_to_time, time '23:59')) at time zone 'Asia/Seoul') >= now();
  get diagnostics v_풀림 = row_count;

  /* ④ 날수로 내렸는데 정찰이 살아있다고 본 것은 다시 보이게
     — 「%일 지남」만 봅니다. 뚜껑(「…일 넘음」)은 여기서 안 풀립니다 */
  update job_posts set hidden = false, hidden_why = null, hidden_on = null
  where hidden and not admin_locked
    and hidden_why like '%일 지남'
    and apply_to is null
    and seen_on is not null and seen_on >= v_오늘 - v_정찰유효
    and coalesce(gone_streak, 0) = 0;
  get diagnostics v_정찰풀림 = row_count;

  return jsonb_build_object('마감 지남', v_마감, v_사유, v_날수,
                            v_뚜껑일 || '일 뚜껑', v_뚜껑,
                            '다시 보이게', v_풀림, '정찰이 살아있다고 해서 다시 보이게', v_정찰풀림,
                            '기준일', v_오늘, '며칠', p_days,
                            '정찰 유효(일)', v_정찰유효, '날수 뚜껑(일)', v_뚜껑일,
                            '담당자 공고(BIZ)', '신호 없음으로는 안 내립니다',
                            '수시 며칠', '안 씁니다 — 정찰 규칙에 합쳤습니다');
end $$;

revoke execute on function public.hide_stale_posts(integer, integer) from public, anon, authenticated;
grant  execute on function public.hide_stale_posts(integer, integer) to service_role;
