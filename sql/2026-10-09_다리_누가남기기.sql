/* 다리가 공고 상태를 바꾸면 job_state_log 에 **이름이 남게** 합니다 (2026-10-09).

   ── 왜 ──────────────────────────────────────────────────────
   10월 7~8일에 사람이 정한 숨김·보류 다섯 건이 되돌아갔는데,
   job_state_log 의 누가 가 전부 「(안 적힘)」 이었습니다.
   누구인지 알아내려고 함수 열 개를 열어 보고, 실행 시각을 다리 기록과
   맞춰 보고서야 찾았습니다. 한 줄만 있었으면 바로 알았을 일입니다.

   ── 어떻게 ──────────────────────────────────────────────────
   RPC 는 set_config('app.누가', …) 로 이름을 남깁니다.
   다리는 RPC 가 아니라 REST 로 바로 쓰기 때문에 그 길이 없습니다.
   그런데 PostgREST 는 요청 헤더를 request.headers 로 넘겨줍니다.

   ── 꾸며 보내면 어쩌나 (세중님 지적) ─────────────────────────
   헤더는 누구나 꾸밀 수 있습니다. 그래서 **역할이 service_role 일 때만**
   헤더 값을 씁니다. service 열쇠는 서버 안에만 있습니다.

   2026-10-09 서버에서 직접 두드려 확인했습니다 —

     service 열쇠로  x-who: 다리(시트) sync_jobs.js  → 지금 역할 service_role · 값 그대로 (한글도 안 깨짐)
     anon 열쇠로     x-who: 세중님                   → 지금 역할 anon        · 헤더는 왔지만 역할로 걸러집니다

   헤더 **이름**은 아스키만 됩니다 — x-누가 로 보냈더니 아예 안 왔습니다.
   그래서 이름은 x-who, 값은 한글로 둡니다.

   ── 지우는 문장이 없습니다 ──────────────────────────────────── */

create or replace function public.job_state_log_trg()
returns trigger
language plpgsql
as $function$
begin
  if (old.hold is distinct from new.hold)
     or (old.hidden is distinct from new.hidden)
     or (old.job_group is distinct from new.job_group)
     or (old.hidden_why is distinct from new.hidden_why) then
    insert into job_state_log (job_id, 누가, 왜,
      옛_hold, 새_hold, 옛_hidden, 새_hidden, 옛_직군, 새_직군, 옛_까닭, 새_까닭)
    values (new.id,
      coalesce(
        /* ① RPC 가 심어 둔 이름 — 지금까지 쓰던 길 */
        nullif(current_setting('app.누가', true), ''),
        /* ② 서버가 REST 로 바로 쓴 것. **service_role 일 때만** 믿습니다 */
        case when current_setting('role', true) = 'service_role'
             then nullif(
                    coalesce(nullif(current_setting('request.headers', true), '')::jsonb,
                             '{}'::jsonb) ->> 'x-who', '')
        end,
        /* ③ 그래도 모르면 — 적어도 사람이 아닌 것은 남깁니다 */
        case when current_setting('role', true) = 'service_role'
             then '(서버에서 바로 씀 · 이름 없음)'
        end,
        '(안 적힘)'),
      nullif(current_setting('app.왜', true), ''),
      old.hold, new.hold, old.hidden, new.hidden,
      old.job_group, new.job_group, old.hidden_why, new.hidden_why);
  end if;
  return new;
end $function$;
