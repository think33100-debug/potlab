'use client';

import { useCallback, useEffect, useState } from 'react';
import { PhotoPicker } from '@/components/photo-picker';
import { shrinkToWebp } from '@/lib/image';
import { 올리기탈 } from '@/lib/upload-error';
import { browserSupabase } from '@/lib/supabase-browser';
import { useToast } from '../../toast';

/* 교육기관 꾸미기 (2026-10-04).

   기관마다 소개 글·대표 그림·누리집 주소·차례·보이기를 고칩니다.
   소개 글은 **비워 둔 채로** 두었습니다 — 세중님이 나중에 채웁니다.

   ⚷ 대표 그림은 **관리자가 올린 주소만** 넣습니다.
     남의 누리집 로고를 긁어 오지 않습니다. 비워 두면 회원 화면에
     이름 글자로 된 기본 카드가 나갑니다. */

type 줄 = {
  이름: string; 직군: string; 소개: string | null; 그림: string | null;
  누리집: string | null; 차례: number; 보임: boolean; 모음: boolean;
  링크주소: string | null; 교육수: number;
};

export default function AdminEduOrgs() {
  const [rows, setRows] = useState<줄[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [열린곳, set열린곳] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    /* 기관이 100곳을 넘을 일은 없지만, 쪽을 넘겨 받는 꼴을 지킵니다 */
    const 모두: 줄[] = [];
    for (let 쪽 = 0; 쪽 < 10; 쪽++) {
      const { data, error } = await browserSupabase().rpc('admin_교육기관', { p_page: 쪽 });
      if (error) { setErr(error.message); setRows(모두); return; }
      const 받은것 = (data ?? []) as 줄[];
      모두.push(...받은것);
      if (받은것.length < 100) break;
    }
    setErr(null);
    setRows(모두);
  }, []);

  useEffect(() => { load(); }, [load]);

  const 저장 = async (o: 줄, patch: Partial<줄>) => {
    if (busy) return;
    setBusy(true);
    const 다음 = { ...o, ...patch };
    const { error } = await browserSupabase().rpc('admin_교육기관고치기', {
      p_이름: o.이름,
      p_소개: 다음.소개 ?? '',
      p_그림: 다음.그림 ?? '',
      p_누리집: 다음.누리집 ?? '',
      p_차례: 다음.차례,
      p_보임: 다음.보임,
    });
    setBusy(false);
    if (error) { toast(`저장하지 못했어요 — ${error.message}`, { tone: 'danger' }); return; }
    toast('저장했어요');
    load();
  };

  /* 그림은 홈 배너와 같은 저장소(home-images)를 씁니다 —
     관리자만 올릴 수 있는 통이 이미 있어서 새로 만들 이유가 없습니다 */
  const 그림올리기 = async (o: 줄, file: File) => {
    setBusy(true);
    try {
      const webp = await shrinkToWebp(file, 600);
      // eslint-disable-next-line react-hooks/purity -- 파일 이름이 겹치지 않게 시각을 붙입니다
      const path = `eduorg/${Date.now()}.webp`;
      const sb = browserSupabase();
      const { error } = await sb.storage.from('home-images')
        .upload(path, webp, { contentType: 'image/webp', upsert: true });
      if (error) throw error;
      const url = sb.storage.from('home-images').getPublicUrl(path).data.publicUrl;
      setBusy(false);
      await 저장(o, { 그림: url });
      return;
    } catch (e) {
      /* ★ 2026-10-05 — 브라우저가 돌려주는 말이 영어입니다
         (「The source image could not be decoded.」). 그대로 띄우면
         무엇이 잘못인지 모릅니다. 가장 흔한 두 가지는 우리 말로 바꿉니다 */
      toast('그림을 올리지 못했어요 — ' + 올리기탈(e), { tone: 'danger', ms: 5000 });
    }
    setBusy(false);
  };

  if (err) {
    return (
      <p className="rounded-sm border border-brand-red/40 bg-brand-red-soft p-6 text-lg text-brand-red-dark">
        불러오지 못했어요 — {err}
        <span className="mt-1 block text-sm">app/admin/edu-orgs · admin_교육기관()</span>
      </p>
    );
  }
  if (!rows) return <p className="text-lg text-mute">불러오는 중…</p>;

  return (
    <div>
      <h1 className="text-h1 font-bold">교육기관</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        회원이 보는 <b>교육기관 카드</b>를 꾸밉니다. 소개 글은 비어 있으면
        회원 화면에서 그 칸이 아예 안 보입니다.
      </p>
      <p className="mt-2 break-keep text-sm text-mute">
        ⚷ 대표 그림은 <b>직접 올린 그림 주소</b>만 넣으십시오.
        남의 누리집 로고를 가져오면 안 됩니다. 비워 두면 이름 글자로 된
        기본 카드가 나갑니다.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {rows.map((o) => {
          const 열림 = 열린곳 === o.이름;
          return (
            <li key={o.이름} className="rounded-sm border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-keep text-body-lg font-bold text-ink">
                    {o.이름}
                    {!o.보임 && <span className="ml-2 text-sm text-mute">(숨김)</span>}
                    {!o.모음 && <span className="ml-2 text-sm text-mute">· 링크만</span>}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    {o.직군} · 차례 {o.차례} · 담긴 교육 {o.교육수}건
                    {o.소개 ? ' · 소개 있음' : ' · 소개 없음'}
                    {o.그림 ? ' · 그림 있음' : ' · 그림 없음'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => 저장(o, { 보임: !o.보임 })}
                    className="rounded-xs border border-line px-4 py-2 text-sm font-medium text-mute hover:bg-paper">
                    {o.보임 ? '숨기기' : '보이기'}
                  </button>
                  <button type="button" onClick={() => set열린곳(열림 ? null : o.이름)}
                    className="rounded-xs border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-paper">
                    {열림 ? '닫기' : '고치기'}
                  </button>
                </div>
              </div>

              {열림 && (
                <form
                  className="mt-4 flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    저장(o, {
                      소개: String(f.get('소개') ?? ''),
                      누리집: String(f.get('누리집') ?? ''),
                      차례: Number(f.get('차례')) || o.차례,
                    });
                    set열린곳(null);
                  }}
                >
                  <label className="block">
                    <span className="block text-sm font-bold text-mute">소개 글</span>
                    <textarea name="소개" rows={3} defaultValue={o.소개 ?? ''}
                      placeholder="비워 두면 회원 화면에서 소개 칸이 안 보입니다"
                      className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
                  </label>
                  {/* ★ 주소를 적게 두지 않습니다 (2026-10-04).
                      칸을 두면 남의 누리집 로고 주소를 붙여 넣을 수 있습니다.
                      **올린 그림만** 쓰이게 올리는 단추만 둡니다 */}
                  <div>
                    <span className="block text-sm font-bold text-mute">대표 그림</span>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      {o.그림 && (
                        // eslint-disable-next-line @next/next/no-img-element -- 저장소 주소는 next/image 에 안 걸어뒀습니다
                        <img src={o.그림} alt="" className="size-16 rounded-xs border border-line object-cover" />
                      )}
                      <PhotoPicker
                        label={o.그림 ? '그림 바꾸기' : '그림 넣기'}
                        disabled={busy}
                        onPick={(f) => 그림올리기(o, f)}
                      />
                      {o.그림 && (
                        <button type="button" onClick={() => 저장(o, { 그림: '' })}
                          className="text-sm text-mute hover:underline">
                          그림 빼기 (이름 글자 카드로 보입니다)
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-mute">
                      남의 누리집 로고를 쓰면 안 됩니다. 비워 두면 이름 글자 카드가 나갑니다
                    </p>
                  </div>
                  <label className="block">
                    <span className="block text-sm font-bold text-mute">누리집 주소</span>
                    <input name="누리집" defaultValue={o.누리집 ?? ''}
                      className="mt-1 w-full rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
                  </label>
                  <label className="block">
                    <span className="block text-sm font-bold text-mute">차례 (작을수록 위)</span>
                    <input name="차례" type="number" defaultValue={o.차례}
                      className="mt-1 w-32 rounded-xs border border-line bg-white px-4 py-3 text-lg text-ink" />
                  </label>
                  <div>
                    <button type="submit" disabled={busy}
                      className="rounded-md bg-brand-red px-7 py-4 text-btn font-bold text-white hover:bg-brand-red-dark disabled:opacity-40">
                      저장하기
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
