'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhotoPicker } from '@/components/photo-picker';
import { shrinkToWebp } from '@/lib/image';
import { 올리기탈 } from '@/lib/upload-error';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 오픈 화면 광고 (2026-10-04).

   ── 자리가 둘입니다 ─────────────────────────────────────────
   앱        홈(/) 으로 들어왔을 때 뜨는 오픈 화면
   커뮤니티   /community 로 들어왔을 때 뜨는 오픈 화면
   **따로** 설정합니다. 한쪽만 켜 둘 수 있습니다.

   ── 꺼져 있으면 ────────────────────────────────────────────
   짧은 오픈 화면만 나갑니다. 「광고가 없으면 어떻게 되나」를 걱정할
   필요가 없게, 배너 없음이 기본입니다.

   ── 그림 ───────────────────────────────────────────────────
   저장소(ad-images)에 올립니다. 통이 **1MB · jpg·png·webp** 로 잡혀
   있어서 큰 그림은 서버가 받지 않습니다. 올리기 전에 브라우저에서
   WebP 로 줄입니다.

   ── 세는 것 ────────────────────────────────────────────────
   ⚷ 표시 수·누른 수에 **개인 식별 정보가 없습니다.** 표에 남는 것은
     자리·날·숫자뿐입니다 — 누가 봤는지는 담지 않습니다. */

type 줄 = {
  자리: string; 이름: string | null; 그림: string | null; 링크: string | null;
  표시초: number; 켜짐: boolean; 시작일: string | null; 끝일: string | null;
  지금나가나: boolean; 오늘봄: number; 오늘누름: number; 다봄: number; 다누름: number;
};

