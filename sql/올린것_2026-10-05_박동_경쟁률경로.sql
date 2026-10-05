-- 2026-10-05 올림. 수집기 박동(/admin/beat)에 「알리오 경쟁률」 줄을 넣습니다.
--
-- 왜 경로를 따로 두나 —
--   공고 수집기 AL2(「알리오(새)」)는 5분마다 돕니다. 경쟁률은 주 1회입니다.
--   한 경로로 묶으면 beat_health 의 「평소 간격 가운데값」이 뒤섞여
--   둘 다 못 믿게 됩니다.
--
-- 왜 늦음 기준 칸을 새로 만드나 —
--   beat_health 는 빨간 줄을 **최근 박동 간격의 가운데값 × 2** 로 긋습니다.
--   박동이 하나뿐이면 가운데값이 없어 12시간으로 보므로, 주 1회 경로는
--   **첫 박동 다음 날 바로 빨간 줄**이 섭니다. 경로마다 기준을 적을 칸을 둡니다.
--
-- 확인한 것 —
--   기존 경로 열한 곳의 기대간격시간이 전과 같습니다 (AL2 0.2 · HS3 2.0 · VMS 44.2 …)
--   AL2C 는 박동을 한 번 남긴 뒤 기대간격시간 192.0 · 빨간줄 false 로 떴습니다


insert into collect_source (code, name, note, live)
values ('AL2C', '알리오 경쟁률',
        '알리오 전형단계별 선발·응시·경쟁률. 주 1회 ~/경쟁률크론.sh 가 돕니다 (2026-10-05)',
        true)
on conflict (code) do update
  set name = excluded.name, note = excluded.note, live = true;

-- 열쇠는 AL2 것과 **같은 값**을 AL2C 이름으로 한 줄 더 둡니다.
-- collect_beat 이 (source, secret) 짝을 보기 때문에 경로마다 줄이 있어야 합니다.
-- 값을 새로 만들지 않으니 서버 .env 에 넣을 변수는 COLLECT_KEY_AL2 하나로 끝납니다.
insert into collect_secret (source, secret)
select 'AL2C', s.secret from collect_secret s
 where s.source = 'AL2' order by s.secret limit 1
on conflict do nothing;

-- ★ 칸 이름을 「기대간격시간」으로 하지 않았습니다 — 그 이름은 beat_health 의
--   **결과 칸**이고 화면(admin/beat/page.tsx:33 · route-health.tsx:101)이 이미 씁니다.
alter table collect_source add column if not exists "늦음기준시간" numeric;

comment on column collect_source."늦음기준시간" is
  '늦음 기준(시간). 적어 두면 beat_health 가 「평소 간격 × 2」 대신 이 값을 씁니다.
   주 1회처럼 박동이 드물어 간격 가운데값을 못 믿는 경로에 씁니다 (2026-10-05).';

-- 192시간 = 8일. 한 주를 건너뛰면 빨간 줄이 서고, 몇 시간 밀리는 것으로는 안 섭니다.
update collect_source set "늦음기준시간" = 192 where code = 'AL2C';

create or replace function public.beat_health()
 returns table("경로" text, "이름" text, "마지막" timestamp with time zone,
               "몇시간째" numeric, "평소간격시간" numeric, "기대간격시간" numeric,
               "마지막탈" text, "빨간줄" boolean, "왜" text)
 language sql stable security definer set search_path to 'public'
as $function$
  with 최근 as (
    select b.source, b.ran_at, b.ok, b.왜,
           row_number() over (partition by b.source order by b.ran_at desc) rn,
           lag(b.ran_at) over (partition by b.source order by b.ran_at desc) 앞
      from collector_beat b
     where b.ran_at > now() - interval '30 days'
  ),
  틈 as (
    /* 평소 몇 시간마다 오나 — 가운데값. 한 번 늦은 것으로 기준이 흔들리지 않게 */
    select source,
           percentile_cont(0.5) within group (
             order by extract(epoch from (앞 - ran_at)) / 3600.0) 평소
      from 최근 where 앞 is not null and rn <= 30
     group by source
  ),
  끝 as (select source, ran_at, ok, 왜 from 최근 where rn = 1),
  잰것 as (
    select k.source, k.ran_at, k.ok, k.왜,
           coalesce(s.name, k.source) 이름,
           round(coalesce(g.평소, 0)::numeric, 1) 평소,
           /* ★ 경로에 적어 둔 기준이 있으면 그것을 먼저 씁니다 */
           round(coalesce(s."늦음기준시간", coalesce(g.평소, 12) * 2)::numeric, 1) 기대,
           extract(epoch from (now() - k.ran_at)) / 3600.0 지난시간
      from 끝 k
      left join 틈 g on g.source = k.source
      left join collect_source s on s.code = k.source
  )
  select source, 이름, ran_at, round(지난시간::numeric, 1), 평소, 기대,
         case when ok then '' else left(coalesce(왜, '까닭 안 적힘'), 200) end,
         (not ok) or 지난시간 > 기대,
         case when not ok then '마지막 실행이 탈났습니다'
              when 지난시간 > 기대 then '와야 할 때가 지났는데 안 왔습니다'
              else '' end
    from 잰것;
$function$;
