-- 우리가 만든 storage 정책 (2026-10-25 · pg_dump --schema=public 에는 안 들어갑니다)
-- 올리는 차례 — ① sql/기준구조_1025.sql (public: 표·함수·정책) ② 이 파일
-- ★ 정책이 부르는 함수(첨부올릴수있나 등)는 ① 에 있습니다

-- 버킷을 먼저 만들어 두십시오 (Supabase 화면 Storage → New bucket):
--   notices · proofs · ad-images · avatars · posts · chat · home

create policy "공고 첨부는 담당자가 바꿉니다"
  on storage.objects as permissive for update
  to authenticated
  using (((bucket_id = 'notices'::text) AND "첨부올릴수있나"((storage.foldername(name))[1])));
create policy "공고 첨부는 담당자가 올립니다"
  on storage.objects as permissive for insert
  to authenticated
  with check (((bucket_id = 'notices'::text) AND "첨부올릴수있나"((storage.foldername(name))[1])));
create policy "공고 첨부는 회원이 봅니다"
  on storage.objects as permissive for select
  to authenticated
  using ((bucket_id = 'notices'::text));
create policy "광고 그림은 관리자만 바꿉니다"
  on storage.objects as permissive for update
  to authenticated
  using (((bucket_id = 'ad-images'::text) AND is_admin()));
create policy "광고 그림은 관리자만 올립니다"
  on storage.objects as permissive for insert
  to authenticated
  with check (((bucket_id = 'ad-images'::text) AND is_admin()));
create policy "광고 그림은 관리자만 지웁니다"
  on storage.objects as permissive for delete
  to authenticated
  using (((bucket_id = 'ad-images'::text) AND is_admin()));
create policy "광고 그림은 누구나 봅니다"
  on storage.objects as permissive for select
  to public
  using ((bucket_id = 'ad-images'::text));
create policy "글 사진은 누구나 봅니다"
  on storage.objects as permissive for select
  to public
  using ((bucket_id = 'post-images'::text));
create policy "내 대화 사진만 봅니다"
  on storage.objects as permissive for select
  to public
  using (((bucket_id = 'chat-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "내 아바타만 바꿉니다"
  on storage.objects as permissive for update
  to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "내 아바타만 올립니다"
  on storage.objects as permissive for insert
  to authenticated
  with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "내 아바타만 지웁니다"
  on storage.objects as permissive for delete
  to authenticated
  using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "내 폴더 것만 지웁니다"
  on storage.objects as permissive for delete
  to public
  using (((bucket_id = 'post-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "내 폴더에만 올립니다"
  on storage.objects as permissive for insert
  to public
  with check (((bucket_id = 'post-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "대화 사진은 내 폴더에만"
  on storage.objects as permissive for insert
  to public
  with check (((bucket_id = 'chat-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "아바타는 누구나 봅니다"
  on storage.objects as permissive for select
  to public
  using ((bucket_id = 'avatars'::text));
create policy "인증자료는 검토한 사람이 바로 지웁니다"
  on storage.objects as permissive for delete
  to authenticated
  using (((bucket_id = 'proofs'::text) AND "권한있나"('기관승인'::text)));
create policy "인증자료는 권한자와 본인이 봅니다"
  on storage.objects as permissive for select
  to authenticated
  using (((bucket_id = 'proofs'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR "권한있나"('기관승인'::text))));
create policy "인증자료는 본인이 올립니다"
  on storage.objects as permissive for insert
  to authenticated
  with check (((bucket_id = 'proofs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "홈 그림은 관리자만 바꿉니다"
  on storage.objects as permissive for update
  to authenticated
  using (((bucket_id = 'home-images'::text) AND is_admin()));
create policy "홈 그림은 관리자만 올립니다"
  on storage.objects as permissive for insert
  to authenticated
  with check (((bucket_id = 'home-images'::text) AND is_admin()));
create policy "홈 그림은 관리자만 지웁니다"
  on storage.objects as permissive for delete
  to authenticated
  using (((bucket_id = 'home-images'::text) AND is_admin()));
create policy "홈 그림은 누구나 봅니다"
  on storage.objects as permissive for select
  to public
  using ((bucket_id = 'home-images'::text));
