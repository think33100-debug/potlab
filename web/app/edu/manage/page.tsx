'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { NoticeFiles } from '@/components/notice-files';
import { browserSupabase } from '@/lib/supabase-browser';

/* 교육 관리 — 담당자가 과정·회차를 만들고 신청자를 보는 곳 (2026-10-09 · 뼈대 ⑥).
 *
 * ── 누가 보나 ────────────────────────────────────────────────
 * 승인된 교육담당자(기관·개인)와 마스터. 링크는 탑바·아래 탭바·/me 에
 * 「교육 관리」로 붙고, 값은 내관리메뉴() 창구가 줍니다.
 * **막는 자리는 DB 입니다** — 교육담당자인가() 한 함수가 창구 열한 개를 지킵니다.
 *
 * ── 마스터는 시험 과정만 ─────────────────────────────────────
 * 교육담당자인가() 의 마스터 예외는 `시험자료` 과정에만 걸립니다.
 * 진짜 기관 과정은 그 기관 담당자만 만집니다.
 *
 * ── 결제는 POTJOB 이 받지 않습니다 ───────────────────────────
 * 계좌와 환불 규정을 **담당자가 적고** 우리는 전달만 합니다.
 * 그래서 환불 규정이 비면 창구가 거절합니다 (교육회차열기).
 */

type 회차 = {
  회차id: number; 시작: string; 끝: string | null; 장소: string | null;
  정원: number; 상태: string; 접수시작: string; 접수끝: string;
  수강료: number | null; 시험자료: boolean;
  확정수: number; 신청수: number; 입금눌렀는데대기: number; 후기수: number;
};
type 과정 = {
  과정id: number; 제목: string; 직군: string | null; 주최갈래: string;
  주최이름: string | null; 숨김: boolean; 시험자료: boolean; 회차: 회차[];
};
type 신청 = {
  신청id: number; nickname: string; 상태: string;
  입금눌렀나: boolean; 입금누른때: string | null; 신청때: string;
};
type 후기 = {
  리뷰id: number; 회차id: number; 제목: string; 닉네임: string;
  별점: number; 글: string; 쓴때: string; 답글: string | null;
};

const 날 = (s: string | null) => (!s ? '' : s.slice(5).replace('-', '월 ') + '일');
const 돈 = (n: number | null) => (n == null ? '안 적힘' : n.toLocaleString('ko-KR') + '원');

/* 새 과정·새 회차 칸의 처음 값 */
const 빈과정 = { 제목: '', 직군: '작업치료사', 소개: '' };
const 빈회차 = {
  시작: '', 끝: '', 장소: '', 정원: '20',
  접수시작: '', 접수끝: '', 수강료: '',
  은행: '', 계좌번호: '', 예금주: '', 입금기한: '', 입금자명규칙: '이름 그대로',
  환불규정: '', 결제링크: '',
};

