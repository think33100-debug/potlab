import { IconEditor } from '@/components/icon-editor';
import { iconSlots } from '@/lib/icons';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';

export const dynamic = 'force-dynamic';

/* 아이콘을 바꾸는 자리.

   DB(ui_icons)에는 Lucide 이름(글자)만 둡니다. 그림은 components/icon.tsx 가 그립니다.
   그래서 아이콘을 바꿔도 배포가 필요 없고, 이름이 틀려도 화면이 안 깨집니다.

   막는 자리는 여기가 아니라 DB 입니다 — ui_icons 의 쓰기 규칙이 is_admin() 입니다.
   브라우저에서 이 화면을 억지로 열어도 저장이 안 됩니다. */
export default async function AdminIcons() {
  const slots = await iconSlots();
  return (
    <div className="max-w-[1100px]">
      {/* 2026-11-19 새 관리자 디자인(Figma 16)으로 겉모양만 다시 입힘 */}
      <RapoAdminHeader title="아이콘" />
      {/* 서버 화면이라 관(클라이언트 모듈 값) 대신 같은 값을 그대로 적습니다 */}
      <p className="-mt-[20px] mb-[24px] break-keep text-[14px] leading-[19px] text-[#555d6d]">
        화면에 쓰이는 아이콘을 바꿉니다. 바꾸면 바로 반영돼요
      </p>
      <IconEditor slots={slots} />
    </div>
  );
}
