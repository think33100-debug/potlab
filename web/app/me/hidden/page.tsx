'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/app/toast';
import { RapoJobRow, type RapoJob } from '@/components/rapo/rapo-job-row';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton, RapoDivider } from '@/components/rapo/rapo-ui';
import { 목록줄 } from '@/lib/rapo-home';
import { browserSupabase } from '@/lib/supabase-browser';
import type { JobListItem } from '@/lib/supabase';

/* 숨긴 공고 — 내 정보 (2026-11-14 세중님 「숨긴 건 내 정보에 숨긴 공고 확인에 쌓이게」).
   공고 상세의 「숨기기」로 숨긴 공고를 모아 보여 줍니다 — DB job_list(p_hidden) 가 내 숨긴공고 표를 읽습니다.
   마감 지난 공고도 같이 나옵니다(p_all) — 숨긴 건 다시 보려는 것이라 지워지면 안 됩니다. 한 번에 20건까지.
   각 줄 아래 「숨김 해제」를 누르면 목록·홈에 다시 보입니다 */
export default function MyHidden() {
  return <RapoMeFrame title="숨긴 공고">{() => <HiddenList />}</RapoMeFrame>;
}

function HiddenList() {
  const toast = useToast();
  const [rows, setRows] = useState<RapoJob[] | null | 'error'>(null);
  const [바쁨, set바쁨] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    browserSupabase().rpc('job_list', {
      p_job: null, p_sido: null, p_tab: null, p_q: null, p_all: true, p_sort: 'new', p_page: 0, p_hidden: true,
    }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setRows('error'); return; }
      setRows(((data ?? []) as JobListItem[]).map(목록줄));
    });
    return () => { alive = false; };
  }, []);

  async function 풀기(id: string) {
    set바쁨(id);
    const { error } = await browserSupabase().rpc('공고숨기기', { p_공고: id, p_숨길까: false });
    set바쁨(null);
    if (error) { toast('숨김을 풀지 못했어요', { tone: 'danger' }); return; }
    setRows((r) => (Array.isArray(r) ? r.filter((x) => x.id !== id) : r));
    toast('숨김을 풀었어요');
  }

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x4)">
      <h2 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">숨긴 공고</h2>
      <p className="rapo-type-t4-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">내가 숨긴 공고예요. 나에게만 숨겨지고, 풀면 목록에 다시 보여요.</p>
      {rows === null ? (
        <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>
      ) : rows === 'error' ? (
        <p role="alert" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x6)">
          <p className="rapo-type-t5-regular break-keep text-(color:--rapo-color-fg-neutral-muted)">숨긴 공고가 아직 없어요. 보기 싫은 공고는 상세 화면의 「숨기기」로 숨길 수 있어요.</p>
          <RapoButton href="/jobs" full>공고 보러 가기</RapoButton>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li key={r.id}>
              {i > 0 && <RapoDivider />}
              <RapoJobRow job={r} variant="list" />
              <div className="pb-(--rapo-dimension-x3)">
                <RapoButton tone="outline" size={40} onClick={() => r.id && 풀기(r.id)} disabled={바쁨 === r.id}>숨김 해제</RapoButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