export default function AdminAds() {
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    /* 자리가 둘뿐이라 쪽을 나누지 않습니다 (100줄 한도와 무관합니다) */
    const { data, error } = await browserSupabase().rpc('admin_광고배너');
    if (error) { setErr(error.message); return; }
    setErr(null);
    setRows((data ?? []) as 줄[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const 저장 = async (o: 줄, patch: Partial<줄>) => {
    if (busy) return;
    setBusy(o.자리);
    const n = { ...o, ...patch };
    const { data, error } = await browserSupabase().rpc('admin_광고배너고치기', {
      p_자리: o.자리,
      p_이름: n.이름 ?? '',
      p_그림: n.그림 ?? '',
      p_링크: n.링크 ?? '',
      p_표시초: n.표시초,
      p_켜짐: n.켜짐,
      p_시작일: n.시작일 || null,
      p_끝일: n.끝일 || null,
    });
    setBusy(null);
    if (error) { toast('저장하지 못했어요 — ' + error.message, { tone: 'danger', ms: 4000 }); return; }
    const 나가나 = (data as { 지금나가나?: boolean } | null)?.지금나가나;
    toast(나가나 ? '저장했어요 — 지금 나갑니다' : '저장했어요 — 지금은 안 나갑니다');
    load();
  };

  const 그림올리기 = async (o: 줄, file: File) => {
    setBusy(o.자리);
    try {
      /* 오픈 화면은 세로로 길게 쓰니 1200px 로 줄입니다.
         통이 1MB 라 원본을 그대로 보내면 서버가 막습니다 */
      const webp = await shrinkToWebp(file, 1200);
      if (webp.size > 1024 * 1024) {
        throw new Error('줄여도 ' + Math.round(webp.size / 1024) + 'KB 입니다 (1MB 까지)');
      }
      // eslint-disable-next-line react-hooks/purity -- 파일 이름이 겹치지 않게 시각을 붙입니다
      /* ★ 자리 이름이 「앱」·「커뮤니티」라 경로에 그대로 쓰면 InvalidKey 입니다
         (작업지침 6-2b). ad-images 가 0장인 까닭입니다 — 한 번도 안 올라갔습니다 */
      const path = `${o.자리 === '앱' ? 'app' : 'community'}-${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('ad-images')
        .upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      const url = sb.storage.from('ad-images').getPublicUrl(path).data.publicUrl;
      setBusy(null);
      await 저장(o, { 그림: url });
      return;
    } catch (e) {
      toast('그림을 올리지 못했어요 — ' + 올리기탈(e), { tone: 'danger', ms: 5000 });
    }
    setBusy(null);
  };

  if (err) {
    return (
      <p className="rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 text-lg text-brand-red-dark">
        불러오지 못했어요 — {err}
        <span className="mt-1 block text-sm">app/admin/ads · admin_광고배너()</span>
      </p>
    );
  }
  if (!rows) return <p className="text-lg text-mute">불러오는 중…</p>;

  return (
    <div>
      <h1 className="text-h1 font-bold">오픈 화면 광고</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        들어올 때 한 번 보이는 화면입니다. <b>자리마다 따로</b> 설정합니다.
        꺼 두면 짧은 오픈 화면만 나갑니다
      </p>
      <p className="mt-2 break-keep text-sm text-mute">
        그림은 <b>1MB · jpg·png·webp</b> 까지입니다. 표시 수와 누른 수는
        개인 식별 정보 없이 숫자만 셉니다
      </p>

      <div className="mt-6 flex flex-col gap-5">
        {rows.map((o) => (
          <form
            key={o.자리}
            className="rounded-sm border border-line bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              저장(o, {
                이름: String(f.get('이름') ?? ''),
                링크: String(f.get('링크') ?? ''),
                표시초: Number(f.get('표시초')) || 2,
                시작일: String(f.get('시작일') ?? '') || null,
                끝일: String(f.get('끝일') ?? '') || null,
              });
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body-lg font-bold text-ink">
                  {o.자리 === '앱' ? '앱 오픈 화면 (홈으로 들어올 때)' : '커뮤니티 오픈 화면'}
                </p>
                <p className="mt-1 text-sm text-mute">
                  {o.지금나가나
                    ? <b className="text-brand-red">지금 나가고 있습니다</b>
                    : '지금은 안 나갑니다'}
                  {' · 오늘 '}{o.오늘봄}회 보임 · {o.오늘누름}회 눌림
                  {' · 누적 '}{o.다봄} / {o.다누름}
                </p>
              </div>
              <button type="button" disabled={busy === o.자리}
                onClick={() => 저장(o, { 켜짐: !o.켜짐 })}
                className={'rounded-md px-6 py-3 text-lg font-bold disabled:opacity-40 '
                  + (o.켜짐
                    ? 'bg-brand-red text-white hover:bg-brand-red-dark'
                    : 'border border-line text-mute hover:bg-paper')}>
                {o.켜짐 ? '켜져 있음 — 끄기' : '꺼져 있음 — 켜기'}
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              {o.그림 && (
                // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
                <img src={o.그림} alt="" className="h-[120px] w-auto rounded-xs border border-line object-contain" />
              )}
              <PhotoPicker
                label={o.그림 ? '그림 바꾸기' : '그림 넣기'}
                disabled={busy === o.자리}
                onPick={(f) => 그림올리기(o, f)}
              />
              {o.그림 && (
                <button type="button" onClick={() => 저장(o, { 그림: '' })}
                  className="text-sm text-mute hover:underline">
                  그림 빼기 (배너가 안 나갑니다)
                </button>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="block text-sm font-bold text-mute">광고주·메모 (회원에게 안 보임)</span>
                <input name="이름" defaultValue={o.이름 ?? ''}
                  className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
              </label>
              <label className="block">
                <span className="block text-sm font-bold text-mute">누르면 갈 곳 (비우면 못 누름)</span>
                <input name="링크" defaultValue={o.링크 ?? ''} placeholder="https://"
                  className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
              </label>
              <label className="block">
                <span className="block text-sm font-bold text-mute">보여줄 시간 (1~5초)</span>
                <input name="표시초" type="number" min={1} max={5} defaultValue={o.표시초}
                  className="mt-1 w-28 rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-bold text-mute">시작일</span>
                  <input name="시작일" type="date" defaultValue={o.시작일 ?? ''}
                    className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
                </label>
                <label className="block">
                  <span className="block text-sm font-bold text-mute">끝일</span>
                  <input name="끝일" type="date" defaultValue={o.끝일 ?? ''}
                    className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
                </label>
              </div>
            </div>

            <button type="submit" disabled={busy === o.자리}
              className="mt-5 rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white hover:bg-brand-red-dark disabled:opacity-40">
              저장하기
            </button>
          </form>
        ))}
      </div>

      <p className="mt-6 break-keep rounded-sm border border-line bg-card p-5 text-sm leading-relaxed text-mute">
        다시 보려면 <b>탭을 닫고 새로 열어야</b> 합니다 — 한 방문에 한 번만 뜨게
        해 두었습니다. 바로 보려면 주소창에서 새 탭으로 여십시오.
      </p>
    </div>
  );
}
