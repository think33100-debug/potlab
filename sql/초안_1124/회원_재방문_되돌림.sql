/* 회원_재방문.sql 되돌림 (2026-11-24) — 함수와 표를 지웁니다. 쌓인 방문일도 같이 사라집니다 */
drop function if exists public.admin_stats_member_revisit(integer);
drop table if exists public.회원방문일;
