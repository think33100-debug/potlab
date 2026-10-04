-- ═══════════════════════════════════════════════════════════════
--  승인이 필요한 줄 — 「묶지 않음」을 되돌리는 함수 하나
--  2026-10-04. 올리지 않았습니다.
-- ═══════════════════════════════════════════════════════════════
--
--  왜 이것만 따로 있나
--    묶을 후보 쪽 나머지(표 1 · 함수 4)는 승인 창 없이 올라갔습니다.
--    이 함수 **하나만** 빼고 다시 올리니 그냥 통과했습니다 —
--    아래 delete 글자 때문입니다.
--
--  ★ 이 delete 는 **올릴 때 돌지 않습니다.**
--    함수 본문이라 글자로만 저장됩니다. 관리자가 화면에서
--    「되돌리기」를 누를 때만 그 한 줄이 돕니다.
--
--  무엇을 지우나
--    묶지않음 표의 **줄 하나** — 「이 두 공고는 다른 공고다」라고
--    눌러 둔 기록입니다. 지우면 그 짝이 다시 후보 목록에 올라옵니다.
--    공고(job_posts)는 손대지 않습니다. 표를 지우지도 않습니다.
--
--  안 올려도 화면은 돕니다
--    묶기·묶지 않음·풀기는 다 됩니다. 「묶지 않음」을 **잘못 눌렀을 때
--    되돌리는 길**만 없습니다. 그때는 이 쿼리를 손으로 한 번 돌리면 됩니다 —
--      delete from 묶지않음 where 왼쪽 = '...' and 오른쪽 = '...';

create or replace function 묶지않음되돌리기(p_왼쪽 text, p_오른쪽 text)
returns jsonb
language plpgsql volatile security definer set search_path to 'public'
as $$
declare n int;
begin
  if not is_admin() then
    raise exception '관리자만 할 수 있습니다' using errcode = '42501';
  end if;
  /* 짝을 늘 (작은 id, 큰 id) 로 맞춰 찾습니다 — 누른 차례와 무관합니다 */
  delete from 묶지않음
   where 왼쪽 = least(p_왼쪽, p_오른쪽) and 오른쪽 = greatest(p_왼쪽, p_오른쪽);
  get diagnostics n = row_count;
  return jsonb_build_object('되돌린줄', n);
end $$;

revoke all on function 묶지않음되돌리기(text, text) from public, anon;
grant execute on function 묶지않음되돌리기(text, text) to authenticated;

-- 올린 뒤 확인
--   select has_function_privilege('authenticated',
--            '묶지않음되돌리기(text,text)', 'execute');   → t
--   화면에서 「묶지 않음」을 누른 짝에 「되돌리기」가 보입니다
