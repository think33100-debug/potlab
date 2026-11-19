'use client';

import { useCallback, useEffect, useState } from 'react';
import { 권한들, type 권한코드 } from '@/lib/permissions';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoAdminHeader } from '@/components/rapo/rapo-admin';
import { AdminBadge, AdminSection, 관, 칩꼴 } from '@/components/rapo/rapo-admin-ui';

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

  /* 2026-11-19 — 새 관리자 디자인(흰 카드 · 권한 칩 · 기록 목록)으로 다시 입혔습니다 */
  if (탈 && !내) {
    return <p className={관.error}>{탈}</p>;
  }
  if (!내) return <p className={관.muted}>잠시만요…</p>;

  return (
    <div className="max-w-[1100px]">
      <RapoAdminHeader title="직원과 권한" />
      <p className={관.muted + ' -mt-[16px] mb-[24px] break-keep'}>
        {대표
          ? '대표입니다 — 직원을 넣고 권한을 주고 거둘 수 있어요.'
          : '직원입니다 — 보기만 됩니다. 넣고 거두는 것은 대표만 합니다.'}
      </p>

      {탈 && (
        <p className={관.error + ' mb-[16px]'}>{탈}</p>
      )}

      {대표 && (
        <section className={관.card + ' mb-[32px]'}>
          <h2 className={관.h3}>직원 넣기</h2>
          <p className={관.sub + ' mt-[4px]'}>
            회원번호로 넣습니다. 번호는 <b>회원</b> 화면에 있어요. 넣은 뒤 권한을 따로 줍니다.
          </p>
          <div className="mt-[16px] flex flex-wrap items-center gap-[8px]">
            <input
              value={새번호} onChange={(e) => set새번호(e.target.value)}
              inputMode="numeric" placeholder="회원번호" aria-label="회원번호"
              className={관.input + ' w-[9rem] flex-none'} />
            <input
              value={메모} onChange={(e) => set메모(e.target.value)}
              placeholder="메모 (안 써도 됩니다)" aria-label="메모"
              className={관.input + ' flex-1 basis-[200px]'} />
            <button
              type="button" onClick={넣기} disabled={도는중}
              className={관.btn + ' h-[44px]'}>
              넣기
            </button>
          </div>
        </section>
      )}

      <AdminSection title={`운영진 ${목록 ? 목록.length : 0}명`}>
        <div className="flex flex-col gap-[12px]">
          {(목록 ?? []).map((s) => (
            <article key={s.profile_id}
              className={관.card + (s.끈때 ? ' opacity-60' : '')}>
              <div className="flex flex-wrap items-center gap-[8px]">
                <AdminBadge tone={s.갈래 === '대표' ? 'coral' : 'neutral'}>{s.갈래}</AdminBadge>
                <b className={관.h3}>{s.닉네임}</b>
                <span className={관.sub}>회원번호 {s.회원번호} · 넣은날 {날(s.넣은때)}</span>
                {s.끈때 && <span className="text-[13px] font-bold text-[#b42a21]">뺐습니다 · {날(s.끈때)}</span>}
                {대표 && s.갈래 !== '대표' && !s.끈때 && (
                  <button
                    type="button" disabled={도는중}
                    onClick={() => 부르기('admin_직원빼기', { p_회원번호: s.회원번호, p_까닭: null })}
                    className={관.btnSm + ' ml-auto'}>
                    직원에서 빼기
                  </button>
                )}
              </div>

              {s.갈래 === '대표' ? (
                <p className={관.sub + ' mt-[12px]'}>대표는 열두 가지를 모두 할 수 있습니다.</p>
              ) : (
                <div className="mt-[16px] flex flex-wrap gap-[8px]">
                  {권한들.map((p) => {
                    const 가짐 = s.권한.includes(p.코드);
                    return (
                      <button
                        key={p.코드} type="button" title={p.설명} aria-pressed={가짐}
                        disabled={!대표 || 도는중 || !!s.끈때}
                        onClick={() => 부르기(가짐 ? 'admin_권한거두기' : 'admin_권한주기',
                          { p_회원번호: s.회원번호, p_코드: p.코드, p_까닭: null })}
                        className={칩꼴(가짐) + ' disabled:opacity-100' +
                          (대표 && !s.끈때 ? '' : ' cursor-default')}>
                        {가짐 ? '✓ ' : ''}{p.이름}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </AdminSection>

      <AdminSection title="준 기록" sub="지우지 않습니다. 누가 언제 무엇을 주고 거뒀는지 남습니다.">
        {기록들.length === 0
          ? <p className={관.cardTight + ' ' + 관.empty}>아직 없어요.</p>
          : (
            <ul className={관.list}>
              {기록들.map((r, i) => (
                <li key={i} className={관.row + ' ' + 관.body + ' py-[12px]'}>
                  <span className="text-[#555d6d]">{날(r.언제)}</span>{' · '}
                  <b>{r.누가 ?? '(모름)'}</b>
                  {r.준것인가 ? ' 가 ' : ' 가 '}
                  <b>{r.누구에게 ?? '(모름)'}</b>
                  {' 에게 '}{r.권한코드}{r.준것인가 ? ' 를 줬습니다' : ' 를 거뒀습니다'}
                  {r.까닭 ? ' — ' + r.까닭 : ''}
                </li>
              ))}
            </ul>
          )}
      </AdminSection>
    </div>
  );
}
