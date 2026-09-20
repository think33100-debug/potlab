'use client';

import { useCallback, useEffect, useState } from 'react';
import { HOME_COLS, type HomeBlock } from '@/lib/home';
import { PhotoPicker } from '@/components/photo-picker';
import { shrinkToWebp } from '@/lib/image';
import { ROUTES } from '@/lib/routes';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../toast';

/* 홈 꾸미기.

   여기서 고친 것이 바로 홈에 나갑니다 — 배포가 필요 없습니다.
   가는 곳은 직접 못 적고 lib/routes.ts 의 목록에서만 고릅니다.
   아무 주소나 넣으면 없는 화면으로 보내 404 가 나기 때문입니다. */

const METRICS: { v: string; label: string }[] = [
  { v: '', label: '숫자 없이 아래 설명만' },
  { v: 'deadline', label: '이번 주 마감 건수' },
  { v: 'coverage', label: '공고 수 · 기관 수' },
  { v: 'hot', label: '이번 주 인기 글 제목' },
];

export default function AdminHome() {
  const toast = useToast();
  const [blocks, setBlocks] = useState<HomeBlock[] | null>(null);
  const [seconds, setSeconds] = useState('5');
  const [savedSeconds, setSavedSeconds] = useState('5');

  /* 받아오는 일과 상태에 넣는 일을 갈라둡니다 —
     effect 안에서 바로 setState 하면 그릴 때마다 한 번 더 그립니다 */
  const fetchAll = useCallback(async () => {
    const sb = browserSupabase();
    const [b, s] = await Promise.all([
      sb.from('home_blocks').select(HOME_COLS).order('kind').order('sort'),
      sb.from('site_settings').select('value').eq('key', 'top_banner_seconds').maybeSingle(),
    ]);
    return {
      blocks: (b.data ?? []) as unknown as HomeBlock[],
      sec: String((s.data as { value: unknown } | null)?.value ?? 5),
    };
  }, []);

  const load = useCallback(async () => {
    const r = await fetchAll();
    setBlocks(r.blocks);
    setSeconds(r.sec);
    setSavedSeconds(r.sec);
  }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setBlocks(r.blocks);
      setSeconds(r.sec);
      setSavedSeconds(r.sec);
    });
    return () => { alive = false; };
  }, [fetchAll]);

  if (!blocks) return <p className="text-lg text-gray-500">불러오는 중…</p>;

  const of = (kind: HomeBlock['kind']) =>
    blocks.filter((b) => b.kind === kind).sort((a, c) => a.sort - c.sort);

  const patch = (id: number, v: Partial<HomeBlock>) =>
    setBlocks((all) => (all ?? []).map((b) => (b.id === id ? { ...b, ...v } : b)));

  const save = async (b: HomeBlock) => {
    const { error } = await browserSupabase().from('home_blocks').update({
      enabled: b.enabled, emoji: b.emoji, image_path: b.image_path,
      title: b.title, descr: b.descr, href: b.href, metric: b.metric,
      updated_at: new Date().toISOString(),
    }).eq('id', b.id);

    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    toast('저장했어요');
  };

  /* 순서 바꾸기 — 옆 줄과 sort 값을 맞바꿉니다 */
  const move = async (b: HomeBlock, dir: -1 | 1) => {
    const list = of(b.kind);
    const i = list.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;

    const other = list[j];
    const sb = browserSupabase();
    const r = await Promise.all([
      sb.from('home_blocks').update({ sort: other.sort }).eq('id', b.id),
      sb.from('home_blocks').update({ sort: b.sort }).eq('id', other.id),
    ]);
    const bad = r.find((x) => x.error);
    if (bad?.error) { toast(`순서를 못 바꿨어요 — ${bad.error.message}`, { tone: 'danger' }); return; }
    await load();
    toast('순서를 바꿨어요');
  };

  const upload = async (b: HomeBlock, file: File) => {
    try {
      const webp = await shrinkToWebp(file, 1600);
      const path = `${b.kind}/${b.id}-${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('home-images')
        .upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      await sb.from('home_blocks').update({ image_path: path }).eq('id', b.id);
      patch(b.id, { image_path: path });
      toast('그림을 올렸어요');
    } catch (e) {
      toast(`그림을 올리지 못했어요 — ${(e as Error).message}`, { tone: 'danger', ms: 4000 });
    }
  };

  const saveSeconds = async () => {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 2 || n > 60) {
      toast('2초에서 60초 사이로 넣어 주세요', { tone: 'danger' }); return;
    }
    const { error } = await browserSupabase().from('site_settings')
      .update({ value: n, updated_at: new Date().toISOString() })
      .eq('key', 'top_banner_seconds');
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    setSavedSeconds(String(n));
    toast(`${n}초마다 넘기게 했어요`);
  };

  return (
    <div className="space-y-8">
      {/* ── 상단 배너 ── */}
      <Section
        title="상단 배너"
        note={`켜진 것만 홈에 나와요 · 제목이 비면 안 나와요 · 지금 ${of('top').filter((b) => b.enabled && b.title).length}개`}
      >
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-sm border border-gray-100 p-6 dark:border-gray-800">
          <label className="text-sm font-bold text-gray-500">
            넘어가는 속도
            <div className="mt-2 flex gap-2">
              <input
                type="number" min={2} max={60}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className="w-[88px] rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950"
              />
              <span className="self-center text-lg text-gray-500">초</span>
            </div>
          </label>
          <button
            type="button" onClick={saveSeconds}
            disabled={seconds === savedSeconds}
            className="rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark disabled:opacity-40"
          >
            속도 저장
          </button>
        </div>

        {of('top').map((b, i, arr) => (
          <Row key={b.id} b={b} i={i} last={arr.length - 1}
            onPatch={patch} onSave={save} onMove={move} onUpload={upload}>
            <Field label="제목" v={b.title} set={(v) => patch(b.id, { title: v })} />
            <Field label="설명" v={b.descr ?? ''} set={(v) => patch(b.id, { descr: v })} />
            <Href b={b} set={(v) => patch(b.id, { href: v })} />
            <Picture b={b} onUpload={upload} onClear={() => patch(b.id, { image_path: null })} />
          </Row>
        ))}
      </Section>

      {/* ── 카테고리 ── */}
      <Section title="큰 카테고리" note="홈 가운데 다섯 칸 · 나중에 이모지 대신 그림도 넣을 수 있어요">
        {of('category').map((b, i, arr) => (
          <Row key={b.id} b={b} i={i} last={arr.length - 1}
            onPatch={patch} onSave={save} onMove={move} onUpload={upload}>
            <Field label="이모지" v={b.emoji ?? ''} set={(v) => patch(b.id, { emoji: v })} wide={false} />
            <Field label="글씨" v={b.title} set={(v) => patch(b.id, { title: v })} />
            <Href b={b} set={(v) => patch(b.id, { href: v })} />
          </Row>
        ))}
      </Section>

      {/* ── 큰 배너 ── */}
      <Section title="큰 배너" note="가로로 밀어서 보는 칸 · 숫자는 화면이 세어서 넣어요">
        {of('big').map((b, i, arr) => (
          <Row key={b.id} b={b} i={i} last={arr.length - 1}
            onPatch={patch} onSave={save} onMove={move} onUpload={upload}>
            <Field label="제목" v={b.title} set={(v) => patch(b.id, { title: v })} />
            <label className="block">
              <span className="text-sm font-bold text-gray-500">안에 넣을 숫자</span>
              <select
                value={b.metric ?? ''}
                onChange={(e) => patch(b.id, { metric: (e.target.value || null) as HomeBlock['metric'] })}
                className="mt-1 w-full appearance-none rounded-xs border border-gray-200 bg-gray-50 py-4 pl-5 pr-[36px] text-lg dark:border-gray-700 dark:bg-gray-950"
              >
                {METRICS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </select>
            </label>
            <Field label="설명 (숫자를 안 쓸 때만 보여요)" v={b.descr ?? ''} set={(v) => patch(b.id, { descr: v })} />
            <Href b={b} set={(v) => patch(b.id, { href: v })} />
            <Picture b={b} onUpload={upload} onClear={() => patch(b.id, { image_path: null })} />
          </Row>
        ))}
      </Section>
    </div>
  );
}

/* ─────────────────────────────────────────── */

function Section({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-h3 font-bold">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{note}</p>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Row({
  b, i, last, onSave, onMove, onPatch, children,
}: {
  b: HomeBlock; i: number; last: number;
  onSave: (b: HomeBlock) => void;
  onMove: (b: HomeBlock, d: -1 | 1) => void;
  onPatch: (id: number, v: Partial<HomeBlock>) => void;
  onUpload: (b: HomeBlock, f: File) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={'rounded-sm border p-6 ' + (b.enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950')}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox" className="sr-only"
            checked={b.enabled}
            onChange={(e) => onPatch(b.id, { enabled: e.target.checked })}
          />
          <span className={
            'flex size-[22px] items-center justify-center rounded-xs border text-white ' +
            (b.enabled ? 'border-teal-strong bg-teal-strong' : 'border-gray-300 dark:border-gray-600')
          }>{b.enabled ? '✓' : ''}</span>
          <span className="text-lg font-medium">{b.enabled ? '켜짐' : '꺼짐'}</span>
        </label>

        <span className="text-sm text-gray-400">{i + 1}번째</span>

        <button type="button" onClick={() => onMove(b, -1)} disabled={i === 0}
          aria-label="위로" className="rounded-md border border-gray-200 px-4 py-1 text-lg disabled:opacity-30 dark:border-gray-700">↑</button>
        <button type="button" onClick={() => onMove(b, 1)} disabled={i === last}
          aria-label="아래로" className="rounded-md border border-gray-200 px-4 py-1 text-lg disabled:opacity-30 dark:border-gray-700">↓</button>

        <span className="flex-1" />

        <button type="button" onClick={() => onSave(b)}
          className="rounded-md bg-brand-red px-7 py-4 text-body-lg font-bold text-white hover:bg-brand-red-dark active:scale-[0.98]">
          저장
        </button>
      </div>

      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label, v, set, wide = true,
}: { label: string; v: string; set: (v: string) => void; wide?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-500">{label}</span>
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        className={
          'mt-1 rounded-xs border border-gray-200 bg-gray-50 px-5 py-4 text-lg dark:border-gray-700 dark:bg-gray-950 '
          + (wide ? 'w-full' : 'w-[88px] text-center')
        }
      />
    </label>
  );
}

/* 가는 곳은 코드가 아는 주소 중에서만 고릅니다 */
function Href({ b, set }: { b: HomeBlock; set: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-gray-500">누르면 갈 곳</span>
      <select
        value={b.href ?? ''}
        onChange={(e) => set(e.target.value)}
        className="mt-1 w-full appearance-none rounded-xs border border-gray-200 bg-gray-50 py-4 pl-5 pr-[36px] text-lg dark:border-gray-700 dark:bg-gray-950"
      >
        <option value="">안 눌리게</option>
        {ROUTES.map((r) => (
          <option key={r.href} value={r.href}>
            {r.label}{r.soon ? ' (아직 준비 중 — 「곧 찾아올게요」로 가요)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function Picture({
  b, onUpload, onClear,
}: { b: HomeBlock; onUpload: (b: HomeBlock, f: File) => void; onClear: () => void }) {
  const url = b.image_path
    ? browserSupabase().storage.from('home-images').getPublicUrl(b.image_path).data.publicUrl
    : null;

  return (
    <div>
      <span className="text-sm font-bold text-gray-500">그림 (없으면 teal 바탕에 글씨만)</span>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
          <img src={url} alt="" className="h-[56px] w-[100px] rounded-xs object-cover" />
        )}
        <PhotoPicker label={url ? '그림 바꾸기' : '그림 넣기'} onPick={(f) => onUpload(b, f)} />
        {url && (
          <button type="button" onClick={onClear}
            className="text-sm text-gray-500 hover:underline">
            그림 빼기 (저장을 눌러야 적용돼요)
          </button>
        )}
      </div>
    </div>
  );
}
