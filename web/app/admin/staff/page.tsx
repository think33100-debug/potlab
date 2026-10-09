'use client';

import { useCallback, useEffect, useState } from 'react';
import { 권한들, type 권한코드 } from '@/lib/permissions';
import { browserSupabase } from '@/lib/supabase-browser';

/* 직원과 권한 — **대표만** 고칠 수 있습니다 (2026-10-09 · 뼈대 2절).
 *
 * ── 화면은 단추를 감출 뿐입니다 ──────────────────────────────
 * 대표가 아니면 여기 단추가 안 보이지만, 그것이 막는 자리는 아닙니다.
 * 쓰는 창구 넷(직원넣기·직원빼기·권한주기·권한거두기)은 **함수 안에서**
 * 대표인가() 로 막습니다. 브라우저에서 억지로 불러도 42501 이 납니다.
 *
 * ── 회원번호로 다룹니다 ──────────────────────────────────────
 * 화면에 uuid 를 띄우지 않으려고요. 회원번호는 /admin/members 에 있습니다.
 *
 * ── 지우지 않습니다 ──────────────────────────────────────────
 * 직원을 빼도 권한을 거둬도 줄은 남고 「끈때」만 채워집니다.
 * 누가 언제 무엇을 가졌었는지가 기록입니다. 아래 「준 기록」에 보입니다.
 */

type 직원 = {
  profile_id: string; 회원번호: number; 닉네임: string; 갈래: string;
  넣은때: string; 끈때: string | null; 권한: 권한코드[];
};
type 기록 = {
  언제: string; 누가: string | null; 누구에게: string | null;
  권한코드: string; 준것인가: boolean; 까닭: string | null;
};
type 내것 = { 대표: boolean; 운영진: boolean; 권한: 권한코드[] };

const 날 = (s: string | null) =>
  (!s ? '' : new Date(s).toLocaleString('ko-KR',
    { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }));

