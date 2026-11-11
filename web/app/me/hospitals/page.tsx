'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/app/toast';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton, RapoDivider } from '@/components/rapo/rapo-ui';
import { 기관이름말 } from '@/lib/job-state';
import { browserSupabase } from '@/lib/supabase-browser';

/* 관심 병원 — 피그마 「U14-HOSP-SAVED / 관심 병원」 1375:245 (2026-11-12 밤 근무).
   저장한 기관(org_stars)과 「새 공고 알림」 켜짐/꺼짐. 켜고 끄는 일은 기관 화면의 단추(components/org-save.tsx)와
   같은 줄(org_stars.notify)을 같은 방법으로 고칩니다 — 새 저장 동작을 만들지 않았습니다.
   병원 이름을 누르면 기관 찾기(/orgs)로 갑니다. 원본의 「병원 이야기」는 아직 없는 화면입니다 */
type Row = { org_name: string; notify: boolean | null };

export default function MyHospitals() {
  return <RapoMeFrame title="관심 병원">{() => <HospitalList />}</RapoMeFrame>;
}

function HospitalList() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    browserSupabase().from('org_stars').select('org_name,notify').order('org_name')
      .then(({ data, error }) => { if (alive) setRows(error ? 'error' : (data ?? []) as Row[]); });
    return () => { alive = false; };
  }, []);

  const toggle = async (r: Row) => {
    const next = !r.notify;
    const { error } = await browserSupabase().from('org_stars').upsert({ org_name: r.org_name, notify: next });
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    setRows((xs) => Array.isArray(xs) ? xs.map((x) => x.org_name === r.org_name ? { ...x, notify: next } : x) : xs);
    toast(next ? '새 공고 알림을 켰어요' : '새 공고 알림을 껐어요');
  };

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x6)">
      <div className="flex flex-col gap-(--rapo-dimension-x2)">
        <h2 className="rapo-type-t10-bold text-(color:--rapo-color-fg-neutral)">저장한 병원</h2>
        <p className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">알림을 꺼도 관심 병원에 남아요.</p>
      </div>
      {rows === null ? (
        <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>
      ) : rows === 'error' ? (
        <p role="alert" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      ) : rows.length === 0 ? (
        <p className="rapo-type-t5-regular py-(--rapo-dimension-x4) text-(color:--rapo-color-fg-neutral-muted)">저장한 병원이 아직 없어요.</p>
      ) : rows.map((r) => (
        <section key={r.org_name} className="flex flex-col gap-(--rapo-dimension-x3)">
          <Link href={`/orgs?q=${encodeURIComponent(r.org_name)}`} className="rapo-type-t6-bold break-keep text-(color:--rapo-color-fg-neutral)">
            {기관이름말(r.org_name)}
          </Link>
          <div className="flex items-center">
            <p className="rapo-type-t4-regular min-w-0 flex-1 text-(color:--rapo-color-fg-neutral-muted)">새 공고 알림</p>
            <p className="rapo-type-t5-bold text-(color:--rapo-color-fg-neutral)">{r.notify ? '켜짐' : '꺼짐'}</p>
          </div>
          <RapoDivider />
          <RapoButton onClick={() => toggle(r)} tone="outline" full>{r.notify ? '알림 끄기' : '알림 켜기'}</RapoButton>
        </section>
      ))}
      <RapoButton href="/orgs" tone="outline" full>다른 병원 찾기</RapoButton>
    </div>
  );
}
