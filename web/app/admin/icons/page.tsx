import { IconEditor } from '@/components/icon-editor';
import { iconSlots } from '@/lib/icons';

export const dynamic = 'force-dynamic';

/* 아이콘을 바꾸는 자리.

   DB(ui_icons)에는 Lucide 이름(글자)만 둡니다. 그림은 components/icon.tsx 가 그립니다.
   그래서 아이콘을 바꿔도 배포가 필요 없고, 이름이 틀려도 화면이 안 깨집니다.

   막는 자리는 여기가 아니라 DB 입니다 — ui_icons 의 쓰기 규칙이 is_admin() 입니다.
   브라우저에서 이 화면을 억지로 열어도 저장이 안 됩니다. */
export default async function AdminIcons() {
  const slots = await iconSlots();
  return (
    <>
      <p className="mb-6 break-keep text-lg text-gray-500">
        화면에 쓰이는 아이콘을 바꿉니다. 바꾸면 바로 반영돼요
      </p>
      <IconEditor slots={slots} />
    </>
  );
}
