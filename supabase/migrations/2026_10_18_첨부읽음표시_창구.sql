/* 첨부를 **읽었다고 표시하는 창구** (2026-10-18 세중님 수집기 순서 1)
 *
 * ── 왜 ───────────────────────────────────────────────
 * `job_attachments` 가 423줄인데 **`parsed_at` 이 한 줄도 안 찼습니다.**
 * 주소는 담기는데 읽은 표시를 남기는 코드가 **없습니다** —
 *   `collect_attach` 는 (job_id · kind · name · url · 수집묶음) 만 넣고
 *   `on conflict (job_id, url) do nothing` 으로 끝납니다. parsed_at 을 안 건드립니다.
 *   `tools/첨부되메우기.mjs` 는 읽어서 **공고 칸만** 채우고(`칸되메우기`),
 *   첨부 쪽에는 아무 표시도 남기지 않습니다.
 * 그래서 「오늘 몇 건 읽었나」를 셀 수가 없고, **하루 상한도 걸 수 없습니다.**
 * 같은 파일을 날마다 다시 받아 다시 읽습니다.
 *
 * ── 무엇이 생기나 ─────────────────────────────────────
 *   ① `job_attachments.읽기탈 text` 칸    실패한 까닭을 그 줄에 남깁니다
 *   ② `첨부읽음표시(p_rows jsonb)` 창구   parsed_at 과 읽기탈 을 적습니다
 *
 * `parsed_at` 은 **「마지막으로 읽어 본 때」** 입니다 (성공·실패 둘 다).
 * 성공이면 `읽기탈 = null`, 실패면 까닭이 들어갑니다. 그래서
 *   읽은 것      parsed_at is not null and 읽기탈 is null
 *   읽어 봤는데 안 된 것  parsed_at is not null and 읽기탈 is not null
 *   아직 안 본 것  parsed_at is null
 * 이렇게 셋이 갈립니다. 「안 본 것」을 먼저 보게 하려고 성공·실패 모두 때를 적습니다 —
 * 실패에 때를 안 적으면 못 읽는 파일을 **영영 다시** 받습니다.
 *
 * ── 왜 칸을 하나 더 두나 (지침 2절 — 「몇 건」만 세는 진단은 쓸모없음) ──
 * 까닭이 줄에 남아야 「png 라서 못 읽음」(영영 안 됨)과 「HTTP 500」(다시 하면 됨)을
 * 가릴 수 있습니다. 로그에만 적으면 다음 바퀴가 그걸 못 봅니다.
 *
 * ── 안 하는 것 ───────────────────────────────────────
 * 줄을 **지우지 않습니다.** 넣지도 않습니다 — 넣는 것은 `collect_attach` 몫입니다.
 * 이 창구는 그 두 칸만 고칩니다. `delete` · `drop` 글자가 없습니다 (지침 8-7).
 *
 * ── 권한 ───────────────────────────────────────────
 * 새 함수이므로 PUBLIC 이 붙습니다 → 끝에서 `public, anon, authenticated` 를 걷고
 * `service_role` 에만 줍니다 (지침 6-2 · 6-3). 칸에는 기본값이 없어
 * 시퀀스 권한 문제가 없습니다 (지침 8-13).
 *
 * ── 올린 뒤 할 일 ────────────────────────────────────
 *   node tools/첨부되메우기.mjs --마른 --출처 HS3     (표시는 --진짜 에서만 남깁니다)
 */

/* ① 실패 까닭 칸. `if not exists` 라 두 번 올려도 됩니다 */
alter table public.job_attachments add column if not exists "읽기탈" text;

comment on column public.job_attachments."읽기탈" is
  '첨부를 읽어 봤는데 안 된 까닭. 성공이면 null. parsed_at 은 성공·실패 모두 적습니다';

/* ② 창구 */
create or replace function public."첨부읽음표시"(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_성공 int := 0;
  v_실패 int := 0;
  v_못찾음 int := 0;
  v_탈 text := null;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  perform set_config('app.누가', '첨부 읽음 표시', true);

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id', '') = '' or coalesce(r->>'url', '') = '' then
        raise exception '공고ID 나 주소가 없습니다';
      end if;

      update job_attachments
         set parsed_at = now(),
             "읽기탈" = nullif(r->>'왜', '')
       where job_id = r->>'job_id' and url = r->>'url';

      if not found then
        v_못찾음 := v_못찾음 + 1;
      elsif coalesce(r->>'왜', '') = '' then
        v_성공 := v_성공 + 1;
      else
        v_실패 := v_실패 + 1;
      end if;
    exception when others then
      if v_탈 is null then v_탈 := left(sqlerrm, 160); end if;
    end;
  end loop;

  return jsonb_build_object(
    '읽음', v_성공, '못읽음', v_실패, '그 줄이 없음', v_못찾음, '첫탈', v_탈,
    /* 하루 상한을 걸 수 있게 **오늘(KST) 읽어 본 수**를 함께 돌려줍니다 */
    '오늘 읽어 본 수', (select count(*) from job_attachments
                        where parsed_at is not null
                          and (parsed_at at time zone 'Asia/Seoul')::date
                              = (now() at time zone 'Asia/Seoul')::date),
    '표 전체', (select count(*) from job_attachments),
    '아직 안 본 것', (select count(*) from job_attachments where parsed_at is null));
end
$$;

revoke execute on function public."첨부읽음표시"(jsonb) from public, anon, authenticated;
grant  execute on function public."첨부읽음표시"(jsonb) to service_role;
