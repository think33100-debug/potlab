'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminSearchField, 관 } from '@/components/rapo/rapo-admin-ui';

/* 쓰레기통 — 버림 단어만 있어 아예 안 담은 공고 (2026-09-25).

   ── 왜 있나 ──────────────────────────────────────────────────
   그냥 안 담으면 **무엇을 버렸는지 아무도 모릅니다.** 단어 하나가 진짜
   공고를 죽였을 때 알아챌 길이 없습니다. 그래서 버린 것도 남기고 봅니다.

   **자동으로 안 비웁니다.**

   ── 「잘못 버림」 을 누르면 ───────────────────────────────────
   그 줄에 되돌림 표시를 합니다. 그리고 **그 단어가 「다시 볼 단어」 목록에
   올라갑니다** — 되돌린 것들의 걸린 단어를 세어 보여주는 것이 그 목록입니다.
   새 표를 따로 만들지 않았습니다. 같은 단어로 두 번 되돌렸다면 그 단어를
   버림 목록에서 빼야 한다는 뜻입니다.

   단어를 빼는 곳은 두 군데입니다 (둘 다 같이 고쳐야 합니다) —
     gas/wage.js 의 SORT_버림
     tools/sort-rule.mjs 의 버림단어  → node tools/check-sort.mjs 로 확인 */

type 줄 = {
  id: string; trashed_at: string; source: string | null;
  org_name: string | null; title: string; url: string | null;
  why: string; restored: boolean; restored_at: string | null;
};

