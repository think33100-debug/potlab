/* alive_mark — ① 까닭 글귀를 부르는 쪽이 정하게, ② 날수 뚜껑으로 내린 줄은 안 되살리게
   (2026-10-12 · 세중님 승인)

   ── 왜 ①  까닭 글귀 ──────────────────────────────────────────
   정찰에 ⑥「목록 줄의 상태 칸」을 더했습니다 (tools/hosp/hs_목록상태.mjs).
   그런데 alive_mark 는 closed 를 받으면 까닭을 늘 「제목·본문에 마감」 으로
   적습니다. 목록 줄로 내린 것까지 그렇게 적히면, 관리자 화면에서 그 글귀를
   보고 상세를 열어 「마감이라는 말이 어디 있지」 하고 찾게 됩니다.
   그래서 부르는 쪽이 글귀를 넘기게 합니다. 안 넘기면 전과 같습니다.

   ── 왜 ②  뚜껑 보호 ──────────────────────────────────────────
   같은 날 올리는 hide_stale_posts 의 ②-2 가 「90일 넘음 (정찰이 보고 있어도)」
   으로 내립니다. 그런데 alive_mark 의 되살림 갈래는 **까닭을 안 봅니다** —
       where id = v_id and hidden and not admin_locked
   지금은 alive_targets 가 그 줄을 안 줘서 못 닿지만(평소 `not hidden`,
   --내린것 은 `hidden_why like '%일 지남'`), 그건 글귀가 우연히 안 겹친
   덕입니다. 누가 까닭을 「90일 지남」 으로 바꾸면 그날 구멍이 열립니다.
   뚜껑은 「사이트가 몇 해 전 글을 안 내린다」는 뜻이라, 본문에 적힌 접수기간이
   미래라도 믿을 수 없습니다 (포천우리병원 2022-05-18 공고가 1,608일째).

   ── 고친 줄 ──────────────────────────────────────────────────
   ★1  v_까닭 선언
   ★2  v_까닭 := coalesce(nullif(r->>'까닭',''), '제목·본문에 마감')
   ★3  되살림 갈래에  and coalesce(hidden_why,'') not like '%넘음%'
   ★4  closed 두 자리의 hidden_why 를 v_까닭 으로
   나머지는 지금 글자 그대로입니다.

   ── 권한 ─────────────────────────────────────────────────────
   인수가 그대로라 **새 함수가 아닙니다.** 그래도 지침 6-2 대로 끝에서 다시 겁니다.
   지금 ACL 과 **똑같이** 맞춥니다 — postgres · service_role · anon · authenticated.
   anon 을 두는 까닭: 옛 alive.yml(GitHub)이 anon 열쇠로 부릅니다.
   권한은 함수 안의 ALIVE_KEY 검사로 봅니다 (service_role 열쇠는 GitHub 에 안 둡니다).

   delete · drop 글자가 없습니다. */

create or replace function public.alive_mark(p_secret text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  r jsonb; v_살아 int := 0; v_사라 int := 0; v_감춤 int := 0; v_모름 int := 0;
  v_마감표시 int := 0; v_기간채움 int := 0; v_되살림 int := 0; v_수시라패스 int := 0;
  v_까닭고침 int := 0;
  v_날 date; v_id text; v_기간 text;
  v_까닭 text;                                             -- ★1
begin
  if not exists (select 1 from collect_secret s where s.source = 'ALIVE' and s.secret = p_secret
                   and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '정찰 · 원문 확인', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_id := r->>'id';
    v_기간 := coalesce(r->>'접수기간', '');
    /* ★2 까닭을 부르는 쪽이 정합니다. 안 보내면 전과 같습니다 */
    v_까닭 := coalesce(nullif(r->>'까닭', ''), '제목·본문에 마감');

    if v_기간 <> '' then
      if v_기간 ~ '채용\s*시|충원\s*시|결원\s*시|적격자|상시|수시' then
        v_수시라패스 := v_수시라패스 + 1;
      else
        v_날 := deadline_from_title(v_기간, v_오늘);
        if v_날 is not null then
          update job_posts
             set apply_to = v_날,
                 deadline_src = '정찰 · 본문 접수기간 (' || v_오늘 || ')'
           where id = v_id and apply_to is null and not admin_locked;
          if found then
            v_기간채움 := v_기간채움 + 1;
            if v_날 >= v_오늘 then
              update job_posts
                 set hidden = false, hidden_why = null, hidden_on = null, gone_streak = 0
               where id = v_id and hidden and not admin_locked
                 /* ★3 날수 뚜껑으로 내린 줄은 안 되살립니다 */
                 and coalesce(hidden_why, '') not like '%넘음%';
              if found then v_되살림 := v_되살림 + 1; end if;
            end if;
          end if;
        end if;
      end if;
    end if;

    /* 마감일이 있고 그 날이 지났으면 까닭은 「마감 지남」 입니다 (2026-10-07) */
    update job_posts set hidden_why = '마감 지남'
     where id = v_id and hidden and not admin_locked
       and hidden_why like '%일 지남' and hidden_why not like '%(수시)%'
       and apply_to is not null and apply_to < v_오늘;
    if found then v_까닭고침 := v_까닭고침 + 1; end if;

    if (r->>'결과') = 'alive' then
      update job_posts set gone_streak = 0, seen_on = v_오늘 where id = v_id;
      v_살아 := v_살아 + 1;

    elsif (r->>'결과') = 'closed' then
      update job_posts
         set hidden = true, hold = false, seen_on = v_오늘,
             hidden_why = v_까닭, hidden_on = v_오늘              -- ★4
       where id = v_id and not hidden and not admin_locked;
      if found then v_마감표시 := v_마감표시 + 1; end if;
      update job_posts set hidden_why = v_까닭, seen_on = v_오늘   -- ★4
       where id = v_id and hidden and not admin_locked
         and hidden_why like '%일 지남' and hidden_why not like '%(수시)%';
      if found then v_까닭고침 := v_까닭고침 + 1; end if;

    elsif (r->>'결과') = 'gone' then
      update job_posts set gone_streak = least(coalesce(gone_streak,0) + 1, 9), seen_on = v_오늘
       where id = v_id and not admin_locked;
      v_사라 := v_사라 + 1;
      update job_posts set hidden = true, hold = false,
             hidden_why = '병원이 내림', hidden_on = v_오늘
       where id = v_id and coalesce(gone_streak,0) >= 2 and not admin_locked
         and hidden_why is distinct from '병원이 내림'
         and (not hidden or (hidden_why like '%일 지남' and hidden_why not like '%(수시)%'));
      if found then v_감춤 := v_감춤 + 1; end if;

    else
      v_모름 := v_모름 + 1;
    end if;
  end loop;

  return jsonb_build_object('살아 있음', v_살아, '사라짐', v_사라,
                            '두 번 연속이라 감춤', v_감춤, '제목·본문에 마감', v_마감표시,
                            '까닭 바로잡음', v_까닭고침,
                            '접수기간 채움', v_기간채움, '되살림', v_되살림,
                            '끝없는 공고라 안 채움', v_수시라패스,
                            '판단 못 함', v_모름);
end
$$;

/* 권한은 **지금과 똑같이** (postgres · service_role · anon · authenticated) */
revoke execute on function public.alive_mark(text, jsonb) from public;
grant  execute on function public.alive_mark(text, jsonb) to service_role, anon, authenticated;