export default function EduManage() {
  const { loading, session, 관리 } = useAuth();
  const [과정들, set과정들] = useState<과정[] | null>(null);
  const [후기들, set후기들] = useState<후기[]>([]);
  const [탈, set탈] = useState<string | null>(null);
  const [알림, set알림] = useState<string | null>(null);
  const [다시, set다시] = useState(0);

  const [과정열까, set과정열까] = useState(false);
  const [새과정, set새과정] = useState(빈과정);
  /* 회차 칸을 어느 과정 아래에 펼칠지 */
  const [회차열까, set회차열까] = useState<number | null>(null);
  const [새회차, set새회차] = useState(빈회차);
  /* 신청자 목록을 펼친 회차 */
  const [신청본다, set신청본다] = useState<number | null>(null);
  /* 어느 회차 것인지 함께 들고 있습니다. 효과 안에서 비우면
     「효과 본문에서 setState」 로 lint 가 막고, 다른 회차를 열 때 옛 목록이
     한 번 번쩍입니다. 회차 번호를 같이 두면 번쩍임도 없고 비울 일도 없습니다 */
  const [신청들, set신청들] = useState<{ 회차: number; 줄: 신청[] } | null>(null);
  const [답글칸, set답글칸] = useState<Record<number, string>>({});
  const [도는중, set도는중] = useState(false);

  useEffect(() => {
    if (!session || !관리.교육관리) return;
    let 살아있나 = true;
    const sb = browserSupabase();
    Promise.all([sb.rpc('내교육과정'), sb.rpc('내교육후기')]).then(([a, b]) => {
      if (!살아있나) return;
      if (a.error) { set탈(a.error.message); set과정들([]); return; }
      set과정들((a.data ?? []) as 과정[]);
      if (!b.error) set후기들((b.data ?? []) as 후기[]);
    });
    return () => { 살아있나 = false; };
  }, [session, 관리.교육관리, 다시]);

  useEffect(() => {
    if (신청본다 == null) return;
    const 회차 = 신청본다;
    let 살아있나 = true;
    browserSupabase().rpc('교육신청목록', { p_회차: 회차 }).then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      set신청들({ 회차, 줄: (data ?? []) as 신청[] });
    });
    return () => { 살아있나 = false; };
  }, [신청본다, 다시]);

  const 부르기 = useCallback(async (fn: string, 인수: Record<string, unknown>, 말: string) => {
    set도는중(true); set탈(null); set알림(null);
    const { error } = await browserSupabase().rpc(fn, 인수);
    set도는중(false);
    if (error) { set탈(error.message); return false; }
    set알림(말); set다시((n) => n + 1);
    return true;
  }, []);

  if (loading) {
    return <main className="mx-auto w-full max-w-3xl px-6 py-8"><p className="text-lg text-mute">잠시만요…</p></main>;
  }

  if (!관리.교육관리) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8 md:px-7">
        <p className="break-keep text-h3 font-bold">아직 준비 중이에요</p>
        <Link href="/" className="mt-7 inline-block rounded-md border border-gray-200 px-6 py-4
                                  text-lg font-medium text-gray-600 hover:bg-gray-50">홈으로</Link>
      </main>
    );
  }

  const 과정만들기 = async () => {
    /* 기관 담당자는 자기 기관 이름으로, 개인 강사는 기관 없이 만듭니다.
       어느 쪽인지는 **창구가 회원자격을 보고** 정합니다 — 화면이 고르지 않습니다.
       이미 만든 과정이 있으면 그 주최 이름을 그대로 씁니다 */
    const 기관 = 과정들?.find((c) => c.주최갈래 === '기관')?.주최이름 ?? null;
    const ok = await 부르기('교육과정만들기', {
      p_제목: 새과정.제목, p_직군: 새과정.직군,
      p_소개: 새과정.소개 || null, p_교육기관: 기관,
    }, '과정을 만들었어요.');
    if (ok) { set과정열까(false); set새과정(빈과정); }
  };

  const 회차열기 = async (과정id: number) => {
    const ok = await 부르기('교육회차열기', {
      p_과정: 과정id,
      p_시작: 새회차.시작 || null, p_끝: 새회차.끝 || 새회차.시작 || null,
      p_장소: 새회차.장소 || null, p_정원: Number(새회차.정원 || 0),
      p_접수시작: 새회차.접수시작 || null, p_접수끝: 새회차.접수끝 || null,
      p_수강료: 새회차.수강료 ? Number(새회차.수강료) : null,
      p_은행: 새회차.은행 || null, p_계좌번호: 새회차.계좌번호 || null,
      p_예금주: 새회차.예금주 || null,
      p_입금기한: 새회차.입금기한 || null,
      p_입금자명규칙: 새회차.입금자명규칙 || null,
      p_환불규정: 새회차.환불규정, p_결제링크: 새회차.결제링크 || null,
    }, '회차를 열었어요.');
    if (ok) { set회차열까(null); set새회차(빈회차); }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 pb-[88px] md:px-7 md:pb-8">
      <p className="rounded-sm bg-badge-teal-bg px-4 py-2 text-sm text-teal-strong">
        숨겨 둔 화면이에요 — 승인된 교육담당자와 마스터에게만 보입니다
      </p>
      <h1 className="mt-5 break-keep text-h1 font-bold">교육 관리</h1>
      <p className="mt-2 break-keep text-lg text-mute">
        결제와 환불은 기관과 신청자 사이의 일이에요. POTJOB 은 계좌 안내만 전달합니다.
      </p>

      {탈 && <p className="mt-4 rounded-sm border border-brand-red p-4 text-lg text-brand-red-dark">{탈}</p>}
      {알림 && <p className="mt-4 rounded-sm border border-teal-strong p-4 text-lg text-teal-strong">{알림}</p>}

      <div className="mt-6">
        <button type="button" onClick={() => { set과정열까((v) => !v); set탈(null); }}
          className="rounded-md bg-brand-red px-6 py-4 text-btn font-bold text-white hover:bg-brand-red-dark">
          {과정열까 ? '접기' : '과정 만들기'}
        </button>
      </div>

      {과정열까 && (
        <section className="mt-5 rounded-sm border border-gray-200 p-5">
          <label className="block text-sm font-bold text-mute" htmlFor="과정제목">과정 이름</label>
          <input id="과정제목" value={새과정.제목}
            onChange={(e) => set새과정({ ...새과정, 제목: e.target.value })}
            placeholder="연하재활 기초 과정"
            className="mt-1 w-full rounded-sm border border-gray-200 px-5 py-4 text-lg" />

          <p className="mt-4 text-sm font-bold text-mute">직군</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {['작업치료사', '물리치료사'].map((g) => (
              <button key={g} type="button" onClick={() => set새과정({ ...새과정, 직군: g })}
                className={'rounded-md px-5 py-3 text-lg ' +
                  (새과정.직군 === g ? 'bg-[#14181C] text-white' : 'border border-gray-200 text-gray-600')}>
                {g}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-sm font-bold text-mute" htmlFor="과정소개">소개</label>
          <textarea id="과정소개" rows={3} value={새과정.소개}
            onChange={(e) => set새과정({ ...새과정, 소개: e.target.value })}
            className="mt-1 w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />

          <button type="button" onClick={과정만들기} disabled={도는중}
            className="mt-5 rounded-md bg-brand-red px-6 py-4 text-btn font-bold text-white
                       hover:bg-brand-red-dark disabled:opacity-50">
            만들기
          </button>
        </section>
      )}

      <h2 className="mt-9 text-h3 font-bold">내 과정 {과정들?.length ?? 0}개</h2>

      {과정들 === null ? <p className="mt-4 text-lg text-mute">잠시만요…</p>
        : 과정들.length === 0
          ? <p className="mt-4 break-keep text-lg text-mute">아직 만든 과정이 없어요.</p>
          : (
            <ul className="mt-4 space-y-5">
              {과정들.map((c) => (
                <li key={c.과정id} className="rounded-sm border border-gray-200 p-5">
                  <p className="flex flex-wrap items-center gap-2">
                    <b className="break-keep text-lg">{c.제목}</b>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[13px] dark:bg-gray-800">
                      {c.직군 ?? '직군 안 적힘'}
                    </span>
                    {c.시험자료 && (
                      <span className="rounded-full bg-badge-teal-bg px-3 py-1 text-[13px] text-teal-strong">
                        예시 자료
                      </span>
                    )}
                    {c.숨김 && <span className="text-sm text-mute">숨김</span>}
                  </p>
                  <p className="mt-1 text-sm text-mute">
                    {c.주최갈래 === '기관' ? c.주최이름 : `개인 강사 · ${c.주최이름 ?? ''}`}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button"
                      onClick={() => { set회차열까(회차열까 === c.과정id ? null : c.과정id); set새회차(빈회차); }}
                      className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                      {회차열까 === c.과정id ? '접기' : '회차 열기'}
                    </button>
                    <button type="button"
                      onClick={() => 부르기('교육과정고치기',
                        { p_과정: c.과정id, p_숨길까: !c.숨김 },
                        c.숨김 ? '다시 보이게 했어요.' : '숨겼어요.')}
                      className="rounded-md border border-gray-200 px-5 py-2 text-lg text-gray-600 hover:bg-gray-50">
                      {c.숨김 ? '다시 보이게' : '숨기기'}
                    </button>
                  </div>

                  {회차열까 === c.과정id && (
                    <div className="mt-4 rounded-sm border border-gray-200 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ['시작', '교육 시작', 'date'], ['끝', '교육 끝', 'date'],
                          ['접수시작', '접수 시작', 'date'], ['접수끝', '접수 마감', 'date'],
                          ['장소', '장소', 'text'], ['정원', '정원', 'number'],
                          ['수강료', '수강료(원)', 'number'],
                          ['은행', '은행', 'text'], ['계좌번호', '계좌번호', 'text'],
                          ['예금주', '예금주', 'text'], ['입금기한', '입금 기한', 'date'],
                          ['입금자명규칙', '입금자명 규칙', 'text'],
                          ['결제링크', '기관 결제 링크(없으면 비움)', 'text'],
                        ] as const).map(([k, 라벨, 꼴]) => (
                          <div key={k}>
                            <label className="block text-sm font-bold text-mute" htmlFor={`회차-${k}`}>
                              {라벨}
                            </label>
                            <input id={`회차-${k}`} type={꼴}
                              value={새회차[k]}
                              onChange={(e) => set새회차({ ...새회차, [k]: e.target.value })}
                              className="mt-1 w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 break-keep text-sm text-mute">
                        접수 기간은 <b>최대 30일</b>이에요 (DB 가 막습니다).
                      </p>

                      <label className="mt-4 block text-sm font-bold text-mute" htmlFor="환불규정">
                        환불 규정 (꼭 적어 주세요)
                      </label>
                      <textarea id="환불규정" rows={3} value={새회차.환불규정}
                        onChange={(e) => set새회차({ ...새회차, 환불규정: e.target.value })}
                        placeholder={'시작 7일 전까지 전액 환불\n3일 전까지 50%\n그 뒤에는 환불이 안 됩니다'}
                        className="mt-1 w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />

                      <button type="button" onClick={() => 회차열기(c.과정id)} disabled={도는중}
                        className="mt-4 rounded-md bg-brand-red px-6 py-3 text-lg font-bold text-white
                                   hover:bg-brand-red-dark disabled:opacity-50">
                        회차 열기
                      </button>
                    </div>
                  )}

                  {c.회차.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {c.회차.map((s) => (
                        <li key={s.회차id} className="rounded-sm bg-gray-50 p-4 dark:bg-gray-900">
                          <p className="flex flex-wrap items-center gap-2">
                            <b className="text-lg">{날(s.시작)}</b>
                            <span className="rounded-full bg-white px-3 py-1 text-[13px] dark:bg-gray-800">
                              {s.상태}
                            </span>
                            <span className="text-lg text-mute">
                              확정 <b className="num">{s.확정수}</b>/{s.정원}명 · 신청{' '}
                              <b className="num">{s.신청수}</b>명 · {돈(s.수강료)}
                            </span>
                            {s.입금눌렀는데대기 > 0 && (
                              <span className="rounded-full bg-warning px-3 py-1 text-[13px] text-white">
                                입금했다는 분 {s.입금눌렀는데대기}명
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-mute">
                            접수 {날(s.접수시작)} ~ {날(s.접수끝)} · {s.장소 ?? '장소 안 적힘'}
                            {s.후기수 > 0 && ` · 후기 ${s.후기수}개`}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button"
                              onClick={() => set신청본다(신청본다 === s.회차id ? null : s.회차id)}
                              className="rounded-md border border-gray-200 bg-white px-5 py-2 text-lg text-gray-600 hover:bg-gray-50 dark:bg-gray-800">
                              {신청본다 === s.회차id ? '신청자 접기' : '신청자 보기'}
                            </button>
                            <Link href={`/edu/session/${s.회차id}`}
                              className="rounded-md border border-gray-200 bg-white px-5 py-2 text-lg text-gray-600 hover:bg-gray-50 dark:bg-gray-800">
                              회원 화면으로
                            </Link>
                            {s.상태 !== '끝남' && (
                              <button type="button"
                                onClick={() => { if (confirm('모집을 끝냅니다. 확정이 안 된 분은 「미선정」이 되고 알림이 갑니다. 할까요?')) 부르기('교육모집끝내기', { p_회차: s.회차id }, '모집을 끝냈어요.'); }}
                                className="rounded-md border border-brand-red bg-white px-5 py-2 text-lg text-brand-red-dark hover:bg-gray-50 dark:bg-gray-800">
                                모집 끝내기
                              </button>
                            )}
                            <button type="button"
                              onClick={() => {
                                const 시작 = prompt('새 회차의 교육 시작일 (2026-11-20 꼴)');
                                if (!시작) return;
                                const 접수시작 = prompt('접수 시작일', 시작) || 시작;
                                const 접수끝 = prompt('접수 마감일', 시작) || 시작;
                                부르기('교육재공고', {
                                  p_회차: s.회차id, p_시작: 시작, p_끝: 시작,
                                  p_접수시작: 접수시작, p_접수끝: 접수끝,
                                }, '같은 조건으로 새 회차를 열었어요.');
                              }}
                              className="rounded-md border border-gray-200 bg-white px-5 py-2 text-lg text-gray-600 hover:bg-gray-50 dark:bg-gray-800">
                              재공고
                            </button>
                          </div>

                          {/* 첨부 — 안내문·시간표를 답니다. 회원만 받습니다 */}
                          <NoticeFiles 갈래="교육" 회차={s.회차id} 고칠수있나 />

                          {신청본다 === s.회차id && (
                            신청들?.회차 !== s.회차id
                              ? <p className="mt-3 text-lg text-mute">잠시만요…</p>
                              : 신청들.줄.length === 0
                              ? <p className="mt-3 text-lg text-mute">아직 신청자가 없어요.</p>
                              : (
                                <ul className="mt-3 space-y-2">
                                  {신청들.줄.map((a) => (
                                    <li key={a.신청id}
                                      className="flex flex-wrap items-center gap-2 rounded-sm bg-white p-3 dark:bg-gray-800">
                                      <b className="text-lg">{a.nickname}</b>
                                      <span className="text-lg text-mute">{a.상태}</span>
                                      {a.입금눌렀나 && (
                                        <span className="rounded-full bg-badge-teal-bg px-3 py-1 text-[13px] text-teal-strong">
                                          입금했다고 함
                                        </span>
                                      )}
                                      {a.상태 !== '참여확정' && (
                                        <button type="button"
                                          onClick={() => 부르기('교육참여확정', { p_신청: a.신청id }, '참여를 확정했어요.')}
                                          className="ml-auto rounded-md bg-brand-red px-5 py-2 text-lg font-bold text-white hover:bg-brand-red-dark">
                                          참여 확정
                                        </button>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

      <h2 className="mt-9 text-h3 font-bold">후기 {후기들.length}개</h2>
      <p className="mt-1 break-keep text-lg text-mute">
        후기는 지울 수 없어요. <b>답글만</b> 달 수 있습니다.
      </p>

      {후기들.length === 0
        ? <p className="mt-4 break-keep text-lg text-mute">아직 후기가 없어요.</p>
        : (
          <ul className="mt-4 space-y-3">
            {후기들.map((r) => (
              <li key={r.리뷰id} className="rounded-sm border border-gray-200 p-5">
                <p className="flex flex-wrap items-center gap-2">
                  <b className="text-lg">{'★'.repeat(r.별점)}</b>
                  <span className="text-lg">{r.닉네임}</span>
                  <span className="text-sm text-mute">{r.제목}</span>
                </p>
                <p className="mt-2 whitespace-pre-line break-keep text-lg">{r.글}</p>
                {r.답글 ? (
                  <div className="mt-3 rounded-sm bg-gray-50 p-4 dark:bg-gray-900">
                    <p className="text-sm text-mute">내 답글</p>
                    <p className="mt-1 whitespace-pre-line break-keep text-lg">{r.답글}</p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <textarea rows={2} value={답글칸[r.리뷰id] ?? ''}
                      onChange={(e) => set답글칸({ ...답글칸, [r.리뷰id]: e.target.value })}
                      placeholder="답글을 적어 주세요"
                      className="w-full rounded-sm border border-gray-200 px-5 py-3 text-lg" />
                    <button type="button" disabled={도는중 || !(답글칸[r.리뷰id] ?? '').trim()}
                      onClick={() => 부르기('교육리뷰답글쓰기',
                        { p_리뷰: r.리뷰id, p_글: (답글칸[r.리뷰id] ?? '').trim() }, '답글을 달았어요.')}
                      className="mt-2 rounded-md bg-brand-red px-6 py-3 text-lg font-bold text-white
                                 hover:bg-brand-red-dark disabled:opacity-50">
                      답글 달기
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </main>
  );
}
