'use client';

import './mock-db';
import AdminHome from '@/app/admin/page';
import P_access from '@/app/admin/access/page';
import P_ads from '@/app/admin/ads/page';
import P_beat from '@/app/admin/beat/page';
import P_blanks from '@/app/admin/blanks/page';
import P_boost from '@/app/admin/boost/page';
import P_compete from '@/app/admin/compete/page';
import P_dups from '@/app/admin/dups/page';
import P_edu_orgs from '@/app/admin/edu-orgs/page';
import P_hand from '@/app/admin/hand/page';
import P_home_blocks from '@/app/admin/home-blocks/page';
import P_inquiries from '@/app/admin/inquiries/page';
import P_jobs from '@/app/admin/jobs/page';
import P_members from '@/app/admin/members/page';
import P_notify from '@/app/admin/notify/page';
import P_ops from '@/app/admin/ops/page';
import P_partners from '@/app/admin/partners/page';
import P_posts from '@/app/admin/posts/page';
import P_reports from '@/app/admin/reports/page';
import P_reset from '@/app/admin/reset/page';
import P_rival from '@/app/admin/rival/page';
import P_staff from '@/app/admin/staff/page';
import P_stats from '@/app/admin/stats/page';
import P_texts from '@/app/admin/texts/page';
import P_trash from '@/app/admin/trash/page';
import P_verify from '@/app/admin/verify/page';
import { RapoAdminShell } from '@/components/rapo/rapo-admin';

/* 관리자 미리보기 — ?screen=home|stats|jobs|… (app/admin 아래 폴더 이름 · 2026-11-19).
   ./mock-db 가 **먼저** 불려 fetch 를 가로챕니다(견본 숫자 · 저장 없음).
   icons(서버 화면)·jobs/[id](주소 번호가 필요) 는 빠집니다 */
const 화면: Record<string, () => React.ReactNode> = {
  home: AdminHome,
  'access': P_access,
  'ads': P_ads,
  'beat': P_beat,
  'blanks': P_blanks,
  'boost': P_boost,
  'compete': P_compete,
  'dups': P_dups,
  'edu-orgs': P_edu_orgs,
  'hand': P_hand,
  'home-blocks': P_home_blocks,
  'inquiries': P_inquiries,
  'jobs': P_jobs,
  'members': P_members,
  'notify': P_notify,
  'ops': P_ops,
  'partners': P_partners,
  'posts': P_posts,
  'reports': P_reports,
  'reset': P_reset,
  'rival': P_rival,
  'staff': P_staff,
  'stats': P_stats,
  'texts': P_texts,
  'trash': P_trash,
  'verify': P_verify,
};

export function AdminPreview({ screen }: { screen: string }) {
  const C = 화면[screen] ?? AdminHome;
  return <RapoAdminShell><C /></RapoAdminShell>;
}
