'use client';

import { useEffect, useState } from 'react';
import { RapoJobRow, type RapoJob } from '@/components/rapo/rapo-job-row';
import { RapoMeFrame } from '@/components/rapo/rapo-me';
import { RapoButton, RapoDivider } from '@/components/rapo/rapo-ui';
import { 기관이름말, 마감배지 } from '@/lib/job-state';
import { 기관그림 } from '@/lib/rapo-home';
import { browserSupabase } from '@/lib/supabase-browser';

/* 저장한 공고 — 피그마 「U14 · 저장한 공고 목록」 1450:5616 (2026-11-12 밤 근무).
   찜(job_stars)한 공고를 공고 행(RapoJobRow)으로 그립니다 — 전 /me 의 「찜한 공고」와 같은 자료.
   급여·태그·근무시간 줄은 이 자료에 없어 안 그립니다(지어내지 않음) */
type Star = { job_id: string; job_posts: { title: string; org_name: string; apply_to: string | null } | null };

export default function MySaved() {
  return <RapoMeFrame title="저장한 공고">{(me) => <SavedList profileId={me.id} />}</RapoMeFrame>;
}

function SavedList({ profileId }: { profileId: string }) {
  const [rows, setRows] = useState<RapoJob[] | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    browserSupabase().from('job_stars').select('job_id,created_at,job_posts(title,org_name,apply_to)')
      .eq('profile_id', profileId).order('created_at', { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setRows('error'); return; }
        setRows(((data ?? []) as unknown as Star[]).filter((s) => s.job_posts).map((s) => ({
          id: s.job_id, org: 기관이름말(s.job_posts!.org_name), orgArt: 기관그림(s.job_posts!.org_name || s.job_id),
          title: s.job_posts!.title, pay: null, tags: [], deadline: 마감배지(s.job_posts!.apply_to).text,
        })));
      });
    return () => { alive = false; };
  }, [profileId]);

  return (
    <div className="flex flex-col gap-(--rapo-dimension-x4) pt-(--rapo-dimension-x4)">
      <h2 className="rapo-type-t8-bold text-(color:--rapo-color-fg-neutral)">저장한 공고</h2>
      {rows === null ? (
        <p role="status" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오는 중…</p>
      ) : rows === 'error' ? (
        <p role="alert" className="rapo-type-t4-regular text-(color:--rapo-color-fg-neutral-muted)">불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col gap-(--rapo-dimension-x4) py-(--rapo-dimension-x6)">
          <p className="rapo-type-t5-regular text-(color:--rapo-color-fg-neutral-muted)">저장한 공고가 아직 없어요. 마음에 드는 공고의 책갈피를 눌러 보세요.</p>
          <RapoButton href="/jobs" full>공고 보러 가기</RapoButton>
        </div>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r, i) => (
            <li key={r.id}>
              {i > 0 && <RapoDivider />}
              <RapoJobRow job={r} variant="list" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
