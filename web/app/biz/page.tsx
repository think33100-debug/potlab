'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { NoticeFiles } from '@/components/notice-files';
import { browserSupabase } from '@/lib/supabase-browser';
import { RapoPageFrame, RapoWait, 틀 } from '@/components/rapo/rapo-frame';
import { RapoButton, RapoChip } from '@/components/rapo/rapo-ui';

/* 채용 담당자 화면 (2026-10-09 · 뼈대 ⑧ · 공고 쓰기는 10-09 밤에 보탰습니다).
 *
 * ── 아직 숨겨 둡니다 ─────────────────────────────────────────
 * 승인된 담당자가 없으면 아무것도 안 보입니다. 관리자·마스터는 늘 봅니다.
 *
 * ── 담당자가 고칠 수 있는 것은 **자기가 올린 공고(BIZ)뿐**입니다 ──
 * 우리가 모아 온 공고는 보기와 「공식 확인」 도장까지만 됩니다.
 * 수집한 공고를 담당자가 고치게 하면, 우리가 긁어 온 값과 어긋났을 때
 * 어느 쪽이 맞는지 가릴 수 없게 됩니다. 그래서 창구(담당자공고고치기)가
 * source <> 'BIZ' 를 거절합니다 — 화면이 단추를 숨기는 것만으로는 안 막힙니다.
 *
 * ── 마스터 페르소나로 쓴 공고 ────────────────────────────────
 * 기관번호를 무엇으로 보내도 **시험병원(TEST:마스터시험병원)** 에 붙고
 * 시험자료 = true 가 됩니다. 회원 /jobs 에는 안 나옵니다 — 가리는 자리는
 * job_posts_pub 한 곳입니다 (회원용 길 일곱이 그 보기를 지납니다).
 */

type 병원 = { 기관번호: string; 이름: string };
type 공고 = {
  id: string; 제목: string; 직군: string | null; 고용형태: string | null;
  apply_from: string | null; apply_to: string | null;
  hidden: boolean; hold: boolean; 조회수: number; 지원누름: number;
  공식확인: boolean; source: string | null;
};

/* ★ 2026-10-09 세중님 확정 — 공고 상세가 그리는 **일곱 칸**과 같은 칸만 받습니다.
     모집인원 · 접수마감 · 근무지 · 지원자격 · 예상 연봉 ·
     얼마나 바쁜 곳(심평원) · 병원 뜯어보기(심평원)
   뒤의 둘은 우리가 심평원 자료로 그리므로 담당자가 적을 것이 없습니다.
   전형방법 · 우대사항 · 결격사유 · 문의처 · 제출서류는 **받지 않습니다** —
   상세에 안 그리니 받아 두면 아무 데도 안 쓰이는 칸이 됩니다.
   그 내용은 공고문 첨부와 「지원 안내 주소」로 갑니다. */
type 쓸것 = {
  제목: string; 직군: string; 고용형태: string; 근무지: string;
  인원: string; 접수부터: string; 접수까지: string; 마감시각: string;
  주소: string; 지원자격: string; 예상연봉: string;
};

const 빈것: 쓸것 = {
  제목: '', 직군: '작업치료사', 고용형태: '', 근무지: '', 인원: '',
  접수부터: '', 접수까지: '', 마감시각: '', 주소: '', 지원자격: '', 예상연봉: '',
};

