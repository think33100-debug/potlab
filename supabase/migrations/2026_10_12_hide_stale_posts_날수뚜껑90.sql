/* hide_stale_posts — 마감일 없는 공고에 **날수 뚜껑 90일** (2026-10-12 · 세중님 승인)

   ── 왜 ───────────────────────────────────────────────────────
   ② 는 「처음 본 지 30일」로 내리는데 단서가 붙어 있습니다 —
       and not (seen_on >= 오늘 - 14 and coalesce(gone_streak,0) = 0)
   「정찰이 아직 그 사이트에서 보고 있다」면 안 내립니다. 그래서 병원이 몇 해 전
   글을 게시판에서 **안 내리면** 정찰은 영영 「살아 있다」고 보고, 공고가 영영
   회원에게 보입니다. 2026-10-12 에 다섯 건이 그랬습니다 —

     포천우리병원  2022-05-18  **1,608일**  물리치료실 필라테스, 도수치료 선생님 모집
     더자인병원    2024-08-20     783일   재활치료실 물리치료사/작업치료사 충원 채용
     한일병원      2025-07-31     438일   ○채용공고○물리치료사
     한일병원      2025-08-20     418일   ○채용공고○스포츠치료실 물리치료사
     뉴고려병원    2025-12-19     297일   2026년도 재활치료실 신규 작업치료사 채용

   ② 는 **그대로 둡니다.** 그 위에 뚜껑(②-2)을 하나 더 얹습니다.

   ── 까닭 글귀가 「…일 넘음」인 까닭 ──────────────────────────
   ④ 되살리기 갈래가 `hidden_why like '%일 지남'` 만 되살립니다.
   「넘음」으로 두면 **뚜껑으로 내린 것은 정찰이 다시 올리지 못합니다.**
   같은 날 alive_mark 에도 `not like '%넘음%'` 을 걸어 두 자리에서 막았습니다
   (2026_10_12_alive_mark_까닭과뚜껑보호.sql). 글귀 하나에 기대지 않으려는 것입니다.

   ── 담당자 공고(BIZ) ─────────────────────────────────────────
   ②·②-2 둘 다 `source <> 'BIZ'` 로 뺍니다. 담당자 공고는 수집기가 확인해 주지
   않아 `seen_on` 이 영영 비어 있어서, 안 빼면 30일 뒤 조용히 사라집니다
   (2026-10-09 에 정한 것). 그 대가로 **마감일 없는 BIZ 공고는 안 내려갑니다** —
   승인대기 ⑫ 에 적어 두었습니다.

   ── 권한 ─────────────────────────────────────────────────────
   전  postgres | service_role | authenticated
   후  postgres | service_role                    ← authenticated 를 걷었습니다
   까닭 — 이 함수는 **열쇠 검사가 없고** security definer 로 대량 update 를
   합니다. 로그인 회원 누구나 부를 수 있으면 안 됩니다 (2026-10-12 세중님).
   부르는 화면이 없는 것을 확인했습니다 (`web/` 에는 주석 두 곳뿐).

   **막히지 않는 것을 쏴서 증명했습니다** — `밤정리()` 는 security definer 이고
   임자가 postgres 라 안에서는 postgres 권한으로 돕니다.
     authenticated 로  select count(*) from admins  → permission denied
     authenticated 로  select is_admin()            → true
   = definer 함수는 임자 권한으로 돕니다. 그래서 밤정리 → hide_stale_posts 는
   그대로 돕니다. 걷은 뒤 회원으로 직접 불러 보면
     permission denied for function hide_stale_posts

   인수 기본값을 **그대로 다시 적습니다** — 빼면
   「cannot remove parameter defaults from existing function」 이 납니다.

   delete · drop 글자가 없습니다. */

create or replace function public.hide_stale_posts(
  p_days integer default 30,
  p_rolling_days integer default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  v_사유 text := p_days || '일 지남';
  v_정찰유효 int := 14;
  v_뚜껑일 int := 90;                                      -- ★ 새로 더한 것
  v_마감 int := 0; v_날수 int := 0; v_풀림 int := 0; v_정찰풀림 int := 0; v_뚜껑 int := 0;
begin
  perform set_config('app.누가', '지난 공고 감추기', true);

  /* ① 마감일이 지난 것 — 보이는 공고만, 보류함은 뺍니다.
     담당자 공고도 여기서는 같이 내립니다 (마감일은 담당자가 적은 값입니다) */
  update job_posts set hidden = true, hold = false, hidden_why = '마감 지남', hidden_on = v_오늘
  where apply_to is not null and apply_to < v_오늘 and not admin_locked
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

  /* ③ 마감일이 늘어났으면 다시 보이게 */
  update job_posts set hidden = false, hidden_why = null, hidden_on = null
  where hidden and hidden_why = '마감 지남' and not admin_locked
    and apply_to is not null and apply_to >= v_오늘;
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

/* 올린 뒤 한 번 돌린 결과 (2026-10-12 12:0x)
     {"며칠":30, "기준일":"2026-10-12", "30일 지남":0, "90일 뚜껑":5, "마감 지남":0,
      "다시 보이게":0, "날수 뚜껑(일)":90, "정찰 유효(일)":14,
      "정찰이 살아있다고 해서 다시 보이게":0}
   회원 화면 339 → 334 · 다섯 건 모두 hidden_why = 「90일 넘음 (정찰이 보고 있어도)」 */
