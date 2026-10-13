/* ②-0 — `collect_attach` 가 `수집묶음설정` 을 **안 읽게** 합니다
   (2026-10-13 · ② 를 올리기 전에 **먼저** 올려야 하는 것)

   ★ 아직 안 올렸습니다. 세중님 승인 뒤에 올립니다.
   ★ 이 파일에는 지우는 문장이 없습니다. 승인 창이 안 뜹니다.

   ═══ 왜 이것이 먼저인가 ═════════════════════════════════════

   세중님이 ② (밤묶음 치우기) 를 승인하실 때 조건을 주셨습니다 —
   「올리기 전 **부르는 곳 0** 세 군데를 세고, 0 이면 올린다.
     하나라도 0 이 아니면 멈추고 보고.」

   세어 보니 **DB 함수 본문에서 0 이 아니었습니다.**

     ① pg_proc.prosrc        ★ **1곳**  public.collect_attach(3)
                                「select case when s.켤까 then s.묶음 end into v_묶음
                                   from 수집묶음설정 s where s.하나;」
                             (나머지 둘은 함께 치워지는 밤묶음숨기기·밤묶음스위치)
     ② 저장소 코드            0곳  (문서와 이것을 만든 마이그레이션뿐)
     ③ crontab · ~/*.sh · .github  0곳

   그래서 ② 를 **올리지 않았습니다.**

   ② 를 그대로 올리면 — `수집묶음설정` 이 없어지는 순간 `collect_attach` 가
   `relation "수집묶음설정" does not exist` 로 **매번 죽습니다.** 그 창구는
   크론에서 도는 수집기 **셋**이 부릅니다 —

     tools/collect-alio.mjs      ┐
     tools/collect-cleaneye.mjs  ├─ tools/첨부담기.mjs 의 첨부모으기()
     tools/collect-nara.mjs      ┘   → rpc('collect_attach', …)

   즉 알리오·클린아이·나라일터의 **첨부 담기가 통째로 멈춥니다.**
   공고 수집 자체는 `collect_put` 이라 살아 있지만, 첨부가 안 들어오면
   HS3 첨부 kordoc 다음 차례(일곱 칸 채우기)의 재료가 끊깁니다.

   ═══ 고치는 것 — **두 줄을 뺍니다** ════════════════════════

   앞
     v_묶음 text; r jsonb; v_탈 text := null;
     …
     select case when s.켤까 then s.묶음 end into v_묶음      ← 이 두 줄
       from 수집묶음설정 s where s.하나;                       ←

   뒤
     v_묶음 text := null; r jsonb; v_탈 text := null;
     (읽는 두 줄이 없습니다)

   나머지는 **글자까지 그대로**입니다. 인수도 그대로 —
   (p_secret text, p_source text, p_rows jsonb). 그러니 ACL 이 유지됩니다
   (지침 6-2 — 인수를 바꾸면 새 함수가 되어 PUBLIC 이 다시 붙습니다).
   그래도 끝에 `revoke … from public, anon` 을 한 번 더 겁니다.

   ═══ 이렇게 해도 되는 까닭 ═══════════════════════════════════

   · `수집묶음설정` 은 지금 **켤까 = false** 입니다. 그래서 `v_묶음` 은
     이미 늘 null 이고, 읽어도 null 을 받습니다. **동작이 안 바뀝니다**
   · `job_attachments.수집묶음` 칸은 **그대로 둡니다** (세중님 결정).
     앞으로 들어오는 줄에 null 이 들어갑니다. 지금 찬 줄(id 1 · 2)도 그대로
   · 응답의 '묶음' 키도 그대로 둡니다 — `tools/첨부담기.mjs:194` 가 읽어
     199줄에서 찍습니다. `묶음 ?? '(없음)'` 이라 null 이어도 멀쩡합니다

   ═══ 올린 뒤 확인 순서 ═════════════════════════════════════

     1. select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.prosrc ~ '수집묶음설정';
        → **1** 이어야 합니다 (밤묶음스위치 하나만 · 그것은 ② 가 치웁니다)
     2. ACL 전후 견주기 — pg_proc.proacl
     3. 첨부 담기를 실제로 한 바퀴 (크론 줄과 똑같이) → exit 0 ·
        응답에 「묶음 (없음)」 이 찍히는지
     4. 그다음에 ② 를 올립니다. 그때 ① 의 셈이 0 이 됩니다
   ═══════════════════════════════════════════════════════════ */

create or replace function public.collect_attach(p_secret text, p_source text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok int := 0; v_bad int := 0; v_겹침 int := 0; v_공고없음 int := 0;
  /* ★ 2026-10-13 — 「수집묶음설정」 을 안 읽습니다. 그 표는 2026-10-11 밤
     사고(BEFORE INSERT 트리거가 기존 공고 278건을 보류함으로 보냄) 때 만든
     것이고 켤까 = false 로 꺼져 있습니다. 치우려는데 이 창구가 유일하게
     읽고 있었습니다 (지침 6절 — 부르는 곳을 먼저 셉니다).
     job_attachments.수집묶음 칸은 남깁니다 — 앞으로 null 이 들어갑니다 */
  v_묶음 text := null; r jsonb; v_탈 text := null;
begin
  if not exists (select 1 from collect_source where code = p_source and live) then
    raise exception '모르는 경로입니다: %', p_source using errcode = '22023';
  end if;
  if not exists (select 1 from collect_secret s
                  where s.source = p_source and s.secret = p_secret and length(p_secret) >= 24) then
    raise exception '열쇠가 맞지 않습니다' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '줄은 배열이어야 합니다' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      if coalesce(r->>'job_id','') = '' or coalesce(r->>'url','') = '' then
        raise exception '공고ID 나 주소가 없습니다';
      end if;
      if r->>'url' ~ '&amp;|&#38;' then
        raise exception '주소에 &amp; 가 안 풀렸습니다';
      end if;
      if not exists (select 1 from job_posts j where j.id = r->>'job_id') then
        v_공고없음 := v_공고없음 + 1;
        continue;
      end if;

      insert into job_attachments (job_id, kind, name, url, 수집묶음)
      values (r->>'job_id', coalesce(r->>'kind', '공고문'),
              left(coalesce(r->>'name', ''), 200), r->>'url', v_묶음)
      on conflict (job_id, url) do nothing;

      if found then v_ok := v_ok + 1; else v_겹침 := v_겹침 + 1; end if;
    exception when others then
      v_bad := v_bad + 1;
      if v_탈 is null then v_탈 := left(sqlerrm, 160); end if;
    end;
  end loop;

  return jsonb_build_object(
    '담음', v_ok, '겹침', v_겹침, '건너뜀', v_bad, '공고없음', v_공고없음,
    '묶음', v_묶음, '첫탈', v_탈,
    '표 줄수', (select count(*) from job_attachments));
end
$$;

/* 인수가 그대로라 ACL 이 유지되지만, 지침 6-2·6-3 대로 한 번 더 겁니다 */
revoke execute on function public.collect_attach(text, text, jsonb) from public, anon, authenticated;
grant  execute on function public.collect_attach(text, text, jsonb) to service_role;
