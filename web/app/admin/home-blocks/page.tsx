'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon, ICON_NAMES } from '@/components/icon';
import { HOME_COLS, type HomeBlock } from '@/lib/home';
import { PhotoPicker } from '@/components/photo-picker';
import { shrinkToWebp } from '@/lib/image';
import { ROUTES } from '@/lib/routes';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { 관, AdminSection } from '@/components/rapo/rapo-admin-ui';

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
  const [commSeconds, setCommSeconds] = useState('5');
  const [savedCommSeconds, setSavedCommSeconds] = useState('5');

  /* 받아오는 일과 상태에 넣는 일을 갈라둡니다 —
     effect 안에서 바로 setState 하면 그릴 때마다 한 번 더 그립니다 */
  const fetchAll = useCallback(async () => {
    const sb = browserSupabase();
    const [b, s, c] = await Promise.all([
      sb.from('home_blocks').select(HOME_COLS).order('kind').order('sort'),
      sb.from('site_settings').select('value').eq('key', 'top_banner_seconds').maybeSingle(),
      sb.from('site_settings').select('value').eq('key', 'comm_banner_seconds').maybeSingle(),
    ]);
    return {
      blocks: (b.data ?? []) as unknown as HomeBlock[],
      sec: String((s.data as { value: unknown } | null)?.value ?? 5),
      commSec: String((c.data as { value: unknown } | null)?.value ?? 5),
    };
  }, []);

  const load = useCallback(async () => {
    const r = await fetchAll();
    setBlocks(r.blocks);
    setSeconds(r.sec);
    setSavedSeconds(r.sec);
    setCommSeconds(r.commSec);
    setSavedCommSeconds(r.commSec);
  }, [fetchAll]);

  useEffect(() => {
    let alive = true;
    fetchAll().then((r) => {
      if (!alive) return;
      setBlocks(r.blocks);
      setSeconds(r.sec);
      setSavedSeconds(r.sec);
      setCommSeconds(r.commSec);
      setSavedCommSeconds(r.commSec);
    });
    return () => { alive = false; };
  }, [fetchAll]);

  if (!blocks) return <p className={관.muted}>불러오는 중…</p>;

  const of = (kind: HomeBlock['kind']) =>
    blocks.filter((b) => b.kind === kind).sort((a, c) => a.sort - c.sort);

  const patch = (id: number, v: Partial<HomeBlock>) =>
    setBlocks((all) => (all ?? []).map((b) => (b.id === id ? { ...b, ...v } : b)));

  const save = async (b: HomeBlock) => {
    const { error } = await browserSupabase().from('home_blocks').update({
      enabled: b.enabled, emoji: b.emoji, icon: b.icon, image_path: b.image_path,
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

  const saveSeconds = async (key: string, raw: string, done: (v: string) => void) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 2 || n > 60) {
      toast('2초에서 60초 사이로 넣어 주세요', { tone: 'danger' }); return;
    }
    const { error } = await browserSupabase().from('site_settings')
      .update({ value: n, updated_at: new Date().toISOString() })
      .eq('key', key);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 4000 }); return; }
    done(String(n));
    toast(`${n}초마다 넘기게 했어요`);
  };

  return (
    <div className="max-w-[932px]">
      {/* 2026-11-19 새 관리자 디자인(Figma 16 · 공고 상세 꼴)으로 겉모양만 다시 입힘 */}
      <RapoAdminHeader title="홈 꾸미기" />
      {/* ── 상단 배너 ── */}
      <Section
        title="상단 배너"
        note={`켜진 것만 홈에 나와요 · 제목이 비면 안 나와요 · 지금 ${of('top').filter((b) => b.enabled && b.title).length}개`}
      >
        <div className={'flex flex-wrap items-end gap-[12px] ' + 관.card}>
          <label className="text-[14px] font-bold leading-[19px] text-[#304f65]">
            넘어가는 속도 <span className="font-normal">(새 홈 맨 위 배너도 이 값으로 넘어가요)</span>
            <div className="mt-[6px] flex gap-[8px]">
              <input
                type="number" min={2} max={60}
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                className={관.input + ' w-[88px] text-center'}
              />
              <span className={'self-center ' + 관.muted}>초</span>
            </div>
          </label>
          <button
            type="button" onClick={() => saveSeconds('top_banner_seconds', seconds, setSavedSeconds)}
            disabled={seconds === savedSeconds}
            className={관.btn + ' h-[44px]'}
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
            {/* 이모지는 안 씁니다 — 라인 아이콘 이름을 고릅니다.
                없는 이름이 들어와도 화면은 기본 아이콘으로 떨어집니다 */}
            <IconField v={b.icon ?? ''} set={(v) => patch(b.id, { icon: v })} />
            <Field label="글씨" v={b.title} set={(v) => patch(b.id, { title: v })} />
            <Href b={b} set={(v) => patch(b.id, { href: v })} />
          </Row>
        ))}
      </Section>

      {/* ── 커뮤니티 배너 ── */}
      <Section
        title="커뮤니티 배너"
        note={`커뮤니티 맨 위에 옆으로 밀리는 줄 · 제목이 비면 안 나와요 · 지금 ${of('comm').filter((b) => b.enabled && b.title).length}개`}
      >
        <div className={'flex flex-wrap items-end gap-[12px] ' + 관.card}>
          <label className="text-[14px] font-bold leading-[19px] text-[#304f65]">
            넘어가는 속도
            <div className="mt-[6px] flex gap-[8px]">
              <input
                type="number" min={2} max={60}
                value={commSeconds}
                onChange={(e) => setCommSeconds(e.target.value)}
                className={관.input + ' w-[88px] text-center'}
              />
              <span className={'self-center ' + 관.muted}>초</span>
            </div>
          </label>
          <button
            type="button"
            onClick={() => saveSeconds('comm_banner_seconds', commSeconds, setSavedCommSeconds)}
            disabled={commSeconds === savedCommSeconds}
            className={관.btn + ' h-[44px]'}
          >
            속도 저장
          </button>
        </div>

        {of('comm').map((b, i, arr) => (
          <Row key={b.id} b={b} i={i} last={arr.length - 1}
            onPatch={patch} onSave={save} onMove={move} onUpload={upload}>
            <Field label="제목" v={b.title} set={(v) => patch(b.id, { title: v })} />
            <Field label="설명" v={b.descr ?? ''} set={(v) => patch(b.id, { descr: v })} />
            <Href b={b} set={(v) => patch(b.id, { href: v })} />
            <Picture b={b} onUpload={upload} onClear={() => patch(b.id, { image_path: null })} />
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
              <span className={관.fieldLabel}>안에 넣을 숫자</span>
              <select
                value={b.metric ?? ''}
                onChange={(e) => patch(b.id, { metric: (e.target.value || null) as HomeBlock['metric'] })}
                className={관.select + ' w-full'}
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
    <AdminSection title={title} sub={note}>
      <div className="flex flex-col gap-[16px]">{children}</div>
    </AdminSection>
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
    <div className={'rounded-[12px] border border-[#dde4e6] p-[20px] md:p-[24px] ' + (b.enabled ? 'bg-white' : 'bg-[#f6f8f9]')}>
      <div className="mb-[20px] flex flex-wrap items-center gap-[12px] border-b border-[#dde4e6] pb-[16px]">
        <label className="flex min-h-[40px] cursor-pointer items-center gap-[10px]">
          <input
            type="checkbox" className="sr-only"
            checked={b.enabled}
            onChange={(e) => onPatch(b.id, { enabled: e.target.checked })}
          />
          <span className={
            'flex size-[22px] items-center justify-center rounded-[6px] border text-[13px] text-white ' +
            (b.enabled ? 'border-[#112231] bg-[#112231]' : 'border-[#c7d1d9] bg-white')
          }>{b.enabled ? '✓' : ''}</span>
          <span className={'text-[16px] font-bold ' + (b.enabled ? 'text-[#112231]' : 'text-[#555d6d]')}>{b.enabled ? '켜짐' : '꺼짐'}</span>
        </label>

        <span className={관.sub}>{i + 1}번째</span>

        <button type="button" onClick={() => onMove(b, -1)} disabled={i === 0}
          aria-label="위로" className={관.btnSm + ' w-[36px] px-0'}>↑</button>
        <button type="button" onClick={() => onMove(b, 1)} disabled={i === last}
          aria-label="아래로" className={관.btnSm + ' w-[36px] px-0'}>↓</button>

        <span className="flex-1" />

        <button type="button" onClick={() => onSave(b)}
          className={관.btn + ' min-w-[96px]'}>
          저장
        </button>
      </div>

      <div className="grid gap-[16px]">{children}</div>
    </div>
  );
}

function Field({
  label, v, set, wide = true,
}: { label: string; v: string; set: (v: string) => void; wide?: boolean }) {
  return (
    <label className="block">
      <span className={관.fieldLabel}>{label}</span>
      <input
        value={v}
        onChange={(e) => set(e.target.value)}
        className={
          관.input + ' '
          + (wide ? '' : 'max-w-[88px] text-center')
        }
      />
    </label>
  );
}

/* 아이콘은 코드가 아는 이름 중에서만 고릅니다.
   글자로 직접 치게 두면 오타가 나고, 그러면 화면에 기본 아이콘만 남습니다 */
function IconField({ v, set }: { v: string; set: (v: string) => void }) {
  return (
    <label className="block">
      <span className={관.fieldLabel}>아이콘</span>
      <span className="flex items-center gap-[12px]">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] border border-[#dde4e6] bg-[#f6f8f9] text-[#112231]">
          <Icon name={v} size={20} />
        </span>
        <select
          value={v}
          onChange={(e) => set(e.target.value)}
          className={관.select + ' flex-1'}
        >
          <option value="">없음 (점으로 보여요)</option>
          {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </span>
    </label>
  );
}

/* 가는 곳은 코드가 아는 주소 중에서만 고릅니다 */
function Href({ b, set }: { b: HomeBlock; set: (v: string) => void }) {
  return (
    <label className="block">
      <span className={관.fieldLabel}>누르면 갈 곳</span>
      <select
        value={b.href ?? ''}
        onChange={(e) => set(e.target.value)}
        className={관.select + ' w-full'}
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
      <span className={관.fieldLabel}>그림 (없으면 teal 바탕에 글씨만)</span>
      <div className="flex flex-wrap items-center gap-[12px]">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
          <img src={url} alt="" className="h-[56px] w-[100px] rounded-[8px] border border-[#dde4e6] object-cover" />
        )}
        <PhotoPicker label={url ? '그림 바꾸기' : '그림 넣기'} onPick={(f) => onUpload(b, f)} />
        {url && (
          <button type="button" onClick={onClear}
            className={관.btnTextDanger}>
            그림 빼기 (저장을 눌러야 적용돼요)
          </button>
        )}
      </div>
    </div>
  );
}
