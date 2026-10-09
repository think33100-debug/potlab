/* 옛 수집기 열쇠를 **지우지 않고 끕니다** (2026-10-09 세중님 지시).

   ── 지금 상태 ───────────────────────────────────────────────
   collect_secret 22줄 · 출처 16가지. 2026-09-30 에 서버 전용으로 다시
   만들었는데 **옛 줄을 안 지웠습니다.** 같은 출처에 줄이 둘인 곳 여섯 —
   AL2 · CE2 · JF · HS3 · PUSH · RIVAL. 판정이 `secret = p_secret` 이라
   **옛 열쇠도 지금 그대로 통합니다.** 바꾼 뜻이 반쯤 없어졌습니다.

   ── 왜 함수를 안 고치나 ─────────────────────────────────────
   collect_secret 을 보는 함수가 **53개**입니다. 전부 열어 `and 끈때 is null`
   을 넣으면 한 군데만 틀려도 그 수집기가 멈춥니다. 그래서 **표 쪽에서**
   한 번에 거릅니다 — 이름을 바꾸고 그 자리에 「켜진 것만」 보이는 보기(view)
   를 둡니다. 함수 53개는 **한 글자도 안 바뀝니다.**

   ── 세 걸음으로 나눕니다. 걸음마다 확인합니다 ───────────────
     ① 칸만 더합니다            — 아무것도 안 바뀝니다
     ② 이름 바꾸고 보기를 놓습니다 — 바로 수집기 하나를 실제로 불러 확인
     ③ 옛 줄 여섯을 끕니다        — 24시간 지켜봅니다

   ── 지우는 문장이 없습니다. 되돌리기도 쉽습니다 ─────────────
     ③ 되돌리기  update collect_secret_all set 끈때 = null where …
     ② 되돌리기  보기를 치우고 이름을 되돌립니다 (drop view 라 승인 창)
*/

-- ═══════════════════════════════════════════════════════════
-- ① 칸만 더합니다 (이것만 올려도 동작이 안 바뀝니다)
-- ═══════════════════════════════════════════════════════════
alter table public.collect_secret
  add column if not exists 끈때   timestamptz,
  add column if not exists 끈까닭 text,
  add column if not exists 마지막쓴때 timestamptz;

-- ═══════════════════════════════════════════════════════════
-- ② 켜진 것만 보이게 합니다 — 함수 53개는 그대로
-- ═══════════════════════════════════════════════════════════
alter table public.collect_secret rename to collect_secret_all;

create view public.collect_secret as
  select source, secret, note, made_on, 끈때, 끈까닭, 마지막쓴때
    from public.collect_secret_all
   where 끈때 is null;

/* 표와 보기 둘 다 아무에게도 안 엽니다.
   함수들은 security definer 라 주인 권한으로 읽습니다 */
revoke all on public.collect_secret     from public, anon, authenticated;
revoke all on public.collect_secret_all from public, anon, authenticated;
alter table public.collect_secret_all enable row level security;

/* ② 를 올린 **직후** 반드시 확인합니다 (서버에서, 열쇠 값은 안 찍고):
     ssh potjob 'cd ~/potlab && set -a && . ./.env && set +a &&
       curl -s -X POST -H "apikey: $SUPABASE_ANON_KEY" \
         -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
         -H "Content-Type: application/json" \
         -d "{\"p_secret\":\"$COLLECT_KEY_HS3\",\"p_source\":\"HS3\"}" \
         "$SUPABASE_URL/rest/v1/rpc/pub_baseline_get" | head -c 120'
   숫자가 돌아오면 통한 것입니다. 42501 이면 **바로 되돌립니다.** */

-- ═══════════════════════════════════════════════════════════
-- ③ 옛 줄 여섯을 끕니다 (②가 멀쩡한 것을 확인한 뒤에)
--    같은 출처에 줄이 둘인 곳에서, **먼저 만든 쪽**만 끕니다
-- ═══════════════════════════════════════════════════════════
update public.collect_secret_all a
   set 끈때 = now(),
       끈까닭 = '2026-09-30 에 서버 전용 열쇠로 바꿨는데 옛 줄이 남아 있었습니다 (2026-10-09 세중님 지시)'
 where a.끈때 is null
   and a.source in ('AL2','CE2','JF','HS3','PUSH','RIVAL')
   and exists (
     select 1 from public.collect_secret_all b
      where b.source = a.source and b.끈때 is null and b.made_on > a.made_on);

/* 끈 뒤 확인 — 출처마다 켜진 줄이 **하나씩만** 남아야 합니다
   select source, count(*) filter (where 끈때 is null) as 켜짐,
          count(*) filter (where 끈때 is not null) as 꺼짐
     from collect_secret_all group by source order by source; */

-- ═══════════════════════════════════════════════════════════
-- ④ 「마지막 쓴 때」를 남기는 것 — 제안
-- ═══════════════════════════════════════════════════════════
/* 열쇠가 실제로 쓰이는지 알면, 끄기 전에 「이건 아무도 안 쓴다」를
   숫자로 말할 수 있습니다. 지금은 알 길이 없습니다.

   ── 왜 바로 안 넣나 ─────────────────────────────────────────
   53개 함수가 전부 `select 1 from collect_secret where …` 로 **읽기만**
   합니다. 읽을 때 쓰기를 하려면 함수를 고쳐야 하고, 그러면 53군데입니다.

   ── 그래서 보기 대신 **함수**로 바꾸는 길 ───────────────────
   ② 의 보기를 함수로 바꾸면 그 안에서 기록할 수 있습니다. 다만 보기를
   함수로 바꾸면 `from collect_secret s where s.source = …` 꼴이 안 되므로
   역시 53군데를 고쳐야 합니다. **그래서 권하지 않습니다.**

   ── 권하는 길 — 수집기 박동으로 갈음합니다 ──────────────────
   collector_beat 에 출처(source)가 이미 찍힙니다. 「그 출처가 최근에
   돌았나」가 곧 「그 열쇠가 최근에 쓰였나」입니다. 표를 안 늘리고
   함수도 안 고칩니다.

     select s.source, s.made_on, s.끈때,
            (select max(ran_at) from collector_beat b where b.source = s.source) as 마지막박동
       from collect_secret_all s order by s.source;

   다만 한 출처에 열쇠가 둘이면 **어느 쪽이 쓰였는지는 못 가립니다.**
   그래서 ③ 으로 하나씩만 남기는 것이 먼저입니다. */
