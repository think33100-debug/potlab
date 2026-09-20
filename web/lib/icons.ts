import { supabase } from './supabase';

/* 화면 자리 → 아이콘 이름. 관리자가 /admin/icons 에서 고칩니다.
   DB 에는 Lucide 이름(글자)만 있고 그림은 components/icon.tsx 가 그립니다.
   못 읽거나 없는 이름이면 Icon 이 기본 아이콘(점)으로 떨어뜨립니다 — 안 깨집니다. */
export type IconMap = Record<string, string>;

export async function iconMap(area?: string): Promise<IconMap> {
  let q = supabase.from('ui_icons').select('slot,icon');
  if (area) q = q.eq('area', area);
  const { data } = await q;
  const out: IconMap = {};
  (data ?? []).forEach((r) => { out[r.slot as string] = r.icon as string; });
  return out;
}

export type IconSlot = {
  slot: string;
  area: string;
  label: string;
  icon: string;
  sort: number;
};

export async function iconSlots(): Promise<IconSlot[]> {
  const { data } = await supabase
    .from('ui_icons').select('slot,area,label,icon,sort')
    .order('area').order('sort');
  return (data ?? []) as IconSlot[];
}
