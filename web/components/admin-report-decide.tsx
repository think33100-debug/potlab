'use client';

import { useState } from 'react';
import { useToast } from '@/app/toast';
import { browserSupabase } from '@/lib/supabase-browser';

/* 운영자 신고 처리 — 원문 보기 · 결정(숨김/유지) · 신고자에게 보낼 안내 (2026-11-15 · 피그마 16 「운영자의 신고 처리」).
   「신고자 설명과 원문을 함께 확인한 뒤 처리 결과 결정 · 처리 완료 후 신고자에게 보낸 안내 확인 가능」.
   DB admin_신고원문 · admin_신고결정 (금고 SQL_1113/ZR) — 「숨김」이면 글·댓글은 바로 내려갑니다(공고는 운영 화면에서 따로).
   보낸 안내는 신고자의 내 정보 → 신고 센터와 앱 알림에 같은 글로 갑니다. 글·공고 신고 두 목록이 같이 씁니다 */

type 원문 = { 갈래?: string; 제목?: string | null; 본문?: string | null; 숨김?: boolean; 없음?: boolean; org_name?: string; url?: string };

export function AdminReportDecide({ 무엇, id, 결정, 안내, onDone }: {
  무엇: '글' | '공고'; id: number; 결정?: string | null; 안내?: string | null; onDone: () => void;
}) {
  const toast = useToast();
  const [원, set원] = useState<원문 | null>(null);
  const [고름, set고름] = useState<'숨김' | '유지' | null>(null);
  const [글, set글] = useState('');
  const [busy, setBusy] = useState(false);

  if (결정) {
    return (
      <p className="mt-3 break-keep rounded-sm bg-gray-50 p-4 text-lg dark:bg-gray-900">
        <b>결정 · {결정}</b>
        <span className="mt-1 block text-mute">신고자에게 보낸 안내 — {안내 ?? (결정 === '숨김' ? '운영 정책에 따라 신고하신 내용을 숨겼어요.' : '확인했지만 운영 정책에 어긋나지 않아 그대로 두었어요.')}</span>
      </p>
    );
  }

  const 원문보기 = async () => {
    if (원) { set원(null); return; }
    const { data, error } = await browserSupabase().rpc('admin_신고원문', { p_무엇: 무엇 === '공고' ? '공고' : '글', p_id: id });
    if (error) { toast(`원문을 못 불러왔어요 — ${error.message}`, { tone: 'danger' }); return; }
    set원((data ?? { 없음: true }) as 원문);
  };

  const 기본안내 = (k: '숨김' | '유지') => (k === '숨김'
    ? '운영 정책에 따라 신고하신 내용을 숨겼어요. 알려 주셔서 고마워요.'
    : '확인했지만 운영 정책에 어긋나지 않아 그대로 두었어요. 알려 주셔서 고마워요.');

  const 보내기 = async () => {
    if (!고름) return;
    setBusy(true);
    const { error } = await browserSupabase().rpc('admin_신고결정', { p_무엇: 무엇 === '공고' ? '공고' : '글', p_id: id, p_결정: 고름, p_안내: 글.trim() || null });
    setBusy(false);
    if (error) { toast(`처리하지 못했어요 — ${error.message}`, { tone: 'danger', ms: 5000 }); return; }
    toast('결정하고 신고자에게 알렸어요');
    onDone();
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <button type="button" onClick={원문보기} className="self-start text-lg text-interaction-blue hover:underline">
        {원 ? '원문 접기' : '원문 보기'}
      </button>
      {원 && (
        <div className="rounded-sm border border-gray-200 p-4 dark:border-gray-700">
          {원.없음 ? <p className="text-lg text-mute">원문을 찾지 못했어요 (지워졌을 수 있어요)</p> : (
            <>
              <p className="text-sm text-mute">{원.갈래 ?? '공고'}{원.숨김 ? ' · 지금 숨겨져 있음' : ''}{원.org_name ? ` · ${원.org_name}` : ''}</p>
              {원.제목 && <p className="mt-1 break-keep text-lg font-bold">{원.제목}</p>}
              {원.본문 && <p className="mt-2 whitespace-pre-wrap break-keep text-lg">{원.본문}</p>}
              {원.url && <a href={원.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-interaction-blue hover:underline">기관 원문 열기</a>}
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(['숨김', '유지'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={고름 === k} onClick={() => { set고름(k); set글(기본안내(k)); }}
            className={'rounded-md px-5 py-3 text-lg font-bold ' + (고름 === k ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700')}>
            {k === '숨김' ? (무엇 === '공고' ? '문제 있음' : '숨기기') : '그대로 두기'}
          </button>
        ))}
      </div>
      {고름 && (
        <>
          <label className="text-sm text-mute" htmlFor={`안내${무엇}${id}`}>신고자에게 보낼 안내 (신고 센터·앱 알림에 그대로 보여요)</label>
          <textarea id={`안내${무엇}${id}`} value={글} onChange={(e) => set글(e.target.value.slice(0, 300))} rows={3}
            className="rounded-sm border border-gray-200 px-4 py-3 text-lg dark:border-gray-700 dark:bg-gray-950" />
          <button type="button" onClick={보내기} disabled={busy}
            className="self-start rounded-md bg-teal-strong px-6 py-3 text-lg font-bold text-white disabled:opacity-40">
            {busy ? '보내는 중…' : '결정하고 알리기'}
          </button>
        </>
      )}
    </div>
  );
}