export default function Biz() {
  const { loading, session, isAdmin, 관리 } = useAuth();
  const [병원들, set병원들] = useState<병원[]>([]);
  const [고른곳, set고른곳] = useState<string | null>(null);
  const [공고들, set공고들] = useState<공고[]>([]);
  const [탈, set탈] = useState<string | null>(null);
  const [알림, set알림] = useState<string | null>(null);
  const [다시, set다시] = useState(0);
  /* null 이면 쓰기 칸이 닫힘 · '새것' 이면 새 공고 · 그 밖은 고칠 공고 번호 */
  const [여는것, set여는것] = useState<string | null>(null);
  const [값, set값] = useState<쓸것>(빈것);
  const [도는중, set도는중] = useState(false);

  useEffect(() => {
    if (!session || !관리.채용관리) return;
    let 살아있나 = true;
    browserSupabase().rpc('내병원').then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      const xs = (data ?? []) as 병원[];
      set병원들(xs);
      set고른곳((p) => p ?? xs[0]?.기관번호 ?? null);
    });
    return () => { 살아있나 = false; };
  }, [session, 관리.채용관리]);

  useEffect(() => {
    if (!고른곳) return;
    let 살아있나 = true;
    browserSupabase().rpc('내병원공고', { p_기관번호: 고른곳 }).then(({ data, error }) => {
      if (!살아있나) return;
      if (error) { set탈(error.message); return; }
      set공고들((data ?? []) as 공고[]);
    });
    return () => { 살아있나 = false; };
  }, [고른곳, 다시]);

  const 도장 = useCallback(async (j: 공고) => {
    const { error } = await browserSupabase()
      .rpc('공식확인하기', { p_공고: j.id, p_맞나: !j.공식확인 });
    if (error) { set탈(error.message); return; }
    set다시((n) => n + 1);
  }, []);

  const 보내기 = useCallback(async () => {
    if (!고른곳) return;
    set도는중(true); set탈(null); set알림(null);
    const sb = browserSupabase();
    /* 화면 칸 이름 ↔ DB detail 칸 이름을 여기서 맞춥니다.
       상세 화면은 뽑은값 → detail 순으로 읽습니다 (jobs/[id]/page.tsx).
       「연봉」은 수집 출처가 쓰는 이름이라 그대로 씁니다 */
    const 상세 = {
      ...(값.지원자격.trim() ? { 지원자격: 값.지원자격.trim() } : {}),
      ...(값.예상연봉.trim() ? { 연봉: 값.예상연봉.trim() } : {}),
    };
    const 공통 = {
      p_제목: 값.제목, p_직군: 값.직군,
      p_고용형태: 값.고용형태 || null, p_근무지: 값.근무지 || null,
      p_인원: 값.인원 ? Number(값.인원) : null,
      p_접수부터: 값.접수부터 || null, p_접수까지: 값.접수까지 || null,
      p_마감시각: 값.마감시각 || null,
      p_주소: 값.주소, p_상세: 상세,
    };
    const { error } = 여는것 === '새것'
      ? await sb.rpc('담당자공고쓰기', { p_기관번호: 고른곳, ...공통 })
      : await sb.rpc('담당자공고고치기', { p_공고: 여는것, ...공통 });
    set도는중(false);
    if (error) { set탈(error.message); return; }
    set알림(여는것 === '새것' ? '올렸어요.' : '고쳤어요.');
    set여는것(null); set값(빈것); set다시((n) => n + 1);
  }, [고른곳, 값, 여는것]);

  const 마감 = useCallback(async (id: string, 내릴까: boolean) => {
    if (!confirm(내릴까
      ? '공고를 내립니다. 회원 화면에서 사라져요. 할까요?'
      : '지금으로 접수를 끊습니다. 할까요?')) return;
    const { error } = await browserSupabase()
      .rpc('담당자공고마감', { p_공고: id, p_내릴까: 내릴까 });
    if (error) { set탈(error.message); return; }
    set알림(내릴까 ? '내렸어요.' : '접수를 끊었어요.');
    set다시((n) => n + 1);
  }, []);

  const 고치러 = (j: 공고) => {
    set여는것(j.id);
    set값({
      ...빈것,
      제목: j.제목, 직군: j.직군 ?? '작업치료사',
      고용형태: j.고용형태 ?? '',
      접수부터: j.apply_from ?? '', 접수까지: j.apply_to ?? '',
    });
    set알림(null); set탈(null);
  };

  /* 2026-11-16 세중님 테스터 점검 — 내 정보 메뉴 「채용 관리」가 옛 위쪽 줄(POTJOB 로고)이었습니다.
     새 틀(components/rapo/rapo-frame.tsx · 하단 탐색 「채용」 칸)로 옮겼습니다. 창구·권한·확인 창은 그대로입니다 */
  if (loading) return <RapoPageFrame title="채용 관리" back="/me" nav="/biz"><RapoWait /></RapoPageFrame>;

  /* ★ 2026-10-09 밤 — **채용담당자로 승인된 분에게만** 열립니다.
     교육담당자 페르소나로 주소를 쳐도 여기서 막힙니다.
     값은 /edu/manage 와 **같은 창구**(내관리메뉴)를 봅니다 — 두 화면이
     서로 다른 기준을 쓰면 한쪽만 보이는 일이 생깁니다 */
  if (!관리.채용관리) {
    return (
      <RapoPageFrame title="채용 관리" back="/me">
        <p className={틀.소제목 + ' pt-(--rapo-dimension-x6)'}>아직 준비 중이에요</p>
        <Link href="/" className={틀.큰단추}>홈으로</Link>
      </RapoPageFrame>
    );
  }

  if (병원들.length === 0) {
    return (
      <RapoPageFrame title="채용 관리" back="/me" nav="/biz">
        <p className={틀.흐린글 + ' pt-(--rapo-dimension-x6)'}>
          승인된 병원이 아직 없어요.
          {isAdmin && ' 담당자 신청을 승인하면 여기 나옵니다.'}
        </p>
        <Link href={isAdmin ? '/admin/partners' : '/'} className={틀.큰단추}>
          {isAdmin ? '담당자 승인으로' : '홈으로'}
        </Link>
      </RapoPageFrame>
    );
  }

  const 시험기관 = (고른곳 ?? '').startsWith('TEST:');
  const 칸이름 = 'rapo-type-t4-bold block text-(color:--rapo-color-fg-neutral)';
  const 칸묶음 = 'flex flex-col gap-(--rapo-dimension-x2)';

  return (
    <RapoPageFrame title="채용 관리" back="/me" nav="/biz">
      <p className={틀.회색칸 + ' ' + 틀.작은글}>
        숨겨 둔 화면이에요 — 승인된 담당자와 관리자에게만 보입니다
      </p>

      {탈 && <p role="alert" className={틀.오류칸}>{탈}</p>}
      {알림 && <p role="status" className="rapo-type-t4-regular break-keep rounded-(--rapo-radius-r3) bg-(--rapo-color-bg-positive-weak) p-(--rapo-dimension-x4) text-(color:--rapo-color-fg-positive-contrast)">{알림}</p>}

      {병원들.length > 1 && (
        <div className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
          {병원들.map((h) => (
            <RapoChip key={h.기관번호} on={고른곳 === h.기관번호} onClick={() => set고른곳(h.기관번호)} label={h.이름} />
          ))}
        </div>
      )}

      {시험기관 && (
        <p className={틀.주의칸}>
          여기는 <b>시험병원</b>이에요. 여기 올린 공고는 <b>회원 공고 목록에 안 나옵니다</b> —
          화면을 확인하는 데만 쓰는 자리예요.
        </p>
      )}

      <div>
        <RapoButton tone="deep-coral" size={40}
          onClick={() => { set여는것(여는것 === '새것' ? null : '새것'); set값(빈것); set탈(null); }}>
          {여는것 === '새것' ? '접기' : '공고 쓰기'}
        </RapoButton>
      </div>

      {여는것 && (
        <section className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x4)'}>
          <p className={틀.소제목}>{여는것 === '새것' ? '새 공고' : '공고 고치기'}</p>

          <div className={칸묶음}>
            <label className={칸이름} htmlFor="제목">제목</label>
            <input id="제목" value={값.제목} onChange={(e) => set값({ ...값, 제목: e.target.value })}
              placeholder="작업치료사 채용 (정규직 2명)" className={틀.입력} />
          </div>

          <div className={칸묶음}>
            <p className={칸이름}>직군</p>
            <div className="flex flex-wrap gap-x-(--rapo-dimension-x2)">
              {['작업치료사', '물리치료사'].map((g) => (
                <RapoChip key={g} on={값.직군 === g} onClick={() => set값({ ...값, 직군: g })} label={g} />
              ))}
            </div>
          </div>

          <div className="grid gap-(--rapo-dimension-x3) sm:grid-cols-2">
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="고용형태">고용형태</label>
              <input id="고용형태" value={값.고용형태}
                onChange={(e) => set값({ ...값, 고용형태: e.target.value })}
                placeholder="정규직 · 계약직 등" className={틀.입력} />
            </div>
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="근무지">근무 부서·장소</label>
              <input id="근무지" value={값.근무지}
                onChange={(e) => set값({ ...값, 근무지: e.target.value })}
                placeholder="재활의학과" className={틀.입력} />
            </div>
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="인원">뽑는 인원</label>
              <input id="인원" type="number" min={1} value={값.인원}
                onChange={(e) => set값({ ...값, 인원: e.target.value })}
                className={틀.입력 + ' num'} />
            </div>
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="접수부터">접수 시작</label>
              <input id="접수부터" type="date" value={값.접수부터}
                onChange={(e) => set값({ ...값, 접수부터: e.target.value })} className={틀.입력} />
            </div>
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="접수까지">마감일</label>
              <input id="접수까지" type="date" value={값.접수까지}
                onChange={(e) => set값({ ...값, 접수까지: e.target.value })} className={틀.입력} />
            </div>
            <div className={칸묶음}>
              <label className={칸이름} htmlFor="마감시각">마감 시각</label>
              <input id="마감시각" type="time" value={값.마감시각}
                onChange={(e) => set값({ ...값, 마감시각: e.target.value })} className={틀.입력} />
            </div>
          </div>
          <p className={틀.작은글}>
            마감일을 비워 두면 화면에 <b>「마감일 공고문 확인」</b>으로 나와요. 수시 채용이면 비워 두세요.
          </p>

          <div className={칸묶음}>
            <label className={칸이름} htmlFor="주소">지원 안내 주소</label>
            <input id="주소" value={값.주소} onChange={(e) => set값({ ...값, 주소: e.target.value })}
              placeholder="https://… (병원 채용 페이지나 공고 글 주소)" className={틀.입력} />
            <p className={틀.작은글}>
              회원이 「지원하러 가기」를 누르면 이 주소로 갑니다. 꼭 적어 주세요.
            </p>
          </div>

          <div className={칸묶음}>
            <label className={칸이름} htmlFor="지원자격">지원 자격</label>
            <textarea id="지원자격" rows={3} value={값.지원자격}
              onChange={(e) => set값({ ...값, 지원자격: e.target.value })}
              placeholder="작업치료사 면허 소지자" className={틀.긴입력} />
          </div>

          <div className={칸묶음}>
            <label className={칸이름} htmlFor="예상연봉">예상 연봉</label>
            <input id="예상연봉" value={값.예상연봉}
              onChange={(e) => set값({ ...값, 예상연봉: e.target.value })}
              placeholder="3,000만원 이상 · 내규에 따름 · 협의" className={틀.입력} />
            <p className={틀.작은글}>
              적으신 말 그대로 보여드려요. 「내규에 따름」·「협의」도 그대로 나갑니다 —
              우리가 숫자를 만들지 않아요.
            </p>
          </div>

          <p className={틀.회색칸 + ' ' + 틀.작은글}>
            공고 상세에는 <b>일곱 칸만</b> 보입니다 — 모집인원 · 접수마감 · 근무지 ·
            지원자격 · 예상 연봉과, 우리가 심평원 자료로 그리는
            「얼마나 바쁜 곳인지」 · 「병원 뜯어보기」예요.
            전형 방법 · 제출 서류 · 문의처는 <b>공고문 첨부</b>와
            「지원 안내 주소」로 보여드립니다.
          </p>

          <div className="flex flex-wrap gap-(--rapo-dimension-x2)">
            <RapoButton tone="navy" size={40} onClick={보내기} disabled={도는중}>
              {여는것 === '새것' ? '올리기' : '고치기'}
            </RapoButton>
            <RapoButton tone="outline" size={40} onClick={() => { set여는것(null); set값(빈것); }}>
              그만두기
            </RapoButton>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-(--rapo-dimension-x3)">
        <h2 className={틀.소제목}>우리 병원 공고 <span className="whitespace-nowrap">{공고들.length}건</span></h2>

        {공고들.length === 0
          ? <p className={틀.흐린글}>아직 올라온 공고가 없어요.</p>
          : (
            <ul className="flex flex-col gap-(--rapo-dimension-x3)">
              {공고들.map((j) => (
                <li key={j.id} className={틀.카드 + ' flex flex-col gap-(--rapo-dimension-x2)'}>
                  <p className="flex flex-wrap items-center gap-(--rapo-dimension-x2)">
                    <b className="rapo-type-t5-bold break-keep text-(color:--rapo-brand-color-navy)">{j.제목}</b>
                    <span className={틀.표}>{j.source === 'BIZ' ? '직접 올림' : '모아 온 공고'}</span>
                    {j.공식확인 && (
                      <span className="rapo-type-t2-medium inline-flex items-center whitespace-nowrap rounded-(--rapo-radius-r1) bg-(--rapo-color-bg-positive-weak) px-(--rapo-dimension-x2) py-(--rapo-dimension-x1) text-(color:--rapo-color-fg-positive-contrast)">
                        공식 확인
                      </span>
                    )}
                    {(j.hidden || j.hold) && (
                      <span className={틀.작은글}>{j.hidden ? '내려감' : '확인 중'}</span>
                    )}
                  </p>
                  <p className={틀.작은글}>
                    {[j.직군, j.고용형태, j.apply_to ? `~${j.apply_to}` : '마감일 없음']
                      .filter(Boolean).join(' · ')}
                  </p>
                  <p className={틀.글}>
                    <span className="whitespace-nowrap">조회 <b className="num">{j.조회수.toLocaleString('ko-KR')}</b></span>
                    {' · '}
                    <span className="whitespace-nowrap">지원하러 가기 <b className="num">{j.지원누름.toLocaleString('ko-KR')}</b></span>
                  </p>
                  {/* 첨부 — 담당자가 올린 공고에만 답니다 (모아 온 공고는 못 답니다) */}
                  {j.source === 'BIZ' && (
                    <NoticeFiles 갈래="채용" 공고={j.id} 고칠수있나
                      읽어서채우기={() => set알림(
                        '공고문 읽어서 칸 채우기는 내일 아침에 켭니다 (tools/공고칸채우기.mjs).')} />
                  )}

                  <div className="flex flex-wrap gap-(--rapo-dimension-x2) pt-(--rapo-dimension-x1)">
                    <Link href={`/jobs/${j.id}`} className={틀.선단추}>공고 보기</Link>
                    {j.source === 'BIZ' ? (
                      <>
                        <button type="button" onClick={() => 고치러(j)} className={틀.선단추}>고치기</button>
                        {!j.hidden && (
                          <>
                            <button type="button" onClick={() => 마감(j.id, false)} className={틀.선단추}>지금 마감</button>
                            <button type="button" onClick={() => 마감(j.id, true)}
                              className="rapo-type-t4-bold inline-flex h-(--rapo-dimension-x10) items-center justify-center whitespace-nowrap rounded-(--rapo-radius-r2) px-(--rapo-dimension-x4)
                                         border-(length:--rapo-border-default) border-(color:--rapo-color-stroke-critical-solid) text-(color:--rapo-color-fg-critical)
                                         active:bg-(--rapo-color-bg-transparent-pressed)">
                              내리기
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <button type="button" onClick={() => 도장(j)} className={틀.선단추}>
                        {j.공식확인 ? '공식 확인 거두기' : '우리가 올린 것이 맞아요'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      <p className={틀.작은글}>
        <b>우리가 모아 온 공고는 담당자가 고치지 못합니다.</b> 보기와 「공식 확인」까지만 됩니다 —
        긁어 온 값과 담당자가 고친 값이 어긋났을 때 어느 쪽이 맞는지 정하는 규칙을 먼저 만들어야 해요.
        고칠 곳이 있으면 공고 화면의 「잘못된 내용 알려주기」로 보내 주세요.
      </p>
    </RapoPageFrame>
  );
}
