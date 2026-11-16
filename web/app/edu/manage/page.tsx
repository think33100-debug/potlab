'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth';
import { NoticeFiles } from '@/components/notice-files';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton, RapoChip } from '@/components/rapo/rapo-ui';

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

  /* 2026-11-16 세중님 테스터 점검 — 내 정보 메뉴 「교육 관리」가 옛 위쪽 줄(POTJOB 로고)에 「아직 준비 중이에요」만 보였습니다.
     새 틀(components/rapo/rapo-frame.tsx · 하단 탐색 「교육」 칸)로 옮겼습니다. 창구·권한·확인 창은 그대로입니다 */
  if (loading) {
    return <RapoPageFrame title="교육 관리" back="/me" nav="/edu/manage"><RapoWait /></RapoPageFrame>;
  }

  if (!관리.교육관리) {
    return (
      <RapoPageFrame title="교육 관리" back="/me">
        <p className={틀.소제목 + ' pt-(--rapo-dimension-x6)'}>아직 준비 중이에요</p>
        <Link href="/" className={틀.큰단추}>홈으로</Link>
      </RapoPageFrame>
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

  const 칸이름 = 'rapo-type-t4-bold block text-(color:--rapo-color-fg-neutral)';
  const 칸묶음 = 'flex flex-col gap-(--rapo-dimension-x2)';
  const 흰단추 = 틀.선단추 + ' bg-(--rapo-color-bg-layer-default)';

  return (
    <RapoPageFrame title="교육 관리" back="/me" nav="/edu/manage">
      <p className={틀.회색칸 + ' ' + 틀.작은글}>
        숨겨 둔 화면이에요 — 승인된 교육담당자와 마스터에게만 보입니다
      </p>
      <p className={틀.흐린글}>
        결제와 환불은 기관과 신청자 사이의 일이에요. RAPO 는 계좌 안내만 전달합니다.
      </p>

      {탈 && <p role="alert" className={틀.오류칸}>{탈}</p>}
      {알림 && <p role="status" className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-positive-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-positive-contrast)">{알림}</p>}

      <div>
        <RapoButton tone="deep-coral" size={40} onClick={() => { set과정열까((v) => !v); set탈(null); }}>
          {과정열까 ? '접기' : '과정 만들기'}
        </RapoButton>
      </div>

      {과정열까 && (
        <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x4)'}>
          <div className={칸묶음}>
            <label className={칸이름} htmlFor="과정제목">과정 이름</label>
            <input id="과정제목" value={새과정.제목}
              onChange={(e) => set새과정({ ...새과정, 제목: e.target.value })}
              placeholder="연하재활 기초 과정" className={틀.입력} />
          </div>

          <div className={칸묶음}>
            <p className={칸이름}>직군</p>
            <div className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
              {['작업치료사', '물리치료사'].map((g) => (
                <RapoChip key={g} on={새과정.직군 === g} onClick={() => set새과정({ ...새과정, 직군: g })} label={g} />
              ))}
            </div>
          </div>

          <div className={칸묶음}>
            <label className={칸이름} htmlFor="과정소개">소개</label>
            <textarea id="과정소개" rows={3} value={새과정.소개}
              onChange={(e) => set새과정({ ...새과정, 소개: e.target.value })} className={틀.긴입력} />
          </div>

          <div>
            <RapoButton tone="navy" size={40} onClick={과정만들기} disabled={도는중}>만들기</RapoButton>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={틀.소제목}>내 과정 <span className="whitespace-nowrap">{과정들?.length ?? 0}개</span></h2>

        {과정들 === null ? <RapoWait />
          : 과정들.length === 0
            ? <p className={틀.흐린글}>아직 만든 과정이 없어요.</p>
            : (
              <ul className="flex flex-col gap-(--rapo-dimension-x4)">
                {과정들.map((c) => (
                  <li key={c.과정id} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x3)'}>
                    <div className="flex flex-col gap-(--rapo-dimension-x1)">
                      <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                        <b className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{c.제목}</b>
                        <span className={틀.표}>{c.직군 ?? '직군 안 적힘'}</span>
                        {c.시험자료 && <span className={틀.표}>예시 자료</span>}
                        {c.숨김 && <span className={틀.작은글}>숨김</span>}
                      </p>
                      <p className={틀.작은글}>
                        {c.주최갈래 === '기관' ? c.주최이름 : `개인 강사 · ${c.주최이름 ?? ''}`}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
                      <button type="button"
                        onClick={() => { set회차열까(회차열까 === c.과정id ? null : c.과정id); set새회차(빈회차); }}
                        className={틀.선단추}>
                        {회차열까 === c.과정id ? '접기' : '회차 열기'}
                      </button>
                      <button type="button"
                        onClick={() => 부르기('교육과정고치기',
                          { p_과정: c.과정id, p_숨길까: !c.숨김 },
                          c.숨김 ? '다시 보이게 했어요.' : '숨겼어요.')}
                        className={틀.선단추}>
                        {c.숨김 ? '다시 보이게' : '숨기기'}
                      </button>
                    </div>

                    {회차열까 === c.과정id && (
                      <div className={틀.회색칸 + ' flex flex-col gap-(--rapo-dimension-x3)'}>
                        <div className="grid gap-(--rapo-dimension-x3) sm:grid-cols-2">
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
                            <div key={k} className={칸묶음}>
                              <label className={칸이름} htmlFor={`회차-${k}`}>{라벨}</label>
                              <input id={`회차-${k}`} type={꼴}
                                value={새회차[k]}
                                onChange={(e) => set새회차({ ...새회차, [k]: e.target.value })}
                                className={틀.입력} />
                            </div>
                          ))}
                        </div>
                        <p className={틀.작은글}>
                          접수 기간은 <b>최대 30일</b>이에요 (DB 가 막습니다).
                        </p>

                        <div className={칸묶음}>
                          <label className={칸이름} htmlFor="환불규정">환불 규정 (꼭 적어 주세요)</label>
                          <textarea id="환불규정" rows={3} value={새회차.환불규정}
                            onChange={(e) => set새회차({ ...새회차, 환불규정: e.target.value })}
                            placeholder={'시작 7일 전까지 전액 환불\n3일 전까지 50%\n그 뒤에는 환불이 안 됩니다'}
                            className={틀.긴입력} />
                        </div>

                        <div>
                          <RapoButton tone="navy" size={40} onClick={() => 회차열기(c.과정id)} disabled={도는중}>회차 열기</RapoButton>
                        </div>
                      </div>
                    )}

                    {c.회차.length > 0 && (
                      <ul className="flex flex-col gap-(--rapo-dimension-x2)">
                        {c.회차.map((s) => (
                          <li key={s.회차id} className={틀.회색칸 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
                            <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                              <b className="rapo-type-t5-bold whitespace-nowrap text-(color:--rapo-color-fg-neutral)">{날(s.시작)}</b>
                              <span className="rapo-type-t2-medium inline-flex items-center whitespace-nowrap rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-neutral)">{s.상태}</span>
                              <span className={틀.흐린글}>
                                <span className="whitespace-nowrap">확정 <b className="num">{s.확정수}</b>/{s.정원}명</span>
                                {' · '}<span className="whitespace-nowrap">신청 <b className="num">{s.신청수}</b>명</span>
                                {' · '}<span className="whitespace-nowrap">{돈(s.수강료)}</span>
                              </span>
                              {s.입금눌렀는데대기 > 0 && (
                                <span className="rapo-type-t2-bold inline-flex items-center whitespace-nowrap rounded-(--rapo-radius-full) bg-(--rapo-color-bg-warning-solid) px-(--rapo-dimension-x3) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-on-warning-solid)">
                                  입금했다는 분 {s.입금눌렀는데대기}명
                                </span>
                              )}
                            </p>
                            <p className={틀.작은글}>
                              접수 <span className="whitespace-nowrap">{날(s.접수시작)} ~ {날(s.접수끝)}</span> · {s.장소 ?? '장소 안 적힘'}
                              {s.후기수 > 0 && ` · 후기 ${s.후기수}개`}
                            </p>
                            <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
                              <button type="button"
                                onClick={() => set신청본다(신청본다 === s.회차id ? null : s.회차id)}
                                className={흰단추}>
                                {신청본다 === s.회차id ? '신청자 접기' : '신청자 보기'}
                              </button>
                              <Link href={`/edu/session/${s.회차id}`} className={흰단추}>회원 화면으로</Link>
                              {s.상태 !== '끝남' && (
                                <button type="button"
                                  onClick={() => { if (confirm('모집을 끝냅니다. 확정이 안 된 분은 「미선정」이 되고 알림이 갑니다. 할까요?')) 부르기('교육모집끝내기', { p_회차: s.회차id }, '모집을 끝냈어요.'); }}
                                  className="rapo-type-t4-bold inline-flex h-(--rapo-dimension-x10) items-center justify-center whitespace-nowrap rounded-(--rapo-radius-r2) px-(--rapo-dimension-x4)
                                             border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-critical-solid) bg-(--rapo-color-bg-layer-default) text-(color:--rapo-color-fg-critical)
                                             active:bg-(--rapo-color-bg-transparent-pressed)">
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
                                className={흰단추}>
                                재공고
                              </button>
                            </div>

                            {/* 첨부 — 안내문·시간표를 답니다. 회원만 받습니다 */}
                            <NoticeFiles 갈래="교육" 회차={s.회차id} 고칠수있나 />

                            {신청본다 === s.회차id && (
                              신청들?.회차 !== s.회차id
                                ? <RapoWait />
                                : 신청들.줄.length === 0
                                ? <p className={틀.흐린글}>아직 신청자가 없어요.</p>
                                : (
                                  <ul className="flex flex-col gap-(--rapo-dimension-x2)">
                                    {신청들.줄.map((a) => (
                                      <li key={a.신청id}
                                        className="flex flex-wrap items-center gap-(--rapo-dimension-x2) rounded-(--rapo-radius-r2) bg-(--rapo-color-bg-layer-default) p-(--rapo-dimension-x3)">
                                        <b className="rapo-type-t4-bold text-(color:--rapo-color-fg-neutral)">{a.nickname}</b>
                                        <span className={틀.흐린글}>{a.상태}</span>
                                        {a.입금눌렀나 && <span className={틀.표}>입금했다고 함</span>}
                                        {/* 2026-11-15 피그마 「신청자 상태 관리」 — 신청·입금·수강 상태를 신청자별로 바꿉니다.
                                            「수강 완료」로 바꾸면 그 사람이 이 회차 후기를 쓸 수 있어요 (DB 교육신청상태바꾸기 · 금고 SQL_1113/ZQ) */}
                                        <label className="ml-auto flex items-center gap-(--rapo-dimension-x2)">
                                          <span className="sr-only">{a.nickname} 상태</span>
                                          <select value={a.상태} disabled={도는중}
                                            onChange={(e) => 부르기('교육신청상태바꾸기', { p_신청: a.신청id, p_상태: e.target.value }, '상태를 바꿨어요.')}
                                            className="rapo-type-t4-regular h-(--rapo-dimension-x10) rounded-(--rapo-radius-r2) border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-neutral-weak) bg-(--rapo-color-bg-layer-default) px-(--rapo-dimension-x3) text-(color:--rapo-color-fg-neutral)">
                                            {[['신청함', '신청 접수'], ['입금대기', '입금 확인 중'], ['참여확정', '참여 확정'], ['수강완료', '수강 완료'], ['미선정', '미선정']].map(([v, 글]) => (
                                              <option key={v} value={v}>{글}</option>
                                            ))}
                                          </select>
                                        </label>
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
      </section>

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <div className="flex flex-col gap-(--rapo-dimension-x1)">
          <h2 className={틀.소제목}>후기 <span className="whitespace-nowrap">{후기들.length}개</span></h2>
          <p className={틀.흐린글}>후기는 지울 수 없어요. <b>답글만</b> 달 수 있습니다.</p>
        </div>

        {후기들.length === 0
          ? <p className={틀.흐린글}>아직 후기가 없어요.</p>
          : (
            <ul className="flex flex-col gap-(--rapo-dimension-x3)">
              {후기들.map((r) => (
                <li key={r.리뷰id} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
                  <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                    <b className="rapo-type-t4-bold whitespace-nowrap text-(color:--rapo-color-fg-brand-contrast)">{'★'.repeat(r.별점)}</b>
                    <span className={틀.글}>{r.닉네임}</span>
                    <span className={틀.작은글}>{r.제목}</span>
                  </p>
                  <p className={틀.글 + ' whitespace-pre-line'}>{r.글}</p>
                  {r.답글 ? (
                    <div className={틀.회색칸 + ' flex flex-col gap-(--rapo-dimension-x1)'}>
                      <p className={틀.작은글}>내 답글</p>
                      <p className={틀.글 + ' whitespace-pre-line'}>{r.답글}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-(--rapo-dimension-x2)">
                      <textarea rows={2} value={답글칸[r.리뷰id] ?? ''} aria-label="답글"
                        onChange={(e) => set답글칸({ ...답글칸, [r.리뷰id]: e.target.value })}
                        placeholder="답글을 적어 주세요" className={틀.긴입력} />
                      <div>
                        <RapoButton tone="navy" size={40} disabled={도는중 || !(답글칸[r.리뷰id] ?? '').trim()}
                          onClick={() => 부르기('교육리뷰답글쓰기',
                            { p_리뷰: r.리뷰id, p_글: (답글칸[r.리뷰id] ?? '').trim() }, '답글을 달았어요.')}>
                          답글 달기
                        </RapoButton>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </RapoPageFrame>
  );
}