export default function AdminTrash() {
  const toast = useToast();
  const [rows, setRows] = useState<줄[] | null>(null);
  const [q, setQ] = useState('');
  const [되돌린것만, set되돌린것만] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  /* 가져오기만 합니다 — 화면 값은 바꾸지 않습니다.
     effect 안에서 바로 setState 하면 경고가 나고, 실제로도 한 번 더 그려집니다.
     이 저장소의 다른 관리자 화면과 같은 꼴입니다 (app/admin/jobs/page.tsx) */
  /* ★ 전에는 `.limit(500)` 한 줄이었습니다. **거짓이었습니다** —
     Supabase 는 한 번에 **100줄만** 돌려줍니다. limit 을 키워도 안 되고
     오류도 안 납니다. 쓰레기통이 2,966줄인데 **100줄만 보고 있었습니다.**
     「최근 100건 밖에서 잘못 버린 것」은 화면에 뜰 길이 아예 없었습니다.
     (2026-10-04 에 재서 찾음 — Content-Range 0-99/2966)

     그래서 100줄씩 다섯 쪽을 이어 받습니다. 500은 전에 적어 둔 수를
     그대로 지킨 것입니다 — 전부 받으면 관리자 화면이 너무 무거워집니다. */
  const fetchRows = useCallback(async (): Promise<줄[]> => {
    const 쪽크기 = 100;            // 서버가 못 넘게 막는 수
    const 최대 = 500;
    const 모두: 줄[] = [];
    for (let off = 0; off < 최대; off += 쪽크기) {
      let b = browserSupabase().from('job_trash')
        .select('*').order('trashed_at', { ascending: false })
        .range(off, off + 쪽크기 - 1);
      if (되돌린것만) b = b.eq('restored', true);
      if (q) b = b.or(`title.ilike.%${q}%,org_name.ilike.%${q}%,why.ilike.%${q}%`);
      const { data, error } = await b;
      if (error) { toast(`불러오지 못했어요 — ${error.message}`, { tone: 'danger' }); return 모두; }
      const 쪽 = (data ?? []) as 줄[];
      모두.push(...쪽);
      if (쪽.length < 쪽크기) break;     // 마지막 쪽
    }
    return 모두;
  }, [q, 되돌린것만, toast]);

  useEffect(() => {
    let 살아있나 = true;
    fetchRows().then((r) => { if (살아있나) setRows(r); });
    return () => { 살아있나 = false; };
  }, [fetchRows]);

  /* 「다시 볼 단어」 — 되돌린 줄들의 걸린 단어를 셉니다.
     같은 단어가 두 번 넘게 나오면 그 단어가 진짜 공고를 죽이고 있는 것입니다 */
  const 다시볼단어 = useMemo(() => {
    const 셈 = new Map<string, number>();
    (rows ?? []).filter((r) => r.restored).forEach((r) => {
      /* 「버림 단어(직군) 요양보호사,간호조무사」 에서 단어만 꺼냅니다 */
      const 뒤 = r.why.replace(/^[^)]*\)\s*/, '');
      뒤.split(/[,·]/).map((x) => x.trim()).filter(Boolean)
        .forEach((w) => 셈.set(w, (셈.get(w) ?? 0) + 1));
    });
    return [...셈].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const 되돌리기 = async (r: 줄) => {
    if (!confirm(`「${r.title}」를 잘못 버린 것으로 표시할까요?\n`
      + `걸린 단어 — ${r.why}\n\n`
      + '표시만 합니다. 공고를 다시 담으려면 수집기가 다시 돌아야 해요.')) return;
    setBusy(r.id);
    const { error } = await browserSupabase().from('job_trash')
      .update({ restored: true, restored_at: new Date().toISOString() }).eq('id', r.id);
    setBusy(null);
    if (error) { toast(`바꾸지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast('잘못 버림으로 표시했어요. 위 「다시 볼 단어」 에 올라가요');
    setRows(await fetchRows());
  };

  /* 2026-11-19 — 새 관리자 디자인으로 겉모양만 바꿨습니다 (검색칸 · 흰 카드 목록 · 배지 · 단추) */
  return (
    <section className="max-w-[932px]">
      <RapoAdminHeader title="쓰레기통" />
      <p className={관.muted + ' -mt-[16px] break-keep'}>
        제목에 버림 단어만 있어 아예 안 담은 공고예요. <b className="text-[#112231]">자동으로 안 비워요.</b>
        <br />
        진짜 공고가 잘못 버려졌으면 「잘못 버림」 을 눌러 주세요.
      </p>

      {/* 다시 볼 단어 — 되돌린 것들의 걸린 단어 */}
      {다시볼단어.length > 0 && (
        <div className="mt-[24px] rounded-[12px] border border-[#ffd4cf] bg-[#fff5f3] p-[20px]">
          <p className="text-[16px] font-bold text-[#b42a21]">다시 볼 단어</p>
          <p className="mt-[4px] break-keep text-[13px] text-[#555d6d]">
            되돌린 공고에서 걸렸던 단어예요. 두 번 넘게 나오면 그 단어가 진짜 공고를
            죽이고 있는 거예요 — 버림 목록에서 빼는 걸 생각해 보세요.
          </p>
          <ul className="mt-[12px] flex flex-wrap gap-[8px]">
            {다시볼단어.map(([w, n]) => (
              <li key={w}
                className={'inline-flex h-[30px] items-center gap-[6px] rounded-full px-[12px] text-[13px] font-bold '
                  + (n >= 2 ? 'bg-[#b42a21] text-white' : 'border border-[#dde4e6] bg-white text-[#304f65]')}>
                {w} <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-[24px] flex flex-wrap items-center gap-[12px]">
        <AdminSearchField value={q} onChange={setQ}
          placeholder="제목 · 기관명 · 걸린 단어" label="쓰레기통에서 찾기" />
        <label className="flex items-center gap-[8px] text-[14px] font-bold text-[#304f65]">
          <input type="checkbox" checked={되돌린것만} className="size-[18px] accent-[#112231]"
            onChange={(e) => set되돌린것만(e.target.checked)} />
          되돌린 것만
        </label>
      </div>

      {rows === null && <p className={관.muted + ' mt-[16px]'}>잠시만요…</p>}
      {rows !== null && rows.length === 0 && (
        <div className={관.cardTight + ' mt-[16px]'}>
          <p className={관.empty}>
            {되돌린것만 ? '되돌린 공고가 없어요' : '쓰레기통이 비었어요'}
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <p className={관.sub + ' mt-[16px]'}>
            <span className="tabular-nums">{rows.length}</span>건
            {rows.length >= 500 && ' (500건까지만 보여요)'}
          </p>
          <ul className={관.list + ' mt-[8px]'}>
            {rows.map((r) => (
              <li key={r.id}
                className={관.row + (r.restored ? ' bg-[#fff5f3]' : '')}>
                <p className="flex flex-wrap items-center gap-[8px] break-keep text-[16px] font-bold leading-[22px] text-[#112231]">
                  {r.restored && <AdminBadge tone="coral">되돌림</AdminBadge>}
                  {r.title}
                </p>
                <p className="mt-[4px] text-[13px] text-[#555d6d]">
                  {[r.source, r.org_name, r.id, r.trashed_at?.slice(0, 16).replace('T', ' ')]
                    .filter(Boolean).join(' · ')}
                </p>
                <p className="mt-[4px] break-keep text-[13px] font-bold text-[#b42a21]">
                  버린 이유 — {r.why}
                </p>
                <div className="mt-[12px] flex flex-wrap gap-[8px]">
                  {!r.restored && (
                    <button type="button" disabled={busy === r.id} onClick={() => 되돌리기(r)}
                      className={관.btnDanger}>
                      {busy === r.id ? '…' : '잘못 버림'}
                    </button>
                  )}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" className={관.btnLine}>
                      원문 보기 ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
