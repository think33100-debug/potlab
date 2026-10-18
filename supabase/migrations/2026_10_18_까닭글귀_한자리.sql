/* 「원문이 없어짐」 까닭을 **한 자리로** (2026-10-18 세중님 2번)
 *
 * ── 왜 ───────────────────────────────────────────────
 * 같은 일(원문이 사이트에서 없어짐)에 글귀가 **두 벌**이었습니다 —
 *   `alive_mark` 의 gone 갈래      「병원이 내림」
 *   제가 손으로 내릴 때            「원문이 없어짐」
 * 세중님 — 「**「원문이 없어짐」 하나로.** alive_mark 도 앞으로 같은 글귀로.
 * 이미 「병원이 내림」으로 적힌 줄은 그대로 두되, 되살리기·셈 등 읽는 쪽은
 * 두 글귀를 **같은 것으로 다루기(한 자리 상수로)**」
 *
 * ── 만드는 것 둘 ─────────────────────────────────────
 *   `원문없어짐까닭말()`   앞으로 **쓸** 글귀 하나        → '원문이 없어짐'
 *   `원문없어짐까닭()`     **읽을** 때 같은 것으로 볼 글귀 → {'원문이 없어짐','병원이 내림'}
 * 쓰는 자리는 하나, 읽는 자리는 둘을 같게 봅니다. 옛 줄을 고치지 않아도 됩니다.
 *
 * ── 바꾸는 것 ───────────────────────────────────────
 * `alive_mark` 의 gone 갈래 **한 문단**만 —
 *   쓰기  '병원이 내림'                      → `원문없어짐까닭말()`
 *   읽기  `is distinct from '병원이 내림'`    → `<> all(원문없어짐까닭())`
 * 나머지(alive·closed·unknown 갈래 · 되살리기 · 까닭고침)는 글자 하나 안 바꿨습니다.
 *
 * ── 옛 줄은 그대로 둡니다 ────────────────────────────
 * 지금 「병원이 내림」 으로 적힌 줄을 **고치지 않습니다** (세중님).
 * 읽는 쪽이 둘을 같게 보므로 탈이 없습니다 —
 *   · `alive_mark` 가 같은 공고를 또 내리지 않습니다 (`<> all(...)` 가드)
 *   · `hide_stale_posts` ③ 되살리기는 `hidden_why = '마감 지남'` **정확히 같을 때만**
 *     이라 둘 다 애초에 안 되살려집니다 (확인했습니다)
 *
 * ── 권한 ───────────────────────────────────────────
 * `alive_mark` 는 인수(text, jsonb)가 그대로라 ACL 이 보존됩니다 (지침 6-2a).
 * ★ 이 함수는 **anon 에게도 열려 있습니다** — 옛 alive.yml(GitHub)이 anon 열쇠로
 *   부릅니다(2026-10-12 주석). 그래서 끝에 `grant … to service_role, anon` 으로
 *   **전과 똑같이** 다시 적습니다. `authenticated` 는 걷습니다.
 * 새 함수 둘에는 PUBLIC 이 붙으니 각각 걷습니다 (지침 6-2 · 6-3).
 * `delete` · `drop` 글자가 없습니다 (지침 8-7).
 */

/* ── 한 자리 상수 ─────────────────────────────────── */
create or replace function public."원문없어짐까닭말"() returns text
language sql immutable set search_path = public as $$ select '원문이 없어짐'::text $$;

create or replace function public."원문없어짐까닭"() returns text[]
language sql immutable set search_path = public as $$
  /* 옛 글귀 「병원이 내림」 을 함께 둡니다 — 이미 적힌 줄을 고치지 않기 때문입니다 */
  select array['원문이 없어짐', '병원이 내림']::text[]
$$;

revoke execute on function public."원문없어짐까닭말"() from public, anon, authenticated;
grant  execute on function public."원문없어짐까닭말"() to service_role;
revoke execute on function public."원문없어짐까닭"() from public, anon, authenticated;
grant  execute on function public."원문없어짐까닭"() to service_role;

