/* 경쟁사 글 30일 지나면 지우기 (2026-10-17 세중님 승인)
 *
 * ── 왜 ───────────────────────────────────────────────
 * `rival_post` 는 **견주기 용도**입니다 — 경쟁사가 먼저 올렸나 우리가 먼저 올렸나.
 * 한 달 지난 글은 그 질문에 쓸모가 없는데 계속 쌓입니다. 지금 30줄입니다.
 *
 * ── 이 파일을 따로 뺀 까닭 ──────────────────────────────
 * **`delete` 글자가 있어 승인 창이 뜹니다** (지침 8-7).
 * 그래서 ①② 고침(2026_10_17_마감내리기_잠김포함_시각까지.sql)과 **섞지 않았습니다** —
 * 섞으면 마감 고침이 승인 창에 발목 잡힙니다. **세중님이 자리에 계실 때** 올리십시오.
 *
 * ── 안 건드리는 것 ──────────────────────────────────
 * `job_posts`(우리 공고)에는 손대지 않습니다. `rival_post` 한 표뿐입니다.
 * 밤정리(`밤정리()`)에 끼우지 않고 **따로 부르는 함수**로 두었습니다 —
 * 밤정리는 회원 화면을 건드리는 일이고, 이것은 창고 치우기입니다.
 * 섞으면 밤정리가 실패했을 때 어느 쪽이 터졌는지 알기 어려워집니다.
 *
 * ── 올리기 전 마른 실행 (2026-10-17 09:40 KST) ──────────────
 *   `rival_post` 전체 30줄 · 그중 `처음본때 < now() - 30일` **0줄**
 *   → **지워지는 줄이 없습니다.** 앞으로 쌓이는 것을 막습니다.
 *
 * ── 쓰는 꼴 ───────────────────────────────────────
 *   select public.경쟁사_오래된글_지우기();       -- 기본 30일
 *   select public.경쟁사_오래된글_지우기(60);     -- 60일로
 * 크론에 넣을지는 **올린 뒤 따로** 정합니다 (지금은 손으로 부르는 함수만 만듭니다).
 */

create or replace function public.경쟁사_오래된글_지우기(p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_지움 int := 0;
  v_남음 int := 0;
begin
  perform set_config('app.누가', '경쟁사 오래된 글 지우기', true);

  delete from rival_post
  where 처음본때 < now() - (p_days || ' days')::interval;
  get diagnostics v_지움 = row_count;

  select count(*) into v_남음 from rival_post;

  return jsonb_build_object('지운 줄', v_지움, '남은 줄', v_남음, '며칠', p_days,
                            '언제', (now() at time zone 'Asia/Seoul'));
end $$;

revoke execute on function public.경쟁사_오래된글_지우기(integer) from public, anon, authenticated;
grant  execute on function public.경쟁사_오래된글_지우기(integer) to service_role;