export default function AdminStaff() {
  const [내, set내] = useState<내것 | null>(null);
  const [목록, set목록] = useState<직원[] | null>(null);
  const [기록들, set기록들] = useState<기록[]>([]);
  const [탈, set탈] = useState<string | null>(null);
  const [새번호, set새번호] = useState('');
  const [메모, set메모] = useState('');
  const [도는중, set도는중] = useState(false);

  const 읽기 = useCallback(async () => {
    const sb = browserSupabase();
    const [a, b, c] = await Promise.all([
      sb.rpc('내권한'),
      sb.rpc('admin_직원목록'),
      sb.rpc('admin_권한기록', { p_몇줄: 50 }),
    ]);
    if (a.error) { set탈(a.error.message); return; }
    set내(a.data as 내것);
    if (b.error) setErrOnce(b.error.message); else set목록((b.data ?? []) as 직원[]);
    if (!c.error) set기록들((c.data ?? []) as 기록[]);
  }, []);

  /* 목록을 못 읽어도 내 권한은 보여줍니다 — 무엇 때문인지 알아야 하니까요 */
  const setErrOnce = (m: string) => set탈((p) => p ?? m);

  useEffect(() => { 읽기(); }, [읽기]);

  const 부르기 = async (fn: string, 인수: Record<string, unknown>) => {
    set도는중(true); set탈(null);
    const { error } = await browserSupabase().rpc(fn, 인수);
    set도는중(false);
    if (error) { set탈(error.message); return false; }
    await 읽기();
    return true;
  };

  const 넣기 = async () => {
    const n = Number(새번호.trim());
    if (!Number.isFinite(n) || n <= 0) { set탈('회원번호를 숫자로 넣어 주세요'); return; }
    if (await 부르기('admin_직원넣기', { p_회원번호: n, p_메모: 메모.trim() || null })) {
      set새번호(''); set메모('');
    }
  };

  const 대표 = !!내?.대표;

  if (탈 && !내) {
    return <p className="mt-6 rounded-sm border border-brand-red p-5 text-lg text-brand-red-dark">{탈}</p>;
  }
  if (!내) return <p className="mt-6 text-lg text-mute">잠시만요…</p>;

  return (
    <div className="mt-6">
      <h1 className="text-h2 font-bold text-[#14181C]">직원과 권한</h1>
      <p className="mt-2 text-lg text-mute">
        {대표
          ? '대표입니다 — 직원을 넣고 권한을 주고 거둘 수 있어요.'
          : '직원입니다 — 보기만 됩니다. 넣고 거두는 것은 대표만 합니다.'}
      </p>

      {탈 && (
        <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>
      )}

      {대표 && (
        <section className="mt-7 rounded-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold">직원 넣기</h2>
          <p className="mt-1 text-sm text-mute">
            회원번호로 넣습니다. 번호는 <b>회원</b> 화면에 있어요. 넣은 뒤 권한을 따로 줍니다.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              value={새번호} onChange={(e) => set새번호(e.target.value)}
              inputMode="numeric" placeholder="회원번호"
              className="w-[9rem] rounded-sm border border-gray-200 px-4 py-3 text-lg" />
            <input
              value={메모} onChange={(e) => set메모(e.target.value)}
              placeholder="메모 (안 써도 됩니다)"
              className="min-w-[14rem] flex-1 rounded-sm border border-gray-200 px-4 py-3 text-lg" />
            <button
              type="button" onClick={넣기} disabled={도는중}
              className="rounded-md bg-brand-red px-6 py-3 text-lg font-bold text-white
                         hover:bg-brand-red-dark active:scale-[0.98] disabled:opacity-50">
              넣기
            </button>
          </div>
        </section>
      )}

      <section className="mt-7">
        <h2 className="text-lg font-bold">운영진 {목록 ? 목록.length : 0}명</h2>
        <div className="mt-3 space-y-4">
          {(목록 ?? []).map((s) => (
            <article key={s.profile_id}
              className={'rounded-sm border p-5 ' + (s.끈때 ? 'border-gray-200 opacity-55' : 'border-gray-200')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] font-bold dark:bg-gray-800">
                  {s.갈래}
                </span>
                <b className="text-lg">{s.닉네임}</b>
                <span className="text-sm text-mute">회원번호 {s.회원번호} · 넣은날 {날(s.넣은때)}</span>
                {s.끈때 && <span className="text-sm text-brand-red-dark">뺐습니다 · {날(s.끈때)}</span>}
                {대표 && s.갈래 !== '대표' && !s.끈때 && (
                  <button
                    type="button" disabled={도는중}
                    onClick={() => 부르기('admin_직원빼기', { p_회원번호: s.회원번호, p_까닭: null })}
                    className="ml-auto rounded-md border border-gray-200 px-4 py-2 text-sm
                               text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    직원에서 빼기
                  </button>
                )}
              </div>

              {s.갈래 === '대표' ? (
                <p className="mt-3 text-sm text-mute">대표는 열두 가지를 모두 할 수 있습니다.</p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {권한들.map((p) => {
                    const 가짐 = s.권한.includes(p.코드);
                    return (
                      <button
                        key={p.코드} type="button" title={p.설명}
                        disabled={!대표 || 도는중 || !!s.끈때}
                        onClick={() => 부르기(가짐 ? 'admin_권한거두기' : 'admin_권한주기',
                          { p_회원번호: s.회원번호, p_코드: p.코드, p_까닭: null })}
                        className={'rounded-full px-4 py-2 text-sm font-medium ' +
                          (가짐
                            ? 'bg-badge-teal-bg text-teal-strong'
                            : 'border border-gray-200 text-gray-500') +
                          (대표 && !s.끈때 ? ' hover:opacity-80' : ' cursor-default')}>
                        {가짐 ? '✓ ' : ''}{p.이름}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-lg font-bold">준 기록</h2>
        <p className="mt-1 text-sm text-mute">지우지 않습니다. 누가 언제 무엇을 주고 거뒀는지 남습니다.</p>
        {기록들.length === 0
          ? <p className="mt-3 text-lg text-mute">아직 없어요.</p>
          : (
            <ul className="mt-3 space-y-2">
              {기록들.map((r, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-mute">{날(r.언제)}</span>{' · '}
                  <b>{r.누가 ?? '(모름)'}</b>
                  {r.준것인가 ? ' 가 ' : ' 가 '}
                  <b>{r.누구에게 ?? '(모름)'}</b>
                  {' 에게 '}{r.권한코드}{r.준것인가 ? ' 를 줬습니다' : ' 를 거뒀습니다'}
                  {r.까닭 ? ' — ' + r.까닭 : ''}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
