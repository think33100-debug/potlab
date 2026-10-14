/* 2026-10-14 저녁에 올린 넷 — 전문은 DB 와 같습니다
 *
 *  ① job_attachments.만든때   첨부 하루 상한을 DB 로 세기 위해 (세중님 승인)
 *  ② collect_source.마감시각줌 출처별 「마감 시각을 주나」 **한 자리 설정**
 *  ③ 일층병원_구멍() 기준 고침  공공 전부 + 보건소 · 민간은 상급종합·대학·종합만
 *  ④ 네숫자() ③ 에 세 칸      예상연봉·바쁜정도·병원뜯어보기 (층을 나눠)
 *
 * 숫자 (2026-10-14 저녁)
 *   1층 대상 549 → 1,022곳 (공공 704 · 민간 318) · 사각지대 232 → 705
 *     들어온 것 473곳(보건지소 230·보건소 227·보건의료원 16) · 빠진 것 없음
 *   ③ 마감시각 분모를 바꿔 1.4% → 11.9% (시각 주는 출처 5/42건)
 *   ③ 예상연봉 88.4% (1층만 20.5% · 1층 공고 39건)
 *   ③ 바쁜정도·병원뜯어보기 53.4% (1층만 100% · 자료 있는 기관 161/315곳)
 *
 * ※ 아래는 `supabase db diff` 로 받은 전문이 아니라, 제가 올린 그대로를
 *   적어 둔 것입니다. 각 조각의 까닭은 커밋 글과 docs/승인요청_1013/ 에 있습니다.
 *   일층병원_구멍()·일층병원_구멍셈()·네숫자() 는 그 뒤로도 고쳐질 수 있으니
 *   **지금 DB 의 전문**은 pg_get_functiondef() 로 보십시오. */

alter table public.job_attachments
  add column if not exists "만든때" timestamptz not null default now();
create index if not exists "job_attachments_만든때_idx"
  on public.job_attachments ("만든때" desc);

alter table public.collect_source
  add column if not exists "마감시각줌" boolean;
update collect_source set "마감시각줌" = true  where code in ('AL2','GJ2','HS3','CE2','ND2');
update collect_source set "마감시각줌" = false where code in ('WN','WN2');
