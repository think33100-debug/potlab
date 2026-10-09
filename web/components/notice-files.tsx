'use client';

import { useCallback, useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/supabase-browser';

/* 공고 첨부 — 채용 공고와 교육 회차가 **같은 부품**을 씁니다 (2026-10-09).
 *
 * ── 받은 파일이 진짜 그 형식인지 봅니다 ─────────────────────
 * 확장자와 브라우저가 말하는 type 은 둘 다 **거짓말할 수 있습니다.**
 * 그래서 앞 몇 글자를 직접 읽습니다 (작업지침 5절 — PDF 는 `%PDF-`).
 *   PDF   25 50 44 46 2D        %PDF-
 *   JPEG  FF D8 FF
 *   PNG   89 50 4E 47 0D 0A 1A 0A
 *   HWP   D0 CF 11 E0 …         옛 한글 (OLE 묶음)
 *   HWPX·DOCX  50 4B 03 04      zip 묶음
 * 여기서 막는 것은 **잘못 고른 파일**입니다. 올리는 분은 승인된 담당자라
 * 속이려는 사람이 아니고, 버킷의 allowed_mime_types 가 한 겹 더 받칩니다.
 *
 * ── hwp 는 보관·내려받기만 ──────────────────────────────────
 * 읽어서 칸을 채우지 않습니다. 화면에 그렇게 적어 둡니다.
 *
 * ── 비회원은 아무것도 못 받습니다 ───────────────────────────
 * 목록도 경로도 **창구가 로그인한 사람에게만** 줍니다 (첨부목록·첨부하나).
 */

type 첨부 = {
  id: number; 이름: string; 크기: number; 형식: string;
  읽었나: boolean; 올린때: string;
};

const 최대개수 = 5;
const 최대크기 = 10 * 1024 * 1024;

const 봐주는형식: Record<string, string> = {
  'image/jpeg': '그림', 'image/png': '그림', 'image/webp': '그림',
  'application/pdf': 'PDF',
  'application/x-hwp': '한글', 'application/haansofthwp': '한글',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '워드',
};

const 크기말 = (n: number) =>
  n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.ceil(n / 1024) + 'KB';

/* 앞 글자를 보고 진짜 형식을 답합니다. 모르면 null */
async function 진짜형식(f: File): Promise<string | null> {
  const b = new Uint8Array(await f.slice(0, 8).arrayBuffer());
  const 같나 = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  if (같나(0x25, 0x50, 0x44, 0x46, 0x2d)) return 'application/pdf';
  if (같나(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (같나(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (같나(0xd0, 0xcf, 0x11, 0xe0)) return 'application/x-hwp';
  if (같나(0x50, 0x4b, 0x03, 0x04)) {
    /* zip 묶음입니다 — docx 도 hwpx 도 여기 걸립니다. 이름으로 가릅니다 */
    return /\.docx$/i.test(f.name)
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/haansofthwp';
  }
  if (같나(0x52, 0x49, 0x46, 0x46)) return 'image/webp';   // RIFF….WEBP
  return null;
}

export function NoticeFiles({
  갈래, 공고, 회차, 고칠수있나, 읽어서채우기,
}: {
  갈래: '채용' | '교육';
  공고?: string;
  회차?: number;
  /* 담당자 화면이면 true. 회원이 보는 화면이면 false — 목록만 보입니다 */
  고칠수있나: boolean;
  /* 공고문을 읽어 칸을 미리 채우는 자리 (D). 담당자가 확인·수정 후 저장합니다 */
  읽어서채우기?: (첨부id: number) => void;
}) {
  const [줄들, set줄들] = useState<첨부[] | null>(null);
  const [탈, set탈] = useState<string | null>(null);
  const [도는중, set도는중] = useState(false);
  const [다시, set다시] = useState(0);

  useEffect(() => {
    if (갈래 === '채용' ? !공고 : !회차) return;
    let 살아있나 = true;
    browserSupabase()
      .rpc('첨부목록', { p_갈래: 갈래, p_공고: 공고 ?? null, p_회차: 회차 ?? null })
      .then(({ data, error }) => {
        if (!살아있나) return;
        if (error) { set탈(error.message); set줄들([]); return; }
        set줄들((data ?? []) as 첨부[]);
      });
    return () => { 살아있나 = false; };
  }, [갈래, 공고, 회차, 다시]);

  const 올리기 = useCallback(async (f: File) => {
    set탈(null);
    if (f.size > 최대크기) { set탈(`파일 하나는 ${크기말(최대크기)} 까지예요`); return; }

    const 형식 = await 진짜형식(f);
    if (!형식) { set탈('이 파일은 못 올려요. 그림·PDF·한글·워드만 됩니다'); return; }
    if (형식 !== f.type && f.type) {
      /* 막지는 않고 알려만 줍니다 — 브라우저가 type 을 비워 보내는 일도 많습니다 */
      console.log('[첨부] 확장자와 속이 다릅니다', f.type, '→', 형식);
    }

    set도는중(true);
    const sb = browserSupabase();
    /* ★ 저장소 열쇠(경로)에는 **한글을 못 씁니다** — Supabase Storage 가
       InvalidKey 로 거절합니다. 공고문 이름은 거의 다 한글이라 여기서 다
       막혔습니다 (2026-10-10 에 tools/첨부시험.mjs 가 잡았습니다).
       그래서 경로는 uuid + 확장자만 쓰고, **보여줄 이름은 표(공고첨부.이름)에**
       그대로 둡니다. 작업지침 6-2b — 밖에서 이름으로 가리키는 자리는 영문. */
    const 확장자 = (f.name.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '').toLowerCase();
    const 자리 = `${갈래 === '채용' ? 공고 : '교육' + 회차}/${crypto.randomUUID()}${확장자}`;

    const { error: 올림 } = await sb.storage.from('notices')
      .upload(자리, f, { contentType: 형식, upsert: false });
    if (올림) {
      set도는중(false);
      /* 저장소 규칙이 아직 없으면 여기서 막힙니다 — 솔직히 적습니다 */
      set탈('못 올렸어요 — ' + 올림.message
        + ' (저장소 규칙이 아직 안 올라갔으면 내일 아침에 됩니다)');
      return;
    }

    const { error } = await sb.rpc('첨부올리기', {
      p_갈래: 갈래, p_경로: 자리, p_이름: f.name, p_크기: f.size, p_형식: 형식,
      p_공고: 공고 ?? null, p_회차: 회차 ?? null,
    });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    set다시((n) => n + 1);
  }, [갈래, 공고, 회차]);

  const 받기 = useCallback(async (id: number) => {
    const { data, error } = await browserSupabase().rpc('첨부하나', { p_id: id });
    if (error || !data) { set탈('내려받지 못했어요'); return; }
    const { 경로 } = data as { 경로: string };
    const { data: 주소, error: e2 } = await browserSupabase()
      .storage.from('notices').createSignedUrl(경로, 60);
    if (e2 || !주소) { set탈('내려받지 못했어요 — ' + (e2?.message ?? '')); return; }
    window.open(주소.signedUrl, '_blank', 'noopener');
  }, []);

  const 치우기 = useCallback(async (id: number) => {
    if (!confirm('이 첨부를 치울까요?')) return;
    const { error } = await browserSupabase().rpc('첨부치우기', { p_id: id });
    if (error) { set탈(error.message); return; }
    set다시((n) => n + 1);
  }, []);

  if (줄들 === null) return <p className="mt-3 text-lg text-mute">잠시만요…</p>;
  if (!고칠수있나 && 줄들.length === 0) return null;

  return (
    <section className="mt-5 rounded-sm border border-gray-200 p-5">
      <p className="text-lg font-bold">첨부 {줄들.length}/{최대개수}</p>
      {탈 && <p className="mt-2 break-keep text-lg text-brand-red-dark">{탈}</p>}

      {줄들.length === 0
        ? <p className="mt-2 break-keep text-lg text-mute">아직 올린 파일이 없어요.</p>
        : (
          <ul className="mt-3 space-y-2">
            {줄들.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-sm bg-gray-50 p-3 dark:bg-gray-900">
                <span className="rounded-full bg-white px-3 py-1 text-[13px] dark:bg-gray-800">
                  {봐주는형식[a.형식] ?? '파일'}
                </span>
                <b className="break-all text-lg">{a.이름}</b>
                <span className="text-sm text-mute">{크기말(a.크기)}</span>
                <button type="button" onClick={() => 받기(a.id)}
                  className="ml-auto rounded-md border border-gray-200 bg-white px-4 py-2 text-lg text-gray-600 hover:bg-gray-50 dark:bg-gray-800">
                  내려받기
                </button>
                {고칠수있나 && 읽어서채우기 && (
                  a.형식 === 'application/pdf' || a.형식.startsWith('image/')
                    ? (
                      <button type="button" onClick={() => 읽어서채우기(a.id)}
                        className="rounded-md border border-gray-200 bg-white px-4 py-2 text-lg text-gray-600 hover:bg-gray-50 dark:bg-gray-800">
                        읽어서 칸 채우기
                      </button>
                    )
                    : <span className="text-sm text-mute">한글 파일은 보관·내려받기만 돼요</span>
                )}
                {고칠수있나 && (
                  <button type="button" onClick={() => 치우기(a.id)}
                    className="rounded-md border border-brand-red bg-white px-4 py-2 text-lg text-brand-red-dark hover:bg-gray-50 dark:bg-gray-800">
                    치우기
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

      {고칠수있나 && 줄들.length < 최대개수 && (
        <div className="mt-4">
          <input type="file" disabled={도는중}
            accept="image/jpeg,image/png,image/webp,application/pdf,.hwp,.hwpx,.docx"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) 올리기(f); e.target.value = ''; }}
            className="w-full text-lg" />
          <p className="mt-2 break-keep text-sm text-mute">
            그림·PDF·한글·워드 · 하나에 {크기말(최대크기)} 까지 · {최대개수}개까지.
            <b> 공고문을 PDF 나 그림으로 올리시면 아래 칸을 미리 채워 드려요.</b>
            {' '}한글(.hwp) 파일은 보관과 내려받기만 됩니다.
          </p>
        </div>
      )}
    </section>
  );
}