CREATE OR REPLACE FUNCTION public.alive_mark(p_secret text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_오늘 date := (now() at time zone 'Asia/Seoul')::date;
  r jsonb; v_살아 int := 0; v_사라 int := 0; v_감춤 int := 0; v_모름 int := 0;
  v_마감표시 int := 0; v_기간채움 int := 0; v_되살림 int := 0; v_수시라패스 int := 0;
  v_까닭고침 int := 0;
  v_날 date; v_id text; v_기간 text;
  v_까닭 text;
begin
  if not exists (select 1 from collect_secret s where s.source = 'ALIVE' and s.secret = p_secret
                   and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;

  perform set_config('app.누가', '정찰 · 원문 확인', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    v_id := r->>'id';
    v_기간 := coalesce(r->>'접수기간', '');
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
                 and coalesce(hidden_why, '') not like '%넘음%';
              if found then v_되살림 := v_되살림 + 1; end if;
            end if;
          end if;
        end if;
      end if;
    end if;

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
             hidden_why = v_까닭, hidden_on = v_오늘
       where id = v_id and not hidden and not admin_locked;
      if found then v_마감표시 := v_마감표시 + 1; end if;
      update job_posts set hidden_why = v_까닭, seen_on = v_오늘
       where id = v_id and hidden and not admin_locked
         and hidden_why like '%일 지남' and hidden_why not like '%(수시)%';
      if found then v_까닭고침 := v_까닭고침 + 1; end if;

    elsif (r->>'결과') = 'gone' then
      update job_posts set gone_streak = least(coalesce(gone_streak,0) + 1, 9), seen_on = v_오늘
       where id = v_id and not admin_locked;
      v_사라 := v_사라 + 1;
      /* ★ 2026-10-18 — 까닭 글귀를 **「원문이 없어짐」 하나로** 모읍니다 (세중님 2번).
         전에는 여기만 「병원이 내림」 이었고, 제가 손으로 내릴 때는 「원문이 없어짐」 을
         써서 **같은 일에 글귀가 두 벌**이 됐습니다.
         ★ 이미 「병원이 내림」 으로 적힌 줄은 **그대로 둡니다** (세중님).
           그래서 읽는 쪽은 **원문없어짐까닭() 한 자리**를 봅니다 — 두 글귀를
           같은 것으로 다룹니다 (지침 6절). */
      update job_posts set hidden = true, hold = false,
             hidden_why = "원문없어짐까닭말"(), hidden_on = v_오늘
       where id = v_id and coalesce(gone_streak,0) >= 2 and not admin_locked
         /* ★ `hidden_why <> all(...)` 만 쓰면 **NULL 일 때 참이 아닙니다** —
            숨지 않은 공고는 hidden_why 가 NULL 이라 **주된 경우가 안 내려갑니다.**
            원래 `is distinct from` 은 NULL 에서 참이었습니다. 그 뜻을 지킵니다 */
         and (hidden_why is null or hidden_why <> all("원문없어짐까닭"()))
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


/* ★ 2026-10-18 — 처음에 제가 여기에 `to service_role, anon` 이라고 적어
   **없던 anon 권한을 더했습니다.** 2026-10-12 주석의 「옛 alive.yml 이 anon 열쇠로
   부릅니다」 만 읽고 짐작한 것이고, **전 ACL 을 찍어 보지 않았습니다** —
   지침 6-2a 가 금한 바로 그 일입니다.
   올리기 전 ACL: {postgres=X/postgres,service_role=X/postgres}  ← anon **없었습니다**
   바로 걷었고(지침 6-3 — PUBLIC 까지), 지금은 글자까지 같습니다.
   ★ 다음에 이 함수를 다시 만들 때도 **먼저 proacl 을 찍어** 그대로 적으십시오. */
revoke execute on function public.alive_mark(text, jsonb) from public, anon, authenticated;
grant  execute on function public.alive_mark(text, jsonb) to service_role;
